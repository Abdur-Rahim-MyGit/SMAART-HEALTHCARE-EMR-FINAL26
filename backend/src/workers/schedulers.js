'use strict';
const { getKnex } = require('../infrastructure/postgres/knex');
const { withSystem } = require('../infrastructure/postgres/tenant');
const { getLogger } = require('../common/logging/logger');
const { withLock } = require('../infrastructure/redis/lock');
const { exportDocuments } = require('./backupExport');
const { fetchBytes } = require('./consumers/documents');

/** Periodic housekeeping: expire challenges/sessions, flag overdue invoices, deactivate expired clinics' access. */
async function housekeeping() {
  await withLock('scheduler-housekeeping', 60000, async () => {
    await withSystem(async (trx) => {
      await trx('otp_challenges').where('expires_at', '<', trx.raw("now() - interval '1 day'")).delete();
      await trx('auth_sessions').where('expires_at', '<', trx.raw("now() - interval '30 days'")).delete();
      await trx('invoices').whereNull('deleted_at').whereIn('status', ['Pending', 'Approved', 'Partially Paid']).whereNotNull('due_date').where('due_date', '<', trx.fn.now()).update({ status: 'Overdue' });
      await trx('outbox_events').whereNotNull('published_at').where('published_at', '<', trx.raw("now() - interval '7 days'")).delete();
    }, getKnex());
  }, { retries: 0 }).catch((err) => { if (err.code !== 'LOCKED') getLogger().error({ err }, 'housekeeping failed'); });
}

/** Runs once per day (lock protected across worker replicas). */
async function nightlyBackup() {
  await withLock('scheduler-backup', 6 * 60 * 60 * 1000, () => exportDocuments({ fetchBytes }), { retries: 0 }).catch((err) => { if (err.code !== 'LOCKED') getLogger().error({ err }, 'backup export failed'); });
}

function startSchedulers({ intervalMs = 5 * 60 * 1000, backupIntervalMs = 24 * 60 * 60 * 1000 } = {}) {
  const t = setInterval(housekeeping, intervalMs);
  const b = setInterval(nightlyBackup, backupIntervalMs);
  housekeeping();
  if (process.env.BACKUP_DIR) nightlyBackup();
  return () => { clearInterval(t); clearInterval(b); };
}
module.exports = { startSchedulers, housekeeping, nightlyBackup };
