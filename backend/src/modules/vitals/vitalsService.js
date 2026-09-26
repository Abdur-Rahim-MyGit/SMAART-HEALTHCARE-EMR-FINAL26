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
const encounters = require('../encounters/encounterService');

const repo = new BaseRepository('vitals');
const num = (v) => (v === '' || v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const val = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);

function bmiCategory(bmi) {
  if (!bmi) return null;
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

/** Accepts both the legacy nested `vitalSigns` shape and flat fields. */
function toRow(input) {
  const vs = input.vitalSigns || input;
  const row = {};
  if (input.patientId !== undefined) row.patient_id = input.patientId;
  if (input.encounterId !== undefined) row.encounter_id = input.encounterId || null;
  if (input.visitDate !== undefined || input.recordedAt !== undefined) row.recorded_at = new Date(input.recordedAt || input.visitDate);
  if (input.recordedBy !== undefined) row.recorded_by = input.recordedBy || null;
  if (input.recordedByName !== undefined) row.recorded_by_name = input.recordedByName;
  if (input.recordedByRole !== undefined) row.recorded_by_role = input.recordedByRole;
  const bp = vs.bloodPressure || {};
  if (bp.systolic !== undefined || vs.systolic !== undefined) row.systolic = num(bp.systolic ?? vs.systolic);
  if (bp.diastolic !== undefined || vs.diastolic !== undefined) row.diastolic = num(bp.diastolic ?? vs.diastolic);
  if (vs.heartRate !== undefined) row.heart_rate = num(val(vs.heartRate));
  if (vs.temperature !== undefined) { row.temperature = num(val(vs.temperature)); if (vs.temperature && vs.temperature.unit) row.temperature_unit = vs.temperature.unit; }
  if (vs.temperatureUnit) row.temperature_unit = vs.temperatureUnit;
  if (vs.respiratoryRate !== undefined) row.respiratory_rate = num(val(vs.respiratoryRate));
  if (vs.oxygenSaturation !== undefined) row.oxygen_saturation = num(val(vs.oxygenSaturation));
  if (vs.weight !== undefined) row.weight_kg = num(val(vs.weight));
  if (vs.height !== undefined) row.height_cm = num(val(vs.height));
  if (vs.bloodSugar !== undefined) row.blood_sugar = num(val(vs.bloodSugar));
  if (vs.painScore !== undefined) row.pain_score = num(val(vs.painScore));
  const bmiIn = vs.bmi !== undefined ? num(val(vs.bmi)) : null;
  if (bmiIn) row.bmi = bmiIn;
  else if (row.weight_kg && row.height_cm) row.bmi = Math.round((row.weight_kg / (row.height_cm / 100) ** 2) * 10) / 10;
  if (row.bmi !== undefined) row.bmi_category = bmiCategory(row.bmi);
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.clinicalNotes !== undefined) row.clinical_notes = JSON.stringify(input.clinicalNotes || {});
  return row;
}

function serialize(r, { patient, clinic } = {}) {
  const s = serializeRow(r);
  const unit = r.temperature_unit || '°F';
  return {
    ...s,
    visitDate: r.recorded_at,
    patientId: patient || ref(r.patient_id),
    uhid: patient ? patient.uhid : undefined,
    clinicId: clinic ? ref(r.clinic_id, { name: clinic.name }) : r.clinic_id,
    vitalSigns: {
      bloodPressure: { systolic: r.systolic, diastolic: r.diastolic },
      heartRate: { value: r.heart_rate, unit: 'bpm' },
      temperature: { value: r.temperature, unit },
      respiratoryRate: { value: r.respiratory_rate, unit: '/min' },
      oxygenSaturation: { value: r.oxygen_saturation, unit: '%' },
      weight: { value: r.weight_kg, unit: 'kg' },
      height: { value: r.height_cm, unit: 'cm' },
      bmi: { value: r.bmi, category: r.bmi_category },
      bloodSugar: { value: r.blood_sugar, unit: 'mg/dL' },
      painScore: r.pain_score,
    },
  };
}

async function hydrate(trx, rows) {
  if (!rows.length) return [];
  const pmap = await patients.refsFor(trx, rows.map((r) => r.patient_id));
  const clinics = await trx('clinics').whereIn('id', [...new Set(rows.map((r) => r.clinic_id))]).select('id', 'name');
  const cmap = Object.fromEntries(clinics.map((c) => [c.id, c]));
  return rows.map((r) => serialize(r, { patient: pmap[r.patient_id], clinic: cmap[r.clinic_id] }));
}

async function list(scope, { patientId, from, to, clinicId, limit = 100, offset = 0, page = 1 }) {
  return withTenant(scope, async (trx) => {
    let q = repo.scoped(trx, scope);
    if (clinicId && scope.role === ROLES.SUPER_MASTER_ADMIN) q = q.where('clinic_id', clinicId);
    if (patientId) q = q.where('patient_id', patientId);
    if (from) q = q.where('recorded_at', '>=', from);
    if (to) q = q.where('recorded_at', '<=', to);
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    const rows = await q.orderBy('recorded_at', 'desc').limit(limit).offset(offset);
    return { data: await hydrate(trx, rows), total, page, limit };
  }, getKnex());
}

async function getById(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const row = await repo.findById(trx, scope, id);
    if (!row) throw notFound('Vitals record');
    await auditInTrx(trx, scope, { action: 'MEDICAL_RECORD_VIEWED', resourceType: 'vitals', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [v] = await hydrate(trx, [row]);
    return v;
  }, getKnex());
}

async function create(scope, input, ctx) {
  const row = toRow(input);
  if (!row.patient_id) throw badRequest('patientId is required', 'VALIDATION_ERROR');
  return withTenant(scope, async (trx) => {
    const patient = await patients.assertPatient(trx, scope, row.patient_id);
    if (row.encounter_id) await encounters.assertEncounter(trx, scope, row.encounter_id);
    const [created] = await trx('vitals').insert({ ...row, clinic_id: patient.clinic_id, recorded_at: row.recorded_at || new Date(), created_by: scope.userId, updated_by: scope.userId }).returning('*');
    await auditInTrx(trx, { ...scope, clinicId: patient.clinic_id }, { action: 'VITALS_RECORDED', resourceType: 'vitals', resourceId: created.id, requestId: ctx.requestId, ip: ctx.ip });
    await enqueueEvent(trx, { type: 'vitals.recorded', aggregateType: 'vitals', aggregateId: created.id, clinicId: patient.clinic_id, actorId: scope.userId, payload: { patientId: patient.id } });
    const [v] = await hydrate(trx, [created]);
    return v;
  }, getKnex());
}

async function update(scope, id, input, ctx) {
  const row = toRow(input);
  delete row.patient_id;
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Vitals record');
    const updated = await repo.update(trx, scope, id, row);
    await auditInTrx(trx, scope, { action: 'MEDICAL_RECORD_UPDATED', resourceType: 'vitals', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    const [v] = await hydrate(trx, [updated]);
    return v;
  }, getKnex());
}

async function remove(scope, id, ctx) {
  return withTenant(scope, async (trx) => {
    const current = await repo.findById(trx, scope, id);
    if (!current) throw notFound('Vitals record');
    await repo.remove(trx, scope, id);
    await auditInTrx(trx, scope, { action: 'VITALS_DELETED', resourceType: 'vitals', resourceId: id, requestId: ctx.requestId, ip: ctx.ip });
    return true;
  }, getKnex());
}

module.exports = { list, getById, create, update, remove, repo };
