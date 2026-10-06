'use strict';
/**
 * Legacy MongoDB (mongoose models, ObjectIds, mixed roles) → new MongoDB model (CLI).
 *
 *   npm run migrate:data -- --mongo mongodb://legacy... --dry-run      # analyse, write report
 *   npm run migrate:data -- --mongo mongodb://legacy... --apply        # migrate (idempotent) + validate
 *   npm run migrate:data -- --mongo mongodb://legacy... --report out.json
 *
 * Read-only on the legacy database (which may be another database on the same
 * server). Every ObjectId maps to a deterministic UUID v5 stored in legacy_id_map so
 * re-runs update instead of duplicate. Legacy data is never deleted by this tool.
 */
const { MongoClient } = require('mongodb');
const fs = require('fs');
const { config } = require('../../config');
const { connectMongo, closeMongo, getDb } = require('../../infrastructure/mongodb/connection');
const { ensureSchema } = require('../../infrastructure/mongodb/schema');
const { runMigration, COLLECTIONS } = require('./run');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] || true : def; };
const APPLY = args.includes('--apply');
const MONGO = opt('mongo', process.env.LEGACY_MONGODB_URI);
const REPORT = opt('report', `migration-report-${Date.now()}.json`);

async function main() {
  const env = config();
  if (!MONGO) throw new Error('--mongo <uri> (or LEGACY_MONGODB_URI) is required');
  const client = new MongoClient(MONGO, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const legacy = client.db();
  if (APPLY) {
    await connectMongo();
    if (getDb().databaseName === legacy.databaseName && new MongoClient(env.MONGODB_URI).options.hosts.join() === client.options.hosts.join()) throw new Error('target database must differ from the legacy database');
    await ensureSchema();
  }
  const src = {};
  for (const c of COLLECTIONS) src[c] = await legacy.collection(c).find({}).toArray();
  await client.close();
  const { report } = await runMigration(src, { apply: APPLY });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  process.stdout.write(`${APPLY ? 'Migration' : 'Dry run'} ${report.ok ? 'OK' : 'completed with problems'}. Report: ${REPORT}\n`);
  for (const f of report.validation.failures) process.stdout.write(`  FAIL ${f}\n`);
  for (const e of report.errors) process.stdout.write(`  ERROR ${e}\n`);
  for (const w of report.warnings) process.stdout.write(`  WARN ${w}\n`);
  await closeMongo();
  if (!report.ok) process.exit(2);
}

main().catch(async (err) => { process.stderr.write(`${err.stack || err.message}\n`); await closeMongo().catch(() => {}); process.exit(1); });
