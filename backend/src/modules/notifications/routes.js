'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam } = require('../../common/validation/schemas');
const service = require('./notificationService');

const router = express.Router();
router.get('/', authorize('notifications:read'), tenantScope(), validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), page: z.coerce.number().int().min(1).default(1), unreadOnly: z.enum(['true', 'false']).optional() }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.list(req.scope, { limit: q.limit, offset: (q.page - 1) * q.limit, unreadOnly: q.unreadOnly === 'true' });
  res.json({ success: true, notifications: r.data, data: r.data, unreadCount: r.unreadCount });
}));
router.put('/read-all', authorize('notifications:read'), tenantScope(), asyncHandler(async (req, res) => { await service.markAllRead(req.scope); res.json({ success: true }); }));
router.put('/:id/read', authorize('notifications:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => { await service.markRead(req.scope, req.params.id); res.json({ success: true }); }));
module.exports = router;
