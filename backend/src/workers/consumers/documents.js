'use strict';
const fs = require('fs/promises');
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withSystem } = require('../../infrastructure/postgres/tenant');
const { getStorage } = require('../../infrastructure/storage');
const { scanBuffer, scannerConfig } = require('../../infrastructure/security/malwareScanner');
const { accessUrlFor } = require('../../modules/documents/documentService');
const { getLogger } = require('../../common/logging/logger');

/** Fetches the bytes of a stored document through the storage provider (signed URL or local path). */
async function fetchBytes(doc) {
  const storage = getStorage();
  if (storage.name === 'local' && doc.storage_provider === 'local') return fs.readFile(storage.resolvePath(doc.storage_key));
  const a = await accessUrlFor(doc, { ttlSeconds: 120 });
  if (!a || !a.url || !/^https?:/.test(a.url)) throw new Error('document bytes not reachable');
  const res = await fetch(a.url);
  if (!res.ok) throw new Error(`fetch failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * document.uploaded → malware scan (ClamAV when configured), result recorded on the row;
 * infected files are quarantined (never served) and audited.
 * document.deleted  → purge the asset from storage.
 */
async function documentHandler(event) {
  const knex = getKnex();
  if (event.type === 'document.deleted') {
    const { storageProvider, storageKey, resourceType } = event.payload || {};
    const storage = getStorage();
    if (storageProvider && storageProvider === storage.name && storageKey) await storage.delete({ key: storageKey, resourceType });
    return;
  }
  if (event.type !== 'document.uploaded') return;
  const doc = await withSystem((trx) => trx('documents').where({ id: event.aggregateId }).first(), knex);
  if (!doc || doc.storage_provider === 'legacy_url') return;
  const cfg = scannerConfig();
  if (!cfg) return; // scanning infrastructure not configured: document stays not_scanned
  await withSystem((trx) => trx('documents').where({ id: doc.id }).update({ scan_status: 'pending' }), knex);
  try {
    const bytes = await fetchBytes(doc);
    const result = await scanBuffer(bytes, cfg);
    await withSystem(async (trx) => {
      if (result.status === 'infected') {
        await trx('documents').where({ id: doc.id }).update({ scan_status: 'infected', status: 'quarantined', metadata: trx.raw(`metadata || ?::jsonb`, [JSON.stringify({ malware: result.signature })]) });
        await trx('audit_logs').insert({ clinic_id: doc.clinic_id, action: 'DOCUMENT_QUARANTINED', resource_type: 'document', resource_id: doc.id, result: 'FAILURE', details: JSON.stringify({ signature: result.signature }) });
      } else {
        await trx('documents').where({ id: doc.id }).update({ scan_status: 'clean' });
      }
    }, knex);
  } catch (err) {
    getLogger().error({ err, documentId: doc.id }, 'malware scan failed');
    await withSystem((trx) => trx('documents').where({ id: doc.id }).update({ scan_status: 'error' }), knex);
    throw err; // retried by the consumer, then dead-lettered
  }
}
module.exports = { documentHandler, fetchBytes };
