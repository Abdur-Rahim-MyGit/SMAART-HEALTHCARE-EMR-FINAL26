'use strict';
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node, ...globals.es2021 } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], 'no-console': 'off', 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  { files: ['tests/**/*.js'], languageOptions: { globals: { ...globals.node, ...globals.vitest } } },
  { ignores: ['node_modules/**', 'coverage/**', 'storage/**'] },
];
