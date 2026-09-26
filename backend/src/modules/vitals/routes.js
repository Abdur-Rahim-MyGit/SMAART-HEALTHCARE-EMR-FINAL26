'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString } = require('../../common/validation/schemas');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const service = require('./vitalsService');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const measure = z.union([z.coerce.number(), z.object({ value: z.union([z.coerce.number(), z.literal(''), z.null()]).optional(), unit: z.string().max(10).optional(), category: z.string().max(20).optional() }), z.literal(''), z.null()]).optional();
const vitalSigns = z.object({ bloodPressure: z.object({ systolic: z.union([z.coerce.number(), z.literal(''), z.null()]).optional(), diastolic: z.union([z.coerce.number(), z.literal(''), z.null()]).optional() }).optional(), heartRate: measure, temperature: measure, respiratoryRate: measure, oxygenSaturation: measure, weight: measure, height: measure, bmi: measure, bloodSugar: measure, painScore: measure, systolic: measure, diastolic: measure, temperatureUnit: z.string().max(10).optional() }).passthrough();
const body = vitalSigns.extend({ patientId: uuid.optional(), encounterId: uuid.optional().nullable(), visitDate: z.coerce.date().optional(), recordedAt: z.coerce.date().optional(), recordedBy: uuid.optional().nullable(), recordedByName: optionalString(120), recordedByRole: optionalString(40), notes: optionalString(5000), clinicalNotes: z.record(z.string(), z.unknown()).optional(), vitalSigns: vitalSigns.optional() });

router.get('/', authorize('clinical:read'), tenantScope(), validate({ query: paginationQuery.extend({ patientId: uuid.optional(), clinicId: uuid.optional(), startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional() }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.list(req.scope, { ...q, from: q.startDate, to: q.endDate, offset: (q.page - 1) * q.limit });
  res.json({ success: true, vitals: r.data, data: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
}));
router.get('/patient/:patientId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }), query: z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }) }), asyncHandler(async (req, res) => {
  const r = await service.list(req.scope, { patientId: req.params.patientId, limit: req.validatedQuery.limit });
  res.json({ success: true, data: r.data, vitals: r.data, count: r.data.length });
}));
router.get('/:id', authorize('clinical:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getById(req.scope, req.params.id, ctxOf(req)) });
}));
router.post('/', authorize('clinical:write'), tenantScope(), validate({ body: body.extend({ patientId: uuid }) }), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, message: 'Vitals recorded successfully', data: await service.create(req.scope, req.body, ctxOf(req)) });
}));
router.put('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body }), asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Vitals updated successfully', data: await service.update(req.scope, req.params.id, req.body, ctxOf(req)) });
}));
router.delete('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.remove(req.scope, req.params.id, ctxOf(req));
  res.json({ success: true, message: 'Vitals record deleted' });
}));
module.exports = router;
