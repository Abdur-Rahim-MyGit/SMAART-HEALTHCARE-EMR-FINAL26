'use strict';
const { withTenant, contains } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');

function toDoc(input) {
  const d = {};
  const map = { consultationType: 'encounterType', encounterType: 'encounterType', mode: 'mode', status: 'status', priority: 'priority', reason: 'reason', diagnosis: 'diagnosisSummary', diagnosisSummary: 'diagnosisSummary', provider: 'providerName', providerName: 'providerName', providerNotes: 'providerNotes', patientNotes: 'patientNotes', followUpNotes: 'followUpNotes', patientId: 'patientId', appointmentId: 'appointmentId', practitionerId: 'practitionerId', doctorId: 'practitionerId' };
  for (const [k, c] of Object.entries(map)) if (input[k] !== undefined) d[c] = input[k] === '' ? null : input[k];
  if (input.date !== undefined || input.startedAt !== undefined) {
    const t = new Date(input.startedAt || input.date);
    if (!Number.isNaN(t.getTime())) { if (input.time && /^\d{1,2}:\d{2}/.test(input.time)) { const [h, m] = input.time.split(':').map(Number); t.setHours(h, m, 0, 0); } d.startedAt = t; }
  }
  if (input.endedAt !== undefined) d.endedAt = input.endedAt ? new Date(input.endedAt) : null;
  if (input.duration !== undefined) d.durationMinutes = Number(input.duration) || null;
  if (input.symptoms !== undefined) d.symptoms = Array.isArray(input.symptoms) ? input.symptoms : String(input.symptoms).split(',').map((s) => s.trim()).filter(Boolean);
  if (input.recommendations !== undefined) d.recommendations = input.recommendations || [];
  if (input.followUpRequired !== undefined) d.followUpRequired = !!input.followUpRequired;
  if (input.followUpDate !== undefined) d.followUpDate = input.followUpDate ? new Date(input.followUpDate) : null;
  return d;
}
function serialize(r, { patient, doctor, prescriptions = [], labTests = [], imaging = [] } = {}) {
  const t = new Date(r.startedAt);
  return { ...serializeRow(r), consultationType: r.encounterType, date: r.startedAt, time: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`, duration: r.durationMinutes, provider: r.providerName, diagnosis: r.diagnosisSummary, patientId: patient || ref(r.patientId), patientName: patient ? patient.fullName : null, doctorId: doctor || (r.practitionerId ? ref(r.practitionerId) : null), prescriptions, labTests, imaging, notes: r.providerNotes };
}
async function hydrate(db, rows, { deep = false } = {}) {
  if (!rows.length) return [];
  const [pmap, dmap] = await Promise.all([patients.refsFor(db, rows.map((r) => r.patientId)), practitioners.refsFor(db, rows.map((r) => r.practitionerId))]);
  const rxBy = {}, labBy = {}, imgBy = {};
  if (deep) {
    const ids = rows.map((r) => r._id);
    const [rx, labs, imgs] = await Promise.all([db.c('prescriptions').find({ encounterId: { $in: ids } }), db.c('lab_orders').find({ encounterId: { $in: ids } }), db.c('imaging_orders').find({ encounterId: { $in: ids } })]);
    for (const p of rx) for (const m of p.medications || []) (rxBy[p.encounterId] = rxBy[p.encounterId] || []).push({ _id: m._id, medication: m.name, name: m.name, dosage: m.dosage, frequency: m.frequency, duration: m.duration, instructions: m.instructions });
    for (const l of labs) (labBy[l.encounterId] = labBy[l.encounterId] || []).push({ _id: l._id, testName: l.testName, priority: l.priority, status: l.status, notes: l.notes, orderedAt: l.orderedAt });
    for (const i of imgs) (imgBy[i.encounterId] = imgBy[i.encounterId] || []).push({ _id: i._id, type: i.modality, bodyPart: i.bodyPart, reason: i.reason, priority: i.priority, status: i.status });
  }
  return rows.map((r) => serialize(r, { patient: pmap[r.patientId], doctor: dmap[r.practitionerId], prescriptions: rxBy[r._id] || [], labTests: labBy[r._id] || [], imaging: imgBy[r._id] || [] }));
}
async function list(scope, { patientId, status, search, from, to, clinicId, page, limit, offset }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    if (from || to) filter.startedAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    if (search) filter.$or = [{ reason: contains(search) }, { providerName: contains(search) }, { diagnosisSummary: contains(search) }];
    const col = db.c('encounters');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { startedAt: -1 }, limit, skip: offset }), col.count(filter)]);
    return { data: await hydrate(db, rows), total, page, limit };
  });
}
async function getById(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('encounters').findById(id);
    if (!row) throw notFound('Consultation');
    await auditInTrx(db, scope, { action: 'MEDICAL_RECORD_VIEWED', resourceType: 'encounter', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return (await hydrate(db, [row], { deep: true }))[0];
  });
}
async function diagnoses(scope, patientId) {
  return withTenant(scope, async (db) => {
    await patients.assertPatient(db, scope, patientId);
    const rows = await db.c('encounters').find({ patientId, diagnosisSummary: { $nin: [null, ''] } }, { sort: { startedAt: -1 } });
    const conds = await db.c('clinical_conditions').find({ patientId }, { sort: { createdAt: -1 } });
    return [...rows.map((r) => ({ _id: r._id, diagnosis: r.diagnosisSummary, notes: r.providerNotes, createdAt: r.startedAt, source: 'encounter' })), ...conds.map((c) => ({ _id: c._id, diagnosis: c.display, code: c.code, notes: c.notes, status: c.clinicalStatus, createdAt: c.onsetDate || c.createdAt, source: 'condition' }))];
  });
}
async function create(scope, input, ctx) {
  const d = toDoc(input);
  if (!d.patientId) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  if (!d.startedAt) d.startedAt = new Date();
  return withTenant(scope, async (db) => {
    const patient = await patients.assertPatient(db, scope, d.patientId);
    const clinicId = patient.clinicId;
    if (d.practitionerId) await practitioners.assertPractitioner(db, scope, d.practitionerId);
    if (d.appointmentId && !(await db.c('appointments').exists({ _id: d.appointmentId, clinicId }))) throw notFound('Appointment');
    const created = await db.c('encounters').insertOne({ encounterType: 'General', mode: 'In-person', status: 'Scheduled', priority: 'Medium', symptoms: [], recommendations: [], followUpRequired: false, practitionerId: null, appointmentId: null, clinicalNoteRef: null, ...d, clinicId });
    await db.c('patients').updateOne({ _id: patient._id }, { lastVisitAt: created.startedAt });
    await auditInTrx(db, { ...scope, clinicId }, { action: 'ENCOUNTER_CREATED', resourceType: 'encounter', resourceId: created._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'encounter.created', aggregateType: 'encounter', aggregateId: created._id, clinicId, actorId: scope.userId, payload: { patientId: patient._id } });
    return (await hydrate(db, [created], { deep: true }))[0];
  });
}
async function update(scope, id, input, ctx) {
  const d = toDoc(input);
  delete d.patientId;
  return withTenant(scope, async (db) => {
    const current = await db.c('encounters').findById(id);
    if (!current) throw notFound('Consultation');
    if (d.status === 'Completed' && !d.endedAt && !current.endedAt) d.endedAt = new Date();
    const updated = await db.c('encounters').updateOne({ _id: id }, d);
    await auditInTrx(db, scope, { action: 'MEDICAL_RECORD_UPDATED', resourceType: 'encounter', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(d) } });
    await enqueueEvent(db, { type: d.status === 'Completed' ? 'encounter.completed' : 'encounter.updated', aggregateType: 'encounter', aggregateId: id, clinicId: updated.clinicId, actorId: scope.userId, payload: {} });
    return (await hydrate(db, [updated], { deep: true }))[0];
  });
}
async function addLabTest(scope, id, input, ctx) {
  return withTenant(scope, async (db) => {
    const enc = await db.c('encounters').findById(id);
    if (!enc) throw notFound('Consultation');
    await db.c('lab_orders').insertOne({ clinicId: enc.clinicId, patientId: enc.patientId, encounterId: enc._id, orderedBy: enc.practitionerId || null, testName: input.testName, testCode: null, priority: input.priority || 'Routine', status: 'ordered', orderedAt: new Date(), labName: null, notes: input.notes || null });
    await auditInTrx(db, scope, { action: 'LAB_ORDER_CREATED', resourceType: 'encounter', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return (await hydrate(db, [enc], { deep: true }))[0];
  });
}
async function stats(scope) {
  return withTenant(scope, async (db) => {
    const col = db.c('encounters');
    const [totalConsultations, completedConsultations, scheduledConsultations] = await Promise.all([col.count({}), col.count({ status: 'Completed' }), col.count({ status: 'Scheduled' })]);
    return { totalConsultations, completedConsultations, scheduledConsultations };
  });
}
async function assertEncounter(db, scope, id) {
  if (!id) return null;
  const row = await db.c('encounters').findById(id);
  if (!row) throw notFound('Encounter');
  return row;
}
module.exports = { list, getById, diagnoses, create, update, addLabTest, stats, assertEncounter };
