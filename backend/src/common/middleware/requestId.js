'use strict';
const { randomUUID } = require('crypto');

const SAFE_ID = /^[A-Za-z0-9._-]{8,128}$/;

function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
module.exports = { requestId };
