'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');
const encounters = require('../encounters/encounterService');
const documents = require('../documents/documentService');

const repo = new BaseRepository('imaging_studies');

function serialize(r, { patient, doctor, doc, url } = {}) {
  const s = serializeRow(r);
  return {
    ...s,
    imageType: r.modality,
    imageUrl: url || null,
    cloudinaryUrl: url || null,
    imageTakenDate: r.study_date,
    fileName: doc ? doc.original_file_name : null,
    fileSize: doc ? Number(doc.size_bytes) : null,
    mimeType: doc ? doc.mime_type : null,
    documentId: r.document_id,
    patientId: patient || ref(r.patient_id),
    uploadedBy: doctor || (r.uploaded_by ? ref(r.uploaded_by) : null),
  };
}

async function hydrate(trx, rows) {
  if (!rows.length) return [];
  const [pmap, dmap] = await Promise.all([patients.refsFor(trx, rows.map((r) => r.patient_id)), practitioners.refsFor(trx, rows.map((r) => r.uploaded_by))]);
  const docs = await trx('documents').whereIn('id', rows.map((r) => r.document_id).filter(Boolean)).whereNull('deleted_at');
  const docMap = Object.fromEntries(docs.map((d) => [d.id, d]));
  const out = [];
  for (const r of rows) {
    const doc = docMap[r.document_id];
    const a = doc ? await documents.accessUrlFor(doc) : null;
    out.push(serialize(r, { patient: pmap[r.patient_id], doctor: dmap[r.uploaded_by], doc, url: a && a.url }));
  }
  return out;
}

async function list(scope, { patientId, imageType, bodyPart, status = 'Active', clinicId, page = 1, limit = 50, offset = 0 }) {
  return withTenant(scope, async (trx) => {
    let q = repo.scoped(trx, scope);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('clinic_id', clinicId);
    if (patientId) q = q.where('patient_id', patientId);
    if (imageType) q = q.where('modality', imageType);
    if (bodyPart) q = q.where('body_part', bodyPart);
    if (status) q = q.where('status', status);
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('study_date', 'desc').limit(limit).offset(offset);
    return { data: await hydrate(trx, rows), total, page, limit };
  }, getKnex());
}

async function getById(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Medical image');
    await auditInTrx(trx, scope, { action: 'DOCUMENT_VIEWED', resourceType: 'imaging_study', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [i] = await hydrate(trx, [row]);
    return i;
  }, getKnex());
}

async function create(scope, input, file, ctx) {
  if (!input.patientId) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (trx) => {
    const patient = await patients.assertPatient(trx, scope, input.patientId);
    if (input.encounterId) await encounters.assertEncounter(trx, scope, input.encounterId);
    if (input.uploadedBy) await practitioners.assertPractitioner(trx, scope, input.uploadedBy);
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
      const doc = await documents.storeDocument(trx, scope, { buffer, fileName, claimedMime, clinicId: patient.clinic_id, patientId: patient.id, encounterId: input.encounterId, category: 'imaging', documentType: input.imageType || 'imaging', title: input.title, description: input.description, tags: input.tags, requestId: ctx.requestId, ip: ctx.ip });
      documentId = doc.id;
    } else if (documentId) {
      const doc = await trx('documents').where({ id: documentId, clinic_id: patient.clinic_id }).whereNull('deleted_at').first('id');
      if (!doc) throw notFound('Document');
    } else if (input.imageUrl && /^https?:\/\//.test(input.imageUrl)) {
      // Legacy external URL: recorded as a legacy_url document so access still goes through the document service.
      const [doc] = await trx('documents').insert({ clinic_id: patient.clinic_id, patient_id: patient.id, uploaded_by_user_id: scope.userId, document_type: input.imageType || 'imaging', category: 'imaging', title: input.title, original_file_name: input.fileName || 'external', mime_type: input.mimeType || 'application/octet-stream', size_bytes: input.fileSize || 0, storage_provider: 'legacy_url', storage_key: input.imageUrl, legacy_url: input.imageUrl, status: 'available', created_by: scope.userId }).returning('id');
      documentId = doc.id;
    } else {
      throw badRequest('An image file is required', 'FILE_REQUIRED');
    }
    const [row] = await trx('imaging_studies').insert({ clinic_id: patient.clinic_id, patient_id: patient.id, encounter_id: input.encounterId || null, document_id: documentId, modality: input.imageType || 'Other', body_part: input.bodyPart || null, title: input.title || input.imageType || 'Medical image', description: input.description || null, associated_diagnosis: input.associatedDiagnosis || null, study_date: input.imageTakenDate ? new Date(input.imageTakenDate) : new Date(), status: 'Active', is_private: input.isPrivate !== false, tags: JSON.stringify(input.tags || []), uploaded_by: input.uploadedBy || null, uploaded_by_user_id: scope.userId, created_by: scope.userId, updated_by: scope.userId }).returning('*');
    await auditInTrx(trx, { ...scope, clinicId: patient.clinic_id }, { action: 'IMAGING_STUDY_CREATED', resourceType: 'imaging_study', resourceId: row.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'imaging.study.created', aggregateType: 'imaging_study', aggregateId: row.id, clinicId: patient.clinic_id, actorId: scope.userId, payload: { patientId: patient.id } });
    const [i] = await hydrate(trx, [row]);
    return i;
  }, getKnex());
}

async function update(scope, id, input, ctx) {
  return withTenant(scope, async (trx) => {
    const patch = {};
    for (const [k, c] of Object.entries({ title: 'title', description: 'description', imageType: 'modality', bodyPart: 'body_part', associatedDiagnosis: 'associated_diagnosis', isPrivate: 'is_private', status: 'status' })) if (input[k] !== undefined) patch[c] = input[k];
    if (input.tags !== undefined) patch.tags = JSON.stringify(input.tags || []);
    const row = await repo.update(trx, scope, id, patch);
    if (!row) throw notFound('Medical image');
    await auditInTrx(trx, scope, { action: 'DOCUMENT_UPDATED', resourceType: 'imaging_study', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [i] = await hydrate(trx, [row]);
    return i;
  }, getKnex());
}

async function archive(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await repo.update(trx, scope, id, { status: 'Archived' });
    if (!row) throw notFound('Medical image');
    await auditInTrx(trx, scope, { action: 'DOCUMENT_DELETED', resourceType: 'imaging_study', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { mode: 'archived' } });
    return true;
  }, getKnex());
}

module.exports = { list, getById, create, update, archive, repo };
