'use strict';
const { withTenant, contains } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const practitioners = require('../practitioners/practitionerService');

const TEXT = { referralType: 'referralType', specialistName: 'specialistName', specialty: 'specialty', reason: 'reason', clinicalHistory: 'clinicalHistory', urgency: 'urgency', preferredDate: 'preferredDate', preferredTime: 'preferredTime', status: 'status', statusNotes: 'statusNotes', specialInstructions: 'specialInstructions', specialistId: 'specialistPractitionerId', referredBy: 'referredBy', encounterId: 'encounterId', patientId: 'patientId' };
const ARRAYS = new Set(['currentMedications', 'attachments']);
const OBJECTS = ['specialistContact', 'specialistAddress', 'externalClinic', 'currentMedications', 'testResults', 'insuranceInfo', 'referringProvider', 'attachments', 'shareableLink'];

function toDoc(input) {
  const d = {};
  for (const [k, c] of Object.entries(TEXT)) if (input[k] !== undefined) d[c] = input[k] === '' ? null : input[k];
  if (d.preferredDate) d.preferredDate = new Date(d.preferredDate);
  for (const k of OBJECTS) if (input[k] !== undefined) d[k] = input[k] ?? (ARRAYS.has(k) ? [] : {});
  if (typeof input.referringProvider === 'string') d.referringProvider = { name: input.referringProvider };
  return d;
}

function serialize(r, { patient, specialist } = {}) {
  const s = serializeRow(r);
  return { ...s, patientId: patient || ref(r.patientId), patientName: patient ? patient.fullName : null, specialistId: specialist || (r.specialistPractitionerId ? ref(r.specialistPractitionerId) : null), referringProvider: r.referringProvider && r.referringProvider.name ? r.referringProvider : { name: 'N/A' } };
}

async function hydrate(db, rows) {
  if (!rows.length) return [];
  const [pmap, dmap] = await Promise.all([patients.refsFor(db, rows.map((r) => r.patientId)), practitioners.refsFor(db, rows.map((r) => r.specialistPractitionerId))]);
  return rows.map((r) => serialize(r, { patient: pmap[r.patientId], specialist: dmap[r.specialistPractitionerId] }));
}

async function list(scope, { patientId, status, urgency, referralType, search, clinicId, page = 1, limit = 100, offset = 0 }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    if (urgency) filter.urgency = urgency;
    if (referralType) filter.referralType = referralType;
    if (search) filter.$or = [{ specialistName: contains(search) }, { specialty: contains(search) }, { reason: contains(search) }];
    const col = db.c('referrals');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { createdAt: -1 }, limit, skip: offset }), col.count(filter)]);
    return { data: await hydrate(db, rows), total, page, limit };
  });
}
async function getById(scope, id) {
  return withTenant(scope, async (db) => {
    const row = await db.c('referrals').findById(id);
    if (!row) throw notFound('Referral');
    return (await hydrate(db, [row]))[0];
  });
}
async function create(scope, input, ctx) {
  const d = toDoc(input);
  if (!d.patientId) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (db) => {
    const patient = await patients.assertPatient(db, scope, d.patientId);
    const clinicId = patient.clinicId;
    if (d.specialistPractitionerId) await practitioners.assertPractitioner(db, scope, d.specialistPractitionerId);
    if (d.referredBy) await practitioners.assertPractitioner(db, scope, d.referredBy);
    const created = await db.c('referrals').insertOne({ status: 'Pending', urgency: 'Medium', referralType: 'Specialist', currentMedications: [], attachments: [], ...d, clinicId });
    await auditInTrx(db, { ...scope, clinicId }, { action: 'REFERRAL_CREATED', resourceType: 'referral', resourceId: created._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'referral.created', aggregateType: 'referral', aggregateId: created._id, clinicId, actorId: scope.userId, payload: { patientId: patient._id, urgency: created.urgency } });
    return (await hydrate(db, [created]))[0];
  });
}
async function update(scope, id, input, ctx) {
  const d = toDoc(input);
  delete d.patientId;
  return withTenant(scope, async (db) => {
    if (d.specialistPractitionerId) await practitioners.assertPractitioner(db, scope, d.specialistPractitionerId);
    const updated = await db.c('referrals').updateOne({ _id: id }, d);
    if (!updated) throw notFound('Referral');
    await auditInTrx(db, scope, { action: 'REFERRAL_UPDATED', resourceType: 'referral', resourceId: id, requestId: ctx.requestId, ip: ctx.ip, details: { fields: Object.keys(d) } });
    await enqueueEvent(db, { type: 'referral.updated', aggregateType: 'referral', aggregateId: id, clinicId: updated.clinicId, actorId: scope.userId, payload: { status: updated.status } });
    return (await hydrate(db, [updated]))[0];
  });
}
async function remove(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const n = await db.c('referrals').softDelete({ _id: id });
    if (!n) throw notFound('Referral');
    await auditInTrx(db, scope, { action: 'REFERRAL_DELETED', resourceType: 'referral', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  });
}
async function stats(scope) {
  return withTenant(scope, async (db) => {
    const col = db.c('referrals');
    const [totalReferrals, pendingReferrals, approvedReferrals, completedReferrals, urgentReferrals] = await Promise.all([col.count({}), col.count({ status: 'Pending' }), col.count({ status: 'Approved' }), col.count({ status: 'Completed' }), col.count({ urgency: { $in: ['High', 'Urgent', 'Emergency'] } })]);
    return { totalReferrals, pendingReferrals, approvedReferrals, completedReferrals, urgentReferrals };
  });
}
module.exports = { list, getById, create, update, remove, stats };
