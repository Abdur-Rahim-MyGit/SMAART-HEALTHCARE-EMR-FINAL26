'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { uuid } = require('../../common/validation/schemas');
const service = require('./timelineService');

const router = express.Router();
router.get('/patient/:patientId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }), query: z.object({ cursor: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(100).default(50), types: z.string().max(200).optional() }) }), asyncHandler(async (req, res) => {
  const r = await service.patientTimeline(req.scope, req.params.patientId, req.validatedQuery, { requestId: req.id, ip: req.ip });
  res.json({ success: true, ...r });
}));
module.exports = router;
