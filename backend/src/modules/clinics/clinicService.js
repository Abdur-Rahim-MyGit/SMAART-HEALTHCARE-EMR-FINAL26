'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { ROLES } = require('../../common/security/rbac');
const { hashPassword, validatePasswordStrength } = require('../../common/security/password');
const { notFound, badRequest, conflict, forbidden } = require('../../common/errors/AppError');
const { serializeRow, pickForDb } = require('../../common/utils/serialize');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const { auditInTrx } = require('../audit/auditRepository');
const { cached, cacheDel } = require('../../infrastructure/redis/cache');
const { revokeSessionsFor } = require('../auth/authService');

const repo = new BaseRepository('clinics', { tenantColumn: null }); // used for write scope resolution
void repo;

const CLINIC_FIELDS = ['name', 'type', 'registrationNumber', 'yearOfEstablishment', 'address', 'city', 'state', 'country', 'zipCode', 'phone', 'email', 'website', 'ownerName', 'ownerMedicalId', 'adminName', 'adminContact', 'tradeLicense', 'medicalCouncilCert', 'taxId', 'accreditation', 'operatingHours', 'staffCount', 'beds', 'pharmacyAvailable', 'laboratoryAvailable', 'bankInfo'];
const JSON_FIELDS = ['specialties', 'services', 'paymentMethods'];
// Fields a clinic admin may edit about their own clinic (never validity, active flag, admin credentials).
const CLINIC_ADMIN_EDITABLE = ['phone', 'email', 'website', 'address', 'city', 'state', 'country', 'zipCode', 'operatingHours', 'staffCount', 'beds', 'pharmacyAvailable', 'laboratoryAvailable', 'specialties', 'services', 'paymentMethods', 'adminContact', 'adminName'];

function serializeClinic(row, { includeSensitive = false } = {}) {
  const s = serializeRow(row);
  const out = {
    ...s,
    clinicId: row.clinic_code || row.id, // legacy display code
    validityPeriod: {
      startDate: row.validity_start,
      endDate: row.validity_end,
      duration: row.validity_duration_months,
      isExpired: new Date(row.validity_end) < new Date(),
      renewalHistory: row.renewal_history || [],
    },
    status: row.is_active ? 'active' : 'inactive',
  };
  delete out.validityStart;
  delete out.validityEnd;
  delete out.validityDurationMonths;
  delete out.renewalHistory;
  if (!includeSensitive) {
    delete out.bankInfo;
    delete out.taxId;
    delete out.settings;
  }
  return out;
}

function toRow(input) {
  const row = pickForDb(input, CLINIC_FIELDS);
  for (const f of JSON_FIELDS) if (input[f] !== undefined) row[f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = JSON.stringify(Array.isArray(input[f]) ? input[f] : []);
  if (input.email) row.email = String(input.email).toLowerCase();
  return row;
}

function validityFrom(input) {
  const vp = input.validityPeriod || {};
  const start = vp.startDate ? new Date(vp.startDate) : new Date();
  const months = Number(vp.duration || 12);
  let end = vp.endDate ? new Date(vp.endDate) : new Date(start);
  if (!vp.endDate) end.setMonth(end.getMonth() + months);
  if (!(end > start)) throw badRequest('Validity end date must be after the start date', 'INVALID_VALIDITY');
  return { validity_start: start, validity_end: end, validity_duration_months: months };
}

async function list(scope) {
  return withTenant(scope, async (trx) => {
    let q = trx('clinics').whereNull('deleted_at').orderBy('created_at', 'desc');
    if (scope.role === ROLES.CLINIC_ADMIN) q = q.where('id', scope.clinicId);
    const rows = await q;
    return rows.map((r) => serializeClinic(r, { includeSensitive: scope.role === ROLES.SUPER_MASTER_ADMIN }));
  }, getKnex());
}

async function getById(scope, id) {
  if (scope.role === ROLES.CLINIC_ADMIN && String(id) !== String(scope.clinicId)) throw forbidden('Access denied. You can only access your own clinic.', 'CROSS_CLINIC_ACCESS');
  return withTenant(scope, async (trx) => {
    const row = await trx('clinics').where({ id }).whereNull('deleted_at').first();
    if (!row) throw notFound('Clinic');
    return serializeClinic(row, { includeSensitive: true });
  }, getKnex());
}

/** Cached, non-sensitive clinic settings (used by workers and the health of tenant checks). */
async function getPublicClinic(clinicId) {
  return cached(`clinic:${clinicId}`, 300, async () => {
    const row = await getKnex()('clinics').where({ id: clinicId }).whereNull('deleted_at').first('id', 'name', 'is_active', 'validity_end', 'settings');
    return row ? { id: row.id, name: row.name, isActive: row.is_active, validityEnd: row.validity_end, settings: row.settings } : null;
  });
}

async function create(scope, input, ctx) {
  const problems = validatePasswordStrength(input.adminPassword);
  if (problems.length) throw badRequest(`Admin password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
  const adminEmail = String(input.adminEmail).toLowerCase();
  const passwordHash = await hashPassword(input.adminPassword);
  return withTenant(scope, async (trx) => {
    const existingUser = await trx('users').whereRaw('lower(email::text) = ?', [adminEmail]).whereNull('deleted_at').first('id');
    if (existingUser) throw conflict('A user with the admin email already exists', 'ADMIN_EMAIL_TAKEN');
    const [clinic] = await trx('clinics')
      .insert({ ...toRow(input), admin_email: adminEmail, admin_username: input.adminUsername || null, clinic_code: input.clinicId || null, is_active: input.isActive !== false, ...validityFrom(input), created_by: scope.userId, updated_by: scope.userId })
      .returning('*');
    const [firstName, ...rest] = String(input.adminName || 'Clinic Admin').split(' ');
    const [admin] = await trx('users')
      .insert({ clinic_id: clinic.id, role: ROLES.CLINIC_ADMIN, email: adminEmail, password_hash: passwordHash, first_name: firstName, last_name: rest.join(' ') || null, full_name: input.adminName || null, phone: input.adminContact || null, username: input.adminUsername || null, is_active: true, is_verified: true, created_by: scope.userId, updated_by: scope.userId })
      .returning('id');
    await auditInTrx(trx, scope, { action: 'CLINIC_CREATED', resourceType: 'clinic', resourceId: clinic.id, requestId: ctx.requestId, ip: ctx.ip, details: { adminUserId: admin.id } });
    await enqueueEvent(trx, { type: 'clinic.created', aggregateType: 'clinic', aggregateId: clinic.id, clinicId: clinic.id, actorId: scope.userId, payload: { name: clinic.name, adminEmail, adminName: input.adminName } });
    return serializeClinic(clinic, { includeSensitive: true });
  }, getKnex());
}

async function update(scope, id, input, ctx) {
  if (scope.role === ROLES.CLINIC_ADMIN && String(id) !== String(scope.clinicId)) throw forbidden('Access denied. You can only manage your own clinic.', 'CROSS_CLINIC_ACCESS');
  return withTenant(scope, async (trx) => {
    const current = await trx('clinics').where({ id }).whereNull('deleted_at').first();
    if (!current) throw notFound('Clinic');
    let patch;
    if (scope.role === ROLES.SUPER_MASTER_ADMIN) {
      patch = toRow(input);
      if (input.isActive !== undefined) patch.is_active = !!input.isActive;
      if (input.clinicId !== undefined) patch.clinic_code = input.clinicId || null;
      if (input.adminUsername !== undefined) patch.admin_username = input.adminUsername;
      if (input.validityPeriod) Object.assign(patch, validityFrom({ validityPeriod: { ...input.validityPeriod, startDate: input.validityPeriod.startDate || current.validity_start } }));
    } else {
      const allowed = {};
      for (const k of CLINIC_ADMIN_EDITABLE) if (input[k] !== undefined) allowed[k] = input[k];
      patch = toRow(allowed);
    }
    patch.updated_by = scope.userId;
    const [row] = Object.keys(patch).length > 1 ? await trx('clinics').where({ id }).update(patch).returning('*') : [current];
    if (patch.is_active === false) await revokeSessionsFor(trx, { clinicId: id, reason: 'clinic_deactivated' });

    // Admin credential changes (super master admin only) are applied to the clinic_admin user, hashed.
    if (scope.role === ROLES.SUPER_MASTER_ADMIN && (input.adminEmail || input.adminPassword || input.adminName || input.adminContact)) {
      const admin = await trx('users').where({ clinic_id: id, role: ROLES.CLINIC_ADMIN }).whereNull('deleted_at').orderBy('created_at').first();
      const userPatch = {};
      if (input.adminEmail) {
        const e = String(input.adminEmail).toLowerCase();
        const taken = await trx('users').whereRaw('lower(email::text) = ?', [e]).whereNull('deleted_at').whereNot({ id: admin ? admin.id : null }).first('id');
        if (taken) throw conflict('A user with the admin email already exists', 'ADMIN_EMAIL_TAKEN');
        userPatch.email = e;
        await trx('clinics').where({ id }).update({ admin_email: e });
        row.admin_email = e;
      }
      if (input.adminPassword) {
        const problems = validatePasswordStrength(input.adminPassword);
        if (problems.length) throw badRequest(`Admin password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
        userPatch.password_hash = await hashPassword(input.adminPassword);
        userPatch.password_changed_at = trx.fn.now();
      }
      if (input.adminName) {
        const [firstName, ...rest] = String(input.adminName).split(' ');
        Object.assign(userPatch, { first_name: firstName, last_name: rest.join(' ') || null, full_name: input.adminName });
      }
      if (input.adminContact) userPatch.phone = input.adminContact;
      if (input.adminUsername !== undefined) userPatch.username = input.adminUsername;
      if (admin) {
        await trx('users').where({ id: admin.id }).update(userPatch);
        if (userPatch.password_hash) await revokeSessionsFor(trx, { userId: admin.id, reason: 'admin_password_reset' });
      } else if (userPatch.password_hash && userPatch.email) {
        await trx('users').insert({ clinic_id: id, role: ROLES.CLINIC_ADMIN, ...userPatch, is_active: true, is_verified: true, created_by: scope.userId });
      }
    }
    await auditInTrx(trx, scope, { action: 'CLINIC_UPDATED', resourceType: 'clinic', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(patch) } });
    await enqueueEvent(trx, { type: 'clinic.updated', aggregateType: 'clinic', aggregateId: id, clinicId: id, actorId: scope.userId, payload: { fields: Object.keys(patch) } });
    await cacheDel(`clinic:${id}`);
    return serializeClinic(row, { includeSensitive: true });
  }, getKnex());
}

async function remove(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await trx('clinics').where({ id }).whereNull('deleted_at').first('id');
    if (!row) throw notFound('Clinic');
    await trx('clinics').where({ id }).update({ deleted_at: trx.fn.now(), is_active: false, updated_by: scope.userId });
    await trx('users').where({ clinic_id: id }).update({ is_active: false, deleted_at: trx.fn.now() });
    await revokeSessionsFor(trx, { clinicId: id, reason: 'clinic_deleted' });
    await auditInTrx(trx, scope, { action: 'CLINIC_DELETED', resourceType: 'clinic', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'clinic.deactivated', aggregateType: 'clinic', aggregateId: id, clinicId: id, actorId: scope.userId, payload: {} });
    await cacheDel(`clinic:${id}`);
    return true;
  }, getKnex());
}

async function dashboardData(scope, clinicId) {
  if (scope.role === ROLES.CLINIC_ADMIN && String(clinicId) !== String(scope.clinicId)) throw forbidden('Access denied to this clinic data', 'CROSS_CLINIC_ACCESS');
  const tenant = { ...scope, clinicId };
  return withTenant(tenant, async (trx) => {
    const clinic = await trx('clinics').where({ id: clinicId }).whereNull('deleted_at').first();
    if (!clinic) throw notFound('Clinic');
    const patients = await trx('patients').where({ clinic_id: clinicId }).whereNull('deleted_at').orderBy('created_at', 'desc').limit(10);
    const doctors = await trx('practitioners').where({ clinic_id: clinicId, kind: 'doctor', is_active: true }).whereNull('deleted_at').orderBy('created_at', 'desc');
    const nurses = await trx('practitioners').where({ clinic_id: clinicId, kind: 'nurse', is_active: true }).whereNull('deleted_at').orderBy('created_at', 'desc');
    const count = async (t, extra = {}) => Number((await trx(t).where({ clinic_id: clinicId, ...extra }).whereNull('deleted_at').count({ c: '*' }))[0].c);
    const [totalPatients, totalDoctors, totalNurses] = await Promise.all([count('patients'), count('practitioners', { kind: 'doctor', is_active: true }), count('practitioners', { kind: 'nurse', is_active: true })]);
    const [{ c: todayAppointments }] = await trx('appointments').where({ clinic_id: clinicId }).whereNull('deleted_at').whereRaw('scheduled_at::date = current_date').count({ c: '*' });
    const age = (dob) => (dob ? new Date().getFullYear() - new Date(dob).getFullYear() : null);
    return {
      clinic: { id: clinic.id, name: clinic.name, adminEmail: clinic.admin_email, phone: clinic.phone, address: clinic.address, city: clinic.city, state: clinic.state },
      stats: { totalPatients, totalDoctors, totalNurses, totalStaff: totalDoctors + totalNurses, todayAppointments: Number(todayAppointments) },
      patients: patients.map((p) => ({ id: p.id, name: p.full_name, age: age(p.date_of_birth), gender: p.gender, bloodType: p.blood_group, modeOfCare: p.mode_of_care, registeredDate: p.created_at })),
      doctors: doctors.map((d) => ({ id: d.id, name: d.full_name, email: d.email, phone: d.phone, specialization: d.specialty, joinedDate: d.created_at })),
      nurses: nurses.map((n) => ({ id: n.id, name: n.full_name, email: n.email, phone: n.phone, department: n.department, joinedDate: n.created_at })),
    };
  }, getKnex());
}

async function validity(scope, id) {
  if (scope.role === ROLES.CLINIC_ADMIN && String(id) !== String(scope.clinicId)) throw forbidden('Access denied', 'CROSS_CLINIC_ACCESS');
  return withTenant(scope, async (trx) => {
    const row = await trx('clinics').where({ id }).whereNull('deleted_at').first();
    if (!row) throw notFound('Clinic');
    const end = new Date(row.validity_end);
    const days = Math.ceil((end - new Date()) / 86400000);
    return { clinicId: row.id, clinicName: row.name, startDate: row.validity_start, endDate: row.validity_end, duration: row.validity_duration_months, isExpired: days < 0, daysUntilExpiry: days, isExpiringSoon: days >= 0 && days <= 30, renewalHistory: row.renewal_history || [], isActive: row.is_active };
  }, getKnex());
}

async function renew(scope, id, { newEndDate, duration, reason }, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await trx('clinics').where({ id }).whereNull('deleted_at').first();
    if (!row) throw notFound('Clinic');
    let end = newEndDate ? new Date(newEndDate) : new Date(Math.max(Date.now(), new Date(row.validity_end).getTime()));
    if (!newEndDate) end.setMonth(end.getMonth() + Number(duration || 12));
    if (!(end > new Date(row.validity_start))) throw badRequest('New end date must be after the start date', 'INVALID_VALIDITY');
    const history = [...(row.renewal_history || []), { previousEndDate: row.validity_end, newEndDate: end, renewedBy: scope.userId, renewedAt: new Date(), reason: reason || 'Manual renewal' }];
    const months = Math.max(1, Math.round((end - new Date(row.validity_start)) / (1000 * 60 * 60 * 24 * 30.44)));
    const [updated] = await trx('clinics').where({ id }).update({ validity_end: end, validity_duration_months: months, renewal_history: JSON.stringify(history), is_active: true, updated_by: scope.userId }).returning('*');
    await auditInTrx(trx, scope, { action: 'CLINIC_RENEWED', resourceType: 'clinic', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { newEndDate: end } });
    await enqueueEvent(trx, { type: 'clinic.renewed', aggregateType: 'clinic', aggregateId: id, clinicId: id, actorId: scope.userId, payload: { newEndDate: end } });
    await cacheDel(`clinic:${id}`);
    return serializeClinic(updated, { includeSensitive: true });
  }, getKnex());
}

async function expiringSoon(scope, days) {
  return withTenant(scope, async (trx) => {
    const rows = await trx('clinics').whereNull('deleted_at').where('validity_end', '>=', trx.fn.now()).andWhere('validity_end', '<=', trx.raw(`now() + (? * interval '1 day')`, [days])).orderBy('validity_end');
    return rows.map((r) => serializeClinic(r));
  }, getKnex());
}
async function expired(scope) {
  return withTenant(scope, async (trx) => {
    const rows = await trx('clinics').whereNull('deleted_at').where('validity_end', '<', trx.fn.now()).orderBy('validity_end', 'desc');
    return rows.map((r) => serializeClinic(r));
  }, getKnex());
}

module.exports = { list, getById, getPublicClinic, create, update, remove, dashboardData, validity, renew, expiringSoon, expired, serializeClinic };
