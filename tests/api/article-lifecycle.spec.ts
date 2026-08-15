import { test, expect } from '@src/fixtures/test'

/**
 * Article CRUD — the core content flow of the application.
 *
 * Automated because it is the app's primary value path, it is deterministic, and
 * it is the flow most likely to break when the persistence layer changes.
 */
test.describe('Articles API — lifecycle', () => {
  test('@api @smoke creates an article and returns it with a server-generated slug', async ({
    actor,
    articles,
    api,
  }) => {
    const { article, tag } = await articles.createTaggedArticle(actor)

    // The slug is generated server-side with a random suffix, so the only valid
    // assertion is that it is derived from the title, not that it equals it.
    expect(article.slug).toContain('article-')
    expect(article.author.username).toBe(actor.username)
    expect(article.favorited).toBe(false)
    expect(article.favoritesCount).toBe(0)
    // `article` here is the re-read representation — see the factory's note about
    // the create response omitting tags (KNOWN_ISSUES.md, CONDUIT-003).
    expect(article.tagList).toEqual([tag])

    // Reading it back proves it was persisted, not just echoed.
    const fetched = await api.getArticle(article.slug)
    expect(fetched.title).toBe(article.title)
    expect(fetched.body).toBe(article.body)
  })

  test('@api @negative @known-issue omits tagList from the create response (CONDUIT-003)', async ({
    actor,
    api,
  }) => {
    // POST /api/articles kicks off the tag association without awaiting it, so the
    // response is serialised before the tags exist. Correct behaviour would be:
    //   expect(created.tagList).toEqual([tag])
    //
    // This test pins the current behaviour so that fixing the app fails here
    // loudly and prompts the workaround in ArticleFactory to be removed.
    const tag = `contract-${Date.now().toString(36)}`
    const created = await api.createArticle(
      {
        title: `Tag contract probe ${tag}`,
        description: 'Pins the create-response tag defect',
        body: 'body',
        tagList: [tag],
      },
      actor.token,
    )

    expect(created.tagList).toEqual([])

    // The tags really are persisted — only the create response is wrong.
    const refetched = await api.getArticle(created.slug)
    expect(refetched.tagList).toEqual([tag])
  })

  test('@api @regression updates an article and persists the change', async ({
    actor,
    articles,
    api,
  }) => {
    const article = await articles.createArticle(actor)
    const newTitle = `${article.title} (revised)`

    const updated = await api.updateArticle(article.slug, { title: newTitle }, actor.token)
    expect(updated.title).toBe(newTitle)

    const fetched = await api.getArticle(article.slug)
    expect(fetched.title).toBe(newTitle)
    // Fields not included in the update must be left alone.
    expect(fetched.body).toBe(article.body)
  })

  test('@api @regression deletes an article and it stops being retrievable', async ({
    actor,
    articles,
    api,
  }) => {
    const article = await articles.createArticle(actor)

    await api.deleteArticle(article.slug, actor.token)

    const response = await api.raw.getArticle(article.slug)
    expect(response.status()).toBe(404)
  })

  test('@api @regression filters the article list by tag', async ({ actor, articles, api }) => {
    // Each article carries a tag unique to this test, which makes the query
    // deterministic no matter what other tests are doing in parallel.
    const { article, tag } = await articles.createTaggedArticle(actor)

    const result = await api.listArticles({ tag })

    expect(result.articlesCount).toBe(1)
    expect(result.articles).toHaveLength(1)
    expect(result.articles[0]?.slug).toBe(article.slug)
  })

  test('@api @regression paginates with limit and offset', async ({ actor, articles, api }) => {
    // Three articles sharing one tag give a stable, isolated data set to page through.
    const tag = (await articles.createTaggedArticle(actor)).tag
    await articles.createArticle(actor, { tagList: [tag] })
    await articles.createArticle(actor, { tagList: [tag] })

    const firstPage = await api.listArticles({ tag, limit: 2, offset: 0 })
    const secondPage = await api.listArticles({ tag, limit: 2, offset: 2 })

    expect(firstPage.articlesCount).toBe(3)
    expect(firstPage.articles).toHaveLength(2)
    expect(secondPage.articles).toHaveLength(1)

    // Pages must not overlap.
    const firstSlugs = firstPage.articles.map((a) => a.slug)
    const secondSlugs = secondPage.articles.map((a) => a.slug)
    expect(firstSlugs).not.toContain(secondSlugs[0])
  })
})
