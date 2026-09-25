'use strict';
const crypto = require('crypto');
const { sha256 } = require('./tokens');

/** Cryptographically random numeric code of the requested length. */
function generateNumericCode(length) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, '0');
}

function hashOtp(code, salt) {
  return sha256(`${salt}:${code}`);
}

module.exports = { generateNumericCode, hashOtp };
