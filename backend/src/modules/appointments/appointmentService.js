'use strict';
const { withTenant, resolveClinicId } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest, conflict } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { withLock } = require('../../infrastructure/redis/lock');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');

function combine(date, time) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  if (time && /^\d{1,2}:\d{2}/.test(time)) { const [h, m] = time.split(':').map(Number); d.setHours(h, m, 0, 0); }
  return d;
}
function toDoc(input) {
  const d = {};
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : combine(input.date || input.appointmentDate, input.time);
  if (scheduledAt) d.scheduledAt = scheduledAt;
  if (input.time !== undefined) d.scheduledTime = input.time;
  if (input.appointmentType !== undefined) d.appointmentType = input.appointmentType; else if (input.type !== undefined) d.appointmentType = input.type;
  if (input.duration !== undefined) d.durationMinutes = Number(input.duration) || 30;
  for (const k of ['status', 'priority', 'reason', 'notes', 'instructions', 'location']) if (input[k] !== undefined) d[k] = input[k];
  // Where it hurts, from the Physio app's body map.
  if (input.painAreas !== undefined) d.painAreas = Array.isArray(input.painAreas) ? input.painAreas : [];
  if (input.painLevel !== undefined) d.painLevel = input.painLevel === null || input.painLevel === '' ? null : Number(input.painLevel);
  if (input.painDuration !== undefined) d.painDuration = input.painDuration || null;
  if (input.isVirtual !== undefined) d.isVirtual = !!input.isVirtual;
  if (input.meetingLink !== undefined) d.meetingLink = input.meetingLink;
  if (input.followUpRequired !== undefined) d.followUpRequired = !!input.followUpRequired;
  if (input.followUpDate !== undefined) d.followUpDate = input.followUpDate ? new Date(input.followUpDate) : null;
  if (input.provider !== undefined) d.providerName = input.provider;
  if (input.patientId !== undefined) d.patientId = input.patientId;
  if (input.doctorId !== undefined) d.practitionerId = input.doctorId || null; else if (input.practitionerId !== undefined) d.practitionerId = input.practitionerId || null;
  return d;
}
function serialize(r, { patient, doctor, clinic } = {}) {
  const scheduled = r.scheduledAt || combine(r.date || r.appointmentDate, r.time || r.scheduledTime) || (r.date ? new Date(r.date) : null);
  const scheduledTime = r.scheduledTime || r.time || (scheduled instanceof Date && !isNaN(scheduled.getTime()) ? scheduled.toTimeString().slice(0, 5) : null);
  return {
    ...serializeRow(r),
    date: scheduled || r.date || null,
    appointmentDate: scheduled || r.date || null,
    time: scheduledTime,
    scheduledAt: scheduled || r.date || null,
    scheduledTime,
    duration: r.durationMinutes || r.duration || 30,
    type: r.appointmentType || r.type || 'General Consultation',
    appointmentType: r.appointmentType || r.type || 'General Consultation',
    status: r.status || 'Scheduled',
    priority: r.priority || 'normal',
    provider: r.providerName || r.provider,
    patientId: patient || ref(r.patientId),
    patientName: patient ? patient.fullName : (r.patientName || null),
    phone: patient ? patient.phone : (r.phone || null),
    email: patient ? patient.email : (r.email || null),
    doctorId: doctor || ((r.practitionerId || r.doctorId) ? ref(r.practitionerId || r.doctorId) : null),
    doctorName: doctor ? doctor.fullName : (r.doctorName || r.providerName || r.provider || null),
    department: doctor ? doctor.specialty : (r.department || null),
    clinicId: clinic ? ref(r.clinicId, clinic) : r.clinicId,
  };
}
async function hydrate(db, rows) {
  if (!rows.length) return [];
  const cleanClinicIds = [...new Set(rows.map((r) => r.clinicId).filter(Boolean))];
  const queryClinicIds = cleanClinicIds.flatMap((id) => {
    const s = String(id);
    return (/^[0-9a-fA-F]{24}$/.test(s) ? [s, new (require('mongodb').ObjectId)(s)] : [id]);
  });
  const [pmap, dmap, clinics] = await Promise.all([
    patients.refsFor(db, rows.map((r) => r.patientId)),
    practitioners.refsFor(db, rows.map((r) => r.practitionerId || r.doctorId)),
    queryClinicIds.length ? db.c('clinics').find({ _id: { $in: queryClinicIds } }, { projection: { name: 1, type: 1, city: 1, state: 1, phone: 1 } }) : []
  ]);
  const cmap = {};
  for (const c of clinics) {
    cmap[c._id] = { name: c.name, type: c.type, city: c.city, state: c.state, phone: c.phone };
    cmap[String(c._id)] = cmap[c._id];
  }
  return rows.map((r) => {
    const docId = r.practitionerId || r.doctorId;
    return serialize(r, {
      patient: pmap[r.patientId] || pmap[String(r.patientId)],
      doctor: dmap[docId] || dmap[String(docId)],
      clinic: cmap[r.clinicId] || cmap[String(r.clinicId)]
    });
  });
}
async function list(scope, { patientId, doctorId, status, from, to, clinicId, page, limit, offset }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    if (doctorId) filter.practitionerId = doctorId;
    if (status) filter.status = status;
    if (from || to) filter.scheduledAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const col = db.c('appointments');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { scheduledAt: -1 }, limit, skip: offset }), col.count(filter)]);
    return { data: await hydrate(db, rows), total, page, limit };
  });
}
async function getById(scope, id) {
  return withTenant(scope, async (db) => { const row = await db.c('appointments').findById(id); if (!row) throw notFound('Appointment'); return (await hydrate(db, [row]))[0]; });
}
async function create(scope, input, ctx) {
  const d = toDoc(input);
  if (!d.patientId) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  if (!d.scheduledAt) throw badRequest('A valid appointment date is required', 'VALIDATION_ERROR');
  const work = () => withTenant(scope, async (db) => {
    const patient = await patients.assertPatient(db, scope, d.patientId);
    const clinicId = resolveClinicId(scope, input.clinicId || patient.clinicId);
    if (String(clinicId) !== String(patient.clinicId)) throw badRequest('Patient does not belong to this clinic', 'CROSS_CLINIC_WRITE');
    if (d.practitionerId) {
      const doc = await practitioners.assertPractitioner(db, scope, d.practitionerId);
      if (String(doc.clinicId) !== String(clinicId)) throw badRequest('Practitioner does not belong to this clinic', 'CROSS_CLINIC_WRITE');
      if (!d.providerName) d.providerName = doc.fullName;
    }
    let created;
    try {
      created = await db.c('appointments').insertOne({ appointmentType: 'General Consultation', durationMinutes: 30, status: 'Scheduled', priority: 'normal', isVirtual: false, followUpRequired: false, reminderSent: false, practitionerId: null, teleconsultationId: null, ...d, clinicId });
    } catch (err) { if (err.code === 11000) throw conflict('The practitioner already has an appointment at this time', 'SLOT_TAKEN'); throw err; }
    await db.c('patients').updateOne({ _id: patient._id }, { nextAppointmentAt: created.scheduledAt });
    await auditInTrx(db, { ...scope, clinicId }, { action: 'APPOINTMENT_CREATED', resourceType: 'appointment', resourceId: created._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'appointment.created', aggregateType: 'appointment', aggregateId: created._id, clinicId, actorId: scope.userId, payload: { patientId: patient._id, scheduledAt: created.scheduledAt } });
    return (await hydrate(db, [created]))[0];
  });
  return d.practitionerId ? withLock(`appt:${d.practitionerId}:${new Date(d.scheduledAt).toISOString()}`, 5000, work) : work();
}
async function update(scope, id, input, ctx) {
  const d = toDoc(input);
  delete d.patientId;
  return withTenant(scope, async (db) => {
    const current = await db.c('appointments').findById(id);
    if (!current) throw notFound('Appointment');
    if (d.practitionerId) { const doc = await practitioners.assertPractitioner(db, scope, d.practitionerId); if (String(doc.clinicId) !== String(current.clinicId)) throw badRequest('Practitioner does not belong to this clinic', 'CROSS_CLINIC_WRITE'); }
    let updated;
    try { updated = await db.c('appointments').updateOne({ _id: id }, d, { expectedVersion: input.version }); } catch (err) { if (err.code === 11000) throw conflict('The practitioner already has an appointment at this time', 'SLOT_TAKEN'); throw err; }
    if (!updated) throw conflict('The appointment was modified by someone else. Reload and try again.', 'VERSION_CONFLICT');
    await auditInTrx(db, scope, { action: d.status === 'Cancelled' ? 'APPOINTMENT_CANCELLED' : 'APPOINTMENT_UPDATED', resourceType: 'appointment', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(d) } });
    await enqueueEvent(db, { type: d.status === 'Cancelled' ? 'appointment.cancelled' : 'appointment.updated', aggregateType: 'appointment', aggregateId: id, clinicId: updated.clinicId, actorId: scope.userId, payload: { fields: Object.keys(d) } });
    return (await hydrate(db, [updated]))[0];
  });
}
async function remove(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const n = await db.c('appointments').softDelete({ _id: id });
    if (!n) throw notFound('Appointment');
    await auditInTrx(db, scope, { action: 'APPOINTMENT_DELETED', resourceType: 'appointment', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  });
}
module.exports = { list, getById, create, update, remove, hydrate };
