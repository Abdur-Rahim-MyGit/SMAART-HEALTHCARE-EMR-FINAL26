'use strict';
const { withTenant, clinicFilter } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { hashPassword, validatePasswordStrength } = require('../../common/security/password');
const { notFound, forbidden, badRequest, conflict } = require('../../common/errors/AppError');
const { ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { revokeSessionsFor } = require('../auth/authService');

function serializeUser(r, clinic) {
  return { _id: r._id, id: r._id, firstName: r.firstName, lastName: r.lastName, fullName: r.fullName || [r.firstName, r.lastName].filter(Boolean).join(' '), email: r.email, phone: r.phone, username: r.username, role: r.role, clinicId: r.clinicId ? ref(r.clinicId, { name: clinic ? clinic.name : undefined }) : null, isActive: r.isActive, isVerified: r.isVerified, lastLogin: r.lastLoginAt, createdAt: r.createdAt, updatedAt: r.updatedAt };
}
async function hydrate(db, rows) {
  const clinics = await db.c('clinics').find({ _id: { $in: [...new Set(rows.map((r) => r.clinicId).filter(Boolean))] } }, { projection: { name: 1 } });
  const map = Object.fromEntries(clinics.map((c) => [c._id, c]));
  return rows.map((r) => serializeUser(r, map[r.clinicId]));
}

async function list(scope, { role, clinicId }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (role) filter.role = role;
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    return hydrate(db, await db.c('users').find(filter, { sort: { createdAt: -1 } }));
  });
}
async function getById(scope, id) {
  return withTenant(scope, async (db) => { const row = await db.c('users').findById(id); if (!row) throw notFound('User'); return (await hydrate(db, [row]))[0]; });
}
async function create(scope, input, ctx) {
  const problems = validatePasswordStrength(input.password);
  if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
  if (input.role === ROLES.SUPER_MASTER_ADMIN && scope.role !== ROLES.SUPER_MASTER_ADMIN) throw forbidden('Only a super master admin can create super master admins', 'PERMISSION_DENIED');
  const clinicId = input.role === ROLES.CLINIC_ADMIN ? (scope.role === ROLES.CLINIC_ADMIN ? scope.clinicId : input.clinicId) : null;
  if (input.role === ROLES.CLINIC_ADMIN && !clinicId) throw badRequest('clinicId is required for a clinic admin', 'CLINIC_REQUIRED');
  const email = String(input.email).toLowerCase();
  const passwordHash = await hashPassword(input.password);
  return withTenant(scope, async (db) => {
    if (await db.c('users').exists({ email })) throw conflict('A user with this email already exists', 'EMAIL_TAKEN');
    if (clinicId && !(await db.c('clinics').exists({ _id: clinicId }))) throw notFound('Clinic');
    const row = await db.c('users').insertOne({ clinicId, role: input.role, email, passwordHash, firstName: input.firstName, lastName: input.lastName || null, fullName: [input.firstName, input.lastName].filter(Boolean).join(' '), phone: input.phone || null, username: input.username || null, isActive: true, isVerified: true, lastLoginAt: null, failedLoginAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() });
    await auditInTrx(db, scope, { action: 'USER_CREATED', resourceType: 'user', resourceId: row._id, requestId: ctx.requestId, ip: ctx.ip, details: { role: input.role, clinicId } });
    return (await hydrate(db, [row]))[0];
  });
}
async function update(scope, id, input, ctx) {
  return withTenant(scope, async (db) => {
    const target = await db.c('users').findById(id);
    if (!target) throw notFound('User');
    if (scope.role === ROLES.CLINIC_ADMIN && target._id !== scope.userId && String(target.clinicId) !== String(scope.clinicId)) throw forbidden('Access denied', 'CROSS_CLINIC_ACCESS');
    const patch = {};
    if (input.firstName !== undefined) patch.firstName = input.firstName;
    if (input.lastName !== undefined) patch.lastName = input.lastName;
    if (input.firstName !== undefined || input.lastName !== undefined) patch.fullName = [input.firstName ?? target.firstName, input.lastName ?? target.lastName].filter(Boolean).join(' ');
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.username !== undefined) patch.username = input.username;
    if (scope.role === ROLES.SUPER_MASTER_ADMIN) {
      if (input.isActive !== undefined && target._id !== scope.userId) patch.isActive = !!input.isActive;
      if (input.email !== undefined) {
        const e = String(input.email).toLowerCase();
        if (await db.c('users').exists({ email: e, _id: { $ne: id } })) throw conflict('A user with this email already exists', 'EMAIL_TAKEN');
        patch.email = e;
      }
      if (input.password) {
        const problems = validatePasswordStrength(input.password);
        if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
        patch.passwordHash = await hashPassword(input.password);
        patch.passwordChangedAt = new Date();
      }
    }
    const row = await db.c('users').updateOne({ _id: id }, patch);
    if (patch.isActive === false || patch.passwordHash) await revokeSessionsFor(db, { userId: id, reason: patch.isActive === false ? 'deactivated' : 'password_reset_by_admin' });
    await auditInTrx(db, scope, { action: 'USER_UPDATED', resourceType: 'user', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(patch) } });
    return (await hydrate(db, [row]))[0];
  });
}
async function remove(scope, id, ctx) {
  if (id === scope.userId) throw badRequest('You cannot delete your own account', 'SELF_DELETE');
  return withTenant(scope, async (db) => {
    const target = await db.c('users').findById(id);
    if (!target) throw notFound('User');
    await db.c('users').updateOne({ _id: id }, { deletedAt: new Date(), isActive: false });
    await revokeSessionsFor(db, { userId: id, reason: 'user_deleted' });
    await auditInTrx(db, scope, { action: 'USER_DELETED', resourceType: 'user', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  });
}
void clinicFilter;
module.exports = { list, getById, create, update, remove, serializeUser };
