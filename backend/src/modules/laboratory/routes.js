'use strict';
const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { config } = require('../../config');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString } = require('../../common/validation/schemas');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const { getStorage } = require('../../infrastructure/storage');
const { verifyPurposeToken } = require('../../common/security/tokens');
const { notFound } = require('../../common/errors/AppError');
const service = require('./labService');
const documents = require('../documents/documentService');

const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config().MAX_UPLOAD_BYTES, files: 1 } });

const ordersRouter = express.Router();
ordersRouter.get('/', authorize('clinical:read'), tenantScope(), validate({ query: paginationQuery.extend({ patientId: uuid.optional(), status: z.string().max(20).optional(), clinicId: uuid.optional() }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.listOrders(req.scope, { ...q, offset: (q.page - 1) * q.limit });
  res.json({ success: true, data: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
}));
ordersRouter.post('/', authorize('clinical:write'), tenantScope(), validate({ body: z.object({ patientId: uuid, encounterId: uuid.optional().nullable(), orderedBy: uuid.optional().nullable(), testName: z.string().min(1).max(200), testCode: optionalString(40), priority: z.enum(['Routine', 'Urgent', 'Emergency']).optional(), status: z.enum(['ordered', 'in-progress', 'completed', 'cancelled']).optional(), orderedAt: z.coerce.date().optional(), labName: optionalString(200), notes: optionalString(2000) }) }), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, message: 'Lab order created', data: await service.createOrder(req.scope, req.body, ctxOf(req)) });
}));
ordersRouter.put('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body: z.object({ testName: optionalString(200), testCode: optionalString(40), priority: z.enum(['Routine', 'Urgent', 'Emergency']).optional(), status: z.enum(['ordered', 'in-progress', 'completed', 'cancelled']).optional(), labName: optionalString(200), notes: optionalString(2000) }) }), asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Lab order updated', data: await service.updateOrder(req.scope, req.params.id, req.body, ctxOf(req)) });
}));

const reportBody = z.object({ patientId: uuid.optional(), labOrderId: uuid.optional(), encounterId: uuid.optional().nullable(), documentId: uuid.optional(), testName: optionalString(200), testDate: z.coerce.date().optional(), labName: optionalString(200), notes: optionalString(2000), summary: optionalString(5000), interpretation: optionalString(2000), status: z.enum(['preliminary', 'final', 'amended', 'cancelled']).optional(), observations: z.preprocess((v) => (typeof v === 'string' ? JSON.parse(v) : v), z.array(z.record(z.string(), z.unknown())).optional()) }).passthrough();

function reportsRouter() {
  const router = express.Router();
  router.get('/', authorize('clinical:read'), tenantScope(), validate({ query: paginationQuery.extend({ patientId: uuid.optional(), clinicId: uuid.optional(), startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional() }) }), asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const r = await service.listReports(req.scope, { ...q, from: q.startDate, to: q.endDate, offset: (q.page - 1) * q.limit });
    res.json({ success: true, reports: r.data, data: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
  }));
  router.get('/patient/:patientId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }), query: z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }) }), asyncHandler(async (req, res) => {
    const r = await service.listReports(req.scope, { patientId: req.params.patientId, limit: req.validatedQuery.limit });
    res.json({ success: true, data: r.data, reports: r.data, count: r.data.length });
  }));
  router.get('/clinic/:clinicId', authorize('clinical:read'), tenantScope({ paramName: 'clinicId' }), asyncHandler(async (req, res) => {
    const r = await service.listReports(req.scope, { clinicId: req.scope.clinicId, limit: 200 });
    res.json({ success: true, data: r.data, reports: r.data, count: r.data.length });
  }));
  router.get('/:id', authorize('clinical:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.getReport(req.scope, req.params.id, ctxOf(req)) });
  }));
  router.get('/:id/download', authorize('documents:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    const docId = await service.documentIdOf(req.scope, req.params.id);
    const { row, url } = await documents.forDownload(req.scope, docId, ctxOf(req));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${row.original_file_name.replace(/"/g, '')}"`);
    if (getStorage().name === 'local') {
      const claims = verifyPurposeToken(decodeURIComponent(url.split('/local/')[1]), 'local-file');
      return res.sendFile(getStorage().resolvePath(claims.key));
    }
    const upstream = await fetch(url);
    if (!upstream.ok) throw notFound('File');
    require('stream').Readable.fromWeb(upstream.body).pipe(res);
  }));
  router.post('/', authorize('clinical:write'), tenantScope(), upload.single('file'), validate({ body: reportBody.extend({ patientId: uuid }) }), asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, message: 'Lab report created', data: await service.createReport(req.scope, req.body, req.file, ctxOf(req)) });
  }));
  router.put('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body: reportBody }), asyncHandler(async (req, res) => {
    res.json({ success: true, message: 'Lab report updated', data: await service.updateReport(req.scope, req.params.id, req.body, ctxOf(req)) });
  }));
  router.delete('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    await service.removeReport(req.scope, req.params.id, ctxOf(req));
    res.json({ success: true, message: 'Lab report deleted' });
  }));
  return router;
}

module.exports = { orders: ordersRouter, results: reportsRouter(), reports: reportsRouter() };
