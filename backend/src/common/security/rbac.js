'use strict';
/**
 * Central role based access control. The EMR has exactly two application roles.
 * Practitioners (doctors, nurses, lab technicians) are clinical resources, not roles.
 */
const ROLES = Object.freeze({
  SUPER_MASTER_ADMIN: 'super_master_admin',
  CLINIC_ADMIN: 'clinic_admin',
});
const ROLE_LIST = Object.freeze(Object.values(ROLES));

const PERMISSIONS = Object.freeze({
  'clinics:read': 'View clinic information',
  'clinics:manage': 'Create, update, activate and deactivate clinics',
  'clinics:renew': 'Renew clinic validity',
  'users:read': 'View EMR users',
  'users:manage': 'Create, update and deactivate EMR users',
  'patients:read': 'View patients',
  'patients:write': 'Create and update patients',
  'patients:delete': 'Delete patients',
  'practitioners:read': 'View practitioners (doctors, nurses)',
  'practitioners:write': 'Manage practitioners',
  'appointments:read': 'View appointments',
  'appointments:write': 'Manage appointments',
  'clinical:read': 'View encounters, vitals, conditions, prescriptions, labs, imaging',
  'clinical:write': 'Record clinical data',
  'documents:read': 'View and download documents',
  'documents:write': 'Upload and manage documents',
  'referrals:read': 'View referrals',
  'referrals:write': 'Manage referrals',
  'billing:read': 'View invoices',
  'billing:write': 'Manage invoices',
  'community:read': 'View community posts',
  'community:write': 'Create community posts',
  'reports:read': 'View clinic reports',
  'reports:system': 'View system-wide reports',
  'audit:read': 'View audit logs for own clinic',
  'audit:system': 'View system-wide audit logs',
  'settings:read': 'View clinic settings',
  'settings:write': 'Manage clinic settings',
  'system:manage': 'Manage system settings, integrations and FHIR configuration',
  'system:health': 'View system health',
  'fhir:read': 'Read FHIR resources',
  'fhir:write': 'Write FHIR resources',
  'notifications:read': 'View notifications',
});

const ALL = Object.keys(PERMISSIONS);
const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.SUPER_MASTER_ADMIN]: ALL,
  [ROLES.CLINIC_ADMIN]: ALL.filter((p) => !['clinics:manage', 'clinics:renew', 'reports:system', 'audit:system', 'system:manage', 'system:health', 'users:manage'].includes(p)).concat(['users:manage']),
});

function isValidRole(role) {
  return ROLE_LIST.includes(role);
}
function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role];
  return Array.isArray(perms) && perms.includes(permission);
}
function isSuperMasterAdmin(auth) {
  return !!auth && auth.role === ROLES.SUPER_MASTER_ADMIN;
}

module.exports = { ROLES, ROLE_LIST, PERMISSIONS, ROLE_PERMISSIONS, isValidRole, hasPermission, isSuperMasterAdmin };
