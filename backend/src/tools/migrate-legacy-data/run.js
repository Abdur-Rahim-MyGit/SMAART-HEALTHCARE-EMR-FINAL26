'use strict';
/**
 * Core of the legacy migration, separated from the CLI so it can be tested with
 * in-memory fixtures. `src` is an object of legacy collections (arrays of docs).
 */
const { v5: uuidv5 } = require('uuid');
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withSystem } = require('../../infrastructure/postgres/tenant');
const { hashPassword } = require('../../common/security/password');
const { ROLES } = require('../../common/security/rbac');
const mappers = require('./mappers');
const { validate } = require('./validate');

const NAMESPACE = 'a7b4d1e0-5c3f-4d2a-9e8b-1f2c3d4e5f60';
const COLLECTIONS = ['clinics', 'users', 'doctors', 'nurses', 'patients', 'appointments', 'consultations', 'vitals', 'prescriptions', 'labreports', 'medicalimages', 'referrals', 'invoices', 'billings', 'teleconsultations', 'posts', 'patientcaselogs'];
const uuidFor = (collection, legacyId) => uuidv5(`${collection}:${String(legacyId)}`, NAMESPACE);

async function runMigration(src, { apply = false, writeMongo = true } = {}) {
  const report = { startedAt: new Date(), mode: apply ? 'apply' : 'dry-run', collections: {}, warnings: [], errors: [] };
  for (const c of COLLECTIONS) { src[c] = src[c] || []; report.collections[c] = { source: src[c].length }; }
  const ctx = { uuidFor, report, hashPassword, ROLES };
  const plan = await mappers.buildPlan(src, ctx);
  report.plan = Object.fromEntries(Object.entries(plan.tables).map(([t, rows]) => [t, rows.length]));
  report.mongo = { clinicalNotes: plan.mongo.clinicalNotes.length, communityPosts: plan.mongo.communityPosts.length, activityLogs: plan.mongo.activityLogs.length };

  if (apply) {
    await withSystem(async (trx) => {
      for (const table of plan.order) {
        for (const row of plan.tables[table]) {
          const { __legacy, ...data } = row;
          await trx(table).insert(data).onConflict('id').merge();
          if (__legacy) await trx('legacy_id_map').insert({ collection: __legacy.collection, legacy_id: String(__legacy.id), new_id: data.id }).onConflict(['collection', 'legacy_id']).merge();
        }
      }
      await trx('audit_logs').insert({ action: 'DATA_MIGRATION_APPLIED', resource_type: 'system', result: 'SUCCESS', details: JSON.stringify(report.plan) });
    }, getKnex());
    const { isMongoConnected } = require('../../infrastructure/mongodb/connection');
    if (writeMongo && isMongoConnected()) {
      const models = require('../../infrastructure/mongodb/models');
      for (const n of plan.mongo.clinicalNotes) await models.ClinicalNote.updateOne({ encounterId: n.encounterId, noteType: n.noteType }, { $setOnInsert: n }, { upsert: true });
      for (const p of plan.mongo.communityPosts) await models.CommunityPost.updateOne({ legacyId: p.legacyId }, { $set: p }, { upsert: true });
      for (const a of plan.mongo.activityLogs) await models.PatientActivityLog.updateOne({ patientId: a.patientId, action: a.action, occurredAt: a.occurredAt }, { $setOnInsert: a }, { upsert: true });
    } else if (writeMongo && (plan.mongo.clinicalNotes.length || plan.mongo.communityPosts.length || plan.mongo.activityLogs.length)) {
      report.warnings.push('MongoDB not connected: clinical notes, community posts and activity logs were not written');
    }
    report.validation = await validate(getKnex(), src, plan, ctx);
  } else {
    report.validation = { checks: {}, failures: [] };
  }
  report.finishedAt = new Date();
  report.ok = report.validation.failures.length === 0 && report.errors.length === 0;
  return { report, plan };
}

module.exports = { runMigration, uuidFor, COLLECTIONS };
