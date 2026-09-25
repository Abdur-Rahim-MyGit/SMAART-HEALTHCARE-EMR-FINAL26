'use strict';
const pino = require('pino');
const { config } = require('../../config');

// Anything that could carry credentials, tokens, OTPs or clinical payloads is redacted.
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.adminPassword',
  '*.passwordHash',
  '*.password_hash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.resetToken',
  '*.otp',
  '*.code',
  '*.secret',
  '*.apiKey',
  '*.api_secret',
  '*.aadhaarNumber',
  'body',
  'payload',
];

let root;
function getLogger() {
  if (!root) {
    const env = config();
    root = pino({
      name: env.APP_NAME,
      level: env.isTest ? 'silent' : env.LOG_LEVEL,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      base: { service: env.APP_NAME, env: env.NODE_ENV },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
    });
  }
  return root;
}

module.exports = { getLogger, REDACT_PATHS };
