# SMAART Healthcare EMR — Current Architecture Report (as found)

Date of analysis: 2026-09-25
Scope: full repository scan of `backend/`, `frontend/`, root scripts and documentation, before any change was made.

---

## 1. Repository shape

| Area | Finding |
|---|---|
| Layout | Two applications in one repo: `backend/` (Express + Mongoose, CommonJS) and `frontend/` (React 18 + Vite 4 + Tailwind 3). |
| Root | 12 ad-hoc MongoDB debug scripts (`check*.js`, `list*.js`, `fetchMedicalImages.js`…), 16 change-log markdown files, a 2.2 MB `EMR.docx`, a root `package.json` whose only purpose is to run those scripts. |
| Backups | 90+ `*.backup` / `*.bugfix-backup` / `*_backup.jsx` copies of components committed alongside the live files. |
| Secrets | `backend/.env` **is committed** (MongoDB Atlas URI with username/password, JWT secret, Gmail app password). `backend/.env.example` contains the same live Atlas URI and Gmail credentials. `backend/scripts/add-sample-*.js` embed the Atlas URI with password. All of these must be treated as compromised and rotated. |
| Tests | None. No lint, no type check, no CI. |
| Docker / CI | None. |

## 2. Frontend (to be preserved)

* React 18, Vite 4, Tailwind 3, `react-router-dom` 6, `axios`, `lucide-react`, `react-hook-form`, `react-hot-toast`, chart libraries, `xlsx`, `jspdf`.
* Routing and role gating live in `frontend/src/App.jsx`; menus per role in `components/layout/Sidebar.jsx`; auth state in `contexts/AuthContext.jsx` (token kept in `localStorage`, `/auth/me` on load).
* API access is through `services/api.js` (axios instance, **hard-coded** `http://localhost:5001/api`) plus five sibling service files that duplicate the base URL and interceptor logic (`billingAPI`, `clinicValidityAPI`, `consultantDashboardAPI`, `doctorService`, `medicationAPI`, `searchAPI`).
* Login page (`components/auth/Login.jsx`) has two modes that the UI exposes: **"User" login** (email + password, then a 4-digit OTP) which the EMR uses for the Super Master Admin, and **"Clinic" login** (clinic admin email + password, no OTP). A "Developer login" button bypasses OTP by calling `/auth/login`.
* Roles referenced in the UI: `super_master_admin`, `clinic_admin`, plus legacy `super_admin`, `doctor`, `nurse`, `billing_staff`, `pharmacy_staff`, `patient` (dashboards, route blocks, register form options, sidebar menus).
* Pages used by the two EMR roles today:
  * Super Master Admin: Dashboard, Clinic Management, Patient List, Appointments, Doctors, Nurses, Referrals, Billing & Insurance, Reports & Analytics, Pharmacy, Customer Support, Settings.
  * Clinic Admin: Dashboard, Patients, Appointments, Doctors, Nurses, Prescriptions, Teleconsultation, Invoices, Community Hub, Referrals, Settings; plus the patient detail page (`PatientView.jsx`, 6.9k lines) with vitals, prescriptions, lab reports, medical images, consultations, case logs.
* The IDs the UI relies on are opaque strings (`_id`). Only `ClinicEdit.jsx:315` validates a 24-hex ObjectId (for a clinic sub-user list that the backend never actually supports).
* Profile pictures are read with `FileReader.readAsDataURL` and posted as base64 strings inside the JSON body; the backend stores them inline in MongoDB.

## 3. Backend

### 3.1 Runtime

* `backend/server.js`: Express 4, `cors()` **with no origin restriction**, JSON body parser, 23 route files mounted under `/api/*`, a single catch-all error handler. No helmet, no rate limiting, no request ids, no structured logging, no health endpoint, no graceful shutdown.
* `backend/config/database.js`: single Mongoose connection; logs the full connection string (including credentials) at start.
* Socket.io is a dependency in both apps but **is not used anywhere** (the only "socket" match is `socketTimeoutMS`). Nothing to secure; the dependency should be dropped until real-time features return.
* Cloudinary: the SDK is **not installed**. `MedicalImage` and `LabReport` only store a URL string and a `cloudinaryPublicId`; uploads happen outside the API (client-side or manual). `labReports.js:255` redirects to a client-supplied `filePath` (open redirect).

### 3.2 Authentication (`routes/auth.js`, `middleware/auth.js`)

* Two independent identity stores:
  1. `User` collection (bcrypt password, role enum of seven roles, OTP fields stored in plaintext).
  2. `Clinic` collection: `adminEmail` + `adminPassword` **stored in plaintext** (`clinics.js:159`); `Clinic.comparePassword` falls back to string comparison and **logs the candidate password and part of the stored password on every login** (`models/Clinic.js:119-121`).
* JWTs: 7-day single access token, no refresh, no revocation, `fallback_secret` used when `JWT_SECRET` is unset. Clinic tokens carry `type:"clinic"` and the middleware fabricates a `req.user` with `role:"clinic_admin"`.
* Public endpoints that must not exist in production: `POST /auth/register` (anyone can register **as super_master_admin**, auto-verified, token returned immediately), `POST /auth/quick-register`, `POST /auth/create-super-master-admin` (hard-coded `password123`), `GET /auth/test-email`, `POST /auth/send-test-otp` (returns OTP), `GET /users/test-doctors` (**no auth**, returns every doctor's `resetOTP`).
* Password reset flow is broken: `POST /auth/reset-password` only checks that *some* unexpired `resetOTP` exists for the email; it never compares the OTP. Requesting a reset for a victim's email and immediately calling reset-password takes over the account.
* OTPs are returned in API responses when `NODE_ENV=development`, and logged in `emailService.js`.

### 3.3 Authorization and clinic isolation

* Role checks are scattered inline across route files; `authorize()` exists but is used in a handful of places. `authorizeClinic` only constrains `super_admin`.
* For User tokens `req.user.clinicId` is a **populated document**, so every `toString()` comparison silently fails (users.js, clinics.js, nurses.js, posts.js, patientCaseLogs.js). Isolation "works" for clinic tokens mostly by accident.
* Cross-clinic reads/writes with no scoping at all: `doctors.js` (create doctor **in any clinic, with role from body**), `consultations.js`, `referrals.js`, `vitals.js`, `labReports.js`, `medicalImages.js`, `teleconsultations.js`, `prescriptions.js`, `appointments.js` (PUT), `billing.js` (PUT), `posts.js` (PUT/DELETE any post), `patientCaseLogs.js`, `dashboard.js` (global data to any role), `search.js` (ReDoS via `new RegExp(query)`; nurses/billing/pharmacy see all clinics).
* **`/api/invoices/*` is completely unauthenticated** (auth "temporarily disabled for testing"), including "mark as paid".
* `GET /clinics/:id` and `GET /clinics/:id/debug` return the full clinic document (plaintext admin password, bank info) to any authenticated user.
* `clinicId` is accepted from body/query/params in labReports, vitals, teleconsultations, doctors, patientCaseLogs.

### 3.4 Data model (MongoDB, 29 collections)

| Model | Purpose | Notes |
|---|---|---|
| User | login identities | 7-role enum, OTP in plaintext, `clinicId` ref |
| Clinic | tenant + clinic-admin credentials + subscription validity | plaintext password, legacy `passwordHash`, `permissions:['all']` |
| Patient | demographics + embedded medical history + embedded latest vitals + inline base64 `profileImage` + `governmentDocument` + `passwordHash` (unused login) | Required fields (`uhid`, `profileImage`, `bloodGroup`, `occupation`, `governmentDocument`, `address.street`…) do not match what the UI form sends (`attenderEmail`, `pinCode`, `modeOfCare`, `bloodType`…), so UI-driven creation fails validation; `patients.js` POST also injects **mock wallet / check-in / payment history**. |
| Doctor, Nurse, Pharmacist | staff records with their own `passwordHash` (three more identity stores) | duplicate of User for `doctor`/`nurse` roles |
| Appointment | scheduling | denormalised `patientName`, `provider` |
| Consultation | encounter-like record with embedded prescriptions, lab tests, imaging | overlaps Prescription, LabReport |
| Prescription | prescription + medications | duplicates Consultation.prescriptions |
| Vitals | vital signs per visit | duplicates `Patient.vitals` |
| LabReport | uploaded report metadata | URL only |
| MedicalImage | image metadata | URL only, `clinicId` optional |
| Referral | referrals incl. shareable links | denormalised names/addresses |
| PatientCaseLog | login history, activity log, medical cases, medical summary | third copy of allergies/conditions/medications |
| Invoice, Billing, Revenue, TeleconsultationInvoice | billing | three overlapping billing models |
| Teleconsultation | video sessions | participants' identity from client |
| Post | community hub posts | |
| AuditLog, ActivityLog, ComplianceAlert, EmailConfig, OTP, Medication, DoctorAvailability, ScheduleException | defined but **not used by any route** | |

Duplicate sources of truth: allergies/conditions/medications live in `Patient.medicalHistory`, `PatientCaseLog.medicalSummary`, `Consultation`, `Prescription`; vitals in `Patient.vitals` and `Vitals`; identities in `User`, `Clinic`, `Doctor`, `Nurse`, `Pharmacist`, `Patient`.

### 3.5 Other findings

* Every error handler returns `error: error.message` (Mongo/validation internals leak).
* Regex injection in every search (`$regex` with raw input).
* Hard deletes with no cascade (clinics, patients, vitals, lab reports…).
* `dashboard.js` hard-codes revenue/outstanding/urgent counts to 0 (mock).
* Demo data: `scripts/add-sample-*.js` (with embedded Atlas credentials), `create-admin-users.js`, mock wallet/payment history injected on patient creation, `create-super-master-admin` endpoint.
* No audit trail is written anywhere despite an `AuditLog` model.

## 4. Summary of the security gaps to close first

1. Rotate every credential in the committed `.env`, `.env.example` and sample scripts; purge them from the repo.
2. Remove public registration/bootstrap/test endpoints; fix password reset to verify the OTP; hash all passwords (Argon2id), never log or return secrets/OTPs.
3. Single identity store with two roles; short-lived access tokens with refresh rotation and revocation.
4. Centralised RBAC + tenant scope derived from the token; every repository query clinic-scoped; PostgreSQL RLS as a second layer.
5. Helmet, CORS allow-list, rate limiting, Zod validation, safe error responses, structured logs with redaction, audit logging.
6. Authenticate `/invoices`; remove `/users/test-doctors`, `/clinics/:id/debug`; stop returning `adminPassword`, `passwordHash`, `otp`, `resetOTP`.
