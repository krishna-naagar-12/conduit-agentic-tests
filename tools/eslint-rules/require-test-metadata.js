'use strict'

/**
 * Requires every test title to carry a coverage tag.
 *
 * Format:  test('@api @smoke creates an article', ...)
 *
 * Why: tags are how a run gets sliced (`--grep @smoke`) and how coverage is
 * audited without reading every file. Agents reliably omit them unless the
 * omission fails. The rule also enforces that the tag matches the directory, so
 * an agent cannot drop an @api test into tests/ui/ and quietly get browser
 * fixtures it does not need.
 */

const VALID_TAGS = new Set(['@api', '@ui', '@smoke', '@regression', '@negative', '@known-issue'])
const REQUIRED_PRIMARY = ['@api', '@ui']

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require coverage tags in test titles that match the test directory',
    },
    schema: [],
    messages: {
      missingTag:
        'Test title must start with a primary tag (@api or @ui), e.g. ' +
        "test('@api @smoke creates an article', ...). Found: \"{{ title }}\"",
      unknownTag:
        'Unknown tag "{{ tag }}". Allowed tags: ' + [...VALID_TAGS].join(', ') + '.',
      wrongDirectory:
        'Test is tagged {{ tag }} but lives in {{ dir }}. Move it to tests/{{ expected }}/ ' +
        'or correct the tag — the Playwright projects are split by directory.',
    },
  },

  create(context) {
    const path = require('path')
    const filename = context.getFilename()
    if (!filename.endsWith('.spec.ts')) return {}

    const inApiDir = filename.includes(`${path.sep}tests${path.sep}api${path.sep}`)
    const inUiDir = filename.includes(`${path.sep}tests${path.sep}ui${path.sep}`)
    if (!inApiDir && !inUiDir) return {}

    return {
      CallExpression(node) {
        const callee = node.callee
        const isTestCall =
          (callee.type === 'Identifier' && callee.name === 'test') ||
          (callee.type === 'MemberExpression' &&
            callee.object.type === 'Identifier' &&
            callee.object.name === 'test' &&
            callee.property.type === 'Identifier' &&
            ['only', 'fixme', 'skip'].includes(callee.property.name))

        if (!isTestCall) return

        const [titleNode] = node.arguments
        if (!titleNode || titleNode.type !== 'Literal' || typeof titleNode.value !== 'string') {
          return
        }

        const title = titleNode.value
        const tags = title.match(/@[a-z-]+/g) ?? []

        for (const tag of tags) {
          if (!VALID_TAGS.has(tag)) {
            context.report({ node: titleNode, messageId: 'unknownTag', data: { tag } })
          }
        }

        const primary = tags.find((tag) => REQUIRED_PRIMARY.includes(tag))
        if (!primary) {
          context.report({ node: titleNode, messageId: 'missingTag', data: { title } })
          return
        }

        if (primary === '@api' && inUiDir) {
          context.report({
            node: titleNode,
            messageId: 'wrongDirectory',
            data: { tag: '@api', dir: 'tests/ui/', expected: 'api' },
          })
        }
        if (primary === '@ui' && inApiDir) {
          context.report({
            node: titleNode,
            messageId: 'wrongDirectory',
            data: { tag: '@ui', dir: 'tests/api/', expected: 'ui' },
          })
        }
      },
    }
  },
}
