'use strict';
const crypto = require('crypto');
const { withTenant, withSystem, clinicFilter } = require('../../infrastructure/mongodb/tenant');

const record = (r) => ({ _id: crypto.randomUUID(), occurredAt: new Date(), userId: r.user_id ?? r.userId ?? null, role: r.role ?? null, clinicId: r.clinic_id ?? r.clinicId ?? null, action: r.action, resourceType: r.resource_type ?? r.resourceType ?? null, resourceId: r.resource_id ?? r.resourceId ?? null, ip: r.ip ?? null, userAgent: r.user_agent ?? r.userAgent ?? null, requestId: r.request_id ?? r.requestId ?? null, result: r.result ?? null, details: typeof r.details === 'string' ? JSON.parse(r.details || '{}') : r.details || {} });

/** Append-only writer. Runs as system so denied requests are still recorded. */
async function writeAudit(r) {
  return withSystem((db) => db.raw('audit_logs').insertOne(record(r)));
}

/** Record an action inside the current unit of work. */
async function auditInTrx(db, scope, { action, resourceType, resourceId, result = 'SUCCESS', details = {}, requestId, ip }) {
  await db.c('audit_logs').col.insertOne(record({ userId: scope.userId, role: scope.role, clinicId: scope.clinicId, action, resourceType, resourceId: resourceId ? String(resourceId) : null, result, requestId, ip, details }), { session: db.session });
}

async function listAudit(scope, { page, limit, offset, action, resourceType, userId, from, to }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    const clinicId = clinicFilter(scope);
    if (clinicId) filter.clinicId = clinicId;
    if (action) filter.action = action;
    if (resourceType) filter.resourceType = resourceType;
    if (userId) filter.userId = userId;
    if (from || to) filter.occurredAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const col = db.c('audit_logs');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { occurredAt: -1 }, limit, skip: offset }), col.count(filter)]);
    return { rows, total, page, limit };
  });
}

module.exports = { writeAudit, auditInTrx, listAudit };
