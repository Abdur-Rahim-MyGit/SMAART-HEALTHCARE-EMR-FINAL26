'use strict';
const { withSystem } = require('../infrastructure/mongodb/tenant');
const { getLogger } = require('../common/logging/logger');
const { withLock } = require('../infrastructure/redis/lock');
const { exportDocuments } = require('./backupExport');
const { fetchBytes } = require('./consumers/documents');

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

/** Periodic housekeeping: expire challenges/sessions, flag overdue invoices, prune published outbox events. */
async function housekeeping() {
  await withLock('scheduler-housekeeping', 60000, async () => {
    await withSystem(async (db) => {
      await db.raw('otp_challenges').deleteMany({ expiresAt: { $lt: daysAgo(1) } });
      await db.raw('auth_sessions').deleteMany({ expiresAt: { $lt: daysAgo(30) } });
      await db.c('invoices').updateMany({ status: { $in: ['Pending', 'Approved', 'Partially Paid'] }, dueDate: { $ne: null, $lt: new Date() } }, { status: 'Overdue' });
      await db.raw('outbox_events').deleteMany({ publishedAt: { $ne: null, $lt: daysAgo(7) } });
    });
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
