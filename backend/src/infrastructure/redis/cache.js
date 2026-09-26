'use strict';
const { getRedis } = require('./client');

const PREFIX = 'cache:';

async function cacheGet(key) {
  const raw = await getRedis().get(PREFIX + key);
  return raw ? JSON.parse(raw) : null;
}
async function cacheSet(key, value, ttlSeconds) {
  await getRedis().set(PREFIX + key, JSON.stringify(value), 'EX', ttlSeconds);
}
async function cacheDel(...keys) {
  if (keys.length) await getRedis().del(...keys.map((k) => PREFIX + k));
}
/** Read-through helper. Never use for clinical payloads; configuration and reference data only. */
async function cached(key, ttlSeconds, loader) {
  const hit = await cacheGet(key);
  if (hit !== null) return hit;
  const value = await loader();
  if (value !== undefined) await cacheSet(key, value, ttlSeconds);
  return value;
}

module.exports = { cacheGet, cacheSet, cacheDel, cached };
