'use strict';
/** Post-migration validation: counts, relationships, identifiers, dates, duplicates. */
async function validate(knex, src, plan, { uuidFor }) {
  const failures = [];
  const checks = {};
  const count = async (t) => Number((await knex(t).count({ c: '*' }))[0].c);
  const expected = { clinics: plan.tables.clinics.length, patients: plan.tables.patients.length, appointments: plan.tables.appointments.length, encounters: plan.tables.encounters.length, vitals: plan.tables.vitals.length, prescriptions: plan.tables.prescriptions.length, referrals: plan.tables.referrals.length, invoices: plan.tables.invoices.length, imaging_studies: plan.tables.imaging_studies.length, lab_results: plan.tables.lab_results.length };
  for (const [t, exp] of Object.entries(expected)) {
    const actual = await count(t);
    checks[t] = { planned: exp, inDatabase: actual, sourceDocuments: src[{ encounters: 'consultations', imaging_studies: 'medicalimages', lab_results: 'labreports', invoices: 'invoices' }[t] || t]?.length };
    if (actual < exp) failures.push(`${t}: ${actual} rows in database, ${exp} planned`);
  }
  // relationships
  const orphans = await knex.raw(`
    select 'appointments' as t, count(*) c from appointments a left join patients p on p.id = a.patient_id where p.id is null
    union all select 'encounters', count(*) from encounters e left join patients p on p.id = e.patient_id where p.id is null
    union all select 'prescriptions', count(*) from prescriptions r left join patients p on p.id = r.patient_id where p.id is null
    union all select 'patients_clinic', count(*) from patients p left join clinics c on c.id = p.clinic_id where c.id is null
    union all select 'users_clinic', count(*) from users u left join clinics c on c.id = u.clinic_id where u.clinic_id is not null and c.id is null`);
  checks.orphans = Object.fromEntries(orphans.rows.map((r) => [r.t, Number(r.c)]));
  for (const [k, v] of Object.entries(checks.orphans)) if (v > 0) failures.push(`orphan references in ${k}: ${v}`);
  // identifiers
  const dupUhid = await knex.raw(`select clinic_id, value, count(*) c from patient_identifiers where system = 'uhid' group by clinic_id, value having count(*) > 1`);
  checks.duplicateUhids = dupUhid.rows.length;
  if (dupUhid.rows.length) failures.push(`duplicate UHIDs within a clinic: ${dupUhid.rows.length}`);
  const dupEmails = await knex.raw(`select email, count(*) c from users where deleted_at is null group by email having count(*) > 1`);
  if (dupEmails.rows.length) failures.push(`duplicate user emails: ${dupEmails.rows.length}`);
  // every migrated patient resolvable through the legacy id map
  const mapped = Number((await knex('legacy_id_map').where('collection', 'patients').count({ c: '*' }))[0].c);
  checks.legacyIdMapPatients = mapped;
  if (mapped < plan.tables.patients.length) failures.push(`legacy_id_map has ${mapped} patient mappings, expected ${plan.tables.patients.length}`);
  for (const p of plan.tables.patients.slice(0, 50)) if (uuidFor('patients', p.__legacy.id) !== p.id) failures.push(`non-deterministic id for patient ${p.__legacy.id}`);
  // dates
  const badDates = await knex.raw(`select count(*) c from appointments where scheduled_at < '1900-01-01' or scheduled_at > now() + interval '10 years'`);
  checks.appointmentsWithImplausibleDates = Number(badDates.rows[0].c);
  if (checks.appointmentsWithImplausibleDates) failures.push(`appointments with implausible dates: ${checks.appointmentsWithImplausibleDates}`);
  // documents
  const noKey = await knex.raw(`select count(*) c from documents where storage_key is null or storage_key = 'unknown'`);
  checks.documentsWithoutStorageKey = Number(noKey.rows[0].c);
  // clinical history per patient (sample)
  const sample = await knex.raw(`select p.id, (select count(*) from encounters e where e.patient_id = p.id) enc, (select count(*) from vitals v where v.patient_id = p.id) vit from patients p order by p.created_at limit 20`);
  checks.sampleClinicalHistory = sample.rows.map((r) => ({ patientId: r.id, encounters: Number(r.enc), vitals: Number(r.vit) }));
  return { checks, failures };
}
module.exports = { validate };
