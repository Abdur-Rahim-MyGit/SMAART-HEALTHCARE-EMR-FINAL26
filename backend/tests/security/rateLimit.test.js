'use strict';
const express = require('express');
const request = require('supertest');
const { limiter } = require('../../src/common/middleware/rateLimit');

describe('rate limiting', () => {
  it('returns 429 with a safe body after the limit', async () => {
    const app = express();
    app.use(limiter({ name: `unit-${Date.now()}`, windowMs: 60000, max: 3, exact: true }));
    app.get('/x', (_req, res) => res.json({ ok: true }));
    for (let i = 0; i < 3; i++) expect((await request(app).get('/x')).status).toBe(200);
    const r = await request(app).get('/x');
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('RATE_LIMITED');
    expect(r.headers['ratelimit']).toBeDefined();
  });
});
