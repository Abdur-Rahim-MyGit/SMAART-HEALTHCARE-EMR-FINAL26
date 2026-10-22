'use strict';
const crypto = require('crypto');
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { ROLES } = require('../../common/security/rbac');
const { hashPassword, validatePasswordStrength } = require('../../common/security/password');
const { notFound, badRequest, conflict, forbidden } = require('../../common/errors/AppError');
const { serializeRow } = require('../../common/utils/serialize');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const { auditInTrx } = require('../audit/auditRepository');
const { cached, cacheDel } = require('../../infrastructure/redis/cache');
const { revokeSessionsFor } = require('../auth/authService');
const { geocodeAddress, validPoint } = require('../../common/geo/geocoder');
const { getLogger } = require('../../common/logging/logger');

const FIELDS = ['name', 'type', 'registrationNumber', 'yearOfEstablishment', 'address', 'city', 'state', 'country', 'zipCode', 'phone', 'email', 'website', 'ownerName', 'ownerMedicalId', 'adminName', 'adminContact', 'tradeLicense', 'medicalCouncilCert', 'taxId', 'accreditation', 'operatingHours', 'staffCount', 'beds', 'pharmacyAvailable', 'laboratoryAvailable', 'bankInfo', 'specialties', 'services', 'paymentMethods'];
const CLINIC_ADMIN_EDITABLE = ['phone', 'email', 'website', 'address', 'city', 'state', 'country', 'zipCode', 'operatingHours', 'staffCount', 'beds', 'pharmacyAvailable', 'laboratoryAvailable', 'specialties', 'services', 'paymentMethods', 'adminContact', 'adminName'];

function serializeClinic(row, { includeSensitive = false } = {}) {
  const s = serializeRow(row);
  const out = { ...s, clinicId: row.clinicCode || row._id, validityPeriod: { startDate: row.validityStart || null, endDate: row.validityEnd || null, duration: row.validityDurationMonths || 12, isExpired: row.validityEnd ? new Date(row.validityEnd) < new Date() : false, renewalHistory: row.renewalHistory || [] }, status: row.isActive ? 'active' : 'inactive' };
  delete out.validityStart; delete out.validityEnd; delete out.validityDurationMonths; delete out.renewalHistory;
  if (!includeSensitive) { delete out.bankInfo; delete out.taxId; delete out.settings; }
  return out;
}
function pick(input, fields) {
  const out = {};
  for (const f of fields) if (input[f] !== undefined) out[f] = input[f] === '' && f !== 'name' ? null : input[f];
  if (out.email) out.email = String(out.email).toLowerCase();
  for (const f of ['specialties', 'services', 'paymentMethods']) if (out[f] !== undefined) out[f] = Array.isArray(out[f]) ? out[f] : [];
  if (out.specialties !== undefined || out.services !== undefined) {
    const list = [
      ...new Set(
        [...(out.specialties || []), ...(out.services || [])]
          .map((s) => String(s || '').toLowerCase().trim())
          .filter(Boolean)
      ),
    ];
    out.specialties = list;
    out.services = list;
  }
  return out;
}

// ── Location (latitude/longitude) ────────────────────────────────────────────
const GEO_SOURCES = ['address', 'zip', 'city', 'pin'];
const ADDRESS_FIELDS = ['address', 'city', 'state', 'country', 'zipCode'];

/**
 * The clinic's map point. `location` is the GeoJSON point ([longitude, latitude])
 * the patient (Physio) app's "nearest hospital" search reads from this same
 * `clinics` collection; latitude/longitude are kept alongside for the EMR form.
 */
function geoFields(latitude, longitude, geoSource) {
  return { latitude, longitude, geoSource, geocodedAt: new Date(), location: { type: 'Point', coordinates: [longitude, latitude] } };
}

/**
 * Fields to set for the clinic's map point. Coordinates sent by the form (from
 * "Find on map", or a pin the admin dragged) win; otherwise the address is
 * geocoded when it is new or changed, or when the clinic has no point yet.
 * A failed lookup leaves the existing point alone (and is logged).
 */
async function resolveLocation(input, current) {
  const lat = Number(input.latitude);
  const lng = Number(input.longitude);
  if (input.latitude != null && input.longitude != null && input.latitude !== '' && validPoint(lat, lng)) {
    return geoFields(lat, lng, GEO_SOURCES.includes(input.geoSource) ? input.geoSource : 'pin');
  }
  const changed = !current || ADDRESS_FIELDS.some((k) => input[k] !== undefined && String(input[k] || '').trim() !== String(current[k] || '').trim());
  if (!changed && current && current.latitude != null) return {};
  const merged = {};
  for (const k of ADDRESS_FIELDS) merged[k] = input[k] !== undefined ? input[k] : current ? current[k] : undefined;
  try {
    const hit = await geocodeAddress(merged);
    if (hit) return geoFields(hit.latitude, hit.longitude, hit.source);
    getLogger().warn({ clinicId: current && current._id }, 'clinic address could not be geocoded');
  } catch (err) {
    getLogger().warn({ err, clinicId: current && current._id }, 'clinic geocoding failed');
  }
  return {};
}

/** "Find on map" in the clinic form: look the address up without saving anything. */
async function geocodePreview(input) {
  return geocodeAddress(input);
}

/** Mirror after commit; never blocks or fails the save. */
function mirrorLater(row) {
  if (row) mirrorClinicToMongo(row).catch(() => { });
}

function toRow(input) {
  const row = pickForDb(input, CLINIC_FIELDS);
  for (const f of JSON_FIELDS) if (input[f] !== undefined) row[f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = JSON.stringify(Array.isArray(input[f]) ? input[f] : []);
  if (input.email) row.email = String(input.email).toLowerCase();
  return row;
}

// Clinic display codes: "UKGW" + 6 chars from a 32-symbol alphabet (~1e9 values).
// 256 % 32 === 0, so mapping random bytes onto the alphabet has no bias.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateClinicCode() {
  let code = 'UKGW';
  for (const b of crypto.randomBytes(6)) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}
/** Returns a clinic_code that is free (the column is UNIQUE, including soft-deleted rows). */
async function resolveClinicCode(trx, requested) {
  const free = async (code) => !(await trx('clinics').where({ clinic_code: code }).first('id'));
  if (requested) {
    if (!(await free(requested))) throw conflict('This clinic code is already in use', 'CLINIC_CODE_TAKEN');
    return requested;
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateClinicCode();
    if (await free(code)) return code;
  }
  throw conflict('Could not allocate a unique clinic code, please retry', 'CLINIC_CODE_TAKEN');
}

/**
 * "Additional users" from the Add Clinic form become extra clinic_admin accounts of the
 * new clinic (the only clinic-scoped role). Validated and hashed before the transaction.
 */
async function prepareAdditionalUsers(list, adminEmail) {
  const users = Array.isArray(list) ? list : [];
  const seen = new Set([adminEmail]);
  const out = [];
  for (const [i, u] of users.entries()) {
    const label = `Additional user ${i + 1}`;
    const name = String(u.name || '').trim();
    const email = String(u.email || '').trim().toLowerCase();
    if (!name) throw badRequest(`${label}: name is required`, 'VALIDATION_ERROR');
    if (!email) throw badRequest(`${label}: email is required`, 'VALIDATION_ERROR');
    if (seen.has(email)) throw conflict(`${label}: email ${email} is used more than once`, 'EMAIL_TAKEN');
    seen.add(email);
    const problems = validatePasswordStrength(u.password);
    if (problems.length) throw badRequest(`${label}: password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
    const [firstName, ...rest] = name.split(/\s+/);
    out.push({ email, firstName, lastName: rest.join(' ') || null, fullName: name, phone: u.phone ? String(u.phone).trim() : null, passwordHash: await hashPassword(u.password) });
  }
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
  const extraUsers = await prepareAdditionalUsers(input.additionalUsers, adminEmail);
  const location = await resolveLocation(input, null); // network lookup before the transaction opens
  let createdRow = null;
  const result = await withTenant(scope, async (trx) => {
    const existingUser = await trx('users').whereRaw('lower(email::text) = ?', [adminEmail]).whereNull('deleted_at').first('id');
    if (existingUser) throw conflict('A user with the admin email already exists', 'ADMIN_EMAIL_TAKEN');
    for (const u of extraUsers) {
      const taken = await trx('users').whereRaw('lower(email::text) = ?', [u.email]).whereNull('deleted_at').first('id');
      if (taken) throw conflict(`A user with the email ${u.email} already exists`, 'EMAIL_TAKEN');
    }
    const adminName = String(input.adminName || '').trim() || String(input.ownerName || '').trim() || 'Clinic Admin';
    const clinicCode = await resolveClinicCode(trx, input.clinicId || null);
    const [clinic] = await trx('clinics')
      .insert({ ...toRow(input), ...location, admin_name: adminName, admin_email: adminEmail, admin_username: input.adminUsername || null, clinic_code: clinicCode, is_active: input.isActive !== false, ...validityFrom(input), created_by: scope.userId, updated_by: scope.userId })
      .returning('*');
    const [firstName, ...rest] = adminName.split(' ');
    const [admin] = await trx('users')
      .insert({ clinic_id: clinic.id, role: ROLES.CLINIC_ADMIN, email: adminEmail, password_hash: passwordHash, first_name: firstName, last_name: rest.join(' ') || null, full_name: adminName, phone: input.adminContact || null, username: input.adminUsername || null, is_active: true, is_verified: true, created_by: scope.userId, updated_by: scope.userId })
      .returning('id');
    const additionalUserIds = [];
    for (const u of extraUsers) {
      const [row] = await trx('users')
        .insert({ clinic_id: clinic.id, role: ROLES.CLINIC_ADMIN, email: u.email, password_hash: u.passwordHash, first_name: u.firstName, last_name: u.lastName, full_name: u.fullName, phone: u.phone, is_active: true, is_verified: true, created_by: scope.userId, updated_by: scope.userId })
        .returning('id');
      additionalUserIds.push(row.id);
      await auditInTrx(trx, scope, { action: 'USER_CREATED', resourceType: 'user', resourceId: row.id, requestId: ctx.requestId, ip: ctx.ip, details: { role: ROLES.CLINIC_ADMIN, clinicId: clinic.id, via: 'clinic_create' } });
    }
    await auditInTrx(trx, scope, { action: 'CLINIC_CREATED', resourceType: 'clinic', resourceId: clinic.id, requestId: ctx.requestId, ip: ctx.ip, details: { adminUserId: admin.id, additionalUserIds } });
    await enqueueEvent(trx, { type: 'clinic.created', aggregateType: 'clinic', aggregateId: clinic.id, clinicId: clinic.id, actorId: scope.userId, payload: { name: clinic.name, adminEmail, adminName } });
    createdRow = clinic;
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
    Object.assign(patch, await resolveLocation(input, current));
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
      clinic: { id: clinic.id, name: clinic.name, email: clinic.email, adminName: clinic.admin_name, adminEmail: clinic.admin_email, adminContact: clinic.admin_contact, phone: clinic.phone, address: clinic.address, city: clinic.city, state: clinic.state, operatingHours: clinic.operating_hours, isActive: clinic.is_active },
      stats: { totalPatients, totalDoctors, totalNurses, totalStaff: totalDoctors + totalNurses, todayAppointments: Number(todayAppointments) },
      patients: patients.map((p) => ({ id: p.id, name: p.full_name, age: age(p.date_of_birth), gender: p.gender, bloodType: p.blood_group, modeOfCare: p.mode_of_care, registeredDate: p.created_at })),
      doctors: doctors.map((d) => ({ id: d.id, name: d.full_name, email: d.email, phone: d.phone, specialization: d.specialty, joinedDate: d.created_at })),
      nurses: nurses.map((n) => ({ id: n.id, name: n.full_name, email: n.email, phone: n.phone, department: n.department, joinedDate: n.created_at })),
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

module.exports = { list, getById, getPublicClinic, create, update, remove, dashboardData, validity, renew, expiringSoon, expired, serializeClinic, search, geocodePreview, resolveLocation };
