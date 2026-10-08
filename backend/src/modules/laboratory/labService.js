'use strict';
const { withTenant } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');
const encounters = require('../encounters/encounterService');
const documents = require('../documents/documentService');

// ---- lab orders ----
async function listOrders(scope, { patientId, status, clinicId, page = 1, limit = 100, offset = 0 }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    const col = db.c('lab_orders');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { orderedAt: -1 }, limit, skip: offset }), col.count(filter)]);
    const pmap = await patients.refsFor(db, rows.map((r) => r.patientId));
    return { data: rows.map((r) => ({ ...serializeRow(r), patientId: pmap[r.patientId] || ref(r.patientId) })), total, page, limit };
  });
}
async function createOrder(scope, input, ctx) {
  return withTenant(scope, async (db) => {
    const patient = await patients.assertPatient(db, scope, input.patientId);
    const clinicId = patient.clinicId;
    if (input.encounterId) await encounters.assertEncounter(db, scope, input.encounterId);
    if (input.orderedBy) await practitioners.assertPractitioner(db, scope, input.orderedBy);
    const row = await db.c('lab_orders').insertOne({ clinicId, patientId: patient._id, encounterId: input.encounterId || null, orderedBy: input.orderedBy || null, testName: input.testName, testCode: input.testCode || null, priority: input.priority || 'Routine', status: input.status || 'ordered', orderedAt: input.orderedAt ? new Date(input.orderedAt) : new Date(), labName: input.labName || null, notes: input.notes || null });
    await auditInTrx(db, { ...scope, clinicId }, { action: 'LAB_ORDER_CREATED', resourceType: 'lab_order', resourceId: row._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'lab.order.created', aggregateType: 'lab_order', aggregateId: row._id, clinicId, actorId: scope.userId, payload: { patientId: patient._id } });
    return serializeRow(row);
  });
}
async function updateOrder(scope, id, input, ctx) {
  return withTenant(scope, async (db) => {
    const patch = {};
    for (const k of ['testName', 'testCode', 'priority', 'status', 'labName', 'notes']) if (input[k] !== undefined) patch[k] = input[k];
    const row = await db.c('lab_orders').updateOne({ _id: id }, patch);
    if (!row) throw notFound('Lab order');
    await auditInTrx(db, scope, { action: 'LAB_ORDER_UPDATED', resourceType: 'lab_order', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return serializeRow(row);
  });
}

// ---- lab results / legacy "lab reports" ----
function serializeReport(r, { patient, order, doc, url } = {}) {
  const s = serializeRow(r);
  return {
    ...s,
    testName: r.testName || (order && order.testName) || null,
    testDate: r.resultDate,
    labName: r.labName || (order && order.labName) || null,
    priority: order ? order.priority : undefined,
    notes: r.notes,
    fileName: doc ? doc.originalFileName : null,
    fileType: doc ? doc.mimeType : null,
    fileSize: doc ? Number(doc.sizeBytes) : null,
    filePath: url || null,
    fileUrl: url || null,
    documentId: r.documentId,
    patientId: patient || ref(r.patientId),
    uploadedBy: r.createdBy ? ref(r.createdBy, { fullName: 'Clinic staff' }) : null,
    uploadedAt: r.createdAt,
    status: r.status,
  };
}

async function hydrateResults(db, rows) {
  if (!rows.length) return [];
  const [pmap, orders, docs] = await Promise.all([
    patients.refsFor(db, rows.map((r) => r.patientId)),
    db.c('lab_orders').find({ _id: { $in: rows.map((r) => r.labOrderId).filter(Boolean) } }),
    db.c('documents').find({ _id: { $in: rows.map((r) => r.documentId).filter(Boolean) } }),
  ]);
  const omap = Object.fromEntries(orders.map((o) => [o._id, o]));
  const dmap = Object.fromEntries(docs.map((d) => [d._id, d]));
  const out = [];
  for (const r of rows) {
    const doc = dmap[r.documentId];
    const a = doc ? await documents.accessUrlFor(doc) : null;
    out.push(serializeReport(r, { patient: pmap[r.patientId], order: omap[r.labOrderId], doc, url: a && a.url }));
  }
  return out;
}

async function listReports(scope, { patientId, from, to, clinicId, page = 1, limit = 100, offset = 0 }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    if (from || to) filter.resultDate = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    const col = db.c('lab_results');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { resultDate: -1 }, limit, skip: offset }), col.count(filter)]);
    return { data: await hydrateResults(db, rows), total, page, limit };
  });
}

async function getReport(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('lab_results').findById(id);
    if (!row) throw notFound('Lab report');
    await auditInTrx(db, scope, { action: 'LAB_RESULT_VIEWED', resourceType: 'lab_result', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return (await hydrateResults(db, [row]))[0];
  });
}

/** Creates a lab result (and, for the legacy flow, its order) with an optional uploaded file. */
async function createReport(scope, input, file, ctx) {
  if (!input.patientId) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (db) => {
    const patient = await patients.assertPatient(db, scope, input.patientId);
    const clinicId = patient.clinicId;
    const resultDate = input.testDate ? new Date(input.testDate) : new Date();
    let order;
    if (input.labOrderId) {
      order = await db.c('lab_orders').findById(input.labOrderId);
      if (!order || order.patientId !== patient._id) throw notFound('Lab order');
      await db.c('lab_orders').updateOne({ _id: order._id }, { status: 'completed' });
    } else {
      if (!input.testName) throw badRequest('testName is required', 'VALIDATION_ERROR');
      order = await db.c('lab_orders').insertOne({ clinicId, patientId: patient._id, encounterId: input.encounterId || null, orderedBy: null, testName: input.testName, testCode: null, priority: 'Routine', labName: input.labName || null, status: 'completed', orderedAt: resultDate, notes: null });
    }
    let documentId = input.documentId || null;
    if (file) {
      const doc = await documents.storeDocument(db, scope, { buffer: file.buffer, fileName: file.originalname, claimedMime: file.mimetype, clinicId, patientId: patient._id, encounterId: input.encounterId, category: 'lab', documentType: 'lab_report', title: input.testName || order.testName, requestId: ctx.requestId, ip: ctx.ip });
      documentId = doc._id;
    } else if (documentId && !(await db.c('documents').exists({ _id: documentId, clinicId }))) {
      throw notFound('Document');
    }
    const row = await db.c('lab_results').insertOne({ clinicId, patientId: patient._id, labOrderId: order._id, encounterId: input.encounterId || order.encounterId || null, documentId, testName: input.testName || order.testName, resultDate, summary: input.summary || null, observations: Array.isArray(input.observations) ? input.observations : [], interpretation: input.interpretation || null, status: input.status || 'final', labName: input.labName || order.labName || null, notes: input.notes || null });
    await auditInTrx(db, { ...scope, clinicId }, { action: 'LAB_RESULT_CREATED', resourceType: 'lab_result', resourceId: row._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'lab.result.created', aggregateType: 'lab_result', aggregateId: row._id, clinicId, actorId: scope.userId, payload: { patientId: patient._id } });
    return (await hydrateResults(db, [row]))[0];
  });
}

async function updateReport(scope, id, input, ctx) {
  return withTenant(scope, async (db) => {
    const col = db.c('lab_results');
    const current = await col.findById(id);
    if (!current) throw notFound('Lab report');
    const patch = {};
    for (const k of ['summary', 'interpretation', 'status', 'labName', 'notes', 'testName']) if (input[k] !== undefined) patch[k] = input[k];
    if (input.testDate !== undefined) patch.resultDate = new Date(input.testDate);
    if (input.observations !== undefined) patch.observations = Array.isArray(input.observations) ? input.observations : [];
    const updated = await col.updateOne({ _id: id }, patch);
    if (input.testName !== undefined && current.labOrderId) await db.c('lab_orders').updateOne({ _id: current.labOrderId }, { testName: input.testName });
    await auditInTrx(db, scope, { action: 'LAB_RESULT_UPDATED', resourceType: 'lab_result', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(patch) } });
    return (await hydrateResults(db, [updated]))[0];
  });
}

async function removeReport(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const col = db.c('lab_results');
    const current = await col.findById(id);
    if (!current) throw notFound('Lab report');
    await col.softDelete({ _id: id });
    if (current.documentId) await db.c('documents').updateOne({ _id: current.documentId }, { status: 'deleted', deletedAt: new Date() });
    await auditInTrx(db, scope, { action: 'LAB_RESULT_DELETED', resourceType: 'lab_result', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  });
}

async function documentIdOf(scope, id) {
  return withTenant(scope, async (db) => {
    const current = await db.c('lab_results').findById(id);
    if (!current) throw notFound('Lab report');
    if (!current.documentId) throw notFound('Report file');
    return current.documentId;
  });
}

module.exports = { listOrders, createOrder, updateOrder, listReports, getReport, createReport, updateReport, removeReport, documentIdOf };
