/**
 * Playwright configuration – Week 4 end-to-end suite.
 *
 * These tests drive a real Chromium browser against the *real* integrated
 * stack: the Vite dev server on :5173 proxying to the Express/MongoDB API on
 * :4000. Nothing is mocked, so a green run proves the integration works
 * end-to-end (which is exactly what the Week 4 task is about).
 *
 * `webServer` boots both processes automatically; if you already have
 * `npm run dev` running, Playwright reuses them.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // one shared in-memory database – keep the data deterministic
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    // localhost (not 127.0.0.1) so the browser's Origin matches the API's
    // default CORS allow-list (http://localhost:5173)
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1366, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm --prefix ../server start',
      url: 'http://127.0.0.1:4000/api/v1/health',
      reuseExistingServer: false,
      timeout: 90_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        // Both spellings of the dev-server origin may show up as the Origin header
        CORS_ORIGIN: 'http://localhost:5173,http://127.0.0.1:5173',
        MONGODB_URI: '',
        NODE_ENV: 'development',
        SERVE_CLIENT: 'false',
        JWT_SECRET: 'e2e-secret-that-is-long-enough-for-the-tests',
        // The suite creates a fresh account per test; raise the limits so the
        // (correct) production defaults never turn into flaky failures.
        RATE_LIMIT_API_MAX: '10000',
        RATE_LIMIT_AUTH_MAX: '1000',
      },
    },
    {
      command: 'npm --prefix ../client run dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      timeout: 90_000,
    },
  ],
})
