'use strict';
const { api, resetData, adminToken, createClinic, createPatient } = require('../helpers/api');
const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('FHIR R4 API', () => {
  let t, c, p;
  beforeAll(async () => {
    await resetData();
    t = await adminToken();
    c = await createClinic(t);
    p = await createPatient(c.adminToken, { fullName: 'Fhir Patient', uhid: 'UHX1' });
    await api().post('/api/v1/vitals').set(auth(c.adminToken)).send({ patientId: p._id, vitalSigns: { bloodPressure: { systolic: 130, diastolic: 85 }, heartRate: { value: 70 } } });
    await api().post('/api/v1/prescriptions').set(auth(c.adminToken)).send({ patientId: p._id, medications: [{ name: 'Amoxicillin', dosage: '500mg' }] });
    await api().post('/api/v1/conditions').set(auth(c.adminToken)).send({ patientId: p._id, display: 'Asthma', code: 'J45' });
    await api().post('/api/v1/allergies').set(auth(c.adminToken)).send({ patientId: p._id, substance: 'Dust', category: 'environment' });
  });

  it('serves a capability statement without auth and requires auth elsewhere', async () => {
    const m = await api().get('/api/fhir/R4/metadata');
    expect(m.status).toBe(401); // whole facade is behind authentication
    const m2 = await api().get('/api/fhir/R4/metadata').set(auth(c.adminToken));
    expect(m2.body.resourceType).toBe('CapabilityStatement');
    expect(m2.body.rest[0].resource.map((r) => r.type)).toEqual(expect.arrayContaining(['Patient', 'Organization', 'Practitioner', 'Appointment', 'Encounter', 'Condition', 'Observation', 'AllergyIntolerance', 'Medication', 'MedicationRequest', 'DiagnosticReport', 'DocumentReference', 'ImagingStudy', 'Procedure']));
    expect((await api().get('/api/fhir/R4/Patient')).status).toBe(401);
  });

  it('reads and searches resources with paging and audit', async () => {
    const r = await api().get(`/api/fhir/R4/Patient/${p._id}`).set(auth(c.adminToken));
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('application/fhir+json');
    expect(r.body.identifier.some((i) => i.value === 'UHX1')).toBe(true);
    const s = await api().get('/api/fhir/R4/Patient?name=Fhir&_count=1').set(auth(c.adminToken));
    expect(s.body.total).toBe(1);
    expect(s.body.entry).toHaveLength(1);
    const obs = await api().get(`/api/fhir/R4/Observation?patient=${p._id}`).set(auth(c.adminToken));
    expect(obs.body.entry.map((e) => e.resource.code.coding[0].code)).toEqual(expect.arrayContaining(['85354-9', '8867-4']));
    const one = await api().get(`/api/fhir/R4/Observation/${obs.body.entry[0].resource.id}`).set(auth(c.adminToken));
    expect(one.status).toBe(200);
    const mr = await api().get(`/api/fhir/R4/MedicationRequest?patient=${p._id}`).set(auth(c.adminToken));
    expect(mr.body.entry[0].resource.medicationCodeableConcept.text).toBe('Amoxicillin');
    const item = await api().get(`/api/fhir/R4/MedicationRequest/${mr.body.entry[0].resource.id}`).set(auth(c.adminToken));
    expect(item.status).toBe(200);
    expect((await api().get(`/api/fhir/R4/Condition?patient=${p._id}`).set(auth(c.adminToken))).body.entry[0].resource.code.coding[0].code).toBe('J45');
    expect((await api().get(`/api/fhir/R4/AllergyIntolerance?patient=${p._id}`).set(auth(c.adminToken))).body.entry[0].resource.category).toEqual(['environment']);
    expect((await api().get('/api/fhir/R4/Organization').set(auth(c.adminToken))).body.total).toBe(1);
    const count = await api().get('/api/fhir/R4/Patient?_summary=count').set(auth(c.adminToken));
    expect(count.body.total).toBe(1);
    expect(count.body.entry).toBeUndefined();
    const audit = await api().get('/api/v1/audit?action=FHIR_RESOURCE_ACCESSED').set(auth(c.adminToken));
    expect(audit.body.data.length).toBeGreaterThan(3);
  });

  it('returns OperationOutcome errors', async () => {
    const nf = await api().get('/api/fhir/R4/Patient/00000000-0000-4000-8000-000000000000').set(auth(c.adminToken));
    expect(nf.status).toBe(404);
    expect(nf.body.resourceType).toBe('OperationOutcome');
    expect((await api().get('/api/fhir/R4/Widget').set(auth(c.adminToken))).status).toBe(404);
    expect((await api().get('/api/fhir/R4/Patient/not-uuid').set(auth(c.adminToken))).status).toBe(400);
    expect((await api().delete(`/api/fhir/R4/Patient/${p._id}`).set(auth(c.adminToken))).status).toBe(405);
  });

  it('creates and updates a Patient from FHIR input within the caller clinic', async () => {
    const created = await api().post('/api/fhir/R4/Patient').set(auth(c.adminToken)).send({ resourceType: 'Patient', name: [{ given: ['New'], family: 'Person' }], gender: 'male', birthDate: '2000-01-01', telecom: [{ system: 'phone', value: '123' }], managingOrganization: { reference: 'Organization/11111111-1111-4111-8111-111111111111' } });
    expect(created.status).toBe(201);
    expect(created.body.managingOrganization.reference).toBe(`Organization/${c.clinic._id}`);
    const upd = await api().put(`/api/fhir/R4/Patient/${created.body.id}`).set(auth(c.adminToken)).send({ resourceType: 'Patient', name: [{ text: 'New Person Jr' }] });
    expect(upd.status).toBe(200);
    expect(upd.body.name[0].text).toBe('New Person Jr');
    const bad = await api().post('/api/fhir/R4/Patient').set(auth(c.adminToken)).send({ resourceType: 'Patient' });
    expect(bad.status).toBe(400);
    expect(bad.body.resourceType).toBe('OperationOutcome');
  });
});
