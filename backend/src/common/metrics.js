'use strict';
const client = require('prom-client');

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'smaart_' });

const httpDuration = new client.Histogram({ name: 'smaart_http_request_duration_seconds', help: 'HTTP request latency', labelNames: ['method', 'route', 'status'], buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5], registers: [registry] });
const httpErrors = new client.Counter({ name: 'smaart_http_errors_total', help: 'HTTP 5xx responses', labelNames: ['route'], registers: [registry] });
const authFailures = new client.Counter({ name: 'smaart_auth_failures_total', help: 'Authentication / authorization failures', labelNames: ['kind'], registers: [registry] });
const outboxPending = new client.Gauge({ name: 'smaart_outbox_pending', help: 'Unpublished outbox events', registers: [registry] });
const outboxPublished = new client.Counter({ name: 'smaart_outbox_published_total', help: 'Outbox events published', registers: [registry] });
const workerFailures = new client.Counter({ name: 'smaart_worker_failures_total', help: 'Worker handler failures', labelNames: ['queue'], registers: [registry] });
const dlqDepth = new client.Gauge({ name: 'smaart_rabbitmq_dlq_depth', help: 'Messages in the dead-letter queue', registers: [registry] });
const dbPool = new client.Gauge({ name: 'smaart_db_pool', help: 'PostgreSQL pool state', labelNames: ['state'], registers: [registry] });

function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = (req.baseUrl || '') + (req.route?.path || req.path || 'unknown');
    end({ method: req.method, route, status: String(res.statusCode) });
    if (res.statusCode >= 500) httpErrors.inc({ route });
    if (res.statusCode === 401) authFailures.inc({ kind: 'unauthenticated' });
    if (res.statusCode === 403) authFailures.inc({ kind: 'forbidden' });
  });
  next();
}

async function metricsHandler(_req, res) {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}

module.exports = { registry, metricsMiddleware, metricsHandler, outboxPending, outboxPublished, workerFailures, dlqDepth, dbPool, authFailures };
