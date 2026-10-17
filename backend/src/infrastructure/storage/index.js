'use strict';
const { config } = require('../../config');

let instance;

/**
 * Which store to use. Cloudinary when configured; outside production a missing Cloudinary
 * account falls back to local disk so development and tests run without one
 * (production config validation already requires the Cloudinary keys).
 */
function providerName(env) {
  if (env.STORAGE_PROVIDER === 'local') return 'local';
  const hasCloudinary = env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET;
  const prod = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
  return hasCloudinary || prod ? 'cloudinary' : 'local';
}

/** The configured file store (cloudinary | local), created once. */
function getStorage() {
  const name = providerName(config());
  if (!instance || instance.name !== name) {
    if (name === 'local') {
      const { LocalStorage } = require('./LocalStorage');
      instance = new LocalStorage();
    } else {
      const { CloudinaryStorage } = require('./CloudinaryStorage');
      instance = new CloudinaryStorage();
    }
  }
  return instance;
}

module.exports = { getStorage };
