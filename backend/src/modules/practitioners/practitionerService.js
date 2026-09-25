'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref, pickForDb } = require('../../common/utils/serialize');
const { likePattern } = require('../../common/validation/schemas');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const documents = require('../documents/documentService');

const repo = new BaseRepository('practitioners');
const FIELDS = ['fullName', 'email', 'phone', 'specialty', 'qualification', 'licenseNumber', 'department', 'shift', 'experienceYears', 'about', 'uhid', 'isActive'];
const JSON_FIELDS = ['languages', 'currentAddress', 'permanentAddress'];
const ALIASES = { specialization: 'specialty', experience: 'experienceYears', name: 'fullName' };
const IGNORED = new Set(['_id', 'id', 'clinicId', 'kind', 'role', 'passwordHash', 'password', 'profileImage', 'createdAt', 'updatedAt', 'version', 'isActive', 'clinic', '__v', 'attributes']);

function toRow(input) {
  const n = { ...input };
  for (const [a, b] of Object.entries(ALIASES)) if (n[a] !== undefined && n[b] === undefined) n[b] = n[a];
  if (n.email) n.email = String(n.email).toLowerCase();
  if (n.email === '') n.email = null;
  const row = pickForDb(n, FIELDS);
  for (const f of JSON_FIELDS) if (n[f] !== undefined) row[f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = JSON.stringify(n[f] ?? (f === 'languages' ? [] : {}));
  const attrs = {};
  for (const [k, v] of Object.entries(n)) if (!FIELDS.includes(k) && !JSON_FIELDS.includes(k) && !IGNORED.has(k) && !ALIASES[k] && v !== undefined) attrs[k] = v;
  return { row, attrs };
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
    experience: r.experience_years,
    profileImage: profileUrl || r.profile_image_url || null,
    clinicId: clinic ? ref(r.clinic_id, { name: clinic.name, address: clinic.address, phone: clinic.phone }) : r.clinic_id,
    clinic: clinic ? ref(r.clinic_id, { name: clinic.name }) : undefined,
  };
}

async function hydrate(trx, rows) {
  if (!rows.length) return [];
  const clinics = await trx('clinics').whereIn('id', [...new Set(rows.map((r) => r.clinic_id))]).select('id', 'name', 'address', 'phone');
  const cmap = Object.fromEntries(clinics.map((c) => [c.id, c]));
  const urls = await documents.urlsForIds(trx, rows.map((r) => r.profile_document_id));
  return rows.map((r) => serialize(r, { clinic: cmap[r.clinic_id], profileUrl: urls[r.profile_document_id] }));
}

async function list(scope, kind, { search, specialty, isActive, clinicId, page, limit, offset }) {
  return withTenant(scope, async (trx) => {
    let q = repo.scoped(trx, scope).where('kind', kind);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('clinic_id', clinicId);
    if (isActive !== undefined) q = q.where('is_active', isActive);
    if (specialty) q = q.whereILike('specialty', likePattern(specialty));
    if (search) q = q.where((b) => b.whereILike('full_name', likePattern(search)).orWhereILike('email', likePattern(search)).orWhereILike('specialty', likePattern(search)));
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('created_at', 'desc').limit(limit).offset(offset);
    return { data: await hydrate(trx, rows), total, page, limit };
  }, getKnex());
}

async function getById(scope, kind, id) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row || row.kind !== kind) throw notFound(kind === 'doctor' ? 'Doctor' : 'Nurse');
    const [p] = await hydrate(trx, [row]);
    return p;
  }, getKnex());
}

async function saveProfile(trx, scope, row, dataUrl, ctx) {
  const parsed = documents.parseDataUrl(dataUrl);
  if (!parsed) return null;
  const doc = await documents.storeDocument(trx, scope, { buffer: parsed.buffer, fileName: `profile.${parsed.mime.split('/')[1] || 'jpg'}`, claimedMime: parsed.mime, clinicId: row.clinic_id, category: 'profile', documentType: 'practitioner_profile_photo', title: 'Profile photo', requestId: ctx.requestId, ip: ctx.ip });
  return doc.id;
}

async function create(scope, kind, input, ctx) {
  const { row, attrs } = toRow(input);
  if (!row.full_name) throw badRequest('fullName is required', 'VALIDATION_ERROR');
  const clinicId = repo.resolveClinicId(scope, input.clinicId);
  if (!clinicId) throw badRequest('clinicId is required', 'CLINIC_REQUIRED');
  return withTenant(scope, async (trx) => {
    const clinic = await trx('clinics').where({ id: clinicId }).whereNull('deleted_at').first('id');
    if (!clinic) throw notFound('Clinic');
    const [created] = await trx('practitioners').insert({ ...row, kind, clinic_id: clinicId, attributes: JSON.stringify(attrs), profile_image_url: typeof input.profileImage === 'string' && /^https?:\/\//.test(input.profileImage) ? input.profileImage : null, created_by: scope.userId, updated_by: scope.userId }).returning('*');
    if (input.profileImage && /^data:/.test(input.profileImage)) {
      const docId = await saveProfile(trx, scope, created, input.profileImage, ctx);
      if (docId) await trx('practitioners').where({ id: created.id }).update({ profile_document_id: docId });
      created.profile_document_id = docId;
    }
    await auditInTrx(trx, { ...scope, clinicId }, { action: 'PRACTITIONER_CREATED', resourceType: 'practitioner', resourceId: created.id, requestId: ctx.requestId, ip: ctx.ip, details: { kind } });
    await enqueueEvent(trx, { type: 'practitioner.created', aggregateType: 'practitioner', aggregateId: created.id, clinicId, actorId: scope.userId, payload: { kind } });
    const [p] = await hydrate(trx, [created]);
    return p;
  }, getKnex());
}

async function update(scope, kind, id, input, ctx) {
  const { row, attrs } = toRow(input);
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current || current.kind !== kind) throw notFound(kind === 'doctor' ? 'Doctor' : 'Nurse');
    const patch = { ...row };
    if (Object.keys(attrs).length) patch.attributes = JSON.stringify({ ...(current.attributes || {}), ...attrs });
    if (typeof input.profileImage === 'string' && /^https?:\/\//.test(input.profileImage)) patch.profile_image_url = input.profileImage;
    if (input.profileImage && /^data:/.test(input.profileImage)) {
      const docId = await saveProfile(trx, scope, current, input.profileImage, ctx);
      if (docId) patch.profile_document_id = docId;
    }
    const updated = await repo.update(trx, scope, id, patch);
    await auditInTrx(trx, scope, { action: 'PRACTITIONER_UPDATED', resourceType: 'practitioner', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(row) } });
    const [p] = await hydrate(trx, [updated]);
    return p;
  }, getKnex());
}

async function setActive(scope, kind, id, isActive, ctx) {
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current || current.kind !== kind) throw notFound(kind === 'doctor' ? 'Doctor' : 'Nurse');
    const updated = await repo.update(trx, scope, id, { is_active: isActive });
    await auditInTrx(trx, scope, { action: isActive ? 'PRACTITIONER_ACTIVATED' : 'PRACTITIONER_DEACTIVATED', resourceType: 'practitioner', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [p] = await hydrate(trx, [updated]);
    return p;
  }, getKnex());
}

async function stats(scope, kind) {
  return withTenant(scope, async (trx) => {
    const base = repo.scoped(trx, scope).where('kind', kind);
    const total = Number((await base.clone().count({ c: '*' }))[0].c);
    const active = Number((await base.clone().where('is_active', true).count({ c: '*' }))[0].c);
    const bySpecialty = await base.clone().select('specialty').count({ count: '*' }).groupBy('specialty').orderBy('count', 'desc').limit(10);
    return { total, active, inactive: total - active, bySpecialty: bySpecialty.map((r) => ({ _id: r.specialty, count: Number(r.count) })) };
  }, getKnex());
}

async function refsFor(trx, ids) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return {};
  const rows = await trx('practitioners').whereIn('id', clean).select('id', 'full_name', 'specialty', 'phone', 'email', 'kind', 'department');
  return Object.fromEntries(rows.map((r) => [r.id, ref(r.id, { fullName: r.full_name, name: r.full_name, specialty: r.specialty, specialization: r.specialty, phone: r.phone, email: r.email, role: r.kind, department: r.department })]));
}

async function assertPractitioner(trx, scope, id, kind) {
  if (!id) return null;
  const row = await repo.findById(trx, scope, id);
  if (!row || (kind && row.kind !== kind)) throw notFound('Practitioner');
  return row;
}

module.exports = { list, getById, create, update, setActive, stats, refsFor, assertPractitioner, serialize, repo };
