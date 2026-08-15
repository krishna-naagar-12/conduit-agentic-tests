/**
 * Barrel export for page objects.
 *
 * Tests never import from here directly — they receive page objects through the
 * `pages` fixture. This file exists so tooling (and the manifest generator) has a
 * single place that enumerates the page-object surface.
 */
export { ArticlePage } from './article.page'
export { BasePage } from './base.page'
export { EditorPage } from './editor.page'
export { HomePage } from './home.page'
export { LoginPage } from './login.page'
export { RegisterPage } from './register.page'
