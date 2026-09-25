'use strict';
const argon2 = require('argon2');
const bcrypt = require('bcryptjs');

const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const MIN_LENGTH = 8;

async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < MIN_LENGTH) {
    throw new Error(`Password must be at least ${MIN_LENGTH} characters`);
  }
  return argon2.hash(plain, ARGON_OPTS);
}

/**
 * Verifies against Argon2id, or a legacy bcrypt hash migrated from MongoDB.
 * @returns {Promise<{ok:boolean, needsRehash:boolean}>}
 */
async function verifyPassword(plain, stored) {
  if (!stored || typeof plain !== 'string') return { ok: false, needsRehash: false };
  if (stored.startsWith('$argon2')) {
    const ok = await argon2.verify(stored, plain);
    return { ok, needsRehash: ok && argon2.needsRehash(stored, ARGON_OPTS) };
  }
  if (stored.startsWith('$2')) {
    const ok = await bcrypt.compare(plain, stored);
    return { ok, needsRehash: ok };
  }
  return { ok: false, needsRehash: false };
}

function validatePasswordStrength(plain) {
  const problems = [];
  if (typeof plain !== 'string' || plain.length < MIN_LENGTH) problems.push(`at least ${MIN_LENGTH} characters`);
  if (!/[a-zA-Z]/.test(plain || '')) problems.push('a letter');
  if (!/[0-9]/.test(plain || '')) problems.push('a digit');
  return problems;
}

module.exports = { hashPassword, verifyPassword, validatePasswordStrength, MIN_LENGTH };
