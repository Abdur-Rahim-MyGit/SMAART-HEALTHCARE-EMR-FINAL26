'use strict';
/**
 * Legacy MongoDB → PostgreSQL data migration (CLI).
 *
 *   npm run migrate:data -- --mongo mongodb://... --dry-run      # analyse, write report
 *   npm run migrate:data -- --mongo mongodb://... --apply        # migrate (idempotent) + validate
 *   npm run migrate:data -- --mongo mongodb://... --report out.json
 *
 * Read-only on the legacy database. Every ObjectId maps to a deterministic UUID v5 stored
 * in legacy_id_map so re-runs update instead of duplicate. Legacy data is never deleted.
 */
const { MongoClient } = require('mongodb');
const fs = require('fs');
const { config } = require('../../config');
const { closeKnex } = require('../../infrastructure/postgres/knex');
const { connectMongo, closeMongo } = require('../../infrastructure/mongodb/connection');
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
  const db = client.db();
  const src = {};
  for (const c of COLLECTIONS) src[c] = await db.collection(c).find({}).toArray();
  await client.close();
  if (APPLY && env.MONGODB_URI) await connectMongo();
  const { report } = await runMigration(src, { apply: APPLY });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  process.stdout.write(`${APPLY ? 'Migration' : 'Dry run'} ${report.ok ? 'OK' : 'completed with problems'}. Report: ${REPORT}\n`);
  for (const f of report.validation.failures) process.stdout.write(`  FAIL ${f}\n`);
  for (const w of report.warnings) process.stdout.write(`  WARN ${w}\n`);
  await closeMongo();
  await closeKnex();
  if (!report.ok) process.exit(2);
}

main().catch(async (err) => { process.stderr.write(`${err.stack || err.message}\n`); await closeKnex(); process.exit(1); });
