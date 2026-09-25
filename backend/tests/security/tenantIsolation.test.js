'use strict';
/**
 * Mandatory cross-clinic test: Clinic A admin must never reach Clinic B data.
 * Covers patients, appointments, encounters, vitals, prescriptions, labs,
 * imaging, documents, referrals, teleconsultations, invoices, FHIR, reports,
 * audit, clinical records and practitioners.
 */
const path = require('path');
const { api, resetData, twoClinics } = require('../helpers/api');

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7369b7e0000000049454e44ae426082', 'hex');
let f;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function seedClinicData(token, patientId) {
  const doctor = (await api().post('/api/v1/doctors').set(auth(token)).send({ fullName: 'Dr Who', specialty: 'GP' })).body.doctor;
  const appointment = (await api().post('/api/v1/appointments').set(auth(token)).send({ patientId, doctorId: doctor._id, date: '2030-01-01', time: '09:00' })).body.appointment;
  const encounter = (await api().post('/api/v1/consultations').set(auth(token)).send({ patientId, consultationType: 'General', diagnosis: 'Cold' })).body.data;
  const vitals = (await api().post('/api/v1/vitals').set(auth(token)).send({ patientId, vitalSigns: { bloodPressure: { systolic: 120, diastolic: 80 } } })).body.data;
  const prescription = (await api().post('/api/v1/prescriptions').set(auth(token)).send({ patientId, medications: [{ name: 'X' }] })).body.data;
  const lab = (await api().post('/api/v1/lab-reports').set(auth(token)).field('patientId', patientId).field('testName', 'CBC').attach('file', PNG, 'cbc.png')).body.data;
  const image = (await api().post('/api/v1/medical-images').set(auth(token)).field('patientId', patientId).field('imageType', 'X-Ray').field('title', 'Chest').attach('file', PNG, 'chest.png')).body.data;
  const referral = (await api().post('/api/v1/referrals').set(auth(token)).send({ patientId, specialistName: 'S', specialty: 'Cardio', reason: 'R' })).body.data;
  const tele = (await api().post('/api/v1/teleconsultations').set(auth(token)).send({ patientId, scheduledDate: '2030-01-02T10:00:00Z' })).body.data;
  const invoice = (await api().post('/api/v1/invoices').set(auth(token)).send({ patientId, lineItems: [{ description: 'Consult', quantity: 1, unitPrice: 500 }] })).body.data;
  const condition = (await api().post('/api/v1/conditions').set(auth(token)).send({ patientId, display: 'Hypertension', code: 'I10' })).body.data;
  const allergy = (await api().post('/api/v1/allergies').set(auth(token)).send({ patientId, substance: 'Peanut', category: 'food' })).body.data;
  for (const [k, v] of Object.entries({ doctor, appointment, encounter, vitals, prescription, lab, image, referral, tele, invoice, condition, allergy })) if (!v || !v._id) throw new Error(`seed failed for ${k}`);
  return { doctor, appointment, encounter, vitals, prescription, lab, image, referral, tele, invoice, condition, allergy };
}

describe('clinic tenant isolation', () => {
  let dataA;
  beforeAll(async () => {
    await resetData();
    f = await twoClinics();
    dataA = await seedClinicData(f.a.adminToken, f.pa._id);
  });

  const cases = () => [
    ['patients', () => `/api/v1/patients/${f.pa._id}`],
    ['appointments', () => `/api/v1/appointments/${dataA.appointment._id}`],
    ['consultations', () => `/api/v1/consultations/${dataA.encounter._id}`],
    ['vitals', () => `/api/v1/vitals/${dataA.vitals._id}`],
    ['prescriptions', () => `/api/v1/prescriptions/${dataA.prescription._id}`],
    ['lab reports', () => `/api/v1/lab-reports/${dataA.lab._id}`],
    ['lab report download', () => `/api/v1/lab-reports/${dataA.lab._id}/download`],
    ['medical images', () => `/api/v1/medical-images/${dataA.image._id}`],
    ['documents', () => `/api/v1/documents/${dataA.lab.documentId}`],
    ['document access', () => `/api/v1/documents/${dataA.lab.documentId}/access`],
    ['referrals', () => `/api/v1/referrals/${dataA.referral._id}`],
    ['teleconsultations', () => `/api/v1/teleconsultations/${dataA.tele._id}`],
    ['invoices', () => `/api/v1/invoices/${dataA.invoice._id}`],
    ['doctors', () => `/api/v1/doctors/${dataA.doctor._id}`],
    ['conditions', () => `/api/v1/conditions/${dataA.condition._id}`],
    ['allergies', () => `/api/v1/allergies/${dataA.allergy._id}`],
    ['case logs', () => `/api/v1/patients/${f.pa._id}/case-logs`],
    ['timeline', () => `/api/v1/patients/${f.pa._id}/timeline`],
    ['clinic', () => `/api/v1/clinics/${f.a.clinic._id}`],
    ['clinic dashboard', () => `/api/v1/clinics/${f.a.clinic._id}/dashboard-data`],
    ['FHIR Patient', () => `/api/fhir/R4/Patient/${f.pa._id}`],
    ['FHIR Encounter', () => `/api/fhir/R4/Encounter/${dataA.encounter._id}`],
    ['FHIR DocumentReference', () => `/api/fhir/R4/DocumentReference/${dataA.lab.documentId}`],
  ];

  it.each(cases().map(([n]) => [n]))('clinic B admin cannot read clinic A %s by id', async (name) => {
    const url = cases().find(([n]) => n === name)[1]();
    const res = await api().get(url).set(auth(f.b.adminToken));
    expect([403, 404]).toContain(res.status);
  });

  it('clinic A admin can read its own records', async () => {
    for (const [, u] of cases()) {
      const res = await api().get(u()).set(auth(f.a.adminToken));
      expect(res.status, u()).toBe(200);
    }
  });

  it('list endpoints never leak another clinic', async () => {
    for (const [p, key] of [['/api/v1/patients', 'patients'], ['/api/v1/appointments', 'appointments'], ['/api/v1/consultations', 'data'], ['/api/v1/vitals', 'vitals'], ['/api/v1/prescriptions', 'prescriptions'], ['/api/v1/lab-reports', 'reports'], ['/api/v1/medical-images', 'data'], ['/api/v1/documents', 'data'], ['/api/v1/referrals', 'data'], ['/api/v1/teleconsultations', 'teleconsultations'], ['/api/v1/invoices', 'data'], ['/api/v1/billing', 'bills'], ['/api/v1/doctors', 'doctors'], ['/api/v1/conditions', 'data'], ['/api/v1/allergies', 'data']]) {
      const res = await api().get(p).set(auth(f.b.adminToken));
      expect(res.status, p).toBe(200);
      const items = res.body[key];
      expect(Array.isArray(items), p).toBe(true);
      for (const item of items) {
        const cid = typeof item.clinicId === 'object' && item.clinicId ? item.clinicId._id : item.clinicId;
        if (cid) expect(cid, p).toBe(f.b.clinic._id);
      }
      if (['patients', 'consultations', 'vitals', 'prescriptions', 'lab-reports', 'medical-images', 'referrals', 'teleconsultations', 'invoices', 'conditions', 'allergies', 'doctors'].some((k) => p.endsWith(k))) expect(items.length, p).toBe(p.endsWith('patients') ? 1 : 0);
    }
    const clinics = await api().get('/api/v1/clinics').set(auth(f.b.adminToken));
    expect(clinics.body.clinics.map((c) => c._id)).toEqual([f.b.clinic._id]);
    const users = await api().get('/api/v1/users').set(auth(f.b.adminToken));
    expect(users.body.users.every((u) => u.clinicId && u.clinicId._id === f.b.clinic._id)).toBe(true);
  });

  it('query/body clinicId from a clinic admin is ignored or rejected', async () => {
    const res = await api().get(`/api/v1/patients?clinicId=${f.a.clinic._id}`).set(auth(f.b.adminToken));
    expect(res.status).toBe(403);
    const hdr = await api().get('/api/v1/patients').set(auth(f.b.adminToken)).set('X-Clinic-Id', f.a.clinic._id);
    expect(hdr.status).toBe(403);
    const create = await api().post('/api/v1/patients').set(auth(f.b.adminToken)).send({ fullName: 'Intruder', clinicId: f.a.clinic._id });
    expect(create.status).toBe(403);
    const lab = await api().get(`/api/v1/lab-reports/clinic/${f.a.clinic._id}`).set(auth(f.b.adminToken));
    expect(lab.status).toBe(403);
  });

  it('clinic B cannot write into clinic A records (IDOR)', async () => {
    expect((await api().put(`/api/v1/patients/${f.pa._id}`).set(auth(f.b.adminToken)).send({ fullName: 'Hacked' })).status).toBe(404);
    expect((await api().delete(`/api/v1/patients/${f.pa._id}`).set(auth(f.b.adminToken))).status).toBe(404);
    expect((await api().put(`/api/v1/appointments/${dataA.appointment._id}`).set(auth(f.b.adminToken)).send({ status: 'Cancelled' })).status).toBe(404);
    expect((await api().post('/api/v1/appointments').set(auth(f.b.adminToken)).send({ patientId: f.pa._id, date: '2030-02-02' })).status).toBe(404);
    expect((await api().post('/api/v1/vitals').set(auth(f.b.adminToken)).send({ patientId: f.pa._id, vitalSigns: { heartRate: 70 } })).status).toBe(404);
    expect((await api().post('/api/v1/prescriptions').set(auth(f.b.adminToken)).send({ patientId: f.pa._id, medications: [{ name: 'X' }] })).status).toBe(404);
    expect((await api().put(`/api/v1/invoices/${dataA.invoice._id}/status`).set(auth(f.b.adminToken)).send({ status: 'Paid' })).status).toBe(404);
    expect((await api().put(`/api/v1/clinics/${f.a.clinic._id}`).set(auth(f.b.adminToken)).send({ name: 'Hacked' })).status).toBe(403);
    expect((await api().put(`/api/v1/clinics/${f.b.clinic._id}`).set(auth(f.b.adminToken)).send({ validityPeriod: { endDate: '2099-01-01' }, isActive: true, adminPassword: 'NewPass123' })).status).toBe(200);
    const still = await api().get(`/api/v1/clinics/${f.b.clinic._id}/validity`).set(auth(f.b.adminToken));
    expect(new Date(still.body.validity.endDate).getFullYear()).toBeLessThan(2099);
    const stillLogin = await api().post('/api/v1/auth/clinic-login').send({ email: f.b.adminEmail, password: 'Clinic12345' });
    expect(stillLogin.status).toBe(200);
    // cross-clinic practitioner reference in appointment
    expect((await api().post('/api/v1/appointments').set(auth(f.b.adminToken)).send({ patientId: f.pb._id, doctorId: dataA.doctor._id, date: '2030-03-03' })).status).toBe(404);
  });

  it('FHIR search is clinic scoped', async () => {
    const b = await api().get('/api/fhir/R4/Patient').set(auth(f.b.adminToken));
    expect(b.status).toBe(200);
    expect(b.body.total).toBe(1);
    expect(b.body.entry[0].resource.id).toBe(f.pb._id);
    const obs = await api().get(`/api/fhir/R4/Observation?patient=${f.pa._id}`).set(auth(f.b.adminToken));
    expect(obs.body.total).toBe(0);
    const sma = await api().get('/api/fhir/R4/Patient').set(auth(f.adminToken));
    expect(sma.body.total).toBe(2);
  });

  it('super master admin sees both clinics and is audited', async () => {
    const res = await api().get('/api/v1/patients').set(auth(f.adminToken));
    expect(res.body.count).toBe(2);
    const own = await api().get(`/api/v1/patients/${f.pa._id}`).set(auth(f.adminToken));
    expect(own.status).toBe(200);
    const audit = await api().get('/api/v1/audit?limit=50').set(auth(f.adminToken));
    expect(audit.body.data.some((a) => a.action === 'PATIENT_VIEWED' && a.resourceId === f.pa._id)).toBe(true);
  });

  it('clinic admin only sees its own audit trail and cannot use system endpoints', async () => {
    const audit = await api().get('/api/v1/audit?limit=100').set(auth(f.b.adminToken));
    expect(audit.status).toBe(200);
    expect(audit.body.data.every((a) => a.clinicId === f.b.clinic._id)).toBe(true);
    expect((await api().get('/api/v1/dashboard/super-master-stats').set(auth(f.b.adminToken))).status).toBe(403);
    expect((await api().get('/api/v1/dashboard/system-health').set(auth(f.b.adminToken))).status).toBe(403);
    expect((await api().post('/api/v1/clinics').set(auth(f.b.adminToken)).send({ name: 'X', adminName: 'x', adminEmail: 'x@x.com', adminPassword: 'Clinic12345' })).status).toBe(403);
    expect((await api().put(`/api/v1/clinics/${f.b.clinic._id}/renew`).set(auth(f.b.adminToken)).send({ duration: 12 })).status).toBe(403);
    expect((await api().delete(`/api/v1/clinics/${f.b.clinic._id}`).set(auth(f.b.adminToken))).status).toBe(403);
  });

  it('search results are clinic scoped', async () => {
    const res = await api().get('/api/v1/search/global?q=Test').set(auth(f.b.adminToken));
    expect(res.body.patients.map((p) => p._id)).toEqual([f.pb._id]);
    expect(res.body.clinics).toEqual([]);
  });
});
void path;
