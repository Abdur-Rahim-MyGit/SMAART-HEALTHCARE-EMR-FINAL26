'use strict';

class AppError extends Error {
  /**
   * @param {string} code machine readable code, e.g. PATIENT_NOT_FOUND
   * @param {string} message safe, user facing message
   * @param {number} status HTTP status
   * @param {object} [details] safe details (validation issues etc.)
   */
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

const badRequest = (message = 'Bad request', code = 'BAD_REQUEST', details) => new AppError(code, message, 400, details);
const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') => new AppError(code, message, 401);
const forbidden = (message = 'Access denied', code = 'FORBIDDEN') => new AppError(code, message, 403);
const notFound = (resource = 'Resource', code) => new AppError(code || `${resource.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`, `${resource} not found`, 404);
const conflict = (message = 'Conflict', code = 'CONFLICT') => new AppError(code, message, 409);
const validation = (details) => new AppError('VALIDATION_ERROR', 'Validation failed', 422, details);
const tooMany = (message = 'Too many requests') => new AppError('RATE_LIMITED', message, 429);
const unavailable = (message = 'Service unavailable') => new AppError('SERVICE_UNAVAILABLE', message, 503);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, validation, tooMany, unavailable };
