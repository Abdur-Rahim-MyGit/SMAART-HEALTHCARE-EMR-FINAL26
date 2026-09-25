'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString } = require('../../common/validation/schemas');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const service = require('./teleconsultationService');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const body = z.object({ patientId: uuid.optional(), doctorId: uuid.optional().nullable(), appointmentId: uuid.optional().nullable(), scheduledDate: z.union([z.coerce.date(), z.string()]).optional(), scheduledAt: z.coerce.date().optional(), scheduledTime: optionalString(20), duration: z.coerce.number().int().min(5).max(480).optional(), status: z.enum(['Scheduled', 'Waiting', 'In Progress', 'Completed', 'Cancelled', 'No Show']).optional(), reason: optionalString(2000), notes: optionalString(5000), diagnosis: optionalString(2000), prescription: optionalString(5000), meetingLink: optionalString(500) }).passthrough();

router.get('/', authorize('clinical:read'), tenantScope(), validate({ query: paginationQuery.extend({ patientId: uuid.optional(), doctorId: uuid.optional(), status: z.string().max(20).optional(), clinicId: uuid.optional() }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.list(req.scope, { ...q, offset: (q.page - 1) * q.limit });
  res.json({ success: true, teleconsultations: r.data, data: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
}));
router.get('/stats/overview', authorize('clinical:read'), tenantScope(), asyncHandler(async (req, res) => res.json({ success: true, stats: await service.stats(req.scope) })));
router.get('/stats', authorize('clinical:read'), tenantScope(), asyncHandler(async (req, res) => res.json({ success: true, stats: await service.stats(req.scope) })));
router.get('/patient/:patientId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }) }), asyncHandler(async (req, res) => { const r = await service.list(req.scope, { patientId: req.params.patientId, limit: 200 }); res.json({ success: true, teleconsultations: r.data, data: r.data, count: r.data.length }); }));
router.get('/doctor/:doctorId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ doctorId: uuid }) }), asyncHandler(async (req, res) => { const r = await service.list(req.scope, { doctorId: req.params.doctorId, limit: 200 }); res.json({ success: true, teleconsultations: r.data, data: r.data, count: r.data.length }); }));
router.get('/:id', authorize('clinical:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => { const t = await service.getById(req.scope, req.params.id); res.json({ success: true, teleconsultation: t, data: t }); }));
router.post('/', authorize('clinical:write'), tenantScope(), validate({ body: body.extend({ patientId: uuid }) }), asyncHandler(async (req, res) => { const t = await service.create(req.scope, req.body, ctxOf(req)); res.status(201).json({ success: true, message: 'Teleconsultation scheduled', teleconsultation: t, data: t }); }));
router.post('/schedule', authorize('clinical:write'), tenantScope(), validate({ body: body.extend({ patientId: uuid }) }), asyncHandler(async (req, res) => { const t = await service.create(req.scope, req.body, ctxOf(req)); res.status(201).json({ success: true, message: 'Teleconsultation scheduled', teleconsultation: t, data: t }); }));
router.put('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body }), asyncHandler(async (req, res) => { const t = await service.update(req.scope, req.params.id, req.body, ctxOf(req)); res.json({ success: true, message: 'Teleconsultation updated', teleconsultation: t, data: t }); }));
router.post('/:id/join', authorize('clinical:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => { const t = await service.join(req.scope, req.params.id, req.auth, ctxOf(req)); res.json({ success: true, message: 'Joined', teleconsultation: t, data: t }); }));
router.post('/:id/end', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body: z.object({ notes: optionalString(5000), diagnosis: optionalString(2000), prescription: optionalString(5000) }) }), asyncHandler(async (req, res) => { const t = await service.end(req.scope, req.params.id, req.body, ctxOf(req)); res.json({ success: true, message: 'Teleconsultation completed', teleconsultation: t, data: t }); }));
router.delete('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => { await service.remove(req.scope, req.params.id, ctxOf(req)); res.json({ success: true, message: 'Teleconsultation deleted' }); }));
module.exports = router;
