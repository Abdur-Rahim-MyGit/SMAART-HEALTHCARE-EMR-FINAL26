import { test, expect } from '@playwright/test';
import { seedClinic, developerLogin, ADMIN } from './helpers.js';

test.describe('super master admin workflows (existing UI)', () => {
  let seed;
  test.beforeAll(async () => { seed = await seedClinic(); });

  test('signs in, sees the platform dashboard and clinic management', async ({ page }) => {
    await developerLogin(page, ADMIN.email, ADMIN.password);
    const nav = page.locator('nav, aside');
    await expect(nav.getByText('Clinic Management').first()).toBeVisible();
    await page.goto('/clinics');
    await expect(page.getByText(seed.clinic.name).first()).toBeVisible({ timeout: 20_000 });
  });

  test('sees patients across clinics and the session survives an access-token refresh', async ({ page }) => {
    await developerLogin(page, ADMIN.email, ADMIN.password);
    await page.goto('/patients');
    await expect(page.getByText(seed.patient.fullName).first()).toBeVisible({ timeout: 20_000 });
    // Simulate an expired access token: the interceptor must refresh with the httpOnly cookie and keep the user signed in.
    await page.evaluate(() => localStorage.setItem('token', 'expired.token.value'));
    await page.goto('/patients');
    await expect(page.getByText(seed.patient.fullName).first()).toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(() => localStorage.getItem('token'))).not.toBe('expired.token.value');
  });

  test('logout revokes the server session', async ({ page }) => {
    await developerLogin(page, ADMIN.email, ADMIN.password);
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const revoked = page.waitForResponse((r) => r.url().includes('/auth/logout'));
    await page.locator('header button[class*="hover:text-red-600"]').first().click();
    expect((await revoked).status()).toBe(200);
    await page.waitForURL(/\/login/, { timeout: 20_000 });
    const res = await page.request.get('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(401);
  });
});
