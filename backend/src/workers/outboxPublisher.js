'use strict';
const { getKnex } = require('../infrastructure/postgres/knex');
const { getLogger } = require('../common/logging/logger');
const { isRabbitConnected, connectRabbit } = require('../infrastructure/rabbitmq/connection');
const { publishEvent } = require('../infrastructure/rabbitmq/publisher');
const { claimPending, markPublished, markFailed } = require('../infrastructure/outbox/outboxRepository');
const { withLock } = require('../infrastructure/redis/lock');
const metrics = require('../common/metrics');

/** Publishes one batch. Returns the number of events published. Safe to run concurrently (Redis lock + SKIP LOCKED). */
async function publishBatch(limit = 50) {
  const knex = getKnex();
  if (!isRabbitConnected()) {
    try { await connectRabbit(); } catch { /* stays in outbox */ }
    if (!isRabbitConnected()) return 0;
  }
  return withLock('outbox-publisher', 30000, async () => {
    const rows = await claimPending(knex, limit);
    let n = 0;
    for (const row of rows) {
      const event = { id: row.id, type: row.event_type, aggregateType: row.aggregate_type, aggregateId: row.aggregate_id, clinicId: row.clinic_id, actorId: row.actor_id, occurredAt: row.created_at, payload: row.payload };
      try {
        await publishEvent(event);
        await markPublished(knex, row.id);
        metrics.outboxPublished.inc();
        n++;
      } catch (err) {
        await markFailed(knex, row.id, err, row.attempts);
        getLogger().error({ err, eventId: row.id }, 'outbox publish failed');
      }
    }
    const [{ c }] = await knex('outbox_events').whereNull('published_at').count({ c: '*' });
    metrics.outboxPending.set(Number(c));
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
