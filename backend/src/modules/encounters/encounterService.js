'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { likePattern } = require('../../common/validation/schemas');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');

const repo = new BaseRepository('encounters');

function toRow(input) {
  const row = {};
  const map = { consultationType: 'encounter_type', encounterType: 'encounter_type', mode: 'mode', status: 'status', priority: 'priority', reason: 'reason', diagnosis: 'diagnosis_summary', diagnosisSummary: 'diagnosis_summary', provider: 'provider_name', providerName: 'provider_name', providerNotes: 'provider_notes', patientNotes: 'patient_notes', followUpNotes: 'follow_up_notes', patientId: 'patient_id', appointmentId: 'appointment_id', practitionerId: 'practitioner_id', doctorId: 'practitioner_id' };
  for (const [k, c] of Object.entries(map)) if (input[k] !== undefined) row[c] = input[k] === '' ? null : input[k];
  if (input.date !== undefined || input.startedAt !== undefined) {
    const d = new Date(input.startedAt || input.date);
    if (!Number.isNaN(d.getTime())) {
      if (input.time && /^\d{1,2}:\d{2}/.test(input.time)) { const [h, m] = input.time.split(':').map(Number); d.setHours(h, m, 0, 0); }
      row.started_at = d;
    }
  }
  if (input.endedAt !== undefined) row.ended_at = input.endedAt || null;
  if (input.duration !== undefined) row.duration_minutes = Number(input.duration) || null;
  if (input.symptoms !== undefined) row.symptoms = JSON.stringify(Array.isArray(input.symptoms) ? input.symptoms : String(input.symptoms).split(',').map((s) => s.trim()).filter(Boolean));
  if (input.recommendations !== undefined) row.recommendations = JSON.stringify(input.recommendations || []);
  if (input.followUpRequired !== undefined) row.follow_up_required = !!input.followUpRequired;
  if (input.followUpDate !== undefined) row.follow_up_date = input.followUpDate || null;
  return row;
}

function serialize(r, { patient, doctor, prescriptions = [], labTests = [], imaging = [] } = {}) {
  const s = serializeRow(r);
  const t = new Date(r.started_at);
  return {
    ...s,
    consultationType: r.encounter_type,
    date: r.started_at,
    time: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`,
    duration: r.duration_minutes,
    provider: r.provider_name,
    diagnosis: r.diagnosis_summary,
    patientId: patient || ref(r.patient_id),
    patientName: patient ? patient.fullName : null,
    doctorId: doctor || (r.practitioner_id ? ref(r.practitioner_id) : null),
    prescriptions,
    labTests,
    imaging,
    notes: r.provider_notes,
  };
}

async function hydrate(trx, rows, { deep = false } = {}) {
  if (!rows.length) return [];
  const [pmap, dmap] = await Promise.all([patients.refsFor(trx, rows.map((r) => r.patient_id)), practitioners.refsFor(trx, rows.map((r) => r.practitioner_id))]);
  let rxBy = {}, labBy = {}, imgBy = {};
  if (deep) {
    const ids = rows.map((r) => r.id);
    const [rx, items, labs, imgs] = await Promise.all([
      trx('prescriptions').whereIn('encounter_id', ids).whereNull('deleted_at'),
      trx('prescription_items as i').join('prescriptions as p', 'p.id', 'i.prescription_id').whereIn('p.encounter_id', ids).select('i.*', 'p.encounter_id'),
      trx('lab_orders').whereIn('encounter_id', ids).whereNull('deleted_at'),
      trx('imaging_orders').whereIn('encounter_id', ids).whereNull('deleted_at'),
    ]);
    for (const i of items) (rxBy[i.encounter_id] = rxBy[i.encounter_id] || []).push({ _id: i.id, medication: i.name, name: i.name, dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions });
    void rx;
    for (const l of labs) (labBy[l.encounter_id] = labBy[l.encounter_id] || []).push({ _id: l.id, testName: l.test_name, priority: l.priority, status: l.status, notes: l.notes, orderedAt: l.ordered_at });
    for (const i of imgs) (imgBy[i.encounter_id] = imgBy[i.encounter_id] || []).push({ _id: i.id, type: i.modality, bodyPart: i.body_part, reason: i.reason, priority: i.priority, status: i.status });
  }
  return rows.map((r) => serialize(r, { patient: pmap[r.patient_id], doctor: dmap[r.practitioner_id], prescriptions: rxBy[r.id] || [], labTests: labBy[r.id] || [], imaging: imgBy[r.id] || [] }));
}

async function list(scope, { patientId, status, search, from, to, clinicId, page, limit, offset }) {
  return withTenant(scope, async (trx) => {
    let q = repo.scoped(trx, scope);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('clinic_id', clinicId);
    if (patientId) q = q.where('patient_id', patientId);
    if (status) q = q.where('status', status);
    if (from) q = q.where('started_at', '>=', from);
    if (to) q = q.where('started_at', '<=', to);
    if (search) q = q.where((b) => b.whereILike('reason', likePattern(search)).orWhereILike('provider_name', likePattern(search)).orWhereILike('diagnosis_summary', likePattern(search)));
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('started_at', 'desc').limit(limit).offset(offset);
    return { data: await hydrate(trx, rows), total, page, limit };
  }, getKnex());
}

async function getById(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Consultation');
    await auditInTrx(trx, scope, { action: 'MEDICAL_RECORD_VIEWED', resourceType: 'encounter', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [e] = await hydrate(trx, [row], { deep: true });
    return e;
  }, getKnex());
}

async function diagnoses(scope, patientId) {
  return withTenant(scope, async (trx) => {
    await patients.assertPatient(trx, scope, patientId);
    const rows = await trx('encounters').where({ patient_id: patientId }).whereNull('deleted_at').whereNotNull('diagnosis_summary').where('diagnosis_summary', '<>', '').orderBy('started_at', 'desc');
    const conds = await trx('clinical_conditions').where({ patient_id: patientId }).whereNull('deleted_at').orderBy('created_at', 'desc');
    return [
      ...rows.map((r) => ({ _id: r.id, diagnosis: r.diagnosis_summary, notes: r.provider_notes, createdAt: r.started_at, source: 'encounter' })),
      ...conds.map((c) => ({ _id: c.id, diagnosis: c.display, code: c.code, notes: c.notes, status: c.clinical_status, createdAt: c.onset_date || c.created_at, source: 'condition' })),
    ];
  }, getKnex());
}

async function create(scope, input, ctx) {
  const row = toRow(input);
  if (!row.patient_id) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  if (!row.started_at) row.started_at = new Date();
  return withTenant(scope, async (trx) => {
    const patient = await patients.assertPatient(trx, scope, row.patient_id);
    const clinicId = patient.clinic_id;
    if (row.practitioner_id) await practitioners.assertPractitioner(trx, scope, row.practitioner_id);
    if (row.appointment_id) {
      const appt = await trx('appointments').where({ id: row.appointment_id, clinic_id: clinicId }).first('id');
      if (!appt) throw notFound('Appointment');
    }
    const [created] = await trx('encounters').insert({ ...row, clinic_id: clinicId, created_by: scope.userId, updated_by: scope.userId }).returning('*');
    await trx('patients').where({ id: patient.id }).update({ last_visit_at: created.started_at });
    await auditInTrx(trx, { ...scope, clinicId }, { action: 'ENCOUNTER_CREATED', resourceType: 'encounter', resourceId: created.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'encounter.created', aggregateType: 'encounter', aggregateId: created.id, clinicId, actorId: scope.userId, payload: { patientId: patient.id } });
    const [e] = await hydrate(trx, [created], { deep: true });
    return e;
  }, getKnex());
}

async function update(scope, id, input, ctx) {
  const row = toRow(input);
  delete row.patient_id;
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Consultation');
    if (row.status === 'Completed' && !row.ended_at && !current.ended_at) row.ended_at = new Date();
    const updated = await repo.update(trx, scope, id, row);
    await auditInTrx(trx, scope, { action: 'MEDICAL_RECORD_UPDATED', resourceType: 'encounter', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(row) } });
    await enqueueEvent(trx, { type: row.status === 'Completed' ? 'encounter.completed' : 'encounter.updated', aggregateType: 'encounter', aggregateId: id, clinicId: updated.clinic_id, actorId: scope.userId, payload: {} });
    const [e] = await hydrate(trx, [updated], { deep: true });
    return e;
  }, getKnex());
}

async function addLabTest(scope, id, input, ctx) {
  return withTenant(scope, async (trx) => {
    const enc = await repo.findById(trx, scope, id);
    if (!enc) throw notFound('Consultation');
    await trx('lab_orders').insert({ clinic_id: enc.clinic_id, patient_id: enc.patient_id, encounter_id: enc.id, ordered_by: enc.practitioner_id, test_name: input.testName, priority: input.priority || 'Routine', notes: input.notes || null, created_by: scope.userId, updated_by: scope.userId });
    await auditInTrx(trx, scope, { action: 'LAB_ORDER_CREATED', resourceType: 'encounter', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [e] = await hydrate(trx, [enc], { deep: true });
    return e;
  }, getKnex());
}

async function stats(scope) {
  return withTenant(scope, async (trx) => {
    const base = repo.scoped(trx, scope);
    const n = async (q) => Number((await q.count({ c: '*' }))[0].c);
    const [totalConsultations, completedConsultations, scheduledConsultations] = await Promise.all([n(base.clone()), n(base.clone().where('status', 'Completed')), n(base.clone().where('status', 'Scheduled'))]);
    return { totalConsultations, completedConsultations, scheduledConsultations };
  }, getKnex());
}

async function assertEncounter(trx, scope, id) {
  if (!id) return null;
  const row = await repo.findById(trx, scope, id);
  if (!row) throw notFound('Encounter');
  return row;
}

module.exports = { list, getById, diagnoses, create, update, addLabTest, stats, assertEncounter, repo };
