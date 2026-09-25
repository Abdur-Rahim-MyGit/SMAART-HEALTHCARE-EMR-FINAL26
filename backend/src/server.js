'use strict';
const http = require('http');
const { config } = require('./config');
const { getLogger } = require('./common/logging/logger');
const { getKnex, closeKnex, pingPostgres } = require('./infrastructure/postgres/knex');
const { connectMongo, closeMongo } = require('./infrastructure/mongodb/connection');
const { getRedis, closeRedis } = require('./infrastructure/redis/client');
const { connectRabbit, closeRabbit } = require('./infrastructure/rabbitmq/connection');
const { createApp } = require('./app');

async function start() {
  const env = config();
  const log = getLogger();
  await pingPostgres();
  log.info('postgres connected');
  getRedis();
  try {
    await connectMongo();
  } catch (err) {
    if (env.MONGODB_REQUIRED || env.isProduction) throw err;
    log.warn({ err }, 'mongodb unavailable, continuing without it');
  }
  try {
    await connectRabbit();
  } catch (err) {
    if (env.RABBITMQ_REQUIRED || env.isProduction) throw err;
    log.warn({ err }, 'rabbitmq unavailable, events will wait in the outbox');
  }

  const app = createApp();
  const server = http.createServer(app);
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  await new Promise((resolve) => server.listen(env.PORT, resolve));
  log.info({ port: env.PORT, env: env.NODE_ENV }, 'SMAART EMR API listening');

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, 'shutting down');
    server.close(async () => {
      try {
        await Promise.allSettled([closeRabbit(), closeMongo(), closeRedis(), closeKnex()]);
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 15000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => log.error({ err }, 'unhandledRejection'));
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { start, getKnex };
