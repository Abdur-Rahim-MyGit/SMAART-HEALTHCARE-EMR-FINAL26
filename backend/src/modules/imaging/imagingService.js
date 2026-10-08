'use strict';
const { withTenant } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');
const encounters = require('../encounters/encounterService');
const documents = require('../documents/documentService');

function serialize(r, { patient, doctor, doc, url } = {}) {
  const s = serializeRow(r);
  return {
    ...s,
    imageType: r.modality,
    imageUrl: url || null,
    cloudinaryUrl: url || null,
    imageTakenDate: r.studyDate,
    fileName: doc ? doc.originalFileName : null,
    fileSize: doc ? Number(doc.sizeBytes) : null,
    mimeType: doc ? doc.mimeType : null,
    documentId: r.documentId,
    patientId: patient || ref(r.patientId),
    uploadedBy: doctor || (r.uploadedBy ? ref(r.uploadedBy) : null),
  };
}

async function hydrate(db, rows) {
  if (!rows.length) return [];
  const [pmap, dmap, docs] = await Promise.all([patients.refsFor(db, rows.map((r) => r.patientId)), practitioners.refsFor(db, rows.map((r) => r.uploadedBy)), db.c('documents').find({ _id: { $in: rows.map((r) => r.documentId).filter(Boolean) } })]);
  const docMap = Object.fromEntries(docs.map((d) => [d._id, d]));
  const out = [];
  for (const r of rows) {
    const doc = docMap[r.documentId];
    const a = doc ? await documents.accessUrlFor(doc) : null;
    out.push(serialize(r, { patient: pmap[r.patientId], doctor: dmap[r.uploadedBy], doc, url: a && a.url }));
  }
  return out;
}

async function list(scope, { patientId, imageType, bodyPart, status = 'Active', clinicId, page = 1, limit = 50, offset = 0 }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    if (imageType) filter.modality = imageType;
    if (bodyPart) filter.bodyPart = bodyPart;
    if (status) filter.status = status;
    const col = db.c('imaging_studies');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { studyDate: -1 }, limit, skip: offset }), col.count(filter)]);
    return { data: await hydrate(db, rows), total, page, limit };
  });
}

async function getById(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('imaging_studies').findById(id);
    if (!row) throw notFound('Medical image');
    await auditInTrx(db, scope, { action: 'DOCUMENT_VIEWED', resourceType: 'imaging_study', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return (await hydrate(db, [row]))[0];
  });
}

async function create(scope, input, file, ctx) {
  if (!input.patientId) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (db) => {
    const patient = await patients.assertPatient(db, scope, input.patientId);
    const clinicId = patient.clinicId;
    if (input.encounterId) await encounters.assertEncounter(db, scope, input.encounterId);
    if (input.uploadedBy) await practitioners.assertPractitioner(db, scope, input.uploadedBy);
    let documentId = input.documentId || null;
    let buffer = file ? file.buffer : null;
    let fileName = file ? file.originalname : null;
    let claimedMime = file ? file.mimetype : null;
    if (!buffer && input.fileData) {
      const parsed = documents.parseDataUrl(input.fileData);
      if (!parsed) throw badRequest('fileData must be a base64 data URL', 'INVALID_FILE_DATA');
      buffer = parsed.buffer; claimedMime = parsed.mime; fileName = input.fileName || `${input.title || 'image'}.${parsed.mime.split('/')[1] || 'bin'}`;
    }
    if (buffer) {
      const doc = await documents.storeDocument(db, scope, { buffer, fileName, claimedMime, clinicId, patientId: patient._id, encounterId: input.encounterId, category: 'imaging', documentType: input.imageType || 'imaging', title: input.title, description: input.description, tags: input.tags, requestId: ctx.requestId, ip: ctx.ip });
      documentId = doc._id;
    } else if (documentId) {
      if (!(await db.c('documents').exists({ _id: documentId, clinicId }))) throw notFound('Document');
    } else if (input.imageUrl && /^https?:\/\//.test(input.imageUrl)) {
      // Legacy external URL: recorded as a legacy_url document so access still goes through the document service.
      const doc = await db.c('documents').insertOne({ clinicId, patientId: patient._id, encounterId: input.encounterId || null, uploadedByUserId: scope.userId, uploadedByPractitionerId: input.uploadedBy || null, documentType: input.imageType || 'imaging', category: 'imaging', title: input.title || 'Medical image', description: input.description || null, originalFileName: input.fileName || 'external', mimeType: input.mimeType || 'application/octet-stream', sizeBytes: Number(input.fileSize) || 0, checksumSha256: null, storageProvider: 'legacy_url', storageKey: input.imageUrl, storageResourceType: null, storageVersion: null, storageFormat: null, legacyUrl: input.imageUrl, status: 'available', scanStatus: 'not_scanned', isPrivate: true, tags: input.tags || [], metadata: {} });
      documentId = doc._id;
    } else {
      throw badRequest('An image file is required', 'FILE_REQUIRED');
    }
    const row = await db.c('imaging_studies').insertOne({ clinicId, patientId: patient._id, encounterId: input.encounterId || null, documentId, modality: input.imageType || 'Other', bodyPart: input.bodyPart || null, title: input.title || input.imageType || 'Medical image', description: input.description || null, associatedDiagnosis: input.associatedDiagnosis || null, studyDate: input.imageTakenDate ? new Date(input.imageTakenDate) : new Date(), status: 'Active', isPrivate: input.isPrivate !== false, tags: input.tags || [], uploadedBy: input.uploadedBy || null, uploadedByUserId: scope.userId });
    await auditInTrx(db, { ...scope, clinicId }, { action: 'IMAGING_STUDY_CREATED', resourceType: 'imaging_study', resourceId: row._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'imaging.study.created', aggregateType: 'imaging_study', aggregateId: row._id, clinicId, actorId: scope.userId, payload: { patientId: patient._id } });
    return (await hydrate(db, [row]))[0];
  });
}

async function update(scope, id, input, ctx) {
  return withTenant(scope, async (db) => {
    const patch = {};
    for (const [k, c] of Object.entries({ title: 'title', description: 'description', imageType: 'modality', bodyPart: 'bodyPart', associatedDiagnosis: 'associatedDiagnosis', isPrivate: 'isPrivate', status: 'status' })) if (input[k] !== undefined) patch[c] = input[k];
    if (input.tags !== undefined) patch.tags = input.tags || [];
    const row = await db.c('imaging_studies').updateOne({ _id: id }, patch);
    if (!row) throw notFound('Medical image');
    await auditInTrx(db, scope, { action: 'DOCUMENT_UPDATED', resourceType: 'imaging_study', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(patch) } });
    return (await hydrate(db, [row]))[0];
  });
}

async function archive(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('imaging_studies').updateOne({ _id: id }, { status: 'Archived' });
    if (!row) throw notFound('Medical image');
    await auditInTrx(db, scope, { action: 'DOCUMENT_DELETED', resourceType: 'imaging_study', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { mode: 'archived' } });
    return true;
  });
}

module.exports = { list, getById, create, update, archive };
