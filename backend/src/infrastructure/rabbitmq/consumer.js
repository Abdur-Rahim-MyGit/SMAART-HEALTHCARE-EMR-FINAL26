'use strict';
const { getChannel, topology, RETRY_DELAYS_MS } = require('./connection');
const { config } = require('../../config');
const { getLogger } = require('../../common/logging/logger');

/**
 * Consumes a queue with bounded retries. After RETRY_DELAYS_MS.length failures the
 * message is rejected without requeue and lands in the dead-letter queue.
 */
async function consume(queueName, handler, { prefetch = 10 } = {}) {
  const ch = getChannel();
  if (!ch) throw new Error('RabbitMQ channel not available');
  const env = config();
  const t = topology(env.RABBITMQ_EXCHANGE);
  const log = getLogger().child({ queue: queueName });
  await ch.prefetch(prefetch);
  await ch.consume(queueName, async (msg) => {
    if (!msg) return;
    const attempt = Number(msg.properties.headers?.['x-attempt'] || 0);
    let event;
    try {
      event = JSON.parse(msg.content.toString());
      await handler(event, { attempt, routingKey: msg.fields.routingKey });
      ch.ack(msg);
    } catch (err) {
      log.error({ err, attempt, messageId: msg.properties.messageId }, 'consumer failure');
      if (attempt < RETRY_DELAYS_MS.length) {
        const retryQueue = `${queueName}.retry.${attempt}`;
        ch.publish(t.retryExchange, retryQueue, msg.content, { ...msg.properties, headers: { ...msg.properties.headers, 'x-attempt': attempt + 1, 'x-last-error': String(err.message).slice(0, 200) } });
        ch.ack(msg);
      } else {
        ch.nack(msg, false, false); // → dead letter queue
      }
    }
  });
  log.info('consumer started');
}

module.exports = { consume };
