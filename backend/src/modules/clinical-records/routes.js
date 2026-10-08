'use strict';
/** Conditions, allergies and patient medications: encounter-linked clinical records. */
const express = require('express');
const { z } = require('zod');
const { withTenant } = require('../../infrastructure/mongodb/tenant');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idParam, uuid, optionalString } = require('../../common/validation/schemas');
const { serializeRow } = require('../../common/utils/serialize');
const { notFound } = require('../../common/errors/AppError');
const { auditInTrx } = require('../audit/auditRepository');
const patients = require('../patients/patientService');
const encounters = require('../encounters/encounterService');

const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });
function build({ collection, label, fields, schema, defaults, statusField }) {
  const router = express.Router();
  const pick = (input) => { const d = {}; for (const f of fields) if (input[f] !== undefined) d[f] = input[f] instanceof Date || input[f] === null || typeof input[f] !== 'string' || !/Date$/.test(f) ? input[f] : new Date(input[f]); return d; };
  router.get('/', authorize('clinical:read'), tenantScope(), validate({ query: z.object({ patientId: uuid.optional(), encounterId: uuid.optional(), status: z.string().max(30).optional(), limit: z.coerce.number().int().min(1).max(500).default(200) }) }), asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const data = await withTenant(req.scope, async (db) => {
      const filter = {};
      if (q.patientId) filter.patientId = q.patientId;
      if (q.encounterId) filter.encounterId = q.encounterId;
      if (q.status) filter[statusField] = q.status;
      return (await db.c(collection).find(filter, { sort: { createdAt: -1 }, limit: q.limit })).map((r) => serializeRow(r));
    });
    res.json({ success: true, data, count: data.length });
  }));
  router.get('/patient/:patientId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }) }), asyncHandler(async (req, res) => {
    const data = await withTenant(req.scope, async (db) => { await patients.assertPatient(db, req.scope, req.params.patientId); return (await db.c(collection).find({ patientId: req.params.patientId }, { sort: { createdAt: -1 }, limit: 500 })).map((r) => serializeRow(r)); });
    res.json({ success: true, data, count: data.length });
  }));
  router.get('/:id', authorize('clinical:read'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    const data = await withTenant(req.scope, async (db) => { const row = await db.c(collection).findById(req.params.id); if (!row) throw notFound(label); return serializeRow(row); });
    res.json({ success: true, data });
  }));
  router.post('/', authorize('clinical:write'), tenantScope(), validate({ body: schema.extend({ patientId: uuid, encounterId: uuid.optional().nullable() }) }), asyncHandler(async (req, res) => {
    const data = await withTenant(req.scope, async (db) => {
      const patient = await patients.assertPatient(db, req.scope, req.body.patientId);
      if (req.body.encounterId) await encounters.assertEncounter(db, req.scope, req.body.encounterId);
      const row = await db.c(collection).insertOne({ ...defaults, ...pick(req.body), patientId: patient._id, encounterId: req.body.encounterId || null, clinicId: patient.clinicId });
      await auditInTrx(db, { ...req.scope, clinicId: patient.clinicId }, { action: `${label.toUpperCase()}_CREATED`, resourceType: collection, resourceId: row._id, ...ctxOf(req) });
      return serializeRow(row);
    });
    res.status(201).json({ success: true, message: `${label} recorded`, data });
  }));
  router.put('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body: schema }), asyncHandler(async (req, res) => {
    const data = await withTenant(req.scope, async (db) => {
      const row = await db.c(collection).updateOne({ _id: req.params.id }, pick(req.body));
      if (!row) throw notFound(label);
      await auditInTrx(db, req.scope, { action: 'MEDICAL_RECORD_UPDATED', resourceType: collection, resourceId: row._id, ...ctxOf(req) });
      return serializeRow(row);
    });
    res.json({ success: true, message: `${label} updated`, data });
  }));
  router.delete('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
    await withTenant(req.scope, async (db) => {
      const n = await db.c(collection).softDelete({ _id: req.params.id });
      if (!n) throw notFound(label);
      await auditInTrx(db, req.scope, { action: `${label.toUpperCase()}_DELETED`, resourceType: collection, resourceId: req.params.id, ...ctxOf(req) });
    });
    res.json({ success: true, message: `${label} deleted` });
  }));
  return router;
}
const conditions = build({ collection: 'clinical_conditions', label: 'Condition', statusField: 'clinicalStatus', defaults: { code: null, codeSystem: 'http://hl7.org/fhir/sid/icd-10', clinicalStatus: 'active', verificationStatus: 'confirmed', severity: null, onsetDate: null, abatementDate: null, recordedBy: null, notes: null }, fields: ['code', 'codeSystem', 'display', 'clinicalStatus', 'verificationStatus', 'severity', 'onsetDate', 'abatementDate', 'recordedBy', 'notes'], schema: z.object({ code: optionalString(40), codeSystem: optionalString(120), display: z.string().min(1).max(300).optional(), clinicalStatus: z.enum(['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved']).optional(), verificationStatus: optionalString(30), severity: optionalString(30), onsetDate: z.coerce.date().optional().nullable(), abatementDate: z.coerce.date().optional().nullable(), recordedBy: uuid.optional().nullable(), notes: optionalString(2000) }) });
const allergies = build({ collection: 'allergies', label: 'Allergy', statusField: 'clinicalStatus', defaults: { category: null, criticality: null, reaction: null, clinicalStatus: 'active', onsetDate: null, recordedBy: null }, fields: ['substance', 'category', 'criticality', 'reaction', 'clinicalStatus', 'onsetDate', 'recordedBy'], schema: z.object({ substance: z.string().min(1).max(200).optional(), category: z.enum(['food', 'medication', 'environment', 'biologic']).optional().nullable(), criticality: z.enum(['low', 'high', 'unable-to-assess']).optional().nullable(), reaction: optionalString(500), clinicalStatus: z.enum(['active', 'inactive', 'resolved']).optional(), onsetDate: z.coerce.date().optional().nullable(), recordedBy: uuid.optional().nullable() }) });
const medications = build({ collection: 'medications', label: 'Medication', statusField: 'status', defaults: { code: null, dosage: null, frequency: null, route: null, status: 'active', startDate: null, endDate: null, reason: null }, fields: ['name', 'code', 'dosage', 'frequency', 'route', 'status', 'startDate', 'endDate', 'reason'], schema: z.object({ name: z.string().min(1).max(200).optional(), code: optionalString(40), dosage: optionalString(100), frequency: optionalString(100), route: optionalString(60), status: z.enum(['active', 'completed', 'stopped', 'on-hold']).optional(), startDate: z.coerce.date().optional().nullable(), endDate: z.coerce.date().optional().nullable(), reason: optionalString(500) }) });
module.exports = { conditions, allergies, medications };
