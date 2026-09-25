'use strict';
const { defineConfig } = require('vitest/config');
module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    globalSetup: ['./tests/helpers/globalSetup.js'],
    setupFiles: ['./tests/helpers/setup.js'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
