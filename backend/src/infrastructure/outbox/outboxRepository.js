'use strict';
const crypto = require('crypto');
const { getDb } = require('../mongodb/connection');

/**
 * Transactional outbox: services append events inside the same transaction as
 * their data change; the publisher worker delivers them to RabbitMQ.
 */
async function enqueueEvent(db, { type, aggregateType, aggregateId, clinicId, payload = {}, actorId }) {
  const id = crypto.randomUUID();
  await getDb().collection('outbox_events').insertOne({ _id: id, eventType: type, aggregateType, aggregateId: aggregateId ? String(aggregateId) : null, clinicId: clinicId || null, actorId: actorId || null, payload, createdAt: new Date(), publishedAt: null, attempts: 0, lastError: null, nextAttemptAt: new Date(), claimedUntil: null }, { session: db.session });
  return id;
}

/** Claims a batch with a short lease so several publishers never double-deliver. */
async function claimPending(limit = 50, leaseMs = 30000) {
  const col = getDb().collection('outbox_events');
  const now = new Date();
  const claimed = [];
  for (let i = 0; i < limit; i++) {
    const row = await col.findOneAndUpdate({ publishedAt: null, nextAttemptAt: { $lte: now }, $or: [{ claimedUntil: null }, { claimedUntil: { $lt: now } }] }, { $set: { claimedUntil: new Date(Date.now() + leaseMs) } }, { sort: { createdAt: 1 }, returnDocument: 'after' });
    if (!row) break;
    claimed.push(row);
  }
  return claimed;
}
async function markPublished(id) {
  await getDb().collection('outbox_events').updateOne({ _id: id }, { $set: { publishedAt: new Date(), claimedUntil: null } });
}
async function markFailed(id, error, attempts) {
  const backoffSeconds = Math.min(3600, 10 * 2 ** attempts);
  await getDb().collection('outbox_events').updateOne({ _id: id }, { $set: { attempts: attempts + 1, lastError: String(error && error.message).slice(0, 500), nextAttemptAt: new Date(Date.now() + backoffSeconds * 1000), claimedUntil: null } });
}
async function pendingCount() {
  return getDb().collection('outbox_events').countDocuments({ publishedAt: null });
}

module.exports = { enqueueEvent, claimPending, markPublished, markFailed, pendingCount };
