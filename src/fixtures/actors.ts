import type { ConduitApiClient } from '../api/conduit-client'
import type { Article, AuthUser } from '../contracts/conduit.contracts'
import {
  buildArticlePayload,
  buildUserPayload,
  type NewArticlePayload,
  type NewUserPayload,
} from '../factories/builders'


/**
 * An authenticated test user plus the credentials used to create it.
 *
 * `password` is carried so a UI test can log in through the real form using the
 * same identity the API created, and `token` is carried so setup can be done over
 * the API instead of the UI.
 */
export interface Actor {
  readonly username: string
  readonly email: string
  readonly password: string
  readonly token: string
  readonly profile: AuthUser
}

/**
 * Creates users on demand.
 *
 * Every test gets its own users. That is the isolation boundary: no shared
 * accounts, therefore no cross-test interference and no ordering requirements.
 */
export class ActorFactory {
  constructor(private readonly api: ConduitApiClient) {}

  /**
   * Registers a brand-new user and returns it with a valid token.
   *
   * @param overrides optional payload overrides; defaults are always server-valid.
   */
  async createUser(overrides: Partial<NewUserPayload> = {}): Promise<Actor> {
    const payload = buildUserPayload(overrides)
    const profile = await this.api.register(payload)
    return {
      // The server lowercases both fields, so the authoritative values come from
      // the response, not from the request payload.
      username: profile.username,
      email: profile.email,
      password: payload.password,
      token: profile.token,
      profile,
    }
  }
}

/**
 * Creates articles owned by a given actor.
 *
 * Returns the server's article representation, which is the only reliable source
 * of the slug: the model appends a random base-36 suffix to the slugified title,
 * so the slug can never be derived client-side.
 */
export class ArticleFactory {
  constructor(private readonly api: ConduitApiClient) {}

  async createArticle(owner: Actor, overrides: Partial<NewArticlePayload> = {}): Promise<Article> {
    const payload = buildArticlePayload(overrides)
    return this.api.createArticle(payload, owner.token)
  }

  /**
   * Creates an article and returns it alongside the unique tag it can be queried by.
   *
   * Convenience for the common "publish, then find it again deterministically"
   * pattern that both API and UI tests rely on.
   *
   * Important: the returned `tag` comes from the *requested* payload, not from the
   * create response. POST /api/articles always responds with an empty `tagList`
   * because the route does not await its tag-association writes before
   * serialising — the tags are persisted correctly and appear on any subsequent
   * read. See KNOWN_ISSUES.md (CONDUIT-003).
   *
   * The returned `article` is therefore re-fetched, so callers get an accurate
   * representation rather than the misleading create response.
   */
  async createTaggedArticle(
    owner: Actor,
    overrides: Partial<NewArticlePayload> = {},
  ): Promise<{ article: Article; tag: string }> {
    const payload = buildArticlePayload(overrides)
    const tag = payload.tagList[0]
    if (!tag) {
      throw new Error(
        'createTaggedArticle needs at least one tag. Do not override tagList with an empty ' +
          'array when using this helper — use createArticle() instead.',
      )
    }

    const created = await this.api.createArticle(payload, owner.token)
    // Re-read so the caller sees the persisted tagList rather than the empty one
    // returned by the create endpoint.
    const article = await this.api.getArticle(created.slug, owner.token)
    return { article, tag }
  }
}
