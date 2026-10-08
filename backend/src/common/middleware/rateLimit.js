'use strict';
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('../../infrastructure/redis/client');
const { config } = require('../../config');

function makeStore(prefix) {
  const redis = getRedis();
  if (redis.isMemory) return undefined; // express-rate-limit's memory store
  return new RedisStore({ prefix: `rl:${prefix}:`, sendCommand: (...args) => redis.call(...args) });
}

const handler = (req, res) => {
  res.status(429).json({ success: false, message: 'Too many requests. Please try again later.', error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' }, requestId: req.id });
};

function limiter({ name, windowMs, max, keyGenerator, exact = false }) {
  const env = config();
  return rateLimit({
    windowMs,
    // Integration tests fire many requests; the exact limits are covered by a dedicated test.
    limit: env.isTest && !exact ? Math.max(max, 1000) : max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: makeStore(name),
    keyGenerator: keyGenerator || ((req) => ipKeyGenerator(req.ip)),
    handler,
    skip: (req) => req.path === '/health/live',
  });
}

function apiLimiter() {
  const env = config();
  return limiter({ name: 'api', windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX, keyGenerator: (req) => req.auth?.userId || ipKeyGenerator(req.ip) });
}
function authLimiter() {
  const env = config();
  return limiter({ name: 'auth', windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.AUTH_RATE_LIMIT_MAX, keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').toLowerCase()}` });
}
function fhirLimiter() {
  const env = config();
  return limiter({ name: 'fhir', windowMs: 60 * 1000, max: env.FHIR_RATE_LIMIT_MAX, keyGenerator: (req) => req.auth?.userId || ipKeyGenerator(req.ip) });
}

module.exports = { apiLimiter, authLimiter, fhirLimiter, limiter };
