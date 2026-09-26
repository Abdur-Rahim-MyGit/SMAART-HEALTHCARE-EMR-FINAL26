'use strict';
const express = require('express');
const { z } = require('zod');
const { config } = require('../../config');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { authLimiter } = require('../../common/middleware/rateLimit');
const { authenticate } = require('../../common/middleware/authenticate');
const { email } = require('../../common/validation/schemas');
const { forbidden } = require('../../common/errors/AppError');
const service = require('./authService');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip, userAgent: req.get('user-agent') });

function setRefreshCookie(res, token) {
  const env = config();
  res.cookie(env.REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SECURE ? 'strict' : 'lax',
    domain: env.COOKIE_DOMAIN,
    path: '/api',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}
function clearRefreshCookie(res) {
  const env = config();
  res.clearCookie(env.REFRESH_COOKIE_NAME, { path: '/api', domain: env.COOKIE_DOMAIN });
}
function readRefreshToken(req) {
  const env = config();
  return req.cookies?.[env.REFRESH_COOKIE_NAME] || req.body?.refreshToken;
}

const credentials = z.object({ email, password: z.string().min(1).max(200) });
const limiter = authLimiter();

// Self-registration no longer exists: accounts are provisioned by SMAART administrators.
for (const p of ['/register', '/quick-register', '/create-super-master-admin', '/verify-otp']) {
  router.post(p, (_req, _res, next) => next(forbidden('Self-registration is disabled. Accounts are provisioned by SMAART administrators.', 'REGISTRATION_DISABLED')));
}

router.post('/login', limiter, validate({ body: credentials }), asyncHandler(async (req, res) => {
  const r = await service.passwordLogin(req.body, ctxOf(req));
  setRefreshCookie(res, r.refreshToken);
  res.json({ success: true, message: 'Login successful', token: r.accessToken, user: r.user });
}));

router.post('/clinic-login', limiter, validate({ body: credentials }), asyncHandler(async (req, res) => {
  const r = await service.clinicLogin(req.body, ctxOf(req));
  setRefreshCookie(res, r.refreshToken);
  res.json({ success: true, message: 'Clinic login successful', token: r.accessToken, clinic: r.clinic });
}));

router.post('/request-login-otp', limiter, validate({ body: credentials }), asyncHandler(async (req, res) => {
  const r = await service.requestLoginOtp(req.body, ctxOf(req));
  res.json({ success: true, message: 'Login OTP sent to your email address. Please check your inbox.', userId: r.userId, expiresInMinutes: r.expiresInMinutes });
}));

router.post('/verify-login-otp', limiter, validate({ body: z.object({ userId: z.string().uuid(), otp: z.string().regex(/^\d{4,8}$/) }) }), asyncHandler(async (req, res) => {
  const r = await service.verifyLoginOtp(req.body, ctxOf(req));
  setRefreshCookie(res, r.refreshToken);
  res.json({ success: true, message: 'Login successful with OTP verification', token: r.accessToken, user: r.user });
}));

router.post('/refresh', limiter, asyncHandler(async (req, res) => {
  try {
    const r = await service.refresh(readRefreshToken(req), ctxOf(req));
    setRefreshCookie(res, r.refreshToken);
    res.json({ success: true, token: r.accessToken, user: r.user });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
}));

router.post('/forgot-password', limiter, validate({ body: z.object({ email, type: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const r = await service.forgotPassword(req.body, ctxOf(req));
  res.json({ success: true, message: r.message, type: req.body.type || 'user' });
}));

router.post('/verify-reset-otp', limiter, validate({ body: z.object({ email, otp: z.string().regex(/^\d{4,8}$/), type: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const r = await service.verifyResetOtp(req.body, ctxOf(req));
  res.json({ success: true, message: 'OTP verified', type: req.body.type || 'user', resetToken: r.resetToken });
}));

router.post('/reset-password', limiter, validate({ body: z.object({ email, password: z.string().min(8).max(200), resetToken: z.string().min(10), type: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const r = await service.resetPassword(req.body, ctxOf(req));
  clearRefreshCookie(res);
  res.json({ success: true, message: r.message, type: req.body.type || 'user' });
}));

// ---- authenticated ----
const auth = authenticate(service.lookupSession);

router.get('/me', auth, asyncHandler(async (req, res) => {
  res.json({ success: true, user: await service.me(req.auth) });
}));

router.post('/logout', auth, asyncHandler(async (req, res) => {
  await service.logout(req.auth, ctxOf(req));
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
}));

router.post('/logout-all', auth, asyncHandler(async (req, res) => {
  await service.logoutAll(req.auth, ctxOf(req));
  clearRefreshCookie(res);
  res.json({ success: true, message: 'All sessions revoked' });
}));

router.get('/sessions', auth, asyncHandler(async (req, res) => {
  const rows = await service.listSessions(req.auth);
  res.json({ success: true, sessions: rows.map((s) => ({ id: s.id, current: s.id === req.auth.sessionId, userAgent: s.user_agent, ip: s.ip, createdAt: s.created_at, lastUsedAt: s.last_used_at, expiresAt: s.expires_at, revokedAt: s.revoked_at })) });
}));

router.post('/change-password', auth, validate({ body: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(200) }) }), asyncHandler(async (req, res) => {
  await service.changePassword(req.auth, req.body, ctxOf(req));
  res.json({ success: true, message: 'Password changed. Other sessions were signed out.' });
}));

module.exports = router;
