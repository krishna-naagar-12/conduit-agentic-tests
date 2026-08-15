'use strict'

/**
 * ESLint configuration.
 *
 * The `agent/*` rules are this repository's executable guardrails — the part of
 * "agentic-first" that is enforced rather than documented. They run in the same
 * `npm run agent:verify` loop an agent is told to use before declaring work done.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'agent'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: [
    'node_modules/',
    'playwright-report/',
    'test-results/',
    'tools/eslint-rules/*.js',
    '.eslintrc.js',
  ],
  rules: {
    // --- Agent guardrails (see tools/eslint-rules/) -------------------------
    'agent/no-hard-waits': 'error',
    'agent/no-raw-locators-in-specs': 'error',
    'agent/no-hardcoded-test-data': 'error',
    'agent/require-test-metadata': 'error',
    'agent/no-weak-assertions': 'error',
    'agent/require-framework-imports': 'error',

    // --- General hygiene ----------------------------------------------------
    '@typescript-eslint/no-floating-promises': 'off', // requires type-aware linting; covered by no-weak-assertions
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    eqeqeq: ['error', 'always'],
  },
  overrides: [
    {
      // Tooling scripts legitimately print to stdout.
      files: ['tools/**/*.ts'],
      rules: { 'no-console': 'off' },
    },
  ],
}
