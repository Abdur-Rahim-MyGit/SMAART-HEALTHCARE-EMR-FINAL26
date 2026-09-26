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
  // PostgreSQL error codes we can safely translate.
  if (err && typeof err.code === 'string') {
    if (err.code === '23505') return new AppError('DUPLICATE', 'A record with the same unique value already exists', 409);
    if (err.code === '23503') return new AppError('INVALID_REFERENCE', 'Referenced record does not exist', 400);
    if (err.code === '23514') return new AppError('CONSTRAINT_VIOLATION', 'Record violates a data constraint', 400);
    if (err.code === '22P02') return new AppError('INVALID_IDENTIFIER', 'Invalid identifier format', 400);
    if (err.code === '42501') return new AppError('FORBIDDEN', 'Access denied', 403);
  }
  if (err && err.name === 'CastError') return new AppError('INVALID_IDENTIFIER', 'Invalid identifier format', 400);
  if (err && err.name === 'ValidationError' && err.errors) {
    return new AppError('VALIDATION_ERROR', 'Validation failed', 422, Object.keys(err.errors).map((k) => ({ path: k, message: err.errors[k].message })));
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
