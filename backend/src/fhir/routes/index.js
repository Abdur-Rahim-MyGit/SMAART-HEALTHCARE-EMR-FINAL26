'use strict';
/**
 * FHIR R4 REST API: read + search projections over the internal model, plus a
 * guarded Patient create/update. Every request is authenticated, clinic scoped,
 * permission checked, rate limited and audited by the surrounding app wiring.
 */
const express = require('express');
const { config } = require('../../config');
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { authorize } = require('../../common/middleware/authorize');
const { tenantScope } = require('../../common/middleware/tenant');
const { asyncHandler } = require('../../common/middleware/asyncHandler');
const { idempotency } = require('../../common/middleware/idempotency');
const { AppError } = require('../../common/errors/AppError');
const { auditInTrx } = require('../../modules/audit/auditRepository');
const documents = require('../../modules/documents/documentService');
const patientsSvc = require('../../modules/patients/patientService');
const fhir = require('../mappings');
const { searchParams, inboundPatient, refId } = require('../validators');

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fhirError(res, status, code, message) {
  return res.status(status).type('application/fhir+json').json(fhir.operationOutcome(status >= 500 ? 'fatal' : 'error', code, message));
}
const clinicFilter = (scope) => (q, col = 'clinic_id') => { if (scope.clinicId) q.where(col, scope.clinicId); };
const names = async (trx, table, ids) => Object.fromEntries((await trx(table).whereIn('id', [...new Set(ids.filter(Boolean))]).select('id', 'full_name')).map((r) => [r.id, r.full_name]));
const nameOf = async (trx, table, ids) => (ids.length ? names(trx, table, ids) : {});

/** Resource definitions: table, search filters, row → resource(s). */
const RESOURCES = {
  Patient: { table: 'patients', search: (q, p, trx) => { if (p.name) q.whereILike('full_name', `%${p.name}%`); if (p.identifier) q.whereIn('id', trx('patient_identifiers').select('patient_id').where('value', p.identifier)); if (p.organization) q.where('clinic_id', p.organization); }, map: async (trx, rows) => { const ids = await trx('patient_identifiers').whereIn('patient_id', rows.map((r) => r.id)); const clinics = Object.fromEntries((await trx('clinics').whereIn('id', rows.map((r) => r.clinic_id)).select('id', 'name')).map((c) => [c.id, c])); const by = {}; for (const i of ids) (by[i.patient_id] = by[i.patient_id] || []).push(i); return rows.map((r) => fhir.patient(r, by[r.id] || [], clinics[r.clinic_id])); } },
  Organization: { table: 'clinics', tenantColumn: 'id', search: (q, p) => { if (p.name) q.whereILike('name', `%${p.name}%`); }, map: async (_t, rows) => rows.map(fhir.organization) },
  Practitioner: { table: 'practitioners', search: (q, p) => { if (p.name) q.whereILike('full_name', `%${p.name}%`); if (p.organization) q.where('clinic_id', p.organization); }, map: async (trx, rows) => { const clinics = Object.fromEntries((await trx('clinics').whereIn('id', rows.map((r) => r.clinic_id)).select('id', 'name')).map((c) => [c.id, c])); return rows.map((r) => fhir.practitioner(r, clinics[r.clinic_id])); } },
  Appointment: { table: 'appointments', patientCol: 'patient_id', search: (q, p) => { if (p.status) q.where('status', p.status); if (p.date) q.whereRaw('scheduled_at::date = ?', [p.date.replace(/^(eq)?/, '')]); }, orderBy: 'scheduled_at', map: async (trx, rows) => { const pn = await nameOf(trx, 'patients', rows.map((r) => r.patient_id)); const dn = await nameOf(trx, 'practitioners', rows.map((r) => r.practitioner_id)); return rows.map((r) => fhir.appointment(r, pn[r.patient_id], dn[r.practitioner_id])); } },
  Encounter: { table: 'encounters', patientCol: 'patient_id', search: (q, p) => { if (p.status) q.where('status', p.status); }, orderBy: 'started_at', map: async (trx, rows) => { const pn = await nameOf(trx, 'patients', rows.map((r) => r.patient_id)); const dn = await nameOf(trx, 'practitioners', rows.map((r) => r.practitioner_id)); return rows.map((r) => fhir.encounter(r, pn[r.patient_id], dn[r.practitioner_id])); } },
  Condition: { table: 'clinical_conditions', patientCol: 'patient_id', search: (q, p) => { if (p.encounter) q.where('encounter_id', p.encounter); }, map: async (trx, rows) => { const pn = await nameOf(trx, 'patients', rows.map((r) => r.patient_id)); return rows.map((r) => fhir.condition(r, pn[r.patient_id])); } },
  Observation: { table: 'vitals', patientCol: 'patient_id', search: (q, p) => { if (p.encounter) q.where('encounter_id', p.encounter); }, orderBy: 'recorded_at', map: async (trx, rows) => { const pn = await nameOf(trx, 'patients', rows.map((r) => r.patient_id)); return rows.flatMap((r) => fhir.observationsFromVitals(r, pn[r.patient_id])); }, expands: true },
  AllergyIntolerance: { table: 'allergies', patientCol: 'patient_id', search: () => {}, map: async (trx, rows) => { const pn = await nameOf(trx, 'patients', rows.map((r) => r.patient_id)); return rows.map((r) => fhir.allergyIntolerance(r, pn[r.patient_id])); } },
  Medication: { table: 'medications', patientCol: 'patient_id', search: (q, p) => { if (p.status) q.where('status', p.status); }, map: async (_t, rows) => rows.map(fhir.medication) },
  MedicationRequest: { table: 'prescriptions', patientCol: 'patient_id', search: (q, p) => { if (p.encounter) q.where('encounter_id', p.encounter); if (p.status) q.where('status', p.status); }, orderBy: 'prescribed_at', map: async (trx, rows) => { const pn = await nameOf(trx, 'patients', rows.map((r) => r.patient_id)); const dn = await nameOf(trx, 'practitioners', rows.map((r) => r.practitioner_id)); const items = await trx('prescription_items').whereIn('prescription_id', rows.map((r) => r.id)).orderBy('sort_order'); const by = {}; for (const i of items) (by[i.prescription_id] = by[i.prescription_id] || []).push(i); return rows.flatMap((r) => fhir.medicationRequests(r, by[r.id] || [], pn[r.patient_id], dn[r.practitioner_id])); }, expands: true, itemTable: 'prescription_items' },
  DiagnosticReport: { table: 'lab_results', patientCol: 'patient_id', search: (q, p) => { if (p.status) q.where('status', p.status); }, orderBy: 'result_date', map: async (trx, rows) => { const pn = await nameOf(trx, 'patients', rows.map((r) => r.patient_id)); const orders = Object.fromEntries((await trx('lab_orders').whereIn('id', rows.map((r) => r.lab_order_id))).map((o) => [o.id, o])); return rows.map((r) => fhir.diagnosticReport(r, orders[r.lab_order_id], pn[r.patient_id])); } },
  DocumentReference: { table: 'documents', patientCol: 'patient_id', search: (q, p) => { if (p.encounter) q.where('encounter_id', p.encounter); q.where('status', 'available'); }, map: async (trx, rows) => { const pn = await nameOf(trx, 'patients', rows.map((r) => r.patient_id)); const out = []; for (const r of rows) { const a = await documents.accessUrlFor(r); out.push(fhir.documentReference(r, pn[r.patient_id], a && a.url)); } return out; } },
  ImagingStudy: { table: 'imaging_studies', patientCol: 'patient_id', search: (q, p) => { if (p.encounter) q.where('encounter_id', p.encounter); }, orderBy: 'study_date', map: async (trx, rows) => { const pn = await nameOf(trx, 'patients', rows.map((r) => r.patient_id)); return rows.map((r) => fhir.imagingStudy(r, pn[r.patient_id])); } },
  ServiceRequest: { table: 'lab_orders', patientCol: 'patient_id', search: (q, p) => { if (p.status) q.where('status', p.status); }, orderBy: 'ordered_at', map: async (trx, rows) => { const pn = await nameOf(trx, 'patients', rows.map((r) => r.patient_id)); return rows.map((r) => fhir.serviceRequest(r, 'Laboratory', pn[r.patient_id])); } },
  Procedure: { table: 'encounters', patientCol: 'patient_id', search: (q) => { q.where('status', 'Completed'); }, orderBy: 'started_at', map: async (trx, rows) => { const pn = await nameOf(trx, 'patients', rows.map((r) => r.patient_id)); const dn = await nameOf(trx, 'practitioners', rows.map((r) => r.practitioner_id)); return rows.map((r) => fhir.procedure(r, pn[r.patient_id], dn[r.practitioner_id])); } },
};

router.get('/metadata', (_req, res) => {
  const env = config();
  res.type('application/fhir+json').json({ resourceType: 'CapabilityStatement', status: 'active', date: new Date().toISOString(), kind: 'instance', software: { name: 'SMAART Healthcare EMR', version: '2.0.0' }, implementation: { description: 'SMAART EMR FHIR R4 facade', url: env.FHIR_BASE_URL }, fhirVersion: '4.0.1', format: ['application/fhir+json', 'json'], rest: [{ mode: 'server', security: { cors: true, service: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/restful-security-service', code: 'OAuth' }] }], description: 'Bearer access token issued by the EMR. Clinic isolation is enforced server side.' }, resource: Object.keys(RESOURCES).map((type) => ({ type, interaction: [{ code: 'read' }, { code: 'search-type' }, ...(type === 'Patient' ? [{ code: 'create' }, { code: 'update' }] : [])], searchParam: [{ name: '_count', type: 'number' }, { name: '_page', type: 'number' }, ...(RESOURCES[type].patientCol ? [{ name: 'patient', type: 'reference' }] : []), { name: 'status', type: 'token' }, { name: 'name', type: 'string' }, { name: 'identifier', type: 'token' }] })) }] });
});

router.get('/:type', authorize('fhir:read'), tenantScope(), asyncHandler(async (req, res) => {
  const def = RESOURCES[req.params.type];
  if (!def) return fhirError(res, 404, 'not-supported', `Resource type ${req.params.type} is not supported`);
  const parsed = searchParams.safeParse(req.query);
  if (!parsed.success) return fhirError(res, 400, 'invalid', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const p = parsed.data;
  const patientId = p.patient || (p.subject && refId(p.subject));
  if (patientId && !UUID.test(patientId)) return fhirError(res, 400, 'invalid', 'patient must be a UUID');
  const env = config();
  const result = await withTenant(req.scope, async (trx) => {
    let q = trx(def.table).whereNull('deleted_at').modify(clinicFilter(req.scope), def.tenantColumn || 'clinic_id');
    if (patientId) { if (!def.patientCol) return fhirError(res, 400, 'invalid', 'patient search is not supported for this resource'); q.where(def.patientCol, patientId); }
    def.search(q, p, trx);
    if (p._lastUpdated) { const m = /^(gt|ge|lt|le)?(.+)$/.exec(p._lastUpdated); const op = { gt: '>', ge: '>=', lt: '<', le: '<=' }[m[1]] || '>='; q.where('updated_at', op, new Date(m[2])); }
    const total = Number((await q.clone().count({ c: '*' }))[0].c);
    if (p._summary === 'count') return { total, resources: [] };
    const rows = await q.orderBy(def.orderBy || 'created_at', 'desc').limit(p._count).offset((p._page - 1) * p._count);
    const resources = await def.map(trx, rows);
    await auditInTrx(trx, req.scope, { action: 'FHIR_RESOURCE_ACCESSED', resourceType: req.params.type, resourceId: null, requestId: req.id, ip: req.ip, details: { interaction: 'search', count: resources.length, patient: patientId } });
    return { total, resources, hasMore: (p._page - 1) * p._count + rows.length < total };
  }, getKnex());
  if (res.headersSent) return;
  const base = env.FHIR_BASE_URL.replace(/\/$/, '');
  const self = `${base}/${req.params.type}${req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''}`;
  const next = result.hasMore ? `${base}/${req.params.type}?${new URLSearchParams({ ...req.query, _page: String(p._page + 1), _count: String(p._count) })}` : undefined;
  res.type('application/fhir+json').json(fhir.bundle(result.resources, { total: result.total, baseUrl: base, selfUrl: self, nextUrl: next }));
}));

router.get('/:type/:id', authorize('fhir:read'), tenantScope(), asyncHandler(async (req, res) => {
  const def = RESOURCES[req.params.type];
  if (!def) return fhirError(res, 404, 'not-supported', `Resource type ${req.params.type} is not supported`);
  // Expanded resources use derived ids (vitals-id-suffix / prescription item id).
  let id = req.params.id;
  let pick = null;
  if (req.params.type === 'Observation') { const m = /^([0-9a-f-]{36})-(.+)$/i.exec(id); if (!m) return fhirError(res, 404, 'not-found', 'Observation not found'); id = m[1]; pick = (list) => list.find((r) => r.id === req.params.id); }
  if (!UUID.test(id)) return fhirError(res, 400, 'invalid', 'id must be a UUID');
  const resource = await withTenant(req.scope, async (trx) => {
    let row;
    if (req.params.type === 'MedicationRequest') {
      const item = await trx('prescription_items').where({ id }).first();
      if (!item) return null;
      row = await trx('prescriptions').where({ id: item.prescription_id }).whereNull('deleted_at').modify(clinicFilter(req.scope)).first();
      if (!row) return null;
      const list = await def.map(trx, [row]);
      return list.find((r) => r.id === id) || null;
    }
    row = await trx(def.table).where({ id }).whereNull('deleted_at').modify(clinicFilter(req.scope), def.tenantColumn || 'clinic_id').first();
    if (!row) return null;
    const list = await def.map(trx, [row]);
    const found = pick ? pick(list) : list[0];
    if (found) await auditInTrx(trx, req.scope, { action: 'FHIR_RESOURCE_ACCESSED', resourceType: req.params.type, resourceId: req.params.id, requestId: req.id, ip: req.ip, details: { interaction: 'read' } });
    return found || null;
  }, getKnex());
  if (!resource) return fhirError(res, 404, 'not-found', `${req.params.type}/${req.params.id} not found`);
  res.type('application/fhir+json').json(resource);
}));

function patientFromFhir(r) {
  const n = r.name[0];
  const full = n.text || [...(n.given || []), n.family].filter(Boolean).join(' ');
  const phone = (r.telecom || []).find((t) => t.system === 'phone');
  const email = (r.telecom || []).find((t) => t.system === 'email');
  const addr = (r.address || [])[0];
  return { fullName: full, gender: r.gender, dateOfBirth: r.birthDate, phone: phone && phone.value, email: email && email.value, address: addr ? { street: (addr.line || []).join(', '), city: addr.city, state: addr.state, zipCode: addr.postalCode, country: addr.country } : undefined, clinicId: r.managingOrganization ? refId(r.managingOrganization.reference) : undefined, uhid: (r.identifier || []).find((i) => (i.system || '').endsWith('/uhid'))?.value, status: r.active === false ? 'inactive' : 'active' };
}

router.post('/Patient', authorize('fhir:write'), tenantScope(), idempotency(), asyncHandler(async (req, res) => {
  const parsed = inboundPatient.safeParse(req.body);
  if (!parsed.success) return fhirError(res, 400, 'invalid', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  try {
    const input = patientFromFhir(parsed.data);
    if (req.scope.role !== 'super_master_admin') delete input.clinicId; // clinic admins always write to their own clinic
    const created = await patientsSvc.create(req.scope, input, { requestId: req.id, ip: req.ip });
    const resource = await withTenant(req.scope, async (trx) => { const row = await trx('patients').where({ id: created.id }).first(); return (await RESOURCES.Patient.map(trx, [row]))[0]; }, getKnex());
    res.status(201).location(`${config().FHIR_BASE_URL}/Patient/${created.id}`).type('application/fhir+json').json(resource);
  } catch (err) {
    if (err instanceof AppError) return fhirError(res, err.status, err.status === 403 ? 'forbidden' : 'invalid', err.message);
    throw err;
  }
}));

router.put('/Patient/:id', authorize('fhir:write'), tenantScope(), idempotency(), asyncHandler(async (req, res) => {
  if (!UUID.test(req.params.id)) return fhirError(res, 400, 'invalid', 'id must be a UUID');
  const parsed = inboundPatient.safeParse(req.body);
  if (!parsed.success) return fhirError(res, 400, 'invalid', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  try {
    const input = patientFromFhir(parsed.data);
    delete input.clinicId;
    await patientsSvc.update(req.scope, req.params.id, input, { requestId: req.id, ip: req.ip });
    const resource = await withTenant(req.scope, async (trx) => { const row = await trx('patients').where({ id: req.params.id }).first(); return (await RESOURCES.Patient.map(trx, [row]))[0]; }, getKnex());
    res.type('application/fhir+json').json(resource);
  } catch (err) {
    if (err instanceof AppError) return fhirError(res, err.status, err.status === 404 ? 'not-found' : err.status === 403 ? 'forbidden' : 'invalid', err.message);
    throw err;
  }
}));

router.all('/:type/:id?', (_req, res) => fhirError(res, 405, 'not-supported', 'Interaction not supported'));
module.exports = router;
