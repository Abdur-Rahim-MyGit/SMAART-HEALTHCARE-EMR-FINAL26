# SMAART Healthcare EMR - QA Test Case Specification & Google Sheets Guide

This document defines the formal QA test case structure, classification standards, and step-by-step procedures to import and manage test cases in **Google Sheets** for the **SMAART Healthcare EMR** platform.

---

## 1. Quick Start: Google Sheets Import Methods

You have two easy ways to set up the template in Google Sheets:

### Method A: Direct CSV Import (30 Seconds)
1. Open a new Google Sheet at [sheets.new](https://sheets.new).
2. Go to **File** > **Import** > **Upload**.
3. Select or drag-and-drop the generated file:
   `docs/qa/SMAART_EMR_Test_Cases_Template.csv`
4. Under **Import location**, select **"Replace current sheet"** (or "Insert new sheet(s)").
5. Under **Separator type**, select **"Detect automatically"**.
6. Click **Import data**.

---

### Method B: Automated 1-Click Apps Script (With Colors, Dropdowns & Live Dashboard)
This method automatically configures header styling, column widths, frozen rows, **dropdown validation** (Status, Priority, Severity), **color coding**, and a **Live Metrics Dashboard**.

1. Open a new Google Sheet at [sheets.new](https://sheets.new).
2. Click **Extensions** > **Apps Script**.
3. Clear any existing code in the editor.
4. Copy and paste the entire script from:
   [`docs/qa/GoogleAppsScript_AutoImporter.js`](./GoogleAppsScript_AutoImporter.js)
5. Click the **Save** icon (disk) and then click **Run** (with function `createStyledTestCaseSheet` selected).
6. Return to your Google Sheet:
   - **`EMR Test Cases`** tab: Complete test repository with colored status dropdowns and wrapped text.
   - **`QA Dashboard`** tab: Live summary formulas tracking Total Cases, Passed %, Failed %, and Execution Progress.

---

## 2. Template Structure & Column Schema

The template contains 18 industry-standard QA fields:

| Column # | Field Name | Description | Example Values |
|---|---|---|---|
| **A** | **Test Case ID** | Unique standardized alphanumeric identifier | `TC-AUTH-001`, `TC-PAT-001` |
| **B** | **Module** | Top-level functional area in the modular monolith | `Authentication & RBAC`, `Patients`, `HL7 FHIR R4` |
| **C** | **Sub-Module** | Specific component, service, or feature | `Super Master Admin Login`, `Malware Scanning` |
| **D** | **Test Case Title / Scenario** | Descriptive objective of the test case | *Verify brute force rate limiting after 5 failed attempts* |
| **E** | **Test Type** | Testing methodology | `Functional`, `Security`, `Integration`, `Negative`, `Compliance` |
| **F** | **Priority** | Business & execution criticality | `P1 - Critical`, `P2 - High`, `P3 - Medium`, `P4 - Low` |
| **G** | **Severity** | Technical impact if defective | `Blocker`, `Critical`, `Major`, `Minor`, `Trivial` |
| **H** | **Pre-conditions** | Prerequisites, active roles, and seeded data state | *Super Master Admin bootstrapped; OTP secret registered.* |
| **I** | **Test Steps** | Step-by-step numbered execution instructions | `1. Navigate to /login ... 2. Submit credentials` |
| **J** | **Test Data / Input** | Explicit inputs, IDs, or payload attributes | `Email: superadmin@smaart.local, OTP: 123456` |
| **K** | **Expected Result** | Explicit expected system response | *HTTP 200 returned; session token and cookie issued.* |
| **L** | **Actual Result** | Observed behavior during QA execution | *Matches expected* / *Failed on step 3* |
| **M** | **Status** | Current test execution outcome | `Untested`, `Passed`, `Failed`, `Blocked`, `In Progress`, `Deferred` |
| **N** | **Execution Type** | Execution vehicle | `Manual`, `Automated Vitest`, `Playwright E2E` |
| **O** | **Defect / Issue ID** | Reference to Jira / GitHub Issue if Failed | `GH-104`, `BUG-2026-01` |
| **P** | **Tested By** | QA Engineer name or automated CI bot | `QA Lead`, `CI/CD Pipeline` |
| **Q** | **Execution Date** | Date of execution | `YYYY-MM-DD` |
| **R** | **Remarks / Evidence** | Links to screenshots, trace files, or notes | *Logs attached; ClamAV daemon was online* |

---

## 3. Classification Standards

### Priority Scale
- **`P1 - Critical`**: Must execute on every build / smoke test. Core healthcare workflows (Auth, Tenant isolation, Patient records, Prescription safety).
- **`P2 - High`**: Primary business workflows (Appointments, Lab results, Document uploads, FHIR exports).
- **`P3 - Medium`**: Secondary features (Filters, Sorting, Profile edits, Pagination).
- **`P4 - Low`**: Cosmetic, minor UI alignment, or non-functional preferences.

### Severity Matrix
- **`Blocker`**: System unusable, data loss, security compromise, or complete crash with no workaround.
- **`Critical`**: Core function broken (e.g. prescription allergy warning failed, cross-tenant patient leakage).
- **`Major`**: High-impact feature fails but a reasonable clinical workaround exists.
- **`Minor`**: Minor inconvenience, non-breaking validation text issue.
- **`Trivial`**: Typo or cosmetic styling imperfection.

### Status Color Coding in Google Sheets
- 🟩 **`Passed`**: Background `#DCFCE7`, Text `#15803D`
- 🟥 **`Failed`**: Background `#FEE2E2`, Text `#B91C1C`
- 🟧 **`Blocked`**: Background `#FEF3C7`, Text `#B45309`
- 🟦 **`In Progress`**: Background `#DBEAFE`, Text `#1D4ED8`
- ⬜ **`Untested`**: Default neutral

---

## 4. Test Coverage Included in Template

The template includes 23 pre-populated, verified test cases matching the **SMAART Healthcare EMR** implementation:

1. **Authentication & RBAC**:
   - `TC-AUTH-001`: Super Master Admin login with Argon2id and OTP 2FA.
   - `TC-AUTH-002`: Redis-backed brute force rate limiting on 5 consecutive failed logins.
   - `TC-AUTH-003`: Rotating httpOnly refresh token renewal and reuse prevention.
2. **Multi-Tenant Isolation**:
   - `TC-TENANT-001`: Clinic A admin cannot access Clinic B patient data (Data Access Layer scoping).
   - `TC-TENANT-002`: Super Master Admin cross-tenant context switching with audit logging.
3. **Practitioners & Clinical Resources**:
   - `TC-PRAC-001`: Clinical resource creation (Doctor/Nurse) without system login account generation.
4. **Patient Management**:
   - `TC-PAT-001`: Patient registration and unique MRN/UHID generation.
   - `TC-PAT-002`: Duplicate patient detection via phone number and DOB.
   - `TC-PAT-003`: Fast debounced search across names, phone numbers, and MRNs.
5. **Appointments & Scheduling**:
   - `TC-APT-001`: Double-booking conflict rejection for practitioner schedules.
   - `TC-APT-002`: Status lifecycle (Scheduled → Checked-In → In-Consultation → Completed).
6. **Clinical Encounters & Notes**:
   - `TC-CLN-001`: Patient vitals recording and automatic alerting for abnormal values.
   - `TC-CLN-002`: SOAP clinical notes, ICD-10 diagnosis search, and note locking.
7. **Prescriptions & Pharmacy**:
   - `TC-RX-001`: Drug allergy conflict alert (e.g. Penicillin allergy alert on Amoxicillin).
   - `TC-RX-002`: Pharmacy dispense workflow and timeline updating.
8. **Laboratory & Diagnostics**:
   - `TC-LAB-001`: Lab test requisition, specimen tracking, and biological reference range comparison.
9. **Document Security & Storage**:
   - `TC-DOC-001`: ClamAV antivirus upload scanning and malicious file quarantine.
   - `TC-DOC-002`: Short-lived signed URLs for protected document viewing.
10. **HL7 FHIR R4 Interoperability**:
    - `TC-FHIR-001`: Patient resource export adhering to FHIR R4 schema.
    - `TC-FHIR-002`: Clinical vitals and lab observations export with LOINC coding.
11. **Audit & Compliance**:
    - `TC-AUDIT-001`: Append-only immutable audit trail for patient operations.
    - `TC-AUDIT-002`: Sensitive field redaction in structured application logs.
12. **Operations & Reliability**:
    - `TC-OPS-001`: Multi-service health and readiness check (`/api/health`).

---

## 5. Automated Test Execution Commands

To execute automated tests that validate these test cases in the local codebase:

```bash
# Backend Unit & Security Tests (Argon2id, Tenant scoping, ClamAV, FHIR)
cd backend
npm test

# Security and integration tests specifically:
npm run test:integration

# Frontend End-to-End Tests (Patient registration, Appointments, Encounter UI)
cd frontend
npm run test:e2e
```
