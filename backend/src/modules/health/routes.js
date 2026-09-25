'use strict';
const express = require('express');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { pingPostgres } = require('../../infrastructure/postgres/knex');
const { pingMongo, isMongoConfigured } = require('../../infrastructure/mongodb/connection');
const { pingRedis, getRedis } = require('../../infrastructure/redis/client');
const { isRabbitConnected, isRabbitConfigured } = require('../../infrastructure/rabbitmq/connection');
const { config } = require('../../config');

const router = express.Router();
const startedAt = new Date();

async function check(name, fn, { required = true } = {}) {
  const t0 = Date.now();
  try {
    const ok = await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))]);
    return { name, status: ok ? 'up' : 'down', required, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { name, status: 'down', required, latencyMs: Date.now() - t0, error: err.message };
  }
}

async function readiness() {
  const env = config();
  const redis = getRedis();
  const checks = await Promise.all([
    check('postgres', pingPostgres),
    check('mongodb', pingMongo, { required: env.isProduction || env.MONGODB_REQUIRED || isMongoConfigured() }),
    check('redis', async () => (redis.isMemory ? true : pingRedis()), { required: env.isProduction || env.REDIS_REQUIRED }),
    check('rabbitmq', async () => isRabbitConnected(), { required: env.isProduction || env.RABBITMQ_REQUIRED || isRabbitConfigured() }),
  ]);
  if (redis.isMemory) checks[2].mode = 'memory-fallback';
  const ready = checks.every((c) => c.status === 'up' || !c.required);
  return { ready, checks };
}

router.get('/', asyncHandler(async (_req, res) => {
  const r = await readiness();
  res.status(r.ready ? 200 : 503).json({ success: r.ready, status: r.ready ? 'ok' : 'degraded', service: config().APP_NAME, version: process.env.npm_package_version || '2.0.0', env: config().NODE_ENV, startedAt, uptimeSeconds: Math.round(process.uptime()), checks: r.checks });
}));
router.get('/live', (_req, res) => res.json({ success: true, status: 'alive' }));
router.get('/ready', asyncHandler(async (_req, res) => {
  const r = await readiness();
  res.status(r.ready ? 200 : 503).json({ success: r.ready, status: r.ready ? 'ready' : 'not-ready', checks: r.checks });
}));

module.exports = { router, readiness };
