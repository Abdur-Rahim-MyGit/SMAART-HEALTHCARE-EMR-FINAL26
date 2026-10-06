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

function toDoc(input) {
  const d = {};
  if (input.patientId !== undefined) d.patientId = input.patientId;
  if (input.doctorId !== undefined) d.practitionerId = input.doctorId || null;
  if (input.appointmentId !== undefined) d.appointmentId = input.appointmentId || null;
  if (input.scheduledDate !== undefined || input.scheduledAt !== undefined) {
    const t = new Date(input.scheduledAt || input.scheduledDate);
    if (input.scheduledTime && /^\d{1,2}:\d{2}/.test(input.scheduledTime)) { const [h, m] = input.scheduledTime.split(':').map(Number); t.setHours(h, m, 0, 0); }
    d.scheduledAt = t;
  }
  if (input.duration !== undefined) d.durationMinutes = Number(input.duration) || 30;
  for (const k of ['status', 'reason', 'notes', 'diagnosis']) if (input[k] !== undefined) d[k] = input[k];
  if (input.prescription !== undefined) d.prescriptionText = input.prescription;
  if (input.meetingLink !== undefined) d.meetingLink = input.meetingLink;
  return d;
}

function serialize(r, { patient, doctor, clinic, appointment } = {}) {
  const s = serializeRow(r);
  return { ...s, scheduledDate: r.scheduledAt, duration: r.durationMinutes, prescription: r.prescriptionText, patientId: patient || ref(r.patientId), patientName: patient ? patient.fullName : null, doctorId: doctor || (r.practitionerId ? ref(r.practitionerId) : null), doctorName: doctor ? doctor.fullName : null, clinicId: clinic ? ref(r.clinicId, clinic) : r.clinicId, appointmentId: appointment || (r.appointmentId ? ref(r.appointmentId) : null) };
}

async function hydrate(db, rows) {
  if (!rows.length) return [];
  const [pmap, dmap, clinics, appts] = await Promise.all([
    patients.refsFor(db, rows.map((r) => r.patientId)),
    practitioners.refsFor(db, rows.map((r) => r.practitionerId)),
    db.c('clinics').find({ _id: { $in: [...new Set(rows.map((r) => r.clinicId))] } }, { projection: { name: 1, city: 1, state: 1, phone: 1 } }),
    db.c('appointments').find({ _id: { $in: rows.map((r) => r.appointmentId).filter(Boolean) } }),
  ]);
  const cmap = Object.fromEntries(clinics.map((c) => [c._id, { name: c.name, city: c.city, state: c.state, phone: c.phone }]));
  const amap = Object.fromEntries(appts.map((a) => [a._id, serializeRow(a)]));
  return rows.map((r) => serialize(r, { patient: pmap[r.patientId], doctor: dmap[r.practitionerId], clinic: cmap[r.clinicId], appointment: amap[r.appointmentId] }));
}

async function list(scope, { patientId, doctorId, status, clinicId, page = 1, limit = 100, offset = 0 }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    if (doctorId) filter.practitionerId = doctorId;
    if (status) filter.status = status;
    const col = db.c('teleconsultations');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { scheduledAt: -1 }, limit, skip: offset }), col.count(filter)]);
    return { data: await hydrate(db, rows), total, page, limit };
  });
}
async function getById(scope, id) {
  return withTenant(scope, async (db) => {
    const row = await db.c('teleconsultations').findById(id);
    if (!row) throw notFound('Teleconsultation');
    return (await hydrate(db, [row]))[0];
  });
}
async function create(scope, input, ctx) {
  const d = toDoc(input);
  if (!d.patientId) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  if (!d.scheduledAt) throw badRequest('scheduledDate is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (db) => {
    const patient = await patients.assertPatient(db, scope, d.patientId);
    const clinicId = patient.clinicId;
    if (d.practitionerId) await practitioners.assertPractitioner(db, scope, d.practitionerId);
    if (d.appointmentId && !(await db.c('appointments').exists({ _id: d.appointmentId, clinicId }))) throw notFound('Appointment');
    const created = await db.c('teleconsultations').insertOne({ status: 'Scheduled', durationMinutes: 30, practitionerId: null, appointmentId: null, encounterId: null, participants: [], startedAt: null, endedAt: null, reason: null, notes: null, diagnosis: null, prescriptionText: null, ...d, clinicId, meetingId: `smaart-${crypto.randomBytes(6).toString('hex')}`, meetingLink: d.meetingLink || null });
    if (created.appointmentId) await db.c('appointments').updateOne({ _id: created.appointmentId }, { teleconsultationId: created._id, isVirtual: true });
    await auditInTrx(db, { ...scope, clinicId }, { action: 'TELECONSULTATION_CREATED', resourceType: 'teleconsultation', resourceId: created._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'teleconsultation.scheduled', aggregateType: 'teleconsultation', aggregateId: created._id, clinicId, actorId: scope.userId, payload: { patientId: patient._id, scheduledAt: created.scheduledAt } });
    return (await hydrate(db, [created]))[0];
  });
}
async function update(scope, id, input, ctx) {
  const d = toDoc(input);
  delete d.patientId;
  return withTenant(scope, async (db) => {
    if (d.practitionerId) await practitioners.assertPractitioner(db, scope, d.practitionerId);
    const updated = await db.c('teleconsultations').updateOne({ _id: id }, d);
    if (!updated) throw notFound('Teleconsultation');
    await auditInTrx(db, scope, { action: 'TELECONSULTATION_UPDATED', resourceType: 'teleconsultation', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return (await hydrate(db, [updated]))[0];
  });
}
/** Participant identity comes from the authenticated user, never from the client body. */
async function join(scope, id, auth, ctx) {
  return withTenant(scope, async (db) => {
    const col = db.c('teleconsultations');
    const current = await col.findById(id);
    if (!current) throw notFound('Teleconsultation');
    const participants = (current.participants || []).filter((p) => p.userId !== auth.userId);
    participants.push({ userId: auth.userId, role: auth.role, email: auth.email, joinedAt: new Date() });
    const updated = await col.updateOne({ _id: id }, { participants, status: current.status === 'Scheduled' ? 'In Progress' : current.status, startedAt: current.startedAt || new Date() });
    await auditInTrx(db, scope, { action: 'TELECONSULTATION_JOINED', resourceType: 'teleconsultation', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return (await hydrate(db, [updated]))[0];
  });
}
async function end(scope, id, input, ctx) {
  return withTenant(scope, async (db) => {
    const col = db.c('teleconsultations');
    const current = await col.findById(id);
    if (!current) throw notFound('Teleconsultation');
    const patch = { status: 'Completed', endedAt: new Date() };
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.diagnosis !== undefined) patch.diagnosis = input.diagnosis;
    if (input.prescription !== undefined) patch.prescriptionText = input.prescription;
    if (!current.encounterId) {
      const enc = await db.c('encounters').insertOne({ clinicId: current.clinicId, patientId: current.patientId, practitionerId: current.practitionerId || null, appointmentId: current.appointmentId || null, encounterType: 'Telemedicine', mode: 'Video', status: 'Completed', priority: 'Medium', startedAt: current.startedAt || current.scheduledAt, endedAt: patch.endedAt, reason: current.reason || null, diagnosisSummary: patch.diagnosis || current.diagnosis || null, providerNotes: patch.notes || current.notes || null, symptoms: [], recommendations: [], followUpRequired: false, clinicalNoteRef: null });
      patch.encounterId = enc._id;
    }
    const updated = await col.updateOne({ _id: id }, patch);
    await auditInTrx(db, scope, { action: 'TELECONSULTATION_ENDED', resourceType: 'teleconsultation', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'encounter.completed', aggregateType: 'teleconsultation', aggregateId: id, clinicId: current.clinicId, actorId: scope.userId, payload: { patientId: current.patientId } });
    return (await hydrate(db, [updated]))[0];
  });
}
async function remove(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const n = await db.c('teleconsultations').softDelete({ _id: id });
    if (!n) throw notFound('Teleconsultation');
    await auditInTrx(db, scope, { action: 'TELECONSULTATION_DELETED', resourceType: 'teleconsultation', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  });
}
async function stats(scope) {
  return withTenant(scope, async (db) => {
    const col = db.c('teleconsultations');
    const [totalConsultations, scheduled, active, completed] = await Promise.all([col.count({}), col.count({ status: 'Scheduled' }), col.count({ status: 'In Progress' }), col.count({ status: 'Completed' })]);
    return { totalConsultations, scheduled, active, completed };
  });
}
module.exports = { list, getById, create, update, join, end, remove, stats };
