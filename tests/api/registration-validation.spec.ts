import { test, expect, buildUserPayload, parseErrors } from '@src/fixtures/test'

/**
 * Registration and login validation.
 *
 * These tests assert what the application *actually does*, which in one case is
 * not what the RealWorld specification says it should do. The deviation is
 * recorded in KNOWN_ISSUES.md and tagged @known-issue so it can be excluded from
 * a "spec conformance" run and re-examined when the app is fixed.
 *
 * The alternative — asserting the spec and shipping a red suite — was rejected:
 * a permanently failing test trains everyone to ignore failures. See DECISIONS.md (D5).
 */
test.describe('Registration validation', () => {
  test('@api @smoke registers a new user and returns a usable token', async ({ users, api }) => {
    const created = await users.createUser()

    // The token must actually work, not merely be present in the response.
    const current = await api.currentUser(created.token)
    expect(current.username).toBe(created.username)
    expect(current.email).toBe(created.email)
  })

  test('@api @regression lowercases username and email on registration', async ({ users }) => {
    // The model has setters that force both fields to lowercase. Any test that
    // compares a mixed-case input against the stored value must account for this.
    //
    // The mixed-case value must still be unique per run: the database is never
    // reset, and a duplicate username fails as an opaque 404 (CONDUIT-001).
    const mixedCase = `MixedCase${Date.now().toString(36)}`
    const created = await users.createUser({ username: mixedCase })

    expect(created.username).toBe(mixedCase.toLowerCase())
    expect(created.email).toBe(created.email.toLowerCase())
  })

  test('@api @negative @known-issue rejects a duplicate email with 404 instead of 422 (CONDUIT-001)', async ({
    users,
    api,
  }) => {
    const existing = await users.createUser()

    const response = await api.raw.register({
      username: `dup${Date.now().toString(36)}`,
      email: existing.email,
      password: existing.password,
    })

    // Documented deviation: POST /api/users catches the Sequelize uniqueness error
    // and calls next() with no argument, so the request falls through to the
    // catch-all 404 handler and returns plain text instead of a 422 JSON body.
    //
    // Correct behaviour per the RealWorld spec would be:
    //   expect(response.status()).toBe(422)
    //
    // See KNOWN_ISSUES.md — CONDUIT-001.
    expect(response.status()).toBe(404)
    expect(await response.text()).toContain('404 Not Found')

    // The important guarantee still holds: the duplicate was not created.
    // A second registration attempt failing means the first account is intact.
    const stillValid = await api.login(existing.email, existing.password)
    expect(stillValid.username).toBe(existing.username)
  })

  test('@api @negative @known-issue rejects an invalid username with 404 instead of 422 (CONDUIT-001)', async ({
    api,
  }) => {
    // The username model requires /^[A-Za-z][A-Za-z0-9-_]+$/ — a leading digit is invalid.
    // Everything except the username stays valid so the username is the only cause.
    const response = await api.raw.register(buildUserPayload({ username: '1leadingdigit' }))

    // Same swallowed-validation defect as the duplicate-email case.
    expect(response.status()).toBe(404)
  })
})

test.describe('Login validation', () => {
  test('@api @negative returns 422 with a field error when the password is blank', async ({
    users,
    api,
  }) => {
    const existing = await users.createUser()

    const response = await api.raw.login(existing.email, '')

    // This path is validated explicitly in the route handler before Passport runs,
    // which is why it returns a correct 422 while registration does not.
    expect(response.status()).toBe(422)
    const errors = await parseErrors(response)
    expect(Object.keys(errors)).toContain('password')
  })

  test('@api @negative rejects a wrong password without revealing which field failed', async ({
    users,
    api,
  }) => {
    const existing = await users.createUser()

    const response = await api.raw.login(existing.email, `${existing.password}-wrong`)

    expect(response.status()).toBe(422)
    // The app reports a combined "email or password" error rather than telling an
    // attacker which half was wrong. Asserting this locks in the safer behaviour.
    const errors = await parseErrors(response)
    expect(Object.keys(errors).join()).toContain('email or password')
  })
})
