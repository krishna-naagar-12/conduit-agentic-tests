import type { Page } from '@playwright/test'

import { BasePage } from './base.page'

/**
 * Sign-up form at /register.
 *
 * Field locators use placeholders because the app renders no <label> elements
 * and no test ids — verified against the running app, not assumed.
 */
export class RegisterPage extends BasePage {
  protected readonly path = '/register'

  constructor(page: Page) {
    super(page)
  }

  get usernameInput() {
    return this.page.getByPlaceholder('Username')
  }

  get emailInput() {
    return this.page.getByPlaceholder('Email')
  }

  get passwordInput() {
    return this.page.getByPlaceholder('Password')
  }

  get submitButton() {
    return this.page.getByRole('button', { name: 'Sign up' })
  }

  /** Error list rendered above the form on a failed submission. */
  get errorMessages() {
    return this.page.locator('.error-messages li')
  }

  async register(username: string, email: string, password: string): Promise<void> {
    await this.usernameInput.fill(username)
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
