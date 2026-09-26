'use strict';
const { ROLES, PERMISSIONS, ROLE_PERMISSIONS } = require('../../../common/security/rbac');

exports.seed = async function seed(knex) {
  await knex('roles')
    .insert([
      { code: ROLES.SUPER_MASTER_ADMIN, name: 'Super Master Admin', description: 'Platform-wide EMR administrator' },
      { code: ROLES.CLINIC_ADMIN, name: 'Clinic Admin', description: 'Administrator of exactly one clinic' },
    ])
    .onConflict('code')
    .merge();
  await knex('permissions')
    .insert(Object.entries(PERMISSIONS).map(([code, description]) => ({ code, description })))
    .onConflict('code')
    .merge();
  const rows = [];
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) for (const p of perms) rows.push({ role_code: role, permission_code: p });
  await knex('role_permissions').insert(rows).onConflict(['role_code', 'permission_code']).ignore();
  await knex('system_settings')
    .insert([
      { key: 'security.session.access_ttl', value: JSON.stringify('15m'), description: 'Access token lifetime' },
      { key: 'security.password.min_length', value: JSON.stringify(8), description: 'Minimum password length' },
      { key: 'fhir.enabled', value: JSON.stringify(true), description: 'Expose the FHIR R4 API' },
    ])
    .onConflict('key')
    .ignore();
};
