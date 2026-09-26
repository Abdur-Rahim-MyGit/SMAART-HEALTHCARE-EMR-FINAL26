'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { ROLES } = require('../../common/security/rbac');
const { hashPassword, validatePasswordStrength } = require('../../common/security/password');
const { notFound, forbidden, badRequest, conflict } = require('../../common/errors/AppError');
const { ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { invalidateSessionCache } = require('../auth/authService');

const COLS = ['u.id', 'u.clinic_id', 'u.role', 'u.email', 'u.first_name', 'u.last_name', 'u.full_name', 'u.phone', 'u.username', 'u.is_active', 'u.is_verified', 'u.last_login_at', 'u.created_at', 'u.updated_at', 'c.name as clinic_name'];

function serializeUser(r) {
  return {
    _id: r.id,
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    fullName: r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' '),
    email: r.email,
    phone: r.phone,
    username: r.username,
    role: r.role,
    clinicId: r.clinic_id ? ref(r.clinic_id, { name: r.clinic_name }) : null,
    isActive: r.is_active,
    isVerified: r.is_verified,
    lastLogin: r.last_login_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function base(trx, scope) {
  let q = trx('users as u').leftJoin('clinics as c', 'c.id', 'u.clinic_id').select(COLS).whereNull('u.deleted_at');
  if (scope.role === ROLES.CLINIC_ADMIN) q = q.where('u.clinic_id', scope.clinicId);
  return q;
}

async function list(scope, { role, clinicId }) {
  return withTenant(scope, async (trx) => {
    let q = base(trx, scope);
    if (role) q = q.where('u.role', role);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('u.clinic_id', clinicId);
    const rows = await q.orderBy('u.created_at', 'desc');
    return rows.map(serializeUser);
  }, getKnex());
}

async function getById(scope, id) {
  return withTenant(scope, async (trx) => {
    const row = await base(trx, scope).where('u.id', id).first();
    if (!row) throw notFound('User');
    return serializeUser(row);
  }, getKnex());
}

async function create(scope, input, ctx) {
  const problems = validatePasswordStrength(input.password);
  if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
  if (input.role === ROLES.SUPER_MASTER_ADMIN && scope.role !== ROLES.SUPER_MASTER_ADMIN) throw forbidden('Only a super master admin can create super master admins', 'PERMISSION_DENIED');
  const clinicId = input.role === ROLES.CLINIC_ADMIN ? (scope.role === ROLES.CLINIC_ADMIN ? scope.clinicId : input.clinicId) : null;
  if (input.role === ROLES.CLINIC_ADMIN && !clinicId) throw badRequest('clinicId is required for a clinic admin', 'CLINIC_REQUIRED');
  const email = String(input.email).toLowerCase();
  const passwordHash = await hashPassword(input.password);
  return withTenant(scope, async (trx) => {
    const taken = await trx('users').whereRaw('lower(email::text) = ?', [email]).whereNull('deleted_at').first('id');
    if (taken) throw conflict('A user with this email already exists', 'EMAIL_TAKEN');
    if (clinicId) {
      const clinic = await trx('clinics').where({ id: clinicId }).whereNull('deleted_at').first('id');
      if (!clinic) throw notFound('Clinic');
    }
    const [row] = await trx('users').insert({ clinic_id: clinicId, role: input.role, email, password_hash: passwordHash, first_name: input.firstName, last_name: input.lastName || null, full_name: [input.firstName, input.lastName].filter(Boolean).join(' '), phone: input.phone || null, username: input.username || null, is_active: true, is_verified: true, created_by: scope.userId, updated_by: scope.userId }).returning('id');
    await auditInTrx(trx, scope, { action: 'USER_CREATED', resourceType: 'user', resourceId: row.id, requestId: ctx.requestId, ip: ctx.ip, details: { role: input.role, clinicId } });
    return serializeUser(await base(trx, scope).where('u.id', row.id).first());
  }, getKnex());
}

async function update(scope, id, input, ctx) {
  return withTenant(scope, async (trx) => {
    const target = await base(trx, scope).where('u.id', id).first();
    if (!target) throw notFound('User');
    if (scope.role === ROLES.CLINIC_ADMIN && target.id !== scope.userId && target.clinic_id !== scope.clinicId) throw forbidden('Access denied', 'CROSS_CLINIC_ACCESS');
    const patch = {};
    if (input.firstName !== undefined) patch.first_name = input.firstName;
    if (input.lastName !== undefined) patch.last_name = input.lastName;
    if (input.firstName !== undefined || input.lastName !== undefined) patch.full_name = [input.firstName ?? target.first_name, input.lastName ?? target.last_name].filter(Boolean).join(' ');
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.username !== undefined) patch.username = input.username;
    if (scope.role === ROLES.SUPER_MASTER_ADMIN) {
      if (input.isActive !== undefined && target.id !== scope.userId) patch.is_active = !!input.isActive;
      if (input.email !== undefined) {
        const e = String(input.email).toLowerCase();
        const taken = await trx('users').whereRaw('lower(email::text) = ?', [e]).whereNull('deleted_at').whereNot({ id }).first('id');
        if (taken) throw conflict('A user with this email already exists', 'EMAIL_TAKEN');
        patch.email = e;
      }
      if (input.password) {
        const problems = validatePasswordStrength(input.password);
        if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
        patch.password_hash = await hashPassword(input.password);
        patch.password_changed_at = trx.fn.now();
      }
    }
    patch.updated_by = scope.userId;
    await trx('users').where({ id }).update(patch);
    if (patch.is_active === false || patch.password_hash) {
      const sessions = await trx('auth_sessions').where({ user_id: id }).whereNull('revoked_at').select('id');
      await trx('auth_sessions').where({ user_id: id }).whereNull('revoked_at').update({ revoked_at: trx.fn.now(), revoke_reason: patch.is_active === false ? 'deactivated' : 'password_reset_by_admin' });
      for (const s of sessions) await invalidateSessionCache(s.id);
    }
    await auditInTrx(trx, scope, { action: 'USER_UPDATED', resourceType: 'user', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(patch) } });
    const row = await base(trx, scope).where('u.id', id).first();
    return serializeUser(row);
  }, getKnex());
}

async function remove(scope, id, ctx) {
  if (id === scope.userId) throw badRequest('You cannot delete your own account', 'SELF_DELETE');
  return withTenant(scope, async (trx) => {
    const target = await base(trx, scope).where('u.id', id).first();
    if (!target) throw notFound('User');
    await trx('users').where({ id }).update({ deleted_at: trx.fn.now(), is_active: false, updated_by: scope.userId });
    const sessions = await trx('auth_sessions').where({ user_id: id }).whereNull('revoked_at').select('id');
    await trx('auth_sessions').where({ user_id: id }).whereNull('revoked_at').update({ revoked_at: trx.fn.now(), revoke_reason: 'user_deleted' });
    for (const s of sessions) await invalidateSessionCache(s.id);
    await auditInTrx(trx, scope, { action: 'USER_DELETED', resourceType: 'user', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  }, getKnex());
}

module.exports = { list, getById, create, update, remove, serializeUser };
