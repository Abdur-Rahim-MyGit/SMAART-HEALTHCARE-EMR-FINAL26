'use strict';
const { loadEnv } = require('./env');

let cached;
function config() {
  if (!cached) cached = loadEnv();
  return cached;
}
module.exports = { config, loadEnv };
