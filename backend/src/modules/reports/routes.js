'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const service = require('./reportService');

const router = express.Router();
router.get('/super-master-stats', authorize('reports:system'), tenantScope(), asyncHandler(async (req, res) => res.json({ success: true, data: await service.superMasterStats(req.scope) })));
router.get('/overview', authorize('reports:read'), tenantScope(), asyncHandler(async (req, res) => res.json({ success: true, data: await service.overview(req.scope) })));
router.get('/recent-activity', authorize('reports:read'), tenantScope(), asyncHandler(async (req, res) => res.json({ success: true, data: await service.recentActivity(req.scope) })));
router.get('/analytics', authorize('reports:read'), tenantScope(), validate({ query: z.object({ period: z.enum(['7d', '30d', '90d', '1y']).default('30d') }) }), asyncHandler(async (req, res) => res.json({ success: true, data: await service.analytics(req.scope, req.validatedQuery.period) })));
router.get('/system-health', authorize('system:health'), tenantScope(), asyncHandler(async (req, res) => res.json({ success: true, data: await service.systemHealth(req.scope) })));
router.get('/alerts', authorize('reports:read'), tenantScope(), asyncHandler(async (req, res) => res.json({ success: true, data: await service.alerts(req.scope) })));
module.exports = router;
