'use strict';
/**
 * Registry of every collection: which field carries the clinic (tenant) scope,
 * whether documents are soft-deleted, and which are append-only.
 * The registry drives the tenant wrapper, so a collection cannot be queried
 * without its clinic scope being applied for clinic admins.
 */
const C = Object.freeze({
  // identity & tenancy
  clinics: { tenantField: '_id', softDelete: true },
  users: { tenantField: 'clinicId', softDelete: true, requireTenant: false },
  roles: { tenantField: null },
  permissions: { tenantField: null },
  role_permissions: { tenantField: null },
  auth_sessions: { tenantField: null, systemOnly: true },
  otp_challenges: { tenantField: null, systemOnly: true },
  // people
  practitioners: { tenantField: 'clinicId', softDelete: true },
  patients: { tenantField: 'clinicId', softDelete: true },
  patient_identifiers: { tenantField: 'clinicId' },
  // scheduling & encounters
  appointments: { tenantField: 'clinicId', softDelete: true },
  encounters: { tenantField: 'clinicId', softDelete: true },
  teleconsultations: { tenantField: 'clinicId', softDelete: true },
  // clinical
  vitals: { tenantField: 'clinicId', softDelete: true },
  clinical_conditions: { tenantField: 'clinicId', softDelete: true },
  allergies: { tenantField: 'clinicId', softDelete: true },
  medications: { tenantField: 'clinicId', softDelete: true },
  prescriptions: { tenantField: 'clinicId', softDelete: true },
  lab_orders: { tenantField: 'clinicId', softDelete: true },
  lab_results: { tenantField: 'clinicId', softDelete: true },
  imaging_orders: { tenantField: 'clinicId', softDelete: true },
  imaging_studies: { tenantField: 'clinicId', softDelete: true },
  referrals: { tenantField: 'clinicId', softDelete: true },
  documents: { tenantField: 'clinicId', softDelete: true },
  // flexible clinical documents
  clinical_notes: { tenantField: 'clinicId' },
  clinical_assessments: { tenantField: 'clinicId' },
  dynamic_forms: { tenantField: 'clinicId' },
  dynamic_form_submissions: { tenantField: 'clinicId' },
  patient_activity_logs: { tenantField: 'clinicId' },
  community_posts: { tenantField: 'clinicId' },
  // business
  invoices: { tenantField: 'clinicId', softDelete: true },
  inventory_items: { tenantField: 'clinicId', softDelete: true },
  notifications: { tenantField: 'clinicId', requireTenant: false },
  // platform
  audit_logs: { tenantField: 'clinicId', requireTenant: false, appendOnly: true },
  system_settings: { tenantField: null },
  integration_configs: { tenantField: 'clinicId', requireTenant: false, softDelete: true },
  integration_payloads: { tenantField: 'clinicId', requireTenant: false },
  fhir_payload_snapshots: { tenantField: 'clinicId', requireTenant: false },
  fhir_resource_refs: { tenantField: 'clinicId', requireTenant: false },
  outbox_events: { tenantField: null, systemOnly: true },
  legacy_id_map: { tenantField: null, systemOnly: true },
  counters: { tenantField: null, systemOnly: true },
  schema_migrations: { tenantField: null, systemOnly: true },
});

module.exports = { COLLECTIONS: C };
