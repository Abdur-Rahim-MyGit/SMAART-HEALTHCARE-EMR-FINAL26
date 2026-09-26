'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString } = require('../../common/validation/schemas');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const service = require('./appointmentService');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const body = z.object({
  patientId: uuid.optional(),
  doctorId: z.union([uuid, z.literal(''), z.null()]).optional(),
  practitionerId: uuid.optional().nullable(),
  clinicId: uuid.optional(),
  date: z.union([z.coerce.date(), z.string()]).optional(),
  appointmentDate: z.union([z.coerce.date(), z.string()]).optional(),
  scheduledAt: z.coerce.date().optional(),
  time: optionalString(20),
  duration: z.coerce.number().int().min(5).max(480).optional(),
  appointmentType: optionalString(80),
  type: optionalString(80),
  status: z.enum(['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No Show']).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  reason: optionalString(1000),
  notes: optionalString(2000),
  instructions: optionalString(2000),
  location: optionalString(200),
  provider: optionalString(120),
  isVirtual: z.boolean().optional(),
  meetingLink: optionalString(500),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.union([z.coerce.date(), z.literal(''), z.null()]).optional(),
  version: z.coerce.number().int().optional(),
}).passthrough();

router.get('/', authorize('appointments:read'), tenantScope(), validate({ query: paginationQuery.extend({ limit: z.coerce.number().int().min(1).max(500).default(200), patientId: uuid.optional(), doctorId: uuid.optional(), status: z.string().max(20).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), clinicId: uuid.optional() }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.list(req.scope, { ...q, offset: (q.page - 1) * q.limit });
  res.json({ success: true, appointments: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
}));
router.get('/:id', authorize('appointments:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json({ success: true, appointment: await service.getById(req.scope, req.params.id) });
}));
router.post('/', authorize('appointments:write'), tenantScope(), validate({ body: body.extend({ patientId: uuid }) }), asyncHandler(async (req, res) => {
  const appointment = await service.create(req.scope, req.body, ctxOf(req));
  res.status(201).json({ success: true, message: 'Appointment created successfully', appointment });
}));
router.put('/:id', authorize('appointments:write'), tenantScope(), validate({ params: idParam, body }), asyncHandler(async (req, res) => {
  const appointment = await service.update(req.scope, req.params.id, req.body, ctxOf(req));
  res.json({ success: true, message: 'Appointment updated successfully', appointment });
}));
router.put('/:id/status', authorize('appointments:write'), tenantScope(), validate({ params: idParam, body: z.object({ status: z.enum(['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No Show']) }) }), asyncHandler(async (req, res) => {
  const appointment = await service.update(req.scope, req.params.id, { status: req.body.status }, ctxOf(req));
  res.json({ success: true, message: 'Appointment status updated', appointment });
}));
router.delete('/:id', authorize('appointments:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.remove(req.scope, req.params.id, ctxOf(req));
  res.json({ success: true, message: 'Appointment deleted' });
}));

module.exports = router;
