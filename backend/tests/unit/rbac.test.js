'use strict';
const { ROLES, ROLE_LIST, hasPermission, isValidRole, ROLE_PERMISSIONS, PERMISSIONS } = require('../../src/common/security/rbac');

describe('rbac', () => {
  it('has exactly two application roles', () => {
    expect(ROLE_LIST).toEqual(['super_master_admin', 'clinic_admin']);
    for (const legacy of ['super_admin', 'doctor', 'nurse', 'billing_staff', 'pharmacy_staff', 'patient', 'admin']) expect(isValidRole(legacy)).toBe(false);
  });
  it('super master admin has every permission', () => {
    for (const p of Object.keys(PERMISSIONS)) expect(hasPermission(ROLES.SUPER_MASTER_ADMIN, p)).toBe(true);
  });
  it('clinic admin cannot manage clinics or read system-wide data', () => {
    for (const p of ['clinics:manage', 'clinics:renew', 'reports:system', 'audit:system', 'system:manage', 'system:health']) expect(hasPermission(ROLES.CLINIC_ADMIN, p)).toBe(false);
    for (const p of ['patients:read', 'patients:write', 'clinical:write', 'documents:read', 'fhir:read']) expect(hasPermission(ROLES.CLINIC_ADMIN, p)).toBe(true);
    expect(ROLE_PERMISSIONS[ROLES.CLINIC_ADMIN].every((p) => PERMISSIONS[p])).toBe(true);
  });
  it('unknown roles have no permissions', () => {
    expect(hasPermission('doctor', 'patients:read')).toBe(false);
    expect(hasPermission(undefined, 'patients:read')).toBe(false);
  });
});
