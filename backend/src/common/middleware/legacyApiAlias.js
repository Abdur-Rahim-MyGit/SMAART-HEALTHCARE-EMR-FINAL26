'use strict';
/**
 * The existing UI calls /api/<module>. The canonical API lives under /api/v1.
 * Requests to un-versioned module paths are rewritten transparently.
 */
const RESERVED = new Set(['v1', 'fhir', 'health', 'metrics', 'docs']);
function legacyApiAlias(req, _res, next) {
  const m = /^\/api\/([^/?]+)(.*)$/.exec(req.url);
  if (m && !RESERVED.has(m[1])) req.url = `/api/v1/${m[1]}${m[2]}`;
  next();
}
module.exports = { legacyApiAlias };
