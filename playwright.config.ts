import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  workers: process.env.CI ? 2 : 5,

  // retry failed tests once in CI to handle flakiness
  retries: process.env.CI ? 1 : 0,

  // always generate both: terminal output + HTML report
  reporter: [['list'], ['html', { open: 'never' }]],

  projects: [
    // API tests hit the server directly — no browser needed, run once
    { name: 'api', testMatch: 'api.spec.ts' },
    // E2E tests run in all 3 browsers
    { name: 'chromium', use: { browserName: 'chromium' }, testIgnore: 'api.spec.ts' },
    { name: 'firefox', use: { browserName: 'firefox' }, testIgnore: 'api.spec.ts' },
    { name: 'webkit', use: { browserName: 'webkit' }, testIgnore: 'api.spec.ts' },
    // Mobile viewport — runs E2E tests at iPhone screen size
    { name: 'mobile', use: { ...devices['iPhone 14'] }, testIgnore: ['api.spec.ts', 'sauce-demo.spec.ts'] },
  ],

  use: {
    baseURL: 'http://localhost:4173',

    headless: true,

    screenshot: 'only-on-failure',

    // capture a trace on first retry (helps debug failures in CI)
    trace: 'on-first-retry',
  },

  webServer: {
    command: 'node server.js',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
