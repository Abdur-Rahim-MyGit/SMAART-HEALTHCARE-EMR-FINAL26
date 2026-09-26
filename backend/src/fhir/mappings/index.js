'use strict';
/**
 * MongoDB document → HL7 FHIR R4 resource mappers. Pure functions; the canonical
 * data stays in the internal model, FHIR is a projection.
 */
const { config } = require('../../config');

const ref = (type, id, display) => (id ? { reference: `${type}/${id}`, ...(display ? { display } : {}) } : undefined);
const iso = (d) => (d ? new Date(d).toISOString() : undefined);
const date = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
const clean = (o) => JSON.parse(JSON.stringify(o));
const meta = (row) => ({ versionId: String(row.version || 1), lastUpdated: iso(row.updatedAt || row.createdAt) });
const GENDER = { male: 'male', female: 'female', other: 'other', unknown: 'unknown' };

function patient(p, identifiers = [], clinic) {
  const names = (p.fullName || '').trim().split(/\s+/);
  return clean({
    resourceType: 'Patient', id: p._id, meta: meta(p), active: p.status === 'active',
    identifier: [{ system: `${config().FHIR_BASE_URL}/identifiers/internal`, value: p._id }, ...identifiers.filter((i) => i.system !== 'legacy_mongo').map((i) => ({ system: `${config().FHIR_BASE_URL}/identifiers/${i.system}`, value: i.value }))],
    name: [{ use: 'official', text: p.fullName, family: names.length > 1 ? names[names.length - 1] : undefined, given: names.length > 1 ? names.slice(0, -1) : names }],
    telecom: [p.phone && { system: 'phone', value: p.phone }, p.email && { system: 'email', value: p.email }].filter(Boolean),
    gender: GENDER[String(p.gender || '').toLowerCase()] || 'unknown', birthDate: date(p.dateOfBirth),
    address: p.address && (p.address.street || p.address.city || p.city) ? [{ line: [p.address.street].filter(Boolean), city: p.address.city || p.city, state: p.address.state, postalCode: p.address.zipCode || p.pinCode, country: p.address.country }] : undefined,
    contact: p.emergencyContact && p.emergencyContact.name ? [{ relationship: [{ text: p.emergencyContact.relationship }], name: { text: p.emergencyContact.name }, telecom: p.emergencyContact.phone ? [{ system: 'phone', value: p.emergencyContact.phone }] : undefined }] : undefined,
    managingOrganization: ref('Organization', p.clinicId, clinic && clinic.name),
  });
}

function organization(c) {
  return clean({ resourceType: 'Organization', id: c._id, meta: meta(c), active: c.isActive, identifier: c.registrationNumber ? [{ system: `${config().FHIR_BASE_URL}/identifiers/registration`, value: c.registrationNumber }] : undefined, type: [{ text: c.type || 'Clinic' }], name: c.name, telecom: [c.phone && { system: 'phone', value: c.phone }, c.email && { system: 'email', value: c.email }, c.website && { system: 'url', value: c.website }].filter(Boolean), address: [{ line: [c.address].filter(Boolean), city: c.city, state: c.state, postalCode: c.zipCode, country: c.country }] });
}

function practitioner(d, clinic) {
  const names = (d.fullName || '').trim().split(/\s+/);
  return clean({ resourceType: 'Practitioner', id: d._id, meta: meta(d), active: d.isActive, identifier: d.licenseNumber ? [{ system: `${config().FHIR_BASE_URL}/identifiers/license`, value: d.licenseNumber }] : undefined, name: [{ text: d.fullName, family: names.length > 1 ? names[names.length - 1] : undefined, given: names.length > 1 ? names.slice(0, -1) : names }], telecom: [d.phone && { system: 'phone', value: d.phone }, d.email && { system: 'email', value: d.email }].filter(Boolean), qualification: [d.qualification && { code: { text: d.qualification } }, d.specialty && { code: { text: d.specialty } }].filter(Boolean), extension: [{ url: `${config().FHIR_BASE_URL}/StructureDefinition/practitioner-kind`, valueCode: d.kind }, clinic && { url: `${config().FHIR_BASE_URL}/StructureDefinition/organization`, valueReference: ref('Organization', d.clinicId, clinic.name) }].filter(Boolean) });
}

const APPT_STATUS = { Scheduled: 'booked', Confirmed: 'booked', Completed: 'fulfilled', Cancelled: 'cancelled', 'No Show': 'noshow' };
function appointment(a, patientName, doctorName) {
  const start = new Date(a.scheduledAt);
  const end = new Date(start.getTime() + (a.durationMinutes || 30) * 60000);
  return clean({ resourceType: 'Appointment', id: a._id, meta: meta(a), status: APPT_STATUS[a.status] || 'booked', appointmentType: { text: a.appointmentType }, priority: a.priority === 'high' ? 1 : a.priority === 'low' ? 9 : 5, description: a.reason, start: start.toISOString(), end: end.toISOString(), minutesDuration: a.durationMinutes, comment: a.notes, patientInstruction: a.instructions, participant: [{ actor: ref('Patient', a.patientId, patientName), status: 'accepted', required: 'required' }, a.practitionerId && { actor: ref('Practitioner', a.practitionerId, doctorName), status: 'accepted' }, { actor: ref('Organization', a.clinicId), status: 'accepted' }].filter(Boolean) });
}

const ENC_STATUS = { Scheduled: 'planned', 'In Progress': 'in-progress', Completed: 'finished', Cancelled: 'cancelled', 'No Show': 'cancelled' };
const ENC_CLASS = { 'In-person': { code: 'AMB', display: 'ambulatory' }, Video: { code: 'VR', display: 'virtual' }, Phone: { code: 'VR', display: 'virtual' }, Chat: { code: 'VR', display: 'virtual' } };
function encounter(e, patientName, doctorName) {
  const cls = ENC_CLASS[e.mode] || ENC_CLASS['In-person'];
  return clean({ resourceType: 'Encounter', id: e._id, meta: meta(e), status: ENC_STATUS[e.status] || 'unknown', class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', ...cls }, type: [{ text: e.encounterType }], priority: e.priority ? { text: e.priority } : undefined, subject: ref('Patient', e.patientId, patientName), participant: e.practitionerId ? [{ individual: ref('Practitioner', e.practitionerId, doctorName || e.providerName) }] : undefined, appointment: e.appointmentId ? [ref('Appointment', e.appointmentId)] : undefined, period: { start: iso(e.startedAt), end: iso(e.endedAt) }, length: e.durationMinutes ? { value: e.durationMinutes, unit: 'min', system: 'http://unitsofmeasure.org', code: 'min' } : undefined, reasonCode: e.reason ? [{ text: e.reason }] : undefined, serviceProvider: ref('Organization', e.clinicId) });
}

function condition(c, patientName) {
  return clean({ resourceType: 'Condition', id: c._id, meta: meta(c), clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: c.clinicalStatus }] }, verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: c.verificationStatus || 'confirmed' }] }, severity: c.severity ? { text: c.severity } : undefined, code: { coding: c.code ? [{ system: c.codeSystem, code: c.code, display: c.display }] : undefined, text: c.display }, subject: ref('Patient', c.patientId, patientName), encounter: ref('Encounter', c.encounterId), onsetDateTime: iso(c.onsetDate), abatementDateTime: iso(c.abatementDate), recordedDate: iso(c.createdAt), recorder: ref('Practitioner', c.recordedBy), note: c.notes ? [{ text: c.notes }] : undefined });
}

/** Encounter diagnosis summary expressed as a Condition (legacy free-text diagnosis). */
function encounterDiagnosisCondition(e, patientName) {
  return clean({ resourceType: 'Condition', id: `enc-${e._id}`, meta: meta(e), clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] }, verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'provisional' }] }, code: { text: e.diagnosisSummary }, subject: ref('Patient', e.patientId, patientName), encounter: ref('Encounter', e._id), recordedDate: iso(e.startedAt) });
}

const VITAL_CODES = {
  systolic: { code: '8480-6', display: 'Systolic blood pressure', unit: 'mm[Hg]' },
  diastolic: { code: '8462-4', display: 'Diastolic blood pressure', unit: 'mm[Hg]' },
  heartRate: { code: '8867-4', display: 'Heart rate', unit: '/min' },
  temperature: { code: '8310-5', display: 'Body temperature', unit: 'Cel' },
  respiratoryRate: { code: '9279-1', display: 'Respiratory rate', unit: '/min' },
  oxygenSaturation: { code: '2708-6', display: 'Oxygen saturation in Arterial blood', unit: '%' },
  weightKg: { code: '29463-7', display: 'Body weight', unit: 'kg' },
  heightCm: { code: '8302-2', display: 'Body height', unit: 'cm' },
  bmi: { code: '39156-5', display: 'Body mass index (BMI) [Ratio]', unit: 'kg/m2' },
  bloodSugar: { code: '2339-0', display: 'Glucose [Mass/volume] in Blood', unit: 'mg/dL' },
};
/** One vitals row → one Observation per measured value (plus a BP panel). */
function observationsFromVitals(v, patientName) {
  const base = (id, code, value) => ({ resourceType: 'Observation', id, meta: meta(v), status: 'final', category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }], code: { coding: [{ system: 'http://loinc.org', code: code.code, display: code.display }], text: code.display }, subject: ref('Patient', v.patientId, patientName), encounter: ref('Encounter', v.encounterId), effectiveDateTime: iso(v.recordedAt), performer: v.recordedBy ? [ref('Practitioner', v.recordedBy)] : undefined, valueQuantity: value });
  const out = [];
  if (v.systolic || v.diastolic) {
    out.push(clean({ ...base(`${v._id}-bp`, { code: '85354-9', display: 'Blood pressure panel with all children optional' }, undefined), component: [v.systolic && { code: { coding: [{ system: 'http://loinc.org', ...VITAL_CODES.systolic }] }, valueQuantity: { value: Number(v.systolic), unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } }, v.diastolic && { code: { coding: [{ system: 'http://loinc.org', ...VITAL_CODES.diastolic }] }, valueQuantity: { value: Number(v.diastolic), unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } }].filter(Boolean) }));
  }
  for (const [col, code] of Object.entries(VITAL_CODES)) {
    if (col === 'systolic' || col === 'diastolic' || v[col] === null || v[col] === undefined) continue;
    let value = Number(v[col]);
    let unit = code.unit;
    if (col === 'temperature') { const f = (v.temperatureUnit || '°F').includes('F'); if (f) value = Math.round(((value - 32) * 5) / 9 * 10) / 10; }
    out.push(clean(base(`${v._id}-${col.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, code, { value, unit, system: 'http://unitsofmeasure.org', code: unit })));
  }
  return out;
}

const ALLERGY_CAT = { food: 'food', medication: 'medication', environment: 'environment', biologic: 'biologic' };
function allergyIntolerance(a, patientName) {
  return clean({ resourceType: 'AllergyIntolerance', id: a._id, meta: meta(a), clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: a.clinicalStatus }] }, verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }] }, category: a.category ? [ALLERGY_CAT[a.category]] : undefined, criticality: a.criticality, code: { text: a.substance }, patient: ref('Patient', a.patientId, patientName), encounter: ref('Encounter', a.encounterId), onsetDateTime: iso(a.onsetDate), recordedDate: iso(a.createdAt), recorder: ref('Practitioner', a.recordedBy), reaction: a.reaction ? [{ manifestation: [{ text: a.reaction }] }] : undefined });
}

function medication(m) {
  return clean({ resourceType: 'Medication', id: m._id, meta: meta(m), code: { coding: m.code ? [{ code: m.code, display: m.name }] : undefined, text: m.name }, status: m.status === 'active' ? 'active' : 'inactive' });
}

const RX_STATUS = { Active: 'active', Completed: 'completed', Cancelled: 'cancelled' };
/** Each prescription item becomes a MedicationRequest, grouped by the prescription number. */
function medicationRequests(p, items, patientName, doctorName) {
  return items.map((i) => clean({ resourceType: 'MedicationRequest', id: i._id, meta: meta(p), status: RX_STATUS[p.status] || 'unknown', intent: 'order', groupIdentifier: { value: p.prescriptionNumber }, medicationCodeableConcept: { text: i.name }, subject: ref('Patient', p.patientId, patientName), encounter: ref('Encounter', p.encounterId), authoredOn: iso(p.prescribedAt), requester: ref('Practitioner', p.practitionerId, doctorName), reasonCode: p.diagnosis ? [{ text: p.diagnosis }] : undefined, note: [p.notes && { text: p.notes }].filter(Boolean), dosageInstruction: [{ text: [i.dosage, i.frequency, i.duration].filter(Boolean).join(', '), patientInstruction: i.instructions, timing: i.frequency ? { code: { text: i.frequency } } : undefined, doseAndRate: i.dosage ? [{ doseQuantity: { unit: i.dosage } }] : undefined }], dispenseRequest: i.quantity ? { quantity: { value: i.quantity } } : undefined }));
}

const LAB_STATUS = { preliminary: 'preliminary', final: 'final', amended: 'amended', cancelled: 'cancelled' };
function diagnosticReport(r, order, patientName) {
  return clean({ resourceType: 'DiagnosticReport', id: r._id, meta: meta(r), status: LAB_STATUS[r.status] || 'final', category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB', display: 'Laboratory' }] }], code: { coding: order && order.testCode ? [{ code: order.testCode, display: order.testName }] : undefined, text: order ? order.testName : 'Laboratory report' }, subject: ref('Patient', r.patientId, patientName), encounter: ref('Encounter', order && order.encounterId), effectiveDateTime: iso(r.resultDate), issued: iso(r.createdAt), performer: [r.labName && { display: r.labName }].filter(Boolean), resultsInterpreter: r.verifiedBy ? [ref('Practitioner', r.verifiedBy)] : undefined, conclusion: r.summary || r.interpretation, presentedForm: r.documentId ? [{ url: `${config().FHIR_BASE_URL}/DocumentReference/${r.documentId}` }] : undefined, basedOn: [ref('ServiceRequest', r.labOrderId)] });
}

function documentReference(d, patientName, accessUrl) {
  return clean({ resourceType: 'DocumentReference', id: d._id, meta: meta(d), status: d.status === 'available' ? 'current' : 'entered-in-error', docStatus: 'final', type: { text: d.documentType }, category: [{ text: d.category }], subject: ref('Patient', d.patientId, patientName), date: iso(d.createdAt), author: d.uploadedByPractitionerId ? [ref('Practitioner', d.uploadedByPractitionerId)] : undefined, custodian: ref('Organization', d.clinicId), description: d.description || d.title, securityLabel: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R', display: 'restricted' }] }], content: [{ attachment: { contentType: d.mimeType, url: accessUrl, size: Number(d.sizeBytes), hash: d.checksumSha256 ? Buffer.from(d.checksumSha256, 'hex').toString('base64') : undefined, title: d.originalFileName, creation: iso(d.createdAt) } }], context: d.encounterId ? { encounter: [ref('Encounter', d.encounterId)] } : undefined });
}

const MODALITY = { 'X-Ray': 'DX', 'CT Scan': 'CT', MRI: 'MR', Ultrasound: 'US' };
function imagingStudy(s, patientName) {
  const mod = MODALITY[s.modality] || 'OT';
  return clean({ resourceType: 'ImagingStudy', id: s._id, meta: meta(s), status: s.status === 'Active' ? 'available' : 'cancelled', modality: [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: mod, display: s.modality }], subject: ref('Patient', s.patientId, patientName), encounter: ref('Encounter', s.encounterId), started: iso(s.studyDate), basedOn: s.imagingOrderId ? [ref('ServiceRequest', s.imagingOrderId)] : undefined, referrer: ref('Practitioner', s.uploadedBy), numberOfSeries: 1, numberOfInstances: 1, description: [s.title, s.description].filter(Boolean).join(' - '), reasonCode: s.associatedDiagnosis ? [{ text: s.associatedDiagnosis }] : undefined, series: [{ uid: `2.25.${BigInt(`0x${s._id.replace(/-/g, '')}`).toString()}`, number: 1, modality: { system: 'http://dicom.nema.org/resources/ontology/DCM', code: mod }, bodySite: s.bodyPart ? { display: s.bodyPart } : undefined, instance: s.documentId ? [{ uid: `2.25.${BigInt(`0x${s.documentId.replace(/-/g, '')}`).toString()}`, sopClass: { system: 'urn:ietf:rfc:3986', code: 'urn:oid:1.2.840.10008.5.1.4.1.1.7' }, number: 1 }] : undefined }] });
}

/** Lab and imaging orders, and completed encounters with a recorded procedure, surface as Procedure/ServiceRequest. */
function serviceRequest(o, kind, patientName) {
  return clean({ resourceType: 'ServiceRequest', id: o._id, meta: meta(o), status: { ordered: 'active', 'in-progress': 'active', completed: 'completed', cancelled: 'revoked' }[o.status] || 'unknown', intent: 'order', priority: { Routine: 'routine', Urgent: 'urgent', Emergency: 'stat' }[o.priority] || 'routine', category: [{ text: kind }], code: { coding: o.testCode ? [{ code: o.testCode, display: o.testName }] : undefined, text: o.testName || o.modality }, subject: ref('Patient', o.patientId, patientName), encounter: ref('Encounter', o.encounterId), authoredOn: iso(o.orderedAt), requester: ref('Practitioner', o.orderedBy), bodySite: o.bodyPart ? [{ text: o.bodyPart }] : undefined, reasonCode: o.reason ? [{ text: o.reason }] : undefined });
}
function procedure(e, patientName, doctorName) {
  return clean({ resourceType: 'Procedure', id: e._id, meta: meta(e), status: e.status === 'Completed' ? 'completed' : e.status === 'In Progress' ? 'in-progress' : e.status === 'Cancelled' ? 'not-done' : 'preparation', code: { text: e.encounterType }, subject: ref('Patient', e.patientId, patientName), encounter: ref('Encounter', e._id), performedPeriod: { start: iso(e.startedAt), end: iso(e.endedAt) }, performer: e.practitionerId ? [{ actor: ref('Practitioner', e.practitionerId, doctorName) }] : undefined, reasonCode: e.reason ? [{ text: e.reason }] : undefined, note: e.providerNotes ? [{ text: e.providerNotes }] : undefined });
}

function bundle(entries, { total, type = 'searchset', baseUrl, selfUrl, nextUrl }) {
  return clean({ resourceType: 'Bundle', type, total, link: [{ relation: 'self', url: selfUrl }, nextUrl && { relation: 'next', url: nextUrl }].filter(Boolean), entry: entries.length ? entries.map((r) => ({ fullUrl: `${baseUrl}/${r.resourceType}/${r.id}`, resource: r, search: { mode: 'match' } })) : undefined });
}
function operationOutcome(severity, code, diagnostics) {
  return { resourceType: 'OperationOutcome', issue: [{ severity, code, diagnostics }] };
}

module.exports = { patient, organization, practitioner, appointment, encounter, condition, encounterDiagnosisCondition, observationsFromVitals, allergyIntolerance, medication, medicationRequests, diagnosticReport, documentReference, imagingStudy, serviceRequest, procedure, bundle, operationOutcome, VITAL_CODES };
