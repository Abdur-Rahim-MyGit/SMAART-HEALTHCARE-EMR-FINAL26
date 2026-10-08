'use strict';
/**
 * Creates (or updates) the first Super Master Admin from environment variables.
 *   BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_NAME
 */
const { config } = require('../config');
const { connectMongo, closeMongo } = require('../infrastructure/mongodb/connection');
const { ensureSchema, seedReferenceData } = require('../infrastructure/mongodb/schema');
const { withSystem } = require('../infrastructure/mongodb/tenant');
const { hashPassword, validatePasswordStrength } = require('../common/security/password');
const { ROLES } = require('../common/security/rbac');

async function main() {
  config();
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Super Master Admin';
  if (!email || !password) throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required');
  const problems = validatePasswordStrength(password);
  if (problems.length) throw new Error(`Password must contain ${problems.join(', ')}`);
  await connectMongo();
  await ensureSchema();
  await seedReferenceData();
  const [firstName, ...rest] = name.split(' ');
  const passwordHash = await hashPassword(password);
  await withSystem(async (db) => {
    const users = db.c('users');
    const existing = await users.findOne({ email }, { includeDeleted: true });
    if (existing) {
      await users.updateOne({ _id: existing._id }, { passwordHash, role: ROLES.SUPER_MASTER_ADMIN, clinicId: null, isActive: true, isVerified: true, passwordChangedAt: new Date(), deletedAt: null, failedLoginAttempts: 0, lockedUntil: null }, { includeDeleted: true });
      await db.c('auth_sessions').updateMany({ userId: existing._id, revokedAt: null }, { revokedAt: new Date(), revokeReason: 'bootstrap' });
      process.stdout.write(`Updated super master admin ${email}\n`);
    } else {
      await users.insertOne({ email, passwordHash, role: ROLES.SUPER_MASTER_ADMIN, clinicId: null, firstName, lastName: rest.join(' ') || null, fullName: name, phone: null, username: null, isActive: true, isVerified: true, lastLoginAt: null, failedLoginAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() });
      process.stdout.write(`Created super master admin ${email}\n`);
    }
    await db.raw('audit_logs').insertOne({ _id: require('crypto').randomUUID(), occurredAt: new Date(), action: 'ADMIN_BOOTSTRAP', resourceType: 'user', result: 'SUCCESS', details: { email } });
  });
}

main()
  .then(() => closeMongo())
  .catch(async (err) => { process.stderr.write(`${err.message}\n`); await closeMongo(); process.exit(1); });
