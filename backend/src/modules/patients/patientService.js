'use strict';
const { withTenant, resolveClinicId, contains } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest, conflict } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const { auditInTrx } = require('../audit/auditRepository');
const documents = require('../documents/documentService');

const FIELDS = ['fullName', 'dateOfBirth', 'gender', 'phone', 'email', 'bloodGroup', 'maritalStatus', 'nationality', 'occupation', 'modeOfCare', 'city', 'pinCode', 'attenderEmail', 'attenderMobile', 'attenderWhatsapp', 'referringDoctor', 'referredClinic', 'handDominance', 'isUnder18', 'notes', 'status', 'address', 'emergencyContact', 'insurance', 'parentGuardian'];
const ALIASES = { bloodType: 'bloodGroup', insuranceInfo: 'insurance', mobile: 'phone', imageUrl: 'profileImageUrl' };
const IGNORED = new Set(['_id', 'id', 'clinicId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'deletedAt', 'version', 'passwordHash', 'password', 'userId', 'wallet', 'clinicCategoryHistory', 'checkInHistory', 'paymentCreditHistory', 'paymentDebitHistory', 'profileImage', 'governmentDocument', 'aadhaarNumber', 'uhid', 'assignedDoctors', 'vitals', 'medicalHistory', 'age', 'calculatedAge', 'fullAddress', 'profileImageUrl', 'profileDocumentId', 'governmentDocumentId', 'lastVisit', 'nextAppointment', 'attributes', 'clinic', '__v']);

function normalize(input) {
  const out = { ...input };
  for (const [from, to] of Object.entries(ALIASES)) if (out[from] !== undefined && out[to] === undefined) out[to] = out[from];
  if (typeof out.maritalStatus === 'boolean') out.maritalStatus = out.maritalStatus ? 'Married' : 'Single';
  if (out.gender) out.gender = String(out.gender).toLowerCase();
  if (out.dateOfBirth === '' || out.dateOfBirth === null) out.dateOfBirth = null;
  else if (out.dateOfBirth) out.dateOfBirth = new Date(out.dateOfBirth);
  for (const k of ['email', 'attenderEmail']) if (out[k] === '') out[k] = null; else if (out[k]) out[k] = String(out[k]).toLowerCase();
  if (out.address && typeof out.address === 'string') out.address = { street: out.address };
  if (out.isUnder18 === undefined && out.dateOfBirth) out.isUnder18 = (Date.now() - out.dateOfBirth.getTime()) / (365.25 * 86400000) < 18;
  return out;
}
function toDoc(input) {
  const n = normalize(input);
  const doc = {};
  for (const f of FIELDS) if (n[f] !== undefined) doc[f] = n[f];
  const attrs = {};
  for (const [k, v] of Object.entries(n)) if (!FIELDS.includes(k) && !IGNORED.has(k) && !ALIASES[k] && v !== undefined) attrs[k] = v;
  return { doc, attrs, identifiers: { uhid: n.uhid, aadhaar: n.aadhaarNumber } };
}
function age(dob) {
  if (!dob) return null;
  const b = new Date(dob), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}
function serializePatient(row, { clinic, identifiers = [], profileUrl, assignedDoctors = [] } = {}) {
  const s = serializeRow(row);
  const attrs = row.attributes || {};
  delete s.attributes;
  const ids = Object.fromEntries(identifiers.map((i) => [i.system, i.value]));
  return { ...attrs, ...s, gender: row.gender ? row.gender.charAt(0).toUpperCase() + row.gender.slice(1) : row.gender, age: age(row.dateOfBirth), bloodType: row.bloodGroup, insuranceInfo: row.insurance, uhid: ids.uhid || null, aadhaarNumber: ids.aadhaar || null, profileImage: profileUrl || row.profileImageUrl || null, imageUrl: profileUrl || row.profileImageUrl || null, clinicId: clinic ? ref(row.clinicId, { name: clinic.name, city: clinic.city, state: clinic.state }) : row.clinicId, assignedDoctors, lastVisit: row.lastVisitAt, nextAppointment: row.nextAppointmentAt, medicalHistory: { conditions: [], allergies: [], medications: [], surgeries: attrs.surgeries || [] } };
}
async function hydrate(db, rows) {
  if (!rows.length) return [];
  const clinics = await db.c('clinics').find({ _id: { $in: [...new Set(rows.map((r) => r.clinicId))] } }, { projection: { name: 1, city: 1, state: 1 } });
  const cmap = Object.fromEntries(clinics.map((c) => [c._id, c]));
  const ids = await db.c('patient_identifiers').find({ patientId: { $in: rows.map((r) => r._id) } });
  const imap = {};
  for (const i of ids) (imap[i.patientId] = imap[i.patientId] || []).push(i);
  const urls = await documents.urlsForIds(db, rows.map((r) => r.profileDocumentId));
  return rows.map((r) => serializePatient(r, { clinic: cmap[r.clinicId], identifiers: imap[r._id] || [], profileUrl: urls[r.profileDocumentId] }));
}
async function saveProfileImage(db, scope, patient, dataUrl, ctx) {
  const parsed = documents.parseDataUrl(dataUrl);
  if (!parsed) return null;
  const doc = await documents.storeDocument(db, scope, { buffer: parsed.buffer, fileName: `profile.${parsed.mime.split('/')[1] || 'jpg'}`, claimedMime: parsed.mime, clinicId: patient.clinicId, patientId: patient._id, category: 'profile', documentType: 'profile_photo', title: 'Profile photo', requestId: ctx.requestId, ip: ctx.ip });
  return doc._id;
}
async function upsertIdentifiers(db, patient, identifiers) {
  for (const [system, value] of Object.entries(identifiers)) {
    if (!value) continue;
    const v = String(value).trim().toUpperCase();
    const other = await db.c('patient_identifiers').findOne({ clinicId: patient.clinicId, system, value: v });
    if (other && other.patientId !== patient._id) throw conflict(`Another patient already has this ${system}`, 'DUPLICATE_IDENTIFIER');
    if (!other) await db.c('patient_identifiers').insertOne({ clinicId: patient.clinicId, patientId: patient._id, system, value: v });
  }
}
async function nextUhid(db, clinicId) {
  const seq = await db.nextSequence(`uhid:${clinicId}`);
  return `UH${String(clinicId).slice(0, 4).toUpperCase()}${String(seq).padStart(6, '0')}`;
}

async function list(scope, { search, clinicId, page, limit, offset, status }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (status) filter.status = status;
    if (search) filter.$or = [{ fullName: contains(search) }, { phone: contains(search) }, { email: contains(search) }];
    const col = db.c('patients');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { createdAt: -1 }, limit, skip: offset }), col.count(filter)]);
    return { data: await hydrate(db, rows), total, page, limit };
  });
}
async function getById(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('patients').findById(id);
    if (!row) throw notFound('Patient');
    await auditInTrx(db, scope, { action: 'PATIENT_VIEWED', resourceType: 'patient', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return (await hydrate(db, [row]))[0];
  });
}
/** IDOR guard used by other modules: the patient must exist within the caller's scope. */
async function assertPatient(db, scope, patientId) {
  const row = await db.c('patients').findById(patientId);
  if (!row) throw notFound('Patient');
  return row;
}
async function create(scope, input, ctx) {
  const { doc, attrs, identifiers } = toDoc(input);
  if (!doc.fullName) throw badRequest('fullName is required', 'VALIDATION_ERROR');
  const clinicId = resolveClinicId(scope, input.clinicId);
  if (!clinicId) throw badRequest('clinicId is required', 'CLINIC_REQUIRED');
  return withTenant(scope, async (db) => {
    if (!(await db.c('clinics').exists({ _id: clinicId }))) throw notFound('Clinic');
    const patient = await db.c('patients').insertOne({ ...doc, clinicId, status: doc.status || 'active', attributes: attrs, address: doc.address || {}, emergencyContact: doc.emergencyContact || {}, insurance: doc.insurance || {}, parentGuardian: doc.parentGuardian || {}, isUnder18: !!doc.isUnder18, profileImageUrl: typeof input.profileImage === 'string' && /^https?:\/\//.test(input.profileImage) ? input.profileImage : null, profileDocumentId: null, governmentDocumentId: null, lastVisitAt: null, nextAppointmentAt: null });
    await upsertIdentifiers(db, patient, { uhid: identifiers.uhid || (await nextUhid(db, clinicId)), aadhaar: identifiers.aadhaar });
    if (input.profileImage && /^data:/.test(input.profileImage)) {
      const docId = await saveProfileImage(db, scope, patient, input.profileImage, ctx);
      if (docId) { await db.c('patients').updateOne({ _id: patient._id }, { profileDocumentId: docId }); patient.profileDocumentId = docId; }
    }
    await auditInTrx(db, { ...scope, clinicId }, { action: 'PATIENT_CREATED', resourceType: 'patient', resourceId: patient._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'patient.created', aggregateType: 'patient', aggregateId: patient._id, clinicId, actorId: scope.userId, payload: { fullName: patient.fullName } });
    return (await hydrate(db, [patient]))[0];
  });
}
async function update(scope, id, input, ctx) {
  const { doc, attrs, identifiers } = toDoc(input);
  return withTenant(scope, async (db) => {
    const current = await db.c('patients').findById(id);
    if (!current) throw notFound('Patient');
    const patch = { ...doc };
    if (Object.keys(attrs).length) patch.attributes = { ...(current.attributes || {}), ...attrs };
    if (typeof input.profileImage === 'string' && /^https?:\/\//.test(input.profileImage)) patch.profileImageUrl = input.profileImage;
    if (input.profileImage && /^data:/.test(input.profileImage)) { const docId = await saveProfileImage(db, scope, current, input.profileImage, ctx); if (docId) patch.profileDocumentId = docId; }
    const updated = await db.c('patients').updateOne({ _id: id }, patch, { expectedVersion: input.version });
    if (!updated) throw conflict('The patient was modified by someone else. Reload and try again.', 'VERSION_CONFLICT');
    await upsertIdentifiers(db, updated, identifiers);
    await auditInTrx(db, scope, { action: 'PATIENT_UPDATED', resourceType: 'patient', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(doc) } });
    await enqueueEvent(db, { type: 'patient.updated', aggregateType: 'patient', aggregateId: id, clinicId: updated.clinicId, actorId: scope.userId, payload: { fields: Object.keys(doc) } });
    return (await hydrate(db, [updated]))[0];
  });
}
async function remove(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const current = await db.c('patients').findById(id);
    if (!current) throw notFound('Patient');
    await db.c('patients').softDelete({ _id: id });
    await auditInTrx(db, scope, { action: 'PATIENT_DELETED', resourceType: 'patient', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'patient.deleted', aggregateType: 'patient', aggregateId: id, clinicId: current.clinicId, actorId: scope.userId, payload: {} });
    return true;
  });
}
/** Light-weight lookups used by other modules for "populated" references. */
async function refsFor(db, ids) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return {};
  const rows = await db.c('patients').find({ _id: { $in: clean } }, { projection: { fullName: 1, phone: 1, email: 1, gender: 1, dateOfBirth: 1, attenderMobile: 1, profileDocumentId: 1, profileImageUrl: 1, bloodGroup: 1, address: 1 } });
  const ids2 = await db.c('patient_identifiers').find({ patientId: { $in: clean }, system: 'uhid' });
  const uhid = Object.fromEntries(ids2.map((i) => [i.patientId, i.value]));
  const urls = await documents.urlsForIds(db, rows.map((r) => r.profileDocumentId));
  const out = {};
  for (const r of rows) out[r._id] = ref(r._id, { fullName: r.fullName, phone: r.phone, email: r.email, gender: r.gender, age: age(r.dateOfBirth), dateOfBirth: r.dateOfBirth, attenderMobile: r.attenderMobile, uhid: uhid[r._id] || null, profileImage: urls[r.profileDocumentId] || r.profileImageUrl || null, bloodType: r.bloodGroup, address: r.address });
  return out;
}
async function search(db, term, limit) {
  const rows = await db.c('patients').find({ $or: [{ fullName: contains(term) }, { email: contains(term) }, { phone: contains(term) }] }, { sort: { createdAt: -1 }, limit });
  const byId = await db.c('patient_identifiers').find({ value: contains(term) }, { limit });
  const extra = byId.length ? await db.c('patients').find({ _id: { $in: byId.map((i) => i.patientId) } }, { limit }) : [];
  const seen = new Set();
  const all = [...rows, ...extra].filter((r) => (seen.has(r._id) ? false : seen.add(r._id))).slice(0, limit);
  return (await hydrate(db, all)).map((p) => ({ ...p, firstName: p.fullName.split(' ')[0], lastName: p.fullName.split(' ').slice(1).join(' '), patientId: p._id }));
}

module.exports = { list, getById, create, update, remove, assertPatient, refsFor, serializePatient, age, search };
