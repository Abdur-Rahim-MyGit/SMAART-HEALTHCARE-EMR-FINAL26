'use strict';
/**
 * Creates (or updates) the first Super Master Admin from environment variables.
 *   BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_NAME
 * Never bakes credentials into code or seeds.
 */
const { config } = require('../config');
const { getKnex, closeKnex } = require('../infrastructure/postgres/knex');
const { withSystem } = require('../infrastructure/postgres/tenant');
const { hashPassword, validatePasswordStrength } = require('../common/security/password');
const { ROLES } = require('../common/security/rbac');

async function main() {
  config();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Super Master Admin';
  if (!email || !password) throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required');
  const problems = validatePasswordStrength(password);
  if (problems.length) throw new Error(`Password must contain ${problems.join(', ')}`);
  const [firstName, ...rest] = name.split(' ');
  const passwordHash = await hashPassword(password);
  await withSystem(async (trx) => {
    const existing = await trx('users').whereRaw('lower(email::text) = lower(?)', [email]).first();
    if (existing) {
      await trx('users').where({ id: existing.id }).update({ password_hash: passwordHash, role: ROLES.SUPER_MASTER_ADMIN, clinic_id: null, is_active: true, is_verified: true, password_changed_at: trx.fn.now(), deleted_at: null });
      await trx('auth_sessions').where({ user_id: existing.id }).whereNull('revoked_at').update({ revoked_at: trx.fn.now(), revoke_reason: 'bootstrap' });
      process.stdout.write(`Updated super master admin ${email}\n`);
    } else {
      await trx('users').insert({ email, password_hash: passwordHash, role: ROLES.SUPER_MASTER_ADMIN, first_name: firstName, last_name: rest.join(' ') || null, full_name: name, is_active: true, is_verified: true });
      process.stdout.write(`Created super master admin ${email}\n`);
    }
    await trx('audit_logs').insert({ action: 'ADMIN_BOOTSTRAP', resource_type: 'user', result: 'SUCCESS', details: JSON.stringify({ email }) });
  }, getKnex());
}

main()
  .then(() => closeKnex())
  .catch(async (err) => {
    process.stderr.write(`${err.message}\n`);
    await closeKnex();
    process.exit(1);
  });
