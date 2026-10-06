'use strict';
const { withTenant } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { notFound, badRequest } = require('../../common/errors/AppError');
const { serializeRow, ref } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const { enqueueEvent } = require('../../infrastructure/outbox/outboxRepository');
const patients = require('../patients/patientService');
const encounters = require('../encounters/encounterService');

const num = (v) => (v === '' || v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const val = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);
function bmiCategory(bmi) { if (!bmi) return null; if (bmi < 18.5) return 'Underweight'; if (bmi < 25) return 'Normal'; if (bmi < 30) return 'Overweight'; return 'Obese'; }
function toDoc(input) {
  const vs = input.vitalSigns || input;
  const d = {};
  if (input.patientId !== undefined) d.patientId = input.patientId;
  if (input.encounterId !== undefined) d.encounterId = input.encounterId || null;
  if (input.visitDate !== undefined || input.recordedAt !== undefined) d.recordedAt = new Date(input.recordedAt || input.visitDate);
  if (input.recordedBy !== undefined) d.recordedBy = input.recordedBy || null;
  if (input.recordedByName !== undefined) d.recordedByName = input.recordedByName;
  if (input.recordedByRole !== undefined) d.recordedByRole = input.recordedByRole;
  const bp = vs.bloodPressure || {};
  if (bp.systolic !== undefined || vs.systolic !== undefined) d.systolic = num(bp.systolic ?? vs.systolic);
  if (bp.diastolic !== undefined || vs.diastolic !== undefined) d.diastolic = num(bp.diastolic ?? vs.diastolic);
  if (vs.heartRate !== undefined) d.heartRate = num(val(vs.heartRate));
  if (vs.temperature !== undefined) { d.temperature = num(val(vs.temperature)); if (vs.temperature && vs.temperature.unit) d.temperatureUnit = vs.temperature.unit; }
  if (vs.temperatureUnit) d.temperatureUnit = vs.temperatureUnit;
  if (vs.respiratoryRate !== undefined) d.respiratoryRate = num(val(vs.respiratoryRate));
  if (vs.oxygenSaturation !== undefined) d.oxygenSaturation = num(val(vs.oxygenSaturation));
  if (vs.weight !== undefined) d.weightKg = num(val(vs.weight));
  if (vs.height !== undefined) d.heightCm = num(val(vs.height));
  if (vs.bloodSugar !== undefined) d.bloodSugar = num(val(vs.bloodSugar));
  if (vs.painScore !== undefined) d.painScore = num(val(vs.painScore));
  const bmiIn = vs.bmi !== undefined ? num(val(vs.bmi)) : null;
  if (bmiIn) d.bmi = bmiIn; else if (d.weightKg && d.heightCm) d.bmi = Math.round((d.weightKg / (d.heightCm / 100) ** 2) * 10) / 10;
  if (d.bmi !== undefined) d.bmiCategory = bmiCategory(d.bmi);
  if (input.notes !== undefined) d.notes = input.notes;
  if (input.clinicalNotes !== undefined) d.clinicalNotes = input.clinicalNotes || {};
  return d;
}
function serialize(r, { patient, clinic } = {}) {
  const unit = r.temperatureUnit || '°F';
  return { ...serializeRow(r), visitDate: r.recordedAt, patientId: patient || ref(r.patientId), uhid: patient ? patient.uhid : undefined, clinicId: clinic ? ref(r.clinicId, { name: clinic.name }) : r.clinicId, vitalSigns: { bloodPressure: { systolic: r.systolic, diastolic: r.diastolic }, heartRate: { value: r.heartRate, unit: 'bpm' }, temperature: { value: r.temperature, unit }, respiratoryRate: { value: r.respiratoryRate, unit: '/min' }, oxygenSaturation: { value: r.oxygenSaturation, unit: '%' }, weight: { value: r.weightKg, unit: 'kg' }, height: { value: r.heightCm, unit: 'cm' }, bmi: { value: r.bmi, category: r.bmiCategory }, bloodSugar: { value: r.bloodSugar, unit: 'mg/dL' }, painScore: r.painScore } };
}
async function hydrate(db, rows) {
  if (!rows.length) return [];
  const pmap = await patients.refsFor(db, rows.map((r) => r.patientId));
  const clinics = await db.c('clinics').find({ _id: { $in: [...new Set(rows.map((r) => r.clinicId))] } }, { projection: { name: 1 } });
  const cmap = Object.fromEntries(clinics.map((c) => [c._id, c]));
  return rows.map((r) => serialize(r, { patient: pmap[r.patientId], clinic: cmap[r.clinicId] }));
}
async function list(scope, { patientId, from, to, clinicId, limit = 100, offset = 0, page = 1 }) {
  return withTenant(scope, async (db) => {
    const filter = {};
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    if (from || to) filter.recordedAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const col = db.c('vitals');
    const [rows, total] = await Promise.all([col.find(filter, { sort: { recordedAt: -1 }, limit, skip: offset }), col.count(filter)]);
    return { data: await hydrate(db, rows), total, page, limit };
  });
}
async function getById(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const row = await db.c('vitals').findById(id);
    if (!row) throw notFound('Vitals record');
    await auditInTrx(db, scope, { action: 'MEDICAL_RECORD_VIEWED', resourceType: 'vitals', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return (await hydrate(db, [row]))[0];
  });
}
async function create(scope, input, ctx) {
  const d = toDoc(input);
  if (!d.patientId) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (db) => {
    const patient = await patients.assertPatient(db, scope, d.patientId);
    if (d.encounterId) await encounters.assertEncounter(db, scope, d.encounterId);
    const created = await db.c('vitals').insertOne({ temperatureUnit: '°F', clinicalNotes: {}, encounterId: null, recordedBy: null, ...d, clinicId: patient.clinicId, recordedAt: d.recordedAt || new Date() });
    await auditInTrx(db, { ...scope, clinicId: patient.clinicId }, { action: 'VITALS_RECORDED', resourceType: 'vitals', resourceId: created._id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(db, { type: 'vitals.recorded', aggregateType: 'vitals', aggregateId: created._id, clinicId: patient.clinicId, actorId: scope.userId, payload: { patientId: patient._id } });
    return (await hydrate(db, [created]))[0];
  });
}
async function update(scope, id, input, ctx) {
  const d = toDoc(input);
  delete d.patientId;
  return withTenant(scope, async (db) => {
    const updated = await db.c('vitals').updateOne({ _id: id }, d);
    if (!updated) throw notFound('Vitals record');
    await auditInTrx(db, scope, { action: 'MEDICAL_RECORD_UPDATED', resourceType: 'vitals', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return (await hydrate(db, [updated]))[0];
  });
}
async function remove(scope, id, ctx) {
  return withTenant(scope, async (db) => {
    const n = await db.c('vitals').softDelete({ _id: id });
    if (!n) throw notFound('Vitals record');
    await auditInTrx(db, scope, { action: 'VITALS_DELETED', resourceType: 'vitals', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  });
}
module.exports = { list, getById, create, update, remove };
