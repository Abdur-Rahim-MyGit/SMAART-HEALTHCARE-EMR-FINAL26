'use strict';
const { v5: uuidv5 } = require('uuid');
const { connectMongo, closeMongo } = require('../infrastructure/mongodb/connection');
const mongoose = require('mongoose');
const { getKnex, closeKnex } = require('../infrastructure/postgres/knex');
const { withSystem } = require('../infrastructure/postgres/tenant');
const { ROLES } = require('../common/security/rbac');

const NAMESPACE = 'a7b4d1e0-5c3f-4d2a-9e8b-1f2c3d4e5f60';
const uuidFor = (collection, legacyId) => uuidv5(`${collection}:${String(legacyId)}`, NAMESPACE);

async function syncSuperMasterAdmins() {
  await connectMongo();
  const db = mongoose.connection.db;
  const legacyUsers = await db.collection('users').find({ role: 'super_master_admin' }).toArray();
  console.log(`Found ${legacyUsers.length} Super Master Admins in MongoDB.`);

  const knex = getKnex();
  await withSystem(async (trx) => {
    for (const u of legacyUsers) {
      const email = String(u.email).trim().toLowerCase();
      const id = uuidFor('users', u._id);
      const fullName = u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Super Master Admin';

      const row = {
        id,
        clinic_id: null,
        role: ROLES.SUPER_MASTER_ADMIN,
        email,
        password_hash: u.password,
        first_name: u.firstName || null,
        last_name: u.lastName || null,
        full_name: fullName,
        phone: u.phone ? String(u.phone) : null,
        is_active: u.isActive !== false,
        is_verified: true,
        last_login_at: u.lastLogin ? new Date(u.lastLogin) : null,
        created_at: u.createdAt ? new Date(u.createdAt) : new Date(),
        updated_at: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      };

      await trx('users').insert(row).onConflict('id').merge();
      await trx('legacy_id_map').insert({
        collection: 'users',
        legacy_id: String(u._id),
        new_id: id,
      }).onConflict(['collection', 'legacy_id']).merge();

      console.log(`✓ Synced: ${email} (${fullName})`);
    }
  }, knex);

  const count = await withSystem((trx) => trx('users').where({ role: ROLES.SUPER_MASTER_ADMIN }).count('id as count').first(), knex);
  console.log(`\nTotal Super Master Admins active in PostgreSQL: ${count.count}`);

  await closeMongo();
  await closeKnex();
}

if (require.main === module) {
  syncSuperMasterAdmins().catch(async (err) => {
    console.error('Error syncing super master admins:', err);
    await closeMongo();
    await closeKnex();
    process.exit(1);
  });
}

module.exports = { syncSuperMasterAdmins };
