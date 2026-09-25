# SMAART Healthcare EMR — Target Architecture

The EMR becomes a **secure modular monolith**: one Node.js/Express process (plus a worker process) with strict module boundaries, PostgreSQL for structured clinical/transactional data, MongoDB for flexible clinical documents, Redis for cache/security state, RabbitMQ for asynchronous work, Cloudinary for medical files and an HL7 FHIR R4 layer for interoperability. The existing React UI is kept unchanged.

```
React (Vite/Tailwind, unchanged) ──HTTPS──▶ Express API (backend/src)
                                              ├── common/      helmet, cors, rate-limit, request-id, zod, errors, logging, audit
                                              ├── modules/     auth, clinics, users, patients, practitioners, appointments,
                                              │                encounters, vitals, conditions, allergies, prescriptions,
                                              │                laboratory, imaging, documents, referrals, notifications,
                                              │                reports, search, timeline, audit, community
                                              ├── fhir/        R4 mappers + /api/fhir/R4 routes
                                              └── infrastructure/ postgres (knex), mongodb (mongoose), redis, rabbitmq, cloudinary
                                                     │             │            │        │           │
                                                 PostgreSQL     MongoDB       Redis   RabbitMQ   Cloudinary
                                                                                       │
                                                                                  workers (outbox publisher, email, notifications, fhir-sync)
```

## 1. Roles

Only two EMR application roles exist, stored in `roles` and enforced centrally by `common/security/rbac.js`:

| Role | Scope |
|---|---|
| `super_master_admin` | Platform-wide. `clinic_id` is NULL. May act on any clinic; every request is still audited. |
| `clinic_admin` | Exactly one clinic (`users.clinic_id NOT NULL`). Can never read or write another clinic's rows. |

Doctors, nurses and lab technicians are **practitioners** (`practitioners` table, FHIR `Practitioner`), not login roles. They are referenced by encounters, prescriptions, lab orders and documents. The Consultant platform and the Patient app authenticate through their own secure APIs (future work) and never receive EMR admin roles.

The frontend keeps its existing `super_master_admin` and `clinic_admin` code paths. The clinic login screen keeps calling `POST /api/auth/clinic-login`; it now authenticates a `clinic_admin` user row (one per clinic, created when the clinic is created) instead of a plaintext password on the clinic document.

## 2. Data ownership

| Data | Store | Notes |
|---|---|---|
| clinics, users, roles, permissions, refresh sessions, OTP/reset challenges | PostgreSQL | identities and tenancy |
| patients, patient_identifiers | PostgreSQL | demographics; profile image is a `documents` row in Cloudinary, not inline base64 |
| practitioners (doctors, nurses) | PostgreSQL | clinical resources, no credentials |
| appointments, encounters | PostgreSQL | encounter is the hub for all clinical events |
| clinical_conditions, allergies, medications, prescriptions(+items), vitals | PostgreSQL | |
| lab_orders, lab_results, imaging_orders, imaging_studies, referrals | PostgreSQL | |
| documents | PostgreSQL metadata → Cloudinary asset | private delivery, signed access |
| notifications, audit_logs, system_settings, integration_configs, outbox_events, legacy_id_map | PostgreSQL | audit is append-only |
| clinical_notes, clinical_assessments, dynamic_forms | MongoDB | free-form clinical narrative keyed by Postgres UUIDs |
| patient_activity_logs (case-log activity/login history) | MongoDB | high-volume, flexible |
| community_posts | MongoDB | social content |
| integration_payloads, fhir_payload_snapshots | MongoDB | raw payloads for audit/replay |
| medical files | Cloudinary (`type: private/authenticated`) | S3 only via the `StorageProvider` interface later |
| rate limits, cache, locks, idempotency keys, unread counters | Redis | never a source of truth |
| events/jobs | RabbitMQ (via transactional outbox) | never a source of truth |

Every MongoDB document carries `clinicId`, `patientId` and (where applicable) `encounterId` as Postgres UUID strings; repositories require `clinicId` on every query.

## 3. Request pipeline

```
request-id → pino-http (redacted) → helmet → cors (allow-list) → body limits → rate limit (Redis)
→ authenticate (access JWT, session check) → resolve tenant (clinicId from token, never from client)
→ authorize (rbac permission) → zod validate (params/query/body) → controller → service → repository
→ PostgreSQL (SET LOCAL app.clinic_id + RLS) / MongoDB (clinicId enforced) → audit → response envelope
```

Errors go through a single handler that returns `{ success:false, error:{code,message}, requestId }` and never leaks stack traces, SQL or Mongo internals in production. The legacy `message` field is kept in the envelope for UI compatibility.

## 4. Authentication and sessions

* Argon2id password hashing (bcrypt hashes from the legacy data are verified and transparently re-hashed at next login).
* Access token: 15 minutes, claims `{sub, role, clinicId, sid, jti}`. Refresh token: 7 days, opaque, stored hashed in `auth_sessions`, rotated on every use, revoked on logout / password reset / reuse detection. Delivered as an `httpOnly; SameSite=Strict` cookie scoped to `/api/auth`; the API also accepts it in the body for non-browser clients.
* OTP challenges (login second factor, password reset) are stored hashed with TTL, single use, attempt-limited, rate-limited per email and per IP. OTPs are never returned by the API or written to logs. In development an explicit `EMAIL_TRANSPORT=console` prints the outgoing email; production refuses that setting.
* Password reset: `forgot-password` (always 200, no user enumeration) → `verify-reset-otp` returns a short-lived signed reset token → `reset-password` requires that token, then revokes all sessions.

## 5. Tenant isolation

1. `clinicId` is taken from the authenticated user only. Request `clinicId` values are ignored for clinic admins; for the super master admin they select the clinic to act on and are audited.
2. Every repository method takes a `scope` (`{ clinicId | null(all) }`) and adds `clinic_id = ?` for clinic admins.
3. PostgreSQL RLS is enabled on `patients, appointments, encounters, prescriptions, lab_orders, lab_results, documents, vitals, referrals, imaging_studies, clinical_conditions, allergies, medications, notifications`; policies compare `clinic_id` with `current_setting('app.clinic_id')` unless `app.role = 'super_master_admin'`. The application connects as `smaart_app`, a non-superuser without `BYPASSRLS`; migrations run as a separate role.
4. MongoDB repositories reject queries without `clinicId` unless the caller is the super master admin.

## 6. Clinical model

`patients → encounters → {vitals, clinical_conditions, allergies, medications, prescriptions, lab_orders→lab_results, imaging_orders→imaging_studies, referrals, documents, clinical_notes (Mongo)}`. The legacy "consultation" record maps to an encounter plus a clinical note. The timeline service (`modules/timeline`) reads a single indexed `patient_timeline` view built from these tables (UNION ALL with cursor pagination), never fan-out across every collection per request.

## 7. Documents (Cloudinary now, S3 later)

`modules/documents` owns upload (multipart, size/MIME/extension/magic-byte validation, clinic/patient ownership), metadata (`documents` table: `storage_provider`, `storage_key`, `checksum`, `mime_type`, `size_bytes`, `status`, `scan_status`), access (`GET /api/v1/documents/:id/access` → short-lived signed Cloudinary URL, audited), delete (soft, then async purge). `infrastructure/storage/StorageProvider` defines `upload/delete/getAccessUrl/getMetadata`; `CloudinaryStorage` is the only production implementation; `LocalStorage` exists for development/tests only. No S3 code is added.

## 8. Redis, RabbitMQ, outbox

* Redis: `rate-limit-redis` stores for login/reset/API/FHIR limiters; `cache` helper with TTL for clinic and system settings; `withLock` (SET NX PX) for appointment slot booking and worker de-duplication; `idempotency` middleware keyed by `Idempotency-Key` for FHIR writes and document uploads; unread notification counters. If Redis is unavailable in development a memory fallback is used and readiness reports it.
* Services write domain events into `outbox_events` inside the same PostgreSQL transaction as the data change. `workers/outbox-publisher` polls (FOR UPDATE SKIP LOCKED), publishes to the `smaart.events` topic exchange, marks rows published. Consumers (`email`, `notifications`, `fhir-sync`, `document-processing`) run with bounded retries via a delayed retry queue and a dead-letter queue `smaart.dlq` that is monitored through `/metrics`.

## 9. FHIR R4

`fhir/mappings/*` convert Postgres rows to FHIR resources (Patient, Organization, Practitioner, Appointment, Encounter, Condition, Observation, AllergyIntolerance, Medication, MedicationRequest, DiagnosticReport, DocumentReference, ImagingStudy, Procedure). `fhir/routes` exposes read/search under `/api/fhir/R4/*` with the same auth, tenant scope, RBAC, rate limit and audit as the REST API, `CapabilityStatement` at `/metadata`, OperationOutcome errors, and `_count`/`_page` search paging. FHIR is a projection; canonical data stays in PostgreSQL/MongoDB. Optional snapshots go to `fhir_payload_snapshots` for audit.

## 10. Operations

* `/health`, `/health/live`, `/health/ready` (checks PostgreSQL, MongoDB, Redis, RabbitMQ), `/metrics` (Prometheus).
* pino structured logs with `requestId, userId, clinicId, method, route, status, durationMs` and redaction of authorization headers, cookies, passwords, tokens, OTPs and clinical payloads.
* Docker images for `api` and `worker`; `docker-compose.yml` for the full local stack; GitHub Actions: lint → typecheck → unit → integration (services) → security scan → build.
* Backups, disaster recovery, environments and secrets are documented in `docs/operations/`.
