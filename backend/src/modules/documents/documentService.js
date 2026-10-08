'use strict';
const crypto = require('crypto');
const path = require('path');
const FileType = require('file-type');
const { config } = require('../../config');
const { withTenant, resolveClinicId } = require('../../infrastructure/mongodb/tenant');
const { getStorage } = require('../../infrastructure/storage');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const { auditInTrx } = require('../audit/auditRepository');
const { badRequest, notFound, forbidden } = require('../../common/errors/AppError');
const { serializeRow } = require('../../common/utils/serialize');
const { getLogger } = require('../../common/logging/logger');

/** Allowed uploads: MIME type → permitted extensions. The client's claims are never trusted alone. */
const ALLOWED = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'], 'image/gif': ['.gif'], 'application/pdf': ['.pdf'], 'application/dicom': ['.dcm'] };
const TEXT_SAFE = { 'text/plain': ['.txt'], 'text/csv': ['.csv'] };

async function validateFile({ buffer, fileName, claimedMime }) {
  const env = config();
  if (!buffer || !buffer.length) throw badRequest('Empty file', 'EMPTY_FILE');
  if (buffer.length > env.MAX_UPLOAD_BYTES) throw badRequest('File exceeds the maximum allowed size', 'FILE_TOO_LARGE');
  const ext = path.extname(fileName || '').toLowerCase();
  const sniffed = await FileType.fromBuffer(buffer);
  let mime = sniffed ? sniffed.mime : null;
  if (!mime) {
    if (TEXT_SAFE[claimedMime] && TEXT_SAFE[claimedMime].includes(ext) && !buffer.includes(0)) mime = claimedMime;
    else throw badRequest('Unsupported or unrecognised file type', 'UNSUPPORTED_FILE_TYPE');
  }
  if (mime === 'image/jpg') mime = 'image/jpeg';
  const allowedExts = ALLOWED[mime] || TEXT_SAFE[mime];
  if (!allowedExts) throw badRequest(`File type ${mime} is not allowed`, 'UNSUPPORTED_FILE_TYPE');
  if (ext && !allowedExts.includes(ext)) throw badRequest('File extension does not match its content', 'EXTENSION_MISMATCH');
  if (claimedMime && claimedMime !== mime && !(claimedMime === 'image/jpg' && mime === 'image/jpeg')) getLogger().warn({ claimedMime, mime }, 'client content-type differs from sniffed type; using sniffed type');
  return { mime, ext: ext || `.${sniffed ? sniffed.ext : 'bin'}` };
}

function parseDataUrl(dataUrl) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2].replace(/\s/g, ''), 'base64') };
}
const safeName = (name) => String(name || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 200);

/** Stores a file for a clinic/patient inside the caller's unit of work. */
async function storeDocument(db, scope, { buffer, fileName, claimedMime, clinicId, patientId, encounterId, documentType, category = 'clinical', title, description, tags = [], metadata = {}, isPrivate = true, requestId, ip }) {
  const targetClinic = resolveClinicId(scope, clinicId);
  if (!targetClinic) throw badRequest('clinicId is required', 'CLINIC_REQUIRED');
  if (patientId && !(await db.c('patients').exists({ _id: patientId, clinicId: targetClinic }))) throw notFound('Patient');
  const { mime, ext } = await validateFile({ buffer, fileName, claimedMime });
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const storage = getStorage();
  const uploaded = await storage.upload({ buffer, fileName: `${crypto.randomUUID()}${ext}`, mimeType: mime, folder: `clinics/${targetClinic}/${category}` });
  const row = await db.c('documents').insertOne({ clinicId: targetClinic, patientId: patientId || null, encounterId: encounterId || null, uploadedByUserId: scope.userId || null, uploadedByPractitionerId: null, documentType: documentType || category, category, title: title || safeName(fileName), description: description || null, originalFileName: safeName(fileName || `upload${ext}`), mimeType: mime, sizeBytes: buffer.length, checksumSha256: checksum, storageProvider: storage.name, storageKey: uploaded.key, storageResourceType: uploaded.resourceType, storageVersion: uploaded.version || null, storageFormat: uploaded.format || null, legacyUrl: null, status: 'available', scanStatus: 'not_scanned', isPrivate, tags, metadata });
  await auditInTrx(db, { ...scope, clinicId: targetClinic }, { action: 'DOCUMENT_UPLOADED', resourceType: 'document', resourceId: row._id, requestId, ip, details: { patientId, category, mime, sizeBytes: buffer.length } });
  await enqueueEvent(db, { type: 'document.uploaded', aggregateType: 'document', aggregateId: row._id, clinicId: targetClinic, actorId: scope.userId, payload: { patientId, category, mime } });
  return row;
}

/** Signed, short lived access URL for a document. */
async function accessUrlFor(doc, { ttlSeconds } = {}) {
  if (!doc) return null;
  if (doc.storageProvider === 'legacy_url') return { url: doc.legacyUrl, expiresAt: null };
  if (doc.status !== 'available' || doc.scanStatus === 'infected') return null;
  const env = config();
  const storage = getStorage();
  if (storage.name !== doc.storageProvider) return null;
  return storage.getAccessUrl({ key: doc.storageKey, resourceType: doc.storageResourceType, version: doc.storageVersion, format: doc.storageFormat, ttlSeconds: ttlSeconds || env.DOCUMENT_ACCESS_TTL_SECONDS, fileName: doc.originalFileName });
}
async function urlsForIds(db, ids) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return {};
  const rows = await db.c('documents').find({ _id: { $in: clean } });
  const out = {};
  for (const d of rows) { const a = await accessUrlFor(d); out[d._id] = a ? a.url : null; }
  return out;
}
function serializeDocument(row, url) {
  const s = serializeRow(row);
  delete s.storageKey;
  delete s.legacyUrl;
  return { ...s, fileName: row.originalFileName, fileType: row.mimeType, fileSize: Number(row.sizeBytes), url: url || undefined };
}

async function upload(scope, input, ctx) {
  return withTenant(scope, async (db) => { const row = await storeDocument(db, scope, { ...input, requestId: ctx.requestId, ip: ctx.ip }); const a = await accessUrlFor(row); return serializeDocument(row, a && a.url); });
}
async function getById(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('documents').findById(id);
    if (!row) throw notFound('Document');
    await auditInTrx(db, scope, { action: 'DOCUMENT_VIEWED', resourceType: 'document', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return serializeDocument(row);
  });
}
async function list(scope, { patientId, category, page, limit, offset }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (patientId) filter.patientId = patientId;
    if (category) filter.category = category;
    const col = db.c('documents');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { createdAt: -1 }, limit, skip: offset }), col.count(filter)]);
    const data = [];
    for (const r of rows) { const a = await accessUrlFor(r); data.push(serializeDocument(r, a && a.url)); }
    return { data, total, page, limit };
  });
}
async function access(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('documents').findById(id);
    if (!row) { await auditInTrx(db, scope, { action: 'DOCUMENT_ACCESS_DENIED', resourceType: 'document', resourceId: id, result: 'FAILURE', requestId: ctx.requestId, ip: ctx.ip }); throw notFound('Document'); }
    const a = await accessUrlFor(row);
    if (!a) throw forbidden('Document is not available', 'DOCUMENT_UNAVAILABLE');
    await auditInTrx(db, scope, { action: 'DOCUMENT_VIEWED', resourceType: 'document', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { mode: 'signed-url' } });
    return { ...a, documentId: row._id, mimeType: row.mimeType, fileName: row.originalFileName };
  });
}
async function forDownload(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('documents').findById(id);
    if (!row) throw notFound('Document');
    const a = await accessUrlFor(row);
    if (!a) throw forbidden('Document is not available', 'DOCUMENT_UNAVAILABLE');
    await auditInTrx(db, scope, { action: 'DOCUMENT_DOWNLOADED', resourceType: 'document', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return { row: { ...row, mime_type: row.mimeType, original_file_name: row.originalFileName }, url: a.url };
  });
}
async function remove(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('documents').findById(id);
    if (!row) throw notFound('Document');
    await db.c('documents').updateOne({ _id: id }, { status: 'deleted', deletedAt: new Date() });
    await auditInTrx(db, scope, { action: 'DOCUMENT_DELETED', resourceType: 'document', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'document.deleted', aggregateType: 'document', aggregateId: id, clinicId: row.clinicId, actorId: scope.userId, payload: { storageProvider: row.storageProvider, storageKey: row.storageKey, resourceType: row.storageResourceType } });
    return true;
  });
}

module.exports = { storeDocument, accessUrlFor, urlsForIds, serializeDocument, parseDataUrl, validateFile, upload, getById, list, access, forDownload, remove };
