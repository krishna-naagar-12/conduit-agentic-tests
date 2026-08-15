'use strict'

/**
 * Bans literal identities and URLs in specs.
 *
 * Why this matters more here than in most suites: the app under test has no
 * database reset. A hardcoded `test@example.com` passes on a clean database and
 * fails on every subsequent run, because the email is already taken — and thanks
 * to CONDUIT-001 that failure surfaces as an opaque 404. This is the classic
 * "worked when the agent wrote it, broken tomorrow" failure, and it is entirely
 * preventable at lint time.
 *
 * Use the factories instead: buildUserPayload(), uniqueEmail(), uniqueTag().
 * Base URLs come from src/config/env.ts.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_PATTERN = /^https?:\/\//i
// Credential-looking literals we do not want pasted into specs.
const PASSWORD_HINT_PATTERN = /^(password|passw0rd|pa55word|secret|admin|letmein)/i

/**
 * True when a literal is being used as a value assigned to a credential field,
 * rather than merely mentioning the word.
 *
 * Without this check the rule fires on `expect(Object.keys(errors)).toContain('password')`,
 * where 'password' is a field name being asserted on, not a secret. A guardrail that
 * reports false positives gets switched off, which is worse than not having it.
 */
function isCredentialValue(node) {
  const parent = node.parent
  if (!parent) return false

  // { password: 'literal' }
  if (parent.type === 'Property' && parent.value === node) {
    const key = parent.key
    const keyName = key.type === 'Identifier' ? key.name : key.type === 'Literal' ? key.value : ''
    return /password|secret|token|credential/i.test(String(keyName))
  }

  // const password = 'literal'
  if (parent.type === 'VariableDeclarator' && parent.init === node) {
    const id = parent.id
    return id.type === 'Identifier' && /password|secret|token|credential/i.test(id.name)
  }

  return false
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded emails, URLs and credentials in spec files',
    },
    schema: [],
    messages: {
      noEmail:
        'Hardcoded email "{{ value }}". The app never resets its database, so a fixed email ' +
        'collides on the second run. Use the `users` fixture or buildUserPayload().',
      noUrl:
        'Hardcoded URL "{{ value }}". Read base URLs from src/config/env.ts so the suite can be ' +
        'pointed at another environment.',
      noCredential:
        'Hardcoded credential-like literal "{{ value }}". Use env.testUserPassword via the factories.',
    },
  },

  create(context) {
    const path = require('path')
    const filename = context.getFilename()
    if (!filename.includes(`${path.sep}tests${path.sep}`)) {
      return {}
    }

    function check(node, value) {
      if (typeof value !== 'string' || value.length === 0) return

      if (EMAIL_PATTERN.test(value)) {
        context.report({ node, messageId: 'noEmail', data: { value } })
        return
      }
      if (URL_PATTERN.test(value)) {
        context.report({ node, messageId: 'noUrl', data: { value } })
        return
      }
      // Only flag credential-looking strings that are actually assigned to a
      // credential field — not field names appearing inside assertions.
      if (PASSWORD_HINT_PATTERN.test(value) && isCredentialValue(node)) {
        context.report({ node, messageId: 'noCredential', data: { value } })
      }
    }

    return {
      Literal(node) {
        check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.cooked)
      },
    }
  },
}
