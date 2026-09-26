'use strict';
const { withTenant, contains } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { hashPassword, validatePasswordStrength } = require('../../common/security/password');
const { notFound, badRequest, conflict, forbidden } = require('../../common/errors/AppError');
const { serializeRow } = require('../../common/utils/serialize');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const { auditInTrx } = require('../audit/auditRepository');
const { cached, cacheDel } = require('../../infrastructure/redis/cache');
const { revokeSessionsFor } = require('../auth/authService');

const FIELDS = ['name', 'type', 'registrationNumber', 'yearOfEstablishment', 'address', 'city', 'state', 'country', 'zipCode', 'phone', 'email', 'website', 'ownerName', 'ownerMedicalId', 'adminName', 'adminContact', 'tradeLicense', 'medicalCouncilCert', 'taxId', 'accreditation', 'operatingHours', 'staffCount', 'beds', 'pharmacyAvailable', 'laboratoryAvailable', 'bankInfo', 'specialties', 'services', 'paymentMethods'];
const CLINIC_ADMIN_EDITABLE = ['phone', 'email', 'website', 'address', 'city', 'state', 'country', 'zipCode', 'operatingHours', 'staffCount', 'beds', 'pharmacyAvailable', 'laboratoryAvailable', 'specialties', 'services', 'paymentMethods', 'adminContact', 'adminName'];

function serializeClinic(row, { includeSensitive = false } = {}) {
  const s = serializeRow(row);
  const out = { ...s, clinicId: row.clinicCode || row._id, validityPeriod: { startDate: row.validityStart, endDate: row.validityEnd, duration: row.validityDurationMonths, isExpired: new Date(row.validityEnd) < new Date(), renewalHistory: row.renewalHistory || [] }, status: row.isActive ? 'active' : 'inactive' };
  delete out.validityStart; delete out.validityEnd; delete out.validityDurationMonths; delete out.renewalHistory;
  if (!includeSensitive) { delete out.bankInfo; delete out.taxId; delete out.settings; }
  return out;
}
function pick(input, fields) {
  const out = {};
  for (const f of fields) if (input[f] !== undefined) out[f] = input[f] === '' && f !== 'name' ? null : input[f];
  if (out.email) out.email = String(out.email).toLowerCase();
  for (const f of ['specialties', 'services', 'paymentMethods']) if (out[f] !== undefined) out[f] = Array.isArray(out[f]) ? out[f] : [];
  return out;
}
function validityFrom(input) {
  const vp = input.validityPeriod || {};
  const start = vp.startDate ? new Date(vp.startDate) : new Date();
  const months = Number(vp.duration || 12);
  const end = vp.endDate ? new Date(vp.endDate) : new Date(start);
  if (!vp.endDate) end.setMonth(end.getMonth() + months);
  if (!(end > start)) throw badRequest('Validity end date must be after the start date', 'INVALID_VALIDITY');
  return { validityStart: start, validityEnd: end, validityDurationMonths: months };
}

async function list(scope) {
  return withTenant(scope, async (db) => (await db.c('clinics').find({}, { sort: { createdAt: -1 } })).map((r) => serializeClinic(r, { includeSensitive: scope.role === ROLES.SUPER_MASTER_ADMIN })));
}
async function getById(scope, id) {
  if (scope.role === ROLES.CLINIC_ADMIN && String(id) !== String(scope.clinicId)) throw forbidden('Access denied. You can only access your own clinic.', 'CROSS_CLINIC_ACCESS');
  return withTenant(scope, async (db) => { const row = await db.c('clinics').findById(id); if (!row) throw notFound('Clinic'); return serializeClinic(row, { includeSensitive: true }); });
}
async function getPublicClinic(clinicId) {
  return cached(`clinic:${clinicId}`, 300, async () => {
    const { withSystem } = require('../../infrastructure/mongodb/tenant');
    const row = await withSystem((db) => db.c('clinics').findById(clinicId));
    return row ? { id: row._id, name: row.name, isActive: row.isActive, validityEnd: row.validityEnd, settings: row.settings || {} } : null;
  });
}

async function create(scope, input, ctx) {
  const problems = validatePasswordStrength(input.adminPassword);
  if (problems.length) throw badRequest(`Admin password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
  const adminEmail = String(input.adminEmail).toLowerCase();
  const passwordHash = await hashPassword(input.adminPassword);
  return withTenant(scope, async (db) => {
    if (await db.c('users').exists({ email: adminEmail })) throw conflict('A user with the admin email already exists', 'ADMIN_EMAIL_TAKEN');
    const clinic = await db.c('clinics').insertOne({ ...pick(input, FIELDS), name: input.name, adminEmail, adminUsername: input.adminUsername || null, clinicCode: input.clinicId || null, isActive: input.isActive !== false, ...validityFrom(input), renewalHistory: [], settings: {} });
    const [firstName, ...rest] = String(input.adminName || 'Clinic Admin').split(' ');
    const admin = await db.c('users').insertOne({ clinicId: clinic._id, role: ROLES.CLINIC_ADMIN, email: adminEmail, passwordHash, firstName, lastName: rest.join(' ') || null, fullName: input.adminName || null, phone: input.adminContact || null, username: input.adminUsername || null, isActive: true, isVerified: true, lastLoginAt: null, failedLoginAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() });
    await auditInTrx(db, scope, { action: 'CLINIC_CREATED', resourceType: 'clinic', resourceId: clinic._id, requestId: ctx.requestId, ip: ctx.ip, details: { adminUserId: admin._id } });
    await enqueueEvent(db, { type: 'clinic.created', aggregateType: 'clinic', aggregateId: clinic._id, clinicId: clinic._id, actorId: scope.userId, payload: { name: clinic.name, adminEmail, adminName: input.adminName } });
    return serializeClinic(clinic, { includeSensitive: true });
  });
}

async function update(scope, id, input, ctx) {
  if (scope.role === ROLES.CLINIC_ADMIN && String(id) !== String(scope.clinicId)) throw forbidden('Access denied. You can only manage your own clinic.', 'CROSS_CLINIC_ACCESS');
  return withTenant(scope, async (db) => {
    const clinics = db.c('clinics');
    const current = await clinics.findById(id);
    if (!current) throw notFound('Clinic');
    let patch;
    if (scope.role === ROLES.SUPER_MASTER_ADMIN) {
      patch = pick(input, FIELDS);
      if (input.isActive !== undefined) patch.isActive = !!input.isActive;
      if (input.clinicId !== undefined) patch.clinicCode = input.clinicId || null;
      if (input.adminUsername !== undefined) patch.adminUsername = input.adminUsername;
      if (input.validityPeriod) Object.assign(patch, validityFrom({ validityPeriod: { ...input.validityPeriod, startDate: input.validityPeriod.startDate || current.validityStart } }));
    } else {
      const allowed = {};
      for (const k of CLINIC_ADMIN_EDITABLE) if (input[k] !== undefined) allowed[k] = input[k];
      patch = pick(allowed, FIELDS);
    }
    let row = Object.keys(patch).length ? await clinics.updateOne({ _id: id }, patch) : current;
    if (patch.isActive === false) await revokeSessionsFor(db, { clinicId: id, reason: 'clinic_deactivated' });
    if (scope.role === ROLES.SUPER_MASTER_ADMIN && (input.adminEmail || input.adminPassword || input.adminName || input.adminContact || input.adminUsername !== undefined)) {
      const admins = await db.c('users').find({ clinicId: id, role: ROLES.CLINIC_ADMIN }, { sort: { createdAt: 1 }, limit: 1 });
      const admin = admins[0];
      const userPatch = {};
      if (input.adminEmail) {
        const e = String(input.adminEmail).toLowerCase();
        if (await db.c('users').exists({ email: e, _id: { $ne: admin ? admin._id : null } })) throw conflict('A user with the admin email already exists', 'ADMIN_EMAIL_TAKEN');
        userPatch.email = e;
        row = await clinics.updateOne({ _id: id }, { adminEmail: e });
      }
      if (input.adminPassword) {
        const problems = validatePasswordStrength(input.adminPassword);
        if (problems.length) throw badRequest(`Admin password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
        userPatch.passwordHash = await hashPassword(input.adminPassword);
        userPatch.passwordChangedAt = new Date();
      }
      if (input.adminName) { const [firstName, ...rest] = String(input.adminName).split(' '); Object.assign(userPatch, { firstName, lastName: rest.join(' ') || null, fullName: input.adminName }); }
      if (input.adminContact) userPatch.phone = input.adminContact;
      if (input.adminUsername !== undefined) userPatch.username = input.adminUsername;
      if (admin) {
        await db.c('users').updateOne({ _id: admin._id }, userPatch);
        if (userPatch.passwordHash) await revokeSessionsFor(db, { userId: admin._id, reason: 'admin_password_reset' });
      } else if (userPatch.passwordHash && userPatch.email) {
        await db.c('users').insertOne({ clinicId: id, role: ROLES.CLINIC_ADMIN, ...userPatch, isActive: true, isVerified: true, failedLoginAttempts: 0, lockedUntil: null });
      }
    }
    await auditInTrx(db, scope, { action: 'CLINIC_UPDATED', resourceType: 'clinic', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(patch) } });
    await enqueueEvent(db, { type: 'clinic.updated', aggregateType: 'clinic', aggregateId: id, clinicId: id, actorId: scope.userId, payload: { fields: Object.keys(patch) } });
    await cacheDel(`clinic:${id}`);
    return serializeClinic(row, { includeSensitive: true });
  });
}

async function remove(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('clinics').findById(id);
    if (!row) throw notFound('Clinic');
    await db.c('clinics').updateOne({ _id: id }, { deletedAt: new Date(), isActive: false });
    await db.c('users').updateMany({ clinicId: id }, { isActive: false, deletedAt: new Date() });
    await revokeSessionsFor(db, { clinicId: id, reason: 'clinic_deleted' });
    await auditInTrx(db, scope, { action: 'CLINIC_DELETED', resourceType: 'clinic', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'clinic.deactivated', aggregateType: 'clinic', aggregateId: id, clinicId: id, actorId: scope.userId, payload: {} });
    await cacheDel(`clinic:${id}`);
    return true;
  });
}

async function dashboardData(scope, clinicId) {
  if (scope.role === ROLES.CLINIC_ADMIN && String(clinicId) !== String(scope.clinicId)) throw forbidden('Access denied to this clinic data', 'CROSS_CLINIC_ACCESS');
  return withTenant(scope, async (db) => {
    const clinic = await db.c('clinics').findById(clinicId);
    if (!clinic) throw notFound('Clinic');
    const patients = await db.c('patients').find({ clinicId }, { sort: { createdAt: -1 }, limit: 10 });
    const doctors = await db.c('practitioners').find({ clinicId, kind: 'doctor', isActive: true }, { sort: { createdAt: -1 } });
    const nurses = await db.c('practitioners').find({ clinicId, kind: 'nurse', isActive: true }, { sort: { createdAt: -1 } });
    const totalPatients = await db.c('patients').count({ clinicId });
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const todayAppointments = await db.c('appointments').count({ clinicId, scheduledAt: { $gte: start, $lt: end } });
    const age = (dob) => (dob ? new Date().getFullYear() - new Date(dob).getFullYear() : null);
    return {
      clinic: { id: clinic._id, name: clinic.name, adminEmail: clinic.adminEmail, phone: clinic.phone, address: clinic.address, city: clinic.city, state: clinic.state },
      stats: { totalPatients, totalDoctors: doctors.length, totalNurses: nurses.length, totalStaff: doctors.length + nurses.length, todayAppointments },
      patients: patients.map((p) => ({ id: p._id, name: p.fullName, age: age(p.dateOfBirth), gender: p.gender, bloodType: p.bloodGroup, modeOfCare: p.modeOfCare, registeredDate: p.createdAt })),
      doctors: doctors.map((d) => ({ id: d._id, name: d.fullName, email: d.email, phone: d.phone, specialization: d.specialty, joinedDate: d.createdAt })),
      nurses: nurses.map((n) => ({ id: n._id, name: n.fullName, email: n.email, phone: n.phone, department: n.department, joinedDate: n.createdAt })),
    };
  });
}
async function validity(scope, id) {
  if (scope.role === ROLES.CLINIC_ADMIN && String(id) !== String(scope.clinicId)) throw forbidden('Access denied', 'CROSS_CLINIC_ACCESS');
  return withTenant(scope, async (db) => {
    const row = await db.c('clinics').findById(id);
    if (!row) throw notFound('Clinic');
    const days = Math.ceil((new Date(row.validityEnd) - new Date()) / 86400000);
    return { clinicId: row._id, clinicName: row.name, startDate: row.validityStart, endDate: row.validityEnd, duration: row.validityDurationMonths, isExpired: days < 0, daysUntilExpiry: days, isExpiringSoon: days >= 0 && days <= 30, renewalHistory: row.renewalHistory || [], isActive: row.isActive };
  });
}
async function renew(scope, id, { newEndDate, duration, reason }, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('clinics').findById(id);
    if (!row) throw notFound('Clinic');
    const end = newEndDate ? new Date(newEndDate) : new Date(Math.max(Date.now(), new Date(row.validityEnd).getTime()));
    if (!newEndDate) end.setMonth(end.getMonth() + Number(duration || 12));
    if (!(end > new Date(row.validityStart))) throw badRequest('New end date must be after the start date', 'INVALID_VALIDITY');
    const history = [...(row.renewalHistory || []), { previousEndDate: row.validityEnd, newEndDate: end, renewedBy: scope.userId, renewedAt: new Date(), reason: reason || 'Manual renewal' }];
    const months = Math.max(1, Math.round((end - new Date(row.validityStart)) / (1000 * 60 * 60 * 24 * 30.44)));
    const updated = await db.c('clinics').updateOne({ _id: id }, { validityEnd: end, validityDurationMonths: months, renewalHistory: history, isActive: true });
    await auditInTrx(db, scope, { action: 'CLINIC_RENEWED', resourceType: 'clinic', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { newEndDate: end } });
    await enqueueEvent(db, { type: 'clinic.renewed', aggregateType: 'clinic', aggregateId: id, clinicId: id, actorId: scope.userId, payload: { newEndDate: end } });
    await cacheDel(`clinic:${id}`);
    return serializeClinic(updated, { includeSensitive: true });
  });
}
async function expiringSoon(scope, days) {
  return withTenant(scope, async (db) => (await db.c('clinics').find({ validityEnd: { $gte: new Date(), $lte: new Date(Date.now() + days * 86400000) } }, { sort: { validityEnd: 1 } })).map((r) => serializeClinic(r)));
}
async function expired(scope) {
  return withTenant(scope, async (db) => (await db.c('clinics').find({ validityEnd: { $lt: new Date() } }, { sort: { validityEnd: -1 } })).map((r) => serializeClinic(r)));
}
async function search(db, term, limit) {
  return (await db.c('clinics').find({ $or: [{ name: contains(term) }, { type: contains(term) }, { city: contains(term) }, { state: contains(term) }, { ownerName: contains(term) }, { registrationNumber: contains(term) }] }, { limit })).map((c) => serializeClinic(c));
}

module.exports = { list, getById, getPublicClinic, create, update, remove, dashboardData, validity, renew, expiringSoon, expired, serializeClinic, search };
