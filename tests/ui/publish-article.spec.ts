import { test, expect, buildArticlePayload } from '@src/fixtures/test'

/**
 * Publishing and commenting through the UI.
 *
 * Automated because this is the app's primary user journey, and because the
 * editor holds real client-side behaviour (the tag input, the redirect to the new
 * article) that an API test cannot exercise.
 *
 * Auth is seeded rather than typed: the login form has its own test, and
 * repeating it here would add a page load per test while testing nothing new.
 */
test.describe('Publishing UI', () => {
  test('@ui @smoke publishes an article and shows it on its own page', async ({
    actor,
    loginAs,
    pages,
    page,
    api,
  }) => {
    await loginAs(actor)
    const draft = buildArticlePayload()
    const tag = draft.tagList[0]!

    await pages.editor.goto()
    await pages.editor.publishArticle({
      title: draft.title,
      description: draft.description,
      body: draft.body,
      tags: [tag],
    })

    // Publishing redirects to the new article, whose slug is server-generated.
    await expect(page).toHaveURL(/\/article\/.+/)

    const slug = page.url().split('/article/')[1]!
    const articlePage = pages.article(slug)
    await expect(articlePage.title).toHaveText(draft.title)
    await expect(articlePage.authorLink).toHaveText(actor.username)

    // Cross-check through the API: the UI showing it is not proof it persisted.
    const persisted = await api.getArticle(slug)
    expect(persisted.title).toBe(draft.title)
    expect(persisted.tagList).toEqual([tag])
  })

  test('@ui @regression shows a published article in the global feed', async ({
    actor,
    loginAs,
    articles,
    pages,
  }) => {
    // Seeded over the API so the test is about the feed rendering, not publishing.
    const { article, tag } = await articles.createTaggedArticle(actor)
    await loginAs(actor)

    await pages.home.goto()
    await pages.home.openGlobalFeed()

    // The feed renders asynchronously after an XHR. This is a web-first assertion,
    // so it retries until the card appears rather than reading the DOM once.
    // Filtering by the article's own title keeps the assertion independent of feed
    // ordering, which has no stable tiebreaker under parallel execution.
    await expect(pages.home.previewByTitle(article.title)).toBeVisible()
    await expect(pages.home.previewByTitle(article.title)).toContainText(tag)
  })

  test('@ui @regression posts a comment and renders it on the article', async ({
    actor,
    loginAs,
    articles,
    pages,
    api,
  }) => {
    const article = await articles.createArticle(actor)
    await loginAs(actor)

    const articlePage = pages.article(article.slug)
    await articlePage.goto()

    const commentBody = `Comment body ${Date.now().toString(36)}`
    await articlePage.postComment(commentBody)

    await expect(articlePage.comment(commentBody)).toBeVisible()

    // Confirm it reached the backend, not just the Redux store.
    const comments = await api.listComments(article.slug)
    expect(comments.map((c) => c.body)).toContain(commentBody)
  })
})
