/**
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
  const headers = ["Test Case ID","Module","Sub-Module","Test Case Title / Scenario","Test Type","Priority","Severity","Pre-conditions","Test Steps","Test Data / Input","Expected Result","Actual Result","Status","Execution Type","Defect / Issue ID","Tested By","Execution Date","Remarks / Evidence"];
  const testCasesData = [["TC-AUTH-001","Authentication & RBAC","Super Master Admin Login","Verify successful Super Master Admin authentication with valid credentials and OTP 2FA","Functional","P1 - Critical","Blocker","Super Master Admin account bootstrapped in system; valid OTP secret registered.","1. Navigate to login page /auth/login\n2. Enter Super Master Admin email and password\n3. Click 'Sign In'\n4. Enter valid 6-digit OTP when prompted\n5. Submit 2FA verification","Email: superadmin@smaart.local, Password: [ValidArgon2idPass], OTP: [CurrentValidCode]","User authenticated successfully; 15-minute access token and rotating httpOnly refresh cookie issued; redirected to Platform Dashboard with super_master_admin role privileges.","","Untested","Automated Vitest / Manual","","","","Covers Argon2id verification and session token generation."],["TC-AUTH-002","Authentication & RBAC","Brute Force Protection","Verify account rate limiting after 5 consecutive failed login attempts","Security","P1 - Critical","Critical","Target user exists; Redis rate limiter active.","1. Navigate to login endpoint /api/auth/login\n2. Submit incorrect password 5 consecutive times within 1 minute\n3. Attempt 6th login with correct password","Email: clinicadmin@cityclinic.local, InvalidPassword: 'WrongPassword!'","HTTP 429 Too Many Requests returned on 6th attempt; message 'Too many login attempts. Please try again after 15 minutes.' logged in audit.","","Untested","Automated Vitest","","","","Rate limiting backed by Redis and express-rate-limit."],["TC-AUTH-003","Authentication & RBAC","Token Lifecycle","Verify automatic access token refresh via rotating httpOnly refresh token","Integration","P2 - High","Major","User logged in; access token expired (>15 mins); refresh token cookie present.","1. Make API request with expired access token\n2. Intercept 401 response and trigger POST /api/auth/refresh\n3. Inspect response and new cookie header","Cookie: refreshToken=[valid_jwt]","HTTP 200 returned with fresh access token; old refresh token invalidated and new refresh token set in httpOnly cookie.","","Untested","Automated Vitest","","","","Token reuse detection should invalidate session if an old refresh token is reused."],["TC-TENANT-001","Multi-Tenant Isolation","Clinic Admin Scoping","Ensure Clinic Admin A cannot view, query, or edit Patient records belonging to Clinic B","Security","P1 - Critical","Blocker","Two clinics exist: Clinic A (ID: 64a1...) and Clinic B (ID: 64b2...). Patient P_B belongs to Clinic B.","1. Authenticate as Clinic Admin of Clinic A\n2. Send GET request to /api/patients/:patientId_B\n3. Send PUT request to update medical details of Patient P_B","User: Admin Clinic A, TargetPatientId: [ID of Patient in Clinic B]","HTTP 403 Forbidden or HTTP 404 Not Found returned; Tenant Data Access Layer strictly enforces clinicId filter; no data leaked.","","Untested","Automated Vitest","","","","Critical HIPAA/EMR multi-tenancy verification test."],["TC-TENANT-002","Multi-Tenant Isolation","Super Admin Cross-Tenant Access","Verify Super Master Admin can access and switch clinic contexts securely with explicit audit logging","Functional","P2 - High","Major","Super Master Admin logged in; multiple active clinics onboarded.","1. Switch active clinic context via clinic selector in UI\n2. Query clinic dashboard and patient stats\n3. Check system audit collection","SuperAdmin token, ContextClinicId: 'clinic_south_branch_01'","Clinic data loads correctly; audit log records 'SUPER_ADMIN_CROSS_TENANT_ACCESS' event with admin ID, timestamp, and target clinic ID.","","Untested","Manual / Vitest","","","","Ensures compliance transparency for platform-level operators."],["TC-PRAC-001","Practitioners","Resource Onboarding","Verify creation of Doctor/Nurse clinical resource without generating system login accounts","Functional","P2 - High","Major","Clinic Admin logged in for active clinic.","1. Navigate to Clinic Admin > Practitioners > Add Practitioner\n2. Fill Name, Role (Doctor), Specialty (Cardiology), Medical License Number, Contact\n3. Click 'Save Practitioner'\n4. Verify database users collection vs practitioners collection","Name: Dr. Sarah Connor, License: MC-98214, Role: Doctor, Department: Cardiology","Practitioner record created in 'practitioners' collection with assigned clinicId; NO login user entry created in 'users' collection.","","Untested","Automated Vitest / Manual","","","","System architecture rule: Doctors/Nurses are clinical resources, not separate logins."],["TC-PAT-001","Patients","Registration & UHID","Verify new patient registration with unique Medical Record Number (MRN/UHID) generation","Functional","P1 - Critical","Critical","Clinic Admin or Front Desk operator logged in.","1. Open 'Register New Patient' modal\n2. Enter First Name, Last Name, DOB, Gender, Phone Number, Emergency Contact, Address\n3. Submit registration form","Name: John Doe, DOB: 1985-04-12, Gender: Male, Phone: +15551234567","Patient record created; unique MRN generated (e.g. SMAART-CL1-2026-0089); patient profile view opened with initial timeline.","","Untested","Playwright E2E","","","","MRN must be globally unique per clinic and follow standard format."],["TC-PAT-002","Patients","Duplicate Patient Prevention","Verify duplicate patient warning when registering with existing phone number and DOB","Negative","P2 - High","Minor","Patient John Doe with phone +15551234567 and DOB 1985-04-12 already exists in clinic.","1. Attempt to register new patient with identical Phone and DOB\n2. Submit registration","Phone: +15551234567, DOB: 1985-04-12, Name: Jonathan Doe","System prompts warning: 'Potential duplicate record detected with matching phone and DOB' with option to view existing record or proceed.","","Untested","Functional / Manual","","","","Prevents accidental multiple file creation for same patient."],["TC-PAT-003","Patients","Search & Filtering","Verify patient search by Name, Phone Number, and MRN with debounced autocomplete","Functional","P2 - High","Major","At least 20 sample patient records exist in clinic.","1. In Patient Search bar, type 'Sarah'\n2. Clear and type phone digits '555123'\n3. Clear and type exact MRN 'SMAART-CL1-2026-0089'","Search queries: 'Sarah', '555123', 'SMAART-CL1-2026-0089'","Search results display instantly within 300ms; matched records highlight search terms; exact MRN search returns single record.","","Untested","Playwright E2E","","","","Tests MongoDB text index or indexed regex search performance."],["TC-APT-001","Appointments","Booking & Double-Booking Prevention","Verify appointment booking and conflict rejection when slot is already booked for practitioner","Functional","P1 - Critical","Major","Dr. Sarah Connor has appointment booked at 2026-10-25 10:00 AM.","1. Select Patient B\n2. Choose Doctor: Dr. Sarah Connor\n3. Select Date: 2026-10-25, Time: 10:00 AM\n4. Click 'Confirm Appointment'","Doctor: Dr. Sarah Connor, DateTime: 2026-10-25T10:00:00Z, Patient: Jane Smith","System rejects booking with validation error: 'Selected practitioner is unavailable at this time slot'; suggests next available slot.","","Untested","Automated Vitest / Integration","","","","Requires atomic check or unique index constraint on practitioner+timeslot."],["TC-APT-002","Appointments","Workflow State Transition","Verify appointment status lifecycle: Scheduled -> Checked-In -> In-Consultation -> Completed","Functional","P2 - High","Major","Appointment in 'Scheduled' status exists for today.","1. Front desk marks patient 'Checked-In'\n2. Doctor opens consultation, changing status to 'In-Consultation'\n3. Doctor finishes consultation notes and clicks 'Complete Encounter'","AppointmentID: [APT_TODAY_01]","Status transitions sequentially; timestamps recorded at each state; encounter automatically initialized upon consultation start.","","Untested","Playwright E2E","","","","Verify UI reflects live status updates."],["TC-CLN-001","Clinical Encounters","Vitals Recording","Verify recording patient vitals and automatic color-coded alerting for abnormal readings","Functional","P2 - High","Major","Active encounter opened for patient.","1. Navigate to Vitals tab in Encounter\n2. Enter Blood Pressure: 185/115 mmHg (Hypertensive Crisis range)\n3. Enter SpO2: 89% (Hypoxia range)\n4. Enter Pulse: 72 bpm, Temp: 98.6 F\n5. Save Vitals","BP: 185/115, SpO2: 89%, Pulse: 72, Temp: 98.6","Vitals saved successfully; BP and SpO2 display red badge alert with 'Critical / Abnormal Value' warning indicator.","","Untested","Manual / Playwright","","","","Essential clinical safety warning feature."],["TC-CLN-002","Clinical Encounters","SOAP Notes & ICD-10 Diagnosis","Verify clinical SOAP note entry, ICD-10 diagnosis search, and note finalization lock","Functional","P1 - Critical","Critical","Doctor in active encounter.","1. Fill Subjective, Objective, Assessment, Plan sections\n2. Search and select ICD-10 code 'I10' (Essential primary hypertension)\n3. Sign and click 'Finalize Clinical Note'\n4. Attempt to edit finalized note text","SOAP text entries; Diagnosis ICD-10: I10","Note is locked into read-only state; version timestamp and signing practitioner recorded; any subsequent changes require addendum.","","Untested","Automated Vitest / Playwright","","","","Legal/regulatory requirement: clinical notes must not be silently modified after finalization."],["TC-RX-001","Prescriptions","Drug Allergy Alert","Verify clinical allergy warning when prescribing a medication patient is allergic to","Functional / Safety","P1 - Critical","Critical","Patient has recorded allergy to 'Penicillin' in their medical history.","1. In encounter, click 'Add Prescription'\n2. Search and select 'Amoxicillin 500mg' (Penicillin class)\n3. Attempt to save prescription","Prescribed Drug: Amoxicillin, Allergy: Penicillin","High-priority alert banner pops up: 'Allergy Conflict: Patient is allergic to Penicillin derivatives'; requires explicit override reason or cancellation.","","Untested","Automated Vitest / Manual","","","","Patient safety critical test."],["TC-RX-002","Prescriptions","Pharmacy Dispense Lifecycle","Verify electronic prescription transmission and status update to Dispensed","Functional","P2 - High","Major","Prescription created with status 'Pending Dispense'.","1. Pharmacist opens Pharmacy queue\n2. Locates prescription and verifies dosage\n3. Clicks 'Dispense Medication' and enters batch number\n4. Confirms dispense","RxID: [RX_PENDING_01], Batch: 'LOT-9801'","Status changes to 'Dispensed'; patient timeline updated with dispense time and pharmacist identity.","","Untested","Manual / E2E","","","","Ensures end-to-end pharmacy fulfillment workflow."],["TC-LAB-001","Laboratory","Requisition & Results Entry","Verify lab test requisition, specimen collection barcode tracking, and result entry","Functional","P2 - High","Major","Doctor ordered 'Complete Blood Count (CBC)' for patient.","1. Lab technician marks specimen 'Collected' with Specimen ID\n2. Specimen processed; technician enters Hemoglobin: 14.2 g/dL, WBC: 7,500 /mcL\n3. Click 'Validate and Publish Results'","SpecimenID: 'SPEC-2026-441', Test: CBC, Hb: 14.2, WBC: 7500","Results published to patient clinical records; values compared against biological reference ranges; status marked 'Completed'.","","Untested","Functional / Manual","","","","Validates lab workflow and reference range comparison."],["TC-DOC-001","Documents & Storage","Malware Scanning & Upload","Verify ClamAV antivirus scans uploads and quarantines malicious or infected files","Security","P1 - Critical","Blocker","Backend running with CLAMAV_HOST and CLAMAV_PORT enabled.","1. Authenticate as authorized user\n2. Attempt to upload EICAR standard antivirus test string disguised as .pdf / .jpg to /api/documents/upload\n3. Inspect HTTP response and backend quarantine log","File: eicar_test_virus.pdf (Standard harmless test signature)","Upload rejected with HTTP 400/422 'File failed security scan (malware detected)'; file quarantined; security incident logged in audit.","","Untested","Automated Vitest (tests/security)","","","","Tests integration with ClamAV daemon and quarantine logic."],["TC-DOC-002","Documents & Storage","Signed Document URLs","Verify medical document access uses short-lived signed URLs and expires after configured TTL","Security","P2 - High","Critical","Document uploaded to Cloudinary/local storage; signed URL generated with 60-second TTL.","1. Request document download link via GET /api/documents/:id/url\n2. Open URL immediately in browser (within 60s)\n3. Wait 75 seconds and attempt to access same URL again","DocumentId: [VALID_DOC_ID]","Step 2 successfully displays document; Step 3 fails with HTTP 401/403 Expired Signature; prevents permanent URL leakage.","","Untested","Automated Vitest / Integration","","","","Prevents unauthorized sharing of PHI (Protected Health Information)."],["TC-FHIR-001","HL7 FHIR R4","FHIR Patient Export","Verify patient record export adheres to HL7 FHIR R4 Patient resource schema","Integration","P1 - Critical","Major","Patient with complete demographics exists in system.","1. Send GET request to /api/fhir/r4/Patient/:id\n2. Validate response body JSON against HL7 FHIR R4 JSON Schema (resourceType, identifier, name, telecom, gender, birthDate)","Endpoint: /api/fhir/r4/Patient/64a100...","HTTP 200 returned; resourceType equals 'Patient'; fields properly formatted according to FHIR R4 specification; no schema validation errors.","","Untested","Automated Vitest","","","","Interoperability validation for external healthcare exchange."],["TC-FHIR-002","HL7 FHIR R4","FHIR Observation Resource","Verify clinical vitals and lab observations export to FHIR Observation resource with LOINC coding","Integration","P2 - High","Major","Encounter with recorded blood pressure exists.","1. Send GET request to /api/fhir/r4/Observation?patient=:id&code=85354-9\n2. Inspect response bundle","LOINC Code: 85354-9 (Blood pressure panel)","HTTP 200 returned with FHIR Bundle containing Observation resources with systolic/diastolic components and correct unit of measure (mm[Hg]).","","Untested","Automated Vitest","","","","Adherence to LOINC and UCUM medical standards."],["TC-AUDIT-001","Audit & Compliance","Append-Only Audit Log","Verify immutable audit logging for all patient record read/write operations","Compliance","P1 - Critical","Critical","Audit logger enabled.","1. Perform patient record update via API\n2. Query audit log collection for target patient\n3. Attempt to execute direct database update/deletion on audit log entry","Action: UPDATE_PATIENT_DEMOGRAPHICS","Audit entry contains actorId, clinicId, ipAddress, userAgent, oldValues, newValues, and timestamp; MongoDB role permissions reject delete/update on audit collection.","","Untested","Automated Vitest / Security","","","","HIPAA audit trail compliance mandate."],["TC-AUDIT-002","Audit & Compliance","PHI Log Redaction","Verify structured application logs redact sensitive fields (passwords, tokens, national IDs)","Security","P1 - Critical","Critical","Pino logger running with redaction configuration.","1. Trigger API request with sensitive payload (password, SSN/National ID, credit card)\n2. Inspect stdout / log destination","Payload: { email: 'user@test.com', password: 'SecretPassword123!', nationalId: '123-45-6789' }","Logs display '[REDACTED]' for password, token, and nationalId fields; zero raw plaintext secrets exposed in log stream.","","Untested","Automated Vitest","","","","Ensures log shippers and centralized monitors do not store plaintext secrets."],["TC-OPS-001","Operations & Reliability","Health Check Endpoints","Verify /api/health and readiness checks report status of MongoDB replica set, Redis, and RabbitMQ","Reliability","P1 - Critical","Blocker","All infrastructure containers running.","1. Send GET request to /api/health\n2. Stop Redis container temporarily\n3. Send GET request to /api/health again","Endpoints: /api/health, /api/health/ready","In Step 1: HTTP 200 with status 'UP' and latency for all services. In Step 3: HTTP 503 Service Unavailable indicating Redis dependency failure.","","Untested","Automated Vitest / Ops","","","","Kubernetes/Docker health probe readiness check."],["TC-PERF-001","Performance & Scalability","API Latency SLI","Verify API p95 response time remains under 1000ms with 50 concurrent virtual users","Performance","P1 - Critical","Major","Backend API and database running in staging environment with representative synthetic data.","1. Launch load testing tool (Autocannon or k6)\n2. Execute 60-second ramp-up to 50 concurrent connections across GET /api/patients and GET /api/appointments\n3. Record histogram latency metrics and Prometheus smaart_http_request_duration_seconds","Load: 50 concurrent connections, Duration: 60s","p95 latency is < 1000ms; error rate is 0.0%; CPU and memory utilization remain within safe operational thresholds.","","Untested","Autocannon / k6","","","","Directly validates production SLI: p95 smaart_http_request_duration_seconds <= 1s."],["TC-PERF-002","Performance & Scalability","Patient Search Index Performance","Verify debounced patient search autocomplete query executes in under 300ms across 50,000 patient records","Performance","P2 - High","Major","Database populated with 50,000 indexed patient records.","1. Trigger search queries via GET /api/patients?q=Sarah\n2. Measure database execution time via explain('executionStats')\n3. Measure round-trip HTTP latency","Search terms: 'Sarah', 'Smith', '555123'","Execution stage confirms IXSCAN (compound text/prefix index on clinicId + search tokens); query execution time < 50ms; API response < 300ms.","","Untested","Automated Vitest / Load Benchmark","","","","Guarantees UI feels responsive during real-time doctor typing."],["TC-RES-001","Resilience & Chaos","Redis Outage Graceful Degradation","Verify API continues serving requests when Redis fails with fallback to memory rate-limiter","Reliability","P1 - Critical","Critical","API running with active traffic.","1. Terminate or simulate network partition for Redis cluster\n2. Send 10 authenticated requests to /api/patients\n3. Send repeated login attempts to test rate limiting","Redis connection severed","API does not crash; falls back to in-memory store for rate limiting; session verification falls back to database lookup; alert 'RedisUnavailable' triggered in Prometheus.","","Untested","Chaos / Manual Integration","","","","Ensures single point of failure in cache does not bring down clinical care."],["TC-RES-002","Resilience & Chaos","RabbitMQ Outbox Event Guarantee","Verify zero event loss during RabbitMQ broker outage via persistent MongoDB outbox table","Reliability","P1 - Critical","Critical","Worker service running; RabbitMQ broker active.","1. Stop RabbitMQ broker\n2. Trigger clinical action that generates event (e.g. prescription finalized)\n3. Verify event is persisted in outbox_events table\n4. Restart RabbitMQ broker\n5. Monitor worker outbox publisher","Action: PRESCRIPTION_CREATED","Event is stored safely in MongoDB outbox_events; metric smaart_outbox_pending increments; upon broker reconnect, publisher flushes all events with 0% data loss.","","Untested","Automated Integration / Chaos","","","","Validates transactional outbox pattern reliability."],["TC-RES-003","Resilience & Chaos","MongoDB Replica Set Failover","Verify automatic replica set election recovers without dropped tenant writes (RPO 15m, RTO 2h)","Reliability","P1 - Critical","Blocker","3-member MongoDB replica set running.","1. Send continuous write stream of appointments\n2. Trigger stepDown on primary member (rs.stepDown())\n3. Verify secondary elects as new PRIMARY\n4. Verify driver automatic retry and zero unhandled write exceptions","Replica stepdown command","Automatic election completes within seconds; MongoDB Node.js driver retries in-flight writes; API health reports green.","","Untested","Chaos / Ops Validation","","","","Tests automated cluster failover under active clinical load."],["TC-SEC-NFR-001","Security Hygiene","Dependency Vulnerability Audit","Verify zero Critical or High known vulnerabilities in npm production dependencies","Security","P1 - Critical","Critical","Node environment configured with current package-lock.json.","1. Execute 'npm audit --production' in backend and frontend directories\n2. Verify report for any Critical or High severity CVEs","npm audit --production","Audit passes with 0 vulnerabilities of High or Critical severity; automated CI vulnerability gate passes.","","Untested","Automated CI (npm audit)","","","","HIPAA third-party library supply chain requirement."]];

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
    ["Total Test Cases", '=COUNTA(\'EMR Test Cases\'!A2:A)', "100%", "Total cases logged"],
    ["Passed", '=COUNTIF(\'EMR Test Cases\'!M2:M, "Passed")', '=B3/B2', "Verified successfully"],
    ["Failed", '=COUNTIF(\'EMR Test Cases\'!M2:M, "Failed")', '=B4/B2', "Defects found"],
    ["Blocked", '=COUNTIF(\'EMR Test Cases\'!M2:M, "Blocked")', '=B5/B2', "Blocked by dependencies"],
    ["In Progress", '=COUNTIF(\'EMR Test Cases\'!M2:M, "In Progress")', '=B6/B2', "Under execution"],
    ["Untested", '=COUNTIF(\'EMR Test Cases\'!M2:M, "Untested")', '=B7/B2', "Awaiting execution"]
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
