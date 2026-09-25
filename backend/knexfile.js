'use strict';
require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
require('dotenv').config();
const path = require('path');

const shared = {
  client: 'pg',
  connection: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
  pool: { min: 0, max: 5 },
  migrations: { directory: path.join(__dirname, 'src/infrastructure/postgres/migrations'), tableName: 'schema_migrations' },
  seeds: { directory: path.join(__dirname, 'src/infrastructure/postgres/seeds') },
};

module.exports = { development: shared, test: shared, staging: shared, production: shared };
