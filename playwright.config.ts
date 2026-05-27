import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  // 1 worker locally to avoid shared-server race conditions;
  // CI uses 2 workers with a retry to handle any residual flakiness
  workers: process.env.CI ? 2 : 1,

  // retry failed tests once in CI to handle flakiness
  retries: process.env.CI ? 1 : 0,

  // always generate both: terminal output + HTML report
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./reporters/markdown-summary.ts'],
  ],

  projects: [
    // API tests hit the server directly — no browser needed, run once
    { name: 'api', testMatch: 'api.spec.ts' },
    // Locally: chromium only. CI: all browsers + mobile.
    { name: 'chromium', use: { browserName: 'chromium' }, testIgnore: 'api.spec.ts' },
    ...( process.env.CI ? [
      { name: 'firefox', use: { browserName: 'firefox' }, testIgnore: 'api.spec.ts' },
      { name: 'webkit', use: { browserName: 'webkit' }, testIgnore: 'api.spec.ts' },
      { name: 'mobile', use: { ...devices['iPhone 14'] }, testIgnore: ['api.spec.ts', 'sauce-demo.spec.ts'] },
    ] : []),
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4173',

    headless: true,

    screenshot: 'only-on-failure',

    // capture a trace on first retry (helps debug failures in CI)
    trace: 'on-first-retry',
  },

  // Skip webServer when BASE_URL is set (e.g., in Docker where the app runs in a separate container)
  ...(!process.env.BASE_URL && {
    webServer: {
      command: 'node server.js',
      port: 4173,
      reuseExistingServer: !process.env.CI,
    },
  }),
});
