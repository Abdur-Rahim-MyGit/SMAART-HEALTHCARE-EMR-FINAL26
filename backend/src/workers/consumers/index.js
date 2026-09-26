'use strict';
const { config } = require('../../config');
const { consume } = require('../../infrastructure/rabbitmq/consumer');
const { topology } = require('../../infrastructure/rabbitmq/connection');
const { emailHandler } = require('./email');
const { notificationHandler } = require('./notifications');
const { fhirSyncHandler } = require('./fhirSync');
const { documentHandler } = require('./documents');
const { analyticsHandler } = require('./analytics');

async function startConsumers() {
  const t = topology(config().RABBITMQ_EXCHANGE);
  await consume(t.queues.email.name, emailHandler);
  await consume(t.queues.notifications.name, notificationHandler);
  await consume(t.queues.fhirSync.name, fhirSyncHandler, { prefetch: 5 });
  await consume(t.queues.documents.name, documentHandler, { prefetch: 2 });
  await consume(t.queues.audit.name, analyticsHandler, { prefetch: 50 });
}
module.exports = { startConsumers };
