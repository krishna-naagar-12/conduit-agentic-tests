'use strict'

/**
 * Local ESLint plugin bundling this repository's agent guardrails.
 *
 * Each rule targets a specific, observed AI-agent failure mode rather than a
 * general style preference. See the header comment in each rule file.
 */
module.exports = {
  rules: {
    'no-hard-waits': require('./no-hard-waits'),
    'no-raw-locators-in-specs': require('./no-raw-locators-in-specs'),
    'no-hardcoded-test-data': require('./no-hardcoded-test-data'),
    'require-test-metadata': require('./require-test-metadata'),
    'no-weak-assertions': require('./no-weak-assertions'),
    'require-framework-imports': require('./require-framework-imports'),
  },
}
