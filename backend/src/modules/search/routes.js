'use strict';
const express = require('express');
const { z } = require('zod');
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { ROLES } = require('../../common/security/rbac');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { likePattern } = require('../../common/validation/schemas');
const { serializeRow, ref } = require('../../common/utils/serialize');
const patients = require('../patients/patientService');
const appointments = require('../appointments/appointmentService');
const practitioners = require('../practitioners/practitionerService');
const clinics = require('../clinics/clinicService');

const router = express.Router();
const query = z.object({ q: z.string().trim().max(100).optional(), limit: z.coerce.number().int().min(1).max(100).default(20) });

router.get('/global', authorize('patients:read'), tenantScope(), validate({ query }), asyncHandler(async (req, res) => {
  const { q, limit } = req.validatedQuery;
  if (!q || q.length < 2) return res.json({ patients: [], appointments: [], doctors: [], clinics: [] });
  const like = likePattern(q);
  const per = Math.max(1, Math.floor(limit / 4));
  const result = await withTenant(req.scope, async (trx) => {
    const cf = (q2, col = 'clinic_id') => { if (req.scope.clinicId) q2.where(col, req.scope.clinicId); };
    const prows = await trx('patients').whereNull('deleted_at').modify(cf).where((b) => b.whereILike('full_name', like).orWhereILike('email', like).orWhereILike('phone', like).orWhereIn('id', trx('patient_identifiers').select('patient_id').whereILike('value', like))).orderBy('created_at', 'desc').limit(per);
    const cmap = Object.fromEntries((await trx('clinics').whereIn('id', prows.map((p) => p.clinic_id)).select('id', 'name')).map((c) => [c.id, c]));
    const patientsOut = prows.map((p) => ({ ...patients.serializePatient(p, { clinic: cmap[p.clinic_id] }), firstName: p.full_name.split(' ')[0], lastName: p.full_name.split(' ').slice(1).join(' '), patientId: p.id }));
    const arows = await trx('appointments').whereNull('deleted_at').modify(cf).where((b) => b.whereILike('appointment_type', like).orWhereILike('status', like).orWhereILike('reason', like).orWhereILike('provider_name', like).orWhereIn('patient_id', trx('patients').select('id').whereILike('full_name', like))).orderBy('scheduled_at', 'desc').limit(per);
    const appointmentsOut = await appointments.hydrate(trx, arows);
    const drows = await trx('practitioners').whereNull('deleted_at').modify(cf).where('kind', 'doctor').where((b) => b.whereILike('full_name', like).orWhereILike('email', like).orWhereILike('specialty', like).orWhereILike('phone', like)).limit(per);
    const doctorsOut = drows.map((d) => ({ ...practitioners.serialize(d, { clinic: cmap[d.clinic_id] }), firstName: d.full_name.split(' ')[0], lastName: d.full_name.split(' ').slice(1).join(' '), clinicId: ref(d.clinic_id, { name: cmap[d.clinic_id]?.name }) }));
    let clinicsOut = [];
    if (req.scope.role === ROLES.SUPER_MASTER_ADMIN) {
      const crows = await trx('clinics').whereNull('deleted_at').where((b) => b.whereILike('name', like).orWhereILike('type', like).orWhereILike('city', like).orWhereILike('state', like).orWhereILike('owner_name', like).orWhereILike('registration_number', like)).limit(per);
      clinicsOut = crows.map((c) => clinics.serializeClinic(c));
    }
    return { patients: patientsOut, appointments: appointmentsOut, doctors: doctorsOut, clinics: clinicsOut };
  }, getKnex());
  res.json(result);
}));

router.get('/suggestions', authorize('patients:read'), tenantScope(), validate({ query }), asyncHandler(async (req, res) => {
  const { q, limit } = req.validatedQuery;
  if (!q || q.length < 2) return res.json({ suggestions: [] });
  const like = likePattern(q);
  const suggestions = await withTenant(req.scope, async (trx) => {
    const cf = (q2) => { if (req.scope.clinicId) q2.where('clinic_id', req.scope.clinicId); };
    const p = await trx('patients').whereNull('deleted_at').modify(cf).whereILike('full_name', like).select('id', 'full_name').limit(limit);
    const d = await trx('practitioners').whereNull('deleted_at').modify(cf).whereILike('full_name', like).select('id', 'full_name', 'kind').limit(limit);
    return [...p.map((x) => ({ type: 'patient', id: x.id, label: x.full_name })), ...d.map((x) => ({ type: x.kind, id: x.id, label: x.full_name }))].slice(0, limit);
  }, getKnex());
  res.json({ suggestions });
}));

router.get('/recent', authorize('patients:read'), (_req, res) => res.json({ recent: [] }));
void serializeRow;
module.exports = router;
