# SMAART Healthcare EMR — Target Architecture

The EMR becomes a **secure modular monolith**: one Node.js/Express process (plus a worker process) with strict module boundaries, MongoDB (a replica set with multi-document transactions) as the single database for identities, tenancy, structured clinical data, audit and flexible clinical documents, Redis for cache/security state, RabbitMQ for asynchronous work, Cloudinary for medical files and an HL7 FHIR R4 layer for interoperability. The existing React UI is kept unchanged.

```
React (Vite/Tailwind, unchanged) ──HTTPS──▶ Express API (backend/src)
                                              ├── common/      helmet, cors, rate-limit, request-id, zod, errors, logging, audit
                                              ├── modules/     auth, clinics, users, patients, practitioners, appointments,
                                              │                encounters, vitals, conditions, allergies, prescriptions,
                                              │                laboratory, imaging, documents, referrals, notifications,
                                              │                reports, search, timeline, audit, community
                                              ├── fhir/        R4 mappers + /api/fhir/R4 routes
                                              └── infrastructure/ mongodb (native driver + tenant wrapper), redis, rabbitmq, storage (cloudinary)
                                                                     │                         │        │           │
                                                                  MongoDB (rs0)              Redis   RabbitMQ   Cloudinary
                                                                                                       │
                                                                                  workers (outbox publisher, email, notifications, fhir-sync, documents)
```

## 1. Roles

Only two EMR application roles exist, stored in the `roles` collection and enforced centrally by `common/security/rbac.js`:

| Role | Scope |
|---|---|
| `super_master_admin` | Platform-wide. `clinicId` is null. May act on any clinic; every request is still audited. |
| `clinic_admin` | Exactly one clinic (`users.clinicId` required). Can never read or write another clinic's documents. |

Doctors, nurses and lab technicians are **practitioners** (`practitioners` collection, FHIR `Practitioner`), not login roles. They are referenced by encounters, prescriptions, lab orders and documents. The Consultant platform and the Patient app authenticate through their own secure APIs (future work) and never receive EMR admin roles.

The frontend keeps its existing `super_master_admin` and `clinic_admin` code paths. The clinic login screen keeps calling `POST /api/auth/clinic-login`; it now authenticates a `clinic_admin` user row (one per clinic, created when the clinic is created) instead of a plaintext password on the clinic document.

## 2. Data ownership

MongoDB is the only database. Every collection is registered in `infrastructure/mongodb/collections.js` with its tenant field, soft-delete and append-only flags; `infrastructure/mongodb/schema.js` gives each one a JSON-schema validator and its indexes (`npm run migrate`, idempotent, also run at boot).

| Data | Collections | Notes |
|---|---|---|
| clinics, users, roles, permissions, refresh sessions, OTP/reset challenges | `clinics`, `users`, `roles`, `permissions`, `role_permissions`, `auth_sessions`, `otp_challenges` | identities and tenancy; sessions/challenges are system-only collections (unreachable from request scopes) with TTL indexes |
| patients, identifiers | `patients`, `patient_identifiers` | demographics; unique `(clinicId, system, value)`; profile image is a `documents` entry in Cloudinary, not inline base64 |
| practitioners (doctors, nurses) | `practitioners` | clinical resources, no credentials |
| appointments, encounters, teleconsultations | `appointments`, `encounters`, `teleconsultations` | encounter is the hub for all clinical events; unique partial index prevents double booking |
| conditions, allergies, medications, prescriptions, vitals | `clinical_conditions`, `allergies`, `medications`, `prescriptions` (medications embedded), `vitals` | |
| lab and imaging | `lab_orders`, `lab_results`, `imaging_orders`, `imaging_studies`, `referrals` | |
| documents | `documents` metadata → Cloudinary asset | private delivery, signed access, scan status |
| billing, pharmacy | `invoices` (payments embedded), `inventory_items` | optimistic locking (`version`) on payments and stock |
| platform | `notifications`, `audit_logs` (append-only), `system_settings`, `integration_configs`, `outbox_events`, `legacy_id_map`, `counters` | `counters` gives atomic human-readable numbers (UHID, RX-, INV-) |
| flexible clinical documents | `clinical_notes`, `clinical_assessments`, `dynamic_forms`, `dynamic_form_submissions`, `patient_activity_logs`, `community_posts` | free-form narrative keyed by the same UUIDs |
| interoperability payloads | `integration_payloads`, `fhir_payload_snapshots`, `fhir_resource_refs` | raw payloads for audit/replay |
| medical files | Cloudinary (`type: private/authenticated`) | S3 only via the `StorageProvider` interface later |
| rate limits, cache, locks, idempotency keys, unread counters | Redis | never a source of truth |
| events/jobs | RabbitMQ (via transactional outbox) | never a source of truth |

Conventions: `_id` is a UUID v4 string, fields are camelCase, every document carries `createdAt/updatedAt/createdBy/updatedBy`, tenant-owned documents carry `clinicId`, soft-deletable ones `deletedAt`, mutable ones `version`. Referential integrity is enforced in the service layer (`assertPatient`, `assertPractitioner`, `assertEncounter` inside the same transaction) and checked by the migration validator.

## 3. Request pipeline

```
request-id → pino-http (redacted) → helmet → cors (allow-list) → body limits → rate limit (Redis)
→ authenticate (access JWT, session check) → resolve tenant (clinicId from token, never from client)
→ authorize (rbac permission) → zod validate (params/query/body) → controller → service → repository
→ tenant data layer (clinicId injected into every filter and write, transaction per request) → audit → response envelope
```

Errors go through a single handler that returns `{ success:false, error:{code,message}, requestId }` and never leaks stack traces or database internals in production. The legacy `message` field is kept in the envelope for UI compatibility.

## 4. Authentication and sessions

* Argon2id password hashing (bcrypt hashes from the legacy data are verified and transparently re-hashed at next login).
* Access token: 15 minutes, claims `{sub, role, clinicId, sid, jti}`. Refresh token: 7 days, opaque, stored hashed in `auth_sessions`, rotated on every use, revoked on logout / password reset / reuse detection. Delivered as an `httpOnly; SameSite=Strict` cookie scoped to `/api/auth`; the API also accepts it in the body for non-browser clients.
* OTP challenges (login second factor, password reset) are stored hashed with TTL, single use, attempt-limited, rate-limited per email and per IP. OTPs are never returned by the API or written to logs. In development an explicit `EMAIL_TRANSPORT=console` prints the outgoing email; production refuses that setting.
* Password reset: `forgot-password` (always 200, no user enumeration) → `verify-reset-otp` returns a short-lived signed reset token → `reset-password` requires that token, then revokes all sessions.

## 5. Tenant isolation

1. `clinicId` is taken from the authenticated user only. Request `clinicId` values are ignored for clinic admins; for the super master admin they select the clinic to act on and are audited.
2. Services never touch the driver. They receive a `TenantDb` bound to the caller's scope and transaction (`withTenant(scope, db => …)`) and read/write through `TenantCollection`, which:
   * injects `clinicId = <caller clinic>` into every find/count/aggregate/update/delete filter for clinic admins (a caller-supplied tenant condition is ANDed with it, so asking for another clinic yields nothing, never an existence leak);
   * forces inserts and updates by clinic admins to their own clinic (`CROSS_CLINIC_WRITE` otherwise) and forbids clinic admins from creating clinics;
   * hides soft-deleted documents unless explicitly requested;
   * refuses updates/deletes on append-only collections (`audit_logs`) and refuses access to system-only collections (`auth_sessions`, `otp_challenges`, `outbox_events`, `legacy_id_map`, `counters`) from any request scope: only the `system` role used by auth/workers reaches them.
3. Multi-document transactions (majority read/write concern) make each request's writes, its audit entry and its outbox event atomic. Production refuses to start against a standalone `mongod`.
4. JSON-schema validators enforce required fields, enums and UUID formats at the database; unique partial indexes enforce business uniqueness (emails, identifiers, prescription/invoice numbers, practitioner slots).
5. `tests/security/tenantIsolation.test.js` proves the wrapper (forged filters, cross-clinic writes, append-only, system-only, missing scope) and the API tests prove it end to end (404/403 across clinics on every resource).

## 6. Clinical model

`patients → encounters → {vitals, clinical_conditions, allergies, medications, prescriptions, lab_orders→lab_results, imaging_orders→imaging_studies, referrals, documents, clinical_notes (Mongo)}`. The legacy "consultation" record maps to an encounter plus a clinical note. The timeline service (`modules/timeline`) merges the indexed per-patient collections with a single cursor (date, id) and bounded page size.

## 7. Documents (Cloudinary now, S3 later)

`modules/documents` owns upload (multipart, size/MIME/extension/magic-byte validation, clinic/patient ownership), metadata (`documents` collection: `storageProvider`, `storageKey`, `checksumSha256`, `mimeType`, `sizeBytes`, `status`, `scanStatus`), access (`GET /api/v1/documents/:id/access` → short-lived signed Cloudinary URL, audited), delete (soft, then async purge). `infrastructure/storage/StorageProvider` defines `upload/delete/getAccessUrl/getMetadata`; `CloudinaryStorage` is the only production implementation; `LocalStorage` exists for development/tests only. No S3 code is added.

## 8. Redis, RabbitMQ, outbox

* Redis: `rate-limit-redis` stores for login/reset/API/FHIR limiters; `cache` helper with TTL for clinic and system settings; `withLock` (SET NX PX) for appointment slot booking and worker de-duplication; `idempotency` middleware keyed by `Idempotency-Key` for FHIR writes and document uploads; unread notification counters. If Redis is unavailable in development a memory fallback is used and readiness reports it.
* Services write domain events into `outbox_events` inside the same MongoDB transaction as the data change. `workers/outboxPublisher` claims batches with a short lease (`claimedUntil`) under a Redis lock, publishes to the `smaart.events` topic exchange, marks rows published. Consumers (`email`, `notifications`, `fhir-sync`, `document-processing`) run with bounded retries via a delayed retry queue and a dead-letter queue `smaart.dlq` that is monitored through `/metrics`.

## 9. FHIR R4

`fhir/mappings/*` convert MongoDB documents to FHIR resources (Patient, Organization, Practitioner, Appointment, Encounter, Condition, Observation, AllergyIntolerance, Medication, MedicationRequest, DiagnosticReport, DocumentReference, ImagingStudy, Procedure). `fhir/routes` exposes read/search under `/api/fhir/R4/*` with the same auth, tenant scope, RBAC, rate limit and audit as the REST API, `CapabilityStatement` at `/metadata`, OperationOutcome errors, and `_count`/`_page` search paging. FHIR is a projection; canonical data stays in MongoDB. Optional snapshots go to `fhir_payload_snapshots` for audit.

## 10. Operations

* `/health`, `/health/live`, `/health/ready` (checks MongoDB incl. transaction support, Redis, RabbitMQ), `/metrics` (Prometheus).
* pino structured logs with `requestId, userId, clinicId, method, route, status, durationMs` and redaction of authorization headers, cookies, passwords, tokens, OTPs and clinical payloads.
* Docker images for `api` and `worker`; `docker-compose.yml` for the full local stack; GitHub Actions: lint → unit → integration (MongoDB replica set + Redis) → E2E → security scan → build.
* Backups, disaster recovery, environments and secrets are documented in `docs/operations/`.
