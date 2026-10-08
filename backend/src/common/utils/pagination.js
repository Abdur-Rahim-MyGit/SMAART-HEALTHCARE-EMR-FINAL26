'use strict';
const { z } = require('zod');

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function paginate(query) {
  const { page, limit } = paginationQuery.parse(query);
  return { page, limit, offset: (page - 1) * limit };
}

function paginationMeta({ page, limit }, total) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { paginationQuery, paginate, paginationMeta };
