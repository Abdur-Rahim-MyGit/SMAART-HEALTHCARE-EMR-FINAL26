'use strict';
const express = require('express');
const { z } = require('zod');
const { withTenant, contains } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { ref } = require('../../common/utils/serialize');
const patients = require('../patients/patientService');
const appointments = require('../appointments/appointmentService');
const practitioners = require('../practitioners/practitionerService');
const clinics = require('../clinics/clinicService');

const router = express.Router();
const query = z.object({ q: z.string().trim().max(100).optional(), limit: z.coerce.number().int().min(1).max(100).default(20) });
const splitName = (full = '') => ({ firstName: full.split(' ')[0], lastName: full.split(' ').slice(1).join(' ') });

router.get('/global', authorize('patients:read'), tenantScope(), validate({ query }), asyncHandler(async (req, res) => {
  const { q, limit } = req.validatedQuery;
  if (!q || q.length < 2) return res.json({ patients: [], appointments: [], doctors: [], clinics: [] });
  const like = contains(q);
  const per = Math.max(1, Math.floor(limit / 4));
  const result = await withTenant(req.scope, async (db) => {
    const idMatches = (await db.c('patient_identifiers').find({ value: like }, { projection: { patientId: 1 }, limit: per })).map((i) => i.patientId);
    const prows = await db.c('patients').find({ $or: [{ fullName: like }, { email: like }, { phone: like }, { _id: { $in: idMatches } }] }, { sort: { createdAt: -1 }, limit: per });
    const nameMatches = (await db.c('patients').find({ fullName: like }, { projection: { _id: 1 }, limit: 200 })).map((p) => p._id);
    const arows = await db.c('appointments').find({ $or: [{ appointmentType: like }, { status: like }, { reason: like }, { providerName: like }, { patientId: { $in: nameMatches } }] }, { sort: { scheduledAt: -1 }, limit: per });
    const drows = await db.c('practitioners').find({ kind: 'doctor', $or: [{ fullName: like }, { email: like }, { specialty: like }, { phone: like }] }, { limit: per });
    const clinicIds = [...new Set([...prows, ...drows].map((r) => r.clinicId))];
    const cmap = Object.fromEntries((await db.c('clinics').find({ _id: { $in: clinicIds } }, { projection: { name: 1 } })).map((c) => [c._id, c]));
    const patientsOut = prows.map((p) => ({ ...patients.serializePatient(p, { clinic: cmap[p.clinicId] }), ...splitName(p.fullName), patientId: p._id }));
    const appointmentsOut = await appointments.hydrate(db, arows);
    const doctorsOut = drows.map((d) => ({ ...practitioners.serialize(d, { clinic: cmap[d.clinicId] }), ...splitName(d.fullName), clinicId: ref(d.clinicId, { name: cmap[d.clinicId]?.name }) }));
    let clinicsOut = [];
    if (req.scope.role === ROLES.SUPER_MASTER_ADMIN) {
      const crows = await db.c('clinics').find({ $or: [{ name: like }, { type: like }, { city: like }, { state: like }, { ownerName: like }, { registrationNumber: like }] }, { limit: per });
      clinicsOut = crows.map((c) => clinics.serializeClinic(c));
    }
    return { patients: patientsOut, appointments: appointmentsOut, doctors: doctorsOut, clinics: clinicsOut };
  });
  res.json(result);
}));

router.get('/suggestions', authorize('patients:read'), tenantScope(), validate({ query }), asyncHandler(async (req, res) => {
  const { q, limit } = req.validatedQuery;
  if (!q || q.length < 2) return res.json({ suggestions: [] });
  const like = contains(q);
  const suggestions = await withTenant(req.scope, async (db) => {
    const [p, d] = await Promise.all([db.c('patients').find({ fullName: like }, { projection: { fullName: 1 }, limit }), db.c('practitioners').find({ fullName: like }, { projection: { fullName: 1, kind: 1 }, limit })]);
    return [...p.map((x) => ({ type: 'patient', id: x._id, label: x.fullName })), ...d.map((x) => ({ type: x.kind, id: x._id, label: x.fullName }))].slice(0, limit);
  });
  res.json({ suggestions });
}));

router.get('/recent', authorize('patients:read'), (_req, res) => res.json({ recent: [] }));
module.exports = router;
