'use strict';
const fhir = require('../../src/fhir/mappings');

const pat = { _id: '11111111-1111-4111-8111-111111111111', clinicId: '22222222-2222-4222-8222-222222222222', fullName: 'Jane Mary Doe', gender: 'female', dateOfBirth: '1990-05-15', phone: '123', email: 'j@x.com', status: 'active', address: { street: '1 Main', city: 'Bangalore', zipCode: '560001' }, emergencyContact: { name: 'Bob', relationship: 'Brother', phone: '9' }, version: 2, updatedAt: '2026-01-01T00:00:00Z' };

describe('fhir mappings', () => {
  it('maps a patient with identifiers, names and organization', () => {
    const r = fhir.patient(pat, [{ system: 'uhid', value: 'UH1' }, { system: 'legacy_mongo', value: 'x' }], { name: 'Clinic' });
    expect(r.resourceType).toBe('Patient');
    expect(r.name[0]).toEqual({ use: 'official', text: 'Jane Mary Doe', family: 'Doe', given: ['Jane', 'Mary'] });
    expect(r.identifier.map((i) => i.value)).toEqual([pat._id, 'UH1']);
    expect(r.gender).toBe('female');
    expect(r.birthDate).toBe('1990-05-15');
    expect(r.managingOrganization.reference).toBe(`Organization/${pat.clinicId}`);
    expect(r.meta.versionId).toBe('2');
    expect(JSON.stringify(r)).not.toContain('undefined');
  });
  it('splits vitals into LOINC observations and converts Fahrenheit', () => {
    const obs = fhir.observationsFromVitals({ _id: pat._id, patientId: pat._id, recordedAt: '2026-01-01', systolic: 120, diastolic: 80, temperature: 98.6, temperatureUnit: '°F', weightKg: 70, version: 1 }, 'Jane');
    const bp = obs.find((o) => o.id.endsWith('-bp'));
    expect(bp.component).toHaveLength(2);
    expect(bp.component[0].valueQuantity.value).toBe(120);
    const temp = obs.find((o) => o.code.coding[0].code === '8310-5');
    expect(temp.valueQuantity.value).toBe(37);
    expect(temp.valueQuantity.unit).toBe('Cel');
    expect(obs.every((o) => o.category[0].coding[0].code === 'vital-signs')).toBe(true);
  });
  it('maps encounters, appointments, prescriptions and reports', () => {
    const enc = fhir.encounter({ _id: pat._id, patientId: pat._id, clinicId: pat.clinicId, status: 'Completed', mode: 'Video', encounterType: 'General', startedAt: '2026-01-01', version: 1 }, 'Jane');
    expect(enc.status).toBe('finished');
    expect(enc.class.code).toBe('VR');
    const appt = fhir.appointment({ _id: pat._id, patientId: pat._id, clinicId: pat.clinicId, status: 'Cancelled', scheduledAt: '2026-01-01T10:00:00Z', durationMinutes: 30, version: 1 }, 'Jane');
    expect(appt.status).toBe('cancelled');
    expect(appt.end).toBe('2026-01-01T10:30:00.000Z');
    const rx = fhir.medicationRequests({ _id: pat._id, patientId: pat._id, status: 'Active', prescriptionNumber: 'RX-1', prescribedAt: '2026-01-01', version: 1 }, [{ _id: 'i1', name: 'Paracetamol', dosage: '500mg', frequency: 'BID', quantity: 10 }], 'Jane', 'Dr');
    expect(rx).toHaveLength(1);
    expect(rx[0].medicationCodeableConcept.text).toBe('Paracetamol');
    expect(rx[0].dispenseRequest.quantity.value).toBe(10);
    const dr = fhir.diagnosticReport({ _id: pat._id, patientId: pat._id, status: 'final', resultDate: '2026-01-01', labOrderId: 'o', documentId: 'd', version: 1 }, { testName: 'CBC', testCode: '58410-2' }, 'Jane');
    expect(dr.code.coding[0].code).toBe('58410-2');
    expect(dr.presentedForm[0].url).toContain('DocumentReference/d');
  });
  it('builds bundles and operation outcomes', () => {
    const b = fhir.bundle([fhir.organization({ _id: pat.clinicId, name: 'C', isActive: true, version: 1 })], { total: 1, baseUrl: 'http://x', selfUrl: 'http://x/Organization' });
    expect(b.entry[0].fullUrl).toBe(`http://x/Organization/${pat.clinicId}`);
    expect(fhir.operationOutcome('error', 'not-found', 'x').issue[0].code).toBe('not-found');
  });
});
