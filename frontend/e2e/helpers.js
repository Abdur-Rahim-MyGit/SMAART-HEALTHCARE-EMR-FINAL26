import { request } from '@playwright/test';

const API_PORT = process.env.E2E_API_PORT || '5077';
export const API = `http://localhost:${API_PORT}/api/v1`;
export const ADMIN = { email: process.env.E2E_ADMIN_EMAIL || 'sma@test.local', password: process.env.E2E_ADMIN_PASSWORD || 'Admin12345' };

/** Seeds a clinic (with admin), a doctor and a patient through the API. */
export async function seedClinic() {
  const ctx = await request.newContext();
  const login = await ctx.post(`${API}/auth/login`, { data: ADMIN });
  if (!login.ok()) throw new Error(`admin login failed: ${login.status()} ${await login.text()}`);
  const token = (await login.json()).token;
  const n = Math.random().toString(16).slice(2, 8);
  const clinic = { name: `E2E Clinic ${n}`, type: 'General', city: 'Bangalore', adminName: `E2E Admin ${n}`, adminEmail: `e2e-${n}@clinic.local`, adminPassword: 'Clinic12345' };
  const created = await ctx.post(`${API}/clinics`, { data: clinic, headers: { Authorization: `Bearer ${token}` } });
  if (!created.ok()) throw new Error(`clinic create failed: ${await created.text()}`);
  const clinicRow = (await created.json()).clinic;
  const clogin = await ctx.post(`${API}/auth/clinic-login`, { data: { email: clinic.adminEmail, password: clinic.adminPassword } });
  const ctoken = (await clogin.json()).token;
  const doctor = await ctx.post(`${API}/doctors`, { data: { fullName: `Dr E2E ${n}`, specialty: 'General Medicine' }, headers: { Authorization: `Bearer ${ctoken}` } });
  const patient = await ctx.post(`${API}/patients`, { data: { fullName: `E2E Patient ${n}`, dateOfBirth: '1990-05-15', gender: 'female', phone: '9999999999', bloodType: 'O+' }, headers: { Authorization: `Bearer ${ctoken}` } });
  const doctorRow = (await doctor.json()).doctor;
  const patientRow = (await patient.json()).patient;
  await ctx.dispose();
  return { clinic: { ...clinic, id: clinicRow._id }, doctor: doctorRow, patient: patientRow, adminToken: token };
}

export async function clinicLogin(page, email, password) {
  await page.goto('/login');
  await page.getByRole('button', { name: /clinic login/i }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(dashboard)?$/, { timeout: 30_000 });
}

export async function developerLogin(page, email, password) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /developer login/i }).click();
  await page.waitForURL(/\/(dashboard)?$/, { timeout: 30_000 });
}
