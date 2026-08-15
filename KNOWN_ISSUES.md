# Known Issues in the Application Under Test

Defects found in the Conduit app while building this suite. The app is out of scope
for modification, so each one is **pinned by a test that asserts the current
behaviour** and tagged `@known-issue`.

Why pin a bug instead of asserting the correct behaviour and leaving the test red:
a permanently failing suite trains everyone — human and agent — to ignore failures.
A pinned test keeps the suite honest (green means "nothing changed") while the
deviation stays visible in the test name, in this file, and in the `@known-issue`
tag that can be excluded or isolated at will.

```bash
npx playwright test --grep @known-issue          # run only the pinned deviations
npx playwright test --grep-invert @known-issue   # run only spec-conformant behaviour
```

**Each pinned test fails loudly if the app is ever fixed.** That is intentional: the
failure is the signal to delete the workaround and restore the spec assertion.

---

## CONDUIT-001 — Registration returns 404 instead of 422 on validation failure

| | |
|---|---|
| **Severity** | High — breaks API contract and hides the real error from clients |
| **Endpoint** | `POST /api/users` |
| **Expected** (RealWorld spec) | `422 Unprocessable Entity` with `{"errors":{...}}` |
| **Actual** | `404 Not Found` with plain text `error: 404 Not Found /api/users` |
| **Pinned by** | `tests/api/registration-validation.spec.ts` (duplicate email, invalid username) |

### Root cause

`routes/api/users.js` catches the Sequelize validation error and calls `next()` with
no argument. In Express, a bare `next()` forwards to the *next route*, not to the
error handler — so the request falls through to the catch-all 404.

```js
.catch((error) => {
  console.error(error);
  next();          // should be next(error), or an explicit 422 response
});
```

### Impact on this suite

Every registration failure looks identical and carries no diagnostic information.
This is why `src/factories/identifiers.ts` generates usernames that are valid *by
construction* — a factory that emitted an invalid username would produce a
confusing 404 far from the actual cause.

### Reproduce

```bash
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{"user":{"username":"1leadingdigit","email":"a@b.test","password":"x"}}'
# HTTP/1.1 404 Not Found
```

---

## CONDUIT-002 — `/editor` renders with no authentication guard

| | |
|---|---|
| **Severity** | Low — cosmetic; the API still rejects the write |
| **Route** | `GET /editor` (frontend) |
| **Expected** | Anonymous visitor redirected to `/login` |
| **Actual** | The full article composer renders; publishing fails at the API layer |
| **Pinned by** | Not pinned — documented only (see note) |

### Note

No test asserts this. Writing one would lock in behaviour that is arguably wrong,
and the user-visible consequence (a failed publish) is already covered by the API's
401 handling. It is recorded here because it invalidates the obvious
"protected route redirects when logged out" test that a contributor — human or
agent — would otherwise expect to write and then be confused when it fails.

---

## CONDUIT-003 — Article create response omits `tagList`

| | |
|---|---|
| **Severity** | Medium — clients that trust the create response show no tags until a refetch |
| **Endpoint** | `POST /api/articles` |
| **Expected** | `tagList` reflecting the tags just submitted |
| **Actual** | `tagList: []` — always, not intermittently |
| **Pinned by** | `tests/api/article-lifecycle.spec.ts` → `@known-issue omits tagList from the create response` |

### Root cause

`setArticleTags()` in `routes/api/articles.js` returns a promise chain whose inner
`findAll(...).then(...)` is never awaited:

```js
return Tag.bulkCreate(...).then(tags => {
  Tag.findAll({...}).then(tags => {   // not returned — the outer promise
    return article.setTags(tags)       // resolves before this completes
  })
})
```

The route awaits the outer promise, which resolves before the association is
written, so the response is serialised without tags. The write itself completes
shortly after, which is why every subsequent `GET` shows the tags correctly.

### Verified

5 consecutive creates returned `tagList: []` while all 5 tags were queryable via
`GET /api/articles?tag=...` immediately afterwards. Deterministic, not a race.

### Impact on this suite

`ArticleFactory.createTaggedArticle()` re-reads the article after creation so
callers receive an accurate representation. **Remove that extra read once this is
fixed** — the pinned test will start failing and point here.

---

## Non-issues (verified, working correctly)

Checked because they are common failure areas; confirmed sound and left untested
or covered by ordinary assertions rather than `@known-issue` pins.

| Behaviour | Result |
|---|---|
| Cross-user article update / delete | Correctly returns `403` |
| Cross-user comment delete | Correctly returns `403` |
| Unauthenticated `/api/articles/feed` | Correctly returns `401` |
| Repeated favourite | Idempotent — count stays at 1 |
| Login with blank password | Correctly returns `422` with a field error |
| Login with wrong password | Returns `422` with a combined `email or password` error, so it does not disclose which field was wrong |
| Pagination (`limit` / `offset`) | Correct, non-overlapping pages |
| `username` / `email` lowercasing | Applied consistently by the model setters |

### A note on a boundary case that turned out not to exist

`Article.description` and `Article.body` are declared as `DataTypes.STRING`, which
maps to `VARCHAR(255)`. An obvious boundary test is "reject or truncate a body over
255 characters". It was measured before being written: a 300-character body is
stored and returned **intact**, because SQLite does not enforce `VARCHAR` length.

The test was dropped rather than written against an assumption. The real validation
on that field — the `NOT NULL` constraint — does work and returns a correct `422`.
