'use strict';
const { getRedis } = require('../../infrastructure/redis/client');
const { conflict } = require('../errors/AppError');

/**
 * Optional idempotency for critical writes. When a client sends Idempotency-Key,
 * the first response is stored for `ttlSeconds` and replayed for retries with the
 * same key, user and route. Concurrent duplicates receive 409.
 */
function idempotency({ ttlSeconds = 60 * 60 } = {}) {
  return async (req, res, next) => {
    const key = req.get('idempotency-key');
    if (!key || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return next();
    const redis = getRedis();
    const rk = `idem:${req.auth?.userId || 'anon'}:${req.method}:${req.baseUrl}${req.path}:${key}`;
    const existing = await redis.get(rk);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.state === 'in_progress') return next(conflict('A request with this Idempotency-Key is still being processed', 'IDEMPOTENCY_IN_PROGRESS'));
      res.setHeader('Idempotent-Replayed', 'true');
      return res.status(parsed.status).json(parsed.body);
    }
    const set = await redis.set(rk, JSON.stringify({ state: 'in_progress' }), 'EX', 120, 'NX');
    if (set !== 'OK') return next(conflict('A request with this Idempotency-Key is still being processed', 'IDEMPOTENCY_IN_PROGRESS'));
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      redis.set(rk, JSON.stringify({ state: 'done', status: res.statusCode, body }), 'EX', ttlSeconds).catch(() => {});
      return originalJson(body);
    };
    next();
  };
}
module.exports = { idempotency };
