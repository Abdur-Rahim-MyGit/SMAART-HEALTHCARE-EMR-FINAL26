'use strict';
process.env.NODE_ENV = 'test';
afterAll(async () => {
  const { closeMongo } = require('../../src/infrastructure/mongodb/connection');
  const { closeRedis } = require('../../src/infrastructure/redis/client');
  await closeRedis();
  await closeMongo();
});
