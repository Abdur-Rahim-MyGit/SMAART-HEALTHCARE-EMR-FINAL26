'use strict';
const crypto = require('crypto');
const path = require('path');
const FileType = require('file-type');
const { config } = require('../../config');
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { getStorage } = require('../../infrastructure/storage');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const { auditInTrx } = require('../audit/auditRepository');
const { badRequest, notFound, forbidden } = require('../../common/errors/AppError');
const { serializeRow } = require('../../common/utils/serialize');
const { getLogger } = require('../../common/logging/logger');

const repo = new BaseRepository('documents');

/** Allowed uploads: MIME type → permitted extensions. The client's claims are never trusted alone. */
const ALLOWED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf'],
  'application/dicom': ['.dcm'],
};
const TEXT_SAFE = { 'text/plain': ['.txt'], 'text/csv': ['.csv'] };

async function validateFile({ buffer, fileName, claimedMime }) {
  const env = config();
  if (!buffer || !buffer.length) throw badRequest('Empty file', 'EMPTY_FILE');
  if (buffer.length > env.MAX_UPLOAD_BYTES) throw badRequest('File exceeds the maximum allowed size', 'FILE_TOO_LARGE');
  const ext = path.extname(fileName || '').toLowerCase();
  const sniffed = await FileType.fromBuffer(buffer);
  let mime = sniffed ? sniffed.mime : null;
  if (!mime) {
    // Only plain text types may lack a magic number; everything else must sniff cleanly.
    if (TEXT_SAFE[claimedMime] && TEXT_SAFE[claimedMime].includes(ext) && !buffer.includes(0)) mime = claimedMime;
    else throw badRequest('Unsupported or unrecognised file type', 'UNSUPPORTED_FILE_TYPE');
  }
  if (mime === 'image/jpg') mime = 'image/jpeg';
  const allowedExts = ALLOWED[mime] || TEXT_SAFE[mime];
  if (!allowedExts) throw badRequest(`File type ${mime} is not allowed`, 'UNSUPPORTED_FILE_TYPE');
  if (ext && !allowedExts.includes(ext)) throw badRequest('File extension does not match its content', 'EXTENSION_MISMATCH');
  if (claimedMime && claimedMime !== mime && !(claimedMime === 'image/jpg' && mime === 'image/jpeg')) {
    getLogger().warn({ claimedMime, mime }, 'client content-type differs from sniffed type; using sniffed type');
  }
  return { mime, ext: ext || `.${sniffed ? sniffed.ext : 'bin'}` };
}

/** Parses a data: URL (legacy base64 uploads from the UI) into a buffer. */
function parseDataUrl(dataUrl) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2].replace(/\s/g, ''), 'base64') };
}

function safeName(name) {
  return String(name || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 200);
}

/**
 * Stores a file for a clinic/patient. Runs inside the caller's transaction when
 * provided so the document row and the owning record commit together.
 */
async function storeDocument(trx, scope, { buffer, fileName, claimedMime, clinicId, patientId, encounterId, documentType, category = 'clinical', title, description, tags = [], metadata = {}, isPrivate = true, requestId, ip }) {
  const targetClinic = repo.resolveClinicId(scope, clinicId);
  if (!targetClinic) throw badRequest('clinicId is required', 'CLINIC_REQUIRED');
  if (patientId) {
    const patient = await trx('patients').where({ id: patientId, clinic_id: targetClinic }).whereNull('deleted_at').first('id');
    if (!patient) throw notFound('Patient');
  }
  const { mime, ext } = await validateFile({ buffer, fileName, claimedMime });
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const storage = getStorage();
  const uploaded = await storage.upload({ buffer, fileName: `${crypto.randomUUID()}${ext}`, mimeType: mime, folder: `clinics/${targetClinic}/${category}` });
  const [row] = await trx('documents')
    .insert({
      clinic_id: targetClinic,
      patient_id: patientId || null,
      encounter_id: encounterId || null,
      uploaded_by_user_id: scope.userId || null,
      document_type: documentType || category,
      category,
      title: title || safeName(fileName),
      description: description || null,
      original_file_name: safeName(fileName || `upload${ext}`),
      mime_type: mime,
      size_bytes: buffer.length,
      checksum_sha256: checksum,
      storage_provider: storage.name,
      storage_key: uploaded.key,
      storage_resource_type: uploaded.resourceType,
      storage_version: uploaded.version || null,
      storage_format: uploaded.format || null,
      status: 'available',
      scan_status: 'not_scanned', // malware scanning hook: a worker can flip this to pending/clean/infected
      is_private: isPrivate,
      tags: JSON.stringify(tags),
      metadata: JSON.stringify(metadata),
      created_by: scope.userId || null,
      updated_by: scope.userId || null,
    })
    .returning('*');
  await auditInTrx(trx, { ...scope, clinicId: targetClinic }, { action: 'DOCUMENT_UPLOADED', resourceType: 'document', resourceId: row.id, requestId, ip, details: { patientId, category, mime, sizeBytes: buffer.length } });
  await enqueueEvent(trx, { type: 'document.uploaded', aggregateType: 'document', aggregateId: row.id, clinicId: targetClinic, actorId: scope.userId, payload: { patientId, category, mime } });
  return row;
}

/** Signed, short lived access URL for a document row. No network call for Cloudinary/local. */
async function accessUrlFor(doc, { ttlSeconds } = {}) {
  if (!doc) return null;
  if (doc.storage_provider === 'legacy_url') return { url: doc.legacy_url, expiresAt: null };
  if (doc.status !== 'available' || doc.scan_status === 'infected') return null;
  const env = config();
  const storage = getStorage();
  if (storage.name !== doc.storage_provider) return null;
  return storage.getAccessUrl({ key: doc.storage_key, resourceType: doc.storage_resource_type, version: doc.storage_version, format: doc.storage_format, ttlSeconds: ttlSeconds || env.DOCUMENT_ACCESS_TTL_SECONDS, fileName: doc.original_file_name });
}

async function urlsForIds(trx, ids) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return {};
  const rows = await trx('documents').whereIn('id', clean).whereNull('deleted_at');
  const out = {};
  for (const d of rows) {
    const a = await accessUrlFor(d);
    out[d.id] = a ? a.url : null;
  }
  return out;
}

function serializeDocument(row, url) {
  const s = serializeRow(row);
  delete s.storageKey;
  delete s.legacyUrl;
  return { ...s, fileName: row.original_file_name, fileType: row.mime_type, fileSize: Number(row.size_bytes), url: url || undefined };
}

// ---- service methods used by routes ----
async function upload(scope, input, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await storeDocument(trx, scope, { ...input, requestId: ctx.requestId, ip: ctx.ip });
    const a = await accessUrlFor(row);
    return serializeDocument(row, a && a.url);
  }, getKnex());
}

async function getById(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Document');
    await auditInTrx(trx, scope, { action: 'DOCUMENT_VIEWED', resourceType: 'document', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return serializeDocument(row);
  }, getKnex());
}

async function list(scope, { patientId, category, page, limit, offset }) {
  return withTenant(scope, async (trx) => {
    const where = {};
    if (patientId) where.patient_id = patientId;
    if (category) where.category = category;
    const rows = await repo.list(trx, scope, { where, limit, offset });
    const total = await repo.count(trx, scope, where);
    const data = [];
    for (const r of rows) {
      const a = await accessUrlFor(r);
      data.push(serializeDocument(r, a && a.url));
    }
    return { data, total, page, limit };
  }, getKnex());
}

async function access(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) {
      await auditInTrx(trx, scope, { action: 'DOCUMENT_ACCESS_DENIED', resourceType: 'document', resourceId: id, result: 'FAILURE', requestId: ctx.requestId, ip: ctx.ip });
      throw notFound('Document');
    }
    const a = await accessUrlFor(row);
    if (!a) throw forbidden('Document is not available', 'DOCUMENT_UNAVAILABLE');
    await auditInTrx(trx, scope, { action: 'DOCUMENT_VIEWED', resourceType: 'document', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { mode: 'signed-url' } });
    return { ...a, documentId: row.id, mimeType: row.mime_type, fileName: row.original_file_name };
  }, getKnex());
}

/** Resolves a document for streaming through the API (proxy download). */
async function forDownload(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Document');
    const a = await accessUrlFor(row);
    if (!a) throw forbidden('Document is not available', 'DOCUMENT_UNAVAILABLE');
    await auditInTrx(trx, scope, { action: 'DOCUMENT_DOWNLOADED', resourceType: 'document', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return { row, url: a.url };
  }, getKnex());
}

async function remove(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Document');
    await trx('documents').where({ id }).update({ status: 'deleted', deleted_at: trx.fn.now(), updated_by: scope.userId || null });
    await auditInTrx(trx, scope, { action: 'DOCUMENT_DELETED', resourceType: 'document', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'document.deleted', aggregateType: 'document', aggregateId: id, clinicId: row.clinic_id, actorId: scope.userId, payload: { storageProvider: row.storage_provider, storageKey: row.storage_key, resourceType: row.storage_resource_type } });
    return true;
  }, getKnex());
}

module.exports = { storeDocument, accessUrlFor, urlsForIds, serializeDocument, parseDataUrl, validateFile, upload, getById, list, access, forDownload, remove, repo };
