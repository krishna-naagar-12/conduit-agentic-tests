'use strict'

/**
 * Forces specs to enter through the framework's fixture surface.
 *
 * Importing `test` straight from '@playwright/test' silently opts a spec out of
 * every fixture, factory and guardrail in this repo — and it is the first thing
 * an agent does, because that import is what every Playwright tutorial shows.
 * The resulting test looks plausible, runs, and reuses none of the framework.
 *
 * Specs must import from '@src/fixtures/test'. Importing `expect` alone is still
 * blocked because the re-export from the fixture module is a single, discoverable
 * entry point.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: "Require spec files to import test/expect from the framework fixture module",
    },
    schema: [],
    messages: {
      wrongImport:
        "Import { test, expect } from '@src/fixtures/test' instead of '@playwright/test'. " +
        'The fixture module provides api, users, articles, actor, pages and loginAs — ' +
        'importing Playwright directly opts this spec out of all of them.',
      deepImport:
        'Spec files should not import "{{ source }}" directly. Everything a test needs is ' +
        "exposed through the fixtures: import { test, expect } from '@src/fixtures/test'.",
    },
  },

  create(context) {
    const path = require('path')
    const filename = context.getFilename()
    if (!filename.endsWith('.spec.ts')) return {}

    // Type-only imports are harmless and often necessary.
    const ALLOWED_DEEP = new Set(['@src/fixtures/test'])

    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (typeof source !== 'string') return

        if (source === '@playwright/test') {
          // `import type { ... }` carries no runtime behaviour.
          if (node.importKind === 'type') return
          context.report({ node, messageId: 'wrongImport' })
          return
        }

        if (source.startsWith('@src/') && !ALLOWED_DEEP.has(source)) {
          if (node.importKind === 'type') return
          context.report({ node, messageId: 'deepImport', data: { source } })
        }
      },
    }
  },
}
