import { z } from 'zod'

/**
 * Runtime response contracts for the Conduit API.
 *
 * Purpose (agentic): an agent writing a new test cannot know which fields the API
 * actually returns, and will confidently assert on invented ones (`article.id`,
 * `user.createdAt`). Every response passes through the matching schema, so a
 * hallucinated field fails immediately with a precise Zod path instead of a
 * vague `undefined` comparison three assertions later.
 *
 * Every shape below was captured from a live instance of the app under test,
 * not from the RealWorld specification. Where the two disagree, the app wins and
 * the difference is recorded in KNOWN_ISSUES.md.
 */

export const profileSchema = z.object({
  username: z.string(),
  bio: z.string().nullable(),
  image: z.string().nullable(),
  following: z.boolean(),
})

export const authUserSchema = z.object({
  username: z.string(),
  email: z.string(),
  token: z.string().min(1),
  bio: z.string().nullable(),
  image: z.string().nullable(),
})

export const articleSchema = z.object({
  slug: z.string().min(1),
  title: z.string(),
  description: z.string(),
  body: z.string(),
  // Server serialises timestamps as ISO strings.
  createdAt: z.string(),
  updatedAt: z.string(),
  tagList: z.array(z.string()),
  favorited: z.boolean(),
  favoritesCount: z.number().int().nonnegative(),
  author: profileSchema,
})

export const commentSchema = z.object({
  id: z.number().int(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: profileSchema,
})

export const userResponseSchema = z.object({ user: authUserSchema })
export const profileResponseSchema = z.object({ profile: profileSchema })
export const articleResponseSchema = z.object({ article: articleSchema })
export const commentResponseSchema = z.object({ comment: commentSchema })
export const commentsResponseSchema = z.object({ comments: z.array(commentSchema) })

export const articlesResponseSchema = z.object({
  articles: z.array(articleSchema),
  articlesCount: z.number().int().nonnegative(),
})

/**
 * Validation error envelope.
 *
 * Confirmed shapes on this build:
 *   - login with blank password -> { errors: { password: "can't be blank" } }
 *   - article missing body      -> { errors: ["Article.body cannot be null"] }
 *
 * The API is inconsistent between a keyed object and a bare array, so the
 * contract accepts both rather than pretending it is uniform.
 */
export const errorResponseSchema = z.object({
  errors: z.union([
    z.record(z.union([z.string(), z.array(z.string())])),
    z.array(z.string()),
  ]),
})

export type Profile = z.infer<typeof profileSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type Article = z.infer<typeof articleSchema>
export type Comment = z.infer<typeof commentSchema>
export type ArticlesResponse = z.infer<typeof articlesResponseSchema>
