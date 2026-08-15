import { test, expect } from '@src/fixtures/test'

/**
 * Favourites and comments — the engagement features.
 *
 * The favourite tests deliberately include the double-favourite case. Counter
 * fields are where off-by-one and double-count bugs live, and the "click it
 * twice" path is the one real users hit constantly (double taps, retries).
 */
test.describe('Engagement — favourites', () => {
  test('@api @smoke favourites an article and reflects the count', async ({
    actor,
    users,
    articles,
    api,
  }) => {
    const author = actor
    const reader = await users.createUser()
    const article = await articles.createArticle(author)

    const favorited = await api.favoriteArticle(article.slug, reader.token)

    expect(favorited.favorited).toBe(true)
    expect(favorited.favoritesCount).toBe(1)
  })

  test('@api @regression treats a repeated favourite as idempotent', async ({
    actor,
    users,
    articles,
    api,
  }) => {
    const reader = await users.createUser()
    const article = await articles.createArticle(actor)

    await api.favoriteArticle(article.slug, reader.token)
    const second = await api.favoriteArticle(article.slug, reader.token)

    // Favouriting twice must not inflate the counter.
    expect(second.favorited).toBe(true)
    expect(second.favoritesCount).toBe(1)
  })

  test('@api @regression unfavourites an article and restores the count', async ({
    actor,
    users,
    articles,
    api,
  }) => {
    const reader = await users.createUser()
    const article = await articles.createArticle(actor)

    await api.favoriteArticle(article.slug, reader.token)
    const unfavorited = await api.unfavoriteArticle(article.slug, reader.token)

    expect(unfavorited.favorited).toBe(false)
    expect(unfavorited.favoritesCount).toBe(0)
  })

  test('@api @regression scopes the favourited flag to the requesting user', async ({
    actor,
    users,
    articles,
    api,
  }) => {
    const reader = await users.createUser()
    const bystander = await users.createUser()
    const article = await articles.createArticle(actor)

    await api.favoriteArticle(article.slug, reader.token)

    // The same article, seen by someone who did not favourite it.
    const asBystander = await api.getArticle(article.slug, bystander.token)
    expect(asBystander.favorited).toBe(false)
    expect(asBystander.favoritesCount).toBe(1)
  })
})

test.describe('Engagement — comments', () => {
  test('@api @smoke adds a comment and lists it against the article', async ({
    actor,
    users,
    articles,
    api,
  }) => {
    const reader = await users.createUser()
    const article = await articles.createArticle(actor)

    const created = await api.addComment(article.slug, { body: 'A considered response.' }, reader.token)

    expect(created.body).toBe('A considered response.')
    expect(created.author.username).toBe(reader.username)

    const comments = await api.listComments(article.slug)
    expect(comments.map((c) => c.id)).toContain(created.id)
  })

  test('@api @regression lets the comment author delete their own comment', async ({
    actor,
    articles,
    api,
  }) => {
    const article = await articles.createArticle(actor)
    const comment = await api.addComment(article.slug, { body: 'To be removed.' }, actor.token)

    await api.deleteComment(article.slug, comment.id, actor.token)

    const remaining = await api.listComments(article.slug)
    expect(remaining.map((c) => c.id)).not.toContain(comment.id)
  })
})
