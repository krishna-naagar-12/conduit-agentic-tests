# Instructions for AI Agents

Read this before writing or modifying any test in this repository.

This file is loaded automatically by Claude Code. Other agents should be pointed at
it explicitly. It is intentionally short — the binding constraints are enforced by
lint and types, not by this document. If instructions here ever contradict
`npm run agent:verify`, **the tooling is correct**.

---

## The one command that matters

```bash
npm run agent:verify
```

Run it before declaring any change complete. It runs, cheapest first:

1. `tsc --noEmit` — catches calls to helpers that do not exist
2. `eslint` — catches sleeps, raw locators, hardcoded data, weak assertions
3. `manifest:check` — catches `src/` changes not published to `AGENT_MANIFEST.json`
4. `@smoke` tests — proves the suite still runs against the real app

The smoke gate is non-blocking so the static gates stay useful when the app is not
running.

---

## Before you start

**The app under test must already be running.** This repo does not start it.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/articles  # expect 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4101               # expect 200
```

If either fails, the app is down — **this is not a test bug**. See the README for
startup instructions. Do not "fix" test code in response to a connection error.

---

## Writing a test

**One import. Always.**

```ts
import { test, expect } from '@src/fixtures/test'
```

Importing from `@playwright/test` directly is a lint error: it silently opts your
spec out of every fixture in the framework.

**Everything available to you is in `AGENT_MANIFEST.json`.** It is generated from
the TypeScript AST, so it is never stale. If a method is not listed there, it does
not exist — add it to `src/` deliberately rather than inventing a call site.

Available fixtures:

| Fixture | Use for |
|---|---|
| `api` | Typed API calls. Returns validated data, throws on non-2xx |
| `api.raw` | Negative tests where the status code *is* the assertion |
| `users` | `users.createUser()` — a fresh, isolated, authenticated user |
| `articles` | `articles.createArticle(actor)` / `createTaggedArticle(actor)` |
| `actor` | A ready-made authenticated user when identity does not matter |
| `pages` | Page objects: `home`, `login`, `register`, `editor`, `article(slug)` |
| `loginAs` | Seeds the JWT so a UI test skips the login form |

**Title format** — a primary tag is required and must match the directory:

```ts
test('@api @smoke creates an article', async ({ actor, articles }) => { ... })
test('@ui @negative rejects a wrong password', async ({ pages }) => { ... })
```

Tags: `@api` `@ui` (one required) · `@smoke` `@regression` `@negative`
`@known-issue` (optional).

---

## Rules that will fail your change

These are lint errors, not preferences. Each exists because it is a mistake agents
reliably make.

| Do not | Do instead |
|---|---|
| `page.waitForTimeout(2000)` | `await expect(locator).toBeVisible()` — retries automatically |
| `page.locator('.card')` in a spec | Add a getter to the relevant page object in `src/pages/` |
| `'test@example.com'` | `users.createUser()` — the database is never reset, fixed values collide |
| `expect(x).toBeTruthy()` | `expect(x).toBe(expected)` — assert the actual value |
| `expect(loc).toBeVisible()` without `await` | `await expect(loc).toBeVisible()` — otherwise it never runs |
| `import { test } from '@playwright/test'` | `import { test, expect } from '@src/fixtures/test'` |

---

## Facts about this app that will mislead you

Verified against a running instance. Assumptions here cost real debugging time.

- **Slugs are unpredictable.** The server appends a random base-36 suffix to the
  slugified title. Never construct a slug — always use the one the API returned.
- **Feed order is not stable.** `GET /api/articles` sorts by `createdAt DESC` with no
  tiebreaker. Never assert "my article is first". Filter by a tag unique to your
  test: `api.listArticles({ tag })`.
- **`username` and `email` are lowercased** by model setters. Compare against the
  value the server returned, not the one you sent.
- **Registration fails with `404`, not `422`.** A bare `next()` in the route sends
  validation failures to the catch-all handler. An invalid username or a duplicate
  email produces an opaque 404 (CONDUIT-001).
- **`POST /articles` returns `tagList: []`** even when tags were supplied and
  persisted. Re-read the article to see them (CONDUIT-003).
- **`/editor` renders when logged out.** There is no client-side route guard
  (CONDUIT-002). Do not write a redirect test for it.
- **The UI renders feeds asynchronously.** Reading the DOM immediately after
  navigation returns an empty feed. Always assert with `expect()`, which retries.

---

## If a test fails

Work through this in order. Do not skip to the last step.

1. **Is the app running?** Check both ports. A connection error is an environment
   problem, not a test problem.
2. **Is it a known issue?** Check `KNOWN_ISSUES.md` and look for `@known-issue` in
   the test name. **A pinned test that starts failing usually means the app was
   fixed** — the correct response is to restore the spec assertion and remove the
   workaround, not to make the test pass again.
3. **Is the locator wrong?** Dump the real markup before guessing. Accessible names
   frequently differ from visible text — the nav profile link resolves to
   `"username username"` because the avatar's `alt` repeats it.
4. **Is it a real regression?** Then the test is doing its job. Report it; do not
   weaken the assertion to make it pass.

**Never** make a test pass by deleting an assertion, adding a sleep, or loosening a
matcher to `toBeTruthy()`. If a test is genuinely wrong, fix its logic and explain
why in the change.

---

## Adding to the framework

Changing `src/`? Regenerate the manifest, or `agent:verify` will fail:

```bash
npm run manifest:generate
```

- New selector → a page object in `src/pages/`, never a spec
- New API endpoint → a method on `ConduitApiClient` **and** a Zod contract
- New data shape → a builder in `src/factories/builders.ts`
- New app defect discovered → pin it with a test and document it in `KNOWN_ISSUES.md`
