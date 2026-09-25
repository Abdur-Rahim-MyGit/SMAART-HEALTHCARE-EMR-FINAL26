'use strict';
const { getLogger } = require('../logging/logger');

/**
 * Records an audit event after the response finishes. `write` persists the row
 * (append only). Failures never break the request; they are logged.
 */
function auditEvent(write, action, { resourceType, resourceIdFrom = (req) => req.params.id, includeResult = true } = {}) {
  return (req, res, next) => {
    res.on('finish', () => {
      const denied = res.statusCode === 403 || res.statusCode === 401;
      const record = {
        user_id: req.auth?.userId || null,
        role: req.auth?.role || null,
        clinic_id: req.scope?.clinicId || req.auth?.clinicId || null,
        action: denied ? (res.statusCode === 401 ? 'UNAUTHORIZED_ACCESS' : 'PERMISSION_DENIED') : action,
        resource_type: resourceType || null,
        resource_id: (() => { try { const v = resourceIdFrom(req, res); return v ? String(v) : null; } catch { return null; } })(),
        ip: req.ip,
        user_agent: (req.get('user-agent') || '').slice(0, 300),
        request_id: req.id,
        result: includeResult ? (res.statusCode < 400 ? 'SUCCESS' : 'FAILURE') : null,
        details: JSON.stringify({ status: res.statusCode, method: req.method, path: req.originalUrl.split('?')[0], attemptedAction: denied ? action : undefined }),
      };
      Promise.resolve(write(record)).catch((err) => getLogger().error({ err }, 'audit write failed'));
    });
    next();
  };
}

module.exports = { auditEvent };
