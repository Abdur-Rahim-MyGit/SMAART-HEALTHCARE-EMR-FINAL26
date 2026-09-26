'use strict';
/** Conditions, allergies and medications: encounter-linked clinical records. */
const express = require('express');
const { z } = require('zod');
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { BaseRepository } = require('../../infrastructure/postgres/BaseRepository');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString } = require('../../common/validation/schemas');
const { serializeRow, pickForDb } = require('../../common/utils/serialize');
const { notFound } = require('../../common/errors/AppError');
const { auditInTrx } = require('../audit/auditRepository');
const patients = require('../patients/patientService');
const encounters = require('../encounters/encounterService');

const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });

function build({ table, label, fields, schema }) {
  const repo = new BaseRepository(table);
  const router = express.Router();
  const toRow = (input) => pickForDb(input, fields);

  router.get('/', authorize('clinical:read'), tenantScope(), validate({ query: z.object({ patientId: uuid.optional(), encounterId: uuid.optional(), status: z.string().max(30).optional(), limit: z.coerce.number().int().min(1).max(500).default(200) }) }), asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const data = await withTenant(req.scope, async (trx) => {
      const where = {};
      if (q.patientId) where.patient_id = q.patientId;
      if (q.encounterId) where.encounter_id = q.encounterId;
      if (q.status) where[table === 'medications' ? 'status' : 'clinical_status'] = q.status;
      return (await repo.list(trx, req.scope, { where, limit: q.limit })).map((r) => serializeRow(r));
    }, getKnex());
    res.json({ success: true, data, count: data.length });
  }));
  router.get('/patient/:patientId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }) }), asyncHandler(async (req, res) => {
    const data = await withTenant(req.scope, async (trx) => {
      await patients.assertPatient(trx, req.scope, req.params.patientId);
      return (await repo.list(trx, req.scope, { where: { patient_id: req.params.patientId }, limit: 500 })).map((r) => serializeRow(r));
    }, getKnex());
    res.json({ success: true, data, count: data.length });
  }));
  router.get('/:id', authorize('clinical:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    const data = await withTenant(req.scope, async (trx) => {
      const row = await repo.findById(trx, req.scope, req.params.id);
      if (!row) throw notFound(label);
      return serializeRow(row);
    }, getKnex());
    res.json({ success: true, data });
  }));
  router.post('/', authorize('clinical:write'), tenantScope(), validate({ body: schema.extend({ patientId: uuid, encounterId: uuid.optional().nullable() }) }), asyncHandler(async (req, res) => {
    const data = await withTenant(req.scope, async (trx) => {
      const patient = await patients.assertPatient(trx, req.scope, req.body.patientId);
      if (req.body.encounterId) await encounters.assertEncounter(trx, req.scope, req.body.encounterId);
      const [row] = await trx(table).insert({ ...toRow(req.body), patient_id: patient.id, encounter_id: req.body.encounterId || null, clinic_id: patient.clinic_id, created_by: req.scope.userId, updated_by: req.scope.userId }).returning('*');
      await auditInTrx(trx, { ...req.scope, clinicId: patient.clinic_id }, { action: `${label.toUpperCase()}_CREATED`, resourceType: table, resourceId: row.id, ...ctxOf(req) });
      return serializeRow(row);
    }, getKnex());
    res.status(201).json({ success: true, message: `${label} recorded`, data });
  }));
  router.put('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body: schema }), asyncHandler(async (req, res) => {
    const data = await withTenant(req.scope, async (trx) => {
      const row = await repo.update(trx, req.scope, req.params.id, toRow(req.body));
      if (!row) throw notFound(label);
      await auditInTrx(trx, req.scope, { action: 'MEDICAL_RECORD_UPDATED', resourceType: table, resourceId: row.id, ...ctxOf(req) });
      return serializeRow(row);
    }, getKnex());
    res.json({ success: true, message: `${label} updated`, data });
  }));
  router.delete('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    await withTenant(req.scope, async (trx) => {
      const ok = await repo.remove(trx, req.scope, req.params.id);
      if (!ok) throw notFound(label);
      await auditInTrx(trx, req.scope, { action: `${label.toUpperCase()}_DELETED`, resourceType: table, resourceId: req.params.id, ...ctxOf(req) });
    }, getKnex());
    res.json({ success: true, message: `${label} deleted` });
  }));
  return router;
}

const conditions = build({ table: 'clinical_conditions', label: 'Condition', fields: ['code', 'codeSystem', 'display', 'clinicalStatus', 'verificationStatus', 'severity', 'onsetDate', 'abatementDate', 'recordedBy', 'notes'], schema: z.object({ code: optionalString(40), codeSystem: optionalString(120), display: z.string().min(1).max(300).optional(), clinicalStatus: z.enum(['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved']).optional(), verificationStatus: optionalString(30), severity: optionalString(30), onsetDate: z.coerce.date().optional().nullable(), abatementDate: z.coerce.date().optional().nullable(), recordedBy: uuid.optional().nullable(), notes: optionalString(2000) }) });
const allergies = build({ table: 'allergies', label: 'Allergy', fields: ['substance', 'category', 'criticality', 'reaction', 'clinicalStatus', 'onsetDate', 'recordedBy'], schema: z.object({ substance: z.string().min(1).max(200).optional(), category: z.enum(['food', 'medication', 'environment', 'biologic']).optional().nullable(), criticality: z.enum(['low', 'high', 'unable-to-assess']).optional().nullable(), reaction: optionalString(500), clinicalStatus: z.enum(['active', 'inactive', 'resolved']).optional(), onsetDate: z.coerce.date().optional().nullable(), recordedBy: uuid.optional().nullable() }) });
const medications = build({ table: 'medications', label: 'Medication', fields: ['name', 'code', 'dosage', 'frequency', 'route', 'status', 'startDate', 'endDate', 'reason'], schema: z.object({ name: z.string().min(1).max(200).optional(), code: optionalString(40), dosage: optionalString(100), frequency: optionalString(100), route: optionalString(60), status: z.enum(['active', 'completed', 'stopped', 'on-hold']).optional(), startDate: z.coerce.date().optional().nullable(), endDate: z.coerce.date().optional().nullable(), reason: optionalString(500) }) });

module.exports = { conditions, allergies, medications };
