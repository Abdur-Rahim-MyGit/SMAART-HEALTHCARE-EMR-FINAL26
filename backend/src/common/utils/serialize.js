'use strict';
/**
 * Document serialisation helpers. Documents are camelCase with a string `_id`; the
 * existing UI also reads `id`. Legacy snake_case input is normalised. Nothing here ever emits secrets.
 */
const SECRET_KEYS = new Set(['password_hash', 'passwordHash', 'password', 'adminPassword', 'refresh_token_hash', 'refreshTokenHash', 'previousTokenHash', 'code_hash', 'codeHash', 'salt', 'otp', 'resetOTP', 'secret']);

function toCamel(key) {
  if (key.startsWith('_')) return key; // _id and other leading-underscore keys stay as they are
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function serializeRow(row, { idAlias = true } = {}) {
  if (row === null || row === undefined) return row;
  if (Array.isArray(row)) return row.map((r) => serializeRow(r, { idAlias }));
  if (row instanceof Date) return row;
  if (row && (row._bsontype === 'ObjectID' || row.constructor?.name === 'ObjectId')) return String(row);
  if (typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (SECRET_KEYS.has(k)) continue;
    const ck = toCamel(k);
    if (v && (v._bsontype === 'ObjectID' || v.constructor?.name === 'ObjectId')) {
      out[ck] = String(v);
    } else {
      out[ck] = v instanceof Date ? v : v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Buffer) ? serializeRow(v, { idAlias: false }) : v;
    }
  }
  if (idAlias && out._id !== undefined && out.id === undefined) out.id = typeof out._id === 'object' ? String(out._id) : out._id;
  if (idAlias && out.id !== undefined && out._id === undefined) out._id = typeof out.id === 'object' ? String(out.id) : out.id;
  if (out._id && typeof out._id === 'object' && (out._id._bsontype === 'ObjectID' || out._id.constructor?.name === 'ObjectId')) out._id = String(out._id);
  if (out.id && typeof out.id === 'object' && (out.id._bsontype === 'ObjectID' || out.id.constructor?.name === 'ObjectId')) out.id = String(out.id);
  return out;
}

/** Minimal reference object used where the legacy API "populated" a relation. */
function ref(id, fields = {}) {
  if (!id) return null;
  const sid = (id && typeof id === 'object' && (id._bsontype === 'ObjectID' || id.constructor?.name === 'ObjectId')) ? String(id) : id;
  return { _id: sid, id: sid, ...fields };
}

function toSnake(key) {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Picks allowed camelCase keys from input and returns a snake_case object (legacy mappers). */
function pickForDb(input, allowed) {
  const out = {};
  for (const key of allowed) {
    if (input[key] !== undefined) out[toSnake(key)] = input[key];
  }
  return out;
}

module.exports = { serializeRow, ref, toCamel, toSnake, pickForDb };
