# SMAART Healthcare EMR — Migration Plan

Principle: the UI keeps working at every step. Each phase ends with the checks in §"Verification gate".

## Phase 1 — Analysis (done)
`01-current-architecture-report.md`.

## Phase 2 — Role cleanup
* `roles` collection seeded with `super_master_admin` and `clinic_admin` only; `users.role` is validated against that enum at the database.
* Clinic admin identity moves from `Clinic.adminPassword` to a `users` document (`role=clinic_admin, clinicId=<clinic>`), created transactionally when a clinic is created and updated when the Super Master Admin edits the clinic's admin credentials. `POST /api/auth/clinic-login` keeps its request/response contract.
* Legacy roles are removed from: user enum, JWT claims, middleware, controllers, seeds, frontend route blocks, dashboards, sidebar menus and the register form. The legacy `Doctor`/`Nurse` records become `practitioners` (no credentials).
* Public registration, quick-register, create-super-master-admin, test-email, send-test-otp, `/users/test-doctors`, `/clinics/:id/debug` are removed. The first Super Master Admin is created by `npm run bootstrap:admin` from environment variables.

## Phase 3 — Security foundation
Helmet, CORS allow-list, Redis rate limiting, Zod validation, central errors, pino logging with redaction, request ids, audit middleware, Argon2id, access/refresh sessions, fixed password reset, env validation on boot.

## Phase 4 — Database schema (MongoDB)
`backend/src/infrastructure/mongodb/schema.js` (run by `npm run migrate` and at boot, idempotent) creates every collection with a JSON-schema validator (required fields, enums, UUID formats), unique/partial/TTL/text indexes and reference data. Documents use UUID string `_id`s, camelCase fields, `deletedAt` soft delete and `version` for optimistic locking. Multi-document transactions require a replica set (single node is fine locally).

## Phase 5 — Tenant data-access layer
`backend/src/infrastructure/mongodb/tenant.js` replaces row-level security: services only see a `TenantDb` bound to the caller's scope; every filter and write on a clinic-owned collection is forced to the caller's clinic, append-only and system-only collections are protected, soft-deleted documents are hidden. Flexible documents (`clinical_notes`, `community_posts`, `patient_activity_logs`, …) live in the same database under the same wrapper. The legacy collections are left untouched (in the legacy database) until the data migration is validated.

## Phase 6 — Service layer
`controller → service → repository` in every module. Response serializers keep the shapes the UI expects (`_id` alias, populated `patientId.fullName` etc.).

## Phase 7 — Cloudinary hardening
Document service, storage abstraction, signed access endpoint, validation, audit.

## Phase 8/9 — Redis and RabbitMQ
Limiters, cache, locks, idempotency, counters; outbox, publisher, consumers, retries, DLQ.

## Phase 10 — Clinical architecture
Encounter-centric collections, timeline service, patient summary aggregates.

## Phase 11 — FHIR R4
Mappers, routes, capability statement, tests.

## Phase 12 — Monitoring
Health, metrics, logs, alert rules.

## Phase 13 — Tests
Unit (services, rbac, validation, fhir mappers), integration (real MongoDB replica set + Redis), security (data-layer tenant enforcement, cross-clinic 404/403 on every resource, expired/invalid JWT, refresh reuse, rate limit, IDOR, upload attacks), migration tests.

## Phase 14 — Production
Docker, CI, environments, backups, DR, secrets.

## Data migration (legacy MongoDB → new MongoDB model)

`npm run migrate:data -- --mongo <legacy uri> --dry-run|--apply` (target = `MONGODB_URI`, which must be a different database):
1. Reads legacy collections read-only.
2. Maps every ObjectId to a deterministic UUID v5 (namespace + collection + ObjectId) recorded in `legacy_id_map` so re-runs are idempotent upserts and old references can be resolved.
3. Order: clinics → users (super master admins; clinic admins from `Clinic.adminEmail`, re-hashing bcrypt or plaintext passwords into Argon2id) → practitioners (Doctor, Nurse) → patients (+identifiers: uhid, aadhaar, legacy id) → appointments → consultations (encounter + clinical note) → vitals → prescriptions (items embedded) → lab reports (documents + lab_orders/results) → medical images (documents + imaging_studies) → referrals → teleconsultations → invoices/billings (unified `invoices`) → posts (`community_posts`) → case logs (`patient_activity_logs`).
4. Validation report: counts per collection, orphan references, duplicate identifiers/emails, legacy id map coverage, date ranges, documents without storage keys, sampled clinical history. The tool exits non-zero if validation fails.
5. Legacy Mongo data is never deleted by the tool. Removal is a separate, documented, manual step after sign-off (`docs/operations/legacy-data-retirement.md`).

## Verification gate (after every phase)
`npm run lint && npm run test` in `backend/`, `npm run build` in `frontend/`, then: health endpoint green; login for both roles; `/auth/me`; clinic-admin cross-clinic request returns 404/403; tenant data-layer test; migration validator; manual UI smoke of dashboard, patients, appointments, patient view.

## Status of this branch (2026-09-26)

All fourteen phases are implemented on this branch and verified by automated tests. PostgreSQL was removed on 2026-09-26 at the product owner's request; MongoDB is the only database and all guarantees formerly provided by row-level security are provided by the tenant data-access layer, JSON-schema validators, unique indexes and transactions.

| Phase | Evidence |
|---|---|
| 1 Analysis | `docs/architecture/01-current-architecture-report.md` |
| 2 Role cleanup | two roles in schema/RBAC/UI; legacy route, model, middleware, script, backup and legacy-role UI files removed; `tests/unit/rbac.test.js` |
| 3 Security foundation | `tests/integration/auth.test.js`, `tests/security/*` |
| 4 Database schema | `src/infrastructure/mongodb/schema.js` (validators, indexes, reference data), `src/tools/migrate.js` |
| 5 Tenant data layer | `src/infrastructure/mongodb/tenant.js`, `tests/security/tenantIsolation.test.js`; flexible documents in `tests/integration/mongo.test.js` |
| 6 Service layer | every module under `src/modules`, `tests/integration/api.test.js`, `tests/security/tenantIsolation.test.js` |
| 7 Cloudinary hardening | `src/modules/documents`, `tests/unit/documents.test.js`, `tests/unit/cloudinary.test.js` (signed authenticated URLs), malware scanning via ClamAV (`tests/integration/workers.test.js`) |
| 8 Redis | `tests/integration/outbox.test.js`, `tests/security/rateLimit.test.js` |
| 9 RabbitMQ | outbox + consumers, `tests/unit/rabbitmq.test.js` (retry and dead-letter semantics) |
| 10 Clinical architecture | encounters, timeline, case logs (`api.test.js`) |
| 11 FHIR | `tests/integration/fhir.test.js`, `tests/unit/fhir.test.js` |
| 12 Monitoring | `/health*`, `/metrics`, `deploy/monitoring` (Prometheus scrape config, alert rules, Grafana dashboard) |
| 13 Testing | 73 backend tests (unit, integration, security, FHIR, migration, workers) + 8 Playwright end-to-end tests of the real UI (`frontend/e2e`) |
| 14 Production | Dockerfiles, compose, GitHub Actions (lint → tests → E2E → secret/vulnerability scan → image build/push → ECS staging → approved production), ECS task definition, backup export job, operations runbooks |

Also delivered beyond the original UI contract: the Pharmacy Management page, which called a medications inventory API that never existed, is now backed by a clinic-scoped `inventory_items` collection (`tests/integration/pharmacy.test.js`).

Left to the operator (infrastructure, not code): provisioning the MongoDB replica set (Atlas)/ElastiCache/Amazon MQ/WAF/TLS, setting the GitHub environment variables and secrets used by the deploy jobs, configuring `CLAMAV_HOST` and `BACKUP_DIR`, and rotating the credentials that were committed in the legacy repository.
