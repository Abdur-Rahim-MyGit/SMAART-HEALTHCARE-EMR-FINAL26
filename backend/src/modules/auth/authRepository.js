'use strict';
const USER_COLUMNS = ['id', 'clinic_id', 'role', 'email', 'password_hash', 'first_name', 'last_name', 'full_name', 'phone', 'username', 'is_active', 'is_verified', 'last_login_at', 'failed_login_attempts', 'locked_until', 'password_changed_at', 'created_at', 'updated_at'];

async function findUserByEmail(trx, email, role) {
  let q = trx('users').select(USER_COLUMNS).whereRaw('lower(email::text) = lower(?)', [email]).whereNull('deleted_at');
  if (role) q = q.where('role', role);
  return q.first();
}
async function findUserById(trx, id) {
  return trx('users').select(USER_COLUMNS).where({ id }).whereNull('deleted_at').first();
}
async function findClinicForUser(trx, clinicId) {
  return trx('clinics').where({ id: clinicId }).whereNull('deleted_at').first();
}
async function updateUser(trx, id, patch) {
  await trx('users').where({ id }).update(patch);
}

// ---- sessions ----
async function createSession(trx, { userId, tokenHash, userAgent, ip, expiresAt }) {
  const [row] = await trx('auth_sessions').insert({ user_id: userId, refresh_token_hash: tokenHash, user_agent: (userAgent || '').slice(0, 300), ip, expires_at: expiresAt }).returning('*');
  return row;
}
async function findSessionById(trx, id) {
  return trx('auth_sessions').where({ id }).first();
}
async function findSessionByTokenHash(trx, hash) {
  return trx('auth_sessions').where({ refresh_token_hash: hash }).orWhere({ previous_token_hash: hash }).first();
}
async function rotateSession(trx, id, { newHash, oldHash, expiresAt }) {
  await trx('auth_sessions').where({ id }).update({ refresh_token_hash: newHash, previous_token_hash: oldHash, last_used_at: trx.fn.now(), expires_at: expiresAt });
}
async function revokeSession(trx, id, reason) {
  await trx('auth_sessions').where({ id }).whereNull('revoked_at').update({ revoked_at: trx.fn.now(), revoke_reason: reason });
}
async function revokeAllSessions(trx, userId, reason, exceptId) {
  let q = trx('auth_sessions').where({ user_id: userId }).whereNull('revoked_at');
  if (exceptId) q = q.whereNot({ id: exceptId });
  await q.update({ revoked_at: trx.fn.now(), revoke_reason: reason });
}
async function listSessions(trx, userId) {
  return trx('auth_sessions').select('id', 'user_agent', 'ip', 'created_at', 'last_used_at', 'expires_at', 'revoked_at').where({ user_id: userId }).orderBy('created_at', 'desc').limit(50);
}
/** Live session joined to user, for the authenticate middleware. */
async function findLiveSessionWithUser(trx, sessionId, userId) {
  const row = await trx('auth_sessions as s')
    .join('users as u', 'u.id', 's.user_id')
    .leftJoin('clinics as c', 'c.id', 'u.clinic_id')
    .select('s.id as session_id', 's.revoked_at', 's.expires_at', 'u.id', 'u.clinic_id', 'u.role', 'u.email', 'u.is_active', 'u.first_name', 'u.last_name', 'u.full_name', 'u.phone', 'u.username', 'u.deleted_at', 'c.is_active as clinic_active', 'c.validity_end as clinic_validity_end', 'c.deleted_at as clinic_deleted_at')
    .where('s.id', sessionId)
    .andWhere('s.user_id', userId)
    .first();
  if (!row || row.revoked_at || row.deleted_at || new Date(row.expires_at) < new Date()) return null;
  if (row.clinic_id && (!row.clinic_active || row.clinic_deleted_at || new Date(row.clinic_validity_end) < new Date())) return null;
  return { sessionId: row.session_id, user: row };
}

// ---- OTP challenges ----
async function createChallenge(trx, { userId, purpose, codeHash, salt, expiresAt, ip }) {
  // Only one live challenge per purpose: older ones are consumed.
  await trx('otp_challenges').where({ user_id: userId, purpose }).whereNull('consumed_at').update({ consumed_at: trx.fn.now() });
  const [row] = await trx('otp_challenges').insert({ user_id: userId, purpose, code_hash: codeHash, salt, expires_at: expiresAt, ip }).returning('*');
  return row;
}
async function findLiveChallenge(trx, userId, purpose) {
  return trx('otp_challenges').where({ user_id: userId, purpose }).whereNull('consumed_at').orderBy('created_at', 'desc').first();
}
async function bumpChallengeAttempts(trx, id) {
  const [row] = await trx('otp_challenges').where({ id }).increment('attempts', 1).returning('attempts');
  return row ? row.attempts : null;
}
async function markChallengeVerified(trx, id) {
  await trx('otp_challenges').where({ id }).update({ verified_at: trx.fn.now() });
}
async function consumeChallenge(trx, id) {
  await trx('otp_challenges').where({ id }).update({ consumed_at: trx.fn.now() });
}

module.exports = { findUserByEmail, findUserById, findClinicForUser, updateUser, createSession, findSessionById, findSessionByTokenHash, rotateSession, revokeSession, revokeAllSessions, listSessions, findLiveSessionWithUser, createChallenge, findLiveChallenge, bumpChallengeAttempts, markChallengeVerified, consumeChallenge };
