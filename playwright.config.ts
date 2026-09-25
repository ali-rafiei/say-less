import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 8090);
// E2E_BASE_URL=https://host runs the same game against a deployed instance instead of a local server.
const LIVE = process.env.E2E_BASE_URL;
// E2E_RESOLVE="host ip" pins a hostname inside Chromium (useful while a local resolver caches NXDOMAIN).
const RESOLVE = process.env.E2E_RESOLVE;
const chromiumLaunch = RESOLVE
  ? { args: [`--host-resolver-rules=MAP ${RESOLVE.split(' ')[0]} [${RESOLVE.split(' ')[1]}]`] }
  : {};

// Device projects exist only when a project is named (--project android) or E2E_DEVICES=1, so a bare
// `playwright test` stays the CI default. The env var carries the choice into worker processes.
if (process.argv.some((arg) => arg.startsWith('--project'))) process.env.E2E_DEVICES ??= '1';
const DEVICES = process.env.E2E_DEVICES === '1';

export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: LIVE ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'iphone-chromium',
      use: { ...devices['iPhone 13'], browserName: 'chromium', launchOptions: chromiumLaunch },
    },
    ...(DEVICES
      ? [
          { name: 'android', use: { ...devices['Pixel 7'], launchOptions: chromiumLaunch } },
          // E2E_RESOLVE is Chromium-only: WebKit has no host-resolver switch.
          { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
        ]
      : []),
  ],
  webServer: LIVE
    ? undefined
    : {
        command: `npm run build -w client && PORT=${PORT} npx tsx server/src/index.ts`,
        url: `http://localhost:${PORT}/healthz`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
