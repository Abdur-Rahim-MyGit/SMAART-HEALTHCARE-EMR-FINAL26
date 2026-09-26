'use strict';
const { validation } = require('../errors/AppError');

/** Validates params/query/body with Zod schemas and replaces them with the parsed values. */
function validate({ params, query, body, headers } = {}) {
  return (req, _res, next) => {
    const issues = [];
    const run = (schema, value, where) => {
      if (!schema) return value;
      const r = schema.safeParse(value);
      if (!r.success) {
        for (const i of r.error.issues) issues.push({ in: where, path: i.path.join('.'), message: i.message });
        return value;
      }
      return r.data;
    };
    const p = run(params, req.params, 'params');
    const q = run(query, req.query, 'query');
    const b = run(body, req.body, 'body');
    run(headers, req.headers, 'headers');
    if (issues.length) return next(validation(issues));
    req.params = p;
    req.validatedQuery = q;
    req.body = b;
    next();
  };
}
module.exports = { validate };
