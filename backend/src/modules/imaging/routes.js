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
const service = require('./imagingService');

const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config().MAX_UPLOAD_BYTES, files: 1 } });
const body = z.object({ patientId: uuid.optional(), encounterId: uuid.optional().nullable(), uploadedBy: uuid.optional().nullable(), documentId: uuid.optional(), imageUrl: optionalString(2000), fileData: z.string().max(20 * 1024 * 1024).optional(), fileName: optionalString(255), fileSize: z.coerce.number().int().min(0).optional(), mimeType: optionalString(100), imageType: optionalString(60), bodyPart: optionalString(60), title: optionalString(200), description: optionalString(1000), associatedDiagnosis: optionalString(500), imageTakenDate: z.coerce.date().optional(), isPrivate: z.coerce.boolean().optional(), status: z.enum(['Active', 'Archived', 'Deleted']).optional(), tags: z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v), z.array(z.string().max(50)).max(20).optional()) }).passthrough();

function build() {
  const router = express.Router();
  router.get('/', authorize('clinical:read'), tenantScope(), validate({ query: paginationQuery.extend({ patientId: uuid.optional(), imageType: z.string().max(60).optional(), bodyPart: z.string().max(60).optional(), status: z.string().max(20).optional(), clinicId: uuid.optional() }) }), asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const r = await service.list(req.scope, { ...q, offset: (q.page - 1) * q.limit });
    res.json({ success: true, data: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
  }));
  router.get('/patient/:patientId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }), query: z.object({ imageType: z.string().max(60).optional(), status: z.string().max(20).optional() }) }), asyncHandler(async (req, res) => {
    const r = await service.list(req.scope, { patientId: req.params.patientId, ...req.validatedQuery, limit: 200 });
    res.json({ success: true, data: r.data, count: r.data.length });
  }));
  router.get('/:id', authorize('clinical:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.getById(req.scope, req.params.id, ctxOf(req)) });
  }));
  router.post('/', authorize('documents:write'), tenantScope(), upload.single('file'), validate({ body: body.extend({ patientId: uuid }) }), asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, message: 'Medical image uploaded successfully', data: await service.create(req.scope, req.body, req.file, ctxOf(req)) });
  }));
  router.put('/:id', authorize('documents:write'), tenantScope(), validate({ params: idParam, body }), asyncHandler(async (req, res) => {
    res.json({ success: true, message: 'Medical image updated successfully', data: await service.update(req.scope, req.params.id, req.body, ctxOf(req)) });
  }));
  router.delete('/:id', authorize('documents:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    await service.archive(req.scope, req.params.id, ctxOf(req));
    res.json({ success: true, message: 'Medical image archived successfully' });
  }));
  return router;
}
module.exports = { studies: build(), medicalImages: build() };
