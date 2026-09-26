'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { likePattern } = require('../../common/validation/schemas');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');

const repo = new BaseRepository('referrals');
const TEXT = { referralType: 'referral_type', specialistName: 'specialist_name', specialty: 'specialty', reason: 'reason', clinicalHistory: 'clinical_history', urgency: 'urgency', preferredDate: 'preferred_date', preferredTime: 'preferred_time', status: 'status', statusNotes: 'status_notes', specialInstructions: 'special_instructions', specialistId: 'specialist_practitioner_id', referredBy: 'referred_by', encounterId: 'encounter_id', patientId: 'patient_id' };
const JSON_F = { specialistContact: 'specialist_contact', specialistAddress: 'specialist_address', externalClinic: 'external_clinic', currentMedications: 'current_medications', testResults: 'test_results', insuranceInfo: 'insurance_info', referringProvider: 'referring_provider', attachments: 'attachments', shareableLink: 'shareable_link' };

function toRow(input) {
  const row = {};
  for (const [k, c] of Object.entries(TEXT)) if (input[k] !== undefined) row[c] = input[k] === '' ? null : input[k];
  for (const [k, c] of Object.entries(JSON_F)) if (input[k] !== undefined) row[c] = JSON.stringify(input[k] ?? (k === 'currentMedications' || k === 'attachments' ? [] : {}));
  if (typeof input.referringProvider === 'string') row.referring_provider = JSON.stringify({ name: input.referringProvider });
  return row;
}

function serialize(r, { patient, specialist } = {}) {
  const s = serializeRow(r);
  return { ...s, patientId: patient || ref(r.patient_id), patientName: patient ? patient.fullName : null, specialistId: specialist || (r.specialist_practitioner_id ? ref(r.specialist_practitioner_id) : null), referringProvider: r.referring_provider && r.referring_provider.name ? r.referring_provider : { name: 'N/A' } };
}

async function hydrate(trx, rows) {
  if (!rows.length) return [];
  const [pmap, dmap] = await Promise.all([patients.refsFor(trx, rows.map((r) => r.patient_id)), practitioners.refsFor(trx, rows.map((r) => r.specialist_practitioner_id))]);
  return rows.map((r) => serialize(r, { patient: pmap[r.patient_id], specialist: dmap[r.specialist_practitioner_id] }));
}

async function list(scope, { patientId, status, urgency, referralType, search, clinicId, page = 1, limit = 100, offset = 0 }) {
  return withTenant(scope, async (trx) => {
    let q = repo.scoped(trx, scope);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('clinic_id', clinicId);
    if (patientId) q = q.where('patient_id', patientId);
    if (status) q = q.where('status', status);
    if (urgency) q = q.where('urgency', urgency);
    if (referralType) q = q.where('referral_type', referralType);
    if (search) q = q.where((b) => b.whereILike('specialist_name', likePattern(search)).orWhereILike('specialty', likePattern(search)).orWhereILike('reason', likePattern(search)));
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('created_at', 'desc').limit(limit).offset(offset);
    return { data: await hydrate(trx, rows), total, page, limit };
  }, getKnex());
}
async function getById(scope, id) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Referral');
    const [r] = await hydrate(trx, [row]);
    return r;
  }, getKnex());
}
async function create(scope, input, ctx) {
  const row = toRow(input);
  if (!row.patient_id) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (trx) => {
    const patient = await patients.assertPatient(trx, scope, row.patient_id);
    if (row.specialist_practitioner_id) await practitioners.assertPractitioner(trx, scope, row.specialist_practitioner_id);
    if (row.referred_by) await practitioners.assertPractitioner(trx, scope, row.referred_by);
    const [created] = await trx('referrals').insert({ ...row, clinic_id: patient.clinic_id, created_by: scope.userId, updated_by: scope.userId }).returning('*');
    await auditInTrx(trx, { ...scope, clinicId: patient.clinic_id }, { action: 'REFERRAL_CREATED', resourceType: 'referral', resourceId: created.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'referral.created', aggregateType: 'referral', aggregateId: created.id, clinicId: patient.clinic_id, actorId: scope.userId, payload: { patientId: patient.id, urgency: created.urgency } });
    const [r] = await hydrate(trx, [created]);
    return r;
  }, getKnex());
}
async function update(scope, id, input, ctx) {
  const row = toRow(input);
  delete row.patient_id;
  return withTenant(scope, async (trx) => {
    if (row.specialist_practitioner_id) await practitioners.assertPractitioner(trx, scope, row.specialist_practitioner_id);
    const updated = await repo.update(trx, scope, id, row);
    if (!updated) throw notFound('Referral');
    await auditInTrx(trx, scope, { action: 'REFERRAL_UPDATED', resourceType: 'referral', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(row) } });
    await enqueueEvent(trx, { type: 'referral.updated', aggregateType: 'referral', aggregateId: id, clinicId: updated.clinic_id, actorId: scope.userId, payload: { status: updated.status } });
    const [r] = await hydrate(trx, [updated]);
    return r;
  }, getKnex());
}
async function remove(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const ok = await repo.remove(trx, scope, id);
    if (!ok) throw notFound('Referral');
    await auditInTrx(trx, scope, { action: 'REFERRAL_DELETED', resourceType: 'referral', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  }, getKnex());
}
async function stats(scope) {
  return withTenant(scope, async (trx) => {
    const base = repo.scoped(trx, scope);
    const n = async (q) => Number((await q.count({ c: '*' }))[0].c);
    const [totalReferrals, pendingReferrals, approvedReferrals, completedReferrals, urgentReferrals] = await Promise.all([n(base.clone()), n(base.clone().where('status', 'Pending')), n(base.clone().where('status', 'Approved')), n(base.clone().where('status', 'Completed')), n(base.clone().whereIn('urgency', ['High', 'Urgent', 'Emergency']))]);
    return { totalReferrals, pendingReferrals, approvedReferrals, completedReferrals, urgentReferrals };
  }, getKnex());
}
module.exports = { list, getById, create, update, remove, stats, repo };
