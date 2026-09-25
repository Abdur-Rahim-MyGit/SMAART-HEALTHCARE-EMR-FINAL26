'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant, withSystem } = require('../../infrastructure/postgres/tenant');

/** Append-only writer. Runs as system so denied requests are still recorded. */
async function writeAudit(record) {
  return withSystem((trx) => trx('audit_logs').insert(record), getKnex());
}

/** Convenience for services: record an action inside the current transaction. */
async function auditInTrx(trx, scope, { action, resourceType, resourceId, result = 'SUCCESS', details = {}, requestId, ip }) {
  await trx('audit_logs').insert({
    user_id: scope.userId || null,
    role: scope.role || null,
    clinic_id: scope.clinicId || null,
    action,
    resource_type: resourceType || null,
    resource_id: resourceId ? String(resourceId) : null,
    result,
    request_id: requestId || null,
    ip: ip || null,
    details: JSON.stringify(details),
  });
}

async function listAudit(scope, { page, limit, offset, action, resourceType, userId, from, to }) {
  return withTenant(scope, async (trx) => {
    let q = trx('audit_logs');
    if (scope.clinicId) q = q.where('clinic_id', scope.clinicId);
    if (action) q = q.where('action', action);
    if (resourceType) q = q.where('resource_type', resourceType);
    if (userId) q = q.where('user_id', userId);
    if (from) q = q.where('occurred_at', '>=', from);
    if (to) q = q.where('occurred_at', '<=', to);
    const [{ count }] = await q.clone().count({ count: '*' });
    const rows = await q.orderBy('occurred_at', 'desc').limit(limit).offset(offset);
    return { rows, total: Number(count), page, limit };
  });
}

module.exports = { writeAudit, auditInTrx, listAudit };
