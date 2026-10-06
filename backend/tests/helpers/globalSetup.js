'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.test') });

/** Creates the test database schema once per run (collections, validators, indexes, reference data). */
module.exports = async function globalSetup() {
  process.env.NODE_ENV = 'test';
  const { connectMongo, closeMongo } = require('../../src/infrastructure/mongodb/connection');
  const { ensureSchema, seedReferenceData, dropAll } = require('../../src/infrastructure/mongodb/schema');
  await connectMongo();
  await dropAll();
  await ensureSchema({ log: { info() {} } });
  await seedReferenceData();
  await closeMongo();
};
