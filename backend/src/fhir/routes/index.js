'use strict';
/**
 * FHIR R4 REST API: read + search projections over the internal model, plus a
 * guarded Patient create/update. Every request is authenticated, clinic scoped,
 * permission checked, rate limited and audited by the surrounding app wiring.
 */
const express = require('express');
const { config } = require('../../config');
const { withTenant, contains } = require('../../infrastructure/mongodb/tenant');
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
const nameOf = async (db, collection, ids) => {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return {};
  return Object.fromEntries((await db.c(collection).find({ _id: { $in: list } }, { projection: { fullName: 1 } })).map((r) => [r._id, r.fullName]));
};
const clinicsOf = async (db, rows) => Object.fromEntries((await db.c('clinics').find({ _id: { $in: [...new Set(rows.map((r) => r.clinicId))] } }, { projection: { name: 1 } })).map((c) => [c._id, c]));
const dayRange = (d) => { const start = new Date(`${d.replace(/^(eq)?/, '')}T00:00:00.000Z`); return { $gte: start, $lt: new Date(start.getTime() + 86400000) }; };

/** Resource definitions: collection, search filters, documents → resource(s). */
const RESOURCES = {
  Patient: { collection: 'patients', search: async (f, p, db) => { if (p.name) f.fullName = contains(p.name); if (p.identifier) f._id = { $in: (await db.c('patient_identifiers').find({ value: p.identifier }, { projection: { patientId: 1 } })).map((i) => i.patientId) }; if (p.organization) f.clinicId = p.organization; }, map: async (db, rows) => { const ids = await db.c('patient_identifiers').find({ patientId: { $in: rows.map((r) => r._id) } }); const clinics = await clinicsOf(db, rows); const by = {}; for (const i of ids) (by[i.patientId] = by[i.patientId] || []).push(i); return rows.map((r) => fhir.patient(r, by[r._id] || [], clinics[r.clinicId])); } },
  Organization: { collection: 'clinics', search: async (f, p) => { if (p.name) f.name = contains(p.name); }, map: async (_db, rows) => rows.map(fhir.organization) },
  Practitioner: { collection: 'practitioners', search: async (f, p) => { if (p.name) f.fullName = contains(p.name); if (p.organization) f.clinicId = p.organization; }, map: async (db, rows) => { const clinics = await clinicsOf(db, rows); return rows.map((r) => fhir.practitioner(r, clinics[r.clinicId])); } },
  Appointment: { collection: 'appointments', patient: true, search: async (f, p) => { if (p.status) f.status = p.status; if (p.date) f.scheduledAt = dayRange(p.date); }, sort: 'scheduledAt', map: async (db, rows) => { const pn = await nameOf(db, 'patients', rows.map((r) => r.patientId)); const dn = await nameOf(db, 'practitioners', rows.map((r) => r.practitionerId)); return rows.map((r) => fhir.appointment(r, pn[r.patientId], dn[r.practitionerId])); } },
  Encounter: { collection: 'encounters', patient: true, search: async (f, p) => { if (p.status) f.status = p.status; }, sort: 'startedAt', map: async (db, rows) => { const pn = await nameOf(db, 'patients', rows.map((r) => r.patientId)); const dn = await nameOf(db, 'practitioners', rows.map((r) => r.practitionerId)); return rows.map((r) => fhir.encounter(r, pn[r.patientId], dn[r.practitionerId])); } },
  Condition: { collection: 'clinical_conditions', patient: true, search: async (f, p) => { if (p.encounter) f.encounterId = p.encounter; }, map: async (db, rows) => { const pn = await nameOf(db, 'patients', rows.map((r) => r.patientId)); return rows.map((r) => fhir.condition(r, pn[r.patientId])); } },
  Observation: { collection: 'vitals', patient: true, search: async (f, p) => { if (p.encounter) f.encounterId = p.encounter; }, sort: 'recordedAt', map: async (db, rows) => { const pn = await nameOf(db, 'patients', rows.map((r) => r.patientId)); return rows.flatMap((r) => fhir.observationsFromVitals(r, pn[r.patientId])); }, expands: true },
  AllergyIntolerance: { collection: 'allergies', patient: true, search: async () => {}, map: async (db, rows) => { const pn = await nameOf(db, 'patients', rows.map((r) => r.patientId)); return rows.map((r) => fhir.allergyIntolerance(r, pn[r.patientId])); } },
  Medication: { collection: 'medications', patient: true, search: async (f, p) => { if (p.status) f.status = p.status; }, map: async (_db, rows) => rows.map(fhir.medication) },
  MedicationRequest: { collection: 'prescriptions', patient: true, search: async (f, p) => { if (p.encounter) f.encounterId = p.encounter; if (p.status) f.status = p.status; }, sort: 'prescribedAt', map: async (db, rows) => { const pn = await nameOf(db, 'patients', rows.map((r) => r.patientId)); const dn = await nameOf(db, 'practitioners', rows.map((r) => r.practitionerId)); return rows.flatMap((r) => fhir.medicationRequests(r, r.medications || [], pn[r.patientId], dn[r.practitionerId])); }, expands: true },
  DiagnosticReport: { collection: 'lab_results', patient: true, search: async (f, p) => { if (p.status) f.status = p.status; }, sort: 'resultDate', map: async (db, rows) => { const pn = await nameOf(db, 'patients', rows.map((r) => r.patientId)); const orders = Object.fromEntries((await db.c('lab_orders').find({ _id: { $in: rows.map((r) => r.labOrderId).filter(Boolean) } })).map((o) => [o._id, o])); return rows.map((r) => fhir.diagnosticReport(r, orders[r.labOrderId], pn[r.patientId])); } },
  DocumentReference: { collection: 'documents', patient: true, search: async (f, p) => { if (p.encounter) f.encounterId = p.encounter; f.status = 'available'; }, map: async (db, rows) => { const pn = await nameOf(db, 'patients', rows.map((r) => r.patientId)); const out = []; for (const r of rows) { const a = await documents.accessUrlFor(r); out.push(fhir.documentReference(r, pn[r.patientId], a && a.url)); } return out; } },
  ImagingStudy: { collection: 'imaging_studies', patient: true, search: async (f, p) => { if (p.encounter) f.encounterId = p.encounter; }, sort: 'studyDate', map: async (db, rows) => { const pn = await nameOf(db, 'patients', rows.map((r) => r.patientId)); return rows.map((r) => fhir.imagingStudy(r, pn[r.patientId])); } },
  ServiceRequest: { collection: 'lab_orders', patient: true, search: async (f, p) => { if (p.status) f.status = p.status; }, sort: 'orderedAt', map: async (db, rows) => { const pn = await nameOf(db, 'patients', rows.map((r) => r.patientId)); return rows.map((r) => fhir.serviceRequest(r, 'Laboratory', pn[r.patientId])); } },
  Procedure: { collection: 'encounters', patient: true, search: async (f) => { f.status = 'Completed'; }, sort: 'startedAt', map: async (db, rows) => { const pn = await nameOf(db, 'patients', rows.map((r) => r.patientId)); const dn = await nameOf(db, 'practitioners', rows.map((r) => r.practitionerId)); return rows.map((r) => fhir.procedure(r, pn[r.patientId], dn[r.practitionerId])); } },
};

router.get('/metadata', (_req, res) => {
  const env = config();
  res.type('application/fhir+json').json({ resourceType: 'CapabilityStatement', status: 'active', date: new Date().toISOString(), kind: 'instance', software: { name: 'SMAART Healthcare EMR', version: '2.0.0' }, implementation: { description: 'SMAART EMR FHIR R4 facade', url: env.FHIR_BASE_URL }, fhirVersion: '4.0.1', format: ['application/fhir+json', 'json'], rest: [{ mode: 'server', security: { cors: true, service: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/restful-security-service', code: 'OAuth' }] }], description: 'Bearer access token issued by the EMR. Clinic isolation is enforced server side.' }, resource: Object.keys(RESOURCES).map((type) => ({ type, interaction: [{ code: 'read' }, { code: 'search-type' }, ...(type === 'Patient' ? [{ code: 'create' }, { code: 'update' }] : [])], searchParam: [{ name: '_count', type: 'number' }, { name: '_page', type: 'number' }, ...(RESOURCES[type].patient ? [{ name: 'patient', type: 'reference' }] : []), { name: 'status', type: 'token' }, { name: 'name', type: 'string' }, { name: 'identifier', type: 'token' }] })) }] });
});

router.get('/:type', authorize('fhir:read'), tenantScope(), asyncHandler(async (req, res) => {
  const def = RESOURCES[req.params.type];
  if (!def) return fhirError(res, 404, 'not-supported', `Resource type ${req.params.type} is not supported`);
  const parsed = searchParams.safeParse(req.query);
  if (!parsed.success) return fhirError(res, 400, 'invalid', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const p = parsed.data;
  const patientId = p.patient || (p.subject && refId(p.subject));
  if (patientId && !UUID.test(patientId)) return fhirError(res, 400, 'invalid', 'patient must be a UUID');
  if (patientId && !def.patient) return fhirError(res, 400, 'invalid', 'patient search is not supported for this resource');
  const env = config();
  const result = await withTenant(req.scope, async (db) => {
    const filter = {};
    if (patientId) filter.patientId = patientId;
    await def.search(filter, p, db);
    if (p._lastUpdated) { const m = /^(gt|ge|lt|le)?(.+)$/.exec(p._lastUpdated); const op = { gt: '$gt', ge: '$gte', lt: '$lt', le: '$lte' }[m[1]] || '$gte'; filter.updatedAt = { [op]: new Date(m[2]) }; }
    const col = db.c(def.collection);
    const total = await col.count(filter);
    if (p._summary === 'count') return { total, resources: [] };
    const rows = await col.find(filter, { sort: { [def.sort || 'createdAt']: -1 }, limit: p._count, skip: (p._page - 1) * p._count });
    const resources = await def.map(db, rows);
    await auditInTrx(db, req.scope, { action: 'FHIR_RESOURCE_ACCESSED', resourceType: req.params.type, resourceId: null, requestId: req.id, ip: req.ip, details: { interaction: 'search', count: resources.length, patient: patientId } });
    return { total, resources, hasMore: (p._page - 1) * p._count + rows.length < total };
  });
  const base = env.FHIR_BASE_URL.replace(/\/$/, '');
  const self = `${base}/${req.params.type}${req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''}`;
  const next = result.hasMore ? `${base}/${req.params.type}?${new URLSearchParams({ ...req.query, _page: String(p._page + 1), _count: String(p._count) })}` : undefined;
  res.type('application/fhir+json').json(fhir.bundle(result.resources, { total: result.total, baseUrl: base, selfUrl: self, nextUrl: next }));
}));

router.get('/:type/:id', authorize('fhir:read'), tenantScope(), asyncHandler(async (req, res) => {
  const def = RESOURCES[req.params.type];
  if (!def) return fhirError(res, 404, 'not-supported', `Resource type ${req.params.type} is not supported`);
  // Expanded resources use derived ids (vitals-id-suffix / embedded medication id).
  let id = req.params.id;
  let pick = null;
  if (req.params.type === 'Observation') { const m = /^([0-9a-f-]{36})-(.+)$/i.exec(id); if (!m) return fhirError(res, 404, 'not-found', 'Observation not found'); id = m[1]; pick = (list) => list.find((r) => r.id === req.params.id); }
  if (!UUID.test(id)) return fhirError(res, 400, 'invalid', 'id must be a UUID');
  const resource = await withTenant(req.scope, async (db) => {
    let row;
    if (req.params.type === 'MedicationRequest') {
      row = await db.c('prescriptions').findOne({ 'medications._id': id });
      if (!row) return null;
      const list = await def.map(db, [row]);
      const found = list.find((r) => r.id === id) || null;
      if (found) await auditInTrx(db, req.scope, { action: 'FHIR_RESOURCE_ACCESSED', resourceType: req.params.type, resourceId: id, requestId: req.id, ip: req.ip, details: { interaction: 'read' } });
      return found;
    }
    row = await db.c(def.collection).findById(id);
    if (!row) return null;
    const list = await def.map(db, [row]);
    const found = pick ? pick(list) : list[0];
    if (found) await auditInTrx(db, req.scope, { action: 'FHIR_RESOURCE_ACCESSED', resourceType: req.params.type, resourceId: req.params.id, requestId: req.id, ip: req.ip, details: { interaction: 'read' } });
    return found || null;
  });
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
const readPatient = (scope, id) => withTenant(scope, async (db) => { const row = await db.c('patients').findById(id); return row ? (await RESOURCES.Patient.map(db, [row]))[0] : null; });

router.post('/Patient', authorize('fhir:write'), tenantScope(), idempotency(), asyncHandler(async (req, res) => {
  const parsed = inboundPatient.safeParse(req.body);
  if (!parsed.success) return fhirError(res, 400, 'invalid', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  try {
    const input = patientFromFhir(parsed.data);
    if (req.scope.role !== 'super_master_admin') delete input.clinicId; // clinic admins always write to their own clinic
    const created = await patientsSvc.create(req.scope, input, { requestId: req.id, ip: req.ip });
    const resource = await readPatient(req.scope, created._id || created.id);
    res.status(201).location(`${config().FHIR_BASE_URL}/Patient/${created._id || created.id}`).type('application/fhir+json').json(resource);
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
    res.type('application/fhir+json').json(await readPatient(req.scope, req.params.id));
  } catch (err) {
    if (err instanceof AppError) return fhirError(res, err.status, err.status === 404 ? 'not-found' : err.status === 403 ? 'forbidden' : 'invalid', err.message);
    throw err;
  }
}));

router.all('/:type/:id?', (_req, res) => fhirError(res, 405, 'not-supported', 'Interaction not supported'));
module.exports = router;
