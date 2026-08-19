# Architecture Decisions

Five decisions that shaped this framework. Each records what was chosen, what was
rejected, and — most importantly — the constraint that would flip the choice.

---

## D1 — Guardrails are executable lint rules, not documentation

**Chosen:** Six custom ESLint rules in `tools/eslint-rules/`, wired as a local
plugin and enforced by `npm run agent:verify`.

| Rule | Agent failure it prevents |
|---|---|
| `no-hard-waits` | `page.waitForTimeout()` — the reflexive "fix" for flakiness |
| `no-raw-locators-in-specs` | CSS selectors smeared across specs instead of page objects |
| `no-hardcoded-test-data` | Literal emails/URLs that collide on the second run |
| `require-test-metadata` | Missing `@api`/`@ui` tags, or a tag that contradicts the directory |
| `no-weak-assertions` | `toBeTruthy()`, and un-awaited web-first assertions that never run |
| `require-framework-imports` | `import { test } from '@playwright/test'`, which silently bypasses every fixture |

**Rejected:** A `CONTRIBUTING.md` describing the same conventions in prose.

**Why:** An agent's context window is finite and its instruction-following is
probabilistic. Conventions that live only in prose get followed most of the time,
which is precisely the failure mode that produces a slowly rotting suite. A lint
rule is deterministic: the violation cannot reach `main`, and the error message
teaches the correct pattern at the exact moment it is needed. The rules encode the
*specific* mistakes an agent makes, not general style preferences — that is why
`no-weak-assertions` exists but no formatting rules do.

This was validated by writing a deliberately bad spec: all six rules fired with
actionable messages. It was validated a second time, involuntarily — the rules
caught six real violations in my own code, including two deep imports and a
hardcoded credential.

**What would flip it:** A team already running a shared lint config they cannot
extend, or a monorepo where a bespoke plugin is unwelcome. In that case the same
checks move into a pre-commit hook or a small CI script — the enforcement matters,
the delivery mechanism does not. If the team disables the rules because of false
positives, that is a bug in the rules, not a reason to drop them (see AI_USAGE.md
for a false positive I found and fixed).

---

## D2 — Isolation by unique data, not by database reset

**Chosen:** Every test creates its own users, articles, and tags via factories that
generate collision-proof identifiers (run id + worker index + counter). Nothing is
shared; nothing is cleaned up.

**Rejected:**
1. **Truncate-between-tests** — impossible without modifying the app, which is
   out of scope. There is no reset endpoint, and the SQLite file persists across runs.
2. **A shared seeded fixture set** — one `testuser` reused by many tests. Fast, but
   it serialises anything mutating and produces order-dependent failures.
3. **Per-test cleanup hooks** — deleting created data in `afterEach`. Rejected because
   cleanup that runs after a failed test often fails too, and it converts one clear
   failure into two confusing ones.

**Why:** Uniqueness *is* the isolation boundary. Two tests cannot interfere if they
never touch the same row. This also makes the suite safe to run repeatedly against
a long-lived database — which is the actual local development experience here.

The concrete payoff: `GET /api/articles` sorts by `createdAt DESC` with no
tiebreaker, so "my article is first in the list" is inherently racy under parallel
execution. Because every article carries a tag unique to its test, the query
`?tag=<unique>` returns exactly one deterministic result no matter what else is
running. Anti-flake by data design rather than by retry.

**What would flip it:** A shared staging environment with quotas, or a test account
that cannot be created on demand. Then the model inverts: a small pool of
pre-provisioned accounts leased per worker, with explicit cleanup. Also flips if
the app gains a fast reset hook — truncation is simpler than uniqueness when it is
available.

---

## D3 — Tests assert what the app does, and pin deviations explicitly

**Chosen:** Where the app contradicts the RealWorld specification, tests assert the
**actual** behaviour, tagged `@known-issue`, with the correct expectation written in
a comment and the defect analysed in `KNOWN_ISSUES.md`.

**Rejected:** Asserting the spec and shipping a suite with three permanent failures
as a "bug report".

**Why:** A suite that is red by design has no signal. Once "those three always fail"
becomes tribal knowledge, the fourth failure — a real regression — is invisible. The
pinned approach keeps green meaning "nothing changed" while making the deviation
*more* visible, not less: it appears in the test name, in the tag, and in a
dedicated document. Conformance can still be checked in isolation:

```bash
npx playwright test --grep-invert @known-issue   # spec-conformant behaviour only
```

Critically, each pinned test **fails if the app is ever fixed** — which is the
correct trigger to remove the workaround. `ArticleFactory.createTaggedArticle()`
carries an extra re-read purely to work around CONDUIT-003, and the pinned test is
what will tell a future contributor to delete it.

**What would flip it:** If the deliverable were a conformance audit rather than a
regression suite, the failing assertions *are* the report and should stay red. This
also flips if the app were in scope for modification — then the right move is to fix
`next()` → `next(error)` and delete the pin entirely.

**In my own words:** My first instinct when I hit CONDUIT-001 (duplicate email
returning 404 instead of the spec's 422) was to just write the test against the spec
and let it fail — that's the standard "write the test you wish were true" move, and
it's honest about what's broken. I rejected that once I thought through what happens
to a suite with three assertions that are *always* red: within a week, "oh yeah,
those three always fail" becomes tribal knowledge, and the next real regression that
lands next to them is invisible in the same red noise. That's the exact failure mode
I was trying to avoid — a suite where green has stopped meaning anything. So instead
I asserted the actual 404, tagged it `@known-issue`, and put the *correct* expected
behaviour in a comment plus a full writeup in `KNOWN_ISSUES.md`. The trade-off I
accepted is real: a test that asserts wrong behaviour on purpose is confusing to
anyone skimming the suite without context, and it only works because the tag and the
doc make the deviation loud instead of quiet — if either one drifts out of sync with
the test, the whole mechanism silently breaks. The concrete payoff is that each
pinned test is now a tripwire that fails the moment the app is fixed — `next()` →
`next(error)` on the register route flips CONDUIT-001's test from pass to fail, which
is the correct signal to go delete the workaround, not a bug to chase.

---

## D4 — One fixture surface, with runtime contracts behind it

**Chosen:** Tests receive everything through a single destructured fixture object —
`{ api, users, articles, actor, pages, loginAs }` — from one import. Every API
response is validated against a Zod schema before a test sees it.

**Rejected:**
1. **Importing helpers directly per spec** — flexible, but requires an agent to know
   which of a dozen modules holds the thing it needs. Wrong guesses compile fine and
   fail at runtime.
2. **A god-object `TestContext`** — one class exposing everything. Rejected because
   it grows without limit and gives no per-test lifecycle.
3. **Static typing alone, no runtime validation** — TypeScript cannot know what the
   server actually returned. A field the API never sends is `undefined` at runtime,
   and `expect(article.id).toBeTruthy()` fails three assertions later with no clue.

**Why:** Discovery cost is the dominant failure mode for an agent contributing to an
unfamiliar framework. One import plus autocomplete enumerates the entire legitimate
surface; `AGENT_MANIFEST.json` states it explicitly. Zod then closes the gap between
"compiles" and "true": a hallucinated field fails immediately with a precise path,
at the boundary where the data entered the system.

The API client deliberately splits into two families — `api.createArticle()` throws
on non-2xx and returns typed data, while `api.raw.createArticle()` returns the
untouched response for negative tests. Without that split, an agent testing a 403
would fight a helper that throws on the very status it wants to assert.

**What would flip it:** A very small suite (under ~10 tests) where the fixture layer
costs more than it saves. Or a strongly typed generated client from an OpenAPI spec
— then the schemas are generated rather than hand-written, and Zod becomes redundant
for shape (though still useful for tightening constraints the spec leaves loose).

---

## D5 — Local-only, app pre-started, verified by preflight; CI deferred

**Chosen:** The suite assumes the app is already running and fails fast in
`globalSetup` with copy-pasteable setup instructions if it is not. No CI pipeline is
included; `agent:verify` bundles the gates a pipeline would run.

**Rejected:**
1. **Playwright's `webServer` option to boot the app** — the natural choice, but the
   app is a *separate repository with git submodules*, its `npm start` runs only the
   backend, and its frontend needs `NODE_OPTIONS=--openssl-legacy-provider` on modern
   Node. Encoding that fragile startup into the test config makes test failures and
   environment failures indistinguishable.
2. **Docker Compose for the app** — robust and reproducible, but it means shipping
   infrastructure for a repo I am told not to modify, and it adds a Docker
   prerequisite to "clone and run the tests".
3. **A full GitHub Actions workflow** — explicitly out of scope for this assignment.

**Why:** The two failure modes must stay distinguishable. "Your app is not running"
is an environment problem with a known fix; "the login test failed" is a product
problem. Preflight makes the first one a single clear error instead of 28
`ECONNREFUSED` stack traces — and prevents an agent from "fixing" perfectly good
test code in response to an environment issue.

**What CI would look like** (deferred, not unconsidered): a job that starts the app
as a service container, runs `npm run agent:verify`, then the full suite with
`--workers=2` and `retries=2` (already configured under `CI=true`), uploading the
HTML report and traces on failure. The `manifest:check` gate matters most in CI —
it is what catches a contributor changing `src/` without republishing the surface
that agents read.

**What would flip it:** A team where the suite must run on every PR from day one. CI
then comes first and dictates the containerisation strategy, and the local
experience is derived from it rather than the other way round.

---

## Worker count: measured, not assumed

`playwright.config.ts` sets 4 workers locally, 2 on CI. The concern was SQLite write
contention. Rather than guess, the full suite was timed across worker counts:

| Workers | Wall time (28 tests) |
|---|---|
| 1 | 10.6 s |
| 2 | 8.8 s |
| 4 | 10.6 s |
| 8 | 6.1 s |

**Honest reading:** at this suite size the numbers are noisy and dominated by
process startup, not by database contention — no configuration produced a failure or
a lock error. 4 was kept as a middle setting with headroom; it is not a tuned
optimum, and the data does not support claiming one. The value to watch is failures,
not seconds: if write contention ever appears it will surface as `SQLITE_BUSY`, and
the fix is fewer workers, not longer timeouts.
