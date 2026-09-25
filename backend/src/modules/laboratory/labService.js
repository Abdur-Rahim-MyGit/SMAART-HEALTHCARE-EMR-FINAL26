'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');
const encounters = require('../encounters/encounterService');
const documents = require('../documents/documentService');

const orders = new BaseRepository('lab_orders');
const results = new BaseRepository('lab_results');

// ---- lab orders ----
async function listOrders(scope, { patientId, status, clinicId, page = 1, limit = 100, offset = 0 }) {
  return withTenant(scope, async (trx) => {
    let q = orders.scoped(trx, scope);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('clinic_id', clinicId);
    if (patientId) q = q.where('patient_id', patientId);
    if (status) q = q.where('status', status);
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('ordered_at', 'desc').limit(limit).offset(offset);
    const pmap = await patients.refsFor(trx, rows.map((r) => r.patient_id));
    return { data: rows.map((r) => ({ ...serializeRow(r), patientId: pmap[r.patient_id] || ref(r.patient_id) })), total, page, limit };
  }, getKnex());
}
async function createOrder(scope, input, ctx) {
  return withTenant(scope, async (trx) => {
    const patient = await patients.assertPatient(trx, scope, input.patientId);
    if (input.encounterId) await encounters.assertEncounter(trx, scope, input.encounterId);
    if (input.orderedBy) await practitioners.assertPractitioner(trx, scope, input.orderedBy);
    const [row] = await trx('lab_orders').insert({ clinic_id: patient.clinic_id, patient_id: patient.id, encounter_id: input.encounterId || null, ordered_by: input.orderedBy || null, test_name: input.testName, test_code: input.testCode || null, priority: input.priority || 'Routine', status: input.status || 'ordered', ordered_at: input.orderedAt || new Date(), lab_name: input.labName || null, notes: input.notes || null, created_by: scope.userId, updated_by: scope.userId }).returning('*');
    await auditInTrx(trx, { ...scope, clinicId: patient.clinic_id }, { action: 'LAB_ORDER_CREATED', resourceType: 'lab_order', resourceId: row.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'lab.order.created', aggregateType: 'lab_order', aggregateId: row.id, clinicId: patient.clinic_id, actorId: scope.userId, payload: { patientId: patient.id } });
    return serializeRow(row);
  }, getKnex());
}
async function updateOrder(scope, id, input, ctx) {
  return withTenant(scope, async (trx) => {
    const patch = {};
    for (const [k, c] of Object.entries({ testName: 'test_name', testCode: 'test_code', priority: 'priority', status: 'status', labName: 'lab_name', notes: 'notes' })) if (input[k] !== undefined) patch[c] = input[k];
    const row = await orders.update(trx, scope, id, patch);
    if (!row) throw notFound('Lab order');
    await auditInTrx(trx, scope, { action: 'LAB_ORDER_UPDATED', resourceType: 'lab_order', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return serializeRow(row);
  }, getKnex());
}

// ---- lab results / legacy "lab reports" ----
function serializeReport(r, { patient, doc, url } = {}) {
  const s = serializeRow(r);
  return {
    ...s,
    testName: r.test_name,
    testDate: r.result_date,
    labName: r.lab_name || r.order_lab_name,
    notes: r.notes,
    fileName: doc ? doc.original_file_name : null,
    fileType: doc ? doc.mime_type : null,
    fileSize: doc ? Number(doc.size_bytes) : null,
    filePath: url || null,
    fileUrl: url || null,
    documentId: r.document_id,
    patientId: patient || ref(r.patient_id),
    uploadedBy: r.created_by ? ref(r.created_by, { fullName: 'Clinic staff' }) : null,
    uploadedAt: r.created_at,
    status: r.status,
  };
}

async function hydrateResults(trx, rows) {
  if (!rows.length) return [];
  const pmap = await patients.refsFor(trx, rows.map((r) => r.patient_id));
  const docs = await trx('documents').whereIn('id', rows.map((r) => r.document_id).filter(Boolean)).whereNull('deleted_at');
  const dmap = Object.fromEntries(docs.map((d) => [d.id, d]));
  const out = [];
  for (const r of rows) {
    const doc = dmap[r.document_id];
    const a = doc ? await documents.accessUrlFor(doc) : null;
    out.push(serializeReport(r, { patient: pmap[r.patient_id], doc, url: a && a.url }));
  }
  return out;
}

function resultsQuery(trx, scope) {
  return results.scoped(trx, scope).leftJoin('lab_orders as o', 'o.id', 'lab_results.lab_order_id').select('lab_results.*', 'o.test_name', 'o.lab_name as order_lab_name', 'o.priority');
}

async function listReports(scope, { patientId, from, to, clinicId, page = 1, limit = 100, offset = 0 }) {
  return withTenant(scope, async (trx) => {
    let q = resultsQuery(trx, scope);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('lab_results.clinic_id', clinicId);
    if (patientId) q = q.where('lab_results.patient_id', patientId);
    if (from) q = q.where('lab_results.result_date', '>=', from);
    if (to) q = q.where('lab_results.result_date', '<=', to);
    const total = Number((await q.clone().clearSelect().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('lab_results.result_date', 'desc').limit(limit).offset(offset);
    return { data: await hydrateResults(trx, rows), total, page, limit };
  }, getKnex());
}

async function getReport(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await resultsQuery(trx, scope).where('lab_results.id', id).first();
    if (!row) throw notFound('Lab report');
    await auditInTrx(trx, scope, { action: 'LAB_RESULT_VIEWED', resourceType: 'lab_result', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [r] = await hydrateResults(trx, [row]);
    return r;
  }, getKnex());
}

/** Creates a lab result (and, for the legacy flow, its order) with an optional uploaded file. */
async function createReport(scope, input, file, ctx) {
  if (!input.patientId) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (trx) => {
    const patient = await patients.assertPatient(trx, scope, input.patientId);
    let orderId = input.labOrderId;
    if (orderId) {
      const o = await orders.findById(trx, scope, orderId);
      if (!o || o.patient_id !== patient.id) throw notFound('Lab order');
      await trx('lab_orders').where({ id: orderId }).update({ status: 'completed' });
    } else {
      if (!input.testName) throw badRequest('testName is required', 'VALIDATION_ERROR');
      const [o] = await trx('lab_orders').insert({ clinic_id: patient.clinic_id, patient_id: patient.id, encounter_id: input.encounterId || null, test_name: input.testName, lab_name: input.labName || null, status: 'completed', ordered_at: input.testDate ? new Date(input.testDate) : new Date(), created_by: scope.userId, updated_by: scope.userId }).returning('id');
      orderId = o.id;
    }
    let documentId = input.documentId || null;
    if (file) {
      const doc = await documents.storeDocument(trx, scope, { buffer: file.buffer, fileName: file.originalname, claimedMime: file.mimetype, clinicId: patient.clinic_id, patientId: patient.id, encounterId: input.encounterId, category: 'lab', documentType: 'lab_report', title: input.testName, requestId: ctx.requestId, ip: ctx.ip });
      documentId = doc.id;
    } else if (documentId) {
      const doc = await trx('documents').where({ id: documentId, clinic_id: patient.clinic_id }).whereNull('deleted_at').first('id');
      if (!doc) throw notFound('Document');
    }
    const [row] = await trx('lab_results').insert({ clinic_id: patient.clinic_id, patient_id: patient.id, lab_order_id: orderId, document_id: documentId, result_date: input.testDate ? new Date(input.testDate) : new Date(), summary: input.summary || null, observations: JSON.stringify(input.observations || []), interpretation: input.interpretation || null, status: input.status || 'final', lab_name: input.labName || null, notes: input.notes || null, created_by: scope.userId, updated_by: scope.userId }).returning('*');
    await auditInTrx(trx, { ...scope, clinicId: patient.clinic_id }, { action: 'LAB_RESULT_CREATED', resourceType: 'lab_result', resourceId: row.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'lab.result.created', aggregateType: 'lab_result', aggregateId: row.id, clinicId: patient.clinic_id, actorId: scope.userId, payload: { patientId: patient.id } });
    const full = await resultsQuery(trx, scope).where('lab_results.id', row.id).first();
    const [r] = await hydrateResults(trx, [full]);
    return r;
  }, getKnex());
}

async function updateReport(scope, id, input, ctx) {
  return withTenant(scope, async (trx) => {
    const current = await results.findById(trx, scope, id);
    if (!current) throw notFound('Lab report');
    const patch = {};
    for (const [k, c] of Object.entries({ testDate: 'result_date', summary: 'summary', interpretation: 'interpretation', status: 'status', labName: 'lab_name', notes: 'notes' })) if (input[k] !== undefined) patch[c] = input[k];
    if (input.observations !== undefined) patch.observations = JSON.stringify(input.observations || []);
    await results.update(trx, scope, id, patch);
    if (input.testName !== undefined) await trx('lab_orders').where({ id: current.lab_order_id }).update({ test_name: input.testName });
    await auditInTrx(trx, scope, { action: 'LAB_RESULT_UPDATED', resourceType: 'lab_result', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const full = await resultsQuery(trx, scope).where('lab_results.id', id).first();
    const [r] = await hydrateResults(trx, [full]);
    return r;
  }, getKnex());
}

async function removeReport(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const current = await results.findById(trx, scope, id);
    if (!current) throw notFound('Lab report');
    await results.remove(trx, scope, id);
    if (current.document_id) await trx('documents').where({ id: current.document_id }).update({ status: 'deleted', deleted_at: trx.fn.now() });
    await auditInTrx(trx, scope, { action: 'LAB_RESULT_DELETED', resourceType: 'lab_result', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  }, getKnex());
}

async function documentIdOf(scope, id) {
  return withTenant(scope, async (trx) => {
    const current = await results.findById(trx, scope, id);
    if (!current) throw notFound('Lab report');
    if (!current.document_id) throw notFound('Report file');
    return current.document_id;
  }, getKnex());
}

module.exports = { listOrders, createOrder, updateOrder, listReports, getReport, createReport, updateReport, removeReport, documentIdOf, orders, results };
