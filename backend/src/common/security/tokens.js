'use strict';
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { config } = require('../../config');

function signAccessToken({ userId, role, clinicId, sessionId }) {
  const env = config();
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { role, clinicId: clinicId || null, sid: sessionId },
    env.JWT_SECRET,
    { subject: String(userId), expiresIn: env.JWT_ACCESS_TTL, issuer: env.JWT_ISSUER, jwtid: jti, algorithm: 'HS256' }
  );
  return { token, jti };
}

function verifyAccessToken(token) {
  const env = config();
  return jwt.verify(token, env.JWT_SECRET, { issuer: env.JWT_ISSUER, algorithms: ['HS256'] });
}

/** Short lived, single purpose token (e.g. password reset after OTP verification). */
function signPurposeToken(purpose, payload, ttl) {
  const env = config();
  return jwt.sign({ ...payload, purpose }, env.JWT_SECRET, { expiresIn: ttl, issuer: env.JWT_ISSUER, algorithm: 'HS256', jwtid: crypto.randomUUID() });
}
function verifyPurposeToken(token, purpose) {
  const env = config();
  const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: env.JWT_ISSUER, algorithms: ['HS256'] });
  if (decoded.purpose !== purpose) throw new Error('wrong token purpose');
  return decoded;
}

function generateOpaqueToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}
function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
function timingSafeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

module.exports = { signAccessToken, verifyAccessToken, signPurposeToken, verifyPurposeToken, generateOpaqueToken, sha256, timingSafeEqualHex };
