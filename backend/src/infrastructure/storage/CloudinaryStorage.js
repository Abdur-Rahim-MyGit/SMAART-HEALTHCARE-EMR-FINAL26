'use strict';
const { v2: cloudinary } = require('cloudinary');
const { config } = require('../../config');

/**
 * Cloudinary (production storage). Files are uploaded as `authenticated` assets, so they
 * are reachable only through signed, expiring download URLs built locally (no network call).
 */
class CloudinaryStorage {
  constructor() {
    const env = config();
    this.name = 'cloudinary';
    this.folder = env.CLOUDINARY_FOLDER || 'smaart-emr';
    this.creds = { cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET };
  }

  upload({ buffer, mimeType, folder }) {
    const resourceType = mimeType && mimeType.startsWith('image/') ? 'image' : 'raw';
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { ...this.creds, folder: `${this.folder}/${folder}`, resource_type: resourceType, type: 'authenticated', use_filename: false, unique_filename: true, overwrite: false },
        (err, r) => {
          if (err) return reject(err);
          resolve({ key: r.public_id, resourceType: r.resource_type, version: r.version ? String(r.version) : null, format: r.format || null });
        }
      );
      stream.end(buffer);
    });
  }

  async getAccessUrl({ key, resourceType, format, ttlSeconds, fileName }) {
    const ttl = ttlSeconds || config().DOCUMENT_ACCESS_TTL_SECONDS || 300;
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;
    const url = cloudinary.utils.private_download_url(key, format || '', {
      ...this.creds,
      resource_type: resourceType || 'image',
      type: 'authenticated',
      expires_at: expiresAt,
      ...(fileName ? { attachment: false } : {}),
    });
    return { url, expiresAt: new Date(expiresAt * 1000).toISOString() };
  }

  async delete({ key, resourceType }) {
    await cloudinary.uploader.destroy(key, { ...this.creds, resource_type: resourceType || 'image', type: 'authenticated', invalidate: true });
  }
}

module.exports = { CloudinaryStorage };
