'use strict';
const { api, resetData, adminToken, createClinic, createPatient } = require('../helpers/api');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7369b7e0000000049454e44ae426082', 'hex');

describe('REST API behaviour', () => {
  let t, c, p;
  beforeAll(async () => {
    await resetData();
    t = await adminToken();
    c = await createClinic(t);
    p = await createPatient(c.adminToken, { fullName: 'Paul McCartney', aadhaarNumber: '123456789012', bloodType: 'O+', maritalStatus: false, modeOfCare: 'In-person', insuranceInfo: { provider: 'Star' } });
  });

  it('health endpoints report dependencies', async () => {
    const h = await api().get('/health');
    expect(h.body.checks.map((x) => x.name)).toEqual(['postgres', 'mongodb', 'redis', 'rabbitmq']);
    expect((await api().get('/health/live')).status).toBe(200);
    expect([200, 503]).toContain((await api().get('/health/ready')).status);
    expect((await api().get('/metrics')).text).toContain('smaart_http_request_duration_seconds');
  });

  it('keeps the legacy patient contract for the UI', async () => {
    expect(p._id).toBe(p.id);
    expect(p.clinicId.name).toBeTruthy();
    expect(p.bloodType).toBe('O+');
    expect(p.uhid).toMatch(/^UH/);
    expect(p.aadhaarNumber).toBe('123456789012');
    expect(p.maritalStatus).toBe('Single');
    expect(p.insuranceInfo.provider).toBe('Star');
    expect(p).not.toHaveProperty('wallet');
    const list = await api().get('/api/v1/patients').set(auth(c.adminToken));
    expect(list.body.patients[0]._id).toBe(p._id);
  });

  it('validates input and returns a safe error envelope', async () => {
    const r = await api().post('/api/v1/patients').set(auth(c.adminToken)).send({ fullName: '', aadhaarNumber: '12' });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
    expect(r.body.requestId).toBeTruthy();
    const bad = await api().get('/api/v1/patients/not-a-uuid').set(auth(c.adminToken));
    expect(bad.status).toBe(422);
    const inj = await api().post('/api/v1/patients').set(auth(c.adminToken)).send({ fullName: 'x', $where: '1' });
    expect(inj.status).toBe(400);
    const proto = await api().post('/api/v1/patients').set(auth(c.adminToken)).set('Content-Type', 'application/json').send('{"fullName":"x","__proto__":{"admin":true}}');
    expect(proto.status).toBe(400);
  });

  it('search input is escaped (no regex/like injection)', async () => {
    const r = await api().get('/api/v1/search/global?q=%25%25%25').set(auth(c.adminToken));
    expect(r.status).toBe(200);
    expect(r.body.patients).toEqual([]);
    const r2 = await api().get('/api/v1/search/global?q=(a%2B)%2B%24').set(auth(c.adminToken));
    expect(r2.status).toBe(200);
  });

  it('stores profile pictures as documents, not inline base64', async () => {
    const r = await api().put(`/api/v1/patients/${p._id}`).set(auth(c.adminToken)).send({ profileImage: `data:image/png;base64,${PNG.toString('base64')}` });
    expect(r.status).toBe(200);
    expect(r.body.patient.profileImage).toMatch(/^\/api\/v1\/documents\/local\//);
    const docs = await api().get(`/api/v1/documents?patientId=${p._id}`).set(auth(c.adminToken));
    expect(docs.body.data.some((d) => d.category === 'profile')).toBe(true);
    const file = await api().get(r.body.patient.profileImage);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('image/png');
  });

  it('document upload validates content and access is signed and audited', async () => {
    const up = await api().post('/api/v1/documents').set(auth(c.adminToken)).field('patientId', p._id).field('category', 'clinical').attach('file', PNG, 'scan.png');
    expect(up.status).toBe(201);
    expect(up.body.data).not.toHaveProperty('storageKey');
    const access = await api().get(`/api/v1/documents/${up.body.data._id}/access`).set(auth(c.adminToken));
    expect(access.body.data.url).toBeTruthy();
    expect(access.headers['cache-control']).toContain('no-store');
    const bad = await api().post('/api/v1/documents').set(auth(c.adminToken)).field('patientId', p._id).attach('file', Buffer.from('MZ\0\0evil'), 'x.png');
    expect(bad.status).toBe(400);
    const mism = await api().post('/api/v1/documents').set(auth(c.adminToken)).field('patientId', p._id).attach('file', PNG, 'x.pdf');
    expect(mism.status).toBe(400);
    const dl = await api().get(`/api/v1/documents/${up.body.data._id}/download`).set(auth(c.adminToken));
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toContain('attachment');
    const audit = await api().get('/api/v1/audit?limit=50').set(auth(c.adminToken));
    const actions = audit.body.data.map((a) => a.action);
    expect(actions).toContain('DOCUMENT_UPLOADED');
    expect(actions).toContain('DOCUMENT_VIEWED');
    expect(actions).toContain('DOCUMENT_DOWNLOADED');
    expect((await api().delete(`/api/v1/documents/${up.body.data._id}`).set(auth(c.adminToken))).status).toBe(200);
    expect((await api().get(`/api/v1/documents/${up.body.data._id}/access`).set(auth(c.adminToken))).status).toBe(404);
  });

  it('appointment double booking is prevented and optimistic locking works', async () => {
    const d = (await api().post('/api/v1/doctors').set(auth(c.adminToken)).send({ fullName: 'Dr A' })).body.doctor;
    const a1 = await api().post('/api/v1/appointments').set(auth(c.adminToken)).send({ patientId: p._id, doctorId: d._id, date: '2030-05-05', time: '10:00' });
    expect(a1.status).toBe(201);
    expect(a1.body.appointment.patientId.fullName).toBe('Paul McCartney');
    expect(a1.body.appointment.doctorId.fullName).toBe('Dr A');
    const a2 = await api().post('/api/v1/appointments').set(auth(c.adminToken)).send({ patientId: p._id, doctorId: d._id, date: '2030-05-05', time: '10:00' });
    expect(a2.status).toBe(409);
    const stale = await api().put(`/api/v1/appointments/${a1.body.appointment._id}`).set(auth(c.adminToken)).send({ status: 'Confirmed', version: 999 });
    expect(stale.status).toBe(409);
    const ok = await api().put(`/api/v1/appointments/${a1.body.appointment._id}`).set(auth(c.adminToken)).send({ status: 'Cancelled' });
    expect(ok.status).toBe(200);
  });

  it('clinic responses never contain admin passwords and clinic admins get a limited view', async () => {
    const r = await api().get(`/api/v1/clinics/${c.clinic._id}`).set(auth(t));
    expect(JSON.stringify(r.body)).not.toMatch(/adminPassword|passwordHash|password_hash/);
    const own = await api().get(`/api/v1/clinics/${c.clinic._id}`).set(auth(c.adminToken));
    expect(own.status).toBe(200);
    expect(own.body.clinic.validityPeriod.endDate).toBeTruthy();
    const list = await api().get('/api/v1/clinics').set(auth(c.adminToken));
    expect(list.body.clinics[0]).not.toHaveProperty('bankInfo');
  });

  it('super master admin can rotate a clinic admin password, which revokes sessions', async () => {
    const r = await api().put(`/api/v1/clinics/${c.clinic._id}`).set(auth(t)).send({ adminPassword: 'Rotated12345' });
    expect(r.status).toBe(200);
    expect((await api().get('/api/v1/auth/me').set(auth(c.adminToken))).status).toBe(401);
    const relogin = await api().post('/api/v1/auth/clinic-login').send({ email: c.adminEmail, password: 'Rotated12345' });
    expect(relogin.status).toBe(200);
    c.adminToken = relogin.body.token;
  });

  it('dashboard, case logs, timeline pagination and billing contracts work', async () => {
    const c2 = await createClinic(t);
    const p2 = await createPatient(c2.adminToken);
    await api().post('/api/v1/vitals').set(auth(c2.adminToken)).send({ patientId: p2._id, vitalSigns: { heartRate: { value: 72 } } });
    await api().post('/api/v1/prescriptions').set(auth(c2.adminToken)).send({ patientId: p2._id, medications: [{ name: 'A' }, { name: 'B' }] });
    const logs = await api().get(`/api/v1/patients/${p2._id}/case-logs`).set(auth(c2.adminToken));
    expect(logs.body.data.map((l) => l.type).sort()).toEqual(['prescription', 'prescription', 'registration', 'vitals']);
    const page1 = await api().get(`/api/v1/patients/${p2._id}/timeline?limit=2`).set(auth(c2.adminToken));
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.nextCursor).toBeTruthy();
    const page2 = await api().get(`/api/v1/patients/${p2._id}/timeline?limit=2&cursor=${page1.body.nextCursor}`).set(auth(c2.adminToken));
    expect(page2.body.data.length).toBeGreaterThan(0);
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);
    const dash = await api().get(`/api/v1/clinics/${c2.clinic._id}/dashboard-data`).set(auth(c2.adminToken));
    expect(dash.body.data.stats.totalPatients).toBe(1);
    const sma = await api().get('/api/v1/dashboard/super-master-stats').set(auth(t));
    expect(sma.body.data.overview.totalClinics).toBeGreaterThanOrEqual(2);
    const inv = await api().post('/api/v1/invoices').set(auth(c2.adminToken)).send({ patientId: p2._id, lineItems: [{ description: 'Consult', quantity: 2, unitPrice: 250 }], tax: 50 });
    expect(inv.body.data.total).toBe(550);
    const pay = await api().post(`/api/v1/invoices/${inv.body.data._id}/payments`).set(auth(c2.adminToken)).send({ amount: 550, method: 'cash' });
    expect(pay.body.data.status).toBe('Paid');
    const bills = await api().get('/api/v1/billing').set(auth(c2.adminToken));
    expect(bills.body.bills[0].amount).toBe(550);
    const stats = await api().get('/api/v1/invoices/stats').set(auth(c2.adminToken));
    expect(stats.body.data.totalRevenue).toBe(550);
  });

  it('users endpoint hides secrets and OTPs', async () => {
    const r = await api().get('/api/v1/users').set(auth(t));
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(/password|otp|resetOTP/i);
    expect(r.body.users.every((u) => ['super_master_admin', 'clinic_admin'].includes(u.role))).toBe(true);
  });

  it('teleconsultation participants come from the authenticated identity', async () => {
    const tc = await api().post('/api/v1/teleconsultations').set(auth(c.adminToken)).send({ patientId: p._id, scheduledDate: '2030-06-06T10:00:00Z' });
    expect(tc.status).toBe(201);
    const j = await api().post(`/api/v1/teleconsultations/${tc.body.data._id}/join`).set(auth(c.adminToken)).send({ userId: 'spoofed', role: 'super_master_admin' });
    expect(j.body.data.participants[0].role).toBe('clinic_admin');
    expect(j.body.data.participants[0].userId).not.toBe('spoofed');
    const e = await api().post(`/api/v1/teleconsultations/${tc.body.data._id}/end`).set(auth(c.adminToken)).send({ diagnosis: 'ok' });
    expect(e.body.data.status).toBe('Completed');
    expect(e.body.data.encounterId).toBeTruthy();
  });

  it('idempotency keys replay the first response', async () => {
    const key = `idem-${Date.now()}`;
    const first = await api().post('/api/fhir/R4/Patient').set(auth(c.adminToken)).set('Idempotency-Key', key).send({ resourceType: 'Patient', name: [{ given: ['Ida'], family: 'Potent' }], gender: 'female' });
    expect(first.status).toBe(201);
    const second = await api().post('/api/fhir/R4/Patient').set(auth(c.adminToken)).set('Idempotency-Key', key).send({ resourceType: 'Patient', name: [{ given: ['Ida'], family: 'Potent' }], gender: 'female' });
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.headers['idempotent-replayed']).toBe('true');
  });
});
