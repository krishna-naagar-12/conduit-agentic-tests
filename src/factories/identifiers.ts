/**
 * Collision-free identifier generation.
 *
 * Isolation model: the app under test has no reset hook and persists to a SQLite
 * file that survives across runs, so tests cannot rely on a clean database.
 * Instead every test invents data that cannot collide with any other test, any
 * parallel worker, or any previous run. Uniqueness is the isolation mechanism.
 *
 * A run id is generated once per process and combined with a monotonic counter
 * and the Playwright worker index, so two workers starting in the same
 * millisecond still cannot produce the same value.
 */

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

let counter = 0

function nextSequence(): string {
  counter += 1
  return counter.toString(36)
}

function workerSuffix(): string {
  // Set by Playwright for every worker process; absent when called outside a run.
  const index = process.env.TEST_PARALLEL_INDEX ?? process.env.TEST_WORKER_INDEX ?? '0'
  return index
}

/**
 * A unique, lowercase, alphanumeric token safe to embed in usernames, tags and titles.
 */
export function uniqueToken(): string {
  return `${RUN_ID}${workerSuffix()}${nextSequence()}`.toLowerCase()
}

/**
 * Username matching the server's validation regex: /^[A-Za-z][A-Za-z0-9-_]+$/, 3-40 chars.
 *
 * The leading alphabetic prefix is not cosmetic. A username starting with a digit
 * is rejected by the model, and because POST /api/users swallows validation errors
 * (see KNOWN_ISSUES.md, CONDUIT-001) the failure surfaces as an opaque 404 rather
 * than a readable 422. Generating a compliant value by construction removes an
 * entire class of confusing failures.
 */
export function uniqueUsername(prefix = 'qa'): string {
  const safePrefix = prefix.replace(/[^A-Za-z]/g, '') || 'qa'
  const username = `${safePrefix}${uniqueToken()}`
  return username.slice(0, 40)
}

/**
 * Email is lowercased by the server's setter, so it is generated lowercase to keep
 * request and response values directly comparable.
 */
export function uniqueEmail(prefix = 'qa'): string {
  return `${uniqueUsername(prefix)}@example.test`
}

/**
 * Tag used as a test's private query key.
 *
 * GET /api/articles orders by createdAt DESC with no tiebreaker, so asserting that
 * an article is "first in the list" is inherently racy under parallel execution.
 * Filtering by a tag unique to one test returns a deterministic single-item result
 * regardless of what else the suite is doing concurrently.
 */
export function uniqueTag(prefix = 'tag'): string {
  return `${prefix}-${uniqueToken()}`
}
