import type { APIRequestContext, APIResponse } from '@playwright/test'
import { z } from 'zod'

import { apiRoot, env } from '../config/env'
import {
  articleResponseSchema,
  articlesResponseSchema,
  commentResponseSchema,
  commentsResponseSchema,
  errorResponseSchema,
  profileResponseSchema,
  userResponseSchema,
} from '../contracts/conduit.contracts'
import type { Article, AuthUser, Comment, Profile } from '../contracts/conduit.contracts'
import type { NewArticlePayload, NewCommentPayload, NewUserPayload } from '../factories/builders'

/**
 * Typed client for the Conduit REST API.
 *
 * Two distinct method families, deliberately separated:
 *
 *   - "happy path" methods (createArticle, login, ...) assert a successful status
 *     and return parsed, contract-validated data. A test using these needs no
 *     status assertions of its own for setup steps, so a setup failure surfaces
 *     as a clear error at the point of failure rather than as a confusing
 *     assertion error further down.
 *
 *   - `raw` methods return the untouched APIResponse for negative testing, where
 *     the status code and error body *are* the thing under test.
 *
 * This split is what stops an agent from either (a) writing bare fetch calls, or
 * (b) trying to assert a 403 through a method that throws on non-2xx.
 */

export class ConduitApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message)
    this.name = 'ConduitApiError'
  }
}

function authHeaders(token?: string): Record<string, string> {
  // The backend accepts both "Token" and "Bearer"; "Token" is the RealWorld convention.
  return token ? { Authorization: `Token ${token}` } : {}
}

async function expectOk(response: APIResponse, action: string): Promise<APIResponse> {
  if (!response.ok()) {
    const body = await response.text()
    throw new ConduitApiError(
      `${action} failed with HTTP ${response.status()}. Body: ${body.slice(0, 500)}`,
      response.status(),
      body,
    )
  }
  return response
}

async function parse<T>(response: APIResponse, schema: z.ZodType<T>, action: string): Promise<T> {
  const json: unknown = await response.json()
  const result = schema.safeParse(json)
  if (!result.success) {
    throw new ConduitApiError(
      `${action} returned a body that does not match its contract.\n` +
        `Zod issues: ${JSON.stringify(result.error.issues, null, 2)}\n` +
        `Received: ${JSON.stringify(json).slice(0, 500)}`,
      response.status(),
      JSON.stringify(json),
    )
  }
  return result.data
}

/**
 * Parses a validation-error body from a failed request.
 *
 * Exposed as a helper so negative tests can inspect error fields without casting
 * `await response.json()` to a hand-written shape in every spec.
 */
export async function parseErrors(response: APIResponse): Promise<Record<string, string[]>> {
  const json: unknown = await response.json()
  const parsed = errorResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new ConduitApiError(
      `Expected a validation-error body but received: ${JSON.stringify(json).slice(0, 300)}`,
      response.status(),
      JSON.stringify(json),
    )
  }

  const { errors } = parsed.data
  // Normalise both observed shapes (keyed object and bare array) into one form.
  if (Array.isArray(errors)) {
    return { _: errors }
  }
  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [key, Array.isArray(value) ? value : [value]]),
  )
}

export class ConduitApiClient {
  constructor(private readonly request: APIRequestContext) {}

  private url(path: string): string {
    return `${apiRoot}${path}`
  }

  private get options() {
    return { timeout: env.apiTimeoutMs }
  }

  // ---------------------------------------------------------------------------
  // Raw requests — for negative tests that assert on status codes and error bodies
  // ---------------------------------------------------------------------------

  readonly raw = {
    register: (user: NewUserPayload): Promise<APIResponse> =>
      this.request.post(this.url('/users'), { data: { user }, ...this.options }),

    login: (email: string, password: string): Promise<APIResponse> =>
      this.request.post(this.url('/users/login'), {
        data: { user: { email, password } },
        ...this.options,
      }),

    currentUser: (token?: string): Promise<APIResponse> =>
      this.request.get(this.url('/user'), { headers: authHeaders(token), ...this.options }),

    feed: (token?: string): Promise<APIResponse> =>
      this.request.get(this.url('/articles/feed'), {
        headers: authHeaders(token),
        ...this.options,
      }),

    createArticle: (article: Partial<NewArticlePayload>, token?: string): Promise<APIResponse> =>
      this.request.post(this.url('/articles'), {
        data: { article },
        headers: authHeaders(token),
        ...this.options,
      }),

    updateArticle: (
      slug: string,
      article: Partial<NewArticlePayload>,
      token?: string,
    ): Promise<APIResponse> =>
      this.request.put(this.url(`/articles/${slug}`), {
        data: { article },
        headers: authHeaders(token),
        ...this.options,
      }),

    deleteArticle: (slug: string, token?: string): Promise<APIResponse> =>
      this.request.delete(this.url(`/articles/${slug}`), {
        headers: authHeaders(token),
        ...this.options,
      }),

    getArticle: (slug: string, token?: string): Promise<APIResponse> =>
      this.request.get(this.url(`/articles/${slug}`), {
        headers: authHeaders(token),
        ...this.options,
      }),

    deleteComment: (slug: string, commentId: number, token?: string): Promise<APIResponse> =>
      this.request.delete(this.url(`/articles/${slug}/comments/${commentId}`), {
        headers: authHeaders(token),
        ...this.options,
      }),
  }

  // ---------------------------------------------------------------------------
  // Happy-path helpers — assert success, validate contract, return typed data
  // ---------------------------------------------------------------------------

  async register(user: NewUserPayload): Promise<AuthUser> {
    const response = await expectOk(await this.raw.register(user), `Register user "${user.username}"`)
    return (await parse(response, userResponseSchema, 'POST /users')).user
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const response = await expectOk(await this.raw.login(email, password), `Login as "${email}"`)
    return (await parse(response, userResponseSchema, 'POST /users/login')).user
  }

  async currentUser(token: string): Promise<AuthUser> {
    const response = await expectOk(await this.raw.currentUser(token), 'Fetch current user')
    return (await parse(response, userResponseSchema, 'GET /user')).user
  }

  async createArticle(article: NewArticlePayload, token: string): Promise<Article> {
    const response = await expectOk(
      await this.raw.createArticle(article, token),
      `Create article "${article.title}"`,
    )
    return (await parse(response, articleResponseSchema, 'POST /articles')).article
  }

  async getArticle(slug: string, token?: string): Promise<Article> {
    const response = await expectOk(await this.raw.getArticle(slug, token), `Fetch article "${slug}"`)
    return (await parse(response, articleResponseSchema, 'GET /articles/:slug')).article
  }

  async updateArticle(
    slug: string,
    article: Partial<NewArticlePayload>,
    token: string,
  ): Promise<Article> {
    const response = await expectOk(
      await this.raw.updateArticle(slug, article, token),
      `Update article "${slug}"`,
    )
    return (await parse(response, articleResponseSchema, 'PUT /articles/:slug')).article
  }

  async deleteArticle(slug: string, token: string): Promise<void> {
    await expectOk(await this.raw.deleteArticle(slug, token), `Delete article "${slug}"`)
  }

  /**
   * @param query supports the server-side filters: tag, author, favorited, limit, offset.
   *              Prefer filtering by a unique tag over asserting list position —
   *              the endpoint has no stable sort tiebreaker.
   */
  async listArticles(
    query: Partial<{
      tag: string
      author: string
      favorited: string
      limit: number
      offset: number
    }> = {},
    token?: string,
  ): Promise<{ articles: Article[]; articlesCount: number }> {
    const params = Object.fromEntries(
      Object.entries(query)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    )
    const response = await expectOk(
      await this.request.get(this.url('/articles'), {
        params,
        headers: authHeaders(token),
        ...this.options,
      }),
      'List articles',
    )
    return parse(response, articlesResponseSchema, 'GET /articles')
  }

  async favoriteArticle(slug: string, token: string): Promise<Article> {
    const response = await expectOk(
      await this.request.post(this.url(`/articles/${slug}/favorite`), {
        headers: authHeaders(token),
        ...this.options,
      }),
      `Favorite article "${slug}"`,
    )
    return (await parse(response, articleResponseSchema, 'POST /articles/:slug/favorite')).article
  }

  async unfavoriteArticle(slug: string, token: string): Promise<Article> {
    const response = await expectOk(
      await this.request.delete(this.url(`/articles/${slug}/favorite`), {
        headers: authHeaders(token),
        ...this.options,
      }),
      `Unfavorite article "${slug}"`,
    )
    return (await parse(response, articleResponseSchema, 'DELETE /articles/:slug/favorite')).article
  }

  async addComment(slug: string, comment: NewCommentPayload, token: string): Promise<Comment> {
    const response = await expectOk(
      await this.request.post(this.url(`/articles/${slug}/comments`), {
        data: { comment },
        headers: authHeaders(token),
        ...this.options,
      }),
      `Add comment to "${slug}"`,
    )
    return (await parse(response, commentResponseSchema, 'POST /articles/:slug/comments')).comment
  }

  async listComments(slug: string, token?: string): Promise<Comment[]> {
    const response = await expectOk(
      await this.request.get(this.url(`/articles/${slug}/comments`), {
        headers: authHeaders(token),
        ...this.options,
      }),
      `List comments for "${slug}"`,
    )
    return (await parse(response, commentsResponseSchema, 'GET /articles/:slug/comments')).comments
  }

  async deleteComment(slug: string, commentId: number, token: string): Promise<void> {
    await expectOk(
      await this.raw.deleteComment(slug, commentId, token),
      `Delete comment ${commentId} on "${slug}"`,
    )
  }

  async followUser(username: string, token: string): Promise<Profile> {
    const response = await expectOk(
      await this.request.post(this.url(`/profiles/${username}/follow`), {
        headers: authHeaders(token),
        ...this.options,
      }),
      `Follow "${username}"`,
    )
    return (await parse(response, profileResponseSchema, 'POST /profiles/:username/follow')).profile
  }

  async feed(token: string, query: Partial<{ limit: number; offset: number }> = {}): Promise<{
    articles: Article[]
    articlesCount: number
  }> {
    const params = Object.fromEntries(
      Object.entries(query).map(([key, value]) => [key, String(value)]),
    )
    const response = await expectOk(
      await this.request.get(this.url('/articles/feed'), {
        params,
        headers: authHeaders(token),
        ...this.options,
      }),
      'Fetch personal feed',
    )
    return parse(response, articlesResponseSchema, 'GET /articles/feed')
  }
}
