'use strict';
/**
 * checkConsultantLogin.js — gate for modules/practitioners/consultantLogin.js (2026-10-08, RBAC).
 *
 * Exercises the real module against a scratch LOCAL MongoDB database (dropped at the end). Only the connection
 * module is substituted (it needs the full env/config stack); bcrypt, AppError and the password policy are the
 * real ones. Proves: a practitioner with consultantLogin gets a consultant account in `doctors` / `nurses` with the
 * consultant app's native shape (ObjectId _id, bcrypt passwordHash, role, ObjectId clinicId, link both ways);
 * the role allow-list per kind, the password policy, the email clash check; deactivation and edits follow the
 * practitioner; the password never reaches the practitioner record.
 *
 *   node src/tools/checkConsultantLogin.js        (MONGODB_URI_GATE, default mongodb://127.0.0.1:27017)
 * Dependencies: mongodb + bcryptjs (NODE_PATH may point at another checkout's node_modules).
 */
const Module = require('module');
const path = require('path');
const crypto = require('crypto');
const URI = process.env.MONGODB_URI_GATE || 'mongodb://127.0.0.1:27017';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(URI)) { console.error('NOT LOCAL'); process.exit(3); }
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

let db;
const connPath = path.join(__dirname, '..', 'infrastructure', 'mongodb', 'connection.js');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent && /consultantLogin\.js$/.test(parent.filename) && request.endsWith('infrastructure/mongodb/connection')) return { getDb: () => db };
  return origLoad.apply(this, arguments);
};
void connPath;
const cl = require('../modules/practitioners/consultantLogin');

let cases = 0; let fails = 0;
const check = (ok, msg) => { cases += 1; if (!ok) fails += 1; console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${msg}`); return ok; };
const expectError = async (fn, code, msg) => { try { await fn(); check(false, `${msg} (no error)`); } catch (e) { check(e.code === code, `${msg} -> ${e.code}`); } };

(async () => {
  const client = await MongoClient.connect(URI, { serverSelectionTimeoutMS: 10000 });
  db = client.db('emr_gate_consultant_login');
  await db.dropDatabase();
  const clinicId = new ObjectId();
  const tdb = { session: null };
  const prac = (kind, extra = {}) => ({ _id: crypto.randomUUID(), kind, fullName: `Gate ${kind}`, email: `gate-${kind}-${Math.random().toString(36).slice(2, 7)}@example.invalid`, clinicId: String(clinicId), isActive: true, ...extra });

  // takeLogin keeps the password away from the practitioner record
  const t = cl.takeLogin({ fullName: 'X', consultantLogin: { role: 'doctor', password: 'Secret-pass-1' } });
  check(t.login && t.login.password && !('consultantLogin' in t.input), 'takeLogin strips consultantLogin from the practitioner input');

  // create: physiotherapist from a doctor-kind practitioner
  const p1 = prac('doctor');
  const link = await cl.provision(tdb, p1, { role: 'physiotherapist', password: 'Physio-pass-123' }, { creating: true });
  const acc = await db.collection('doctors').findOne({ email: p1.email });
  check(link && link.collection === 'doctors' && link.role === 'physiotherapist', `link returned ${JSON.stringify(link)}`);
  check(acc && acc._id instanceof ObjectId && String(acc._id) === link.id, 'consultant account has an ObjectId _id equal to the link id');
  check(acc && acc.role === 'physiotherapist' && acc.clinicId instanceof ObjectId && String(acc.clinicId) === String(clinicId), 'role physiotherapist, clinicId stored as ObjectId');
  check(acc && acc.emrPractitionerId === p1._id, 'consultant account links back to the practitioner');
  check(acc && acc.passwordHash.startsWith('$2') && (await bcrypt.compare('Physio-pass-123', acc.passwordHash)), 'bcrypt hash verifies with the chosen password');
  check(acc && acc.uhid && acc.profileImage && acc.qualification && acc.about && acc.currentAddress, 'fields the consultant Doctor schema requires are present');

  // defaults and the nurse side
  const p2 = prac('nurse');
  const l2 = await cl.provision(tdb, p2, { password: 'Nurse-pass-123' }, { creating: true });
  const n2 = await db.collection('nurses').findOne({ email: p2.email });
  check(l2.role === 'nurse' && n2 && n2.role === 'nurse' && Array.isArray(n2.department), 'nurse practitioner -> nurses account, default role nurse');

  // refusals
  await expectError(() => cl.provision(tdb, prac('nurse'), { role: 'doctor', password: 'Some-pass-123' }, { creating: true }), 'CONSULTANT_ROLE_INVALID', 'nurse given role doctor');
  await expectError(() => cl.provision(tdb, prac('doctor'), { role: 'pharmacist', password: 'Some-pass-123' }, { creating: true }), 'CONSULTANT_ROLE_INVALID', 'doctor given role pharmacist');
  await expectError(() => cl.provision(tdb, prac('lab_technician'), { password: 'Some-pass-123' }, { creating: true }), 'CONSULTANT_LOGIN_UNSUPPORTED', 'lab technician');
  await expectError(() => cl.provision(tdb, prac('doctor'), { role: 'doctor', password: 'short' }, { creating: true }), 'WEAK_PASSWORD', 'weak password');
  await expectError(() => cl.provision(tdb, prac('doctor'), { role: 'doctor' }, { creating: true }), 'PASSWORD_REQUIRED', 'no password on create');
  await expectError(() => cl.provision(tdb, prac('doctor', { email: null }), { role: 'doctor', password: 'Some-pass-123' }, { creating: true }), 'EMAIL_REQUIRED', 'no email');
  await expectError(() => cl.provision(tdb, prac('doctor', { email: p1.email }), { role: 'doctor', password: 'Some-pass-123' }, { creating: true }), 'CONSULTANT_ACCOUNT_EXISTS', 'email already used by another consultant account');
  await expectError(() => cl.provision(tdb, prac('doctor', { clinicId: crypto.randomUUID() }), { role: 'doctor', password: 'Some-pass-123' }, { creating: true }), 'CLINIC_ID_FORMAT', 'UUID clinic id');

  // edits follow the practitioner; deactivation locks the account
  const p1b = { ...p1, consultantAccount: link, fullName: 'Gate Renamed', isActive: false };
  await cl.syncLinked(tdb, p1b);
  const acc2 = await db.collection('doctors').findOne({ _id: acc._id });
  check(acc2.isActive === false && acc2.fullName === 'Gate Renamed', 'deactivating / renaming the practitioner updates the consultant account');
  await cl.provision(tdb, { ...p1b, isActive: true }, { password: 'New-physio-pass-9' }, { creating: false });
  const acc3 = await db.collection('doctors').findOne({ _id: acc._id });
  check(await bcrypt.compare('New-physio-pass-9', acc3.passwordHash) && acc3.isActive === true && acc3.role === 'physiotherapist', 'password reset on the linked account keeps its role');
  check((await db.collection('doctors').countDocuments({ email: p1.email })) === 1, 're-provisioning never creates a second account');

  await db.dropDatabase();
  await client.close();
  console.log(`\nconsultantLogin gate: ${cases} cases, ${fails} failed`);
  process.exit(fails || !cases ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e && e.stack || e); process.exit(1); });
