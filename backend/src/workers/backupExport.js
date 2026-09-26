'use strict';
/**
 * Nightly document backup export. Cloudinary is the file store; this job keeps an
 * independent, encrypted-at-rest copy of the document index (and optionally the
 * bytes) under BACKUP_DIR so file recovery never depends on Cloudinary alone.
 *   BACKUP_DIR=/mnt/backups BACKUP_COPY_FILES=true
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { getKnex } = require('../infrastructure/postgres/knex');
const { withSystem } = require('../infrastructure/postgres/tenant');
const { getLogger } = require('../common/logging/logger');

async function exportDocuments({ dir = process.env.BACKUP_DIR, copyFiles = process.env.BACKUP_COPY_FILES === 'true', fetchBytes } = {}) {
  if (!dir) return { skipped: true };
  const knex = getKnex();
  const day = new Date().toISOString().slice(0, 10);
  const target = path.join(dir, day);
  await fs.mkdir(path.join(target, 'files'), { recursive: true });
  const docs = await withSystem((trx) => trx('documents').whereNull('deleted_at').where('status', 'available').select('id', 'clinic_id', 'patient_id', 'category', 'document_type', 'original_file_name', 'mime_type', 'size_bytes', 'checksum_sha256', 'storage_provider', 'storage_key', 'storage_resource_type', 'storage_version', 'created_at'), knex);
  const manifest = { exportedAt: new Date().toISOString(), count: docs.length, documents: docs };
  await fs.writeFile(path.join(target, 'documents-manifest.json'), JSON.stringify(manifest));
  let copied = 0;
  let failed = 0;
  if (copyFiles && fetchBytes) {
    for (const d of docs) {
      const dest = path.join(target, 'files', `${d.id}${path.extname(d.original_file_name || '')}`);
      try {
        await fs.access(dest);
        continue; // already copied on a previous run today
      } catch { /* not yet copied */ }
      try {
        const bytes = await fetchBytes(d);
        const sum = crypto.createHash('sha256').update(bytes).digest('hex');
        if (d.checksum_sha256 && sum !== d.checksum_sha256) throw new Error('checksum mismatch');
        await fs.writeFile(dest, bytes);
        copied++;
      } catch (err) {
        failed++;
        getLogger().warn({ err, documentId: d.id }, 'backup copy failed');
      }
    }
  }
  await withSystem((trx) => trx('audit_logs').insert({ action: 'DOCUMENT_BACKUP_EXPORTED', resource_type: 'system', result: failed ? 'PARTIAL' : 'SUCCESS', details: JSON.stringify({ day, count: docs.length, copied, failed }) }), knex);
  return { day, count: docs.length, copied, failed, manifest: path.join(target, 'documents-manifest.json') };
}
module.exports = { exportDocuments };
