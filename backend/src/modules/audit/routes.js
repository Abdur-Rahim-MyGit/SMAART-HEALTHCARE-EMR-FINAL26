'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const { serializeRow } = require('../../common/utils/serialize');
const { uuid } = require('../../common/validation/schemas');
const { listAudit } = require('./auditRepository');

const router = express.Router();

router.get(
  '/',
  authorize('audit:read'),
  tenantScope(),
  validate({ query: paginationQuery.extend({ action: z.string().max(64).optional(), resourceType: z.string().max(64).optional(), userId: uuid.optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() }) }),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const result = await listAudit(req.scope, { ...q, offset: (q.page - 1) * q.limit });
    res.json({ success: true, data: serializeRow(result.rows), pagination: paginationMeta(result, result.total) });
  })
);

module.exports = router;
