'use strict';
process.env.NODE_ENV = 'test';
afterAll(async () => {
  const { closeKnex } = require('../../src/infrastructure/postgres/knex');
  const { closeRedis } = require('../../src/infrastructure/redis/client');
  await closeRedis();
  await closeKnex();
  const helpers = require('./api');
  if (helpers.closeAdmin) await helpers.closeAdmin();
});
