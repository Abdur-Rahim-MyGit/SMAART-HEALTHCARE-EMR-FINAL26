'use strict';
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { z } = require('zod');
const { config } = require('../../config');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idempotency } = require('../../common/middleware/idempotency');
const { uuid, idParam } = require('../../common/validation/schemas');
const { paginationQuery, paginationMeta } = require('../../common/utils/pagination');
const { badRequest, notFound } = require('../../common/errors/AppError');
const { verifyPurposeToken } = require('../../common/security/tokens');
const { getStorage } = require('../../infrastructure/storage');
const service = require('./documentService');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config().MAX_UPLOAD_BYTES, files: 1 } });

const uploadBody = z.object({
  patientId: uuid.optional(),
  encounterId: uuid.optional(),
  clinicId: uuid.optional(),
  documentType: z.string().max(60).optional(),
  category: z.enum(['clinical', 'imaging', 'lab', 'prescription', 'identity', 'profile', 'administrative', 'other']).default('clinical'),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  tags: z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v), z.array(z.string().max(50)).max(20).optional()),
  fileData: z.string().max(20 * 1024 * 1024).optional(), // base64 data URL alternative to multipart
  fileName: z.string().max(255).optional(),
});

router.post('/', authorize('documents:write'), tenantScope(), idempotency(), upload.single('file'), validate({ body: uploadBody }), asyncHandler(async (req, res) => {
  let buffer;
  let fileName;
  let claimedMime;
  if (req.file) {
    buffer = req.file.buffer;
    fileName = req.file.originalname;
    claimedMime = req.file.mimetype;
  } else if (req.body.fileData) {
    const parsed = service.parseDataUrl(req.body.fileData);
    if (!parsed) throw badRequest('fileData must be a base64 data URL', 'INVALID_FILE_DATA');
    buffer = parsed.buffer;
    claimedMime = parsed.mime;
    fileName = req.body.fileName || 'upload';
  } else {
    throw badRequest('A file is required', 'FILE_REQUIRED');
  }
  const doc = await service.upload(req.scope, { ...req.body, buffer, fileName, claimedMime }, ctxOf(req));
  res.status(201).json({ success: true, message: 'Document uploaded successfully', data: doc, document: doc });
}));

router.get('/', authorize('documents:read'), tenantScope(), validate({ query: paginationQuery.extend({ patientId: uuid.optional(), category: z.string().max(40).optional() }) }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const r = await service.list(req.scope, { ...q, offset: (q.page - 1) * q.limit });
  res.json({ success: true, data: r.data, count: r.data.length, pagination: paginationMeta(r, r.total) });
}));

// Development-only file serving for the local storage provider (signed, expiring token).
const localFileHandler = asyncHandler(async (req, res) => {
  const storage = getStorage();
  if (storage.name !== 'local') throw notFound('File');
  let claims;
  try {
    claims = verifyPurposeToken(req.params.token, 'local-file');
  } catch {
    throw notFound('File');
  }
  const full = storage.resolvePath(claims.key);
  if (!fs.existsSync(full)) throw notFound('File');
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(full);
});

router.get('/:id', authorize('documents:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getById(req.scope, req.params.id, ctxOf(req)) });
}));

router.get('/:id/access', authorize('documents:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const a = await service.access(req.scope, req.params.id, ctxOf(req));
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ success: true, data: a });
}));

router.get('/:id/download', authorize('documents:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const { row, url } = await service.forDownload(req.scope, req.params.id, ctxOf(req));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${row.original_file_name.replace(/"/g, '')}"`);
  if (getStorage().name === 'local') {
    const claims = verifyPurposeToken(decodeURIComponent(url.split('/local/')[1]), 'local-file');
    return res.sendFile(getStorage().resolvePath(claims.key));
  }
  const upstream = await fetch(url);
  if (!upstream.ok) throw notFound('File');
  const { Readable } = require('stream');
  Readable.fromWeb(upstream.body).pipe(res);
}));

router.delete('/:id', authorize('documents:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.remove(req.scope, req.params.id, ctxOf(req));
  res.json({ success: true, message: 'Document deleted' });
}));

module.exports = router;
module.exports.localFileHandler = localFileHandler;
