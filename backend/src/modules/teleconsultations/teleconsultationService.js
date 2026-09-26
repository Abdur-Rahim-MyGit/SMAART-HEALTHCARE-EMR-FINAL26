'use strict';
const crypto = require('crypto');
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
const appointments = require('../appointments/appointmentService');

const repo = new BaseRepository('teleconsultations');

function toRow(input) {
  const row = {};
  if (input.patientId !== undefined) row.patient_id = input.patientId;
  if (input.doctorId !== undefined) row.practitioner_id = input.doctorId || null;
  if (input.appointmentId !== undefined) row.appointment_id = input.appointmentId || null;
  if (input.scheduledDate !== undefined || input.scheduledAt !== undefined) {
    const d = new Date(input.scheduledAt || input.scheduledDate);
    if (input.scheduledTime && /^\d{1,2}:\d{2}/.test(input.scheduledTime)) { const [h, m] = input.scheduledTime.split(':').map(Number); d.setHours(h, m, 0, 0); }
    row.scheduled_at = d;
  }
  if (input.duration !== undefined) row.duration_minutes = Number(input.duration) || 30;
  for (const k of ['status', 'reason', 'notes', 'diagnosis']) if (input[k] !== undefined) row[k] = input[k];
  if (input.prescription !== undefined) row.prescription_text = input.prescription;
  if (input.meetingLink !== undefined) row.meeting_link = input.meetingLink;
  return row;
}

function serialize(r, { patient, doctor, clinic, appointment } = {}) {
  const s = serializeRow(r);
  return { ...s, scheduledDate: r.scheduled_at, duration: r.duration_minutes, prescription: r.prescription_text, patientId: patient || ref(r.patient_id), patientName: patient ? patient.fullName : null, doctorId: doctor || (r.practitioner_id ? ref(r.practitioner_id) : null), doctorName: doctor ? doctor.fullName : null, clinicId: clinic ? ref(r.clinic_id, clinic) : r.clinic_id, appointmentId: appointment || (r.appointment_id ? ref(r.appointment_id) : null) };
}

async function hydrate(trx, rows) {
  if (!rows.length) return [];
  const [pmap, dmap, clinics, appts] = await Promise.all([patients.refsFor(trx, rows.map((r) => r.patient_id)), practitioners.refsFor(trx, rows.map((r) => r.practitioner_id)), trx('clinics').whereIn('id', [...new Set(rows.map((r) => r.clinic_id))]).select('id', 'name', 'city', 'state', 'phone'), trx('appointments').whereIn('id', rows.map((r) => r.appointment_id).filter(Boolean))]);
  const cmap = Object.fromEntries(clinics.map((c) => [c.id, { name: c.name, city: c.city, state: c.state, phone: c.phone }]));
  const amap = Object.fromEntries(appts.map((a) => [a.id, serializeRow(a)]));
  return rows.map((r) => serialize(r, { patient: pmap[r.patient_id], doctor: dmap[r.practitioner_id], clinic: cmap[r.clinic_id], appointment: amap[r.appointment_id] }));
}

async function list(scope, { patientId, doctorId, status, clinicId, page = 1, limit = 100, offset = 0 }) {
  return withTenant(scope, async (trx) => {
    let q = repo.scoped(trx, scope);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('clinic_id', clinicId);
    if (patientId) q = q.where('patient_id', patientId);
    if (doctorId) q = q.where('practitioner_id', doctorId);
    if (status) q = q.where('status', status);
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('scheduled_at', 'desc').limit(limit).offset(offset);
    return { data: await hydrate(trx, rows), total, page, limit };
  }, getKnex());
}
async function getById(scope, id) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Teleconsultation');
    const [t] = await hydrate(trx, [row]);
    return t;
  }, getKnex());
}
async function create(scope, input, ctx) {
  const row = toRow(input);
  if (!row.patient_id) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  if (!row.scheduled_at) throw badRequest('scheduledDate is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (trx) => {
    const patient = await patients.assertPatient(trx, scope, row.patient_id);
    if (row.practitioner_id) await practitioners.assertPractitioner(trx, scope, row.practitioner_id);
    if (row.appointment_id) { const a = await appointments.repo.findById(trx, scope, row.appointment_id); if (!a) throw notFound('Appointment'); }
    const meetingId = `smaart-${crypto.randomBytes(6).toString('hex')}`;
    const [created] = await trx('teleconsultations').insert({ ...row, clinic_id: patient.clinic_id, meeting_id: meetingId, meeting_link: row.meeting_link || null, created_by: scope.userId, updated_by: scope.userId }).returning('*');
    if (created.appointment_id) await trx('appointments').where({ id: created.appointment_id }).update({ teleconsultation_id: created.id, is_virtual: true });
    await auditInTrx(trx, { ...scope, clinicId: patient.clinic_id }, { action: 'TELECONSULTATION_CREATED', resourceType: 'teleconsultation', resourceId: created.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'teleconsultation.scheduled', aggregateType: 'teleconsultation', aggregateId: created.id, clinicId: patient.clinic_id, actorId: scope.userId, payload: { patientId: patient.id, scheduledAt: created.scheduled_at } });
    const [t] = await hydrate(trx, [created]);
    return t;
  }, getKnex());
}
async function update(scope, id, input, ctx) {
  const row = toRow(input);
  delete row.patient_id;
  return withTenant(scope, async (trx) => {
    if (row.practitioner_id) await practitioners.assertPractitioner(trx, scope, row.practitioner_id);
    const updated = await repo.update(trx, scope, id, row);
    if (!updated) throw notFound('Teleconsultation');
    await auditInTrx(trx, scope, { action: 'TELECONSULTATION_UPDATED', resourceType: 'teleconsultation', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [t] = await hydrate(trx, [updated]);
    return t;
  }, getKnex());
}
/** Participant identity comes from the authenticated user, never from the client body. */
async function join(scope, id, auth, ctx) {
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Teleconsultation');
    const participants = (current.participants || []).filter((p) => p.userId !== auth.userId);
    participants.push({ userId: auth.userId, role: auth.role, email: auth.email, joinedAt: new Date() });
    const updated = await repo.update(trx, scope, id, { participants: JSON.stringify(participants), status: current.status === 'Scheduled' ? 'In Progress' : current.status, started_at: current.started_at || new Date() });
    await auditInTrx(trx, scope, { action: 'TELECONSULTATION_JOINED', resourceType: 'teleconsultation', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [t] = await hydrate(trx, [updated]);
    return t;
  }, getKnex());
}
async function end(scope, id, input, ctx) {
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Teleconsultation');
    const patch = { status: 'Completed', ended_at: new Date() };
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.diagnosis !== undefined) patch.diagnosis = input.diagnosis;
    if (input.prescription !== undefined) patch.prescription_text = input.prescription;
    let updated = await repo.update(trx, scope, id, patch);
    if (!current.encounter_id) {
      const [enc] = await trx('encounters').insert({ clinic_id: current.clinic_id, patient_id: current.patient_id, practitioner_id: current.practitioner_id, appointment_id: current.appointment_id, encounter_type: 'Telemedicine', mode: 'Video', status: 'Completed', started_at: current.started_at || current.scheduled_at, ended_at: patch.ended_at, reason: current.reason, diagnosis_summary: patch.diagnosis || current.diagnosis, provider_notes: patch.notes || current.notes, created_by: scope.userId, updated_by: scope.userId }).returning('id');
      await trx('teleconsultations').where({ id }).update({ encounter_id: enc.id });
      updated = await repo.findById(trx, scope, id);
    }
    await auditInTrx(trx, scope, { action: 'TELECONSULTATION_ENDED', resourceType: 'teleconsultation', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'encounter.completed', aggregateType: 'teleconsultation', aggregateId: id, clinicId: current.clinic_id, actorId: scope.userId, payload: { patientId: current.patient_id } });
    const [t] = await hydrate(trx, [updated]);
    return t;
  }, getKnex());
}
async function remove(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const ok = await repo.remove(trx, scope, id);
    if (!ok) throw notFound('Teleconsultation');
    await auditInTrx(trx, scope, { action: 'TELECONSULTATION_DELETED', resourceType: 'teleconsultation', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  }, getKnex());
}
async function stats(scope) {
  return withTenant(scope, async (trx) => {
    const base = repo.scoped(trx, scope);
    const n = async (q) => Number((await q.count({ c: '*' }))[0].c);
    const [totalConsultations, scheduled, active, completed] = await Promise.all([n(base.clone()), n(base.clone().where('status', 'Scheduled')), n(base.clone().where('status', 'In Progress')), n(base.clone().where('status', 'Completed'))]);
    return { totalConsultations, scheduled, active, completed };
  }, getKnex());
}
module.exports = { list, getById, create, update, join, end, remove, stats, repo };
