'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString } = require('../../common/validation/schemas');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const service = require('./encounterService');
const prescriptions = require('../prescriptions/prescriptionService');

const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const body = z.object({
  patientId: uuid.optional(),
  doctorId: uuid.optional().nullable(),
  practitionerId: uuid.optional().nullable(),
  appointmentId: uuid.optional().nullable(),
  consultationType: optionalString(60),
  encounterType: optionalString(60),
  mode: optionalString(30),
  date: z.union([z.coerce.date(), z.string()]).optional(),
  startedAt: z.coerce.date().optional(),
  time: optionalString(20),
  duration: z.coerce.number().int().min(0).max(1440).optional().nullable(),
  provider: optionalString(120),
  providerNotes: optionalString(10000),
  patientNotes: optionalString(5000),
  reason: optionalString(2000),
  symptoms: z.union([z.array(z.string().max(200)), z.string().max(2000)]).optional(),
  diagnosis: optionalString(2000),
  status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'No Show']).optional(),
  priority: optionalString(20),
  recommendations: z.array(z.unknown()).optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.union([z.coerce.date(), z.literal(''), z.null()]).optional(),
  followUpNotes: optionalString(2000),
}).passthrough();

function build() {
  const router = express.Router();
  router.get('/', authorize('clinical:read'), tenantScope(), validate({ query: paginationQuery.extend({ patientId: uuid.optional(), status: z.string().max(20).optional(), search: z.string().max(100).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), clinicId: uuid.optional() }) }), asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const r = await service.list(req.scope, { ...q, offset: (q.page - 1) * q.limit });
    res.json({ success: true, data: r.data, consultations: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
  }));
  router.get('/stats/overview', authorize('clinical:read'), tenantScope(), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.stats(req.scope) });
  }));
  router.get('/patient/:patientId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }) }), asyncHandler(async (req, res) => {
    const r = await service.list(req.scope, { patientId: req.params.patientId, page: 1, limit: 200, offset: 0 });
    res.json({ success: true, consultations: r.data, data: r.data, count: r.data.length });
  }));
  router.get('/patient/:patientId/diagnoses', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }) }), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await service.diagnoses(req.scope, req.params.patientId) });
  }));
  router.get('/:id', authorize('clinical:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    const item = await service.getById(req.scope, req.params.id, ctxOf(req));
    res.json({ success: true, data: item, consultation: item });
  }));
  router.post('/', authorize('clinical:write'), tenantScope(), validate({ body: body.extend({ patientId: uuid }) }), asyncHandler(async (req, res) => {
    const item = await service.create(req.scope, req.body, ctxOf(req));
    res.status(201).json({ success: true, message: 'Consultation created successfully', data: item, consultation: item });
  }));
  router.put('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body }), asyncHandler(async (req, res) => {
    const item = await service.update(req.scope, req.params.id, req.body, ctxOf(req));
    res.json({ success: true, message: 'Consultation updated successfully', data: item, consultation: item });
  }));
  router.put('/:id/status', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body: z.object({ status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'No Show']) }) }), asyncHandler(async (req, res) => {
    const item = await service.update(req.scope, req.params.id, { status: req.body.status }, ctxOf(req));
    res.json({ success: true, message: 'Status updated', data: item });
  }));
  router.post('/:id/prescriptions', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body: z.object({ medication: z.string().max(200).optional(), name: z.string().max(200).optional(), dosage: optionalString(100), frequency: optionalString(100), duration: optionalString(100), instructions: optionalString(1000), diagnosis: optionalString(1000) }) }), asyncHandler(async (req, res) => {
    const enc = await service.getById(req.scope, req.params.id, ctxOf(req));
    const rx = await prescriptions.create(req.scope, { patientId: enc.patientId._id, encounterId: enc.id, doctorId: enc.doctorId ? enc.doctorId._id : undefined, diagnosis: req.body.diagnosis || enc.diagnosis, medications: [{ name: req.body.name || req.body.medication, dosage: req.body.dosage, frequency: req.body.frequency, duration: req.body.duration, instructions: req.body.instructions }] }, ctxOf(req));
    res.status(201).json({ success: true, message: 'Prescription added', data: rx });
  }));
  router.post('/:id/lab-tests', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body: z.object({ testName: z.string().min(1).max(200), priority: z.enum(['Routine', 'Urgent', 'Emergency']).optional(), notes: optionalString(1000) }) }), asyncHandler(async (req, res) => {
    const item = await service.addLabTest(req.scope, req.params.id, req.body, ctxOf(req));
    res.status(201).json({ success: true, message: 'Lab test added', data: item });
  }));
  return router;
}

module.exports = { encounters: build(), consultations: build() };
