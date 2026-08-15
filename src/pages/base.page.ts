import type { Page } from '@playwright/test'

import { env } from '../config/env'

/**
 * Shared behaviour for every page object.
 *
 * Locator policy for this whole directory: the app under test ships no test ids
 * and cannot be modified, so locators are built from user-visible semantics —
 * roles, labels and placeholders — in that order of preference. CSS structure
 * selectors are a last resort and are commented where used.
 *
 * There are no explicit sleeps anywhere in this layer. Playwright's web-first
 * assertions and auto-waiting handle synchronisation; `waitForTimeout` is banned
 * by the `no-hard-waits` ESLint rule.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Path this page lives at, relative to the UI root, e.g. "/login". */
  protected abstract readonly path: string

  /**
   * Root URL of the application under test.
   *
   * Exposed so specs can assert on navigation without hardcoding a URL —
   * the `no-hardcoded-test-data` rule rejects literal URLs in tests.
   */
  get baseUrl(): string {
    return env.uiBaseUrl
  }

  async goto(): Promise<void> {
    await this.page.goto(`${env.uiBaseUrl}${this.path}`)
  }

  /**
   * The site header, which doubles as the app's authentication indicator:
   * logged-out users see "Sign in", logged-in users see "New Post" and their username.
   */
  get navBar() {
    return this.page.locator('nav.navbar')
  }

  /**
   * A header link, matched on visible text.
   *
   * Deliberately not an exact match. Two quirks in the app's markup make exact
   * matching fail:
   *   - "New Post" and "Settings" are prefixed with an icon and a non-breaking
   *     space, so their accessible name is " New Post", not "New Post".
   *   - The profile link contains an avatar whose alt text repeats the username,
   *     so its accessible name computes to "username username".
   *
   * Substring matching against the link text is stable across both.
   */
  navLink(name: string) {
    return this.navBar.getByRole('link', { name }).first()
  }
}
