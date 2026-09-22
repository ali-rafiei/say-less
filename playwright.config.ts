import { defineConfig, devices } from '@playwright/test';

const PORT = 8090;
// E2E_BASE_URL=https://host runs the same game against a deployed instance instead of a local server.
const LIVE = process.env.E2E_BASE_URL;
// E2E_RESOLVE="host ip" pins a hostname inside Chromium (useful while a local resolver caches NXDOMAIN).
const RESOLVE = process.env.E2E_RESOLVE;

export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    launchOptions: RESOLVE
      ? { args: [`--host-resolver-rules=MAP ${RESOLVE.split(' ')[0]} [${RESOLVE.split(' ')[1]}]`] }
      : {},
    baseURL: LIVE ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: LIVE
    ? undefined
    : {
        command: `npm run build -w client && PORT=${PORT} npx tsx server/src/index.ts`,
        url: `http://localhost:${PORT}/healthz`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
