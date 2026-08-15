import { test as base, expect, request as playwrightRequest } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

import { ConduitApiClient, parseErrors } from '../api/conduit-client'
import { env } from '../config/env'
import {
  buildArticlePayload,
  buildCommentPayload,
  buildUserPayload,
} from '../factories/builders'
import { uniqueEmail, uniqueTag, uniqueToken, uniqueUsername } from '../factories/identifiers'
import { ActorFactory, ArticleFactory, type Actor } from './actors'
import {
  ArticlePage,
  EditorPage,
  HomePage,
  LoginPage,
  RegisterPage,
} from '../pages'

/**
 * The single entry point for every test in this repository.
 *
 *   import { test, expect } from '@src/fixtures/test'
 *
 * Everything a test can legitimately need is reachable by destructuring the
 * fixture argument. This is the core of the agentic design: an agent writing a
 * new test does not have to discover which helper lives in which module, because
 * there is exactly one import and the type system enumerates the options.
 * The `require-framework-imports` ESLint rule enforces that specs import from
 * here and nowhere else.
 */

export interface ConduitFixtures {
  /** Typed API client bound to a request context that carries no auth by default. */
  api: ConduitApiClient
  /** Creates fresh, isolated users on demand. */
  users: ActorFactory
  /** Creates articles owned by a given user. */
  articles: ArticleFactory
  /**
   * A pre-registered, authenticated user.
   *
   * Use this when a test needs "some logged-in user" and does not care about the
   * identity. Create additional users through `users` when a test needs two
   * distinct actors (for example, authorisation tests).
   */
  actor: Actor
  /** Page objects, pre-bound to the active page. */
  pages: {
    home: HomePage
    login: LoginPage
    register: RegisterPage
    editor: EditorPage
    /** Article view for a specific slug — the slug must come from the API. */
    article: (slug: string) => ArticlePage
  }
  /**
   * Signs the given actor into the browser by seeding the JWT the way the app does.
   *
   * The React client reads `localStorage.jwt` on boot, so seeding it is equivalent
   * to a successful UI login but costs one navigation instead of a full form
   * round-trip. UI tests that are not specifically testing the login form should
   * use this to keep their assertions focused on the behaviour under test.
   */
  loginAs: (actor: Actor) => Promise<void>
}

export const test = base.extend<ConduitFixtures>({
  api: async ({ playwright: _playwright }, use) => {
    const context: APIRequestContext = await playwrightRequest.newContext({
      baseURL: env.apiBaseUrl,
    })
    await use(new ConduitApiClient(context))
    await context.dispose()
  },

  users: async ({ api }, use) => {
    await use(new ActorFactory(api))
  },

  articles: async ({ api }, use) => {
    await use(new ArticleFactory(api))
  },

  actor: async ({ users }, use) => {
    const created = await users.createUser()
    await use(created)
  },

  pages: async ({ page }, use) => {
    await use({
      home: new HomePage(page),
      login: new LoginPage(page),
      register: new RegisterPage(page),
      editor: new EditorPage(page),
      article: (slug: string) => new ArticlePage(page, slug),
    })
  },

  loginAs: async ({ page }, use) => {
    await use(async (actor: Actor) => {
      await seedAuthToken(page, actor.token)
    })
  },
})

/**
 * Writes the JWT into localStorage under the key the app's middleware reads.
 *
 * A navigation to the app origin has to happen first, because localStorage is
 * origin-scoped and is not available on `about:blank`. The reload afterwards lets
 * the React app boot with the token already present.
 */
async function seedAuthToken(page: Page, token: string): Promise<void> {
  if (!page.url().startsWith(env.uiBaseUrl)) {
    await page.goto(env.uiBaseUrl)
  }
  await page.evaluate((value) => window.localStorage.setItem('jwt', value), token)
  await page.reload()
}

export { expect }
export type { Actor }

/**
 * Re-exported helpers.
 *
 * Specs are restricted to importing from this module (enforced by the
 * `require-framework-imports` rule), so anything a test legitimately needs must
 * be reachable from here. Re-exporting keeps that single-entry-point promise
 * true without forcing every helper to become a fixture.
 */
export {
  buildArticlePayload,
  buildCommentPayload,
  buildUserPayload,
  parseErrors,
  uniqueEmail,
  uniqueTag,
  uniqueToken,
  uniqueUsername,
}
