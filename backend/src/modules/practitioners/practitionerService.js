'use strict';
const { withTenant, resolveClinicId, contains } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const documents = require('../documents/documentService');
const consultantLogin = require('./consultantLogin');   // 2026-10-08 RBAC: optional consultant-app sign-in
const { hasPermission } = require('../../common/security/rbac');
const { forbidden } = require('../../common/errors/AppError');

const FIELDS = ['fullName', 'email', 'phone', 'specialty', 'qualification', 'licenseNumber', 'department', 'shift', 'experienceYears', 'about', 'uhid', 'isActive', 'languages', 'currentAddress', 'permanentAddress'];
const ALIASES = { specialization: 'specialty', experience: 'experienceYears', name: 'fullName' };
const IGNORED = new Set(['_id', 'id', 'clinicId', 'kind', 'role', 'passwordHash', 'password', 'profileImage', 'createdAt', 'updatedAt', 'version', 'clinic', '__v', 'attributes', 'consultantLogin', 'consultantAccount']);

function toDoc(input) {
  const n = { ...input };
  for (const [a, b] of Object.entries(ALIASES)) if (n[a] !== undefined && n[b] === undefined) n[b] = n[a];
  if (n.email === '') n.email = null; else if (n.email) n.email = String(n.email).toLowerCase();
  const doc = {};
  for (const f of FIELDS) if (n[f] !== undefined) doc[f] = n[f];
  if (doc.languages !== undefined) doc.languages = Array.isArray(doc.languages) ? doc.languages : [];
  const attrs = {};
  for (const [k, v] of Object.entries(n)) if (!FIELDS.includes(k) && !IGNORED.has(k) && !ALIASES[k] && v !== undefined) attrs[k] = v;
  return { doc, attrs };
}
function serialize(r, { clinic, profileUrl } = {}) {
  const s = serializeRow(r);
  const attrs = r.attributes || {};
  delete s.attributes;
  return {
    ...attrs,
    ...s,
    role: r.kind,
    specialization: r.specialty,
    experience: r.experienceYears,
    profileImage: profileUrl || r.profileImageUrl || r.profileImage || null,
    clinicName: clinic ? clinic.name : undefined,
    clinicId: clinic ? ref(r.clinicId, { name: clinic.name, address: clinic.address, phone: clinic.phone }) : r.clinicId,
    clinic: clinic ? ref(r.clinicId, { name: clinic.name }) : undefined
  };
}
async function hydrate(db, rows) {
  if (!rows.length) return [];
  const { ObjectId } = require('mongodb');
  const cleanClinicIds = [...new Set(rows.map((r) => r.clinicId).filter(Boolean))];
  const queryIds = cleanClinicIds.flatMap((id) => (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id) ? [id, new ObjectId(id)] : [id]));
  const clinics = queryIds.length ? await db.c('clinics').find({ _id: { $in: queryIds } }, { projection: { name: 1, address: 1, phone: 1 } }) : [];
  const cmap = {};
  for (const c of clinics) {
    cmap[c._id] = c;
    cmap[String(c._id)] = c;
  }
  const urls = await documents.urlsForIds(db, rows.map((r) => r.profileDocumentId));
  return rows.map((r) => serialize(r, { clinic: cmap[r.clinicId] || cmap[String(r.clinicId)], profileUrl: urls[r.profileDocumentId] }));
}
async function list(scope, kind, { search, specialty, isActive, clinicId, page, limit, offset }) {
  return withTenant(scope, async (db) => {
    const filter = { kind };
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (isActive !== undefined) filter.isActive = isActive;
    if (specialty) filter.specialty = contains(specialty);
    if (search) filter.$or = [{ fullName: contains(search) }, { email: contains(search) }, { specialty: contains(search) }];
    const col = db.c('practitioners');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { createdAt: -1 }, limit, skip: offset }), col.count(filter)]);
    return { data: await hydrate(db, rows), total, page, limit };
  });
}
async function getById(scope, kind, id) {
  return withTenant(scope, async (db) => { const row = await db.c('practitioners').findOne({ _id: id, kind }); if (!row) throw notFound(kind === 'doctor' ? 'Doctor' : 'Nurse'); return (await hydrate(db, [row]))[0]; });
}
async function saveProfile(db, scope, row, dataUrl, ctx) {
  const parsed = documents.parseDataUrl(dataUrl);
  if (!parsed) return null;
  const doc = await documents.storeDocument(db, scope, { buffer: parsed.buffer, fileName: `profile.${parsed.mime.split('/')[1] || 'jpg'}`, claimedMime: parsed.mime, clinicId: row.clinicId, category: 'profile', documentType: 'practitioner_profile_photo', title: 'Profile photo', requestId: ctx.requestId, ip: ctx.ip });
  return doc._id;
}
function loginAllowed(scope, login) {
  if (login && !hasPermission(scope.role, 'users:manage')) throw forbidden('Creating a sign-in needs users:manage', 'PERMISSION_DENIED');
}
async function create(scope, kind, rawInput, ctx) {
  const { login, input } = consultantLogin.takeLogin(rawInput);   // never reaches toDoc / attributes
  loginAllowed(scope, login);
  const { doc, attrs } = toDoc(input);
  if (!doc.fullName) throw badRequest('fullName is required', 'VALIDATION_ERROR');
  const clinicId = resolveClinicId(scope, input.clinicId);
  if (!clinicId) throw badRequest('clinicId is required', 'CLINIC_REQUIRED');
  return withTenant(scope, async (db) => {
    if (!(await db.c('clinics').exists({ _id: clinicId }))) throw notFound('Clinic');
    const created = await db.c('practitioners').insertOne({ ...doc, kind, clinicId, isActive: doc.isActive !== false, languages: doc.languages || [], attributes: attrs, profileImageUrl: typeof input.profileImage === 'string' && /^https?:\/\//.test(input.profileImage) ? input.profileImage : null, profileDocumentId: null });
    if (input.profileImage && /^data:/.test(input.profileImage)) { const docId = await saveProfile(db, scope, created, input.profileImage, ctx); if (docId) { await db.c('practitioners').updateOne({ _id: created._id }, { profileDocumentId: docId }); created.profileDocumentId = docId; } }
    const link = await consultantLogin.provision(db, created, login, { creating: true });
    if (link) { await db.c('practitioners').updateOne({ _id: created._id }, { consultantAccount: link }); created.consultantAccount = link; }
    await auditInTrx(db, { ...scope, clinicId }, { action: 'PRACTITIONER_CREATED', resourceType: 'practitioner', resourceId: created._id, requestId: ctx.requestId, ip: ctx.ip, details: { kind, ...(link ? { consultantLogin: { role: link.role, collection: link.collection } } : {}) } });
    await enqueueEvent(db, { type: 'practitioner.created', aggregateType: 'practitioner', aggregateId: created._id, clinicId, actorId: scope.userId, payload: { kind } });
    return (await hydrate(db, [created]))[0];
  });
}
async function update(scope, kind, id, rawInput, ctx) {
  const { login, input } = consultantLogin.takeLogin(rawInput);
  loginAllowed(scope, login);
  const { doc, attrs } = toDoc(input);
  return withTenant(scope, async (db) => {
    const current = await db.c('practitioners').findOne({ _id: id, kind });
    if (!current) throw notFound(kind === 'doctor' ? 'Doctor' : 'Nurse');
    const patch = { ...doc };
    if (Object.keys(attrs).length) patch.attributes = { ...(current.attributes || {}), ...attrs };
    if (typeof input.profileImage === 'string' && /^https?:\/\//.test(input.profileImage)) patch.profileImageUrl = input.profileImage;
    if (input.profileImage && /^data:/.test(input.profileImage)) { const docId = await saveProfile(db, scope, current, input.profileImage, ctx); if (docId) patch.profileDocumentId = docId; }
    let updated = await db.c('practitioners').updateOne({ _id: id }, patch);
    if (login) {
      const link = await consultantLogin.provision(db, updated, login, { creating: false });
      if (link && (!updated.consultantAccount || updated.consultantAccount.role !== link.role)) updated = await db.c('practitioners').updateOne({ _id: id }, { consultantAccount: link });
    } else {
      await consultantLogin.syncLinked(db, updated);
    }
    await auditInTrx(db, scope, { action: 'PRACTITIONER_UPDATED', resourceType: 'practitioner', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(doc), ...(login ? { consultantLogin: { role: login.role || null, passwordChanged: login.password !== undefined } } : {}) } });
    return (await hydrate(db, [updated]))[0];
  });
}
async function setActive(scope, kind, id, isActive, ctx) {
  return withTenant(scope, async (db) => {
    const updated = await db.c('practitioners').updateOne({ _id: id, kind }, { isActive });
    if (!updated) throw notFound(kind === 'doctor' ? 'Doctor' : 'Nurse');
    await consultantLogin.syncLinked(db, updated);   // deactivated here = locked out of the consultant app too
    await auditInTrx(db, scope, { action: isActive ? 'PRACTITIONER_ACTIVATED' : 'PRACTITIONER_DEACTIVATED', resourceType: 'practitioner', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return (await hydrate(db, [updated]))[0];
  });
}
async function stats(scope, kind) {
  return withTenant(scope, async (db) => {
    const col = db.c('practitioners');
    const [total, active, bySpecialty] = await Promise.all([col.count({ kind }), col.count({ kind, isActive: true }), col.aggregate([{ $match: { kind } }, { $group: { _id: '$specialty', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }])]);
    return { total, active, inactive: total - active, bySpecialty };
  });
}
async function refsFor(db, ids) {
  const { ObjectId } = require('mongodb');
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return {};
  const queryIds = clean.flatMap((id) => {
    const s = String(id);
    return (/^[0-9a-fA-F]{24}$/.test(s) ? [s, new ObjectId(s)] : [id]);
  });
  const rows = await db.c('practitioners').find({ _id: { $in: queryIds } }, { projection: { fullName: 1, specialty: 1, phone: 1, email: 1, kind: 1, department: 1 } });
  const out = {};
  for (const r of rows) {
    const val = ref(r._id, { fullName: r.fullName, name: r.fullName, specialty: r.specialty, specialization: r.specialty, phone: r.phone, email: r.email, role: r.kind, department: r.department });
    out[r._id] = val;
    out[String(r._id)] = val;
  }
  return out;
}
async function assertPractitioner(db, scope, id, kind) {
  if (!id) return null;
  const row = await db.c('practitioners').findById(id);
  if (!row || (kind && row.kind !== kind)) throw notFound('Practitioner');
  return row;
}
async function search(db, term, limit) {
  const rows = await db.c('practitioners').find({ kind: 'doctor', $or: [{ fullName: contains(term) }, { email: contains(term) }, { specialty: contains(term) }, { phone: contains(term) }] }, { limit });
  return (await hydrate(db, rows)).map((d) => ({ ...d, firstName: d.fullName.split(' ')[0], lastName: d.fullName.split(' ').slice(1).join(' ') }));
}
module.exports = { list, getById, create, update, setActive, stats, refsFor, assertPractitioner, serialize, search };
