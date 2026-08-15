'use strict'

/**
 * Bans fixed-duration sleeps.
 *
 * Why this is a lint rule and not a documented convention: `page.waitForTimeout`
 * is the single most common thing an AI agent reaches for when a test is flaky,
 * because it is the most common fix in its training data. It converts a real race
 * condition into a slow test that still fails under load. Prose in a README does
 * not stop it; a failing lint run does.
 *
 * The fix is always a web-first assertion, which retries until the condition holds:
 *   await expect(locator).toBeVisible()
 *   await expect(page).toHaveURL(/\/article\//)
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow fixed-duration waits; use web-first assertions instead',
    },
    schema: [],
    messages: {
      noWaitForTimeout:
        'Do not use {{ name }}(). A fixed sleep hides a race condition instead of fixing it. ' +
        'Use a web-first assertion that retries, e.g. await expect(locator).toBeVisible() ' +
        'or await expect(page).toHaveURL(...).',
      noSleep:
        'Do not sleep with {{ name }}. Wait for an observable condition instead, ' +
        'e.g. await expect(locator).toBeVisible().',
    },
  },

  create(context) {
    return {
      // page.waitForTimeout(...) / this.page.waitForTimeout(...)
      "CallExpression[callee.type='MemberExpression'][callee.property.name='waitForTimeout']"(node) {
        context.report({
          node,
          messageId: 'noWaitForTimeout',
          data: { name: 'waitForTimeout' },
        })
      },

      // new Promise(r => setTimeout(r, 1000))
      "CallExpression[callee.name='setTimeout']"(node) {
        context.report({ node, messageId: 'noSleep', data: { name: 'setTimeout' } })
      },
    }
  },
}
