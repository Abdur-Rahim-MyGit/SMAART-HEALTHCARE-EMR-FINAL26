'use strict';
/**
 * Single MongoDB client (native driver). MongoDB is the only database of the EMR:
 * structured clinical data, identities, audit, and flexible documents all live here.
 * Multi-document transactions need a replica set (a single-node replica set is fine).
 */
const { MongoClient } = require('mongodb');
const { config } = require('../../config');
const { getLogger } = require('../../common/logging/logger');

let client;
let db;
let transactionsSupported = false;

async function connectMongo() {
  if (client) return db;
  const env = config();
  client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: env.MONGODB_POOL_MAX,
    minPoolSize: env.MONGODB_POOL_MIN,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    retryReads: true,
    appName: env.APP_NAME,
  });
  await client.connect();
  db = client.db(env.MONGODB_DB_NAME || undefined);
  const hello = await db.admin().command({ hello: 1 });
  transactionsSupported = !!hello.setName || !!hello.msg;
  if (!transactionsSupported) {
    if (env.isProduction) throw new Error('MongoDB must be a replica set in production (multi-document transactions)');
    getLogger().warn('MongoDB is not a replica set: multi-document transactions are disabled (development only)');
  }
  getLogger().info({ db: db.databaseName, transactions: transactionsSupported }, 'mongodb connected');
  return db;
}

function getDb() {
  if (!db) throw new Error('MongoDB is not connected');
  return db;
}
function getClient() {
  if (!client) throw new Error('MongoDB is not connected');
  return client;
}
function isMongoConnected() {
  return !!client && !!db;
}
function isMongoConfigured() {
  return !!config().MONGODB_URI;
}
function supportsTransactions() {
  return transactionsSupported;
}
async function pingMongo() {
  if (!isMongoConnected()) return false;
  await db.admin().ping();
  return true;
}
async function closeMongo() {
  if (client) await client.close();
  client = undefined;
  db = undefined;
}

module.exports = { connectMongo, getDb, getClient, isMongoConnected, isMongoConfigured, supportsTransactions, pingMongo, closeMongo };
