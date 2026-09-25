'use strict';
const mongoose = require('mongoose');
const { config } = require('../../config');
const { getLogger } = require('../../common/logging/logger');

let connected = false;

async function connectMongo() {
  const env = config();
  if (!env.MONGODB_URI) {
    if (env.MONGODB_REQUIRED) throw new Error('MONGODB_URI is required');
    getLogger().warn('MONGODB_URI not set: MongoDB-backed modules are disabled');
    return null;
  }
  mongoose.set('strictQuery', true);
  mongoose.set('sanitizeFilter', true); // blocks operator injection in filters
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    autoIndex: !env.isProduction,
  });
  connected = true;
  mongoose.connection.on('error', (err) => getLogger().error({ err }, 'mongodb error'));
  mongoose.connection.on('disconnected', () => {
    connected = false;
    getLogger().warn('mongodb disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    connected = true;
  });
  getLogger().info({ db: mongoose.connection.name }, 'mongodb connected');
  return mongoose.connection;
}

function isMongoConnected() {
  return connected && mongoose.connection.readyState === 1;
}
function isMongoConfigured() {
  return !!config().MONGODB_URI;
}
async function pingMongo() {
  if (!isMongoConnected()) return false;
  await mongoose.connection.db.admin().ping();
  return true;
}
async function closeMongo() {
  if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  connected = false;
}

module.exports = { connectMongo, isMongoConnected, isMongoConfigured, pingMongo, closeMongo, mongoose };
