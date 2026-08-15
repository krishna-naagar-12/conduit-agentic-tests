import type { Page } from '@playwright/test'

import { BasePage } from './base.page'

/**
 * Article composer at /editor.
 *
 * Note: this route renders its form even for anonymous visitors — the app has no
 * client-side route guard. Publishing while logged out simply fails at the API
 * layer. See KNOWN_ISSUES.md (CONDUIT-002).
 */
export class EditorPage extends BasePage {
  protected readonly path = '/editor'

  constructor(page: Page) {
    super(page)
  }

  get titleInput() {
    return this.page.getByPlaceholder('Article Title')
  }

  get descriptionInput() {
    return this.page.getByPlaceholder("What's this article about?")
  }

  get bodyInput() {
    return this.page.getByPlaceholder('Write your article (in markdown)')
  }

  get tagsInput() {
    return this.page.getByPlaceholder('Enter tags')
  }

  get publishButton() {
    return this.page.getByRole('button', { name: 'Publish Article' })
  }

  /**
   * Fills the composer and publishes.
   *
   * @param tags committed one at a time with Enter, which is how the app's tag
   *             input registers a tag; typing without Enter still submits the
   *             pending text, but pressing Enter matches real user behaviour and
   *             supports multiple tags.
   */
  async publishArticle(input: {
    title: string
    description: string
    body: string
    tags?: string[]
  }): Promise<void> {
    await this.titleInput.fill(input.title)
    await this.descriptionInput.fill(input.description)
    await this.bodyInput.fill(input.body)
    for (const tag of input.tags ?? []) {
      await this.tagsInput.fill(tag)
      await this.tagsInput.press('Enter')
    }
    await this.publishButton.click()
  }
}
