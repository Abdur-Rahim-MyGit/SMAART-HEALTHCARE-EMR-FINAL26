'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString } = require('../../common/validation/schemas');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const service = require('./prescriptionService');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const medication = z.object({ name: z.string().min(1).max(200), dosage: optionalString(100), frequency: optionalString(100), duration: optionalString(100), instructions: optionalString(1000), quantity: z.coerce.number().int().min(0).optional().nullable() });
const body = z.object({ patientId: uuid.optional(), doctorId: uuid.optional().nullable(), encounterId: uuid.optional().nullable(), prescriptionNumber: optionalString(40), date: z.coerce.date().optional(), diagnosis: optionalString(2000), notes: optionalString(5000), status: z.enum(['Active', 'Completed', 'Cancelled']).optional(), followUpDate: z.union([z.coerce.date(), z.literal(''), z.null()]).optional(), followUpInstructions: optionalString(2000), medications: z.array(medication).max(50).optional() });

router.get('/', authorize('clinical:read'), tenantScope(), validate({ query: paginationQuery.extend({ patientId: uuid.optional(), doctorId: uuid.optional(), status: z.string().max(20).optional(), clinicId: uuid.optional() }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.list(req.scope, { ...q, offset: (q.page - 1) * q.limit });
  res.json({ success: true, prescriptions: r.data, data: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
}));
router.get('/stats', authorize('clinical:read'), tenantScope(), asyncHandler(async (req, res) => res.json({ success: true, data: await service.stats(req.scope) })));
router.get('/patient/:patientId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }) }), asyncHandler(async (req, res) => {
  const r = await service.list(req.scope, { patientId: req.params.patientId, limit: 200 });
  res.json({ success: true, prescriptions: r.data, data: r.data, count: r.data.length });
}));
router.get('/doctor/:doctorId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ doctorId: uuid }) }), asyncHandler(async (req, res) => {
  const r = await service.list(req.scope, { doctorId: req.params.doctorId, limit: 200 });
  res.json({ success: true, prescriptions: r.data, data: r.data, count: r.data.length });
}));
router.get('/:id', authorize('clinical:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const item = await service.getById(req.scope, req.params.id, ctxOf(req));
  res.json({ success: true, data: item, prescription: item });
}));
router.post('/', authorize('clinical:write'), tenantScope(), validate({ body: body.extend({ patientId: uuid, medications: z.array(medication).min(1).max(50) }) }), asyncHandler(async (req, res) => {
  const item = await service.create(req.scope, req.body, ctxOf(req));
  res.status(201).json({ success: true, message: 'Prescription created successfully', data: item, prescription: item });
}));
router.put('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body }), asyncHandler(async (req, res) => {
  const item = await service.update(req.scope, req.params.id, req.body, ctxOf(req));
  res.json({ success: true, message: 'Prescription updated successfully', data: item, prescription: item });
}));
router.delete('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.remove(req.scope, req.params.id, ctxOf(req));
  res.json({ success: true, message: 'Prescription deleted' });
}));
module.exports = router;
