'use strict';
const knexLib = require('knex');
const { config } = require('../../config');
const { getLogger } = require('../../common/logging/logger');

let instance;
function getKnex() {
  if (!instance) {
    const env = config();
    instance = knexLib({
      client: 'pg',
      connection: { connectionString: env.DATABASE_URL, ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false },
      pool: { min: env.DATABASE_POOL_MIN, max: env.DATABASE_POOL_MAX },
      acquireConnectionTimeout: 10000,
      log: {
        warn: (m) => getLogger().warn({ m }, 'knex'),
        error: (m) => getLogger().error({ m }, 'knex'),
        deprecate: () => {},
        debug: () => {},
      },
    });
  }
  return instance;
}

async function closeKnex() {
  if (instance) {
    await instance.destroy();
    instance = undefined;
  }
}

async function pingPostgres() {
  await getKnex().raw('select 1');
  return true;
}

module.exports = { getKnex, closeKnex, pingPostgres };
