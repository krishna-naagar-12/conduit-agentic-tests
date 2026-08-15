import type { Page } from '@playwright/test'

import { BasePage } from './base.page'

/**
 * Home page at /, showing the Global Feed and (when signed in) Your Feed.
 *
 * The feed renders asynchronously after an XHR, so every accessor here returns a
 * locator rather than a value — callers must assert with `expect(...)`, which
 * retries until the feed settles. Reading `.count()` or `.textContent()`
 * immediately after navigation is the single biggest flake source on this page.
 */
export class HomePage extends BasePage {
  protected readonly path = '/'

  constructor(page: Page) {
    super(page)
  }

  get globalFeedTab() {
    return this.page.locator('.feed-toggle').getByText('Global Feed')
  }

  get yourFeedTab() {
    return this.page.locator('.feed-toggle').getByText('Your Feed')
  }

  get articlePreviews() {
    return this.page.locator('.article-preview')
  }

  /** A single preview card located by its title text. */
  previewByTitle(title: string) {
    return this.articlePreviews.filter({ hasText: title })
  }

  /** Link into an article, located by title. */
  previewLink(title: string) {
    return this.page.locator('.article-preview a.preview-link').filter({ hasText: title })
  }

  /**
   * Favourite toggle on a preview card. The button's accessible name is the
   * favourites count, so it is located structurally within the card instead.
   */
  favoriteButtonFor(title: string) {
    return this.previewByTitle(title).locator('button')
  }

  /** Tag link in the right-hand "Popular Tags" sidebar. */
  sidebarTag(tag: string) {
    return this.page.locator('.sidebar').getByText(tag, { exact: true })
  }

  async openGlobalFeed(): Promise<void> {
    await this.globalFeedTab.click()
  }
}
