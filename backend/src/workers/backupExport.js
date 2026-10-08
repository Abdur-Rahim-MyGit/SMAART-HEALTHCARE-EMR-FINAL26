'use strict';
/**
 * Nightly document backup export. Cloudinary is the file store; this job keeps an
 * independent copy of the document index (and optionally the bytes) under
 * BACKUP_DIR so file recovery never depends on Cloudinary alone. Database
 * backups themselves are taken with mongodump (see docs/operations/README.md).
 *   BACKUP_DIR=/mnt/backups BACKUP_COPY_FILES=true
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { withSystem } = require('../infrastructure/mongodb/tenant');
const { writeAudit } = require('../modules/audit/auditRepository');
const { getLogger } = require('../common/logging/logger');

const MANIFEST_FIELDS = ['_id', 'clinicId', 'patientId', 'category', 'documentType', 'originalFileName', 'mimeType', 'sizeBytes', 'checksumSha256', 'storageProvider', 'storageKey', 'storageResourceType', 'storageVersion', 'createdAt'];

async function exportDocuments({ dir = process.env.BACKUP_DIR, copyFiles = process.env.BACKUP_COPY_FILES === 'true', fetchBytes } = {}) {
  if (!dir) return { skipped: true };
  const day = new Date().toISOString().slice(0, 10);
  const target = path.join(dir, day);
  await fs.mkdir(path.join(target, 'files'), { recursive: true });
  const docs = await withSystem((db) => db.c('documents').find({ status: 'available' }, { projection: Object.fromEntries(MANIFEST_FIELDS.map((f) => [f, 1])) }));
  const manifest = { exportedAt: new Date().toISOString(), count: docs.length, documents: docs.map((d) => ({ ...d, id: d._id })) };
  await fs.writeFile(path.join(target, 'documents-manifest.json'), JSON.stringify(manifest));
  let copied = 0;
  let failed = 0;
  if (copyFiles && fetchBytes) {
    for (const d of docs) {
      const dest = path.join(target, 'files', `${d._id}${path.extname(d.originalFileName || '')}`);
      try {
        await fs.access(dest);
        continue; // already copied on a previous run today
      } catch { /* not yet copied */ }
      try {
        const bytes = await fetchBytes(d);
        const sum = crypto.createHash('sha256').update(bytes).digest('hex');
        if (d.checksumSha256 && sum !== d.checksumSha256) throw new Error('checksum mismatch');
        await fs.writeFile(dest, bytes);
        copied++;
      } catch (err) {
        failed++;
        getLogger().warn({ err, documentId: d._id }, 'backup copy failed');
      }
    }
  }
  await writeAudit({ action: 'DOCUMENT_BACKUP_EXPORTED', resourceType: 'system', result: failed ? 'PARTIAL' : 'SUCCESS', details: { day, count: docs.length, copied, failed } });
  return { day, count: docs.length, copied, failed, manifest: path.join(target, 'documents-manifest.json') };
}
module.exports = { exportDocuments };
