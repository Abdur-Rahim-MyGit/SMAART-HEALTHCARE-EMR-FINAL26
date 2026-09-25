'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest, conflict } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { withLock } = require('../../infrastructure/redis/lock');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');

const repo = new BaseRepository('appointments');

function combine(date, time) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  if (time && /^\d{1,2}:\d{2}/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    const local = new Date(d);
    local.setHours(h, m, 0, 0);
    return local;
  }
  return d;
}

function toRow(input) {
  const row = {};
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : combine(input.date || input.appointmentDate, input.time);
  if (scheduledAt) row.scheduled_at = scheduledAt;
  if (input.time !== undefined) row.scheduled_time = input.time;
  if (input.appointmentType !== undefined) row.appointment_type = input.appointmentType;
  else if (input.type !== undefined) row.appointment_type = input.type;
  if (input.duration !== undefined) row.duration_minutes = Number(input.duration) || 30;
  for (const k of ['status', 'priority', 'reason', 'notes', 'instructions', 'location']) if (input[k] !== undefined) row[k] = input[k];
  if (input.isVirtual !== undefined) row.is_virtual = !!input.isVirtual;
  if (input.meetingLink !== undefined) row.meeting_link = input.meetingLink;
  if (input.followUpRequired !== undefined) row.follow_up_required = !!input.followUpRequired;
  if (input.followUpDate !== undefined) row.follow_up_date = input.followUpDate || null;
  if (input.provider !== undefined) row.provider_name = input.provider;
  if (input.patientId !== undefined) row.patient_id = input.patientId;
  if (input.doctorId !== undefined) row.practitioner_id = input.doctorId || null;
  else if (input.practitionerId !== undefined) row.practitioner_id = input.practitionerId || null;
  return row;
}

function serialize(r, { patient, doctor, clinic } = {}) {
  const s = serializeRow(r);
  return {
    ...s,
    date: r.scheduled_at,
    appointmentDate: r.scheduled_at,
    time: r.scheduled_time,
    duration: r.duration_minutes,
    type: r.appointment_type,
    provider: r.provider_name,
    patientId: patient || ref(r.patient_id),
    patientName: patient ? patient.fullName : null,
    phone: patient ? patient.phone : null,
    email: patient ? patient.email : null,
    doctorId: doctor || (r.practitioner_id ? ref(r.practitioner_id) : null),
    practitionerId: r.practitioner_id,
    doctorName: doctor ? doctor.fullName : r.provider_name,
    department: doctor ? doctor.specialty : null,
    clinicId: clinic ? ref(r.clinic_id, clinic) : r.clinic_id,
  };
}

async function hydrate(trx, rows) {
  if (!rows.length) return [];
  const [pmap, dmap, clinics] = await Promise.all([patients.refsFor(trx, rows.map((r) => r.patient_id)), practitioners.refsFor(trx, rows.map((r) => r.practitioner_id)), trx('clinics').whereIn('id', [...new Set(rows.map((r) => r.clinic_id))]).select('id', 'name', 'type', 'city', 'state', 'phone')]);
  const cmap = Object.fromEntries(clinics.map((c) => [c.id, { name: c.name, type: c.type, city: c.city, state: c.state, phone: c.phone }]));
  return rows.map((r) => serialize(r, { patient: pmap[r.patient_id], doctor: dmap[r.practitioner_id], clinic: cmap[r.clinic_id] }));
}

async function list(scope, { patientId, doctorId, status, from, to, clinicId, page, limit, offset }) {
  return withTenant(scope, async (trx) => {
    let q = repo.scoped(trx, scope);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('clinic_id', clinicId);
    if (patientId) q = q.where('patient_id', patientId);
    if (doctorId) q = q.where('practitioner_id', doctorId);
    if (status) q = q.where('status', status);
    if (from) q = q.where('scheduled_at', '>=', from);
    if (to) q = q.where('scheduled_at', '<=', to);
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('scheduled_at', 'desc').limit(limit).offset(offset);
    return { data: await hydrate(trx, rows), total, page, limit };
  }, getKnex());
}

async function getById(scope, id) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Appointment');
    const [a] = await hydrate(trx, [row]);
    return a;
  }, getKnex());
}

async function create(scope, input, ctx) {
  const row = toRow(input);
  if (!row.patient_id) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  if (!row.scheduled_at) throw badRequest('A valid appointment date is required', 'VALIDATION_ERROR');
  const work = () =>
    withTenant(scope, async (trx) => {
      const patient = await patients.assertPatient(trx, scope, row.patient_id);
      const clinicId = repo.resolveClinicId(scope, input.clinicId || patient.clinic_id);
      if (String(clinicId) !== String(patient.clinic_id)) throw badRequest('Patient does not belong to this clinic', 'CROSS_CLINIC_WRITE');
      if (row.practitioner_id) {
        const doc = await practitioners.assertPractitioner(trx, scope, row.practitioner_id);
        if (String(doc.clinic_id) !== String(clinicId)) throw badRequest('Practitioner does not belong to this clinic', 'CROSS_CLINIC_WRITE');
        if (!row.provider_name) row.provider_name = doc.full_name;
      }
      let created;
      try {
        [created] = await trx('appointments').insert({ ...row, clinic_id: clinicId, created_by: scope.userId, updated_by: scope.userId }).returning('*');
      } catch (err) {
        if (err.code === '23505') throw conflict('The practitioner already has an appointment at this time', 'SLOT_TAKEN');
        throw err;
      }
      await trx('patients').where({ id: patient.id }).update({ next_appointment_at: created.scheduled_at });
      await auditInTrx(trx, { ...scope, clinicId }, { action: 'APPOINTMENT_CREATED', resourceType: 'appointment', resourceId: created.id, requestId: ctx.requestId, ip: ctx.ip });
      await enqueueEvent(trx, { type: 'appointment.created', aggregateType: 'appointment', aggregateId: created.id, clinicId, actorId: scope.userId, payload: { patientId: patient.id, scheduledAt: created.scheduled_at } });
      const [a] = await hydrate(trx, [created]);
      return a;
    }, getKnex());
  return row.practitioner_id ? withLock(`appt:${row.practitioner_id}:${new Date(row.scheduled_at).toISOString()}`, 5000, work) : work();
}

async function update(scope, id, input, ctx) {
  const row = toRow(input);
  delete row.patient_id; // an appointment never moves between patients
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Appointment');
    if (row.practitioner_id) {
      const doc = await practitioners.assertPractitioner(trx, scope, row.practitioner_id);
      if (String(doc.clinic_id) !== String(current.clinic_id)) throw badRequest('Practitioner does not belong to this clinic', 'CROSS_CLINIC_WRITE');
    }
    let updated;
    try {
      updated = await repo.update(trx, scope, id, row, { expectedVersion: input.version });
    } catch (err) {
      if (err.code === '23505') throw conflict('The practitioner already has an appointment at this time', 'SLOT_TAKEN');
      throw err;
    }
    if (!updated) throw conflict('The appointment was modified by someone else. Reload and try again.', 'VERSION_CONFLICT');
    const action = row.status === 'Cancelled' ? 'APPOINTMENT_CANCELLED' : 'APPOINTMENT_UPDATED';
    await auditInTrx(trx, scope, { action, resourceType: 'appointment', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(row) } });
    await enqueueEvent(trx, { type: row.status === 'Cancelled' ? 'appointment.cancelled' : 'appointment.updated', aggregateType: 'appointment', aggregateId: id, clinicId: updated.clinic_id, actorId: scope.userId, payload: { fields: Object.keys(row) } });
    const [a] = await hydrate(trx, [updated]);
    return a;
  }, getKnex());
}

async function remove(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Appointment');
    await repo.remove(trx, scope, id);
    await auditInTrx(trx, scope, { action: 'APPOINTMENT_DELETED', resourceType: 'appointment', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  }, getKnex());
}

module.exports = { list, getById, create, update, remove, hydrate, repo };
