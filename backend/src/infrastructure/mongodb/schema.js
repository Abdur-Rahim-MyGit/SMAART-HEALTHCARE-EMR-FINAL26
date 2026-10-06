'use strict';
/**
 * Collection schema: JSON-schema validators (data integrity at the database) and
 * indexes (uniqueness, tenancy, search). Idempotent; run at boot and by `npm run migrate`.
 */
const { getDb } = require('./connection');
const { COLLECTIONS } = require('./collections');
const { getLogger } = require('../../common/logging/logger');

const uuid = { bsonType: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' };
const nullableUuid = { oneOf: [uuid, { bsonType: 'null' }] };
const str = { bsonType: 'string' };
const date = { bsonType: 'date' };
const ndate = { bsonType: ['date', 'null'] };
const num = { bsonType: ['int', 'long', 'double', 'decimal'] };
const nnum = { bsonType: ['int', 'long', 'double', 'decimal', 'null'] };
const bool = { bsonType: 'bool' };
const enumOf = (values) => ({ enum: values });
const base = (props, required = []) => ({ $jsonSchema: { bsonType: 'object', required: ['_id', 'createdAt', ...required], properties: { _id: uuid, createdAt: date, updatedAt: ndate, createdBy: nullableUuid, updatedBy: nullableUuid, deletedAt: ndate, version: nnum, ...props } } });
const tenant = (props, required = []) => base({ clinicId: uuid, ...props }, ['clinicId', ...required]);

const VALIDATORS = {
  clinics: base({ name: str, adminEmail: str, isActive: bool, validityStart: date, validityEnd: date }, ['name', 'adminEmail', 'validityEnd']),
  users: base({ clinicId: nullableUuid, role: enumOf(['super_master_admin', 'clinic_admin']), email: str, passwordHash: str, isActive: bool }, ['role', 'email', 'passwordHash']),
  auth_sessions: base({ userId: uuid, refreshTokenHash: str, expiresAt: date }, ['userId', 'refreshTokenHash', 'expiresAt']),
  otp_challenges: base({ userId: uuid, purpose: enumOf(['login', 'password_reset', 'verify_email']), codeHash: str, salt: str, expiresAt: date, attempts: num }, ['userId', 'purpose', 'codeHash', 'expiresAt']),
  practitioners: tenant({ kind: enumOf(['doctor', 'nurse', 'lab_technician']), fullName: str, isActive: bool }, ['kind', 'fullName']),
  patients: tenant({ fullName: str, gender: { bsonType: ['string', 'null'], enum: ['male', 'female', 'other', 'unknown', null] }, status: enumOf(['active', 'inactive', 'deceased', 'merged']) }, ['fullName', 'status']),
  patient_identifiers: tenant({ patientId: uuid, system: enumOf(['uhid', 'mrn', 'aadhaar', 'insurance', 'legacy_mongo', 'external']), value: str }, ['patientId', 'system', 'value']),
  appointments: tenant({ patientId: uuid, practitionerId: nullableUuid, scheduledAt: date, durationMinutes: { bsonType: ['int', 'double', 'long'], minimum: 5, maximum: 480 }, status: enumOf(['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No Show']), priority: enumOf(['low', 'normal', 'high']) }, ['patientId', 'scheduledAt', 'status']),
  encounters: tenant({ patientId: uuid, status: enumOf(['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'No Show']), startedAt: date }, ['patientId', 'status', 'startedAt']),
  vitals: tenant({ patientId: uuid, recordedAt: date, oxygenSaturation: { bsonType: ['int', 'double', 'long', 'null'], minimum: 0, maximum: 100 }, painScore: { bsonType: ['int', 'null'], minimum: 0, maximum: 10 } }, ['patientId', 'recordedAt']),
  clinical_conditions: tenant({ patientId: uuid, display: str, clinicalStatus: enumOf(['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved']) }, ['patientId', 'display', 'clinicalStatus']),
  allergies: tenant({ patientId: uuid, substance: str, clinicalStatus: enumOf(['active', 'inactive', 'resolved']) }, ['patientId', 'substance', 'clinicalStatus']),
  medications: tenant({ patientId: uuid, name: str, status: enumOf(['active', 'completed', 'stopped', 'on-hold']) }, ['patientId', 'name', 'status']),
  prescriptions: tenant({ patientId: uuid, prescriptionNumber: str, prescribedAt: date, status: enumOf(['Active', 'Completed', 'Cancelled']), medications: { bsonType: 'array', items: { bsonType: 'object', required: ['_id', 'name'], properties: { _id: uuid, name: str } } } }, ['patientId', 'prescriptionNumber', 'prescribedAt', 'status', 'medications']),
  lab_orders: tenant({ patientId: uuid, testName: str, priority: enumOf(['Routine', 'Urgent', 'Emergency']), status: enumOf(['ordered', 'in-progress', 'completed', 'cancelled']), orderedAt: date }, ['patientId', 'testName', 'status', 'orderedAt']),
  lab_results: tenant({ patientId: uuid, labOrderId: uuid, resultDate: date, status: enumOf(['preliminary', 'final', 'amended', 'cancelled']) }, ['patientId', 'labOrderId', 'resultDate', 'status']),
  imaging_orders: tenant({ patientId: uuid, modality: str, status: enumOf(['ordered', 'in-progress', 'completed', 'cancelled']) }, ['patientId', 'modality', 'status']),
  imaging_studies: tenant({ patientId: uuid, modality: str, title: str, studyDate: date, status: enumOf(['Active', 'Archived', 'Deleted']) }, ['patientId', 'modality', 'title', 'studyDate', 'status']),
  referrals: tenant({ patientId: uuid, referralType: enumOf(['inbound', 'outbound']), specialistName: str, specialty: str, reason: str, urgency: enumOf(['Low', 'Medium', 'High', 'Urgent', 'Emergency']), status: enumOf(['Pending', 'Approved', 'In Progress', 'Completed', 'Cancelled']) }, ['patientId', 'referralType', 'specialistName', 'specialty', 'reason', 'urgency', 'status']),
  teleconsultations: tenant({ patientId: uuid, scheduledAt: date, status: enumOf(['Scheduled', 'Waiting', 'In Progress', 'Completed', 'Cancelled', 'No Show']) }, ['patientId', 'scheduledAt', 'status']),
  documents: tenant({ patientId: nullableUuid, documentType: str, category: enumOf(['clinical', 'imaging', 'lab', 'prescription', 'identity', 'profile', 'administrative', 'other']), originalFileName: str, mimeType: str, sizeBytes: { bsonType: ['int', 'long', 'double'], minimum: 0 }, storageProvider: enumOf(['cloudinary', 'local', 'legacy_url']), storageKey: str, status: enumOf(['pending', 'available', 'archived', 'deleted', 'quarantined']), scanStatus: enumOf(['not_scanned', 'pending', 'clean', 'infected', 'error']) }, ['documentType', 'category', 'originalFileName', 'mimeType', 'sizeBytes', 'storageProvider', 'storageKey', 'status', 'scanStatus']),
  invoices: tenant({ patientId: nullableUuid, invoiceNumber: str, invoiceDate: date, status: enumOf(['Draft', 'Pending', 'Approved', 'Rejected', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled']), total: { bsonType: ['int', 'double', 'long'], minimum: 0 }, paidAmount: { bsonType: ['int', 'double', 'long'], minimum: 0 } }, ['invoiceNumber', 'invoiceDate', 'status', 'total']),
  inventory_items: tenant({ name: str, stock: { bsonType: ['int', 'long', 'double'], minimum: 0 }, minStock: { bsonType: ['int', 'long', 'double'], minimum: 0 }, price: { bsonType: ['int', 'double', 'long'], minimum: 0 } }, ['name', 'stock', 'minStock', 'price']),
  notifications: base({ clinicId: nullableUuid, userId: uuid, type: str, title: str, message: str }, ['userId', 'type', 'title', 'message']),
  audit_logs: { $jsonSchema: { bsonType: 'object', required: ['_id', 'occurredAt', 'action'], properties: { _id: uuid, occurredAt: date, action: str, userId: nullableUuid, clinicId: nullableUuid } } },
  clinical_notes: tenant({ patientId: uuid, encounterId: nullableUuid, noteType: enumOf(['progress', 'soap', 'discharge', 'consultation', 'nursing', 'other']), status: enumOf(['draft', 'final', 'amended']) }, ['patientId', 'noteType', 'content', 'status']),
  community_posts: tenant({ authorId: uuid, title: str, content: str, status: enumOf(['Draft', 'Published', 'Archived']) }, ['authorId', 'title', 'content', 'status']),
  patient_activity_logs: tenant({ patientId: uuid, action: str, occurredAt: date }, ['patientId', 'action', 'occurredAt']),
  outbox_events: { $jsonSchema: { bsonType: 'object', required: ['_id', 'eventType', 'aggregateType', 'createdAt', 'nextAttemptAt'], properties: { _id: uuid, eventType: str, aggregateType: str, createdAt: date, publishedAt: ndate, attempts: num, nextAttemptAt: date } } },
};

const INDEXES = {
  clinics: [[{ adminEmail: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } }], [{ validityEnd: 1 }], [{ name: 'text', city: 'text', type: 'text' }]],
  users: [[{ email: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } }], [{ clinicId: 1 }]],
  roles: [], permissions: [], role_permissions: [[{ roleCode: 1, permissionCode: 1 }, { unique: true }]],
  auth_sessions: [[{ userId: 1 }], [{ refreshTokenHash: 1 }, { unique: true }], [{ previousTokenHash: 1 }], [{ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }]],
  otp_challenges: [[{ userId: 1, purpose: 1, createdAt: -1 }], [{ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 }]],
  practitioners: [[{ clinicId: 1, kind: 1 }], [{ clinicId: 1, email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' }, deletedAt: null } }], [{ fullName: 'text', specialty: 'text', email: 'text' }]],
  patients: [[{ clinicId: 1, createdAt: -1 }], [{ clinicId: 1, fullName: 1 }], [{ clinicId: 1, phone: 1 }], [{ clinicId: 1, email: 1 }]],
  patient_identifiers: [[{ clinicId: 1, system: 1, value: 1 }, { unique: true }], [{ patientId: 1 }]],
  appointments: [[{ clinicId: 1, scheduledAt: -1 }], [{ patientId: 1, scheduledAt: -1 }], [{ practitionerId: 1, scheduledAt: 1 }, { unique: true, partialFilterExpression: { practitionerId: { $type: 'string' }, status: { $in: ['Scheduled', 'Confirmed', 'Completed'] }, deletedAt: null } }]],
  encounters: [[{ patientId: 1, startedAt: -1 }], [{ clinicId: 1, startedAt: -1 }]],
  teleconsultations: [[{ clinicId: 1, scheduledAt: -1 }], [{ patientId: 1 }]],
  vitals: [[{ patientId: 1, recordedAt: -1 }], [{ clinicId: 1, recordedAt: -1 }]],
  clinical_conditions: [[{ patientId: 1 }], [{ clinicId: 1 }]],
  allergies: [[{ patientId: 1 }], [{ clinicId: 1 }]],
  medications: [[{ patientId: 1 }], [{ clinicId: 1 }]],
  prescriptions: [[{ clinicId: 1, prescriptionNumber: 1 }, { unique: true }], [{ patientId: 1, prescribedAt: -1 }]],
  lab_orders: [[{ patientId: 1, orderedAt: -1 }], [{ clinicId: 1 }]],
  lab_results: [[{ patientId: 1, resultDate: -1 }], [{ labOrderId: 1 }], [{ clinicId: 1 }]],
  imaging_orders: [[{ patientId: 1 }], [{ clinicId: 1 }]],
  imaging_studies: [[{ patientId: 1, studyDate: -1 }], [{ clinicId: 1 }]],
  referrals: [[{ clinicId: 1, createdAt: -1 }], [{ patientId: 1 }]],
  documents: [[{ patientId: 1, createdAt: -1 }], [{ clinicId: 1, createdAt: -1 }], [{ storageProvider: 1, storageKey: 1 }]],
  clinical_notes: [[{ clinicId: 1, patientId: 1, createdAt: -1 }], [{ encounterId: 1 }]],
  clinical_assessments: [[{ clinicId: 1, patientId: 1 }]],
  dynamic_forms: [[{ clinicId: 1, name: 1 }]],
  dynamic_form_submissions: [[{ clinicId: 1, patientId: 1 }], [{ formId: 1 }]],
  patient_activity_logs: [[{ clinicId: 1, patientId: 1, occurredAt: -1 }]],
  community_posts: [[{ clinicId: 1, status: 1, createdAt: -1 }], [{ title: 'text', content: 'text' }], [{ legacyId: 1 }, { sparse: true }]],
  invoices: [[{ clinicId: 1, invoiceNumber: 1 }, { unique: true }], [{ clinicId: 1, invoiceDate: -1 }], [{ patientId: 1 }]],
  inventory_items: [[{ clinicId: 1, name: 1 }], [{ clinicId: 1, expiryDate: 1 }]],
  notifications: [[{ userId: 1, createdAt: -1 }], [{ clinicId: 1, createdAt: -1 }]],
  audit_logs: [[{ clinicId: 1, occurredAt: -1 }], [{ userId: 1, occurredAt: -1 }], [{ resourceType: 1, resourceId: 1 }], [{ action: 1, occurredAt: -1 }]],
  system_settings: [],
  integration_configs: [[{ clinicId: 1, name: 1 }, { unique: true }]],
  integration_payloads: [[{ system: 1, createdAt: -1 }], [{ clinicId: 1 }]],
  fhir_payload_snapshots: [[{ resourceType: 1, resourceId: 1, createdAt: -1 }], [{ clinicId: 1 }]],
  fhir_resource_refs: [[{ externalSystem: 1, resourceType: 1, resourceId: 1 }, { unique: true }]],
  outbox_events: [[{ publishedAt: 1, nextAttemptAt: 1 }], [{ createdAt: 1 }]],
  legacy_id_map: [[{ collection: 1, legacyId: 1 }, { unique: true }], [{ newId: 1 }]],
  counters: [],
  schema_migrations: [],
};

/** Creates collections with validators and ensures every index. Idempotent. */
async function ensureSchema({ log = getLogger() } = {}) {
  const db = getDb();
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of Object.keys(COLLECTIONS)) {
    const validator = VALIDATORS[name];
    if (!existing.has(name)) {
      await db.createCollection(name, validator ? { validator, validationLevel: 'moderate', validationAction: 'error' } : {});
    } else if (validator) {
      await db.command({ collMod: name, validator, validationLevel: 'moderate', validationAction: 'error' });
    }
    for (const [keys, options] of INDEXES[name] || []) {
      try {
        await db.collection(name).createIndex(keys, options || {});
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          // index exists with different options: rebuild it
          const idx = (await db.collection(name).indexes()).find((i) => JSON.stringify(i.key) === JSON.stringify(keys));
          if (idx) await db.collection(name).dropIndex(idx.name);
          await db.collection(name).createIndex(keys, options || {});
        } else throw err;
      }
    }
  }
  await db.collection('schema_migrations').updateOne({ _id: 'schema' }, { $set: { appliedAt: new Date(), version: 1 } }, { upsert: true });
  log.info({ collections: Object.keys(COLLECTIONS).length }, 'mongodb schema ensured');
}

/** Reference data (roles, permissions, default settings). Idempotent. */
async function seedReferenceData() {
  const { ROLES, PERMISSIONS, ROLE_PERMISSIONS } = require('../../common/security/rbac');
  const db = getDb();
  const now = new Date();
  for (const [code, name, description] of [[ROLES.SUPER_MASTER_ADMIN, 'Super Master Admin', 'Platform-wide EMR administrator'], [ROLES.CLINIC_ADMIN, 'Clinic Admin', 'Administrator of exactly one clinic']]) {
    await db.collection('roles').updateOne({ _id: code }, { $set: { name, description }, $setOnInsert: { createdAt: now } }, { upsert: true });
  }
  for (const [code, description] of Object.entries(PERMISSIONS)) await db.collection('permissions').updateOne({ _id: code }, { $set: { description } }, { upsert: true });
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) for (const p of perms) await db.collection('role_permissions').updateOne({ roleCode: role, permissionCode: p }, { $setOnInsert: { roleCode: role, permissionCode: p } }, { upsert: true });
  for (const [key, value, description] of [['security.session.access_ttl', '15m', 'Access token lifetime'], ['security.password.min_length', 8, 'Minimum password length'], ['fhir.enabled', true, 'Expose the FHIR R4 API']]) {
    await db.collection('system_settings').updateOne({ _id: key }, { $setOnInsert: { value, description, updatedAt: now } }, { upsert: true });
  }
}

/** Drops every application collection (tests only). */
async function dropAll() {
  const db = getDb();
  for (const name of Object.keys(COLLECTIONS)) await db.collection(name).drop().catch(() => {});
}

module.exports = { ensureSchema, seedReferenceData, dropAll, VALIDATORS, INDEXES };
