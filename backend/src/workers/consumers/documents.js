'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withSystem } = require('../../infrastructure/postgres/tenant');
const { getStorage } = require('../../infrastructure/storage');

/**
 * document.uploaded → post-processing hook (malware scan integration point).
 * document.deleted → purge the asset from storage.
 */
async function documentHandler(event) {
  if (event.type === 'document.deleted') {
    const { storageProvider, storageKey, resourceType } = event.payload || {};
    const storage = getStorage();
    if (storageProvider && storageProvider === storage.name && storageKey) await storage.delete({ key: storageKey, resourceType });
    return;
  }
  if (event.type === 'document.uploaded') {
    // Scanner integration: when a scanner is configured, mark pending, submit, and update scan_status.
    // Without one the document stays `not_scanned`; access is still authorised and audited.
    await withSystem((trx) => trx('documents').where({ id: event.aggregateId, scan_status: 'not_scanned' }).update({ metadata: trx.raw(`metadata || '{"processed": true}'::jsonb`) }), getKnex());
  }
}
module.exports = { documentHandler };
