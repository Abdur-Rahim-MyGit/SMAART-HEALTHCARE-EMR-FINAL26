'use strict';
const bcrypt = require('bcryptjs');

/* bcrypt is the hash this system writes. It is the same algorithm the consultant app uses for its
 * clinic admin accounts, so a clinic created here can log in there without either side having to
 * understand the other's hash format. Cost 12 ≈ 250 ms per hash on a small server. */
const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 8;

async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < MIN_LENGTH) {
    throw new Error(`Password must be at least ${MIN_LENGTH} characters`);
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/* Hashes written before the switch to bcrypt are Argon2id. They are verified only if the `argon2`
 * package happens to be installed (it is optional now), and always flagged needsRehash so the login
 * path replaces them with bcrypt the first time the user signs in. */
function verifyLegacyArgon2(plain, stored) {
  let argon2;
  try { argon2 = require('argon2'); } catch (e) { return Promise.resolve(false); }
  return argon2.verify(stored, plain).catch(() => false);
}

/**
 * Verifies against bcrypt, or a legacy Argon2id hash written before the switch.
 * @returns {Promise<{ok:boolean, needsRehash:boolean}>}
 */
async function verifyPassword(plain, stored) {
  if (!stored || typeof plain !== 'string') return { ok: false, needsRehash: false };
  if (stored.startsWith('$2')) {
    const ok = await bcrypt.compare(plain, stored);
    return { ok, needsRehash: false };
  }
  if (stored.startsWith('$argon2')) {
    const ok = await verifyLegacyArgon2(plain, stored);
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
