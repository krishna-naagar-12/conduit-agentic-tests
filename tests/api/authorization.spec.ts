import { test, expect } from '@src/fixtures/test'

/**
 * Authorisation boundaries.
 *
 * Automated with high priority: these are the tests that fail *silently* in
 * production if broken — a broken ownership check does not throw, it just lets
 * the wrong person delete content. Cheap to automate, expensive to miss.
 *
 * Each test uses two distinct actors created by the `users` fixture, so there is
 * no shared state and no ordering dependency.
 */
test.describe('Authorisation — article ownership', () => {
  test('@api @negative rejects an update from a user who does not own the article', async ({
    actor,
    users,
    articles,
    api,
  }) => {
    const article = await articles.createArticle(actor)
    const intruder = await users.createUser()

    const response = await api.raw.updateArticle(
      article.slug,
      { title: 'Taken over' },
      intruder.token,
    )

    expect(response.status()).toBe(403)

    // The article must be untouched — a rejected request that still mutates data
    // is worse than one that returns the wrong status code.
    const unchanged = await api.getArticle(article.slug)
    expect(unchanged.title).toBe(article.title)
  })

  test('@api @negative rejects a delete from a user who does not own the article', async ({
    actor,
    users,
    articles,
    api,
  }) => {
    const article = await articles.createArticle(actor)
    const intruder = await users.createUser()

    const response = await api.raw.deleteArticle(article.slug, intruder.token)

    expect(response.status()).toBe(403)

    // Still retrievable, so the delete really did not happen.
    const survivor = await api.getArticle(article.slug)
    expect(survivor.slug).toBe(article.slug)
  })

  test('@api @negative rejects an unauthenticated request for the personal feed', async ({
    api,
  }) => {
    const response = await api.raw.feed()

    expect(response.status()).toBe(401)
  })

  test('@api @negative rejects a comment delete from a user who did not write it', async ({
    actor,
    users,
    articles,
    api,
  }) => {
    const article = await articles.createArticle(actor)
    const comment = await api.addComment(article.slug, { body: 'Original comment' }, actor.token)
    const intruder = await users.createUser()

    const response = await api.raw.deleteComment(article.slug, comment.id, intruder.token)

    expect(response.status()).toBe(403)

    const remaining = await api.listComments(article.slug)
    expect(remaining.map((c) => c.id)).toContain(comment.id)
  })
})
