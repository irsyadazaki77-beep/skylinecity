import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const e2ePort = Number(process.env.PLAYWRIGHT_PORT ?? 3004);

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    launchOptions: process.env.SKYLINE_SOFTWARE_WEBGL === '1'
      ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
      : {},
    baseURL: `http://localhost:${e2ePort}`,
    // OneDrive can remove an in-progress trace recording before Playwright
    // closes the context. CI keeps failure traces; local runs prioritize a
    // deterministic pass and still retain failure screenshots.
    trace: isCI ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
  },
  // Opt-in for an explicitly started fresh production server, useful on
  // Windows hosts whose process-tree teardown hangs after all tests finish.
  webServer: process.env.SKYLINE_E2E_EXTERNAL_SERVER === '1' ? undefined : {
    // E2E validates the same production bundle that is released. Local runs
    // Use an isolated port so a stale dev server cannot make E2E hang or
    // accidentally validate a different bundle.
    command: `npm run build && node scripts/serveDist.mjs --host 0.0.0.0 --port ${e2ePort}`,
    port: e2ePort,
    reuseExistingServer: false,
    timeout: 30000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 },
      },
    },
  ],
});
