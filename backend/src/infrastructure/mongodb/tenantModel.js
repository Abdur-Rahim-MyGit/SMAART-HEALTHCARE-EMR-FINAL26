'use strict';
/**
 * Helpers that make clinic scoping mandatory for MongoDB access. Every document
 * references PostgreSQL UUIDs (clinicId, patientId, encounterId, createdBy).
 */
const { ROLES } = require('../../common/security/rbac');
const { forbidden } = require('../../common/errors/AppError');
const { SYSTEM_ROLE } = require('../postgres/tenant');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tenantFilter(scope, extra = {}) {
  if (scope.role === ROLES.SUPER_MASTER_ADMIN || scope.role === SYSTEM_ROLE) {
    return { ...extra };
  }
  if (!scope.clinicId) throw forbidden('Missing clinic scope', 'MISSING_CLINIC_SCOPE');
  return { ...extra, clinicId: String(scope.clinicId) };
}

/** Clinic id a document must be written with for this scope. */
function writeClinicId(scope, requested) {
  if (scope.role === ROLES.SUPER_MASTER_ADMIN || scope.role === SYSTEM_ROLE) {
    if (!requested) throw forbidden('clinicId is required', 'CLINIC_REQUIRED');
    return String(requested);
  }
  if (requested && String(requested) !== String(scope.clinicId)) throw forbidden('You can only write to your own clinic', 'CROSS_CLINIC_WRITE');
  return String(scope.clinicId);
}

const uuidField = (required = true) => ({
  type: String,
  required,
  validate: { validator: (v) => v === undefined || v === null || UUID_RE.test(v), message: 'must be a UUID' },
});

module.exports = { tenantFilter, writeClinicId, uuidField, UUID_RE };
