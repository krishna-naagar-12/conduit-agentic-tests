import type { Page } from '@playwright/test'

import { BasePage } from './base.page'

/** Sign-in form at /login. */
export class LoginPage extends BasePage {
  protected readonly path = '/login'

  constructor(page: Page) {
    super(page)
  }

  get emailInput() {
    return this.page.getByPlaceholder('Email')
  }

  get passwordInput() {
    return this.page.getByPlaceholder('Password')
  }

  get submitButton() {
    return this.page.getByRole('button', { name: 'Sign in' })
  }

  get errorMessages() {
    return this.page.locator('.error-messages li')
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
