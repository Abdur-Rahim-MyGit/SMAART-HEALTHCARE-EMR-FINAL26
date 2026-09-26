'use strict';
const { hasPermission } = require('../security/rbac');
const { forbidden, unauthorized } = require('../errors/AppError');

/** Requires every listed permission. Denials are audited by the audit middleware. */
function authorize(...permissions) {
  return (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    for (const p of permissions) {
      if (!hasPermission(req.auth.role, p)) {
        req.authzDenied = p;
        return next(forbidden('Access denied. You do not have permission to perform this action.', 'PERMISSION_DENIED'));
      }
    }
    next();
  };
}

module.exports = { authorize };
