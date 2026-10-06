'use strict';
/** `npm run migrate`: ensures collections, validators, indexes and reference data. */
const { config } = require('../config');
const { connectMongo, closeMongo } = require('../infrastructure/mongodb/connection');
const { ensureSchema, seedReferenceData } = require('../infrastructure/mongodb/schema');

(async () => {
  config();
  await connectMongo();
  await ensureSchema();
  await seedReferenceData();
  process.stdout.write('MongoDB schema and reference data are up to date\n');
  await closeMongo();
})().catch(async (err) => { process.stderr.write(`${err.stack || err.message}\n`); await closeMongo(); process.exit(1); });
