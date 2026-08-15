import type { Page } from '@playwright/test'

import { BasePage } from './base.page'

/**
 * Single article view at /article/:slug.
 *
 * The slug is supplied by the caller because it is generated server-side with a
 * random suffix and cannot be derived from the title.
 */
export class ArticlePage extends BasePage {
  protected readonly path = '/article'

  constructor(
    page: Page,
    private readonly slug?: string,
  ) {
    super(page)
  }

  override async goto(): Promise<void> {
    if (!this.slug) {
      throw new Error(
        'ArticlePage.goto() needs a slug. Construct it as new ArticlePage(page, article.slug) ' +
          'using the slug returned by the API — it cannot be derived from the title.',
      )
    }
    await this.page.goto(`${this.baseUrl}/article/${this.slug}`)
  }

  /** Article title, rendered in the page banner. */
  get title() {
    return this.page.locator('.banner h1')
  }

  get authorLink() {
    return this.page.locator('.article-meta a.author').first()
  }

  get tags() {
    return this.page.locator('.tag-list li')
  }

  get deleteArticleButton() {
    return this.page.getByRole('button', { name: /Delete Article/ })
  }

  get commentInput() {
    return this.page.getByPlaceholder('Write a comment...')
  }

  get postCommentButton() {
    return this.page.getByRole('button', { name: 'Post Comment' })
  }

  /** Rendered comment bodies. */
  get commentBodies() {
    return this.page.locator('.card .card-text')
  }

  comment(body: string) {
    return this.page.locator('.card').filter({ hasText: body })
  }

  async postComment(body: string): Promise<void> {
    await this.commentInput.fill(body)
    await this.postCommentButton.click()
  }
}
