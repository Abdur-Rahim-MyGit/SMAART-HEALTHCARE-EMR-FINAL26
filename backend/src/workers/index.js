'use strict';
/**
 * Worker process: outbox publisher + RabbitMQ consumers + schedulers. Run with `npm run worker`.
 */
const { config } = require('../config');
const { getLogger } = require('../common/logging/logger');
const { connectMongo, closeMongo } = require('../infrastructure/mongodb/connection');
const { getRedis, closeRedis } = require('../infrastructure/redis/client');
const { connectRabbit, closeRabbit, isRabbitConnected } = require('../infrastructure/rabbitmq/connection');
const { startOutboxPublisher } = require('./outboxPublisher');
const { startConsumers } = require('./consumers');
const { startSchedulers } = require('./schedulers');

async function main() {
  const env = config();
  const log = getLogger().child({ process: 'worker' });
  await connectMongo();
  getRedis();
  try { await connectRabbit(); } catch (err) { if (env.isProduction) throw err; log.warn({ err }, 'rabbitmq unavailable; publisher will retry'); }
  const stopPublisher = startOutboxPublisher();
  const stopSchedulers = startSchedulers();
  if (isRabbitConnected()) await startConsumers();
  log.info('worker started');
  const shutdown = async () => {
    stopPublisher();
    stopSchedulers();
    await Promise.allSettled([closeRabbit(), closeRedis(), closeMongo()]);
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
if (require.main === module) main().catch((err) => { getLogger().error({ err }, 'worker failed to start'); process.exit(1); });
module.exports = { main };
