'use strict';
process.env.NODE_ENV = 'test';
// No real address lookups in tests (clinic create would call OpenStreetMap); geocoder tests stub fetch.
process.env.GEOCODING = process.env.GEOCODING || 'off';
afterAll(async () => {
  const { closeMongo } = require('../../src/infrastructure/mongodb/connection');
  const { closeRedis } = require('../../src/infrastructure/redis/client');
  await closeRedis();
  await closeMongo();
});
