'use strict';
const { ZodError } = require('zod');
const { AppError } = require('./AppError');
const { getLogger } = require('../logging/logger');
const { config } = require('../../config');

function mapKnownError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError('VALIDATION_ERROR', 'Validation failed', 422, err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  if (err && err.type === 'entity.too.large') return new AppError('PAYLOAD_TOO_LARGE', 'Request body too large', 413);
  if (err && err.type === 'entity.parse.failed') return new AppError('INVALID_JSON', 'Malformed JSON body', 400);
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') return new AppError('FILE_TOO_LARGE', 'Uploaded file exceeds the size limit', 413);
    return new AppError('UPLOAD_ERROR', 'Invalid upload', 400);
  }
  // MongoDB driver errors we can safely translate (never echo the raw message).
  if (err && (err.name === 'MongoServerError' || err.name === 'MongoBulkWriteError' || typeof err.code === 'number')) {
    if (err.code === 11000) return new AppError('DUPLICATE', 'A record with the same unique value already exists', 409);
    if (err.code === 121) return new AppError('CONSTRAINT_VIOLATION', 'Record violates a data constraint', 422);
    if (err.code === 112 || err.code === 251) return new AppError('CONCURRENT_MODIFICATION', 'The record was modified concurrently, please retry', 409);
    if (err.code === 13 || err.code === 8000) return new AppError('FORBIDDEN', 'Access denied', 403);
  }
  return null;
}

function errorHandler(err, req, res, _next) {
  const log = (req.log || getLogger());
  const env = config();
  const known = mapKnownError(err);
  const requestId = req.id;

  if (!known) {
    log.error({ err, requestId }, 'Unhandled error');
    const body = {
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      requestId,
    };
    if (!env.isProduction) body.debug = { message: err && err.message };
    return res.status(500).json(body);
  }

  if (known.status >= 500) log.error({ err, requestId }, known.message);
  else log.warn({ code: known.code, status: known.status, requestId }, known.message);

  return res.status(known.status).json({
    success: false,
    // `message` is kept for the existing UI which reads error.response.data.message
    message: known.message,
    error: { code: known.code, message: known.message, details: known.details },
    requestId,
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: { code: 'ROUTE_NOT_FOUND', message: `Cannot ${req.method} ${req.originalUrl}` },
    requestId: req.id,
  });
}

module.exports = { errorHandler, notFoundHandler, mapKnownError };
