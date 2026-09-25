'use strict';
/**
 * PostgreSQL row → HL7 FHIR R4 resource mappers. Pure functions; the canonical
 * data stays in the internal model, FHIR is a projection.
 */
const { config } = require('../../config');

const ref = (type, id, display) => (id ? { reference: `${type}/${id}`, ...(display ? { display } : {}) } : undefined);
const iso = (d) => (d ? new Date(d).toISOString() : undefined);
const date = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
const clean = (o) => JSON.parse(JSON.stringify(o));
const meta = (row) => ({ versionId: String(row.version || 1), lastUpdated: iso(row.updated_at || row.created_at) });
const GENDER = { male: 'male', female: 'female', other: 'other', unknown: 'unknown' };

function patient(p, identifiers = [], clinic) {
  const names = (p.full_name || '').trim().split(/\s+/);
  return clean({
    resourceType: 'Patient', id: p.id, meta: meta(p), active: p.status === 'active',
    identifier: [{ system: `${config().FHIR_BASE_URL}/identifiers/internal`, value: p.id }, ...identifiers.filter((i) => i.system !== 'legacy_mongo').map((i) => ({ system: `${config().FHIR_BASE_URL}/identifiers/${i.system}`, value: i.value }))],
    name: [{ use: 'official', text: p.full_name, family: names.length > 1 ? names[names.length - 1] : undefined, given: names.length > 1 ? names.slice(0, -1) : names }],
    telecom: [p.phone && { system: 'phone', value: p.phone }, p.email && { system: 'email', value: p.email }].filter(Boolean),
    gender: GENDER[String(p.gender || '').toLowerCase()] || 'unknown', birthDate: date(p.date_of_birth),
    address: p.address && (p.address.street || p.address.city || p.city) ? [{ line: [p.address.street].filter(Boolean), city: p.address.city || p.city, state: p.address.state, postalCode: p.address.zipCode || p.pin_code, country: p.address.country }] : undefined,
    contact: p.emergency_contact && p.emergency_contact.name ? [{ relationship: [{ text: p.emergency_contact.relationship }], name: { text: p.emergency_contact.name }, telecom: p.emergency_contact.phone ? [{ system: 'phone', value: p.emergency_contact.phone }] : undefined }] : undefined,
    managingOrganization: ref('Organization', p.clinic_id, clinic && clinic.name),
  });
}

function organization(c) {
  return clean({ resourceType: 'Organization', id: c.id, meta: meta(c), active: c.is_active, identifier: c.registration_number ? [{ system: `${config().FHIR_BASE_URL}/identifiers/registration`, value: c.registration_number }] : undefined, type: [{ text: c.type || 'Clinic' }], name: c.name, telecom: [c.phone && { system: 'phone', value: c.phone }, c.email && { system: 'email', value: c.email }, c.website && { system: 'url', value: c.website }].filter(Boolean), address: [{ line: [c.address].filter(Boolean), city: c.city, state: c.state, postalCode: c.zip_code, country: c.country }] });
}

function practitioner(d, clinic) {
  const names = (d.full_name || '').trim().split(/\s+/);
  return clean({ resourceType: 'Practitioner', id: d.id, meta: meta(d), active: d.is_active, identifier: d.license_number ? [{ system: `${config().FHIR_BASE_URL}/identifiers/license`, value: d.license_number }] : undefined, name: [{ text: d.full_name, family: names.length > 1 ? names[names.length - 1] : undefined, given: names.length > 1 ? names.slice(0, -1) : names }], telecom: [d.phone && { system: 'phone', value: d.phone }, d.email && { system: 'email', value: d.email }].filter(Boolean), qualification: [d.qualification && { code: { text: d.qualification } }, d.specialty && { code: { text: d.specialty } }].filter(Boolean), extension: [{ url: `${config().FHIR_BASE_URL}/StructureDefinition/practitioner-kind`, valueCode: d.kind }, clinic && { url: `${config().FHIR_BASE_URL}/StructureDefinition/organization`, valueReference: ref('Organization', d.clinic_id, clinic.name) }].filter(Boolean) });
}

const APPT_STATUS = { Scheduled: 'booked', Confirmed: 'booked', Completed: 'fulfilled', Cancelled: 'cancelled', 'No Show': 'noshow' };
function appointment(a, patientName, doctorName) {
  const start = new Date(a.scheduled_at);
  const end = new Date(start.getTime() + (a.duration_minutes || 30) * 60000);
  return clean({ resourceType: 'Appointment', id: a.id, meta: meta(a), status: APPT_STATUS[a.status] || 'booked', appointmentType: { text: a.appointment_type }, priority: a.priority === 'high' ? 1 : a.priority === 'low' ? 9 : 5, description: a.reason, start: start.toISOString(), end: end.toISOString(), minutesDuration: a.duration_minutes, comment: a.notes, patientInstruction: a.instructions, participant: [{ actor: ref('Patient', a.patient_id, patientName), status: 'accepted', required: 'required' }, a.practitioner_id && { actor: ref('Practitioner', a.practitioner_id, doctorName), status: 'accepted' }, { actor: ref('Organization', a.clinic_id), status: 'accepted' }].filter(Boolean) });
}

const ENC_STATUS = { Scheduled: 'planned', 'In Progress': 'in-progress', Completed: 'finished', Cancelled: 'cancelled', 'No Show': 'cancelled' };
const ENC_CLASS = { 'In-person': { code: 'AMB', display: 'ambulatory' }, Video: { code: 'VR', display: 'virtual' }, Phone: { code: 'VR', display: 'virtual' }, Chat: { code: 'VR', display: 'virtual' } };
function encounter(e, patientName, doctorName) {
  const cls = ENC_CLASS[e.mode] || ENC_CLASS['In-person'];
  return clean({ resourceType: 'Encounter', id: e.id, meta: meta(e), status: ENC_STATUS[e.status] || 'unknown', class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', ...cls }, type: [{ text: e.encounter_type }], priority: e.priority ? { text: e.priority } : undefined, subject: ref('Patient', e.patient_id, patientName), participant: e.practitioner_id ? [{ individual: ref('Practitioner', e.practitioner_id, doctorName || e.provider_name) }] : undefined, appointment: e.appointment_id ? [ref('Appointment', e.appointment_id)] : undefined, period: { start: iso(e.started_at), end: iso(e.ended_at) }, length: e.duration_minutes ? { value: e.duration_minutes, unit: 'min', system: 'http://unitsofmeasure.org', code: 'min' } : undefined, reasonCode: e.reason ? [{ text: e.reason }] : undefined, serviceProvider: ref('Organization', e.clinic_id) });
}

function condition(c, patientName) {
  return clean({ resourceType: 'Condition', id: c.id, meta: meta(c), clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: c.clinical_status }] }, verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: c.verification_status || 'confirmed' }] }, severity: c.severity ? { text: c.severity } : undefined, code: { coding: c.code ? [{ system: c.code_system, code: c.code, display: c.display }] : undefined, text: c.display }, subject: ref('Patient', c.patient_id, patientName), encounter: ref('Encounter', c.encounter_id), onsetDateTime: iso(c.onset_date), abatementDateTime: iso(c.abatement_date), recordedDate: iso(c.created_at), recorder: ref('Practitioner', c.recorded_by), note: c.notes ? [{ text: c.notes }] : undefined });
}

/** Encounter diagnosis summary expressed as a Condition (legacy free-text diagnosis). */
function encounterDiagnosisCondition(e, patientName) {
  return clean({ resourceType: 'Condition', id: `enc-${e.id}`, meta: meta(e), clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] }, verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'provisional' }] }, code: { text: e.diagnosis_summary }, subject: ref('Patient', e.patient_id, patientName), encounter: ref('Encounter', e.id), recordedDate: iso(e.started_at) });
}

const VITAL_CODES = {
  systolic: { code: '8480-6', display: 'Systolic blood pressure', unit: 'mm[Hg]' },
  diastolic: { code: '8462-4', display: 'Diastolic blood pressure', unit: 'mm[Hg]' },
  heart_rate: { code: '8867-4', display: 'Heart rate', unit: '/min' },
  temperature: { code: '8310-5', display: 'Body temperature', unit: 'Cel' },
  respiratory_rate: { code: '9279-1', display: 'Respiratory rate', unit: '/min' },
  oxygen_saturation: { code: '2708-6', display: 'Oxygen saturation in Arterial blood', unit: '%' },
  weight_kg: { code: '29463-7', display: 'Body weight', unit: 'kg' },
  height_cm: { code: '8302-2', display: 'Body height', unit: 'cm' },
  bmi: { code: '39156-5', display: 'Body mass index (BMI) [Ratio]', unit: 'kg/m2' },
  blood_sugar: { code: '2339-0', display: 'Glucose [Mass/volume] in Blood', unit: 'mg/dL' },
};
/** One vitals row → one Observation per measured value (plus a BP panel). */
function observationsFromVitals(v, patientName) {
  const base = (id, code, value) => ({ resourceType: 'Observation', id, meta: meta(v), status: 'final', category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }], code: { coding: [{ system: 'http://loinc.org', code: code.code, display: code.display }], text: code.display }, subject: ref('Patient', v.patient_id, patientName), encounter: ref('Encounter', v.encounter_id), effectiveDateTime: iso(v.recorded_at), performer: v.recorded_by ? [ref('Practitioner', v.recorded_by, v.recorded_by_name)] : undefined, valueQuantity: value });
  const out = [];
  if (v.systolic || v.diastolic) {
    out.push(clean({ ...base(`${v.id}-bp`, { code: '85354-9', display: 'Blood pressure panel with all children optional' }, undefined), component: [v.systolic && { code: { coding: [{ system: 'http://loinc.org', ...VITAL_CODES.systolic }] }, valueQuantity: { value: Number(v.systolic), unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } }, v.diastolic && { code: { coding: [{ system: 'http://loinc.org', ...VITAL_CODES.diastolic }] }, valueQuantity: { value: Number(v.diastolic), unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } }].filter(Boolean) }));
  }
  for (const [col, code] of Object.entries(VITAL_CODES)) {
    if (col === 'systolic' || col === 'diastolic' || v[col] === null || v[col] === undefined) continue;
    let value = Number(v[col]);
    let unit = code.unit;
    if (col === 'temperature') { const f = (v.temperature_unit || '°F').includes('F'); if (f) value = Math.round(((value - 32) * 5) / 9 * 10) / 10; }
    out.push(clean(base(`${v.id}-${col.replace(/_/g, '-')}`, code, { value, unit, system: 'http://unitsofmeasure.org', code: unit })));
  }
  return out;
}

const ALLERGY_CAT = { food: 'food', medication: 'medication', environment: 'environment', biologic: 'biologic' };
function allergyIntolerance(a, patientName) {
  return clean({ resourceType: 'AllergyIntolerance', id: a.id, meta: meta(a), clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: a.clinical_status }] }, verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }] }, category: a.category ? [ALLERGY_CAT[a.category]] : undefined, criticality: a.criticality, code: { text: a.substance }, patient: ref('Patient', a.patient_id, patientName), encounter: ref('Encounter', a.encounter_id), onsetDateTime: iso(a.onset_date), recordedDate: iso(a.created_at), recorder: ref('Practitioner', a.recorded_by), reaction: a.reaction ? [{ manifestation: [{ text: a.reaction }] }] : undefined });
}

function medication(m) {
  return clean({ resourceType: 'Medication', id: m.id, meta: meta(m), code: { coding: m.code ? [{ code: m.code, display: m.name }] : undefined, text: m.name }, status: m.status === 'active' ? 'active' : 'inactive' });
}

const RX_STATUS = { Active: 'active', Completed: 'completed', Cancelled: 'cancelled' };
/** Each prescription item becomes a MedicationRequest, grouped by the prescription number. */
function medicationRequests(p, items, patientName, doctorName) {
  return items.map((i) => clean({ resourceType: 'MedicationRequest', id: i.id, meta: meta(p), status: RX_STATUS[p.status] || 'unknown', intent: 'order', groupIdentifier: { value: p.prescription_number }, medicationCodeableConcept: { text: i.name }, subject: ref('Patient', p.patient_id, patientName), encounter: ref('Encounter', p.encounter_id), authoredOn: iso(p.prescribed_at), requester: ref('Practitioner', p.practitioner_id, doctorName), reasonCode: p.diagnosis ? [{ text: p.diagnosis }] : undefined, note: [p.notes && { text: p.notes }].filter(Boolean), dosageInstruction: [{ text: [i.dosage, i.frequency, i.duration].filter(Boolean).join(', '), patientInstruction: i.instructions, timing: i.frequency ? { code: { text: i.frequency } } : undefined, doseAndRate: i.dosage ? [{ doseQuantity: { unit: i.dosage } }] : undefined }], dispenseRequest: i.quantity ? { quantity: { value: i.quantity } } : undefined }));
}

const LAB_STATUS = { preliminary: 'preliminary', final: 'final', amended: 'amended', cancelled: 'cancelled' };
function diagnosticReport(r, order, patientName) {
  return clean({ resourceType: 'DiagnosticReport', id: r.id, meta: meta(r), status: LAB_STATUS[r.status] || 'final', category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB', display: 'Laboratory' }] }], code: { coding: order && order.test_code ? [{ code: order.test_code, display: order.test_name }] : undefined, text: order ? order.test_name : 'Laboratory report' }, subject: ref('Patient', r.patient_id, patientName), encounter: ref('Encounter', order && order.encounter_id), effectiveDateTime: iso(r.result_date), issued: iso(r.created_at), performer: [r.lab_name && { display: r.lab_name }].filter(Boolean), resultsInterpreter: r.verified_by ? [ref('Practitioner', r.verified_by)] : undefined, conclusion: r.summary || r.interpretation, presentedForm: r.document_id ? [{ url: `${config().FHIR_BASE_URL}/DocumentReference/${r.document_id}` }] : undefined, basedOn: [ref('ServiceRequest', r.lab_order_id)] });
}

function documentReference(d, patientName, accessUrl) {
  return clean({ resourceType: 'DocumentReference', id: d.id, meta: meta(d), status: d.status === 'available' ? 'current' : 'entered-in-error', docStatus: 'final', type: { text: d.document_type }, category: [{ text: d.category }], subject: ref('Patient', d.patient_id, patientName), date: iso(d.created_at), author: d.uploaded_by_practitioner_id ? [ref('Practitioner', d.uploaded_by_practitioner_id)] : undefined, custodian: ref('Organization', d.clinic_id), description: d.description || d.title, securityLabel: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R', display: 'restricted' }] }], content: [{ attachment: { contentType: d.mime_type, url: accessUrl, size: Number(d.size_bytes), hash: d.checksum_sha256 ? Buffer.from(d.checksum_sha256, 'hex').toString('base64') : undefined, title: d.original_file_name, creation: iso(d.created_at) } }], context: d.encounter_id ? { encounter: [ref('Encounter', d.encounter_id)] } : undefined });
}

const MODALITY = { 'X-Ray': 'DX', 'CT Scan': 'CT', MRI: 'MR', Ultrasound: 'US' };
function imagingStudy(s, patientName) {
  const mod = MODALITY[s.modality] || 'OT';
  return clean({ resourceType: 'ImagingStudy', id: s.id, meta: meta(s), status: s.status === 'Active' ? 'available' : 'cancelled', modality: [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: mod, display: s.modality }], subject: ref('Patient', s.patient_id, patientName), encounter: ref('Encounter', s.encounter_id), started: iso(s.study_date), basedOn: s.imaging_order_id ? [ref('ServiceRequest', s.imaging_order_id)] : undefined, referrer: ref('Practitioner', s.uploaded_by), numberOfSeries: 1, numberOfInstances: 1, description: [s.title, s.description].filter(Boolean).join(' - '), reasonCode: s.associated_diagnosis ? [{ text: s.associated_diagnosis }] : undefined, series: [{ uid: `2.25.${BigInt(`0x${s.id.replace(/-/g, '')}`).toString()}`, number: 1, modality: { system: 'http://dicom.nema.org/resources/ontology/DCM', code: mod }, bodySite: s.body_part ? { display: s.body_part } : undefined, instance: s.document_id ? [{ uid: `2.25.${BigInt(`0x${s.document_id.replace(/-/g, '')}`).toString()}`, sopClass: { system: 'urn:ietf:rfc:3986', code: 'urn:oid:1.2.840.10008.5.1.4.1.1.7' }, number: 1 }] : undefined }] });
}

/** Lab and imaging orders, and completed encounters with a recorded procedure, surface as Procedure/ServiceRequest. */
function serviceRequest(o, kind, patientName) {
  return clean({ resourceType: 'ServiceRequest', id: o.id, meta: meta(o), status: { ordered: 'active', 'in-progress': 'active', completed: 'completed', cancelled: 'revoked' }[o.status] || 'unknown', intent: 'order', priority: { Routine: 'routine', Urgent: 'urgent', Emergency: 'stat' }[o.priority] || 'routine', category: [{ text: kind }], code: { coding: o.test_code ? [{ code: o.test_code, display: o.test_name }] : undefined, text: o.test_name || o.modality }, subject: ref('Patient', o.patient_id, patientName), encounter: ref('Encounter', o.encounter_id), authoredOn: iso(o.ordered_at), requester: ref('Practitioner', o.ordered_by), bodySite: o.body_part ? [{ text: o.body_part }] : undefined, reasonCode: o.reason ? [{ text: o.reason }] : undefined });
}
function procedure(e, patientName, doctorName) {
  return clean({ resourceType: 'Procedure', id: e.id, meta: meta(e), status: e.status === 'Completed' ? 'completed' : e.status === 'In Progress' ? 'in-progress' : e.status === 'Cancelled' ? 'not-done' : 'preparation', code: { text: e.encounter_type }, subject: ref('Patient', e.patient_id, patientName), encounter: ref('Encounter', e.id), performedPeriod: { start: iso(e.started_at), end: iso(e.ended_at) }, performer: e.practitioner_id ? [{ actor: ref('Practitioner', e.practitioner_id, doctorName) }] : undefined, reasonCode: e.reason ? [{ text: e.reason }] : undefined, note: e.provider_notes ? [{ text: e.provider_notes }] : undefined });
}

function bundle(entries, { total, type = 'searchset', baseUrl, selfUrl, nextUrl }) {
  return clean({ resourceType: 'Bundle', type, total, link: [{ relation: 'self', url: selfUrl }, nextUrl && { relation: 'next', url: nextUrl }].filter(Boolean), entry: entries.length ? entries.map((r) => ({ fullUrl: `${baseUrl}/${r.resourceType}/${r.id}`, resource: r, search: { mode: 'match' } })) : undefined });
}
function operationOutcome(severity, code, diagnostics) {
  return { resourceType: 'OperationOutcome', issue: [{ severity, code, diagnostics }] };
}

module.exports = { patient, organization, practitioner, appointment, encounter, condition, encounterDiagnosisCondition, observationsFromVitals, allergyIntolerance, medication, medicationRequests, diagnosticReport, documentReference, imagingStudy, serviceRequest, procedure, bundle, operationOutcome, VITAL_CODES };
