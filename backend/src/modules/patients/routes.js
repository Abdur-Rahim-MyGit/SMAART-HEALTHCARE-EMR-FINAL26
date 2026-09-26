'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid } = require('../../common/validation/schemas');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const service = require('./patientService');
const timeline = require('../timeline/timelineService');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });

const patientBody = z.object({
  fullName: z.string().trim().min(1).max(150).optional(),
  dateOfBirth: z.union([z.coerce.date(), z.literal(''), z.null()]).optional(),
  gender: z.string().max(20).optional(),
  phone: z.string().max(30).optional().nullable(),
  email: z.union([z.string().trim().email().max(254), z.literal(''), z.null()]).optional(),
  clinicId: uuid.optional(),
  aadhaarNumber: z.union([z.string().regex(/^\d{12}$/, 'Aadhaar number must be 12 digits'), z.literal(''), z.null()]).optional(),
  attenderMobile: z.string().max(30).optional().nullable(),
  attenderWhatsapp: z.string().max(30).optional().nullable(),
  attenderEmail: z.union([z.string().trim().email().max(254), z.literal(''), z.null()]).optional(),
  profileImage: z.string().max(20 * 1024 * 1024).optional().nullable(),
  version: z.coerce.number().int().optional(),
}).passthrough();

router.get('/', authorize('patients:read'), tenantScope(), validate({ query: paginationQuery.extend({ limit: z.coerce.number().int().min(1).max(500).default(200), search: z.string().max(100).optional(), clinicId: uuid.optional(), status: z.string().max(20).optional() }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.list(req.scope, { ...q, offset: (q.page - 1) * q.limit });
  res.json({ success: true, patients: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
}));

router.get('/:patientId/case-logs', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }) }), asyncHandler(async (req, res) => {
  const data = await timeline.legacyCaseLogs(req.scope, req.params.patientId, ctxOf(req));
  res.json({ success: true, data, count: data.length });
}));

router.get('/:patientId/timeline', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }), query: z.object({ cursor: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(100).default(50), types: z.string().max(200).optional() }) }), asyncHandler(async (req, res) => {
  const r = await timeline.patientTimeline(req.scope, req.params.patientId, req.validatedQuery, ctxOf(req));
  res.json({ success: true, ...r });
}));

router.get('/:id', authorize('patients:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json({ success: true, patient: await service.getById(req.scope, req.params.id, ctxOf(req)) });
}));
router.post('/', authorize('patients:write'), tenantScope(), validate({ body: patientBody.extend({ fullName: z.string().trim().min(1).max(150) }) }), asyncHandler(async (req, res) => {
  const patient = await service.create(req.scope, req.body, ctxOf(req));
  res.status(201).json({ success: true, message: 'Patient added successfully', patient });
}));
router.put('/:id', authorize('patients:write'), tenantScope(), validate({ params: idParam, body: patientBody }), asyncHandler(async (req, res) => {
  const patient = await service.update(req.scope, req.params.id, req.body, ctxOf(req));
  res.json({ success: true, message: 'Patient updated successfully', patient });
}));
router.delete('/:id', authorize('patients:delete'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.remove(req.scope, req.params.id, ctxOf(req));
  res.json({ success: true, message: 'Patient deleted successfully' });
}));

module.exports = router;
