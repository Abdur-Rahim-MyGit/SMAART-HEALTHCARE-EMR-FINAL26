/**
 * Test Case Generator for SMAART Healthcare EMR
 * Outputs:
 *  1. SMAART_EMR_Test_Cases_Template.csv (Ready for Google Sheets 'File > Import')
 *  2. GoogleAppsScript_AutoImporter.js (Ready to paste in Google Sheets Apps Script to build styled sheet)
 */

const fs = require('fs');
const path = require('path');

const testCases = [
  // 1. Authentication & RBAC
  {
    id: "TC-AUTH-001",
    module: "Authentication & RBAC",
    subModule: "Super Master Admin Login",
    title: "Verify successful Super Master Admin authentication with valid credentials and OTP 2FA",
    type: "Functional",
    priority: "P1 - Critical",
    severity: "Blocker",
    preconditions: "Super Master Admin account bootstrapped in system; valid OTP secret registered.",
    steps: "1. Navigate to login page /auth/login\n2. Enter Super Master Admin email and password\n3. Click 'Sign In'\n4. Enter valid 6-digit OTP when prompted\n5. Submit 2FA verification",
    testData: "Email: superadmin@smaart.local, Password: [ValidArgon2idPass], OTP: [CurrentValidCode]",
    expectedResult: "User authenticated successfully; 15-minute access token and rotating httpOnly refresh cookie issued; redirected to Platform Dashboard with super_master_admin role privileges.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest / Manual",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Covers Argon2id verification and session token generation."
  },
  {
    id: "TC-AUTH-002",
    module: "Authentication & RBAC",
    subModule: "Brute Force Protection",
    title: "Verify account rate limiting after 5 consecutive failed login attempts",
    type: "Security",
    priority: "P1 - Critical",
    severity: "Critical",
    preconditions: "Target user exists; Redis rate limiter active.",
    steps: "1. Navigate to login endpoint /api/auth/login\n2. Submit incorrect password 5 consecutive times within 1 minute\n3. Attempt 6th login with correct password",
    testData: "Email: clinicadmin@cityclinic.local, InvalidPassword: 'WrongPassword!'",
    expectedResult: "HTTP 429 Too Many Requests returned on 6th attempt; message 'Too many login attempts. Please try again after 15 minutes.' logged in audit.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Rate limiting backed by Redis and express-rate-limit."
  },
  {
    id: "TC-AUTH-003",
    module: "Authentication & RBAC",
    subModule: "Token Lifecycle",
    title: "Verify automatic access token refresh via rotating httpOnly refresh token",
    type: "Integration",
    priority: "P2 - High",
    severity: "Major",
    preconditions: "User logged in; access token expired (>15 mins); refresh token cookie present.",
    steps: "1. Make API request with expired access token\n2. Intercept 401 response and trigger POST /api/auth/refresh\n3. Inspect response and new cookie header",
    testData: "Cookie: refreshToken=[valid_jwt]",
    expectedResult: "HTTP 200 returned with fresh access token; old refresh token invalidated and new refresh token set in httpOnly cookie.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Token reuse detection should invalidate session if an old refresh token is reused."
  },

  // 2. Multi-Tenancy & Data Isolation
  {
    id: "TC-TENANT-001",
    module: "Multi-Tenant Isolation",
    subModule: "Clinic Admin Scoping",
    title: "Ensure Clinic Admin A cannot view, query, or edit Patient records belonging to Clinic B",
    type: "Security",
    priority: "P1 - Critical",
    severity: "Blocker",
    preconditions: "Two clinics exist: Clinic A (ID: 64a1...) and Clinic B (ID: 64b2...). Patient P_B belongs to Clinic B.",
    steps: "1. Authenticate as Clinic Admin of Clinic A\n2. Send GET request to /api/patients/:patientId_B\n3. Send PUT request to update medical details of Patient P_B",
    testData: "User: Admin Clinic A, TargetPatientId: [ID of Patient in Clinic B]",
    expectedResult: "HTTP 403 Forbidden or HTTP 404 Not Found returned; Tenant Data Access Layer strictly enforces clinicId filter; no data leaked.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Critical HIPAA/EMR multi-tenancy verification test."
  },
  {
    id: "TC-TENANT-002",
    module: "Multi-Tenant Isolation",
    subModule: "Super Admin Cross-Tenant Access",
    title: "Verify Super Master Admin can access and switch clinic contexts securely with explicit audit logging",
    type: "Functional",
    priority: "P2 - High",
    severity: "Major",
    preconditions: "Super Master Admin logged in; multiple active clinics onboarded.",
    steps: "1. Switch active clinic context via clinic selector in UI\n2. Query clinic dashboard and patient stats\n3. Check system audit collection",
    testData: "SuperAdmin token, ContextClinicId: 'clinic_south_branch_01'",
    expectedResult: "Clinic data loads correctly; audit log records 'SUPER_ADMIN_CROSS_TENANT_ACCESS' event with admin ID, timestamp, and target clinic ID.",
    actualResult: "",
    status: "Untested",
    executionType: "Manual / Vitest",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Ensures compliance transparency for platform-level operators."
  },

  // 3. Practitioner & Clinic Resources
  {
    id: "TC-PRAC-001",
    module: "Practitioners",
    subModule: "Resource Onboarding",
    title: "Verify creation of Doctor/Nurse clinical resource without generating system login accounts",
    type: "Functional",
    priority: "P2 - High",
    severity: "Major",
    preconditions: "Clinic Admin logged in for active clinic.",
    steps: "1. Navigate to Clinic Admin > Practitioners > Add Practitioner\n2. Fill Name, Role (Doctor), Specialty (Cardiology), Medical License Number, Contact\n3. Click 'Save Practitioner'\n4. Verify database users collection vs practitioners collection",
    testData: "Name: Dr. Sarah Connor, License: MC-98214, Role: Doctor, Department: Cardiology",
    expectedResult: "Practitioner record created in 'practitioners' collection with assigned clinicId; NO login user entry created in 'users' collection.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest / Manual",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "System architecture rule: Doctors/Nurses are clinical resources, not separate logins."
  },

  // 4. Patient Management
  {
    id: "TC-PAT-001",
    module: "Patients",
    subModule: "Registration & UHID",
    title: "Verify new patient registration with unique Medical Record Number (MRN/UHID) generation",
    type: "Functional",
    priority: "P1 - Critical",
    severity: "Critical",
    preconditions: "Clinic Admin or Front Desk operator logged in.",
    steps: "1. Open 'Register New Patient' modal\n2. Enter First Name, Last Name, DOB, Gender, Phone Number, Emergency Contact, Address\n3. Submit registration form",
    testData: "Name: John Doe, DOB: 1985-04-12, Gender: Male, Phone: +15551234567",
    expectedResult: "Patient record created; unique MRN generated (e.g. SMAART-CL1-2026-0089); patient profile view opened with initial timeline.",
    actualResult: "",
    status: "Untested",
    executionType: "Playwright E2E",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "MRN must be globally unique per clinic and follow standard format."
  },
  {
    id: "TC-PAT-002",
    module: "Patients",
    subModule: "Duplicate Patient Prevention",
    title: "Verify duplicate patient warning when registering with existing phone number and DOB",
    type: "Negative",
    priority: "P2 - High",
    severity: "Minor",
    preconditions: "Patient John Doe with phone +15551234567 and DOB 1985-04-12 already exists in clinic.",
    steps: "1. Attempt to register new patient with identical Phone and DOB\n2. Submit registration",
    testData: "Phone: +15551234567, DOB: 1985-04-12, Name: Jonathan Doe",
    expectedResult: "System prompts warning: 'Potential duplicate record detected with matching phone and DOB' with option to view existing record or proceed.",
    actualResult: "",
    status: "Untested",
    executionType: "Functional / Manual",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Prevents accidental multiple file creation for same patient."
  },
  {
    id: "TC-PAT-003",
    module: "Patients",
    subModule: "Search & Filtering",
    title: "Verify patient search by Name, Phone Number, and MRN with debounced autocomplete",
    type: "Functional",
    priority: "P2 - High",
    severity: "Major",
    preconditions: "At least 20 sample patient records exist in clinic.",
    steps: "1. In Patient Search bar, type 'Sarah'\n2. Clear and type phone digits '555123'\n3. Clear and type exact MRN 'SMAART-CL1-2026-0089'",
    testData: "Search queries: 'Sarah', '555123', 'SMAART-CL1-2026-0089'",
    expectedResult: "Search results display instantly within 300ms; matched records highlight search terms; exact MRN search returns single record.",
    actualResult: "",
    status: "Untested",
    executionType: "Playwright E2E",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Tests MongoDB text index or indexed regex search performance."
  },

  // 5. Appointments & Scheduling
  {
    id: "TC-APT-001",
    module: "Appointments",
    subModule: "Booking & Double-Booking Prevention",
    title: "Verify appointment booking and conflict rejection when slot is already booked for practitioner",
    type: "Functional",
    priority: "P1 - Critical",
    severity: "Major",
    preconditions: "Dr. Sarah Connor has appointment booked at 2026-10-25 10:00 AM.",
    steps: "1. Select Patient B\n2. Choose Doctor: Dr. Sarah Connor\n3. Select Date: 2026-10-25, Time: 10:00 AM\n4. Click 'Confirm Appointment'",
    testData: "Doctor: Dr. Sarah Connor, DateTime: 2026-10-25T10:00:00Z, Patient: Jane Smith",
    expectedResult: "System rejects booking with validation error: 'Selected practitioner is unavailable at this time slot'; suggests next available slot.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest / Integration",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Requires atomic check or unique index constraint on practitioner+timeslot."
  },
  {
    id: "TC-APT-002",
    module: "Appointments",
    subModule: "Workflow State Transition",
    title: "Verify appointment status lifecycle: Scheduled -> Checked-In -> In-Consultation -> Completed",
    type: "Functional",
    priority: "P2 - High",
    severity: "Major",
    preconditions: "Appointment in 'Scheduled' status exists for today.",
    steps: "1. Front desk marks patient 'Checked-In'\n2. Doctor opens consultation, changing status to 'In-Consultation'\n3. Doctor finishes consultation notes and clicks 'Complete Encounter'",
    testData: "AppointmentID: [APT_TODAY_01]",
    expectedResult: "Status transitions sequentially; timestamps recorded at each state; encounter automatically initialized upon consultation start.",
    actualResult: "",
    status: "Untested",
    executionType: "Playwright E2E",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Verify UI reflects live status updates."
  },

  // 6. Clinical Encounters, Vitals & Notes
  {
    id: "TC-CLN-001",
    module: "Clinical Encounters",
    subModule: "Vitals Recording",
    title: "Verify recording patient vitals and automatic color-coded alerting for abnormal readings",
    type: "Functional",
    priority: "P2 - High",
    severity: "Major",
    preconditions: "Active encounter opened for patient.",
    steps: "1. Navigate to Vitals tab in Encounter\n2. Enter Blood Pressure: 185/115 mmHg (Hypertensive Crisis range)\n3. Enter SpO2: 89% (Hypoxia range)\n4. Enter Pulse: 72 bpm, Temp: 98.6 F\n5. Save Vitals",
    testData: "BP: 185/115, SpO2: 89%, Pulse: 72, Temp: 98.6",
    expectedResult: "Vitals saved successfully; BP and SpO2 display red badge alert with 'Critical / Abnormal Value' warning indicator.",
    actualResult: "",
    status: "Untested",
    executionType: "Manual / Playwright",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Essential clinical safety warning feature."
  },
  {
    id: "TC-CLN-002",
    module: "Clinical Encounters",
    subModule: "SOAP Notes & ICD-10 Diagnosis",
    title: "Verify clinical SOAP note entry, ICD-10 diagnosis search, and note finalization lock",
    type: "Functional",
    priority: "P1 - Critical",
    severity: "Critical",
    preconditions: "Doctor in active encounter.",
    steps: "1. Fill Subjective, Objective, Assessment, Plan sections\n2. Search and select ICD-10 code 'I10' (Essential primary hypertension)\n3. Sign and click 'Finalize Clinical Note'\n4. Attempt to edit finalized note text",
    testData: "SOAP text entries; Diagnosis ICD-10: I10",
    expectedResult: "Note is locked into read-only state; version timestamp and signing practitioner recorded; any subsequent changes require addendum.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest / Playwright",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Legal/regulatory requirement: clinical notes must not be silently modified after finalization."
  },

  // 7. Prescriptions & Pharmacy
  {
    id: "TC-RX-001",
    module: "Prescriptions",
    subModule: "Drug Allergy Alert",
    title: "Verify clinical allergy warning when prescribing a medication patient is allergic to",
    type: "Functional / Safety",
    priority: "P1 - Critical",
    severity: "Critical",
    preconditions: "Patient has recorded allergy to 'Penicillin' in their medical history.",
    steps: "1. In encounter, click 'Add Prescription'\n2. Search and select 'Amoxicillin 500mg' (Penicillin class)\n3. Attempt to save prescription",
    testData: "Prescribed Drug: Amoxicillin, Allergy: Penicillin",
    expectedResult: "High-priority alert banner pops up: 'Allergy Conflict: Patient is allergic to Penicillin derivatives'; requires explicit override reason or cancellation.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest / Manual",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Patient safety critical test."
  },
  {
    id: "TC-RX-002",
    module: "Prescriptions",
    subModule: "Pharmacy Dispense Lifecycle",
    title: "Verify electronic prescription transmission and status update to Dispensed",
    type: "Functional",
    priority: "P2 - High",
    severity: "Major",
    preconditions: "Prescription created with status 'Pending Dispense'.",
    steps: "1. Pharmacist opens Pharmacy queue\n2. Locates prescription and verifies dosage\n3. Clicks 'Dispense Medication' and enters batch number\n4. Confirms dispense",
    testData: "RxID: [RX_PENDING_01], Batch: 'LOT-9801'",
    expectedResult: "Status changes to 'Dispensed'; patient timeline updated with dispense time and pharmacist identity.",
    actualResult: "",
    status: "Untested",
    executionType: "Manual / E2E",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Ensures end-to-end pharmacy fulfillment workflow."
  },

  // 8. Laboratory & Diagnostic Imaging
  {
    id: "TC-LAB-001",
    module: "Laboratory",
    subModule: "Requisition & Results Entry",
    title: "Verify lab test requisition, specimen collection barcode tracking, and result entry",
    type: "Functional",
    priority: "P2 - High",
    severity: "Major",
    preconditions: "Doctor ordered 'Complete Blood Count (CBC)' for patient.",
    steps: "1. Lab technician marks specimen 'Collected' with Specimen ID\n2. Specimen processed; technician enters Hemoglobin: 14.2 g/dL, WBC: 7,500 /mcL\n3. Click 'Validate and Publish Results'",
    testData: "SpecimenID: 'SPEC-2026-441', Test: CBC, Hb: 14.2, WBC: 7500",
    expectedResult: "Results published to patient clinical records; values compared against biological reference ranges; status marked 'Completed'.",
    actualResult: "",
    status: "Untested",
    executionType: "Functional / Manual",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Validates lab workflow and reference range comparison."
  },

  // 9. Document Management & Security
  {
    id: "TC-DOC-001",
    module: "Documents & Storage",
    subModule: "Malware Scanning & Upload",
    title: "Verify ClamAV antivirus scans uploads and quarantines malicious or infected files",
    type: "Security",
    priority: "P1 - Critical",
    severity: "Blocker",
    preconditions: "Backend running with CLAMAV_HOST and CLAMAV_PORT enabled.",
    steps: "1. Authenticate as authorized user\n2. Attempt to upload EICAR standard antivirus test string disguised as .pdf / .jpg to /api/documents/upload\n3. Inspect HTTP response and backend quarantine log",
    testData: "File: eicar_test_virus.pdf (Standard harmless test signature)",
    expectedResult: "Upload rejected with HTTP 400/422 'File failed security scan (malware detected)'; file quarantined; security incident logged in audit.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest (tests/security)",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Tests integration with ClamAV daemon and quarantine logic."
  },
  {
    id: "TC-DOC-002",
    module: "Documents & Storage",
    subModule: "Signed Document URLs",
    title: "Verify medical document access uses short-lived signed URLs and expires after configured TTL",
    type: "Security",
    priority: "P2 - High",
    severity: "Critical",
    preconditions: "Document uploaded to Cloudinary/local storage; signed URL generated with 60-second TTL.",
    steps: "1. Request document download link via GET /api/documents/:id/url\n2. Open URL immediately in browser (within 60s)\n3. Wait 75 seconds and attempt to access same URL again",
    testData: "DocumentId: [VALID_DOC_ID]",
    expectedResult: "Step 2 successfully displays document; Step 3 fails with HTTP 401/403 Expired Signature; prevents permanent URL leakage.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest / Integration",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Prevents unauthorized sharing of PHI (Protected Health Information)."
  },

  // 10. HL7 FHIR R4 Interoperability
  {
    id: "TC-FHIR-001",
    module: "HL7 FHIR R4",
    subModule: "FHIR Patient Export",
    title: "Verify patient record export adheres to HL7 FHIR R4 Patient resource schema",
    type: "Integration",
    priority: "P1 - Critical",
    severity: "Major",
    preconditions: "Patient with complete demographics exists in system.",
    steps: "1. Send GET request to /api/fhir/r4/Patient/:id\n2. Validate response body JSON against HL7 FHIR R4 JSON Schema (resourceType, identifier, name, telecom, gender, birthDate)",
    testData: "Endpoint: /api/fhir/r4/Patient/64a100...",
    expectedResult: "HTTP 200 returned; resourceType equals 'Patient'; fields properly formatted according to FHIR R4 specification; no schema validation errors.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Interoperability validation for external healthcare exchange."
  },
  {
    id: "TC-FHIR-002",
    module: "HL7 FHIR R4",
    subModule: "FHIR Observation Resource",
    title: "Verify clinical vitals and lab observations export to FHIR Observation resource with LOINC coding",
    type: "Integration",
    priority: "P2 - High",
    severity: "Major",
    preconditions: "Encounter with recorded blood pressure exists.",
    steps: "1. Send GET request to /api/fhir/r4/Observation?patient=:id&code=85354-9\n2. Inspect response bundle",
    testData: "LOINC Code: 85354-9 (Blood pressure panel)",
    expectedResult: "HTTP 200 returned with FHIR Bundle containing Observation resources with systolic/diastolic components and correct unit of measure (mm[Hg]).",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Adherence to LOINC and UCUM medical standards."
  },

  // 11. Audit Logging & Compliance
  {
    id: "TC-AUDIT-001",
    module: "Audit & Compliance",
    subModule: "Append-Only Audit Log",
    title: "Verify immutable audit logging for all patient record read/write operations",
    type: "Compliance",
    priority: "P1 - Critical",
    severity: "Critical",
    preconditions: "Audit logger enabled.",
    steps: "1. Perform patient record update via API\n2. Query audit log collection for target patient\n3. Attempt to execute direct database update/deletion on audit log entry",
    testData: "Action: UPDATE_PATIENT_DEMOGRAPHICS",
    expectedResult: "Audit entry contains actorId, clinicId, ipAddress, userAgent, oldValues, newValues, and timestamp; MongoDB role permissions reject delete/update on audit collection.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest / Security",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "HIPAA audit trail compliance mandate."
  },
  {
    id: "TC-AUDIT-002",
    module: "Audit & Compliance",
    subModule: "PHI Log Redaction",
    title: "Verify structured application logs redact sensitive fields (passwords, tokens, national IDs)",
    type: "Security",
    priority: "P1 - Critical",
    severity: "Critical",
    preconditions: "Pino logger running with redaction configuration.",
    steps: "1. Trigger API request with sensitive payload (password, SSN/National ID, credit card)\n2. Inspect stdout / log destination",
    testData: "Payload: { email: 'user@test.com', password: 'SecretPassword123!', nationalId: '123-45-6789' }",
    expectedResult: "Logs display '[REDACTED]' for password, token, and nationalId fields; zero raw plaintext secrets exposed in log stream.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Ensures log shippers and centralized monitors do not store plaintext secrets."
  },

  // 12. Disaster Recovery & Database Health
  {
    id: "TC-OPS-001",
    module: "Operations & Reliability",
    subModule: "Health Check Endpoints",
    title: "Verify /api/health and readiness checks report status of MongoDB replica set, Redis, and RabbitMQ",
    type: "Reliability",
    priority: "P1 - Critical",
    severity: "Blocker",
    preconditions: "All infrastructure containers running.",
    steps: "1. Send GET request to /api/health\n2. Stop Redis container temporarily\n3. Send GET request to /api/health again",
    testData: "Endpoints: /api/health, /api/health/ready",
    expectedResult: "In Step 1: HTTP 200 with status 'UP' and latency for all services. In Step 3: HTTP 503 Service Unavailable indicating Redis dependency failure.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest / Ops",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Kubernetes/Docker health probe readiness check."
  },

  // 13. Non-Functional: Performance & Scalability
  {
    id: "TC-PERF-001",
    module: "Performance & Scalability",
    subModule: "API Latency SLI",
    title: "Verify API p95 response time remains under 1000ms with 50 concurrent virtual users",
    type: "Performance",
    priority: "P1 - Critical",
    severity: "Major",
    preconditions: "Backend API and database running in staging environment with representative synthetic data.",
    steps: "1. Launch load testing tool (Autocannon or k6)\n2. Execute 60-second ramp-up to 50 concurrent connections across GET /api/patients and GET /api/appointments\n3. Record histogram latency metrics and Prometheus smaart_http_request_duration_seconds",
    testData: "Load: 50 concurrent connections, Duration: 60s",
    expectedResult: "p95 latency is < 1000ms; error rate is 0.0%; CPU and memory utilization remain within safe operational thresholds.",
    actualResult: "",
    status: "Untested",
    executionType: "Autocannon / k6",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Directly validates production SLI: p95 smaart_http_request_duration_seconds <= 1s."
  },
  {
    id: "TC-PERF-002",
    module: "Performance & Scalability",
    subModule: "Patient Search Index Performance",
    title: "Verify debounced patient search autocomplete query executes in under 300ms across 50,000 patient records",
    type: "Performance",
    priority: "P2 - High",
    severity: "Major",
    preconditions: "Database populated with 50,000 indexed patient records.",
    steps: "1. Trigger search queries via GET /api/patients?q=Sarah\n2. Measure database execution time via explain('executionStats')\n3. Measure round-trip HTTP latency",
    testData: "Search terms: 'Sarah', 'Smith', '555123'",
    expectedResult: "Execution stage confirms IXSCAN (compound text/prefix index on clinicId + search tokens); query execution time < 50ms; API response < 300ms.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Vitest / Load Benchmark",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Guarantees UI feels responsive during real-time doctor typing."
  },

  // 14. Non-Functional: Resilience & Chaos Testing
  {
    id: "TC-RES-001",
    module: "Resilience & Chaos",
    subModule: "Redis Outage Graceful Degradation",
    title: "Verify API continues serving requests when Redis fails with fallback to memory rate-limiter",
    type: "Reliability",
    priority: "P1 - Critical",
    severity: "Critical",
    preconditions: "API running with active traffic.",
    steps: "1. Terminate or simulate network partition for Redis cluster\n2. Send 10 authenticated requests to /api/patients\n3. Send repeated login attempts to test rate limiting",
    testData: "Redis connection severed",
    expectedResult: "API does not crash; falls back to in-memory store for rate limiting; session verification falls back to database lookup; alert 'RedisUnavailable' triggered in Prometheus.",
    actualResult: "",
    status: "Untested",
    executionType: "Chaos / Manual Integration",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Ensures single point of failure in cache does not bring down clinical care."
  },
  {
    id: "TC-RES-002",
    module: "Resilience & Chaos",
    subModule: "RabbitMQ Outbox Event Guarantee",
    title: "Verify zero event loss during RabbitMQ broker outage via persistent MongoDB outbox table",
    type: "Reliability",
    priority: "P1 - Critical",
    severity: "Critical",
    preconditions: "Worker service running; RabbitMQ broker active.",
    steps: "1. Stop RabbitMQ broker\n2. Trigger clinical action that generates event (e.g. prescription finalized)\n3. Verify event is persisted in outbox_events table\n4. Restart RabbitMQ broker\n5. Monitor worker outbox publisher",
    testData: "Action: PRESCRIPTION_CREATED",
    expectedResult: "Event is stored safely in MongoDB outbox_events; metric smaart_outbox_pending increments; upon broker reconnect, publisher flushes all events with 0% data loss.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated Integration / Chaos",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Validates transactional outbox pattern reliability."
  },
  {
    id: "TC-RES-003",
    module: "Resilience & Chaos",
    subModule: "MongoDB Replica Set Failover",
    title: "Verify automatic replica set election recovers without dropped tenant writes (RPO 15m, RTO 2h)",
    type: "Reliability",
    priority: "P1 - Critical",
    severity: "Blocker",
    preconditions: "3-member MongoDB replica set running.",
    steps: "1. Send continuous write stream of appointments\n2. Trigger stepDown on primary member (rs.stepDown())\n3. Verify secondary elects as new PRIMARY\n4. Verify driver automatic retry and zero unhandled write exceptions",
    testData: "Replica stepdown command",
    expectedResult: "Automatic election completes within seconds; MongoDB Node.js driver retries in-flight writes; API health reports green.",
    actualResult: "",
    status: "Untested",
    executionType: "Chaos / Ops Validation",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "Tests automated cluster failover under active clinical load."
  },

  // 15. Non-Functional: Supply Chain & Security Hygiene
  {
    id: "TC-SEC-NFR-001",
    module: "Security Hygiene",
    subModule: "Dependency Vulnerability Audit",
    title: "Verify zero Critical or High known vulnerabilities in npm production dependencies",
    type: "Security",
    priority: "P1 - Critical",
    severity: "Critical",
    preconditions: "Node environment configured with current package-lock.json.",
    steps: "1. Execute 'npm audit --production' in backend and frontend directories\n2. Verify report for any Critical or High severity CVEs",
    testData: "npm audit --production",
    expectedResult: "Audit passes with 0 vulnerabilities of High or Critical severity; automated CI vulnerability gate passes.",
    actualResult: "",
    status: "Untested",
    executionType: "Automated CI (npm audit)",
    defectId: "",
    testedBy: "",
    executionDate: "",
    remarks: "HIPAA third-party library supply chain requirement."
  }
];

// Helper to escape CSV values according to RFC 4180
function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return '"' + str + '"';
}

const headers = [
  "Test Case ID",
  "Module",
  "Sub-Module",
  "Test Case Title / Scenario",
  "Test Type",
  "Priority",
  "Severity",
  "Pre-conditions",
  "Test Steps",
  "Test Data / Input",
  "Expected Result",
  "Actual Result",
  "Status",
  "Execution Type",
  "Defect / Issue ID",
  "Tested By",
  "Execution Date",
  "Remarks / Evidence"
];

// Generate CSV
const csvRows = [];
csvRows.push(headers.map(escapeCsv).join(','));

for (const tc of testCases) {
  const row = [
    tc.id,
    tc.module,
    tc.subModule,
    tc.title,
    tc.type,
    tc.priority,
    tc.severity,
    tc.preconditions,
    tc.steps,
    tc.testData,
    tc.expectedResult,
    tc.actualResult,
    tc.status,
    tc.executionType,
    tc.defectId,
    tc.testedBy,
    tc.executionDate,
    tc.remarks
  ];
  csvRows.push(row.map(escapeCsv).join(','));
}

const csvContent = "\uFEFF" + csvRows.join('\r\n'); // Include UTF-8 BOM for Excel/Google Sheets compatibility
const csvPath = path.join(__dirname, 'SMAART_EMR_Test_Cases_Template.csv');
fs.writeFileSync(csvPath, csvContent, 'utf8');
console.log(`Generated CSV test cases: ${csvPath} (${testCases.length} cases)`);

// Generate Google Apps Script for 1-click sheet creation & auto-styling
const gasScript = `/**
 * SMAART Healthcare EMR - Google Sheets Test Case Importer & Stylist
 * 
 * Instructions:
 * 1. Open Google Sheets (https://sheets.new)
 * 2. Click "Extensions" > "Apps Script"
 * 3. Delete existing code and paste this entire script
 * 4. Click "Run" (select function 'createStyledTestCaseSheet')
 * 5. Return to Google Sheets tab to see your fully styled template with dropdowns, color coding, and summary dashboard!
 */

function createStyledTestCaseSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("EMR Test Cases");
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet("EMR Test Cases", 0);
  }

  // 1. Headers & Column Setup
  const headers = ${JSON.stringify(headers)};
  const testCasesData = ${JSON.stringify(testCases.map(tc => [
  tc.id,
  tc.module,
  tc.subModule,
  tc.title,
  tc.type,
  tc.priority,
  tc.severity,
  tc.preconditions,
  tc.steps,
  tc.testData,
  tc.expectedResult,
  tc.actualResult,
  tc.status,
  tc.executionType,
  tc.defectId,
  tc.testedBy,
  tc.executionDate,
  tc.remarks
]))};

  // Insert Header Row
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Style Header Row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#0F172A") // Deep Slate Blue
             .setFontColor("#FFFFFF")
             .setFontWeight("bold")
             .setFontFamily("Inter")
             .setFontSize(10)
             .setVerticalAlignment("middle")
             .setHorizontalAlignment("center")
             .setWrap(true);
  sheet.setRowHeight(1, 42);

  // Insert Data
  if (testCasesData.length > 0) {
    const dataRange = sheet.getRange(2, 1, testCasesData.length, headers.length);
    dataRange.setValues(testCasesData);
    dataRange.setFontFamily("Inter")
             .setFontSize(9)
             .setVerticalAlignment("top")
             .setWrap(true);
  }

  // Freeze Header Row & Test Case ID
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  // 2. Set Column Widths for Optimal Readability
  const widths = [
    110, // ID
    150, // Module
    140, // Sub-Module
    260, // Title / Scenario
    100, // Test Type
    110, // Priority
    100, // Severity
    180, // Preconditions
    240, // Steps
    180, // Test Data
    240, // Expected Result
    180, // Actual Result
    110, // Status
    120, // Execution Type
    100, // Defect ID
    100, // Tested By
    110, // Date
    180  // Remarks
  ];
  for (let i = 0; i < widths.length; i++) {
    sheet.setColumnWidth(i + 1, widths[i]);
  }

  const numRows = testCasesData.length;
  if (numRows > 0) {
    // 3. Dropdown Data Validation
    // Status Column (M = column 13)
    const statusCol = sheet.getRange(2, 13, numRows, 1);
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["Untested", "Passed", "Failed", "Blocked", "In Progress", "Deferred"], true)
      .setAllowInvalid(false)
      .build();
    statusCol.setDataValidation(statusRule);

    // Priority Column (F = column 6)
    const prioCol = sheet.getRange(2, 6, numRows, 1);
    const prioRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["P1 - Critical", "P2 - High", "P3 - Medium", "P4 - Low"], true)
      .setAllowInvalid(false)
      .build();
    prioCol.setDataValidation(prioRule);

    // Severity Column (G = column 7)
    const sevCol = sheet.getRange(2, 7, numRows, 1);
    const sevRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(["Blocker", "Critical", "Major", "Minor", "Trivial"], true)
      .setAllowInvalid(false)
      .build();
    sevCol.setDataValidation(sevRule);

    // 4. Conditional Formatting for Status
    const statusRange = sheet.getRange(2, 13, numRows, 1);
    const rules = sheet.getConditionalFormatRules();

    // Passed (Soft Green)
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Passed")
      .setBackground("#DCFCE7")
      .setFontColor("#15803D")
      .setRanges([statusRange])
      .build());

    // Failed (Soft Red)
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Failed")
      .setBackground("#FEE2E2")
      .setFontColor("#B91C1C")
      .setRanges([statusRange])
      .build());

    // Blocked (Soft Orange)
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Blocked")
      .setBackground("#FEF3C7")
      .setFontColor("#B45309")
      .setRanges([statusRange])
      .build());

    // In Progress (Soft Blue)
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("In Progress")
      .setBackground("#DBEAFE")
      .setFontColor("#1D4ED8")
      .setRanges([statusRange])
      .build());

    sheet.setConditionalFormatRules(rules);
  }

  // 5. Build Dashboard Summary Sheet
  buildSummaryDashboard(ss, numRows);

  SpreadsheetApp.getActiveSpreadsheet().toast("SMAART EMR Test Case Sheet Created & Formatted Successfully!", "Complete", 5);
}

function buildSummaryDashboard(ss, totalCases) {
  let dash = ss.getSheetByName("QA Dashboard");
  if (dash) {
    dash.clear();
  } else {
    dash = ss.insertSheet("QA Dashboard", 1);
  }

  dash.setGridlines(true);
  dash.getRange("A1:E1").merge()
      .setValue("SMAART Healthcare EMR - Test Execution Dashboard")
      .setBackground("#0F172A")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold")
      .setFontSize(14)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
  dash.setRowHeight(1, 45);

  const metrics = [
    ["Metric", "Count", "Percentage", "Formula Reference"],
    ["Total Test Cases", '=COUNTA(\\'EMR Test Cases\\'!A2:A)', "100%", "Total cases logged"],
    ["Passed", '=COUNTIF(\\'EMR Test Cases\\'!M2:M, "Passed")', '=B3/B2', "Verified successfully"],
    ["Failed", '=COUNTIF(\\'EMR Test Cases\\'!M2:M, "Failed")', '=B4/B2', "Defects found"],
    ["Blocked", '=COUNTIF(\\'EMR Test Cases\\'!M2:M, "Blocked")', '=B5/B2', "Blocked by dependencies"],
    ["In Progress", '=COUNTIF(\\'EMR Test Cases\\'!M2:M, "In Progress")', '=B6/B2', "Under execution"],
    ["Untested", '=COUNTIF(\\'EMR Test Cases\\'!M2:M, "Untested")', '=B7/B2', "Awaiting execution"]
  ];

  dash.getRange(3, 1, metrics.length, 4).setValues(metrics);
  dash.getRange("A3:D3").setBackground("#1E293B").setFontColor("#FFFFFF").setFontWeight("bold");
  dash.getRange("C4:C8").setNumberFormat("0.0%");
  dash.getRange("B3:C8").setHorizontalAlignment("center");
  dash.setColumnWidth(1, 160);
  dash.setColumnWidth(2, 100);
  dash.setColumnWidth(3, 110);
  dash.setColumnWidth(4, 220);
}
`;

const gasPath = path.join(__dirname, 'GoogleAppsScript_AutoImporter.js');
fs.writeFileSync(gasPath, gasScript, 'utf8');
console.log(`Generated Google Apps Script: ${gasPath}`);
