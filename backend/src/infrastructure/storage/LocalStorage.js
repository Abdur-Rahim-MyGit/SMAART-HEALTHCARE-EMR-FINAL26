'use strict';
const fs = require('fs/promises');
const path = require('path');
const { config } = require('../../config');
const { signPurposeToken } = require('../../common/security/tokens');

/**
 * Files on the API server's disk. Development and tests only (production must use Cloudinary).
 * Access URLs are relative paths carrying a short lived signed token; the documents router
 * serves them at GET /api/v1/documents/local/:token.
 */
class LocalStorage {
  constructor() {
    this.name = 'local';
    this.root = path.resolve(config().LOCAL_STORAGE_DIR || './storage');
  }

  /** Absolute path for a storage key; refuses keys that would escape the storage folder. */
  resolvePath(key) {
    const full = path.resolve(this.root, String(key || ''));
    if (full !== this.root && !full.startsWith(this.root + path.sep)) throw new Error('invalid storage key');
    return full;
  }

  async upload({ buffer, fileName, mimeType, folder }) {
    const key = path.posix.join(String(folder || '').replace(/\\/g, '/').replace(/\.\.+/g, '_'), path.basename(fileName));
    const full = this.resolvePath(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
    const ext = path.extname(fileName).replace('.', '') || null;
    return { key, resourceType: mimeType && mimeType.startsWith('image/') ? 'image' : 'raw', version: null, format: ext };
  }

  async getAccessUrl({ key, ttlSeconds }) {
    const ttl = ttlSeconds || config().DOCUMENT_ACCESS_TTL_SECONDS || 300;
    const token = signPurposeToken('local-file', { key }, ttl);
    return { url: `/api/v1/documents/local/${encodeURIComponent(token)}`, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
  }

  async delete({ key }) {
    await fs.rm(this.resolvePath(key), { force: true });
  }
}

module.exports = { LocalStorage };
