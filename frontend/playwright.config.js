// End-to-end tests of the existing UI against the real API (test database).
// Requires: PostgreSQL + Redis reachable per backend/.env.test, migrations applied,
// and a bootstrapped admin (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).
import { defineConfig, devices } from '@playwright/test';

const API_PORT = process.env.E2E_API_PORT || '5077';
const WEB_PORT = process.env.E2E_WEB_PORT || '3077';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `cd ../backend && NODE_ENV=test PORT=${API_PORT} node src/server.js`,
      url: `http://localhost:${API_PORT}/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { VITE_API_URL: '/api/v1', VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
