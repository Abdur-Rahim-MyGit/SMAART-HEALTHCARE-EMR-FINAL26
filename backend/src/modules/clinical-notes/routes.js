'use strict';
const express = require('express');
const { z } = require('zod');
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { isMongoConnected } = require('../../infrastructure/mongodb/connection');
const { tenantFilter } = require('../../infrastructure/mongodb/tenantModel');
const { unavailable, notFound } = require('../../common/errors/AppError');
const { uuid } = require('../../common/validation/schemas');
const { writeAudit } = require('../audit/auditRepository');
const patients = require('../patients/patientService');
const encounters = require('../encounters/encounterService');

const router = express.Router();
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
router.use((req, _res, next) => { if (!isMongoConnected()) return next(unavailable('Clinical notes storage is temporarily unavailable')); req.ClinicalNote = require('../../infrastructure/mongodb/models').ClinicalNote; next(); });
const audit = (req, action, patientId, id) => writeAudit({ user_id: req.auth.userId, role: req.auth.role, clinic_id: req.scope.clinicId, action, resource_type: 'clinical_note', resource_id: String(id), ip: req.ip, request_id: req.id, result: 'SUCCESS', details: JSON.stringify({ patientId }) }).catch(() => {});

router.get('/patient/:patientId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }), query: z.object({ encounterId: uuid.optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }) }), asyncHandler(async (req, res) => {
  const patient = await withTenant(req.scope, (trx) => patients.assertPatient(trx, req.scope, req.params.patientId), getKnex());
  const filter = tenantFilter({ ...req.scope, clinicId: req.scope.clinicId || patient.clinic_id }, { patientId: req.params.patientId });
  if (req.validatedQuery.encounterId) filter.encounterId = req.validatedQuery.encounterId;
  const notes = await req.ClinicalNote.find(filter).sort({ createdAt: -1 }).limit(req.validatedQuery.limit).lean();
  audit(req, 'MEDICAL_RECORD_VIEWED', req.params.patientId, 'list');
  res.json({ success: true, data: notes, count: notes.length });
}));
router.post('/', authorize('clinical:write'), tenantScope(), validate({ body: z.object({ patientId: uuid, encounterId: uuid.optional().nullable(), practitionerId: uuid.optional().nullable(), noteType: z.enum(['progress', 'soap', 'discharge', 'consultation', 'nursing', 'other']).optional(), title: z.string().max(200).optional(), content: z.union([z.string().min(1).max(50000), z.record(z.string(), z.unknown())]), status: z.enum(['draft', 'final', 'amended']).optional(), tags: z.array(z.string().max(50)).max(20).optional() }) }), asyncHandler(async (req, res) => {
  const patient = await withTenant(req.scope, async (trx) => { const p = await patients.assertPatient(trx, req.scope, req.body.patientId); if (req.body.encounterId) await encounters.assertEncounter(trx, req.scope, req.body.encounterId); return p; }, getKnex());
  const note = await req.ClinicalNote.create({ ...req.body, clinicId: patient.clinic_id, createdBy: req.auth.userId });
  if (req.body.encounterId) await getKnex()('encounters').where({ id: req.body.encounterId }).update({ clinical_note_ref: String(note._id) });
  audit(req, 'CLINICAL_NOTE_CREATED', patient.id, note._id);
  res.status(201).json({ success: true, message: 'Clinical note saved', data: note });
}));
router.put('/:id', authorize('clinical:write'), tenantScope(), validate({ params: z.object({ id: objectId }), body: z.object({ title: z.string().max(200).optional(), content: z.union([z.string().min(1).max(50000), z.record(z.string(), z.unknown())]).optional(), status: z.enum(['draft', 'final', 'amended']).optional(), tags: z.array(z.string().max(50)).max(20).optional() }) }), asyncHandler(async (req, res) => {
  const note = await req.ClinicalNote.findOneAndUpdate(tenantFilter(req.scope, { _id: req.params.id }), { ...req.body, updatedBy: req.auth.userId, status: req.body.status || 'amended' }, { new: true }).lean();
  if (!note) throw notFound('Clinical note');
  audit(req, 'MEDICAL_RECORD_UPDATED', note.patientId, note._id);
  res.json({ success: true, message: 'Clinical note updated', data: note });
}));
router.delete('/:id', authorize('clinical:write'), tenantScope(), validate({ params: z.object({ id: objectId }) }), asyncHandler(async (req, res) => {
  const note = await req.ClinicalNote.findOneAndDelete(tenantFilter(req.scope, { _id: req.params.id })).lean();
  if (!note) throw notFound('Clinical note');
  audit(req, 'CLINICAL_NOTE_DELETED', note.patientId, note._id);
  res.json({ success: true, message: 'Clinical note deleted' });
}));
module.exports = router;
