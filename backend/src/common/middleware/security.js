'use strict';
const helmet = require('helmet');
const cors = require('cors');
const express = require('express');
const cookieParser = require('cookie-parser');
const { config } = require('../../config');

function securityMiddleware(app) {
  const env = config();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY ? 1 : false);
  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    })
  );
  const origins = env.CORS_ORIGINS;
  app.use(
    cors({
      origin(origin, cb) {
        // Non-browser clients and same-origin requests have no Origin header.
        if (!origin) return cb(null, true);
        if (origins.includes(origin)) return cb(null, true);
        if (!env.isProduction && origins.length === 0 && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key', 'X-Clinic-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: env.BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: env.BODY_LIMIT }));
  // Reject prototype pollution / operator injection attempts in JSON bodies.
  app.use((req, _res, next) => {
    const bad = (o) => {
      if (!o || typeof o !== 'object') return false;
      for (const k of Object.keys(o)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype' || k.startsWith('$')) return true;
        if (bad(o[k])) return true;
      }
      return false;
    };
    if (bad(req.body) || bad(req.query)) {
      return _res.status(400).json({ success: false, message: 'Invalid request payload', error: { code: 'INVALID_PAYLOAD', message: 'Invalid request payload' }, requestId: req.id });
    }
    next();
  });
}

module.exports = { securityMiddleware };
