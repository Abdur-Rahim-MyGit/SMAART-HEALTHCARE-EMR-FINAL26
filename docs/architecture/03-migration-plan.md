# SMAART Healthcare EMR — Migration Plan

Principle: the UI keeps working at every step. Each phase ends with the checks in §"Verification gate".

## Phase 1 — Analysis (done)
`01-current-architecture-report.md`.

## Phase 2 — Role cleanup
* `roles` table seeded with `super_master_admin` and `clinic_admin` only. `users.role` is a foreign key to it.
* Clinic admin identity moves from `Clinic.adminPassword` to a `users` row (`role=clinic_admin, clinic_id=<clinic>`), created transactionally when a clinic is created and updated when the Super Master Admin edits the clinic's admin credentials. `POST /api/auth/clinic-login` keeps its request/response contract.
* Legacy roles are removed from: user enum, JWT claims, middleware, controllers, seeds, frontend route blocks, dashboards, sidebar menus and the register form. The legacy `Doctor`/`Nurse` records become `practitioners` (no credentials).
* Public registration, quick-register, create-super-master-admin, test-email, send-test-otp, `/users/test-doctors`, `/clinics/:id/debug` are removed. The first Super Master Admin is created by `npm run bootstrap:admin` from environment variables.

## Phase 3 — Security foundation
Helmet, CORS allow-list, Redis rate limiting, Zod validation, central errors, pino logging with redaction, request ids, audit middleware, Argon2id, access/refresh sessions, fixed password reset, env validation on boot.

## Phase 4 — PostgreSQL
Knex migrations under `backend/src/infrastructure/postgres/migrations` create the schema (UUID PKs, FKs, unique/check constraints, indexes, soft-delete columns, `version` columns for optimistic locking, RLS policies). Roles: `smaart_migrator` (DDL) and `smaart_app` (DML, subject to RLS).

## Phase 5 — MongoDB restructuring
Mongo keeps only: `clinical_notes`, `clinical_assessments`, `dynamic_forms`, `patient_activity_logs`, `community_posts`, `integration_payloads`, `fhir_payload_snapshots`. Each schema documents its purpose and requires `clinicId`. The legacy collections are left untouched until the data migration is validated.

## Phase 6 — Service layer
`controller → service → repository` in every module. Response serializers keep the shapes the UI expects (`_id` alias, populated `patientId.fullName` etc.).

## Phase 7 — Cloudinary hardening
Document service, storage abstraction, signed access endpoint, validation, audit.

## Phase 8/9 — Redis and RabbitMQ
Limiters, cache, locks, idempotency, counters; outbox, publisher, consumers, retries, DLQ.

## Phase 10 — Clinical architecture
Encounter-centric tables, timeline service, patient summary aggregates.

## Phase 11 — FHIR R4
Mappers, routes, capability statement, tests.

## Phase 12 — Monitoring
Health, metrics, logs, alert rules.

## Phase 13 — Tests
Unit (services, rbac, validation, fhir mappers), integration (Postgres/Redis real, Mongo when `MONGODB_URI` is set), security (cross-clinic 403 on every resource, expired/invalid JWT, refresh reuse, rate limit, IDOR, upload attacks), migration tests.

## Phase 14 — Production
Docker, CI, environments, backups, DR, secrets.

## Data migration (MongoDB → PostgreSQL)

`npm run migrate:data -- --mongo <uri> --dry-run|--apply`:
1. Reads legacy collections read-only.
2. Maps every ObjectId to a deterministic UUID v5 (namespace + collection + ObjectId) recorded in `legacy_id_map` so re-runs are idempotent and old references can be resolved.
3. Order: clinics → users (super master admins; clinic admins from `Clinic.adminEmail`, re-hashing bcrypt or plaintext passwords into Argon2id) → practitioners (Doctor, Nurse) → patients (+identifiers: uhid, aadhaar) → appointments → consultations (encounter + Mongo clinical note) → vitals → prescriptions → lab reports (documents + lab_orders/results) → medical images (documents + imaging_studies) → referrals → invoices (kept in `invoices` table) → posts (Mongo `community_posts`) → case logs (Mongo `patient_activity_logs`).
4. Validation report: counts per collection vs table, orphan references, duplicate identifiers, date ranges, documents without storage keys. `--apply` refuses to run if validation fails.
5. Legacy Mongo data is never deleted by the tool. Removal is a separate, documented, manual step after sign-off (`docs/operations/legacy-data-retirement.md`).

## Verification gate (after every phase)
`npm run lint && npm run test` in `backend/`, `npm run build` in `frontend/`, then: health endpoint green; login for both roles; `/auth/me`; clinic-admin cross-clinic request returns 403; RLS smoke test; FK/constraint check script; manual UI smoke of dashboard, patients, appointments, patient view.

## Status of this branch (2026-09-25)

Implemented and verified on this branch (`backend/`: 91 automated tests, lint clean; `frontend/`: builds):

* Phases 2–13: two-role RBAC, security foundation, PostgreSQL schema with RLS, service/repository modules for every legacy endpoint the UI calls, Cloudinary-backed document service with signed access, Redis and RabbitMQ infrastructure with transactional outbox and workers, encounter-centric clinical model with timeline, FHIR R4 facade, health/metrics/logging, unit + integration + security + FHIR tests, legacy data migration tool with validation report.
* Phase 14: Dockerfiles, docker-compose, GitHub Actions pipeline, operations documentation.

Pending manual step (file removal requires an explicit decision by the repository owner): delete the now-unreferenced legacy code that is still present in the tree — `backend/routes`, `backend/models`, `backend/middleware`, `backend/services`, `backend/scripts`, `backend/config`, the root MongoDB debug scripts (`check*.js`, `list*.js`, `fetchMedicalImages.js`, `getPatientMedicalImages.js`), `add-dark-mode.js`, `fix-dark-mode-bugs.js`, the root `package.json`/`package-lock.json`, `EMR.docx`, every `*.backup` / `*.bugfix-backup` / `*_backup.jsx` file under `frontend/src`, and the legacy-role UI components no longer routed (`components/dashboards/{SuperAdmin,Doctor,Nurse,Billing,Pharmacy,Patient}Dashboard.jsx`, `components/users/Users.jsx`, `components/pages/DoctorsManagement*.jsx`, `components/emr/ConsultantDashboard.jsx`, `services/consultantDashboardAPI.js`). None of it is loaded by the application any more; embedded Atlas credentials inside the legacy scripts were redacted.
