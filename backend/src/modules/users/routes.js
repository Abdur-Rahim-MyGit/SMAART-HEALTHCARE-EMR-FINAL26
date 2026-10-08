'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, email, uuid, optionalString } = require('../../common/validation/schemas');
const { ROLE_LIST } = require('../../common/security/rbac');
const service = require('./userService');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });

router.get('/', authorize('users:read'), tenantScope(), validate({ query: z.object({ role: z.string().max(40).optional(), clinicId: uuid.optional() }) }), asyncHandler(async (req, res) => {
  const users = await service.list(req.scope, req.validatedQuery);
  res.json({ success: true, users, count: users.length });
}));
router.get('/:id', authorize('users:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json({ success: true, user: await service.getById(req.scope, req.params.id) });
}));
router.post('/', authorize('users:manage'), tenantScope(), validate({ body: z.object({ email, password: z.string().min(8).max(200), role: z.enum(ROLE_LIST), clinicId: uuid.optional(), firstName: z.string().trim().min(1).max(80), lastName: optionalString(80), phone: optionalString(30), username: optionalString(60) }) }), asyncHandler(async (req, res) => {
  const user = await service.create(req.scope, req.body, ctxOf(req));
  res.status(201).json({ success: true, message: 'User created', user });
}));
router.put('/:id', authorize('users:manage'), tenantScope(), validate({ params: idParam, body: z.object({ firstName: optionalString(80), lastName: optionalString(80), phone: optionalString(30), username: optionalString(60), email: email.optional(), password: z.string().min(8).max(200).optional(), isActive: z.boolean().optional() }) }), asyncHandler(async (req, res) => {
  const user = await service.update(req.scope, req.params.id, req.body, ctxOf(req));
  res.json({ success: true, message: 'User updated successfully', user });
}));
router.delete('/:id', authorize('users:manage'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.remove(req.scope, req.params.id, ctxOf(req));
  res.json({ success: true, message: 'User deleted successfully' });
}));

module.exports = router;
