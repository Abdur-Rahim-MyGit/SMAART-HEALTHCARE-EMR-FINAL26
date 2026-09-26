'use strict';
/** Migration test: a legacy-shaped fixture (Mongo documents) is planned, applied twice (idempotent) and validated. */
const bcrypt = require('bcryptjs');
const { resetData, api, login } = require('../helpers/api');
const { runMigration, uuidFor } = require('../../src/tools/migrate-legacy-data/run');
const { getKnex } = require('../../src/infrastructure/postgres/knex');
const { withSystem } = require('../../src/infrastructure/postgres/tenant');
const count = (t) => withSystem(async (trx) => Number((await trx(t).count({ c: '*' }))[0].c), getKnex());
const one = (t, where) => withSystem((trx) => trx(t).where(where).first(), getKnex());

const oid = (n) => n.toString(16).padStart(24, '0');
function fixture() {
  const clinicA = oid(1), clinicB = oid(2), docA = oid(11), patA = oid(21), patB = oid(22), apptA = oid(31), consA = oid(41);
  return {
    clinics: [
      { _id: clinicA, name: 'Legacy Clinic A', type: 'General', adminEmail: 'AdminA@legacy.local', adminName: 'Ann Admin', adminPassword: 'plain-text-123', validityPeriod: { startDate: '2025-01-01', endDate: '2027-01-01', duration: 24 }, createdAt: '2025-01-01' },
      { _id: clinicB, name: 'Legacy Clinic B', adminEmail: 'adminb@legacy.local', adminName: 'Bob', passwordHash: bcrypt.hashSync('Bcrypt12345', 10), isActive: true },
    ],
    users: [
      { _id: oid(5), email: 'root@legacy.local', role: 'super_master_admin', password: bcrypt.hashSync('Root12345', 10), firstName: 'Root', lastName: 'Admin' },
      { _id: oid(6), email: 'nurse@legacy.local', role: 'nurse', password: 'x', clinicId: clinicA },
    ],
    doctors: [{ _id: docA, fullName: 'Dr Legacy', email: 'DrL@legacy.local', specialty: 'Cardiology', clinicId: clinicA, passwordHash: 'irrelevant' }],
    nurses: [{ _id: oid(12), fullName: 'Nurse N', email: 'n@legacy.local', clinicId: clinicA, department: 'ICU' }],
    patients: [
      { _id: patA, fullName: 'Paul McCartney', dateOfBirth: '1990-05-15', gender: 'male', attenderMobile: '9840987654', bloodType: 'O+', uhid: 'uh-a-1', aadhaarNumber: '123456789012', clinicId: clinicA, maritalStatus: false, insuranceInfo: { provider: 'Star' }, profileImage: 'data:image/png;base64,AAAA', createdAt: '2025-02-01' },
      { _id: patB, fullName: 'Beth', clinicId: clinicB, gender: 'Female' },
      { _id: oid(23), fullName: 'Orphan', clinicId: oid(99) },
    ],
    appointments: [{ _id: apptA, patientId: patA, doctorId: docA, clinicId: clinicA, date: '2025-03-01', time: '10:30', appointmentType: 'General Consultation', status: 'Completed', duration: 30 }],
    consultations: [{ _id: consA, patientId: patA, clinicId: clinicA, consultationType: 'General', mode: 'In-person', date: '2025-03-01', time: '11:00', diagnosis: 'Flu', providerNotes: 'Rest and fluids', provider: 'Dr. Johnson', prescriptions: [{ _id: oid(51), medication: 'Paracetamol', dosage: '500mg' }], labTests: [{ testName: 'CBC', priority: 'Routine' }] }],
    vitals: [{ _id: oid(61), patientId: patA, clinicId: clinicA, visitDate: '2025-03-01', vitalSigns: { bloodPressure: { systolic: 120, diastolic: 80 }, temperature: { value: 98.6, unit: '°F' }, weight: { value: 70 } }, recordedByName: 'Nurse N' }],
    prescriptions: [{ _id: oid(71), patientId: patA, doctorId: docA, clinicId: clinicA, prescriptionNumber: 'RX-OLD-1', date: '2025-03-02', diagnosis: 'Flu', status: 'Active', medications: [{ name: 'Amoxicillin', dosage: '250mg', frequency: 'TID', duration: '5 days' }] }],
    labreports: [{ _id: oid(81), patientId: patA, clinicId: clinicA, testName: 'CBC', testDate: '2025-03-03', fileName: 'cbc.pdf', filePath: 'https://res.cloudinary.com/x/raw/upload/cbc.pdf', cloudinaryPublicId: 'smaart/cbc', fileType: 'application/pdf', fileSize: 1234 }],
    medicalimages: [{ _id: oid(91), patientId: patA, uploadedBy: docA, imageUrl: 'https://example.com/xray.png', imageType: 'X-Ray', bodyPart: 'Chest', title: 'Chest X-Ray', mimeType: 'image/png', fileName: 'xray.png', fileSize: 999 }],
    referrals: [{ _id: oid(101), patientId: patA, clinicId: clinicA, specialistName: 'Dr S', specialty: 'Neuro', reason: 'Headache', urgency: 'High', status: 'Pending', referringProvider: { name: 'Dr Legacy' } }],
    invoices: [{ _id: oid(111), patientId: patA, clinicId: clinicA, invoiceNo: 'INV-OLD-1', total: 500, status: 'Paid', lineItems: [{ description: 'Consult', total: 500 }] }],
    billings: [{ _id: oid(121), patientId: patA, clinicId: clinicA, billId: 'BILL-1', totalAmount: 200, paymentStatus: 'pending' }],
    teleconsultations: [{ _id: oid(131), patientId: patA, doctorId: docA, clinicId: clinicA, scheduledDate: '2025-04-01T10:00:00Z', status: 'Completed', meetingId: 'm1' }],
    posts: [{ _id: oid(141), clinicId: clinicA, title: 'Hello', content: 'World', author: 'Ann', category: 'General' }],
    patientcaselogs: [{ _id: oid(151), patientId: patA, activityLog: [{ action: 'viewed', description: 'x', timestamp: '2025-03-01' }], loginHistory: [{ loginTime: '2025-03-02', ipAddress: '1.1.1.1' }] }],
  };
}

describe('legacy data migration', () => {
  beforeAll(async () => { await resetData(); });

  it('dry run plans every table and reports warnings without writing', async () => {
    const { report, plan } = await runMigration(fixture(), { apply: false });
    expect(report.mode).toBe('dry-run');
    expect(report.plan.clinics).toBe(2);
    expect(report.plan.users).toBe(3); // 2 clinic admins + 1 super master admin; the nurse is dropped
    expect(report.plan.practitioners).toBe(2);
    expect(report.plan.patients).toBe(2); // orphan skipped
    expect(report.plan.encounters).toBe(1);
    expect(report.plan.prescriptions).toBe(2); // embedded consultation prescription + standalone
    expect(report.plan.lab_orders).toBe(2);
    expect(report.plan.documents).toBe(2);
    expect(report.plan.invoices).toBe(2);
    expect(report.mongo).toEqual({ clinicalNotes: 1, communityPosts: 1, activityLogs: 2 });
    expect(report.warnings.join('\n')).toMatch(/plaintext/);
    expect(report.warnings.join('\n')).toMatch(/legacy role nurse removed/);
    expect(report.warnings.join('\n')).toMatch(/Orphan: unknown clinic/);
    expect(report.warnings.join('\n')).toMatch(/base64 profile image/);
    expect(plan.tables.users.every((u) => u.password_hash.startsWith('$2') || u.password_hash.startsWith('$argon2'))).toBe(true);
    expect(await count('patients')).toBe(0);
  });

  it('applies idempotently, validates, and the migrated data is usable through the API', async () => {
    const first = await runMigration(fixture(), { apply: true, writeMongo: false });
    expect(first.report.validation.failures).toEqual([]);
    expect(first.report.ok).toBe(true);
    const second = await runMigration(fixture(), { apply: true, writeMongo: false });
    expect(second.report.ok).toBe(true);
    expect(await count('patients')).toBe(2);
    expect(await count('legacy_id_map')).toBeGreaterThan(10);

    // legacy bcrypt clinic admin can log in and is transparently re-hashed
    const b = await login('adminb@legacy.local', 'Bcrypt12345', true);
    expect(b.user.role).toBe('clinic_admin');
    const hash = (await one('users', { email: 'adminb@legacy.local' })).password_hash;
    expect(hash.startsWith('$argon2id$')).toBe(true);
    // plaintext clinic admin password was hashed and still works
    const a = await login('admina@legacy.local', 'plain-text-123', true);
    const patientId = uuidFor('patients', oid(21));
    const p = await api().get(`/api/v1/patients/${patientId}`).set('Authorization', `Bearer ${a.token}`);
    expect(p.status).toBe(200);
    expect(p.body.patient.uhid).toBe('UH-A-1');
    expect(p.body.patient.aadhaarNumber).toBe('123456789012');
    expect(p.body.patient.bloodType).toBe('O+');
    const logs = await api().get(`/api/v1/patients/${patientId}/case-logs`).set('Authorization', `Bearer ${a.token}`);
    expect(logs.body.data.map((l) => l.type)).toEqual(expect.arrayContaining(['appointment', 'consultation', 'vitals', 'prescription', 'lab', 'imaging', 'referral']));
    // clinic B admin cannot see clinic A's migrated patient
    expect((await api().get(`/api/v1/patients/${patientId}`).set('Authorization', `Bearer ${b.token}`)).status).toBe(404);
    const rx = await api().get(`/api/v1/prescriptions/patient/${patientId}`).set('Authorization', `Bearer ${a.token}`);
    expect(rx.body.prescriptions.some((r) => r.prescriptionNumber === 'RX-OLD-1' && r.medications[0].name === 'Amoxicillin')).toBe(true);
    const imgs = await api().get(`/api/v1/medical-images/patient/${patientId}`).set('Authorization', `Bearer ${a.token}`);
    expect(imgs.body.data[0].imageUrl).toBe('https://example.com/xray.png');
    const inv = await api().get('/api/v1/invoices').set('Authorization', `Bearer ${a.token}`);
    expect(inv.body.data.map((i) => i.invoiceNumber).sort()).toEqual(['BILL-1', 'INV-OLD-1']);
    const fhir = await api().get(`/api/fhir/R4/Patient/${patientId}`).set('Authorization', `Bearer ${a.token}`);
    expect(fhir.body.identifier.some((i) => i.value === 'UH-A-1')).toBe(true);
  });
});
