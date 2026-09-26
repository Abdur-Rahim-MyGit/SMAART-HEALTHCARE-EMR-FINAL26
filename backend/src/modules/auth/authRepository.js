'use strict';
/** Data access for identities, sessions and OTP challenges (system scope). */
const now = () => new Date();

async function findUserByEmail(db, email, role) {
  const filter = { email: String(email).toLowerCase() };
  if (role) filter.role = role;
  return db.c('users').findOne(filter);
}
async function findUserById(db, id) {
  return db.c('users').findById(id);
}
async function findClinicForUser(db, clinicId) {
  return db.c('clinics').findById(clinicId);
}
async function updateUser(db, id, patch) {
  await db.c('users').updateOne({ _id: id }, patch);
}

// ---- sessions ----
async function createSession(db, { userId, tokenHash, userAgent, ip, expiresAt }) {
  return db.c('auth_sessions').insertOne({ userId, refreshTokenHash: tokenHash, previousTokenHash: null, userAgent: (userAgent || '').slice(0, 300), ip: ip || null, lastUsedAt: now(), expiresAt, revokedAt: null, revokeReason: null });
}
async function findSessionByTokenHash(db, hash) {
  return db.c('auth_sessions').findOne({ $or: [{ refreshTokenHash: hash }, { previousTokenHash: hash }] });
}
async function rotateSession(db, id, { newHash, oldHash, expiresAt }) {
  await db.c('auth_sessions').updateOne({ _id: id }, { refreshTokenHash: newHash, previousTokenHash: oldHash, lastUsedAt: now(), expiresAt });
}
async function revokeSession(db, id, reason) {
  await db.c('auth_sessions').updateOne({ _id: id, revokedAt: null }, { revokedAt: now(), revokeReason: reason });
}
async function revokeAllSessions(db, userId, reason, exceptId) {
  const filter = { userId, revokedAt: null };
  if (exceptId) filter._id = { $ne: exceptId };
  const ids = (await db.c('auth_sessions').find(filter, { projection: { _id: 1 } })).map((s) => s._id);
  if (ids.length) await db.c('auth_sessions').updateMany({ _id: { $in: ids } }, { revokedAt: now(), revokeReason: reason });
  return ids;
}
async function listSessions(db, userId) {
  return db.c('auth_sessions').find({ userId }, { sort: { createdAt: -1 }, limit: 50, projection: { _id: 1, userAgent: 1, ip: 1, createdAt: 1, lastUsedAt: 1, expiresAt: 1, revokedAt: 1 } });
}
/** Live session joined to its user and clinic, for the authenticate middleware. */
async function findLiveSessionWithUser(db, sessionId, userId) {
  const s = await db.c('auth_sessions').findOne({ _id: sessionId, userId });
  if (!s || s.revokedAt || new Date(s.expiresAt) < now()) return null;
  const user = await db.c('users').findById(userId);
  if (!user || !user.isActive) return null;
  if (user.clinicId) {
    const clinic = await db.c('clinics').findById(user.clinicId);
    if (!clinic || !clinic.isActive || new Date(clinic.validityEnd) < now()) return null;
  }
  return { sessionId: s._id, user: { id: user._id, _id: user._id, clinic_id: user.clinicId || null, clinicId: user.clinicId || null, role: user.role, email: user.email, is_active: user.isActive, isActive: user.isActive, first_name: user.firstName, last_name: user.lastName, full_name: user.fullName, firstName: user.firstName, lastName: user.lastName, fullName: user.fullName, phone: user.phone, username: user.username } };
}

// ---- OTP challenges ----
async function createChallenge(db, { userId, purpose, codeHash, salt, expiresAt, ip }) {
  await db.c('otp_challenges').updateMany({ userId, purpose, consumedAt: null }, { consumedAt: now() });
  return db.c('otp_challenges').insertOne({ userId, purpose, codeHash, salt, attempts: 0, expiresAt, verifiedAt: null, consumedAt: null, ip: ip || null });
}
async function findLiveChallenge(db, userId, purpose) {
  const rows = await db.c('otp_challenges').find({ userId, purpose, consumedAt: null }, { sort: { createdAt: -1 }, limit: 1 });
  return rows[0] || null;
}
async function bumpChallengeAttempts(db, id) {
  const r = await db.c('otp_challenges').updateOne({ _id: id }, {}, { inc: { attempts: 1 } });
  return r ? r.attempts : null;
}
async function markChallengeVerified(db, id) {
  await db.c('otp_challenges').updateOne({ _id: id }, { verifiedAt: now() });
}
async function consumeChallenge(db, id) {
  await db.c('otp_challenges').updateOne({ _id: id }, { consumedAt: now() });
}

module.exports = { findUserByEmail, findUserById, findClinicForUser, updateUser, createSession, findSessionByTokenHash, rotateSession, revokeSession, revokeAllSessions, listSessions, findLiveSessionWithUser, createChallenge, findLiveChallenge, bumpChallengeAttempts, markChallengeVerified, consumeChallenge };
