// Playwright settings for the smoke test (tests/smoke.spec.js).
//
// Run locally:  cd tests && npm install && npx playwright install chromium && npx playwright test
// The config starts `python serve.py 8765` itself if nothing is listening on 127.0.0.1:8765
// (GitHub Actions starts the server before the test, so that step is reused there).
// Picks are saved in the browser profile Playwright creates for each test, so nothing you have
// picked in your own browser is touched.
// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const PORT = 8765;
const BASE = 'http://127.0.0.1:' + PORT;

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.js/,
  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,          // a retry is reported as "flaky", not hidden
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: (process.platform === 'win32' ? 'python' : 'python3') + ' serve.py ' + PORT,
    cwd: path.join(__dirname, '..'),
    url: BASE + '/lineup.html',
    reuseExistingServer: true,
    timeout: 30 * 1000,
  },
});
