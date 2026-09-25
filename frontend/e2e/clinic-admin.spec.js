import { test, expect } from '@playwright/test';
import { seedClinic, clinicLogin } from './helpers.js';

test.describe('clinic admin workflows (existing UI)', () => {
  let seed;
  test.beforeAll(async () => { seed = await seedClinic(); });

  test('clinic login shows the clinic dashboard and clinic-scoped menu', async ({ page }) => {
    await clinicLogin(page, seed.clinic.adminEmail, seed.clinic.adminPassword);
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
    const nav = page.locator('nav, aside');
    await expect(nav.getByText('Patients', { exact: true }).first()).toBeVisible();
    await expect(nav.getByText('Community Hub').first()).toBeVisible();
    await expect(nav.getByText('Clinic Management')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy();
    expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain('patients');
  });

  test('patient list shows the seeded patient and the patient view opens', async ({ page }) => {
    await clinicLogin(page, seed.clinic.adminEmail, seed.clinic.adminPassword);
    await page.goto('/patients');
    await expect(page.getByText(seed.patient.fullName).first()).toBeVisible({ timeout: 20_000 });
    await page.goto(`/patients/${seed.patient._id}`);
    await expect(page.getByText(seed.patient.fullName).first()).toBeVisible({ timeout: 20_000 });
  });

  test('doctors page lists the seeded practitioner', async ({ page }) => {
    await clinicLogin(page, seed.clinic.adminEmail, seed.clinic.adminPassword);
    await page.goto('/doctors');
    await expect(page.getByText(seed.doctor.fullName).first()).toBeVisible({ timeout: 20_000 });
  });

  test('wrong password is rejected with the same message and no session', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /clinic login/i }).click();
    await page.locator('input[type="email"]').fill(seed.clinic.adminEmail);
    await page.locator('input[type="password"]').fill('wrong-password');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText(/invalid clinic credentials/i)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });

  test('a second clinic cannot open the first clinic patient through the UI', async ({ page }) => {
    const other = await seedClinic();
    await clinicLogin(page, other.clinic.adminEmail, other.clinic.adminPassword);
    const res = await page.request.get(`/api/v1/patients/${seed.patient._id}`, { headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}` } });
    expect([403, 404]).toContain(res.status());
    await page.goto('/patients');
    await expect(page.getByText(seed.patient.fullName)).toHaveCount(0);
  });
});
