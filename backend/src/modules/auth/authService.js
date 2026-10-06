'use strict';
const { config } = require('../../config');
const { withSystem, SYSTEM_ROLE } = require('../../infrastructure/mongodb/tenant');
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
  return user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}

/** Shape the existing UI expects for a signed in user. */
function publicUser(user, clinic) {
  const base = {
    id: user._id,
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: displayName(user),
    email: user.email,
    role: user.role,
    clinicId: user.clinicId || null,
    phone: user.phone,
  };
  if (user.role === ROLES.CLINIC_ADMIN && clinic) {
    return { ...base, name: clinic.name, clinicName: clinic.name, adminName: clinic.adminName || displayName(user), adminUsername: clinic.adminUsername || user.username, type: 'clinic' };
  }
  return base;
}

async function checkLockAndPassword(db, user, password, ctx) {
  if (!user || !user.isActive) throw invalidCredentials();
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    throw new AppError('ACCOUNT_LOCKED', 'Account temporarily locked after repeated failed sign-in attempts. Try again later.', 423);
  }
  const { ok, needsRehash } = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    // Recorded in its own transaction: the caller's transaction is rolled back by the thrown error.
    await withSystem(async (db2) => {
      const attempts = user.failedLoginAttempts + 1;
      const patch = { failedLoginAttempts: attempts };
      if (attempts >= MAX_FAILED_LOGINS) patch.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      await repo.updateUser(db2, user._id, patch);
      await auditInTrx(db2, { userId: user._id, role: user.role, clinicId: user.clinicId }, { action: 'LOGIN_FAILURE', resourceType: 'user', resourceId: user._id, result: 'FAILURE', requestId: ctx.requestId, ip: ctx.ip, details: { attempts } });
    });
    throw invalidCredentials();
  }
  if (needsRehash) await repo.updateUser(db, user._id, { passwordHash: await hashPassword(password) });
  if (user.failedLoginAttempts || user.lockedUntil) await repo.updateUser(db, user._id, { failedLoginAttempts: 0, lockedUntil: null });
  return true;
}

async function issueSession(db, user, ctx) {
  const env = config();
  const refreshToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await repo.createSession(db, { userId: user._id, tokenHash: sha256(refreshToken), userAgent: ctx.userAgent, ip: ctx.ip, expiresAt });
  const { token } = signAccessToken({ userId: user._id, role: user.role, clinicId: user.clinicId, sessionId: session._id });
  await repo.updateUser(db, user._id, { lastLoginAt: new Date() });
  await auditInTrx(db, { userId: user._id, role: user.role, clinicId: user.clinicId }, { action: 'LOGIN_SUCCESS', resourceType: 'user', resourceId: user._id, requestId: ctx.requestId, ip: ctx.ip, details: { sessionId: session._id, method: ctx.method } });
  return { accessToken: token, refreshToken, session };
}

async function clinicGuard(db, user) {
  if (user.role !== ROLES.CLINIC_ADMIN) return null;
  const clinic = await repo.findClinicForUser(db, user.clinicId);
  if (!clinic) throw invalidCredentials();
  if (!clinic.isActive) throw new AppError('CLINIC_INACTIVE', 'Clinic account is inactive', 403);
  if (new Date(clinic.validityEnd) < new Date()) throw new AppError('CLINIC_EXPIRED', 'Clinic validity has expired. Please contact administrator.', 403);
  return clinic;
}

// ---------------------------------------------------------------------------
// Login flows
// ---------------------------------------------------------------------------

/** Password-only login. Disabled in production (env AUTH_ALLOW_PASSWORD_ONLY_LOGIN). */
async function passwordLogin({ email, password }, ctx) {
  const env = config();
  if (!env.AUTH_ALLOW_PASSWORD_ONLY_LOGIN) throw forbidden('Password-only login is disabled. Use OTP login.', 'OTP_REQUIRED');
  return withSystem(async (db) => {
    const user = await repo.findUserByEmail(db, email);
    await checkLockAndPassword(db, user, password, ctx);
    const clinic = await clinicGuard(db, user);
    const tokens = await issueSession(db, user, { ...ctx, method: 'password' });
    return { ...tokens, user: publicUser(user, clinic) };
  });
}

/** Clinic admin login used by the "Clinic Login" tab. Same contract as before. */
async function clinicLogin({ email, password }, ctx) {
  return withSystem(async (db) => {
    const user = await repo.findUserByEmail(db, email, ROLES.CLINIC_ADMIN);
    if (!user) throw unauthorized('Invalid clinic credentials', 'INVALID_CREDENTIALS');
    try {
      await checkLockAndPassword(db, user, password, ctx);
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS') throw unauthorized('Invalid clinic credentials', 'INVALID_CREDENTIALS');
      throw err;
    }
    const clinic = await clinicGuard(db, user);
    const tokens = await issueSession(db, user, { ...ctx, method: 'clinic-password' });
    return { ...tokens, clinic: publicUser(user, clinic) };
  });
}

/** Step 1 of OTP login: verify password, email a code. */
async function requestLoginOtp({ email, password }, ctx) {
  const env = config();
  return withSystem(async (db) => {
    const user = await repo.findUserByEmail(db, email);
    await checkLockAndPassword(db, user, password, ctx);
    await clinicGuard(db, user);
    const code = generateNumericCode(LOGIN_OTP_LENGTH);
    const salt = generateOpaqueToken(16);
    const expiresAt = new Date(Date.now() + env.OTP_LOGIN_TTL_MINUTES * 60 * 1000);
    await repo.createChallenge(db, { userId: user._id, purpose: 'login', codeHash: hashOtp(code, salt), salt, expiresAt, ip: ctx.ip });
    await sendMail({ to: user.email, ...templates.loginOtp(displayName(user), code, env.OTP_LOGIN_TTL_MINUTES) });
    await auditInTrx(db, { userId: user._id, role: user.role, clinicId: user.clinicId }, { action: 'LOGIN_OTP_SENT', resourceType: 'user', resourceId: user._id, requestId: ctx.requestId, ip: ctx.ip });
    return { userId: user._id, expiresInMinutes: env.OTP_LOGIN_TTL_MINUTES };
  });
}

async function verifyChallenge(db, user, purpose, code, ctx) {
  const env = config();
  const ch = await repo.findLiveChallenge(db, user._id, purpose);
  if (!ch || new Date(ch.expiresAt) < new Date()) throw badRequest('Invalid or expired OTP', 'OTP_INVALID');
  if (ch.attempts >= env.OTP_MAX_ATTEMPTS) {
    await withSystem((db2) => repo.consumeChallenge(db2, ch._id));
    throw badRequest('Too many incorrect attempts. Request a new OTP.', 'OTP_ATTEMPTS_EXCEEDED');
  }
  if (!timingSafeEqualHex(hashOtp(String(code), ch.salt), ch.codeHash)) {
    await withSystem(async (db2) => {
      await repo.bumpChallengeAttempts(db2, ch._id);
      await auditInTrx(db2, { userId: user._id, role: user.role, clinicId: user.clinicId }, { action: 'OTP_FAILURE', resourceType: 'user', resourceId: user._id, result: 'FAILURE', requestId: ctx.requestId, ip: ctx.ip, details: { purpose } });
    });
    throw badRequest('Invalid or expired OTP', 'OTP_INVALID');
  }
  return ch;
}

/** Step 2 of OTP login. */
async function verifyLoginOtp({ userId, otp }, ctx) {
  return withSystem(async (db) => {
    const user = await repo.findUserById(db, userId);
    if (!user || !user.isActive) throw badRequest('Invalid or expired OTP', 'OTP_INVALID');
    const ch = await verifyChallenge(db, user, 'login', otp, ctx);
    await repo.consumeChallenge(db, ch._id);
    const clinic = await clinicGuard(db, user);
    const tokens = await issueSession(db, user, { ...ctx, method: 'otp' });
    return { ...tokens, user: publicUser(user, clinic) };
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

async function refresh(refreshToken, ctx) {
  const env = config();
  if (!refreshToken) throw unauthorized('Refresh token missing', 'NO_REFRESH_TOKEN');
  const hash = sha256(refreshToken);
  return withSystem(async (db) => {
    const session = await repo.findSessionByTokenHash(db, hash);
    if (!session) throw unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    if (session.revokedAt || new Date(session.expiresAt) < new Date()) throw unauthorized('Session expired', 'SESSION_EXPIRED');
    if (session.previousTokenHash === hash && session.refreshTokenHash !== hash) {
      // Reuse of a rotated token: someone replayed it. Kill the whole session (own transaction, the outer one rolls back).
      await withSystem(async (db2) => {
        await repo.revokeSession(db2, session._id, 'refresh_token_reuse');
        await auditInTrx(db2, { userId: session.userId }, { action: 'REFRESH_TOKEN_REUSE', resourceType: 'session', resourceId: session._id, result: 'FAILURE', requestId: ctx.requestId, ip: ctx.ip });
      });
      await invalidateSessionCache(session._id);
      throw unauthorized('Session revoked', 'SESSION_REVOKED');
    }
    const user = await repo.findUserById(db, session.userId);
    if (!user || !user.isActive) throw unauthorized('Account is inactive', 'ACCOUNT_INACTIVE');
    const clinic = await clinicGuard(db, user);
    const newToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await repo.rotateSession(db, session._id, { newHash: sha256(newToken), oldHash: hash, expiresAt });
    const { token } = signAccessToken({ userId: user._id, role: user.role, clinicId: user.clinicId, sessionId: session._id });
    return { accessToken: token, refreshToken: newToken, user: publicUser(user, clinic) };
  });
}

async function logout(auth, ctx) {
  await withSystem(async (db) => {
    await repo.revokeSession(db, auth.sessionId, 'logout');
    await auditInTrx(db, auth, { action: 'LOGOUT', resourceType: 'session', resourceId: auth.sessionId, requestId: ctx.requestId, ip: ctx.ip });
  });
  await invalidateSessionCache(auth.sessionId);
}

async function logoutAll(auth, ctx) {
  await withSystem(async (db) => {
    for (const sid of await repo.revokeAllSessions(db, auth.userId, 'logout_all')) await invalidateSessionCache(sid);
    await auditInTrx(db, auth, { action: 'LOGOUT_ALL', resourceType: 'user', resourceId: auth.userId, requestId: ctx.requestId, ip: ctx.ip });
  });
  await getRedis().del(`sess:${auth.sessionId}`);
}

async function listSessions(auth) {
  return withSystem((db) => repo.listSessions(db, auth.userId));
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
  const value = await withSystem((db) => repo.findLiveSessionWithUser(db, sessionId, userId));
  if (value) await redis.set(sessionKey(sessionId), JSON.stringify({ userId, value }), 'EX', SESSION_CACHE_TTL);
  return value;
}

/** Revokes every live session of a user (or of a whole clinic) and clears the session cache. */
async function revokeSessionsFor(db, { userId, clinicId, reason }) {
  let userIds = userId ? [userId] : [];
  if (!userId && clinicId) userIds = (await db.c('users').find({ clinicId }, { projection: { _id: 1 }, includeDeleted: true })).map((u) => u._id);
  if (!userIds.length) return 0;
  // Sessions are a system-only collection: revoke them in their own unit of work so a
  // clinic/user change made by an administrator can never leave a live session behind.
  const revoke = async (sys) => {
    const sessions = await sys.c('auth_sessions').find({ userId: { $in: userIds }, revokedAt: null }, { projection: { _id: 1 } });
    if (sessions.length) await sys.c('auth_sessions').updateMany({ _id: { $in: sessions.map((s) => s._id) } }, { revokedAt: new Date(), revokeReason: reason });
    for (const s of sessions) await invalidateSessionCache(s._id);
    return sessions.length;
  };
  return db.scope.role === SYSTEM_ROLE ? revoke(db) : withSystem(revoke);
}

async function me(auth) {
  return withSystem(async (db) => {
    const user = await repo.findUserById(db, auth.userId);
    if (!user) throw notFound('User');
    const clinic = user.role === ROLES.CLINIC_ADMIN ? await repo.findClinicForUser(db, user.clinicId) : null;
    return publicUser(user, clinic);
  });
}

// ---------------------------------------------------------------------------
// Password reset (OTP → reset token → new password)
// ---------------------------------------------------------------------------

async function forgotPassword({ email }, ctx) {
  const env = config();
  await withSystem(async (db) => {
    const user = await repo.findUserByEmail(db, email);
    if (!user || !user.isActive) return; // no user enumeration
    const code = generateNumericCode(RESET_OTP_LENGTH);
    const salt = generateOpaqueToken(16);
    const expiresAt = new Date(Date.now() + env.OTP_RESET_TTL_MINUTES * 60 * 1000);
    await repo.createChallenge(db, { userId: user._id, purpose: 'password_reset', codeHash: hashOtp(code, salt), salt, expiresAt, ip: ctx.ip });
    await sendMail({ to: user.email, ...templates.resetOtp(displayName(user), code, env.OTP_RESET_TTL_MINUTES) });
    await auditInTrx(db, { userId: user._id, role: user.role, clinicId: user.clinicId }, { action: 'PASSWORD_RESET_REQUESTED', resourceType: 'user', resourceId: user._id, requestId: ctx.requestId, ip: ctx.ip });
  });
  return { message: 'If an account exists for this email, a password reset code has been sent.' };
}

async function verifyResetOtp({ email, otp }, ctx) {
  return withSystem(async (db) => {
    const user = await repo.findUserByEmail(db, email);
    if (!user) throw badRequest('Invalid or expired OTP', 'OTP_INVALID');
    const ch = await verifyChallenge(db, user, 'password_reset', otp, ctx);
    await repo.markChallengeVerified(db, ch._id);
    const resetToken = signPurposeToken('password_reset', { sub: user._id, ch: ch._id }, '10m');
    return { resetToken };
  });
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
  await withSystem(async (db) => {
    const user = await repo.findUserById(db, claims.sub);
    if (!user || user.email.toLowerCase() !== String(email).toLowerCase()) throw badRequest('Please verify the OTP first', 'RESET_TOKEN_INVALID');
    const ch = await repo.findLiveChallenge(db, user._id, 'password_reset');
    if (!ch || ch._id !== claims.ch || !ch.verifiedAt) throw badRequest('Please request a new OTP', 'RESET_TOKEN_INVALID');
    await repo.consumeChallenge(db, ch._id);
    await repo.updateUser(db, user._id, { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null });
    for (const sid of await repo.revokeAllSessions(db, user._id, 'password_reset')) await invalidateSessionCache(sid);
    await auditInTrx(db, { userId: user._id, role: user.role, clinicId: user.clinicId }, { action: 'PASSWORD_RESET_COMPLETED', resourceType: 'user', resourceId: user._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'auth.password.changed', aggregateType: 'user', aggregateId: user._id, clinicId: user.clinicId, payload: { email: user.email, name: displayName(user) } });
  });
  return { message: 'Password updated successfully' };
}

async function changePassword(auth, { currentPassword, newPassword }, ctx) {
  const problems = validatePasswordStrength(newPassword);
  if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}`, 'WEAK_PASSWORD');
  await withSystem(async (db) => {
    const user = await repo.findUserById(db, auth.userId);
    const { ok } = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw badRequest('Current password is incorrect', 'INVALID_CREDENTIALS');
    await repo.updateUser(db, user._id, { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() });
    for (const sid of await repo.revokeAllSessions(db, user._id, 'password_change', auth.sessionId)) await invalidateSessionCache(sid);
    await auditInTrx(db, auth, { action: 'PASSWORD_CHANGED', resourceType: 'user', resourceId: user._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'auth.password.changed', aggregateType: 'user', aggregateId: user._id, clinicId: user.clinicId, payload: { email: user.email, name: displayName(user) } });
  });
}

module.exports = { revokeSessionsFor, passwordLogin, clinicLogin, requestLoginOtp, verifyLoginOtp, refresh, logout, logoutAll, listSessions, lookupSession, invalidateSessionCache, me, forgotPassword, verifyResetOtp, resetPassword, changePassword, publicUser, displayName };
