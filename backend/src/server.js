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

  if (!env.isProduction) {
    const divider = '='.repeat(54);
    console.log(`\n\x1b[32m${divider}\x1b[0m`);
    console.log(`\x1b[1m\x1b[32m  🚀 SMAART HEALTHCARE EMR BACKEND IS RUNNING!\x1b[0m`);
    console.log(`\x1b[32m${divider}\x1b[0m`);
    console.log(`  📡 \x1b[1mAPI URL:\x1b[0m       http://localhost:${env.PORT}`);
    console.log(`  🏥 \x1b[1mEnvironment:\x1b[0m   ${env.NODE_ENV}`);
    console.log(`  🐘 \x1b[1mPostgreSQL:\x1b[0m    \x1b[32mConnected\x1b[0m`);
    console.log(`  🍃 \x1b[1mMongoDB:\x1b[0m       \x1b[32mConnected\x1b[0m`);
    console.log(`  🔍 \x1b[1mHealth Check:\x1b[0m  http://localhost:${env.PORT}/health/live`);
    console.log(`\x1b[32m${divider}\x1b[0m\n`);
  }

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
