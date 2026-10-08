'use strict';
/**
 * Consultant-app sign-in for an EMR practitioner (2026-10-08, RBAC).
 *
 * WHY. This EMR has two application roles (super_master_admin, clinic_admin); doctors and nurses are clinical
 * resources here, kept in `practitioners`, and never sign in to the EMR. The consultant app (Knee CDSS) is where
 * they work, and it signs staff in from its own collections in this SAME database (emr_healthcare_db):
 * `doctors` (roles doctor / admin / physiotherapist) and `nurses` (nurse / head_nurse / supervisor). Until now a
 * doctor created here could not sign in there at all.
 *
 * WHAT. When the clinic admin creates or edits a practitioner with `consultantLogin: { role, password }`, this
 * writes (or updates) the matching consultant account — bcrypt hash, role, the practitioner's clinic, an ObjectId
 * `_id` (the consultant app's ids are ObjectIds) — and links the two both ways:
 *     practitioners.consultantAccount = { collection, id, role }     <->     doctors|nurses.emrPractitionerId
 * Afterwards name / email / phone / specialty / active status follow the practitioner on every update, so
 * deactivating a doctor here locks them out of the consultant app on their next request.
 *
 * The consultant app needs no change to sign these accounts in: they are its own native account shape. Which
 * consultant role may do what is decided by the shared matrix (consultant repo backend/config/permissions.js).
 * The password is never stored on the practitioner, never in `attributes`, never logged.
 */
const { ObjectId } = require('mongodb');
const { getDb } = require('../../infrastructure/mongodb/connection');
const { hashPassword, validatePasswordStrength } = require('../../common/security/password');
const { badRequest, conflict } = require('../../common/errors/AppError');

/* Which consultant roles a practitioner kind may be given. A lab technician has no consultant-app role. */
const ROLES_BY_KIND = Object.freeze({
  doctor: ['doctor', 'physiotherapist', 'admin'],
  nurse: ['nurse', 'head_nurse', 'supervisor'],
});
const COLLECTION_BY_KIND = Object.freeze({ doctor: 'doctors', nurse: 'nurses' });
const STAFF_COLLECTIONS = ['doctors', 'nurses', 'pharmacists', 'receptionists'];
const PLACEHOLDER = 'Not recorded';

/** Pull `consultantLogin` off the request body so it can never reach toDoc()/attributes. */
function takeLogin(input) {
  if (!input || input.consultantLogin === undefined) return { login: null, input };
  const { consultantLogin, ...rest } = input;
  return { login: consultantLogin || null, input: rest };
}

function asObjectId(v) {
  if (v instanceof ObjectId) return v;
  if (typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v)) return new ObjectId(v);
  return null;
}

function checkLogin(kind, login, { creating }) {
  const allowed = ROLES_BY_KIND[kind];
  if (!allowed) throw badRequest(`A ${kind} has no consultant-app sign-in`, 'CONSULTANT_LOGIN_UNSUPPORTED');
  const role = login.role || (creating ? allowed[0] : undefined);
  if (role !== undefined && !allowed.includes(role)) {
    throw badRequest(`consultantLogin.role for a ${kind} must be one of: ${allowed.join(', ')}`, 'CONSULTANT_ROLE_INVALID');
  }
  if (login.password !== undefined) {
    const problems = validatePasswordStrength(login.password);
    if (problems.length) throw badRequest(`Password needs ${problems.join(', ')}`, 'WEAK_PASSWORD');
  }
  return role;
}

/** The fields the consultant account mirrors from the practitioner. */
function mirrored(p) {
  const out = { fullName: p.fullName, isActive: p.isActive !== false, updatedAt: new Date() };
  if (p.email) out.email = String(p.email).toLowerCase();
  if (p.phone !== undefined) out.phone = p.phone;
  if (p.specialty) out.specialty = p.specialty;
  return out;
}

/**
 * Create or update the consultant account for `practitioner`. `db` is the TenantDb of the calling service (its
 * session keeps this inside the same transaction). Returns the link stored on the practitioner, or null.
 */
async function provision(db, practitioner, login, { creating }) {
  if (!login) return null;
  const kind = practitioner.kind;
  const role = checkLogin(kind, login, { creating: creating || !practitioner.consultantAccount });
  const session = db && db.session ? { session: db.session } : {};
  const raw = getDb();
  const email = practitioner.email ? String(practitioner.email).toLowerCase() : null;
  if (!email) throw badRequest('A consultant-app sign-in needs the practitioner\'s email (it is the sign-in ID)', 'EMAIL_REQUIRED');
  const clinicId = asObjectId(practitioner.clinicId);
  if (!clinicId) throw badRequest('The practitioner\'s clinic id is not an ObjectId; the consultant app cannot scope it', 'CLINIC_ID_FORMAT');

  // The email is the sign-in ID across all four consultant staff collections: refuse a clash with someone else.
  for (const col of STAFF_COLLECTIONS) {
    const other = await raw.collection(col).findOne({ email }, { projection: { _id: 1, emrPractitionerId: 1 }, ...session });
    if (other && String(other.emrPractitionerId || '') !== String(practitioner._id)) {
      throw conflict(`A consultant-app account with ${email} already exists`, 'CONSULTANT_ACCOUNT_EXISTS');
    }
  }

  const link = practitioner.consultantAccount;
  const collection = COLLECTION_BY_KIND[kind];
  const set = { ...mirrored(practitioner) };
  if (role) set.role = role;
  if (login.password !== undefined) set.passwordHash = await hashPassword(login.password);

  if (link && link.id) {
    await raw.collection(link.collection).updateOne({ _id: asObjectId(link.id) || link.id }, { $set: set }, session);
    return { collection: link.collection, id: String(link.id), role: role || link.role };
  }
  if (!set.passwordHash) throw badRequest('consultantLogin.password is required to create a consultant-app sign-in', 'PASSWORD_REQUIRED');
  const _id = new ObjectId();
  const addr = { street: PLACEHOLDER, city: PLACEHOLDER, state: PLACEHOLDER, zipCode: PLACEHOLDER };
  const base = {
    _id, ...set, clinicId, emrPractitionerId: String(practitioner._id), createdAt: new Date(),
    uhid: practitioner.uhid || `EMR-${String(practitioner._id).replace(/-/g, '').slice(0, 10).toUpperCase()}`,
    profileImage: practitioner.profileImageUrl || 'https://placehold.co/200',
  };
  const doc = kind === 'doctor'
    ? { ...base, specialty: set.specialty || (role === 'physiotherapist' ? 'Physiotherapy' : 'General Practitioner'),
      qualification: practitioner.qualification || PLACEHOLDER, currentAddress: practitioner.currentAddress || addr,
      permanentAddress: practitioner.permanentAddress || addr, about: practitioner.about || `${role} — created in the EMR`, languages: practitioner.languages || [] }
    : { ...base, department: practitioner.department ? [practitioner.department] : ['General Nursing'], shift: practitioner.shift || 'Day', licenseNumber: practitioner.licenseNumber };
  await raw.collection(collection).insertOne(doc, session);
  return { collection, id: String(_id), role };
}

/** After a practitioner update / (de)activation: keep the linked consultant account in step. */
async function syncLinked(db, practitioner) {
  const link = practitioner && practitioner.consultantAccount;
  if (!link || !link.id) return;
  const session = db && db.session ? { session: db.session } : {};
  await getDb().collection(link.collection).updateOne({ _id: asObjectId(link.id) || link.id }, { $set: mirrored(practitioner) }, session);
}

module.exports = { takeLogin, provision, syncLinked, ROLES_BY_KIND, COLLECTION_BY_KIND };
