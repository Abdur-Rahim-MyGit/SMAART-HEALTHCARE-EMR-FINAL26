'use strict';
const { config } = require('../../config');
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withSystem } = require('../../infrastructure/postgres/tenant');
const { ROLES } = require('../../common/security/rbac');
const { hashPassword, verifyPassword, validatePasswordStrength } = require('../../common/security/password');
const { signAccessToken, signPurposeToken, verifyPurposeToken, generateOpaqueToken, sha256, timingSafeEqualHex } = require('../../common/security/tokens');
const { generateNumericCode, hashOtp } = require('../../common/security/otp');
const { AppError, unauthorized, badRequest, forbidden, notFound } = require('../../common/errors/AppError');
const { sendMail, templates } = require('../../infrastructure/email/mailer');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const { auditInTrx } = require('../audit/auditRepository');
const { getRedis } = require('../../infrastructure/redis/client');
const repo = require('./authRepository');

const LOGIN_OTP_LENGTH = 4; // the existing login UI accepts exactly 4 digits
const RESET_OTP_LENGTH = 6;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const SESSION_CACHE_TTL = 30; // seconds

const invalidCredentials = () => unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');

function displayName(user) {
  return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
}

/** Shape the existing UI expects for a signed in user. */
function publicUser(user, clinic) {
  const base = {
    id: user.id,
    _id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    fullName: displayName(user),
    email: user.email,
    role: user.role,
    clinicId: user.clinic_id || null,
    phone: user.phone,
  };
  if (user.role === ROLES.CLINIC_ADMIN && clinic) {
    return { ...base, name: clinic.name, clinicName: clinic.name, adminName: clinic.admin_name || displayName(user), adminUsername: clinic.admin_username || user.username, type: 'clinic' };
  }
  return base;
}

async function checkLockAndPassword(trx, user, password, ctx) {
  if (!user || !user.is_active) throw invalidCredentials();
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AppError('ACCOUNT_LOCKED', 'Account temporarily locked after repeated failed sign-in attempts. Try again later.', 423);
  }
  const { ok, needsRehash } = await verifyPassword(password, user.password_hash);
  if (!ok) {
    // Recorded in its own transaction: the caller's transaction is rolled back by the thrown error.
    await withSystem(async (t2) => {
      const attempts = user.failed_login_attempts + 1;
      const patch = { failed_login_attempts: attempts };
      if (attempts >= MAX_FAILED_LOGINS) patch.locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      await repo.updateUser(t2, user.id, patch);
      await auditInTrx(t2, { userId: user.id, role: user.role, clinicId: user.clinic_id }, { action: 'LOGIN_FAILURE', resourceType: 'user', resourceId: user.id, result: 'FAILURE', requestId: ctx.requestId, ip: ctx.ip, details: { attempts } });
    }, getKnex());
    throw invalidCredentials();
  }
  if (needsRehash) await repo.updateUser(trx, user.id, { password_hash: await hashPassword(password) });
  if (user.failed_login_attempts || user.locked_until) await repo.updateUser(trx, user.id, { failed_login_attempts: 0, locked_until: null });
  return true;
}

async function issueSession(trx, user, ctx) {
  const env = config();
  const refreshToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await repo.createSession(trx, { userId: user.id, tokenHash: sha256(refreshToken), userAgent: ctx.userAgent, ip: ctx.ip, expiresAt });
  const { token } = signAccessToken({ userId: user.id, role: user.role, clinicId: user.clinic_id, sessionId: session.id });
  await repo.updateUser(trx, user.id, { last_login_at: trx.fn.now() });
  await auditInTrx(trx, { userId: user.id, role: user.role, clinicId: user.clinic_id }, { action: 'LOGIN_SUCCESS', resourceType: 'user', resourceId: user.id, requestId: ctx.requestId, ip: ctx.ip, details: { sessionId: session.id, method: ctx.method } });
  return { accessToken: token, refreshToken, session };
}

async function clinicGuard(trx, user) {
  if (user.role !== ROLES.CLINIC_ADMIN) return null;
  const clinic = await repo.findClinicForUser(trx, user.clinic_id);
  if (!clinic) throw invalidCredentials();
  if (!clinic.is_active) throw new AppError('CLINIC_INACTIVE', 'Clinic account is inactive', 403);
  if (new Date(clinic.validity_end) < new Date()) throw new AppError('CLINIC_EXPIRED', 'Clinic validity has expired. Please contact administrator.', 403);
  return clinic;
}

// ---------------------------------------------------------------------------
// Login flows
// ---------------------------------------------------------------------------

/** Password-only login. Disabled in production (env AUTH_ALLOW_PASSWORD_ONLY_LOGIN). */
async function passwordLogin({ email, password }, ctx) {
  const env = config();
  if (!env.AUTH_ALLOW_PASSWORD_ONLY_LOGIN) throw forbidden('Password-only login is disabled. Use OTP login.', 'OTP_REQUIRED');
  return withSystem(async (trx) => {
    const user = await repo.findUserByEmail(trx, email);
    await checkLockAndPassword(trx, user, password, ctx);
    const clinic = await clinicGuard(trx, user);
    const tokens = await issueSession(trx, user, { ...ctx, method: 'password' });
    return { ...tokens, user: publicUser(user, clinic) };
  }, getKnex());
}

/** Clinic admin login used by the "Clinic Login" tab. Same contract as before. */
async function clinicLogin({ email, password }, ctx) {
  return withSystem(async (trx) => {
    const user = await repo.findUserByEmail(trx, email, ROLES.CLINIC_ADMIN);
    if (!user) throw unauthorized('Invalid clinic credentials', 'INVALID_CREDENTIALS');
    try {
      await checkLockAndPassword(trx, user, password, ctx);
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') throw unauthorized('Invalid clinic credentials', 'INVALID_CREDENTIALS');
      throw err;
    }
    const clinic = await clinicGuard(trx, user);
    const tokens = await issueSession(trx, user, { ...ctx, method: 'clinic-password' });
    return { ...tokens, clinic: publicUser(user, clinic) };
  }, getKnex());
}

/** Step 1 of OTP login: verify password, email a code. */
async function requestLoginOtp({ email, password }, ctx) {
  const env = config();
  return withSystem(async (trx) => {
    const user = await repo.findUserByEmail(trx, email);
    await checkLockAndPassword(trx, user, password, ctx);
    await clinicGuard(trx, user);
    const code = generateNumericCode(LOGIN_OTP_LENGTH);
    const salt = generateOpaqueToken(16);
    const expiresAt = new Date(Date.now() + env.OTP_LOGIN_TTL_MINUTES * 60 * 1000);
    await repo.createChallenge(trx, { userId: user.id, purpose: 'login', codeHash: hashOtp(code, salt), salt, expiresAt, ip: ctx.ip });
    await sendMail({ to: user.email, ...templates.loginOtp(displayName(user), code, env.OTP_LOGIN_TTL_MINUTES) });
    await auditInTrx(trx, { userId: user.id, role: user.role, clinicId: user.clinic_id }, { action: 'LOGIN_OTP_SENT', resourceType: 'user', resourceId: user.id, requestId: ctx.requestId, ip: ctx.ip });
    return { userId: user.id, expiresInMinutes: env.OTP_LOGIN_TTL_MINUTES };
  }, getKnex());
}

async function verifyChallenge(trx, user, purpose, code, ctx) {
  const env = config();
  const ch = await repo.findLiveChallenge(trx, user.id, purpose);
  if (!ch || new Date(ch.expires_at) < new Date()) throw badRequest('Invalid or expired OTP', 'OTP_INVALID');
  if (ch.attempts >= env.OTP_MAX_ATTEMPTS) {
    await withSystem((t2) => repo.consumeChallenge(t2, ch.id), getKnex());
    throw badRequest('Too many incorrect attempts. Request a new OTP.', 'OTP_ATTEMPTS_EXCEEDED');
  }
  if (!timingSafeEqualHex(hashOtp(String(code), ch.salt), ch.code_hash)) {
    await withSystem(async (t2) => {
      await repo.bumpChallengeAttempts(t2, ch.id);
      await auditInTrx(t2, { userId: user.id, role: user.role, clinicId: user.clinic_id }, { action: 'OTP_FAILURE', resourceType: 'user', resourceId: user.id, result: 'FAILURE', requestId: ctx.requestId, ip: ctx.ip, details: { purpose } });
    }, getKnex());
    throw badRequest('Invalid or expired OTP', 'OTP_INVALID');
  }
  return ch;
}

/** Step 2 of OTP login. */
async function verifyLoginOtp({ userId, otp }, ctx) {
  return withSystem(async (trx) => {
    const user = await repo.findUserById(trx, userId);
    if (!user || !user.is_active) throw badRequest('Invalid or expired OTP', 'OTP_INVALID');
    const ch = await verifyChallenge(trx, user, 'login', otp, ctx);
    await repo.consumeChallenge(trx, ch.id);
    const clinic = await clinicGuard(trx, user);
    const tokens = await issueSession(trx, user, { ...ctx, method: 'otp' });
    return { ...tokens, user: publicUser(user, clinic) };
  }, getKnex());
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

async function refresh(refreshToken, ctx) {
  const env = config();
  if (!refreshToken) throw unauthorized('Refresh token missing', 'NO_REFRESH_TOKEN');
  const hash = sha256(refreshToken);
  return withSystem(async (trx) => {
    const session = await repo.findSessionByTokenHash(trx, hash);
    if (!session) throw unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    if (session.revoked_at || new Date(session.expires_at) < new Date()) throw unauthorized('Session expired', 'SESSION_EXPIRED');
    if (session.previous_token_hash === hash && session.refresh_token_hash !== hash) {
      // Reuse of a rotated token: someone replayed it. Kill the whole session (own transaction, the outer one rolls back).
      await withSystem(async (t2) => {
        await repo.revokeSession(t2, session.id, 'refresh_token_reuse');
        await auditInTrx(t2, { userId: session.user_id }, { action: 'REFRESH_TOKEN_REUSE', resourceType: 'session', resourceId: session.id, result: 'FAILURE', requestId: ctx.requestId, ip: ctx.ip });
      }, getKnex());
      await invalidateSessionCache(session.id);
      throw unauthorized('Session revoked', 'SESSION_REVOKED');
    }
    const user = await repo.findUserById(trx, session.user_id);
    if (!user || !user.is_active) throw unauthorized('Account is inactive', 'ACCOUNT_INACTIVE');
    const clinic = await clinicGuard(trx, user);
    const newToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await repo.rotateSession(trx, session.id, { newHash: sha256(newToken), oldHash: hash, expiresAt });
    const { token } = signAccessToken({ userId: user.id, role: user.role, clinicId: user.clinic_id, sessionId: session.id });
    return { accessToken: token, refreshToken: newToken, user: publicUser(user, clinic) };
  }, getKnex());
}

async function logout(auth, ctx) {
  await withSystem(async (trx) => {
    await repo.revokeSession(trx, auth.sessionId, 'logout');
    await auditInTrx(trx, auth, { action: 'LOGOUT', resourceType: 'session', resourceId: auth.sessionId, requestId: ctx.requestId, ip: ctx.ip });
  }, getKnex());
  await invalidateSessionCache(auth.sessionId);
}

async function logoutAll(auth, ctx) {
  await withSystem(async (trx) => {
    await repo.revokeAllSessions(trx, auth.userId, 'logout_all');
    await auditInTrx(trx, auth, { action: 'LOGOUT_ALL', resourceType: 'user', resourceId: auth.userId, requestId: ctx.requestId, ip: ctx.ip });
  }, getKnex());
  await getRedis().del(`sess:${auth.sessionId}`);
}

async function listSessions(auth) {
  return withSystem((trx) => repo.listSessions(trx, auth.userId), getKnex());
}

const sessionKey = (id) => `sess:${id}`;
async function invalidateSessionCache(sessionId) {
  await getRedis().del(sessionKey(sessionId));
}
/** Used by the authenticate middleware: cached for a few seconds to spare the database. */
async function lookupSession(sessionId, userId) {
  const redis = getRedis();
  const cached = await redis.get(sessionKey(sessionId));
  if (cached) {
    const parsed = JSON.parse(cached);
    return parsed.userId === userId ? parsed.value : null;
  }
  const value = await withSystem((trx) => repo.findLiveSessionWithUser(trx, sessionId, userId), getKnex());
  if (value) await redis.set(sessionKey(sessionId), JSON.stringify({ userId, value }), 'EX', SESSION_CACHE_TTL);
  return value;
}

/** Revokes every live session of a user (or of a whole clinic) and clears the session cache. */
async function revokeSessionsFor(trx, { userId, clinicId, reason }) {
  let q = trx('auth_sessions as s').whereNull('s.revoked_at').select('s.id');
  if (userId) q = q.where('s.user_id', userId);
  else if (clinicId) q = q.whereIn('s.user_id', trx('users').select('id').where({ clinic_id: clinicId }));
  else return 0;
  const ids = (await q).map((r) => r.id);
  if (ids.length) await trx('auth_sessions').whereIn('id', ids).update({ revoked_at: trx.fn.now(), revoke_reason: reason });
  for (const id of ids) await invalidateSessionCache(id);
  return ids.length;
}

async function me(auth) {
  return withSystem(async (trx) => {
    const user = await repo.findUserById(trx, auth.userId);
    if (!user) throw notFound('User');
    const clinic = user.role === ROLES.CLINIC_ADMIN ? await repo.findClinicForUser(trx, user.clinic_id) : null;
    return publicUser(user, clinic);
  }, getKnex());
}

// ---------------------------------------------------------------------------
// Password reset (OTP → reset token → new password)
// ---------------------------------------------------------------------------

async function forgotPassword({ email }, ctx) {
  const env = config();
  await withSystem(async (trx) => {
    const user = await repo.findUserByEmail(trx, email);
    if (!user || !user.is_active) return; // no user enumeration
    const code = generateNumericCode(RESET_OTP_LENGTH);
    const salt = generateOpaqueToken(16);
    const expiresAt = new Date(Date.now() + env.OTP_RESET_TTL_MINUTES * 60 * 1000);
    await repo.createChallenge(trx, { userId: user.id, purpose: 'password_reset', codeHash: hashOtp(code, salt), salt, expiresAt, ip: ctx.ip });
    await sendMail({ to: user.email, ...templates.resetOtp(displayName(user), code, env.OTP_RESET_TTL_MINUTES) });
    await auditInTrx(trx, { userId: user.id, role: user.role, clinicId: user.clinic_id }, { action: 'PASSWORD_RESET_REQUESTED', resourceType: 'user', resourceId: user.id, requestId: ctx.requestId, ip: ctx.ip });
  }, getKnex());
  return { message: 'If an account exists for this email, a password reset code has been sent.' };
}

async function verifyResetOtp({ email, otp }, ctx) {
  return withSystem(async (trx) => {
    const user = await repo.findUserByEmail(trx, email);
    if (!user) throw badRequest('Invalid or expired OTP', 'OTP_INVALID');
    const ch = await verifyChallenge(trx, user, 'password_reset', otp, ctx);
    await repo.markChallengeVerified(trx, ch.id);
    const resetToken = signPurposeToken('password_reset', { sub: user.id, ch: ch.id }, '10m');
    return { resetToken };
  }, getKnex());
}

async function resetPassword({ email, password, resetToken }, ctx) {
  const problems = validatePasswordStrength(password);
  if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
  let claims;
  try {
    claims = verifyPurposeToken(resetToken, 'password_reset');
  } catch {
    throw badRequest('Please verify the OTP first', 'RESET_TOKEN_INVALID');
  }
  await withSystem(async (trx) => {
    const user = await repo.findUserById(trx, claims.sub);
    if (!user || user.email.toLowerCase() !== String(email).toLowerCase()) throw badRequest('Please verify the OTP first', 'RESET_TOKEN_INVALID');
    const ch = await repo.findLiveChallenge(trx, user.id, 'password_reset');
    if (!ch || ch.id !== claims.ch || !ch.verified_at) throw badRequest('Please request a new OTP', 'RESET_TOKEN_INVALID');
    await repo.consumeChallenge(trx, ch.id);
    await repo.updateUser(trx, user.id, { password_hash: await hashPassword(password), password_changed_at: trx.fn.now(), failed_login_attempts: 0, locked_until: null });
    await repo.revokeAllSessions(trx, user.id, 'password_reset');
    await auditInTrx(trx, { userId: user.id, role: user.role, clinicId: user.clinic_id }, { action: 'PASSWORD_RESET_COMPLETED', resourceType: 'user', resourceId: user.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'auth.password.changed', aggregateType: 'user', aggregateId: user.id, clinicId: user.clinic_id, payload: { email: user.email, name: displayName(user) } });
  }, getKnex());
  return { message: 'Password updated successfully' };
}

async function changePassword(auth, { currentPassword, newPassword }, ctx) {
  const problems = validatePasswordStrength(newPassword);
  if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
  await withSystem(async (trx) => {
    const user = await repo.findUserById(trx, auth.userId);
    const { ok } = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) throw badRequest('Current password is incorrect', 'INVALID_CREDENTIALS');
    await repo.updateUser(trx, user.id, { password_hash: await hashPassword(newPassword), password_changed_at: trx.fn.now() });
    await repo.revokeAllSessions(trx, user.id, 'password_change', auth.sessionId);
    await auditInTrx(trx, auth, { action: 'PASSWORD_CHANGED', resourceType: 'user', resourceId: user.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'auth.password.changed', aggregateType: 'user', aggregateId: user.id, clinicId: user.clinic_id, payload: { email: user.email, name: displayName(user) } });
  }, getKnex());
}

module.exports = { revokeSessionsFor, passwordLogin, clinicLogin, requestLoginOtp, verifyLoginOtp, refresh, logout, logoutAll, listSessions, lookupSession, invalidateSessionCache, me, forgotPassword, verifyResetOtp, resetPassword, changePassword, publicUser, displayName };
