'use strict';
const { getLogger } = require('../common/logging/logger');
const { isRabbitConnected, connectRabbit } = require('../infrastructure/rabbitmq/connection');
const { publishEvent } = require('../infrastructure/rabbitmq/publisher');
const { claimPending, markPublished, markFailed, pendingCount } = require('../infrastructure/outbox/outboxRepository');
const { withLock } = require('../infrastructure/redis/lock');
const metrics = require('../common/metrics');

/** Publishes one batch. Returns the number of events published. Safe to run concurrently (Redis lock + per-event lease). */
async function publishBatch(limit = 50) {
  if (!isRabbitConnected()) {
    try { await connectRabbit(); } catch { /* stays in outbox */ }
    if (!isRabbitConnected()) return 0;
  }
  return withLock('outbox-publisher', 30000, async () => {
    const rows = await claimPending(limit);
    let n = 0;
    for (const row of rows) {
      const event = { id: row._id, type: row.eventType, aggregateType: row.aggregateType, aggregateId: row.aggregateId, clinicId: row.clinicId, actorId: row.actorId, occurredAt: row.createdAt, payload: row.payload };
      try {
        await publishEvent(event);
        await markPublished(row._id);
        metrics.outboxPublished.inc();
        n++;
      } catch (err) {
        await markFailed(row._id, err, row.attempts);
        getLogger().error({ err, eventId: row._id }, 'outbox publish failed');
      }
    }
    metrics.outboxPending.set(await pendingCount());
    return n;
  }, { retries: 0 }).catch((err) => { if (err.code !== 'LOCKED') throw err; return 0; });
}

function startOutboxPublisher({ intervalMs = 2000 } = {}) {
  let running = true;
  const loop = async () => {
    while (running) {
      try { await publishBatch(); } catch (err) { getLogger().error({ err }, 'outbox loop error'); }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };
  loop();
  return () => { running = false; };
}
module.exports = { publishBatch, startOutboxPublisher };
