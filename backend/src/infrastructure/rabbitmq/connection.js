'use strict';
const amqplib = require('amqplib');
const { config } = require('../../config');
const { getLogger } = require('../../common/logging/logger');

const RETRY_DELAYS_MS = [5000, 30000, 120000];

let connection;
let channel;

const topology = (exchange) => ({
  exchange,
  retryExchange: `${exchange}.retry`,
  dlx: `${exchange}.dlx`,
  dlq: 'smaart.dlq',
  queues: {
    email: { name: 'smaart.email', bindings: ['auth.*', 'notification.email.*', 'clinic.*'] },
    notifications: { name: 'smaart.notifications', bindings: ['patient.*', 'appointment.*', 'encounter.*', 'prescription.*', 'lab.*', 'document.*', 'referral.*'] },
    fhirSync: { name: 'smaart.fhir-sync', bindings: ['patient.*', 'encounter.*', 'appointment.*', 'prescription.*', 'lab.*', 'document.*'] },
    documents: { name: 'smaart.document-processing', bindings: ['document.uploaded'] },
    audit: { name: 'smaart.analytics', bindings: ['#'] },
  },
});

async function connectRabbit() {
  const env = config();
  if (!env.RABBITMQ_URL) {
    if (env.RABBITMQ_REQUIRED) throw new Error('RABBITMQ_URL is required');
    getLogger().warn('RABBITMQ_URL not set: events stay in the outbox until a broker is configured');
    return null;
  }
  connection = await amqplib.connect(env.RABBITMQ_URL);
  connection.on('error', (err) => getLogger().error({ err }, 'rabbitmq connection error'));
  connection.on('close', () => {
    getLogger().warn('rabbitmq connection closed');
    connection = undefined;
    channel = undefined;
  });
  channel = await connection.createConfirmChannel();
  await assertTopology(channel, topology(env.RABBITMQ_EXCHANGE));
  getLogger().info('rabbitmq connected');
  return channel;
}

async function assertTopology(ch, t) {
  await ch.assertExchange(t.exchange, 'topic', { durable: true });
  await ch.assertExchange(t.retryExchange, 'direct', { durable: true });
  await ch.assertExchange(t.dlx, 'fanout', { durable: true });
  await ch.assertQueue(t.dlq, { durable: true });
  await ch.bindQueue(t.dlq, t.dlx, '');
  for (const q of Object.values(t.queues)) {
    await ch.assertQueue(q.name, { durable: true, deadLetterExchange: t.dlx });
    for (const b of q.bindings) await ch.bindQueue(q.name, t.exchange, b);
    // One delayed retry queue per attempt, per consumer queue: message TTL then back to the work queue.
    for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
      const rq = `${q.name}.retry.${i}`;
      await ch.assertQueue(rq, { durable: true, messageTtl: RETRY_DELAYS_MS[i], deadLetterExchange: t.retryExchange, deadLetterRoutingKey: q.name });
      await ch.bindQueue(rq, t.retryExchange, rq);
    }
    await ch.bindQueue(q.name, t.retryExchange, q.name);
  }
}

function getChannel() {
  return channel || null;
}
function isRabbitConnected() {
  return !!channel;
}
function isRabbitConfigured() {
  return !!config().RABBITMQ_URL;
}
async function closeRabbit() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch {
    /* ignore */
  }
  channel = undefined;
  connection = undefined;
}

module.exports = { connectRabbit, getChannel, isRabbitConnected, isRabbitConfigured, closeRabbit, topology, RETRY_DELAYS_MS };
