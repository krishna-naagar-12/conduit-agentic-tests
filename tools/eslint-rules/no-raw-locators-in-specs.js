'use strict'

/**
 * Keeps CSS/XPath selectors out of spec files.
 *
 * Why: an agent asked to "add a test for the comment box" will happily write
 * `page.locator('.card-text')` inline. Do that five times and the selector
 * knowledge is smeared across the suite, so a markup change breaks tests in five
 * places instead of one page object.
 *
 * Selectors belong in src/pages/**. Specs express intent; page objects know markup.
 */

const LOCATOR_METHODS = new Set(['locator', '$', '$$', 'waitForSelector'])

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow raw CSS/XPath locators inside spec files',
    },
    schema: [],
    messages: {
      noRawLocator:
        'Raw selector "{{ selector }}" in a spec file. Selectors belong in a page object under ' +
        'src/pages/. Add or reuse a getter there and reach it through the `pages` fixture.',
    },
  },

  create(context) {
    const filename = context.getFilename()
    // Only applies to specs; page objects are exactly where selectors should live.
    if (!filename.includes(`${require('path').sep}tests${require('path').sep}`)) {
      return {}
    }

    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression' || callee.computed) return
        if (callee.property.type !== 'Identifier') return
        if (!LOCATOR_METHODS.has(callee.property.name)) return

        const [first] = node.arguments
        if (!first || first.type !== 'Literal' || typeof first.value !== 'string') return

        context.report({
          node: first,
          messageId: 'noRawLocator',
          data: { selector: first.value },
        })
      },
    }
  },
}
