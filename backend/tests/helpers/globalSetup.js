'use strict';
const { execSync } = require('child_process');
const path = require('path');

module.exports = async function globalSetup() {
  process.env.NODE_ENV = 'test';
  const cwd = path.resolve(__dirname, '../..');
  const opts = { cwd, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } };
  execSync('npx knex --knexfile knexfile.js migrate:rollback --all', opts);
  execSync('npx knex --knexfile knexfile.js migrate:latest', opts);
  execSync('npx knex --knexfile knexfile.js seed:run', opts);
};
