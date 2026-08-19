# AI Usage

## Summary

**This framework was built with Claude doing the implementation,
and me directing, correcting and improving it throughout.** It ran against a live
local instance of the app the entire time.

- **I refused to let it write code first.** The opening prompt explicitly blocked
  implementation until the app had been analysed and an approach proposed and
  approved. That reconnaissance phase is where all three application defects were
  found — before a single test existed.
- **I corrected it when it was wrong.** Five times, documented below with the
  evidence — including one case where a well-reasoned inference from the source code
  was flatly wrong about runtime behaviour, and would have shipped as a confident,
  passing-looking test.
- **I improved the prompts as the work progressed** — tightening scope when it drifted
  toward the app under test, forcing step-by-step reporting so the output stayed
  reviewable, and blocking an irreversible action (a `git push` to the wrong account).
- **I rejected its output**, including the first draft of *this document*, which
  overstated my hands-on role.

The skill on display is not typing speed. It is directing an AI toward a defensible
engineering artefact and knowing when its output is wrong — which is harder than
either writing it alone or accepting whatever the model emits first.

**The bar I held throughout: I can explain and defend every file in this repo.**

---

## The prompting approach

I treated the prompt as the design document. The opening instruction was written
before any tooling was touched, and it constrained the entire build.

### Prompt 1 — role, staged decomposition, and a hard stop on code

> Act as a **Staff/Principal-level Automation Engineer with 20+ years** of experience
> in QA automation, test architecture, CI/CD, API/UI automation, and AI-assisted
> testing.
>
> **First understand the complete assignment and identify the actual business
> requirements. Do not immediately start writing code.** Break the assignment into:
> Requirements · Test scenarios · Automation scope · Framework architecture · Test
> data strategy · Page/API/component abstraction · Assertions and validations ·
> Negative and edge cases · Reporting · CI/CD considerations.
>
> Identify anything ambiguous and **state reasonable assumptions instead of silently
> making them.**
>
> Think like a Senior/Staff QA Engineer. **Don't automate everything blindly.**
> Clearly explain: why each scenario is automated · what should remain manual ·
> what could potentially become flaky · how the framework prevents flaky tests.
>
> For every major implementation decision, give me:
> **Decision → Reason → Alternative considered → Why this approach was selected.**
>
> The final solution should look like something an experienced automation engineer
> would realistically design — **not an unnecessarily complicated framework created
> only to demonstrate technical knowledge.**
>
> **Important: Do not pretend that I implemented something I cannot explain.** Keep
> the implementation at a level where I can understand and defend every part of it.
>
> **I will now provide the assignment. First analyze the requirements and propose the
> automation approach. Do not write the complete code until the approach is approved.**

**Techniques used, and what each one bought:**

| Technique | Clause | Effect on the output |
|---|---|---|
| **Role + seniority anchoring** | "Staff/Principal... 20+ years" | Raised the default from "working test script" to "framework with trade-offs" |
| **Explicit code embargo** | "Do not immediately start writing code" | Forced reconnaissance first — which is where all three app defects were found |
| **Staged decomposition** | The 11-item breakdown | Prevented jumping straight to specs and skipping data strategy and flake analysis |
| **Ambiguity surfacing** | "state assumptions instead of silently making them" | Assumptions became documented decisions instead of hidden choices |
| **Negative constraint** | "don't automate everything blindly" | Produced an explicit *out-of-scope* list, not just coverage |
| **Structured output contract** | "Decision → Reason → Alternative → Why" | Became the literal shape of DECISIONS.md |
| **Anti-over-engineering guard** | "not unnecessarily complicated... only to demonstrate technical knowledge" | No BDD layer, no custom reporter, no DI container |
| **Defensibility clause** | "do not pretend I implemented something I cannot explain" | The strongest constraint in the prompt — it is why I rejected work mid-build (§7) |
| **Approval gate** | "do not write the complete code until the approach is approved" | I reviewed a 9-point recon table and killed two proposed tests *before* they were written |

The **approval gate** and the **defensibility clause** did the most work. Without the
gate, code would have been generated on top of the assignment's own faulty setup
instructions. Without the defensibility clause, the suite would have been larger and
I would have been able to explain less of it.

### Prompt 2 — approval, then scope control

Once the approach came back, I approved it (*"do this"*) and then kept the scope
pinned as the build progressed:

> **"I need just the framework only, what they are asking from me — testing framework,
> and take the app they mentioned."**

This mattered because a build like this drifts naturally toward "also improve the
app". The app under test stays unmodified and out of the deliverable.

### Prompt 3 — forcing incremental review

> **"Tell me what you are doing after each step."**

A single large dump is unreviewable, and unreviewable output is exactly how you end
up unable to defend your own submission. This converted the build into reviewable
increments — which is also how the nav-locator and lint false-positive issues got
caught and discussed rather than silently patched.

### Prompt 4 — blocking an irreversible action

> **"Don't push it."**

Combined with my catching that `gh` was authenticated to my **work** account rather
than my personal one, no repository was published. The submission stays local until
I decide where it goes.

### Prompt 5 — rejecting the first draft of this document

The first version of AI_USAGE.md was written as though I had personally typed every
`curl` command and caught each error unaided. I sent it back:

> **"Honestly explain how AI was used while building this assignment"** — and then,
> on the follow-up: mention the prompts, and reflect that **I improved the prompts and
> guided the AI**.

I rejected an AI-written document *about AI usage* because it overstated my hands-on
role. That is precisely the claim an interviewer would test first, and the honest
version is the stronger one.

---

## How I steered it during the build

| My instruction | Effect |
|---|---|
| Analyse the approach and **wait for approval** | 9-point recon table reviewed first; two proposed tests dropped before being written |
| *"Just the framework, take the app they mentioned"* | Scope creep stopped; app under test unmodified |
| *"Don't push it"* | Nothing published; work stays local |
| Caught that `gh` was on my **work** account | Wrong-account publish avoided |
| *"Tell me what you're doing after each step"* | Incremental review instead of an unreviewable dump |
| Sent this document back for honesty | Rewritten to describe what actually happened |

---

## The rule that made the output trustworthy

> **AI proposes, the running application decides.**

No assertion in this suite rests on what the model believed the API *should* do.
Every behavioural claim was executed against `localhost:3000` before being encoded.

This was not a formality. §2 below is a case where a well-reasoned inference from the
source code was flatly wrong about runtime behaviour — and would have shipped as a
confident, passing-looking test.

The loop, repeated throughout:

1. Read the actual app source; form a hypothesis
2. **Verify with `curl` against the running app**
3. Encode only what was observed
4. Run the suite; when something failed, diagnose before changing anything
5. Fix the root cause in the correct layer — never the symptom in the spec

---

## 1. Reconnaissance before any code

Because I blocked code generation up front, the session started by cloning the app
and reading `routes/`, `models/`, and `config/` — including the assignment's own
setup instructions, which turned out to be incomplete.

Nine findings came out of that. Eight survived verification. The consequential ones:

- `POST /api/users` calls a bare `next()` on validation failure → returns **404, not
  the spec's 422** (CONDUIT-001)
- Username must match `/^[A-Za-z][A-Za-z0-9-_]+$/` — a naive `uuid` factory produces
  a leading digit and fails as an opaque 404
- Slugs get a random base-36 suffix → **never derivable client-side**
- `GET /articles` sorts by `createdAt DESC` with **no tiebreaker** → any
  list-position assertion is inherently racy under parallel execution
- The frontend is a **git submodule** on port 4101; the assignment's `npm start` runs
  only the backend

The last one means the brief's own setup steps produce a broken environment. That is
documented in the README with the fix.

**These findings drove the architecture.** Uniqueness-as-isolation and
valid-by-construction factories both exist because of what reconnaissance revealed —
not because they are common patterns.

---

## 2. Wrong #1: a boundary test for a limit that does not exist

**The proposal.** `models/article.js` declares `body` as `DataTypes.STRING` →
`VARCHAR(255)`. Suggested test: submit a 300-character body, assert rejection or
truncation.

Reasonable. Also wrong.

**Caught by measuring instead of trusting:**

```bash
BIG=$(node -e "console.log('x'.repeat(300))")
curl -s -X POST $API/articles -H "Authorization: Token $TOKEN" \
  -d "{\"article\":{\"title\":\"Boundary Test\",\"description\":\"d\",\"body\":\"$BIG\"}}"
# → 200 OK
curl -s "$API/articles?limit=1" | jq '.articles[0].body | length'
# → 300
```

**Why it was wrong.** SQLite does not enforce `VARCHAR` length. The Sequelize type
declares *intent*; the storage engine ignores it. The inference is correct for
Postgres — which this app uses in production mode — and wrong for the SQLite path the
tests actually run against.

**Outcome.** Test dropped, reasoning recorded in `KNOWN_ISSUES.md` so nobody
re-derives it. The field's real validation (`NOT NULL` → correct 422) is covered.

**Why this is the most instructive failure here:** the reasoning chain looked sound
and would have passed code review. Only execution caught it. This is exactly why the
verify-first rule exists.

**In my own words, since I made the call on what to do with it:** My first instinct
here was to write the boundary test as proposed — a 300-char body against a
`VARCHAR(255)` column is the textbook boundary case, and it's the kind of test I'd
add on reflex in any Sequelize-backed API. I rejected that plan the moment I ran the
`curl` above and saw `200 OK` with the full 300 characters stored intact — not
truncated, not rejected. The mechanism is specific: SQLite has no native `VARCHAR(n)`
length enforcement, it's a type-affinity database, so Sequelize's `DataTypes.STRING`
declaration is metadata the ORM understands but the storage engine silently ignores.
The same test would correctly fail on Postgres, which is what this app actually runs
in production — so the inference wasn't wrong in general, it was wrong for the
runtime I was testing against. Instead of shipping a test that encodes a limit the
database doesn't enforce, I dropped it and wrote up the mechanism in
`KNOWN_ISSUES.md` so the next person doesn't re-derive it and waste the same cycle.
The trade-off I accepted is a real coverage gap: there's no upper-bound test on
article body length, because there's genuinely nothing there to test against SQLite.
The measurable part is small but concrete — one `curl` call and one `jq` query
(`.articles[0].body | length` → `300`) were enough to disprove a boundary that looked
correct from reading the model definition alone.

---

## 3. Wrong #2: a hallucinated method

While writing `tests/ui/authentication.spec.ts`:

```ts
await expect(page).toHaveURL(new RegExp(`${escapeForRegExp(pages.home.baseUrl)}/?$`))
```

`pages.home.baseUrl` **did not exist**. This is the canonical agentic failure —
inventing a plausible-sounding accessor — and it happened in the very session that
was building guardrails against it.

`tsc --noEmit` caught it immediately, with an exact location. That is the framework
doing its job on its own author.

**The fix went into the framework, not the spec.** Importing `env.uiBaseUrl` directly
would have compiled and made the error vanish — but the underlying need was real: a
spec must assert on navigation without hardcoding a URL, which the
`no-hardcoded-test-data` rule forbids. So `BasePage` gained a `baseUrl` accessor.

I chose the framework fix over the quick one because the hallucination pointed at a
genuine gap in the surface.

---

## 4. Wrong #3: my own lint rule had a false positive

The `no-hardcoded-test-data` rule flagged this line:

```ts
expect(Object.keys(errors)).toContain('password')
```

Here `'password'` is a **field name being asserted on**, not a credential. The rule
was matching the string in isolation, ignoring how it was used.

**Why I insisted on fixing it rather than suppressing it.** An `eslint-disable`
comment was one line and would have worked — and would have quietly taught every
future contributor that the rule is noise. A guardrail that cries wolf gets switched
off, and a switched-off rule protects nothing.

**The fix** — an AST check so the rule fires only when a credential-shaped literal is
actually *assigned to* a credential field:

```js
// fires on:  { password: 'literal' }  and  const password = 'literal'
// silent on: toContain('password')
function isCredentialValue(node) { /* inspects node.parent */ }
```

**Verified in both directions** with a throwaway probe file:

```
5:20  error  Hardcoded credential-like literal "Passw0rd!23"   ← still caught
7:46  error  Hardcoded credential-like literal "secret123"     ← still caught
      (no error on the toContain('password') assertion)        ← false positive gone
```

---

## 5. Wrong #4: assuming accessible name equals visible text

Two UI tests failed on `pages.home.navLink(actor.username)`. The link was visibly on
the page, so the locator was wrong — not the app.

**Root cause, found by dumping the real DOM instead of guessing again:**

```html
<a href="/@navprobe..."><img alt="navprobe...">navprobe...</a>
```

The avatar's `alt` repeats the username, so the accessible name computes to
`"navprobe... navprobe..."` — twice over. `{ name, exact: true }` could never match.
Separately, `New Post` and `Settings` carry an icon plus `&nbsp;`, making their
accessible names `" New Post"` and `" Settings"`.

**Fixed once in `BasePage.navLink()`** with the quirk documented inline — not patched
in each failing spec. One page-object change fixed both tests and every future one.

---

## 6. A test bug the guardrails did *not* catch

Included because it marks a real limit of the tooling.

A test hardcoded `username: 'MixedCaseUser'`. It passed on the first run and failed on
the second — the database is never reset, the username was already taken, and thanks
to CONDUIT-001 the failure surfaced as an opaque 404.

The lint rule missed it because the literal is not email- or URL-shaped. **The first
run passing is what makes this class of bug dangerous**: it looks correct exactly once.

Fixed by making the value unique per run. Documented here rather than quietly patched,
because it shows where the rules stop.

---

## 7. What I rejected

Things I turned down or sent back during the build:

- **The VARCHAR boundary test** (§2) — dropped once measurement contradicted it.
- **Suppressing my own lint rule** (§4) — fixed the rule instead.
- **A "protected route redirects when logged out" UI test** — probing showed
  `/editor` renders fine when logged out (CONDUIT-002). The test would have asserted
  behaviour the app does not have.
- **Claiming a tuned worker count.** The measurements (1w=10.6s, 2w=8.8s, 4w=10.6s,
  8w=6.1s) are noisy and show no SQLite contention. DECISIONS.md says exactly that
  rather than inventing an optimum I cannot defend.
- **The first draft of this document**, which implied a more hands-on role than I had.
- **Publishing the repo.** `gh` was authenticated to my work account; I stopped the
  push rather than put an interview take-home in the wrong place.

---

## 8. Where AI genuinely earned its place

Being fair about the value, since the failures above are the more interesting part:

- **Reconnaissance at speed.** Four route files and three models read and converted
  into behavioural implications in minutes. Eight of nine findings correct.
- **Bug discovery.** CONDUIT-003 (empty `tagList` on create) was found by spotting a
  broken promise chain in `setArticleTags` — then **confirmed empirically**: 5/5
  creates returned `[]` while all 5 tags persisted. Deterministic, not a race.
- **Repetitive, exacting code.** The ~250-line typed API client is
  request/parse/validate repetition where consistency matters more than creativity.
- **ESLint AST plumbing.** I specified each rule's intent; generation handled the
  visitor boilerplate. All six were then verified against a deliberately bad file —
  all six fired with actionable messages.
- **Environment archaeology.** Three separate 2021-era build failures (sqlite3
  needing `python`, dead `node-sass`, OpenSSL 3 vs `react-scripts@4`) diagnosed and
  worked around **without modifying the app**, all documented in the README.

---

## 9. Decisions I made, not the model

These are judgement calls and I own them:

- **What to automate and what to leave manual.** Authorisation gets deep coverage
  because it fails *silently* in production. Visual regression is excluded — high
  maintenance, low signal on a static Bootstrap template.
- **Pinning bugs instead of failing on them.** A permanently red suite trains people
  to ignore failures. That is a call about team behaviour over time (DECISIONS.md D3).
- **Uniqueness as the isolation model.** Follows from a discovered constraint — no
  reset hook, persistent SQLite — not from a familiar pattern.
- **Keeping the framework small.** No BDD layer, no custom reporter, no dependency
  injection container. Every abstraction present earns its place.

---

## Verification log

Every command below was run against the live app, and each one changed something:

| Check | Result | Consequence |
|---|---|---|
| Duplicate email registration | `404` + plain text | CONDUIT-001; pinned test |
| Username with leading digit | `404` | Factories generate valid usernames by construction |
| Mixed-case username/email | Lowercased | Assert against server-returned values |
| Same title twice | Distinct random slug suffixes | Slug never derived client-side |
| `Token` vs `Bearer` header | Both `200` | Client uses `Token` |
| Unauthenticated `/feed` | `401` | Negative test |
| 300-char article body | Stored intact | **Planned boundary test dropped** (§2) |
| Article missing `body` | `422` with field error | Validation test |
| Cross-user update / delete | `403`, data unchanged | Authorisation tests |
| Favourite twice | Count stays `1` | Idempotency test |
| Create article with tag | `tagList: []`, 5/5 times | CONDUIT-003; factory re-reads |
| `?tag=<unique>` filter | Exactly 1 result | Foundation of the anti-flake strategy |
| Home feed read immediately | Empty, then populated | Async render → web-first assertions only |
| Suite at 1/2/4/8 workers | 10.6 / 8.8 / 10.6 / 6.1 s | No contention; 4 chosen, caveat stated |

---

## If you are evaluating this submission

Ask me about any file. The questions I would ask are probably:

- Why uniqueness instead of database cleanup — and when that would be the wrong call
- Why the `api` / `api.raw` split exists in the client
- Why `@known-issue` tests assert wrong behaviour on purpose
- What the six lint rules cost, and which one I would drop first
- What the worker measurements actually show — and why I did not claim more
