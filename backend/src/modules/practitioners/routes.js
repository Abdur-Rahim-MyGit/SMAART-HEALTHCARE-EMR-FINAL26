'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString } = require('../../common/validation/schemas');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const service = require('./practitionerService');

const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const body = z.object({
  fullName: z.string().trim().min(1).max(150).optional(),
  name: z.string().trim().min(1).max(150).optional(),
  email: z.union([z.string().trim().email().max(254), z.literal(''), z.null()]).optional(),
  phone: optionalString(30),
  specialty: optionalString(120),
  specialization: optionalString(120),
  qualification: optionalString(200),
  licenseNumber: optionalString(100),
  department: optionalString(100),
  shift: optionalString(40),
  experienceYears: z.coerce.number().min(0).max(80).optional().nullable(),
  experience: z.coerce.number().min(0).max(80).optional().nullable(),
  about: optionalString(2000),
  uhid: optionalString(60),
  languages: z.array(z.string().max(40)).max(20).optional(),
  currentAddress: z.record(z.string(), z.unknown()).optional(),
  permanentAddress: z.record(z.string(), z.unknown()).optional(),
  profileImage: z.string().max(20 * 1024 * 1024).optional().nullable(),
  clinicId: uuid.optional(),
  isActive: z.boolean().optional(),
}).passthrough();
const listQuery = paginationQuery.extend({ limit: z.coerce.number().int().min(1).max(500).default(100), search: z.string().max(100).optional(), specialty: z.string().max(100).optional(), isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(), clinicId: uuid.optional() });

function build(kind, { listKey, itemKey, label }) {
  const router = express.Router();
  router.get('/', authorize('practitioners:read'), tenantScope(), validate({ query: listQuery }), asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const r = await service.list(req.scope, kind, { ...q, offset: (q.page - 1) * q.limit });
    res.json({ success: true, [listKey]: r.data, data: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
  }));
  router.get('/stats/overview', authorize('practitioners:read'), tenantScope(), asyncHandler(async (req, res) => {
    const s = await service.stats(req.scope, kind);
    res.json({ success: true, data: { [`total${label}s`]: s.total, [`active${label}s`]: s.active, [`inactive${label}s`]: s.inactive, bySpecialty: s.bySpecialty, ...s } });
  }));
  router.get('/:id', authorize('practitioners:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    const item = await service.getById(req.scope, kind, req.params.id);
    res.json({ success: true, [itemKey]: item, data: item });
  }));
  router.post('/', authorize('practitioners:write'), tenantScope(), validate({ body }), asyncHandler(async (req, res) => {
    const item = await service.create(req.scope, kind, req.body, ctxOf(req));
    res.status(201).json({ success: true, message: `${label} created successfully`, [itemKey]: item, data: item });
  }));
  router.put('/:id', authorize('practitioners:write'), tenantScope(), validate({ params: idParam, body }), asyncHandler(async (req, res) => {
    const item = await service.update(req.scope, kind, req.params.id, req.body, ctxOf(req));
    res.json({ success: true, message: `${label} updated successfully`, [itemKey]: item, data: item });
  }));
  router.delete('/:id', authorize('practitioners:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    await service.setActive(req.scope, kind, req.params.id, false, ctxOf(req));
    res.json({ success: true, message: `${label} deactivated successfully` });
  }));
  router.patch('/:id/activate', authorize('practitioners:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    const item = await service.setActive(req.scope, kind, req.params.id, true, ctxOf(req));
    res.json({ success: true, message: `${label} activated successfully`, [itemKey]: item, data: item });
  }));
  return router;
}

const practitioners = express.Router();
practitioners.get('/', authorize('practitioners:read'), tenantScope(), validate({ query: listQuery.extend({ kind: z.enum(['doctor', 'nurse', 'lab_technician']).default('doctor') }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.list(req.scope, q.kind, { ...q, offset: (q.page - 1) * q.limit });
  res.json({ success: true, data: r.data, pagination: paginationMeta(r, r.total) });
}));

module.exports = { doctors: build('doctor', { listKey: 'doctors', itemKey: 'doctor', label: 'Doctor' }), nurses: build('nurse', { listKey: 'nurses', itemKey: 'nurse', label: 'Nurse' }), practitioners };
