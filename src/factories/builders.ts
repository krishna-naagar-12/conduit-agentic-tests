import { env } from '../config/env'
import { uniqueEmail, uniqueTag, uniqueToken, uniqueUsername } from './identifiers'

/**
 * Payload builders.
 *
 * Each builder returns a complete, server-valid payload and accepts a partial
 * override, so a test states only the field it actually cares about:
 *
 *   buildArticlePayload({ title: 'Specific title under test' })
 *
 * The override is applied last, which means a test can still produce a knowingly
 * invalid payload for negative testing without the builder fighting it.
 */

export interface NewUserPayload {
  username: string
  email: string
  password: string
}

export interface NewArticlePayload {
  title: string
  description: string
  body: string
  tagList: string[]
}

export interface NewCommentPayload {
  body: string
}

export function buildUserPayload(overrides: Partial<NewUserPayload> = {}): NewUserPayload {
  return {
    username: uniqueUsername(),
    email: uniqueEmail(),
    password: env.testUserPassword,
    ...overrides,
  }
}

/**
 * @param overrides partial payload; omit `tagList` to receive a single unique tag
 *                  that can be used to query this article back deterministically.
 */
export function buildArticlePayload(overrides: Partial<NewArticlePayload> = {}): NewArticlePayload {
  const token = uniqueToken()
  return {
    title: `Article ${token}`,
    description: `Description for ${token}`,
    body: `Body content for ${token}.`,
    tagList: [uniqueTag()],
    ...overrides,
  }
}

export function buildCommentPayload(overrides: Partial<NewCommentPayload> = {}): NewCommentPayload {
  return {
    body: `Comment ${uniqueToken()}`,
    ...overrides,
  }
}
