'use strict';
const { ROLES } = require('../security/rbac');
const { forbidden, badRequest } = require('../errors/AppError');
const { uuid } = require('../validation/schemas');

/**
 * Resolves the clinic a request acts on. Clinic admins are always bound to their
 * own clinic; anything else they send is ignored or rejected. The super master
 * admin may target a clinic via X-Clinic-Id header / ?clinicId / :clinicId.
 * Result: req.scope = { role, clinicId (may be null for SMA), userId }.
 */
function tenantScope({ paramName = 'clinicId', requireForSma = false } = {}) {
  return (req, _res, next) => {
    const auth = req.auth;
    const requested = req.params?.[paramName] || req.get('x-clinic-id') || req.query?.clinicId || req.body?.clinicId;
    if (auth.role === ROLES.CLINIC_ADMIN) {
      if (requested && String(requested) !== String(auth.clinicId)) {
        return next(forbidden('Access denied. You can only access your own clinic.', 'CROSS_CLINIC_ACCESS'));
      }
      req.scope = { role: auth.role, clinicId: auth.clinicId, userId: auth.userId };
      return next();
    }
    // super master admin
    let clinicId = null;
    if (requested) {
      const parsed = uuid.safeParse(String(requested));
      if (!parsed.success) return next(badRequest('Invalid clinic identifier', 'INVALID_CLINIC_ID'));
      clinicId = parsed.data;
    }
    if (requireForSma && !clinicId) return next(badRequest('clinicId is required', 'CLINIC_REQUIRED'));
    req.scope = { role: auth.role, clinicId, userId: auth.userId };
    next();
  };
}

module.exports = { tenantScope };
