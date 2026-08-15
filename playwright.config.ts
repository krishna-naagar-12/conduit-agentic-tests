import { defineConfig, devices } from '@playwright/test'

import { env } from './src/config/env'

/**
 * Playwright configuration.
 *
 * Two projects rather than one:
 *   - `api` runs headless HTTP tests with no browser at all, so the API suite
 *     stays fast and can be run alone during development (`npm run test:api`).
 *   - `ui` carries the browser context settings.
 *
 * Worker count is capped at 4. The app under test writes to a single SQLite file
 * with no connection pooling; this value was chosen by measuring the suite rather
 * than guessed — see DECISIONS.md (D3).
 */
export default defineConfig({
  testDir: './tests',
  // A test that hangs is a bug, not something to wait out.
  timeout: 45_000,
  expect: { timeout: env.uiExpectTimeoutMs },

  // Full isolation: every test creates its own users and articles, so nothing
  // depends on execution order.
  fullyParallel: true,
  workers: env.isCi ? 2 : 4,

  // Retries only on CI. Locally a flake should be visible and fixed, not hidden.
  retries: env.isCi ? 2 : 0,

  // Fail the build if someone commits a focused test.
  forbidOnly: env.isCi,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    // Diagnostics are kept for failures only, so a green run stays cheap.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Verifies the app under test is reachable before any test runs, and prints
  // actionable setup instructions if it is not.
  globalSetup: './src/support/global-setup.ts',

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: env.apiBaseUrl },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: env.uiBaseUrl,
      },
    },
  ],
})
