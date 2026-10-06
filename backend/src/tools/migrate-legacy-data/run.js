'use strict';
/**
 * Core of the legacy migration, separated from the CLI so it can be tested with
 * in-memory fixtures. `src` is an object of legacy collections (arrays of docs).
 * Writes are idempotent upserts keyed by deterministic UUID v5 ids, so re-runs
 * update instead of duplicating. Legacy data is never modified.
 */
const crypto = require('crypto');
const { v5: uuidv5 } = require('uuid');
const { TenantDb, SYSTEM_ROLE } = require('../../infrastructure/mongodb/tenant');
const { COLLECTIONS: REGISTRY } = require('../../infrastructure/mongodb/collections');
const { toCamel } = require('../../common/utils/serialize');
const { hashPassword } = require('../../common/security/password');
const { ROLES } = require('../../common/security/rbac');
const { writeAudit } = require('../../modules/audit/auditRepository');
const mappers = require('./mappers');
const { validate } = require('./validate');

const NAMESPACE = 'a7b4d1e0-5c3f-4d2a-9e8b-1f2c3d4e5f60';
const COLLECTIONS = ['clinics', 'users', 'doctors', 'nurses', 'patients', 'appointments', 'consultations', 'vitals', 'prescriptions', 'labreports', 'medicalimages', 'referrals', 'invoices', 'billings', 'teleconsultations', 'posts', 'patientcaselogs'];
const uuidFor = (collection, legacyId) => uuidv5(`${collection}:${String(legacyId)}`, NAMESPACE);

/** snake_case mapper row → camelCase Mongo document (id → _id). */
function toDoc(row) {
  const { id, __legacy, ...rest } = row;
  const doc = { _id: id };
  for (const [k, v] of Object.entries(rest)) doc[toCamel(k)] = v;
  return { doc, legacy: __legacy || null };
}

/** Prescription items are embedded in the prescription aggregate. */
function embedPrescriptionItems(plan) {
  const by = {};
  for (const i of plan.tables.prescription_items || []) (by[i.prescription_id] = by[i.prescription_id] || []).push(i);
  for (const p of plan.tables.prescriptions) {
    p.medications = (by[p.id] || []).sort((a, b) => a.sort_order - b.sort_order).map((i) => ({ _id: i.id, name: i.name, dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions, quantity: i.quantity ?? null, sortOrder: i.sort_order }));
    if (!p.medications.length) p.medications = [{ _id: uuidFor('prescription-items', `${p.id}:none`), name: 'Not recorded', dosage: null, frequency: null, duration: null, instructions: null, quantity: null, sortOrder: 0 }];
  }
  delete plan.tables.prescription_items;
  plan.order = plan.order.filter((t) => t !== 'prescription_items');
}

/** Flexible documents get deterministic ids too. */
function flexibleDocs(plan) {
  return {
    clinical_notes: plan.mongo.clinicalNotes.map((n) => ({ id: uuidFor('clinical-notes', `${n.encounterId}:${n.noteType}`), ...n, tags: [], practitioner_id: null })),
    community_posts: plan.mongo.communityPosts.map((p) => ({ id: uuidFor('posts', p.legacyId), ...p, authorRole: 'clinic_admin', comments: p.comments.map((c) => ({ _id: uuidFor('post-comments', `${p.legacyId}:${c.author}:${c.createdAt.toISOString()}`), ...c })) })),
    patient_activity_logs: plan.mongo.activityLogs.map((a) => ({ id: uuidFor('activity', `${a.patientId}:${a.action}:${a.occurredAt.toISOString()}:${a.description || ''}`), ...a })),
  };
}

async function upsertAll(db, name, rows, report) {
  const col = db.raw(name);
  const def = REGISTRY[name] || {};
  const now = new Date();
  let written = 0;
  for (const row of rows) {
    const { doc, legacy } = toDoc(row);
    const { _id, createdAt, ...set } = doc;
    const setOnInsert = { createdAt: createdAt || now, createdBy: null, version: 1 };
    if (def.softDelete) setOnInsert.deletedAt = null;
    try {
      await col.updateOne({ _id }, { $set: { ...set, updatedAt: now, updatedBy: null }, $setOnInsert: setOnInsert }, { upsert: true });
      written++;
    } catch (err) {
      report.errors.push(`${name} ${_id}: ${err.message}`);
      continue;
    }
    if (legacy) await db.raw('legacy_id_map').updateOne({ collection: legacy.collection, legacyId: String(legacy.id) }, { $set: { newId: _id, migratedAt: now }, $setOnInsert: { _id: crypto.randomUUID(), createdAt: now } }, { upsert: true });
  }
  return written;
}

async function runMigration(src, { apply = false } = {}) {
  const report = { startedAt: new Date(), mode: apply ? 'apply' : 'dry-run', collections: {}, warnings: [], errors: [] };
  for (const c of COLLECTIONS) { src[c] = src[c] || []; report.collections[c] = { source: src[c].length }; }
  const ctx = { uuidFor, report, hashPassword, ROLES };
  const plan = await mappers.buildPlan(src, ctx);
  embedPrescriptionItems(plan);
  plan.flexible = flexibleDocs(plan);
  report.plan = { ...Object.fromEntries(Object.entries(plan.tables).map(([t, rows]) => [t, rows.length])), ...Object.fromEntries(Object.entries(plan.flexible).map(([t, rows]) => [t, rows.length])) };

  if (apply) {
    // Idempotent upserts, deliberately outside a single transaction (size/time limits): re-running heals partial runs.
    const db = new TenantDb({ role: SYSTEM_ROLE }, undefined);
    report.written = {};
    for (const name of plan.order) report.written[name] = await upsertAll(db, name, plan.tables[name], report);
    for (const [name, rows] of Object.entries(plan.flexible)) report.written[name] = await upsertAll(db, name, rows, report);
    await writeAudit({ action: 'DATA_MIGRATION_APPLIED', resourceType: 'system', result: report.errors.length ? 'PARTIAL' : 'SUCCESS', details: report.plan });
    report.validation = await validate(db, src, plan, ctx);
  } else {
    report.validation = { checks: {}, failures: [] };
  }
  report.finishedAt = new Date();
  report.ok = report.validation.failures.length === 0 && report.errors.length === 0;
  return { report, plan };
}

module.exports = { runMigration, uuidFor, COLLECTIONS, toDoc };
