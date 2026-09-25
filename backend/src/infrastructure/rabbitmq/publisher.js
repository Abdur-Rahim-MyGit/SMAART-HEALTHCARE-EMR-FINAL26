'use strict';
const { getChannel } = require('./connection');
const { config } = require('../../config');

/** Publishes one event with publisher confirms. Resolves when the broker acknowledges. */
function publishEvent(event) {
  const ch = getChannel();
  if (!ch) throw new Error('RabbitMQ channel not available');
  const env = config();
  const body = Buffer.from(JSON.stringify(event));
  return new Promise((resolve, reject) => {
    ch.publish(
      env.RABBITMQ_EXCHANGE,
      event.type,
      body,
      { persistent: true, contentType: 'application/json', messageId: event.id, timestamp: Math.floor(Date.now() / 1000), headers: { 'x-attempt': 0, 'x-clinic-id': event.clinicId || '' } },
      (err) => (err ? reject(err) : resolve())
    );
  });
}

module.exports = { publishEvent };
