# Conduit Agentic Test Framework

An agentic-first Playwright + TypeScript test suite for the
[Conduit RealWorld app](https://github.com/cirosantilli/node-express-sequelize-realworld-example-app).

**28 tests — 22 API, 6 UI — running green in ~5 seconds.**

"Agentic-first" here means the framework is built so that an AI agent contributing a
test *cannot* quietly make the usual mistakes: no invented helpers, no fixed sleeps,
no hardcoded data, no selectors leaking into specs. Those constraints are enforced by
custom lint rules and the type system, not by documentation. See
[DECISIONS.md](DECISIONS.md) for the reasoning and
[AI_USAGE.md](AI_USAGE.md) for the times it caught me.

---

## Quick start

Two terminals: one for the app under test, one for the tests.

### Terminal 1 — start the app

The app is a **separate repository** and is not modified by this suite.

```bash
git clone --recurse-submodules \
  https://github.com/cirosantilli/node-express-sequelize-realworld-example-app
cd node-express-sequelize-realworld-example-app
npm install
npm run dev     # backend :3000 + frontend :4101
```

> `--recurse-submodules` is **required**. The React frontend is a git submodule; a
> plain clone leaves it empty and the UI will not start.

If `npm install` or `npm run dev` fails, see [Troubleshooting](#troubleshooting-the-app-under-test)
— on current Node versions it usually will, and the fixes are short.

### Terminal 2 — run the tests

```bash
git clone <this-repo>
cd conduit-agentic-tests
npm install
npx playwright install chromium
npm test
```

Expected:

```
Running 28 tests using 4 workers
  ...
  28 passed (5.0s)
```

No `.env` file is needed — defaults match the app's standard ports. Copy
`.env.example` to `.env` to override.

---

## Commands

| Command | Purpose |
|---|---|
| `npm test` | Full suite (API + UI) |
| `npm run test:api` | API tests only — fast, no browser |
| `npm run test:ui` | UI tests only |
| `npm run test:headed` | UI tests with a visible browser |
| `npm run agent:verify` | **All quality gates** — typecheck, lint, manifest drift, smoke |
| `npm run lint` | Agent guardrails + general hygiene |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run manifest:generate` | Regenerate `AGENT_MANIFEST.json` after changing `src/` |
| `npm run report` | Open the HTML report from the last run |

Run a subset by tag:

```bash
npx playwright test --grep @smoke
npx playwright test --grep-invert @known-issue   # skip pinned app defects
```

---

## What is tested, and why

Depth over breadth: the flows chosen are the ones where a regression is either
expensive or silent.

### API (22 tests)

| Area | Coverage | Why automated |
|---|---|---|
| Article lifecycle | Create, read, update, delete, tag filter, pagination | The app's primary value path |
| Authorisation | Cross-user update/delete/comment-delete → `403`; unauthenticated feed → `401` | **Fails silently in production** if broken — nothing throws, the wrong person just succeeds |
| Favourites | Favourite, double-favourite idempotency, unfavourite, per-user scoping | Counter fields are where off-by-one bugs live; double-click is a real user path |
| Comments | Create, list, author delete | Core engagement flow |
| Validation | Blank password, wrong password, duplicate email, invalid username | Boundaries where the app's real behaviour differs from the spec |

### UI (6 tests)

| Area | Coverage | Why a browser is justified |
|---|---|---|
| Authentication | Register, sign in, wrong-password error | The only place the UI holds logic the API cannot verify — form wiring, redirects, header state |
| Publishing | Publish via the editor, appears in global feed | Tag input and post-publish redirect are client-side behaviour |
| Commenting | Post a comment, renders on the article | Verifies the Redux round-trip actually reached the backend |

UI tests seed authentication via `loginAs` rather than retyping the login form —
the form has its own test, and repeating it elsewhere costs a page load and proves
nothing new.

### Deliberately **not** automated

| Not tested | Why |
|---|---|
| Visual / layout regression | High maintenance, low signal on a static Bootstrap template |
| Markdown rendering fidelity | Third-party library behaviour, not app logic |
| Cross-browser | Out of scope per the assignment; the app has no browser-specific code |
| Deep accessibility audit | Needs a dedicated tool and human judgement — better as its own effort |
| Performance / load | Out of scope; a 28-test suite is not a load harness |
| Follow/unfollow, settings, profile pages | Lower risk; would be the next increment |

---

## Architecture

```
src/
  config/env.ts              Single source of environment config
  contracts/                 Zod schemas — runtime validation of every API response
  factories/
    identifiers.ts           Collision-proof unique data (run id + worker + counter)
    builders.ts              Server-valid payloads with partial overrides
  api/conduit-client.ts      Typed client. api.* throws on error; api.raw.* for negatives
  fixtures/
    actors.ts                User and article factories
    test.ts                  The single import every spec uses
  pages/                     Page objects — the only place selectors live
  support/global-setup.ts    Preflight: fails fast with setup instructions

tests/
  api/                       22 API tests
  ui/                        6 UI tests

tools/
  eslint-rules/              6 custom guardrails (the agentic core)
  generate-manifest.ts       AST → AGENT_MANIFEST.json, with drift check
  agent-verify.ts            One command that runs every gate
```

### The agentic layer

Six things, each targeting a specific observed agent failure:

1. **One fixture surface.** `{ api, users, articles, actor, pages, loginAs }` from a
   single import. Nothing to discover, nothing to guess.
2. **Six custom ESLint rules.** Hard waits, raw locators in specs, hardcoded data,
   missing tags, weak assertions, and bypassing the fixtures are all lint errors.
3. **`AGENT_MANIFEST.json`.** Generated from the TypeScript AST, verified against
   drift in CI. If a method is not in it, it does not exist.
4. **Self-validating factories.** Usernames are generated to match the server's regex
   *by construction*, so an entire class of opaque 404s cannot happen.
5. **Zod contracts.** A hallucinated response field fails at the boundary with a
   precise path, not three assertions later as `undefined`.
6. **`npm run agent:verify`.** One command, four gates, clear pass/fail.

Full reasoning in [DECISIONS.md](DECISIONS.md).

---

## Known application defects

The app deviates from the RealWorld spec in three places. Each is **pinned by a test
asserting current behaviour** and tagged `@known-issue`, rather than left as a
permanent red failure — a suite that is red by design has no signal.

| ID | Issue |
|---|---|
| CONDUIT-001 | Registration returns `404` instead of `422` on validation failure |
| CONDUIT-002 | `/editor` renders with no auth guard |
| CONDUIT-003 | `POST /articles` returns an empty `tagList` |

Root causes and reproduction steps: [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

---

## How flakiness is prevented

The app has properties that make naive tests flaky. Each is handled by design rather
than by retries:

| Hazard | Mitigation |
|---|---|
| `GET /articles` has no stable sort tiebreaker | Never assert list position; filter by a tag unique to each test |
| No database reset; SQLite persists across runs | Every test generates its own users/articles/tags — uniqueness *is* the isolation |
| Feeds render asynchronously after an XHR | Web-first assertions only; `waitForTimeout` is a lint error |
| Parallel workers writing to one SQLite file | Worker count measured, not guessed (see DECISIONS.md); no contention observed |
| Slugs contain a random suffix | Never derived — always taken from the API response |

Retries are enabled **on CI only** (`retries: 2`). Locally a flake should be visible
and fixed, not hidden.

---

## Troubleshooting the app under test

These are the failures I hit on Node 22 / macOS arm64 while building this. The app
dates from 2021 and its native dependencies predate current Node.

### `npm install` fails: `python: command not found` (sqlite3)

`sqlite3@5.0.2` has no prebuilt binary for modern Node and falls back to a source
build whose gyp action hardcodes `python` (not `python3`).

```bash
mkdir -p /tmp/py-shim && ln -sf "$(which python3)" /tmp/py-shim/python
PATH="/tmp/py-shim:$PATH" npm install
```

### `npm install` fails: `node-sass` build error

`node-sass@5` has no binding for Node 22. It is a **dead dependency** — the only
`.scss` import in the frontend is commented out — so its build can be skipped:

```bash
cd react-redux-realworld-example-app
npm install --ignore-scripts
```

### Frontend will not start: `ERR_OSSL_EVP_UNSUPPORTED`

`react-scripts@4` uses a hash algorithm removed from OpenSSL 3:

```bash
cd react-redux-realworld-example-app
NODE_OPTIONS=--openssl-legacy-provider PORT=4101 \
  REACT_APP_API_URL=http://localhost:3000 BROWSER=none \
  npx react-scripts start
```

### The UI directory is empty

The frontend is a git submodule:

```bash
git submodule update --init --recursive
```

### Tests fail immediately with a preflight error

That error is correct and means the app is not reachable. It prints the exact
commands to fix it. **Do not modify test code in response** — check both ports first:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/articles
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4101
```

---

## Configuration

All settings have working defaults; `.env` is optional.

| Variable | Default | Purpose |
|---|---|---|
| `API_BASE_URL` | `http://localhost:3000` | Backend root |
| `UI_BASE_URL` | `http://localhost:4101` | Frontend root |
| `API_PATH` | `/api` | API prefix |
| `TEST_USER_PASSWORD` | `Passw0rd!23` | Password for generated users |
| `API_TIMEOUT_MS` | `15000` | Per-request timeout |
| `UI_EXPECT_TIMEOUT_MS` | `10000` | Web-first assertion timeout |

`TEST_USER_PASSWORD` is not a secret — the app under test is a disposable local
sandbox. It lives in the environment so that no credential literal appears in test
code and so the suite can run against an environment with a stricter password policy.

---

## Requirements

- Node 18+ (built and verified on Node 22.14)
- Chromium via `npx playwright install chromium`
- The app under test running locally

## Further reading

- [DECISIONS.md](DECISIONS.md) — five architecture decisions, what was rejected, and what would flip each one
- [AI_USAGE.md](AI_USAGE.md) — how AI was used, and four things it got wrong that I caught
- [KNOWN_ISSUES.md](KNOWN_ISSUES.md) — application defects with root-cause analysis
- [CLAUDE.md](CLAUDE.md) — instructions for AI agents contributing to this repo
- `AGENT_MANIFEST.json` — generated index of every available helper
