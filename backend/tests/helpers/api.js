'use strict';
const request = require('supertest');
const crypto = require('crypto');
const { createApp } = require('../../src/app');
const { connectMongo, getDb } = require('../../src/infrastructure/mongodb/connection');
const { withSystem } = require('../../src/infrastructure/mongodb/tenant');
const { COLLECTIONS } = require('../../src/infrastructure/mongodb/collections');
const { hashPassword } = require('../../src/common/security/password');
const { ROLES } = require('../../src/common/security/rbac');

let app;
function getApp() {
  if (!app) app = createApp();
  return app;
}

const ADMIN = { email: 'sma@test.local', password: 'Admin12345' };
const KEEP = new Set(['roles', 'permissions', 'role_permissions', 'system_settings', 'schema_migrations']);

/** Empties every data collection (reference data stays) and recreates the super master admin. */
async function resetData() {
  await connectMongo();
  const db = getDb();
  for (const name of Object.keys(COLLECTIONS)) if (!KEEP.has(name)) await db.collection(name).deleteMany({});
  await withSystem(async (s) => {
    await s.c('users').insertOne({ clinicId: null, email: ADMIN.email, passwordHash: await hashPassword(ADMIN.password), role: ROLES.SUPER_MASTER_ADMIN, firstName: 'Super', lastName: 'Master', fullName: 'Super Master', phone: null, username: null, isActive: true, isVerified: true, lastLoginAt: null, failedLoginAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() });
  });
  const { getRedis } = require('../../src/infrastructure/redis/client');
  await getRedis().flushall();
}

async function login(email, password, clinic = false) {
  const res = await request(getApp()).post(clinic ? '/api/v1/auth/clinic-login' : '/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('smaart_rt='));
  return { token: res.body.token, user: res.body.user || res.body.clinic, cookie };
}

async function adminToken() {
  return (await login(ADMIN.email, ADMIN.password)).token;
}

async function createClinic(token, overrides = {}) {
  const n = crypto.randomBytes(3).toString('hex');
  const body = { name: `Clinic ${n}`, type: 'General', adminName: `Admin ${n}`, adminEmail: `admin-${n}@clinic.local`, adminPassword: 'Clinic12345', city: 'Bangalore', ...overrides };
  const res = await request(getApp()).post('/api/v1/clinics').set('Authorization', `Bearer ${token}`).send(body);
  if (res.status !== 201) throw new Error(`clinic create failed ${res.status} ${JSON.stringify(res.body)}`);
  const admin = await login(body.adminEmail, body.adminPassword, true);
  return { clinic: res.body.clinic, adminToken: admin.token, adminEmail: body.adminEmail, adminCookie: admin.cookie };
}

async function createPatient(token, overrides = {}) {
  const res = await request(getApp()).post('/api/v1/patients').set('Authorization', `Bearer ${token}`).send({ fullName: 'Test Patient', dateOfBirth: '1990-01-01', gender: 'female', phone: '9999999999', ...overrides });
  if (res.status !== 201) throw new Error(`patient create failed ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.patient;
}

/** Two clinics with one patient each: the standard cross-tenant fixture. */
async function twoClinics() {
  const t = await adminToken();
  const a = await createClinic(t);
  const b = await createClinic(t);
  const pa = await createPatient(a.adminToken);
  const pb = await createPatient(b.adminToken);
  return { adminToken: t, a, b, pa, pb };
}

/** Direct, unscoped read of one document (tests only). */
const raw = (name) => getDb().collection(name);

const api = () => request(getApp());
module.exports = { getApp, api, raw, resetData, login, adminToken, createClinic, createPatient, twoClinics, ADMIN };
