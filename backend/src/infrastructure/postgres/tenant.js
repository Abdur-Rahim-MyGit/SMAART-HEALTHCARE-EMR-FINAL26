'use strict';
/**
 * Tenant-aware transactions. Every service call runs inside a transaction whose
 * PostgreSQL session settings (app.role, app.clinic_id, app.user_id) drive the
 * row level security policies. This is the second isolation layer; repositories
 * still add explicit clinic_id filters (first layer).
 */
const { getKnex } = require('./knex');
const { ROLES } = require('../../common/security/rbac');

const SYSTEM_ROLE = 'system';

/**
 * @param {{role:string, clinicId?:string|null, userId?:string|null}} scope
 * @param {(trx:import('knex').Knex.Transaction)=>Promise<any>} fn
 */
async function withTenant(scope, fn, knex = getKnex()) {
  if (!scope || !scope.role) throw new Error('withTenant requires a scope with a role');
  return knex.transaction(async (trx) => {
    await trx.raw(
      "select set_config('app.role', ?, true), set_config('app.clinic_id', ?, true), set_config('app.user_id', ?, true)",
      [scope.role, scope.clinicId ? String(scope.clinicId) : '', scope.userId ? String(scope.userId) : '']
    );
    return fn(trx);
  });
}

/** Internal operations (login lookups, workers) run as the system role, bypassing tenant policies. */
function withSystem(fn, knex) {
  return withTenant({ role: SYSTEM_ROLE }, fn, knex);
}

/** Effective clinic filter for a scope: null means "no filter" (super master admin). */
function clinicFilter(scope) {
  if (scope.role === ROLES.SUPER_MASTER_ADMIN || scope.role === SYSTEM_ROLE) return null;
  if (!scope.clinicId) throw new Error('Clinic scoped role without clinicId');
  return scope.clinicId;
}

module.exports = { withTenant, withSystem, clinicFilter, SYSTEM_ROLE };
