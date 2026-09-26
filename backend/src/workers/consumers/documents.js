'use strict';
const fs = require('fs/promises');
const { withSystem } = require('../../infrastructure/mongodb/tenant');
const { getStorage } = require('../../infrastructure/storage');
const { scanBuffer, scannerConfig } = require('../../infrastructure/security/malwareScanner');
const { accessUrlFor } = require('../../modules/documents/documentService');
const { writeAudit } = require('../../modules/audit/auditRepository');
const { getLogger } = require('../../common/logging/logger');

/** Fetches the bytes of a stored document through the storage provider (signed URL or local path). */
async function fetchBytes(doc) {
  const storage = getStorage();
  if (storage.name === 'local' && doc.storageProvider === 'local') return fs.readFile(storage.resolvePath(doc.storageKey));
  const a = await accessUrlFor(doc, { ttlSeconds: 120 });
  if (!a || !a.url || !/^https?:/.test(a.url)) throw new Error('document bytes not reachable');
  const res = await fetch(a.url);
  if (!res.ok) throw new Error(`fetch failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const setScan = (id, set) => withSystem((db) => db.c('documents').updateOne({ _id: id }, set, { includeDeleted: true }));

/**
 * document.uploaded → malware scan (ClamAV when configured), result recorded on the document;
 * infected files are quarantined (never served) and audited.
 * document.deleted  → purge the asset from storage.
 */
async function documentHandler(event) {
  if (event.type === 'document.deleted') {
    const { storageProvider, storageKey, resourceType } = event.payload || {};
    const storage = getStorage();
    if (storageProvider && storageProvider === storage.name && storageKey) await storage.delete({ key: storageKey, resourceType });
    return;
  }
  if (event.type !== 'document.uploaded') return;
  const doc = await withSystem((db) => db.c('documents').findById(event.aggregateId));
  if (!doc || doc.storageProvider === 'legacy_url') return;
  const cfg = scannerConfig();
  if (!cfg) return; // scanning infrastructure not configured: document stays not_scanned
  await setScan(doc._id, { scanStatus: 'pending' });
  try {
    const bytes = await fetchBytes(doc);
    const result = await scanBuffer(bytes, cfg);
    if (result.status === 'infected') {
      await setScan(doc._id, { scanStatus: 'infected', status: 'quarantined', 'metadata.malware': result.signature });
      await writeAudit({ clinicId: doc.clinicId, action: 'DOCUMENT_QUARANTINED', resourceType: 'document', resourceId: doc._id, result: 'FAILURE', details: { signature: result.signature } });
    } else {
      await setScan(doc._id, { scanStatus: 'clean' });
    }
  } catch (err) {
    getLogger().error({ err, documentId: doc._id }, 'malware scan failed');
    await setScan(doc._id, { scanStatus: 'error' });
    throw err; // retried by the consumer, then dead-lettered
  }
}
module.exports = { documentHandler, fetchBytes };
