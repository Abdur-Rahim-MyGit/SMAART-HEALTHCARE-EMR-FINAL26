'use strict';
const crypto = require('crypto');
const { withTenant } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');
const encounters = require('../encounters/encounterService');

/** Medications are embedded in the prescription document (one aggregate, one write). */
function toMedications(list) {
  return (list || []).filter((m) => m && m.name).map((m, i) => ({ _id: m._id || crypto.randomUUID(), name: m.name, dosage: m.dosage || null, frequency: m.frequency || null, duration: m.duration || null, instructions: m.instructions || null, quantity: m.quantity !== undefined && m.quantity !== null && m.quantity !== '' ? Number(m.quantity) : null, sortOrder: i }));
}

function serialize(r, { patient, doctor } = {}) {
  const s = serializeRow(r);
  return { ...s, date: r.prescribedAt, patientId: patient || ref(r.patientId), doctorId: doctor || (r.practitionerId ? ref(r.practitionerId) : null), medications: (r.medications || []).map((m) => ({ _id: m._id, name: m.name, dosage: m.dosage, frequency: m.frequency, duration: m.duration, instructions: m.instructions, quantity: m.quantity })) };
}

async function hydrate(db, rows) {
  if (!rows.length) return [];
  const [pmap, dmap] = await Promise.all([patients.refsFor(db, rows.map((r) => r.patientId)), practitioners.refsFor(db, rows.map((r) => r.practitionerId))]);
  return rows.map((r) => serialize(r, { patient: pmap[r.patientId], doctor: dmap[r.practitionerId] }));
}

async function nextNumber(db, clinicId) {
  const seq = await db.nextSequence(`rx:${clinicId}`);
  return `RX-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
}

async function list(scope, { patientId, doctorId, status, clinicId, page = 1, limit = 100, offset = 0 }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    if (doctorId) filter.practitionerId = doctorId;
    if (status) filter.status = status;
    const col = db.c('prescriptions');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { prescribedAt: -1 }, limit, skip: offset }), col.count(filter)]);
    return { data: await hydrate(db, rows), total, page, limit };
  });
}

async function getById(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('prescriptions').findById(id);
    if (!row) throw notFound('Prescription');
    await auditInTrx(db, scope, { action: 'PRESCRIPTION_VIEWED', resourceType: 'prescription', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return (await hydrate(db, [row]))[0];
  });
}

async function create(scope, input, ctx) {
  if (!input.patientId) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  const meds = toMedications(input.medications);
  if (!meds.length) throw badRequest('At least one medication is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (db) => {
    const patient = await patients.assertPatient(db, scope, input.patientId);
    const clinicId = patient.clinicId;
    if (input.doctorId) await practitioners.assertPractitioner(db, scope, input.doctorId);
    if (input.encounterId) await encounters.assertEncounter(db, scope, input.encounterId);
    const doc = { clinicId, patientId: patient._id, encounterId: input.encounterId || null, practitionerId: input.doctorId || null, prescriptionNumber: input.prescriptionNumber || (await nextNumber(db, clinicId)), prescribedAt: input.date ? new Date(input.date) : new Date(), diagnosis: input.diagnosis || null, notes: input.notes || null, status: input.status || 'Active', followUpDate: input.followUpDate ? new Date(input.followUpDate) : null, followUpInstructions: input.followUpInstructions || null, medications: meds };
    let created;
    try {
      created = await db.c('prescriptions').insertOne(doc);
    } catch (err) {
      if (err.code === 11000) throw badRequest('Prescription number already exists', 'DUPLICATE_PRESCRIPTION_NUMBER');
      throw err;
    }
    await auditInTrx(db, { ...scope, clinicId }, { action: 'PRESCRIPTION_CREATED', resourceType: 'prescription', resourceId: created._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'prescription.created', aggregateType: 'prescription', aggregateId: created._id, clinicId, actorId: scope.userId, payload: { patientId: patient._id, medications: meds.length } });
    return (await hydrate(db, [created]))[0];
  });
}

async function update(scope, id, input, ctx) {
  return withTenant(scope, async (db) => {
    const col = db.c('prescriptions');
    const current = await col.findById(id);
    if (!current) throw notFound('Prescription');
    const patch = {};
    if (input.diagnosis !== undefined) patch.diagnosis = input.diagnosis;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.status !== undefined) patch.status = input.status;
    if (input.followUpDate !== undefined) patch.followUpDate = input.followUpDate ? new Date(input.followUpDate) : null;
    if (input.followUpInstructions !== undefined) patch.followUpInstructions = input.followUpInstructions;
    if (input.doctorId !== undefined) { if (input.doctorId) await practitioners.assertPractitioner(db, scope, input.doctorId); patch.practitionerId = input.doctorId || null; }
    if (Array.isArray(input.medications)) patch.medications = toMedications(input.medications);
    const updated = await col.updateOne({ _id: id }, patch);
    await auditInTrx(db, scope, { action: 'PRESCRIPTION_UPDATED', resourceType: 'prescription', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(patch) } });
    return (await hydrate(db, [updated]))[0];
  });
}

async function remove(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const n = await db.c('prescriptions').softDelete({ _id: id });
    if (!n) throw notFound('Prescription');
    await auditInTrx(db, scope, { action: 'PRESCRIPTION_DELETED', resourceType: 'prescription', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  });
}

async function stats(scope) {
  return withTenant(scope, async (db) => {
    const col = db.c('prescriptions');
    const [total, active, completed] = await Promise.all([col.count({}), col.count({ status: 'Active' }), col.count({ status: 'Completed' })]);
    return { totalPrescriptions: total, activePrescriptions: active, completedPrescriptions: completed };
  });
}

module.exports = { list, getById, create, update, remove, stats, hydrate, toMedications };
