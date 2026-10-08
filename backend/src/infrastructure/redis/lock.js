'use strict';
const crypto = require('crypto');
const { getRedis } = require('./client');
const { conflict } = require('../../common/errors/AppError');

const RELEASE = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/** Runs fn while holding a distributed lock; fails fast with 409 when the lock is taken. */
async function withLock(name, ttlMs, fn, { retries = 3, retryDelayMs = 100 } = {}) {
  const redis = getRedis();
  const key = `lock:${name}`;
  const token = crypto.randomUUID();
  let acquired = false;
  for (let i = 0; i <= retries && !acquired; i++) {
    const res = await redis.set(key, token, 'PX', ttlMs, 'NX');
    acquired = res === 'OK';
    if (!acquired && i < retries) await new Promise((r) => setTimeout(r, retryDelayMs));
  }
  if (!acquired) throw conflict('The resource is currently being modified. Please retry.', 'LOCKED');
  try {
    return await fn();
  } finally {
    await redis.eval(RELEASE, 1, key, token);
  }
}

module.exports = { withLock };
