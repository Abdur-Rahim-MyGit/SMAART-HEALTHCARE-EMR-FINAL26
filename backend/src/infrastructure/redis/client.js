'use strict';
/**
 * Redis client with an in-memory fallback for local development and tests.
 * Production requires REDIS_URL (enforced by the env schema).
 */
const Redis = require('ioredis');
const { config } = require('../../config');
const { getLogger } = require('../../common/logging/logger');

class MemoryRedis {
  constructor() {
    this.store = new Map();
    this.status = 'ready';
    this.isMemory = true;
  }
  _live(key) {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.exp && e.exp <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }
  async get(key) {
    const e = this._live(key);
    return e ? e.value : null;
  }
  async set(key, value, ...args) {
    let exp;
    let nx = false;
    for (let i = 0; i < args.length; i++) {
      const a = String(args[i]).toUpperCase();
      if (a === 'EX') exp = Date.now() + Number(args[++i]) * 1000;
      else if (a === 'PX') exp = Date.now() + Number(args[++i]);
      else if (a === 'NX') nx = true;
    }
    if (nx && this._live(key)) return null;
    this.store.set(key, { value: String(value), exp });
    return 'OK';
  }
  async del(...keys) {
    let n = 0;
    for (const k of keys.flat()) if (this.store.delete(k)) n++;
    return n;
  }
  async incr(key) {
    const e = this._live(key);
    const v = (e ? Number(e.value) : 0) + 1;
    this.store.set(key, { value: String(v), exp: e ? e.exp : undefined });
    return v;
  }
  async incrby(key, by) {
    const e = this._live(key);
    const v = (e ? Number(e.value) : 0) + Number(by);
    this.store.set(key, { value: String(v), exp: e ? e.exp : undefined });
    return v;
  }
  async decr(key) {
    return this.incrby(key, -1);
  }
  async expire(key, seconds) {
    const e = this._live(key);
    if (!e) return 0;
    e.exp = Date.now() + seconds * 1000;
    return 1;
  }
  async pexpire(key, ms) {
    const e = this._live(key);
    if (!e) return 0;
    e.exp = Date.now() + ms;
    return 1;
  }
  async ttl(key) {
    const e = this._live(key);
    if (!e) return -2;
    return e.exp ? Math.ceil((e.exp - Date.now()) / 1000) : -1;
  }
  async pttl(key) {
    const e = this._live(key);
    if (!e) return -2;
    return e.exp ? e.exp - Date.now() : -1;
  }
  async exists(...keys) {
    return keys.flat().filter((k) => this._live(k)).length;
  }
  async eval(script, numKeys, ...args) {
    // Only the compare-and-delete script used by locks is supported.
    const key = args[0];
    const val = args[numKeys];
    const e = this._live(key);
    if (e && e.value === String(val)) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  }
  async ping() {
    return 'PONG';
  }
  async quit() {
    this.status = 'end';
    return 'OK';
  }
  async flushall() {
    this.store.clear();
    return 'OK';
  }
  // rate-limit-redis compatibility (uses sendCommand)
  async sendCommand(...args) {
    const cmd = String(args[0]).toLowerCase();
    if (typeof this[cmd] === 'function') return this[cmd](...args.slice(1));
    throw new Error(`MemoryRedis: unsupported command ${cmd}`);
  }
  async call(...args) {
    return this.sendCommand(...args);
  }
}

let client;
function getRedis() {
  if (client) return client;
  const env = config();
  if (!env.REDIS_URL) {
    if (env.REDIS_REQUIRED) throw new Error('REDIS_URL is required');
    getLogger().warn('REDIS_URL not set: using in-memory fallback (development/test only)');
    client = new MemoryRedis();
    return client;
  }
  client = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true,
    tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
  });
  client.on('error', (err) => getLogger().error({ err }, 'redis error'));
  return client;
}

async function pingRedis() {
  const r = getRedis();
  const res = await r.ping();
  return res === 'PONG';
}

async function closeRedis() {
  if (client) {
    try {
      await client.quit();
    } catch {
      /* ignore */
    }
    client = undefined;
  }
}

module.exports = { getRedis, pingRedis, closeRedis, MemoryRedis };
