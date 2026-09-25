# Legacy MongoDB retirement checklist

The legacy collections (`users`, `clinics`, `doctors`, `nurses`, `patients`, `appointments`, `consultations`, `vitals`, `prescriptions`, `labreports`, `medicalimages`, `referrals`, `invoices`, `billings`, `teleconsultations`, `posts`, `patientcaselogs`, and the unused `activitylogs`, `auditlogs`, `compliancealerts`, `doctoravailabilities`, `emailconfigs`, `medications`, `otps`, `pharmacists`, `revenues`, `scheduleexceptions`, `teleconsultationinvoices`) are **not** touched by the migration tool.

Retire them only when every box is ticked:

- [ ] `npm run migrate:data -- --apply` finished with `ok: true` on production
- [ ] Validation report reviewed: counts match, no orphans, no duplicate UHIDs
- [ ] Clinic admins confirmed patient lists, appointments and clinical history in the UI (sample per clinic)
- [ ] Documents spot-checked: lab reports and images open through `/documents/:id/access`
- [ ] Full backup of the legacy database taken and stored encrypted for 7 years (audit retention)
- [ ] Legacy Atlas credentials rotated and the old cluster made read-only for a 30-day quarantine
- [ ] After quarantine: drop the legacy database
