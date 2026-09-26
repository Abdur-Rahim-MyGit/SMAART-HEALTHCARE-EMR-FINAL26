'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString, jsonObject } = require('../../common/validation/schemas');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const service = require('./referralService');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const body = z.object({ patientId: uuid.optional(), encounterId: uuid.optional().nullable(), specialistId: uuid.optional().nullable(), referredBy: uuid.optional().nullable(), referralType: z.enum(['inbound', 'outbound']).optional(), specialistName: optionalString(150), specialty: optionalString(120), specialistContact: jsonObject.optional(), specialistAddress: jsonObject.optional(), externalClinic: jsonObject.optional(), reason: optionalString(2000), clinicalHistory: optionalString(5000), currentMedications: z.array(z.unknown()).optional(), testResults: jsonObject.optional(), urgency: z.enum(['Low', 'Medium', 'High', 'Urgent', 'Emergency']).optional(), preferredDate: z.union([z.coerce.date(), z.literal(''), z.null()]).optional(), preferredTime: optionalString(20), status: z.enum(['Pending', 'Approved', 'In Progress', 'Completed', 'Cancelled']).optional(), statusNotes: optionalString(2000), insuranceInfo: jsonObject.optional(), referringProvider: z.union([jsonObject, z.string().max(200)]).optional(), specialInstructions: optionalString(2000), attachments: z.array(z.unknown()).max(20).optional(), shareableLink: jsonObject.optional() }).passthrough();

router.get('/', authorize('referrals:read'), tenantScope(), validate({ query: paginationQuery.extend({ patientId: uuid.optional(), status: z.string().max(20).optional(), urgency: z.string().max(20).optional(), referralType: z.string().max(20).optional(), search: z.string().max(100).optional(), clinicId: uuid.optional() }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.list(req.scope, { ...q, offset: (q.page - 1) * q.limit });
  res.json({ success: true, data: r.data, referrals: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
}));
router.get('/stats/overview', authorize('referrals:read'), tenantScope(), asyncHandler(async (req, res) => res.json({ success: true, data: await service.stats(req.scope) })));
router.get('/urgent', authorize('referrals:read'), tenantScope(), asyncHandler(async (req, res) => { const r = await service.list(req.scope, { urgency: 'High', limit: 100 }); res.json({ success: true, data: r.data }); }));
router.get('/:id', authorize('referrals:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => res.json({ success: true, data: await service.getById(req.scope, req.params.id) })));
router.post('/', authorize('referrals:write'), tenantScope(), validate({ body: body.extend({ patientId: uuid, specialistName: z.string().min(1).max(150), specialty: z.string().min(1).max(120), reason: z.string().min(1).max(2000) }) }), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, message: 'Referral created successfully', data: await service.create(req.scope, req.body, ctxOf(req)) });
}));
router.put('/:id', authorize('referrals:write'), tenantScope(), validate({ params: idParam, body }), asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Referral updated successfully', data: await service.update(req.scope, req.params.id, req.body, ctxOf(req)) });
}));
router.put('/:id/status', authorize('referrals:write'), tenantScope(), validate({ params: idParam, body: z.object({ status: z.enum(['Pending', 'Approved', 'In Progress', 'Completed', 'Cancelled']), statusNotes: optionalString(2000) }) }), asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Referral status updated', data: await service.update(req.scope, req.params.id, req.body, ctxOf(req)) });
}));
router.delete('/:id', authorize('referrals:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.remove(req.scope, req.params.id, ctxOf(req));
  res.json({ success: true, message: 'Referral deleted' });
}));
module.exports = router;
