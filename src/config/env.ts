import * as dotenv from 'dotenv'

dotenv.config()

/**
 * Single source of truth for environment configuration.
 *
 * Why this exists: an agent asked to "point the tests at staging" will otherwise
 * scatter `process.env` reads and hardcoded URLs across specs. Everything funnels
 * through here, and the `no-hardcoded-test-data` ESLint rule bans literal URLs in
 * tests so this stays the only path.
 */

function required(name: string, fallback: string): string {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : fallback
}

function toInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, received: "${raw}"`)
  }
  return parsed
}

export const env = {
  /** Express backend root, e.g. http://localhost:3000 */
  apiBaseUrl: required('API_BASE_URL', 'http://localhost:3000'),
  /** React dev server root, e.g. http://localhost:4101 */
  uiBaseUrl: required('UI_BASE_URL', 'http://localhost:4101'),
  /** Prefix the backend mounts its REST API under. */
  apiPath: required('API_PATH', '/api'),
  /**
   * Password used for every generated user.
   *
   * Deliberately not a secret: the app under test is a disposable local sandbox
   * with a throwaway SQLite database. It is still read from the environment so
   * that no credential literal appears in test code, and so the same suite can
   * run against an environment with a stricter password policy.
   */
  testUserPassword: required('TEST_USER_PASSWORD', 'Passw0rd!23'),
  /** Per-action timeout for API requests (ms). */
  apiTimeoutMs: toInt('API_TIMEOUT_MS', 15_000),
  /** Per-action timeout for UI expectations (ms). */
  uiExpectTimeoutMs: toInt('UI_EXPECT_TIMEOUT_MS', 10_000),
  isCi: process.env.CI === 'true' || process.env.CI === '1',
} as const

export const apiRoot = `${env.apiBaseUrl}${env.apiPath}`
