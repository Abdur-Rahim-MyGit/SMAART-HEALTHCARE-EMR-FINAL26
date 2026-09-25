'use strict';
/**
 * Legacy MongoDB → PostgreSQL data migration.
 *
 *   npm run migrate:data -- --mongo mongodb://... --dry-run      # analyse + validate, write report
 *   npm run migrate:data -- --mongo mongodb://... --apply        # migrate (idempotent), then validate
 *   npm run migrate:data -- --mongo mongodb://... --report out.json
 *
 * Rules: read-only on MongoDB; every ObjectId maps to a deterministic UUID v5 stored in
 * legacy_id_map so re-runs update instead of duplicate; legacy data is never deleted here.
 */
const { MongoClient } = require('mongodb');
const { v5: uuidv5 } = require('uuid');
const fs = require('fs');
const { config } = require('../../config');
const { getKnex, closeKnex } = require('../../infrastructure/postgres/knex');
const { withSystem } = require('../../infrastructure/postgres/tenant');
const { hashPassword } = require('../../common/security/password');
const { ROLES } = require('../../common/security/rbac');
const mappers = require('./mappers');
const { validate } = require('./validate');

const NAMESPACE = 'a7b4d1e0-5c3f-4d2a-9e8b-1f2c3d4e5f60';
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] || true : def; };
const DRY = args.includes('--dry-run') || !args.includes('--apply');
const MONGO = opt('mongo', process.env.LEGACY_MONGODB_URI);
const REPORT = opt('report', `migration-report-${Date.now()}.json`);

const uuidFor = (collection, legacyId) => uuidv5(`${collection}:${String(legacyId)}`, NAMESPACE);

async function main() {
  config();
  if (!MONGO) throw new Error('--mongo <uri> (or LEGACY_MONGODB_URI) is required');
  const client = new MongoClient(MONGO, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db();
  const report = { startedAt: new Date(), mode: DRY ? 'dry-run' : 'apply', collections: {}, warnings: [], errors: [] };
  const read = async (name) => { const rows = await db.collection(name).find({}).toArray(); report.collections[name] = { source: rows.length }; return rows; };

  const src = {};
  for (const c of ['clinics', 'users', 'doctors', 'nurses', 'patients', 'appointments', 'consultations', 'vitals', 'prescriptions', 'labreports', 'medicalimages', 'referrals', 'invoices', 'billings', 'teleconsultations', 'posts', 'patientcaselogs']) src[c] = await read(c);

  const ctx = { uuidFor, report, hashPassword, ROLES };
  const plan = await mappers.buildPlan(src, ctx);
  report.plan = Object.fromEntries(Object.entries(plan.tables).map(([t, rows]) => [t, rows.length]));
  report.mongo = { clinicalNotes: plan.mongo.clinicalNotes.length, communityPosts: plan.mongo.communityPosts.length, activityLogs: plan.mongo.activityLogs.length };

  if (!DRY) {
    await withSystem(async (trx) => {
      for (const [table, rows] of plan.order.map((t) => [t, plan.tables[t]])) {
        for (const row of rows) {
          const { __legacy, ...data } = row;
          await trx(table).insert(data).onConflict('id').merge();
          if (__legacy) await trx('legacy_id_map').insert({ collection: __legacy.collection, legacy_id: String(__legacy.id), new_id: data.id }).onConflict(['collection', 'legacy_id']).merge();
        }
      }
      await trx('audit_logs').insert({ action: 'DATA_MIGRATION_APPLIED', resource_type: 'system', result: 'SUCCESS', details: JSON.stringify(report.plan) });
    }, getKnex());
    const env = config();
    if (env.MONGODB_URI) {
      const { connectMongo, closeMongo } = require('../../infrastructure/mongodb/connection');
      await connectMongo();
      const models = require('../../infrastructure/mongodb/models');
      for (const n of plan.mongo.clinicalNotes) await models.ClinicalNote.updateOne({ encounterId: n.encounterId, noteType: n.noteType }, { $setOnInsert: n }, { upsert: true });
      for (const p of plan.mongo.communityPosts) await models.CommunityPost.updateOne({ legacyId: p.legacyId }, { $set: p }, { upsert: true });
      for (const a of plan.mongo.activityLogs) await models.PatientActivityLog.updateOne({ patientId: a.patientId, action: a.action, occurredAt: a.occurredAt }, { $setOnInsert: a }, { upsert: true });
      await closeMongo();
    } else {
      report.warnings.push('MONGODB_URI not set: clinical notes, community posts and activity logs were not written to the target MongoDB');
    }
  }

  report.validation = await validate(getKnex(), src, plan, ctx);
  report.finishedAt = new Date();
  report.ok = report.validation.failures.length === 0 && report.errors.length === 0;
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  process.stdout.write(`${DRY ? 'Dry run' : 'Migration'} ${report.ok ? 'OK' : 'completed with problems'}. Report: ${REPORT}\n`);
  for (const f of report.validation.failures) process.stdout.write(`  FAIL ${f}\n`);
  for (const w of report.warnings) process.stdout.write(`  WARN ${w}\n`);
  await client.close();
  await closeKnex();
  if (!report.ok) process.exit(2);
}

main().catch(async (err) => { process.stderr.write(`${err.stack || err.message}\n`); await closeKnex(); process.exit(1); });
