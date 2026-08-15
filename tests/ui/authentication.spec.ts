import { test, expect, buildUserPayload } from '@src/fixtures/test'

/**
 * Authentication through the real UI.
 *
 * These are the tests that justify driving a browser at all: the signup and login
 * forms are the one place where the UI holds logic the API cannot verify —
 * form wiring, redirect behaviour, and the header switching to its signed-in state.
 *
 * Everything else in the UI suite seeds auth via `loginAs` instead of retyping
 * these forms, because re-testing login inside every other test buys nothing and
 * costs a page load each time.
 */
test.describe('Authentication UI', () => {
  test('@ui @smoke registers a new account and lands signed in', async ({ pages, page }) => {
    const user = buildUserPayload()

    await pages.register.goto()
    await pages.register.register(user.username, user.email, user.password)

    // Successful signup redirects to the home feed.
    await expect(page).toHaveURL(new RegExp(`${escapeForRegExp(pages.home.baseUrl)}/?$`))

    // The header is the app's signed-in indicator: these links only render for
    // an authenticated user.
    await expect(pages.home.navLink('New Post')).toBeVisible()
    await expect(pages.home.navLink(user.username.toLowerCase())).toBeVisible()
  })

  test('@ui @smoke signs in an existing account through the login form', async ({
    actor,
    pages,
    page,
  }) => {
    // The account is created over the API — this test is about the login form,
    // not about registration.
    await pages.login.goto()
    await pages.login.login(actor.email, actor.password)

    await expect(page).toHaveURL(new RegExp(`${escapeForRegExp(pages.home.baseUrl)}/?$`))
    await expect(pages.home.navLink(actor.username)).toBeVisible()
  })

  test('@ui @negative shows an error and stays on the form for a wrong password', async ({
    actor,
    pages,
    page,
  }) => {
    await pages.login.goto()
    await pages.login.login(actor.email, `${actor.password}-wrong`)

    // The user must not be let in, and must be told why.
    await expect(pages.login.errorMessages.first()).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await expect(pages.home.navLink('Sign in')).toBeVisible()
  })
})

/** Escapes a URL for safe embedding in a RegExp. */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
