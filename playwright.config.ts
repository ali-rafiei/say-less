import { defineConfig, devices } from '@playwright/test';

const PORT = 8090;
// E2E_BASE_URL=https://host runs the same game against a deployed instance instead of a local server.
const LIVE = process.env.E2E_BASE_URL;

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
