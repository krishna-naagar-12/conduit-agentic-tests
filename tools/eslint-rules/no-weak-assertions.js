'use strict'

/**
 * Bans assertions that pass for the wrong reasons.
 *
 * `expect(x).toBeTruthy()` passes for `'undefined'`, `{}`, `-1` and `'error: 404'`.
 * Agents reach for it constantly because it is hard to get wrong syntactically —
 * which is exactly the problem: it produces a green test that proves nothing.
 *
 * The rule also requires that `expect` on a Playwright locator or page is awaited,
 * because a floating web-first assertion never actually runs and silently passes.
 */

const WEAK_MATCHERS = new Set(['toBeTruthy', 'toBeFalsy', 'toBeDefined'])

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow weak matchers and un-awaited web-first assertions',
    },
    schema: [],
    messages: {
      weakMatcher:
        '{{ matcher }}() passes for almost any value, including error strings and empty objects. ' +
        'Assert the actual expected value: toBe(), toEqual(), toHaveText(), toHaveLength(), ' +
        'or toBeVisible() for locators.',
      floatingExpect:
        'This expect() returns a promise that is never awaited, so the assertion does not run. ' +
        'Prefix it with `await`.',
    },
  },

  create(context) {
    /** Matchers that are async in Playwright and therefore must be awaited. */
    const ASYNC_MATCHER = /^(toBe|toHave|toContain)/

    return {
      // expect(x).toBeTruthy()
      "CallExpression[callee.type='MemberExpression']"(node) {
        const property = node.callee.property
        if (property.type !== 'Identifier') return
        if (!WEAK_MATCHERS.has(property.name)) return

        // Only flag when the chain root is an expect() call.
        let root = node.callee.object
        while (root && root.type === 'MemberExpression') root = root.object
        if (root && root.type === 'CallExpression' && root.callee.type === 'Identifier' && root.callee.name === 'expect') {
          context.report({
            node: property,
            messageId: 'weakMatcher',
            data: { matcher: property.name },
          })
        }
      },

      // A bare `expect(locator).toBeVisible()` statement with no await.
      ExpressionStatement(node) {
        const expr = node.expression
        if (expr.type !== 'CallExpression') return
        if (expr.callee.type !== 'MemberExpression') return
        const property = expr.callee.property
        if (property.type !== 'Identifier' || !ASYNC_MATCHER.test(property.name)) return

        let root = expr.callee.object
        while (root && root.type === 'MemberExpression') root = root.object
        const isExpectChain =
          root && root.type === 'CallExpression' && root.callee.type === 'Identifier' && root.callee.name === 'expect'
        if (!isExpectChain) return

        // `expect(...)` used on a plain value is synchronous and fine; we cannot
        // know the type statically, so only flag matchers that are always async
        // in Playwright's locator assertions.
        const ALWAYS_ASYNC = /^(toBeVisible|toBeHidden|toBeEnabled|toBeDisabled|toBeChecked|toHaveText|toHaveValue|toHaveURL|toHaveTitle|toHaveCount|toHaveAttribute|toContainText|toBeAttached|toBeEmpty|toBeFocused|toBeEditable|toHaveClass)$/
        if (ALWAYS_ASYNC.test(property.name)) {
          context.report({ node: expr, messageId: 'floatingExpect' })
        }
      },
    }
  },
}
