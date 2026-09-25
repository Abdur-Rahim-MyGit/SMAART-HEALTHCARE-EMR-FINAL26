'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref, pickForDb } = require('../../common/utils/serialize');
const { likePattern } = require('../../common/validation/schemas');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const { auditInTrx } = require('../audit/auditRepository');
const documents = require('../documents/documentService');

const repo = new BaseRepository('patients');

const COLUMN_FIELDS = ['fullName', 'dateOfBirth', 'gender', 'phone', 'email', 'bloodGroup', 'maritalStatus', 'nationality', 'occupation', 'modeOfCare', 'city', 'pinCode', 'attenderEmail', 'attenderMobile', 'attenderWhatsapp', 'referringDoctor', 'referredClinic', 'handDominance', 'isUnder18', 'notes', 'status'];
const JSON_FIELDS = ['address', 'emergencyContact', 'insurance', 'parentGuardian'];
const ALIASES = { bloodType: 'bloodGroup', insuranceInfo: 'insurance', mobile: 'phone', imageUrl: 'profileImageUrl' };
const IGNORED = new Set(['_id', 'id', 'clinicId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'deletedAt', 'version', 'passwordHash', 'password', 'userId', 'wallet', 'clinicCategoryHistory', 'checkInHistory', 'paymentCreditHistory', 'paymentDebitHistory', 'profileImage', 'governmentDocument', 'aadhaarNumber', 'uhid', 'assignedDoctors', 'vitals', 'medicalHistory', 'age', 'calculatedAge', 'fullAddress', 'profileImageUrl', 'profileDocumentId', 'governmentDocumentId', 'lastVisit', 'nextAppointment', 'attributes', 'clinic', '__v']);

function normalize(input) {
  const out = { ...input };
  for (const [from, to] of Object.entries(ALIASES)) if (out[from] !== undefined && out[to] === undefined) out[to] = out[from];
  if (typeof out.maritalStatus === 'boolean') out.maritalStatus = out.maritalStatus ? 'Married' : 'Single';
  if (out.gender) out.gender = String(out.gender).toLowerCase();
  if (out.dateOfBirth === '') out.dateOfBirth = null;
  if (out.email === '') out.email = null;
  if (out.attenderEmail === '') out.attenderEmail = null;
  if (out.address && typeof out.address === 'string') out.address = { street: out.address };
  if (out.isUnder18 === undefined && out.dateOfBirth) out.isUnder18 = (Date.now() - new Date(out.dateOfBirth).getTime()) / (365.25 * 86400000) < 18;
  return out;
}

function toRow(input) {
  const n = normalize(input);
  const row = pickForDb(n, COLUMN_FIELDS);
  for (const f of JSON_FIELDS) if (n[f] !== undefined) row[f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = JSON.stringify(n[f] || {});
  if (n.email) row.email = String(n.email).toLowerCase();
  if (row.is_under18 !== undefined) { row.is_under_18 = row.is_under18; delete row.is_under18; }
  // Anything the UI sends that has no column is kept as flexible attributes, never silently dropped.
  const attrs = {};
  for (const [k, v] of Object.entries(n)) {
    if (COLUMN_FIELDS.includes(k) || JSON_FIELDS.includes(k) || IGNORED.has(k) || Object.keys(ALIASES).includes(k)) continue;
    if (v !== undefined) attrs[k] = v;
  }
  return { row, attrs, identifiers: { uhid: n.uhid, aadhaar: n.aadhaarNumber } };
}

function age(dob) {
  if (!dob) return null;
  const b = new Date(dob);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

function serializePatient(row, { clinic, identifiers = [], profileUrl, assignedDoctors = [] } = {}) {
  const s = serializeRow(row);
  const attrs = row.attributes || {};
  delete s.attributes;
  const ids = Object.fromEntries(identifiers.map((i) => [i.system, i.value]));
  const gender = row.gender ? row.gender.charAt(0).toUpperCase() + row.gender.slice(1) : row.gender;
  return {
    ...attrs,
    ...s,
    gender,
    age: age(row.date_of_birth),
    bloodType: row.blood_group,
    insuranceInfo: row.insurance,
    uhid: ids.uhid || null,
    aadhaarNumber: ids.aadhaar || null,
    profileImage: profileUrl || row.profile_image_url || null,
    imageUrl: profileUrl || row.profile_image_url || null,
    clinicId: clinic ? ref(row.clinic_id, { name: clinic.name, city: clinic.city, state: clinic.state }) : row.clinic_id,
    assignedDoctors,
    lastVisit: row.last_visit_at,
    nextAppointment: row.next_appointment_at,
    medicalHistory: { conditions: [], allergies: [], medications: [], surgeries: attrs.surgeries || [] },
  };
}

async function hydrate(trx, rows) {
  if (!rows.length) return [];
  const clinicIds = [...new Set(rows.map((r) => r.clinic_id))];
  const clinics = await trx('clinics').whereIn('id', clinicIds).select('id', 'name', 'city', 'state');
  const cmap = Object.fromEntries(clinics.map((c) => [c.id, c]));
  const ids = await trx('patient_identifiers').whereIn('patient_id', rows.map((r) => r.id));
  const imap = {};
  for (const i of ids) (imap[i.patient_id] = imap[i.patient_id] || []).push(i);
  const urls = await documents.urlsForIds(trx, rows.map((r) => r.profile_document_id));
  return rows.map((r) => serializePatient(r, { clinic: cmap[r.clinic_id], identifiers: imap[r.id] || [], profileUrl: urls[r.profile_document_id] }));
}

async function saveProfileImage(trx, scope, patientRow, dataUrl, ctx) {
  const parsed = documents.parseDataUrl(dataUrl);
  if (!parsed) return null; // plain URL (legacy) is kept in profile_image_url by caller
  const doc = await documents.storeDocument(trx, scope, { buffer: parsed.buffer, fileName: `profile.${parsed.mime.split('/')[1] || 'jpg'}`, claimedMime: parsed.mime, clinicId: patientRow.clinic_id, patientId: patientRow.id, category: 'profile', documentType: 'profile_photo', title: 'Profile photo', requestId: ctx.requestId, ip: ctx.ip });
  return doc.id;
}

async function upsertIdentifiers(trx, patient, identifiers) {
  for (const [system, value] of Object.entries(identifiers)) {
    if (!value) continue;
    await trx('patient_identifiers').insert({ clinic_id: patient.clinic_id, patient_id: patient.id, system, value: String(value).trim().toUpperCase() }).onConflict(['clinic_id', 'system', 'value']).merge({ patient_id: patient.id });
  }
}

async function nextUhid(trx, clinicId) {
  const [{ c }] = await trx('patient_identifiers').where({ clinic_id: clinicId, system: 'uhid' }).count({ c: '*' });
  const seq = String(Number(c) + 1).padStart(6, '0');
  return `UH${clinicId.slice(0, 4).toUpperCase()}${seq}`;
}

async function list(scope, { search, clinicId, page, limit, offset, status }) {
  return withTenant(scope, async (trx) => {
    let q = repo.scoped(trx, scope);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('clinic_id', clinicId);
    if (status) q = q.where('status', status);
    if (search) q = q.where((b) => b.whereILike('full_name', likePattern(search)).orWhereILike('phone', likePattern(search)).orWhereILike('email', likePattern(search)));
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('created_at', 'desc').limit(limit).offset(offset);
    return { data: await hydrate(trx, rows), total, page, limit };
  }, getKnex());
}

async function getById(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Patient');
    await auditInTrx(trx, scope, { action: 'PATIENT_VIEWED', resourceType: 'patient', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [p] = await hydrate(trx, [row]);
    return p;
  }, getKnex());
}

/** Internal: verify a patient belongs to the scope's clinic (IDOR guard used by other modules). */
async function assertPatient(trx, scope, patientId) {
  const row = await repo.findById(trx, scope, patientId);
  if (!row) throw notFound('Patient');
  return row;
}

async function create(scope, input, ctx) {
  const { row, attrs, identifiers } = toRow(input);
  if (!row.full_name) throw badRequest('fullName is required', 'VALIDATION_ERROR');
  const clinicId = repo.resolveClinicId(scope, input.clinicId);
  if (!clinicId) throw badRequest('clinicId is required', 'CLINIC_REQUIRED');
  return withTenant({ ...scope, clinicId: scope.role === ROLES.SUPER_MASTER_ADMIN ? null : scope.clinicId }, async (trx) => {
    const clinic = await trx('clinics').where({ id: clinicId }).whereNull('deleted_at').first('id');
    if (!clinic) throw notFound('Clinic');
    const [patient] = await trx('patients').insert({ ...row, clinic_id: clinicId, attributes: JSON.stringify(attrs), profile_image_url: typeof input.profileImage === 'string' && /^https?:\/\//.test(input.profileImage) ? input.profileImage : null, created_by: scope.userId, updated_by: scope.userId }).returning('*');
    await upsertIdentifiers(trx, patient, { uhid: identifiers.uhid || (await nextUhid(trx, clinicId)), aadhaar: identifiers.aadhaar });
    if (input.profileImage && /^data:/.test(input.profileImage)) {
      const docId = await saveProfileImage(trx, scope, patient, input.profileImage, ctx);
      if (docId) await trx('patients').where({ id: patient.id }).update({ profile_document_id: docId });
      patient.profile_document_id = docId;
    }
    await auditInTrx(trx, { ...scope, clinicId }, { action: 'PATIENT_CREATED', resourceType: 'patient', resourceId: patient.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'patient.created', aggregateType: 'patient', aggregateId: patient.id, clinicId, actorId: scope.userId, payload: { fullName: patient.full_name } });
    const [p] = await hydrate(trx, [patient]);
    return p;
  }, getKnex());
}

async function update(scope, id, input, ctx) {
  const { row, attrs, identifiers } = toRow(input);
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Patient');
    const patch = { ...row, updated_by: scope.userId };
    if (Object.keys(attrs).length) patch.attributes = JSON.stringify({ ...(current.attributes || {}), ...attrs });
    if (typeof input.profileImage === 'string' && /^https?:\/\//.test(input.profileImage)) patch.profile_image_url = input.profileImage;
    if (input.profileImage && /^data:/.test(input.profileImage)) {
      const docId = await saveProfileImage(trx, scope, current, input.profileImage, ctx);
      if (docId) patch.profile_document_id = docId;
    }
    const updated = await repo.update(trx, scope, id, patch, { expectedVersion: input.version });
    if (!updated) throw badRequest('The patient was modified by someone else. Reload and try again.', 'VERSION_CONFLICT');
    await upsertIdentifiers(trx, updated, identifiers);
    await auditInTrx(trx, scope, { action: 'PATIENT_UPDATED', resourceType: 'patient', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(row) } });
    await enqueueEvent(trx, { type: 'patient.updated', aggregateType: 'patient', aggregateId: id, clinicId: updated.clinic_id, actorId: scope.userId, payload: { fields: Object.keys(row) } });
    const [p] = await hydrate(trx, [updated]);
    return p;
  }, getKnex());
}

async function remove(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Patient');
    await repo.remove(trx, scope, id);
    await auditInTrx(trx, scope, { action: 'PATIENT_DELETED', resourceType: 'patient', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'patient.deleted', aggregateType: 'patient', aggregateId: id, clinicId: current.clinic_id, actorId: scope.userId, payload: {} });
    return true;
  }, getKnex());
}

/** Light-weight lookups used by other modules for "populated" references. */
async function refsFor(trx, ids) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return {};
  const rows = await trx('patients').whereIn('id', clean).select('id', 'full_name', 'phone', 'email', 'gender', 'date_of_birth', 'attender_mobile', 'profile_document_id', 'profile_image_url', 'blood_group', 'address');
  const ids2 = await trx('patient_identifiers').whereIn('patient_id', clean).where('system', 'uhid');
  const uhid = Object.fromEntries(ids2.map((i) => [i.patient_id, i.value]));
  const urls = await documents.urlsForIds(trx, rows.map((r) => r.profile_document_id));
  const out = {};
  for (const r of rows) out[r.id] = ref(r.id, { fullName: r.full_name, phone: r.phone, email: r.email, gender: r.gender, age: age(r.date_of_birth), dateOfBirth: r.date_of_birth, attenderMobile: r.attender_mobile, uhid: uhid[r.id] || null, profileImage: urls[r.profile_document_id] || r.profile_image_url || null, bloodType: r.blood_group, address: r.address });
  return out;
}

module.exports = { list, getById, create, update, remove, assertPatient, refsFor, serializePatient, repo, age };
