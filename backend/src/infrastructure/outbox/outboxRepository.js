'use strict';
const crypto = require('crypto');

/**
 * Transactional outbox: services append events inside the same transaction as
 * their data change; the publisher worker delivers them to RabbitMQ.
 */
async function enqueueEvent(trx, { type, aggregateType, aggregateId, clinicId, payload = {}, actorId }) {
  const id = crypto.randomUUID();
  await trx('outbox_events').insert({ id, event_type: type, aggregate_type: aggregateType, aggregate_id: aggregateId ? String(aggregateId) : null, clinic_id: clinicId || null, actor_id: actorId || null, payload: JSON.stringify(payload) });
  return id;
}

async function claimPending(knex, limit = 50) {
  return knex.transaction(async (trx) => {
    const rows = await trx('outbox_events')
      .whereNull('published_at')
      .andWhere('next_attempt_at', '<=', trx.fn.now())
      .orderBy('created_at', 'asc')
      .limit(limit)
      .forUpdate()
      .skipLocked();
    return rows;
  });
}

async function markPublished(knex, id) {
  await knex('outbox_events').where({ id }).update({ published_at: knex.fn.now() });
}
async function markFailed(knex, id, error, attempts) {
  const backoffSeconds = Math.min(3600, 10 * 2 ** attempts);
  await knex('outbox_events').where({ id }).update({ attempts: attempts + 1, last_error: String(error && error.message).slice(0, 500), next_attempt_at: knex.raw(`now() + (? * interval '1 second')`, [backoffSeconds]) });
}

module.exports = { enqueueEvent, claimPending, markPublished, markFailed };
