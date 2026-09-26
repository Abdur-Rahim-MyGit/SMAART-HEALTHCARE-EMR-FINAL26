'use strict';
const express = require('express');
const { z } = require('zod');
const { withTenant } = require('../../infrastructure/mongodb/tenant');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { notFound } = require('../../common/errors/AppError');
const { idParam, uuid } = require('../../common/validation/schemas');
const { serializeRow } = require('../../common/utils/serialize');
const { auditInTrx } = require('../audit/auditRepository');
const patients = require('../patients/patientService');
const encounters = require('../encounters/encounterService');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });

router.get('/patient/:patientId', authorize('clinical:read'), tenantScope(), validate({ params: z.object({ patientId: uuid }), query: z.object({ encounterId: uuid.optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }) }), asyncHandler(async (req, res) => {
  const notes = await withTenant(req.scope, async (db) => {
    await patients.assertPatient(db, req.scope, req.params.patientId);
    const filter = { patientId: req.params.patientId };
    if (req.validatedQuery.encounterId) filter.encounterId = req.validatedQuery.encounterId;
    const rows = await db.c('clinical_notes').find(filter, { sort: { createdAt: -1 }, limit: req.validatedQuery.limit });
    await auditInTrx(db, req.scope, { action: 'MEDICAL_RECORD_VIEWED', resourceType: 'clinical_note', resourceId: 'list', ...ctxOf(req), details: { patientId: req.params.patientId } });
    return rows;
  });
  res.json({ success: true, data: serializeRow(notes), count: notes.length });
}));
router.post('/', authorize('clinical:write'), tenantScope(), validate({ body: z.object({ patientId: uuid, encounterId: uuid.optional().nullable(), practitionerId: uuid.optional().nullable(), noteType: z.enum(['progress', 'soap', 'discharge', 'consultation', 'nursing', 'other']).optional(), title: z.string().max(200).optional(), content: z.union([z.string().min(1).max(50000), z.record(z.string(), z.unknown())]), status: z.enum(['draft', 'final', 'amended']).optional(), tags: z.array(z.string().max(50)).max(20).optional() }) }), asyncHandler(async (req, res) => {
  const note = await withTenant(req.scope, async (db) => {
    const patient = await patients.assertPatient(db, req.scope, req.body.patientId);
    if (req.body.encounterId) await encounters.assertEncounter(db, req.scope, req.body.encounterId);
    const created = await db.c('clinical_notes').insertOne({ noteType: 'progress', title: null, status: 'final', tags: [], encounterId: null, practitionerId: null, ...req.body, clinicId: patient.clinicId });
    if (req.body.encounterId) await db.c('encounters').updateOne({ _id: req.body.encounterId }, { clinicalNoteRef: created._id });
    await auditInTrx(db, { ...req.scope, clinicId: patient.clinicId }, { action: 'CLINICAL_NOTE_CREATED', resourceType: 'clinical_note', resourceId: created._id, ...ctxOf(req), details: { patientId: patient._id } });
    return created;
  });
  res.status(201).json({ success: true, message: 'Clinical note saved', data: serializeRow(note) });
}));
router.put('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam, body: z.object({ title: z.string().max(200).optional(), content: z.union([z.string().min(1).max(50000), z.record(z.string(), z.unknown())]).optional(), status: z.enum(['draft', 'final', 'amended']).optional(), tags: z.array(z.string().max(50)).max(20).optional() }) }), asyncHandler(async (req, res) => {
  const note = await withTenant(req.scope, async (db) => {
    const updated = await db.c('clinical_notes').updateOne({ _id: req.params.id }, { ...req.body, status: req.body.status || 'amended' });
    if (!updated) throw notFound('Clinical note');
    await auditInTrx(db, req.scope, { action: 'MEDICAL_RECORD_UPDATED', resourceType: 'clinical_note', resourceId: updated._id, ...ctxOf(req), details: { patientId: updated.patientId } });
    return updated;
  });
  res.json({ success: true, message: 'Clinical note updated', data: serializeRow(note) });
}));
router.delete('/:id', authorize('clinical:write'), tenantScope(), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await withTenant(req.scope, async (db) => {
    const col = db.c('clinical_notes');
    const note = await col.findById(req.params.id);
    if (!note) throw notFound('Clinical note');
    await col.deleteOne({ _id: req.params.id });
    await auditInTrx(db, req.scope, { action: 'CLINICAL_NOTE_DELETED', resourceType: 'clinical_note', resourceId: note._id, ...ctxOf(req), details: { patientId: note.patientId } });
  });
  res.json({ success: true, message: 'Clinical note deleted' });
}));
module.exports = router;
