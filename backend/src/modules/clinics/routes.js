'use strict';
const express = require('express');
const { z } = require('zod');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { auditEvent } = require('../../common/middleware/audit');
const { writeAudit } = require('../audit/auditRepository');
const { idParam, email, optionalString } = require('../../common/validation/schemas');
const service = require('./clinicService');

const router = express.Router();
const ctxOf = (req) => ({ requestId: req.id, ip: req.ip });

const validityPeriod = z.object({ startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional(), duration: z.coerce.number().int().min(1).max(120).optional() }).optional();
const clinicBase = {
  name: z.string().trim().min(1).max(200),
  type: optionalString(100),
  registrationNumber: optionalString(100),
  yearOfEstablishment: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  address: optionalString(500),
  city: optionalString(100),
  state: optionalString(100),
  country: optionalString(100),
  zipCode: optionalString(20),
  phone: optionalString(30),
  email: email.optional().nullable().or(z.literal('')),
  website: optionalString(200),
  ownerName: optionalString(120),
  ownerMedicalId: optionalString(100),
  adminName: optionalString(120),
  adminContact: optionalString(30),
  adminEmail: email.optional(),
  adminUsername: optionalString(60),
  adminPassword: z.string().min(8).max(200).optional(),
  tradeLicense: optionalString(200),
  medicalCouncilCert: optionalString(200),
  taxId: optionalString(60),
  accreditation: optionalString(200),
  specialties: z.array(z.string().max(100)).max(50).optional(),
  services: z.array(z.string().max(100)).max(100).optional(),
  operatingHours: optionalString(200),
  staffCount: z.coerce.number().int().min(0).optional().nullable(),
  beds: z.coerce.number().int().min(0).optional().nullable(),
  pharmacyAvailable: z.coerce.boolean().optional(),
  laboratoryAvailable: z.coerce.boolean().optional(),
  paymentMethods: z.array(z.string().max(60)).max(20).optional(),
  bankInfo: optionalString(500),
  isActive: z.boolean().optional(),
  clinicId: optionalString(60),
  validityPeriod,
};
const createSchema = z.object({ ...clinicBase, adminEmail: email, adminName: z.string().trim().min(1).max(120), adminPassword: z.string().min(8).max(200) }).passthrough();
const updateSchema = z.object({ ...clinicBase, name: clinicBase.name.optional() }).passthrough();

router.get('/', authorize('clinics:read'), asyncHandler(async (req, res) => {
  res.json({ success: true, clinics: await service.list(req.auth) });
}));
router.get('/expiring/:days?', authorize('clinics:manage'), validate({ params: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) }), asyncHandler(async (req, res) => {
  const clinics = await service.expiringSoon(req.auth, req.params.days);
  res.json({ success: true, clinics, count: clinics.length, daysFilter: req.params.days });
}));
router.get('/expired/list', authorize('clinics:manage'), asyncHandler(async (req, res) => {
  const clinics = await service.expired(req.auth);
  res.json({ success: true, clinics, count: clinics.length });
}));
router.get('/:id', authorize('clinics:read'), validate({ params: idParam }), auditEvent(writeAudit, 'CLINIC_VIEWED', { resourceType: 'clinic' }), asyncHandler(async (req, res) => {
  res.json({ success: true, clinic: await service.getById(req.auth, req.params.id) });
}));
router.get('/:id/dashboard-data', authorize('reports:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.dashboardData(req.auth, req.params.id) });
}));
router.get('/:id/validity', authorize('clinics:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json({ success: true, validity: await service.validity(req.auth, req.params.id) });
}));
router.post('/', authorize('clinics:manage'), tenantScope(), validate({ body: createSchema }), asyncHandler(async (req, res) => {
  const clinic = await service.create(req.scope, req.body, ctxOf(req));
  res.status(201).json({ success: true, message: 'Clinic created successfully', clinic });
}));
router.put('/:id', authorize('clinics:read'), validate({ params: idParam, body: updateSchema }), asyncHandler(async (req, res) => {
  const clinic = await service.update({ role: req.auth.role, clinicId: req.auth.clinicId, userId: req.auth.userId }, req.params.id, req.body, ctxOf(req));
  res.json({ success: true, message: 'Clinic updated successfully', clinic });
}));
router.put('/:id/renew', authorize('clinics:renew'), validate({ params: idParam, body: z.object({ newEndDate: z.coerce.date().optional(), duration: z.coerce.number().int().min(1).max(120).optional(), reason: optionalString(300) }) }), asyncHandler(async (req, res) => {
  const clinic = await service.renew(req.auth, req.params.id, req.body, ctxOf(req));
  res.json({ success: true, message: 'Clinic validity renewed', clinic });
}));
router.delete('/:id', authorize('clinics:manage'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.remove(req.auth, req.params.id, ctxOf(req));
  res.json({ success: true, message: 'Clinic deactivated and removed' });
}));

module.exports = router;
