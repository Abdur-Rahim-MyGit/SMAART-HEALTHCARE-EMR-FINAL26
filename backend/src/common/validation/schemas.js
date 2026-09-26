'use strict';
const { z } = require('zod');

const uuid = z.string().uuid({ message: 'Invalid identifier format' });
const idParam = z.object({ id: uuid });
const email = z.string().trim().toLowerCase().email().max(254);
const phone = z.string().trim().min(6).max(20);
const nonEmpty = z.string().trim().min(1);
const isoDate = z.coerce.date();
const optionalString = (max = 500) => z.string().trim().max(max).optional().nullable();
const jsonObject = z.record(z.string(), z.unknown());

/** Escapes user input before it is used inside an ILIKE pattern. */
function likePattern(term) {
  return `%${String(term).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

module.exports = { uuid, idParam, email, phone, nonEmpty, isoDate, optionalString, jsonObject, likePattern };
