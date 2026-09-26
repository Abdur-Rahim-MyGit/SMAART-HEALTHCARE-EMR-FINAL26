'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');
const encounters = require('../encounters/encounterService');

const repo = new BaseRepository('prescriptions');

function serialize(r, { patient, doctor, items = [] } = {}) {
  const s = serializeRow(r);
  return { ...s, date: r.prescribed_at, patientId: patient || ref(r.patient_id), doctorId: doctor || (r.practitioner_id ? ref(r.practitioner_id) : null), medications: items.map((i) => ({ _id: i.id, name: i.name, dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions, quantity: i.quantity })) };
}

async function hydrate(trx, rows) {
  if (!rows.length) return [];
  const [pmap, dmap, items] = await Promise.all([patients.refsFor(trx, rows.map((r) => r.patient_id)), practitioners.refsFor(trx, rows.map((r) => r.practitioner_id)), trx('prescription_items').whereIn('prescription_id', rows.map((r) => r.id)).orderBy('sort_order')]);
  const by = {};
  for (const i of items) (by[i.prescription_id] = by[i.prescription_id] || []).push(i);
  return rows.map((r) => serialize(r, { patient: pmap[r.patient_id], doctor: dmap[r.practitioner_id], items: by[r.id] || [] }));
}

async function nextNumber(trx, clinicId) {
  const [{ c }] = await trx('prescriptions').where({ clinic_id: clinicId }).count({ c: '*' });
  return `RX-${new Date().getFullYear()}-${String(Number(c) + 1).padStart(6, '0')}`;
}

async function list(scope, { patientId, doctorId, status, clinicId, page = 1, limit = 100, offset = 0 }) {
  return withTenant(scope, async (trx) => {
    let q = repo.scoped(trx, scope);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('clinic_id', clinicId);
    if (patientId) q = q.where('patient_id', patientId);
    if (doctorId) q = q.where('practitioner_id', doctorId);
    if (status) q = q.where('status', status);
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('prescribed_at', 'desc').limit(limit).offset(offset);
    return { data: await hydrate(trx, rows), total, page, limit };
  }, getKnex());
}

async function getById(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Prescription');
    await auditInTrx(trx, scope, { action: 'PRESCRIPTION_VIEWED', resourceType: 'prescription', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [p] = await hydrate(trx, [row]);
    return p;
  }, getKnex());
}

async function create(scope, input, ctx) {
  if (!input.patientId) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  const meds = (input.medications || []).filter((m) => m && m.name);
  if (!meds.length) throw badRequest('At least one medication is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (trx) => {
    const patient = await patients.assertPatient(trx, scope, input.patientId);
    if (input.doctorId) await practitioners.assertPractitioner(trx, scope, input.doctorId);
    if (input.encounterId) await encounters.assertEncounter(trx, scope, input.encounterId);
    let created;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        [created] = await trx('prescriptions').insert({ clinic_id: patient.clinic_id, patient_id: patient.id, encounter_id: input.encounterId || null, practitioner_id: input.doctorId || null, prescription_number: input.prescriptionNumber || (await nextNumber(trx, patient.clinic_id)), prescribed_at: input.date ? new Date(input.date) : new Date(), diagnosis: input.diagnosis || null, notes: input.notes || null, status: input.status || 'Active', follow_up_date: input.followUpDate || null, follow_up_instructions: input.followUpInstructions || null, created_by: scope.userId, updated_by: scope.userId }).returning('*');
        break;
      } catch (err) {
        if (err.code !== '23505' || input.prescriptionNumber || attempt === 2) throw err;
      }
    }
    await trx('prescription_items').insert(meds.map((m, i) => ({ prescription_id: created.id, clinic_id: patient.clinic_id, name: m.name, dosage: m.dosage || null, frequency: m.frequency || null, duration: m.duration || null, instructions: m.instructions || null, quantity: m.quantity ? Number(m.quantity) : null, sort_order: i })));
    await auditInTrx(trx, { ...scope, clinicId: patient.clinic_id }, { action: 'PRESCRIPTION_CREATED', resourceType: 'prescription', resourceId: created.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'prescription.created', aggregateType: 'prescription', aggregateId: created.id, clinicId: patient.clinic_id, actorId: scope.userId, payload: { patientId: patient.id, medications: meds.length } });
    const [p] = await hydrate(trx, [created]);
    return p;
  }, getKnex());
}

async function update(scope, id, input, ctx) {
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Prescription');
    const patch = {};
    if (input.diagnosis !== undefined) patch.diagnosis = input.diagnosis;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.status !== undefined) patch.status = input.status;
    if (input.followUpDate !== undefined) patch.follow_up_date = input.followUpDate || null;
    if (input.followUpInstructions !== undefined) patch.follow_up_instructions = input.followUpInstructions;
    if (input.doctorId !== undefined) { if (input.doctorId) await practitioners.assertPractitioner(trx, scope, input.doctorId); patch.practitioner_id = input.doctorId || null; }
    const updated = await repo.update(trx, scope, id, patch);
    if (Array.isArray(input.medications)) {
      await trx('prescription_items').where({ prescription_id: id }).delete();
      const meds = input.medications.filter((m) => m && m.name);
      if (meds.length) await trx('prescription_items').insert(meds.map((m, i) => ({ prescription_id: id, clinic_id: current.clinic_id, name: m.name, dosage: m.dosage || null, frequency: m.frequency || null, duration: m.duration || null, instructions: m.instructions || null, quantity: m.quantity ? Number(m.quantity) : null, sort_order: i })));
    }
    await auditInTrx(trx, scope, { action: 'PRESCRIPTION_UPDATED', resourceType: 'prescription', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [p] = await hydrate(trx, [updated]);
    return p;
  }, getKnex());
}

async function remove(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const ok = await repo.remove(trx, scope, id);
    if (!ok) throw notFound('Prescription');
    await auditInTrx(trx, scope, { action: 'PRESCRIPTION_DELETED', resourceType: 'prescription', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  }, getKnex());
}

async function stats(scope) {
  return withTenant(scope, async (trx) => {
    const base = repo.scoped(trx, scope);
    const n = async (q) => Number((await q.count({ c: '*' }))[0].c);
    const [total, active, completed] = await Promise.all([n(base.clone()), n(base.clone().where('status', 'Active')), n(base.clone().where('status', 'Completed'))]);
    return { totalPrescriptions: total, activePrescriptions: active, completedPrescriptions: completed };
  }, getKnex());
}

module.exports = { list, getById, create, update, remove, stats, hydrate, repo };
