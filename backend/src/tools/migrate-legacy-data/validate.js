'use strict';
/** Post-migration validation: counts, relationships, identifiers, dates, duplicates. */

async function validate(db, src, plan, { uuidFor }) {
  const failures = [];
  const checks = {};
  const col = (name) => db.raw(name);
  const count = (name, filter = {}) => col(name).countDocuments(filter);
  const expected = { clinics: plan.tables.clinics.length, patients: plan.tables.patients.length, appointments: plan.tables.appointments.length, encounters: plan.tables.encounters.length, vitals: plan.tables.vitals.length, prescriptions: plan.tables.prescriptions.length, referrals: plan.tables.referrals.length, invoices: plan.tables.invoices.length, imaging_studies: plan.tables.imaging_studies.length, lab_results: plan.tables.lab_results.length };
  const sourceOf = { encounters: 'consultations', imaging_studies: 'medicalimages', lab_results: 'labreports' };
  for (const [t, exp] of Object.entries(expected)) {
    const actual = await count(t);
    checks[t] = { planned: exp, inDatabase: actual, sourceDocuments: src[sourceOf[t] || t]?.length };
    if (actual < exp) failures.push(`${t}: ${actual} documents in database, ${exp} planned`);
  }
  // relationships: every reference resolves
  const patientIds = new Set(await col('patients').distinct('_id'));
  const clinicIds = new Set(await col('clinics').distinct('_id'));
  const missing = async (name, field, set) => (await col(name).distinct(field, { [field]: { $ne: null } })).filter((v) => !set.has(v)).length;
  checks.orphans = { appointments: await missing('appointments', 'patientId', patientIds), encounters: await missing('encounters', 'patientId', patientIds), prescriptions: await missing('prescriptions', 'patientId', patientIds), patients_clinic: await missing('patients', 'clinicId', clinicIds), users_clinic: await missing('users', 'clinicId', clinicIds) };
  for (const [k, v] of Object.entries(checks.orphans)) if (v > 0) failures.push(`orphan references in ${k}: ${v}`);
  // identifiers
  const dupUhid = await col('patient_identifiers').aggregate([{ $match: { system: 'uhid' } }, { $group: { _id: { clinicId: '$clinicId', value: '$value' }, c: { $sum: 1 } } }, { $match: { c: { $gt: 1 } } }]).toArray();
  checks.duplicateUhids = dupUhid.length;
  if (dupUhid.length) failures.push(`duplicate UHIDs within a clinic: ${dupUhid.length}`);
  const dupEmails = await col('users').aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$email', c: { $sum: 1 } } }, { $match: { c: { $gt: 1 } } }]).toArray();
  if (dupEmails.length) failures.push(`duplicate user emails: ${dupEmails.length}`);
  // every migrated patient resolvable through the legacy id map
  const mapped = await count('legacy_id_map', { collection: 'patients' });
  checks.legacyIdMapPatients = mapped;
  if (mapped < plan.tables.patients.length) failures.push(`legacy_id_map has ${mapped} patient mappings, expected ${plan.tables.patients.length}`);
  for (const p of plan.tables.patients.slice(0, 50)) if (uuidFor('patients', p.__legacy.id) !== p.id) failures.push(`non-deterministic id for patient ${p.__legacy.id}`);
  // dates
  checks.appointmentsWithImplausibleDates = await count('appointments', { $or: [{ scheduledAt: { $lt: new Date('1900-01-01') } }, { scheduledAt: { $gt: new Date(Date.now() + 10 * 365 * 86400000) } }] });
  if (checks.appointmentsWithImplausibleDates) failures.push(`appointments with implausible dates: ${checks.appointmentsWithImplausibleDates}`);
  // documents
  checks.documentsWithoutStorageKey = await count('documents', { $or: [{ storageKey: null }, { storageKey: 'unknown' }] });
  // clinical history per patient (sample)
  const sample = await col('patients').find({}, { projection: { _id: 1 }, sort: { createdAt: 1 }, limit: 20 }).toArray();
  checks.sampleClinicalHistory = [];
  for (const p of sample) checks.sampleClinicalHistory.push({ patientId: p._id, encounters: await count('encounters', { patientId: p._id }), vitals: await count('vitals', { patientId: p._id }) });
  return { checks, failures };
}
module.exports = { validate };
