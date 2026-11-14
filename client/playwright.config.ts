// ==============================================================================
// Appointly Client — Playwright E2E Configuration (Sprint 1)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 3.1 (End-to-End UI Tests, STS-S1-001…009)
//
// What runs:  the REAL stack — the Express API against a REAL, seeded PostgreSQL
//             database, serving the production build of the React client from the
//             same origin (exactly how the Docker image runs). Nothing is mocked.
//
// How to run (from client/):
//   1. Prepare an isolated database once:  prisma migrate deploy && npm run prisma:seed  (server/)
//   2. DATABASE_URL=postgresql://…/appointly_test  npm run test:e2e
//
// Safety: the tests create and edit data, so the run is refused unless DATABASE_URL
// points at a database whose name ends in "_test" (override: E2E_ALLOW_ANY_DB=1).
// ==============================================================================

import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4100);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for the E2E run. Point it at a seeded, disposable PostgreSQL database (name ending in "_test").'
  );
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
if (!databaseName.endsWith('_test') && process.env.E2E_ALLOW_ANY_DB !== '1') {
  throw new Error(
    `Refusing to run E2E tests against database "${databaseName}": the tests create and modify data. ` +
      'Use a database whose name ends in "_test" (or set E2E_ALLOW_ANY_DB=1 if you really mean it).'
  );
}

export default defineConfig({
  testDir: './tests/sprint-1/e2e',
  globalSetup: './tests/sprint-1/e2e/global-setup.ts',
  outputDir: './test-results',

  // One shared database: journeys run one after another, in file order.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),

  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1280, height: 800 },
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],

  webServer: {
    command: 'npx tsx src/server.ts',
    cwd: '../server',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      ...(process.env as Record<string, string>),
      NODE_ENV: 'test',
      PORT: String(PORT),
      DATABASE_URL: databaseUrl,
    },
  },
});
