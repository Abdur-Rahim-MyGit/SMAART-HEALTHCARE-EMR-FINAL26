'use strict';
const request = require('supertest');
const crypto = require('crypto');
const { createApp } = require('../../src/app');
const { getKnex } = require('../../src/infrastructure/postgres/knex');
const { withSystem } = require('../../src/infrastructure/postgres/tenant');
const { hashPassword } = require('../../src/common/security/password');
const { ROLES } = require('../../src/common/security/rbac');

let app;
function getApp() {
  if (!app) app = createApp();
  return app;
}

const ADMIN = { email: 'sma@test.local', password: 'Admin12345' };

let adminKnex;
/** Test-only privileged connection (schema owner) used to wipe tables; the app role cannot delete audit rows. */
function getAdminKnex() {
  if (!adminKnex) adminKnex = require('knex')({ client: 'pg', connection: process.env.MIGRATION_DATABASE_URL, pool: { min: 0, max: 2 } });
  return adminKnex;
}

async function resetData() {
  await getAdminKnex().transaction(async (trx) => {
    await trx.raw("select set_config('app.role', 'system', true)");
    for (const t of ['audit_logs', 'outbox_events', 'notifications', 'invoices', 'teleconsultations', 'referrals', 'imaging_studies', 'imaging_orders', 'lab_results', 'lab_orders', 'vitals', 'prescription_items', 'prescriptions', 'medications', 'allergies', 'clinical_conditions', 'encounters', 'appointments', 'patient_identifiers', 'documents', 'patients', 'practitioners', 'otp_challenges', 'auth_sessions', 'users', 'clinics', 'legacy_id_map', 'fhir_resource_refs']) {
      await trx.raw(`DELETE FROM ${t}`);
    }
  });
  await withSystem(async (trx) => {
    await trx('users').insert({ email: ADMIN.email, password_hash: await hashPassword(ADMIN.password), role: ROLES.SUPER_MASTER_ADMIN, first_name: 'Super', last_name: 'Master', full_name: 'Super Master', is_active: true, is_verified: true });
  }, getKnex());
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

const api = () => request(getApp());
async function closeAdmin() { if (adminKnex) { await adminKnex.destroy(); adminKnex = undefined; } }
module.exports = { closeAdmin, getApp, api, resetData, login, adminToken, createClinic, createPatient, twoClinics, ADMIN };
