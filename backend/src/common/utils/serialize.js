'use strict';
/**
 * Row serialisation helpers. PostgreSQL rows are snake_case; the existing UI expects
 * camelCase plus a Mongo style `_id`. Nothing here ever emits secrets.
 */
const SECRET_KEYS = new Set(['password_hash', 'passwordHash', 'password', 'adminPassword', 'refresh_token_hash', 'code_hash', 'otp', 'resetOTP', 'secret']);

function toCamel(key) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function serializeRow(row, { idAlias = true } = {}) {
  if (row === null || row === undefined) return row;
  if (Array.isArray(row)) return row.map((r) => serializeRow(r, { idAlias }));
  if (row instanceof Date) return row;
  if (typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (SECRET_KEYS.has(k)) continue;
    const ck = toCamel(k);
    out[ck] = v instanceof Date ? v : v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Buffer) ? serializeRow(v, { idAlias: false }) : v;
  }
  if (idAlias && out.id !== undefined && out._id === undefined) out._id = out.id;
  return out;
}

/** Minimal reference object used where the legacy API "populated" a relation. */
function ref(id, fields = {}) {
  if (!id) return null;
  return { _id: id, id, ...fields };
}

function toSnake(key) {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Picks allowed camelCase keys from input and returns a snake_case object for knex. */
function pickForDb(input, allowed) {
  const out = {};
  for (const key of allowed) {
    if (input[key] !== undefined) out[toSnake(key)] = input[key];
  }
  return out;
}

module.exports = { serializeRow, ref, toCamel, toSnake, pickForDb };
