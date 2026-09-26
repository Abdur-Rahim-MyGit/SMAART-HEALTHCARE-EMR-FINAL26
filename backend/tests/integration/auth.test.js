'use strict';
const jwt = require('jsonwebtoken');
const { api, resetData, login, adminToken, createClinic, ADMIN } = require('../helpers/api');
const { withSystem } = require('../../src/infrastructure/mongodb/tenant');
const { config } = require('../../src/config');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function latestOtp(email, purpose) {
  // Tests read the hashed challenge and brute-force the 4/6 digit space offline (the API never exposes codes).
  const { hashOtp } = require('../../src/common/security/otp');
  const ch = await withSystem(async (db) => {
    const user = await db.c('users').findOne({ email: email.toLowerCase() });
    return (await db.c('otp_challenges').find({ userId: user._id, purpose, consumedAt: null }, { sort: { createdAt: -1 }, limit: 1 }))[0];
  });
  const len = purpose === 'login' ? 4 : 6;
  for (let i = 0; i < 10 ** len; i++) {
    const code = String(i).padStart(len, '0');
    if (hashOtp(code, ch.salt) === ch.codeHash) return code;
  }
  throw new Error('otp not found');
}

describe('authentication', () => {
  beforeAll(async () => { await resetData(); });

  it('logs in with password (dev mode), returns minimal user and sets an httpOnly refresh cookie', async () => {
    const res = await api().post('/api/v1/auth/login').send(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('super_master_admin');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('password');
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('smaart_rt='));
    expect(cookie).toMatch(/HttpOnly/);
    const claims = jwt.decode(res.body.token);
    expect(Object.keys(claims).sort()).toEqual(['clinicId', 'exp', 'iat', 'iss', 'jti', 'role', 'sid', 'sub']);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(15 * 60);
  });

  it('rejects wrong password, unknown user, and locks after repeated failures', async () => {
    expect((await api().post('/api/v1/auth/login').send({ email: ADMIN.email, password: 'nope1234' })).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email: 'ghost@test.local', password: 'nope1234' })).status).toBe(401);
    const t = await adminToken();
    const c = await createClinic(t);
    for (let i = 0; i < 5; i++) await api().post('/api/v1/auth/clinic-login').send({ email: c.adminEmail, password: 'wrongwrong' });
    const locked = await api().post('/api/v1/auth/clinic-login').send({ email: c.adminEmail, password: 'Clinic12345' });
    expect(locked.status).toBe(423);
  });

  it('rejects missing, malformed, expired and revoked tokens', async () => {
    expect((await api().get('/api/v1/patients')).status).toBe(401);
    expect((await api().get('/api/v1/patients').set(auth('garbage'))).status).toBe(401);
    const env = config();
    const expired = jwt.sign({ role: 'super_master_admin', sid: '00000000-0000-4000-8000-000000000000' }, env.JWT_SECRET, { subject: '00000000-0000-4000-8000-000000000000', issuer: env.JWT_ISSUER, expiresIn: -5 });
    const r = await api().get('/api/v1/patients').set(auth(expired));
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('TOKEN_EXPIRED');
    const s = await login(ADMIN.email, ADMIN.password);
    expect((await api().get('/api/v1/auth/me').set(auth(s.token))).status).toBe(200);
    await api().post('/api/v1/auth/logout').set(auth(s.token));
    const after = await api().get('/api/v1/auth/me').set(auth(s.token));
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('SESSION_REVOKED');
  });

  it('forged role or clinic claims are rejected because the session is checked', async () => {
    const s = await login(ADMIN.email, ADMIN.password);
    const claims = jwt.decode(s.token);
    const env = config();
    const forged = jwt.sign({ role: 'clinic_admin', clinicId: '11111111-1111-4111-8111-111111111111', sid: claims.sid }, env.JWT_SECRET, { subject: claims.sub, issuer: env.JWT_ISSUER, expiresIn: '5m' });
    const r = await api().get('/api/v1/patients').set(auth(forged));
    expect(r.status).toBe(401);
  });

  it('rotates refresh tokens and revokes the session on reuse', async () => {
    const s = await login(ADMIN.email, ADMIN.password);
    const first = await api().post('/api/v1/auth/refresh').set('Cookie', s.cookie);
    expect(first.status).toBe(200);
    expect(first.body.token).toBeTruthy();
    const second = first.headers['set-cookie'].find((c) => c.startsWith('smaart_rt='));
    expect(second).not.toBe(s.cookie);
    const replay = await api().post('/api/v1/auth/refresh').set('Cookie', s.cookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('SESSION_REVOKED');
    const dead = await api().post('/api/v1/auth/refresh').set('Cookie', second);
    expect(dead.status).toBe(401);
    expect((await api().get('/api/v1/auth/me').set(auth(first.body.token))).status).toBe(401);
  });

  it('OTP login: password first, then a single-use code with attempt limits', async () => {
    const step1 = await api().post('/api/v1/auth/request-login-otp').send(ADMIN);
    expect(step1.status).toBe(200);
    expect(step1.body).not.toHaveProperty('otp');
    const code = await latestOtp(ADMIN.email, 'login');
    const wrong = String((Number(code) + 1) % 10000).padStart(4, '0');
    expect((await api().post('/api/v1/auth/verify-login-otp').send({ userId: step1.body.userId, otp: wrong })).status).toBe(400);
    const ok = await api().post('/api/v1/auth/verify-login-otp').send({ userId: step1.body.userId, otp: code });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    expect((await api().post('/api/v1/auth/verify-login-otp').send({ userId: step1.body.userId, otp: code })).status).toBe(400);
  });

  it('password reset requires the verified OTP and revokes other sessions', async () => {
    const t = await adminToken();
    const c = await createClinic(t);
    const before = await login(c.adminEmail, 'Clinic12345', true);
    const fp = await api().post('/api/v1/auth/forgot-password').send({ email: c.adminEmail, type: 'clinic' });
    expect(fp.status).toBe(200);
    expect(fp.body).not.toHaveProperty('otp');
    const ghost = await api().post('/api/v1/auth/forgot-password').send({ email: 'nobody@nowhere.local' });
    expect(ghost.status).toBe(200); // no enumeration
    // the legacy vulnerability: resetting without verifying the OTP must fail
    expect((await api().post('/api/v1/auth/reset-password').send({ email: c.adminEmail, password: 'Hacked12345', resetToken: 'x'.repeat(20) })).status).toBe(400);
    const code = await latestOtp(c.adminEmail, 'password_reset');
    const v = await api().post('/api/v1/auth/verify-reset-otp').send({ email: c.adminEmail, otp: code, type: 'clinic' });
    expect(v.status).toBe(200);
    expect(v.body.resetToken).toBeTruthy();
    const weak = await api().post('/api/v1/auth/reset-password').send({ email: c.adminEmail, password: 'weakweak', resetToken: v.body.resetToken });
    expect(weak.status).toBe(400);
    const r = await api().post('/api/v1/auth/reset-password').send({ email: c.adminEmail, password: 'Fresh12345', resetToken: v.body.resetToken });
    expect(r.status).toBe(200);
    expect((await api().post('/api/v1/auth/reset-password').send({ email: c.adminEmail, password: 'Again12345', resetToken: v.body.resetToken })).status).toBe(400);
    expect((await api().get('/api/v1/auth/me').set(auth(before.token))).status).toBe(401);
    expect((await api().post('/api/v1/auth/clinic-login').send({ email: c.adminEmail, password: 'Fresh12345' })).status).toBe(200);
  });

  it('self-registration and legacy bootstrap endpoints are gone', async () => {
    for (const p of ['/api/v1/auth/register', '/api/v1/auth/quick-register', '/api/v1/auth/create-super-master-admin', '/api/auth/register']) {
      const r = await api().post(p).send({ email: 'x@x.com', password: 'Password1', role: 'super_master_admin', firstName: 'x', lastName: 'y', phone: '1' });
      expect(r.status, p).toBe(403);
    }
    expect((await api().get('/api/users/test-doctors')).status).toBe(401);
    expect([401, 404]).toContain((await api().get('/api/auth/test-email')).status);
    expect([401, 404]).toContain((await api().post('/api/auth/send-test-otp').send({ email: 'x@x.com' })).status);
  });

  it('clinic login is denied for inactive or expired clinics', async () => {
    const t = await adminToken();
    const c = await createClinic(t);
    await api().put(`/api/v1/clinics/${c.clinic._id}`).set(auth(t)).send({ isActive: false });
    const r = await api().post('/api/v1/auth/clinic-login').send({ email: c.adminEmail, password: 'Clinic12345' });
    expect(r.status).toBe(403);
    expect((await api().get('/api/v1/auth/me').set(auth(c.adminToken))).status).toBe(401);
  });

  it('legacy un-versioned paths are aliased to v1', async () => {
    const r = await api().post('/api/auth/login').send(ADMIN);
    expect(r.status).toBe(200);
    expect((await api().get('/api/auth/me').set(auth(r.body.token))).status).toBe(200);
  });
});
