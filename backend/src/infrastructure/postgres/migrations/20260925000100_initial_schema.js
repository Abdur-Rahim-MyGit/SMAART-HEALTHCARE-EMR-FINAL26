'use strict';
/**
 * Initial PostgreSQL schema for the SMAART Healthcare EMR.
 * UUID primary keys, audit columns, foreign keys, unique/check constraints,
 * indexes, soft delete and optimistic locking (version) where appropriate.
 */
const AUDIT_COLS = `
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz,
  version     integer NOT NULL DEFAULT 1`;

exports.up = async function up(knex) {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "citext"`);
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION set_updated_at_and_version() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at := now();
      IF TG_OP = 'UPDATE' AND NEW.version = OLD.version THEN
        NEW.version := OLD.version + 1;
      END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql;`);

  await knex.raw(`
    CREATE TABLE roles (
      code        text PRIMARY KEY,
      name        text NOT NULL,
      description text,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE permissions (
      code        text PRIMARY KEY,
      description text
    );
    CREATE TABLE role_permissions (
      role_code       text NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
      permission_code text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
      PRIMARY KEY (role_code, permission_code)
    );

    CREATE TABLE clinics (
      id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_code            text UNIQUE,
      name                   text NOT NULL,
      type                   text,
      registration_number    text,
      year_of_establishment  integer CHECK (year_of_establishment IS NULL OR year_of_establishment BETWEEN 1800 AND 2100),
      address                text,
      city                   text,
      state                  text,
      country                text,
      zip_code               text,
      phone                  text,
      email                  citext,
      website                text,
      owner_name             text,
      owner_medical_id       text,
      admin_name             text,
      admin_contact          text,
      admin_email            citext NOT NULL,
      admin_username         text,
      trade_license          text,
      medical_council_cert   text,
      tax_id                 text,
      accreditation          text,
      specialties            jsonb NOT NULL DEFAULT '[]'::jsonb,
      services               jsonb NOT NULL DEFAULT '[]'::jsonb,
      operating_hours        text,
      staff_count            integer,
      beds                   integer,
      pharmacy_available     boolean NOT NULL DEFAULT false,
      laboratory_available   boolean NOT NULL DEFAULT false,
      payment_methods        jsonb NOT NULL DEFAULT '[]'::jsonb,
      bank_info              text,
      is_active              boolean NOT NULL DEFAULT true,
      validity_start         timestamptz NOT NULL DEFAULT now(),
      validity_end           timestamptz NOT NULL,
      validity_duration_months integer NOT NULL DEFAULT 12,
      renewal_history        jsonb NOT NULL DEFAULT '[]'::jsonb,
      settings               jsonb NOT NULL DEFAULT '{}'::jsonb,
      ${AUDIT_COLS},
      CHECK (validity_end > validity_start)
    );
    CREATE UNIQUE INDEX clinics_admin_email_uidx ON clinics (admin_email) WHERE deleted_at IS NULL;
    CREATE INDEX clinics_name_trgm_idx ON clinics USING gin (name gin_trgm_ops);
    CREATE INDEX clinics_validity_end_idx ON clinics (validity_end);

    CREATE TABLE users (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id             uuid REFERENCES clinics(id) ON DELETE RESTRICT,
      role                  text NOT NULL REFERENCES roles(code),
      email                 citext NOT NULL,
      password_hash         text NOT NULL,
      first_name            text,
      last_name             text,
      full_name             text,
      phone                 text,
      username              text,
      is_active             boolean NOT NULL DEFAULT true,
      is_verified           boolean NOT NULL DEFAULT true,
      last_login_at         timestamptz,
      failed_login_attempts integer NOT NULL DEFAULT 0,
      locked_until          timestamptz,
      password_changed_at   timestamptz NOT NULL DEFAULT now(),
      ${AUDIT_COLS},
      CONSTRAINT users_role_clinic_chk CHECK (
        (role = 'super_master_admin' AND clinic_id IS NULL) OR
        (role = 'clinic_admin' AND clinic_id IS NOT NULL)
      )
    );
    CREATE UNIQUE INDEX users_email_uidx ON users (email) WHERE deleted_at IS NULL;
    CREATE INDEX users_clinic_idx ON users (clinic_id);

    CREATE TABLE auth_sessions (
      id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash   text NOT NULL,
      previous_token_hash  text,
      user_agent           text,
      ip                   text,
      created_at           timestamptz NOT NULL DEFAULT now(),
      last_used_at         timestamptz NOT NULL DEFAULT now(),
      expires_at           timestamptz NOT NULL,
      revoked_at           timestamptz,
      revoke_reason        text
    );
    CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);
    CREATE UNIQUE INDEX auth_sessions_token_uidx ON auth_sessions (refresh_token_hash);

    CREATE TABLE otp_challenges (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose      text NOT NULL CHECK (purpose IN ('login','password_reset','verify_email')),
      code_hash    text NOT NULL,
      salt         text NOT NULL,
      attempts     integer NOT NULL DEFAULT 0,
      expires_at   timestamptz NOT NULL,
      verified_at  timestamptz,
      consumed_at  timestamptz,
      ip           text,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX otp_challenges_user_purpose_idx ON otp_challenges (user_id, purpose, created_at DESC);

    CREATE TABLE practitioners (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id         uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      kind              text NOT NULL CHECK (kind IN ('doctor','nurse','lab_technician')),
      full_name         text NOT NULL,
      email             citext,
      phone             text,
      specialty         text,
      qualification     text,
      license_number    text,
      department        text,
      shift             text,
      experience_years  numeric(4,1),
      about             text,
      languages         jsonb NOT NULL DEFAULT '[]'::jsonb,
      uhid              text,
      profile_image_url text,
      profile_document_id uuid,
      current_address   jsonb,
      permanent_address jsonb,
      attributes        jsonb NOT NULL DEFAULT '{}'::jsonb,
      is_active         boolean NOT NULL DEFAULT true,
      ${AUDIT_COLS}
    );
    CREATE UNIQUE INDEX practitioners_clinic_email_uidx ON practitioners (clinic_id, email) WHERE email IS NOT NULL AND deleted_at IS NULL;
    CREATE INDEX practitioners_clinic_kind_idx ON practitioners (clinic_id, kind);
    CREATE INDEX practitioners_name_trgm_idx ON practitioners USING gin (full_name gin_trgm_ops);

    CREATE TABLE patients (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id           uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      full_name           text NOT NULL,
      date_of_birth       date,
      gender              text CHECK (gender IS NULL OR lower(gender) IN ('male','female','other','unknown')),
      phone               text,
      email               citext,
      blood_group         text,
      marital_status      text,
      nationality         text,
      occupation          text,
      mode_of_care        text,
      city                text,
      pin_code            text,
      address             jsonb NOT NULL DEFAULT '{}'::jsonb,
      emergency_contact   jsonb NOT NULL DEFAULT '{}'::jsonb,
      insurance           jsonb NOT NULL DEFAULT '{}'::jsonb,
      attender_email      citext,
      attender_mobile     text,
      attender_whatsapp   text,
      referring_doctor    text,
      referred_clinic     text,
      hand_dominance      text,
      is_under_18         boolean NOT NULL DEFAULT false,
      parent_guardian     jsonb NOT NULL DEFAULT '{}'::jsonb,
      notes               text,
      profile_image_url   text,
      profile_document_id uuid,
      government_document_id uuid,
      status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','deceased','merged')),
      last_visit_at       timestamptz,
      next_appointment_at timestamptz,
      attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,
      ${AUDIT_COLS}
    );
    CREATE INDEX patients_clinic_idx ON patients (clinic_id, created_at DESC);
    CREATE INDEX patients_name_trgm_idx ON patients USING gin (full_name gin_trgm_ops);
    CREATE INDEX patients_phone_idx ON patients (phone);
    CREATE INDEX patients_email_idx ON patients (email);

    CREATE TABLE patient_identifiers (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id   uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id  uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      system      text NOT NULL CHECK (system IN ('uhid','mrn','aadhaar','insurance','legacy_mongo','external')),
      value       text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX patient_identifiers_uidx ON patient_identifiers (clinic_id, system, value);
    CREATE INDEX patient_identifiers_patient_idx ON patient_identifiers (patient_id);

    CREATE TABLE appointments (
      id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id          uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id         uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      practitioner_id    uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      appointment_type   text NOT NULL DEFAULT 'General Consultation',
      scheduled_at       timestamptz NOT NULL,
      scheduled_time     text,
      duration_minutes   integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 5 AND 480),
      status             text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','Confirmed','Completed','Cancelled','No Show')),
      priority           text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
      reason             text,
      notes              text,
      instructions       text,
      location           text,
      provider_name      text,
      is_virtual         boolean NOT NULL DEFAULT false,
      meeting_link       text,
      teleconsultation_id uuid,
      follow_up_required boolean NOT NULL DEFAULT false,
      follow_up_date     date,
      reminder_sent      boolean NOT NULL DEFAULT false,
      ${AUDIT_COLS}
    );
    CREATE INDEX appointments_clinic_date_idx ON appointments (clinic_id, scheduled_at DESC);
    CREATE INDEX appointments_patient_idx ON appointments (patient_id, scheduled_at DESC);
    CREATE UNIQUE INDEX appointments_no_double_booking_uidx ON appointments (practitioner_id, scheduled_at)
      WHERE practitioner_id IS NOT NULL AND status NOT IN ('Cancelled','No Show') AND deleted_at IS NULL;

    CREATE TABLE encounters (
      id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id          uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id         uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      practitioner_id    uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      appointment_id     uuid REFERENCES appointments(id) ON DELETE SET NULL,
      encounter_type     text NOT NULL DEFAULT 'General',
      mode               text NOT NULL DEFAULT 'In-person',
      status             text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','In Progress','Completed','Cancelled','No Show')),
      priority           text NOT NULL DEFAULT 'Medium',
      started_at         timestamptz NOT NULL DEFAULT now(),
      ended_at           timestamptz,
      duration_minutes   integer,
      reason             text,
      symptoms           jsonb NOT NULL DEFAULT '[]'::jsonb,
      diagnosis_summary  text,
      provider_name      text,
      provider_notes     text,
      patient_notes      text,
      recommendations    jsonb NOT NULL DEFAULT '[]'::jsonb,
      follow_up_required boolean NOT NULL DEFAULT false,
      follow_up_date     date,
      follow_up_notes    text,
      clinical_note_ref  text,
      ${AUDIT_COLS}
    );
    CREATE INDEX encounters_patient_idx ON encounters (patient_id, started_at DESC);
    CREATE INDEX encounters_clinic_idx ON encounters (clinic_id, started_at DESC);

    CREATE TABLE clinical_conditions (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id           uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id          uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      encounter_id        uuid REFERENCES encounters(id) ON DELETE SET NULL,
      code                text,
      code_system         text NOT NULL DEFAULT 'http://hl7.org/fhir/sid/icd-10',
      display             text NOT NULL,
      clinical_status     text NOT NULL DEFAULT 'active' CHECK (clinical_status IN ('active','recurrence','relapse','inactive','remission','resolved')),
      verification_status text NOT NULL DEFAULT 'confirmed',
      severity            text,
      onset_date          date,
      abatement_date      date,
      recorded_by         uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      notes               text,
      ${AUDIT_COLS}
    );
    CREATE INDEX clinical_conditions_patient_idx ON clinical_conditions (patient_id);

    CREATE TABLE allergies (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id        uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id       uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      encounter_id     uuid REFERENCES encounters(id) ON DELETE SET NULL,
      substance        text NOT NULL,
      category         text CHECK (category IS NULL OR category IN ('food','medication','environment','biologic')),
      criticality      text CHECK (criticality IS NULL OR criticality IN ('low','high','unable-to-assess')),
      reaction         text,
      clinical_status  text NOT NULL DEFAULT 'active' CHECK (clinical_status IN ('active','inactive','resolved')),
      onset_date       date,
      recorded_by      uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      ${AUDIT_COLS}
    );
    CREATE INDEX allergies_patient_idx ON allergies (patient_id);

    CREATE TABLE medications (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id     uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      encounter_id  uuid REFERENCES encounters(id) ON DELETE SET NULL,
      name          text NOT NULL,
      code          text,
      dosage        text,
      frequency     text,
      route         text,
      status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','stopped','on-hold')),
      start_date    date,
      end_date      date,
      reason        text,
      ${AUDIT_COLS}
    );
    CREATE INDEX medications_patient_idx ON medications (patient_id);

    CREATE TABLE prescriptions (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id             uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id            uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      encounter_id          uuid REFERENCES encounters(id) ON DELETE SET NULL,
      practitioner_id       uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      prescription_number   text NOT NULL,
      prescribed_at         timestamptz NOT NULL DEFAULT now(),
      diagnosis             text,
      notes                 text,
      status                text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Completed','Cancelled')),
      follow_up_date        date,
      follow_up_instructions text,
      ${AUDIT_COLS}
    );
    CREATE UNIQUE INDEX prescriptions_number_uidx ON prescriptions (clinic_id, prescription_number);
    CREATE INDEX prescriptions_patient_idx ON prescriptions (patient_id, prescribed_at DESC);

    CREATE TABLE prescription_items (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      prescription_id  uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
      clinic_id        uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      name             text NOT NULL,
      dosage           text,
      frequency        text,
      duration         text,
      instructions     text,
      quantity         integer,
      sort_order       integer NOT NULL DEFAULT 0
    );
    CREATE INDEX prescription_items_rx_idx ON prescription_items (prescription_id);

    CREATE TABLE vitals (
      id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id            uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id           uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      encounter_id         uuid REFERENCES encounters(id) ON DELETE SET NULL,
      recorded_at          timestamptz NOT NULL DEFAULT now(),
      recorded_by          uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      recorded_by_name     text,
      recorded_by_role     text,
      systolic             numeric(5,1) CHECK (systolic IS NULL OR systolic BETWEEN 0 AND 400),
      diastolic            numeric(5,1) CHECK (diastolic IS NULL OR diastolic BETWEEN 0 AND 300),
      heart_rate           numeric(5,1) CHECK (heart_rate IS NULL OR heart_rate BETWEEN 0 AND 400),
      temperature          numeric(5,2),
      temperature_unit     text NOT NULL DEFAULT '°F',
      respiratory_rate     numeric(5,1),
      oxygen_saturation    numeric(5,2) CHECK (oxygen_saturation IS NULL OR oxygen_saturation BETWEEN 0 AND 100),
      weight_kg            numeric(6,2),
      height_cm            numeric(6,2),
      bmi                  numeric(5,2),
      bmi_category         text,
      blood_sugar          numeric(6,2),
      pain_score           integer CHECK (pain_score IS NULL OR pain_score BETWEEN 0 AND 10),
      notes                text,
      clinical_notes       jsonb NOT NULL DEFAULT '{}'::jsonb,
      ${AUDIT_COLS}
    );
    CREATE INDEX vitals_patient_idx ON vitals (patient_id, recorded_at DESC);

    CREATE TABLE lab_orders (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id     uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      encounter_id  uuid REFERENCES encounters(id) ON DELETE SET NULL,
      ordered_by    uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      test_name     text NOT NULL,
      test_code     text,
      priority      text NOT NULL DEFAULT 'Routine' CHECK (priority IN ('Routine','Urgent','Emergency')),
      status        text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','in-progress','completed','cancelled')),
      ordered_at    timestamptz NOT NULL DEFAULT now(),
      lab_name      text,
      notes         text,
      ${AUDIT_COLS}
    );
    CREATE INDEX lab_orders_patient_idx ON lab_orders (patient_id, ordered_at DESC);

    CREATE TABLE documents (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id             uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id            uuid REFERENCES patients(id) ON DELETE RESTRICT,
      encounter_id          uuid REFERENCES encounters(id) ON DELETE SET NULL,
      uploaded_by_user_id   uuid REFERENCES users(id) ON DELETE SET NULL,
      uploaded_by_practitioner_id uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      document_type         text NOT NULL,
      category              text NOT NULL DEFAULT 'clinical' CHECK (category IN ('clinical','imaging','lab','prescription','identity','profile','administrative','other')),
      title                 text,
      description           text,
      original_file_name    text NOT NULL,
      mime_type             text NOT NULL,
      size_bytes            bigint NOT NULL CHECK (size_bytes >= 0),
      checksum_sha256       text,
      storage_provider      text NOT NULL CHECK (storage_provider IN ('cloudinary','local','legacy_url')),
      storage_key           text NOT NULL,
      storage_resource_type text,
      storage_version       text,
      storage_format        text,
      legacy_url            text,
      status                text NOT NULL DEFAULT 'available' CHECK (status IN ('pending','available','archived','deleted','quarantined')),
      scan_status           text NOT NULL DEFAULT 'not_scanned' CHECK (scan_status IN ('not_scanned','pending','clean','infected','error')),
      is_private            boolean NOT NULL DEFAULT true,
      tags                  jsonb NOT NULL DEFAULT '[]'::jsonb,
      metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
      ${AUDIT_COLS}
    );
    CREATE INDEX documents_patient_idx ON documents (patient_id, created_at DESC);
    CREATE INDEX documents_clinic_idx ON documents (clinic_id, created_at DESC);
    CREATE INDEX documents_storage_idx ON documents (storage_provider, storage_key);

    ALTER TABLE patients ADD CONSTRAINT patients_profile_document_fk FOREIGN KEY (profile_document_id) REFERENCES documents(id) ON DELETE SET NULL;
    ALTER TABLE patients ADD CONSTRAINT patients_government_document_fk FOREIGN KEY (government_document_id) REFERENCES documents(id) ON DELETE SET NULL;
    ALTER TABLE practitioners ADD CONSTRAINT practitioners_profile_document_fk FOREIGN KEY (profile_document_id) REFERENCES documents(id) ON DELETE SET NULL;

    CREATE TABLE lab_results (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id      uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id     uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      lab_order_id   uuid NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
      document_id    uuid REFERENCES documents(id) ON DELETE SET NULL,
      result_date    timestamptz NOT NULL DEFAULT now(),
      summary        text,
      observations   jsonb NOT NULL DEFAULT '[]'::jsonb,
      interpretation text,
      status         text NOT NULL DEFAULT 'final' CHECK (status IN ('preliminary','final','amended','cancelled')),
      verified_by    uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      lab_name       text,
      notes          text,
      ${AUDIT_COLS}
    );
    CREATE INDEX lab_results_patient_idx ON lab_results (patient_id, result_date DESC);
    CREATE INDEX lab_results_order_idx ON lab_results (lab_order_id);

    CREATE TABLE imaging_orders (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id     uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      encounter_id  uuid REFERENCES encounters(id) ON DELETE SET NULL,
      ordered_by    uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      modality      text NOT NULL,
      body_part     text,
      reason        text,
      priority      text NOT NULL DEFAULT 'Routine' CHECK (priority IN ('Routine','Urgent','Emergency')),
      status        text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','in-progress','completed','cancelled')),
      ordered_at    timestamptz NOT NULL DEFAULT now(),
      ${AUDIT_COLS}
    );
    CREATE INDEX imaging_orders_patient_idx ON imaging_orders (patient_id);

    CREATE TABLE imaging_studies (
      id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id            uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id           uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      imaging_order_id     uuid REFERENCES imaging_orders(id) ON DELETE SET NULL,
      encounter_id         uuid REFERENCES encounters(id) ON DELETE SET NULL,
      document_id          uuid REFERENCES documents(id) ON DELETE SET NULL,
      modality             text NOT NULL,
      body_part            text,
      title                text NOT NULL,
      description          text,
      associated_diagnosis text,
      study_date           timestamptz NOT NULL DEFAULT now(),
      status               text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Archived','Deleted')),
      is_private           boolean NOT NULL DEFAULT false,
      tags                 jsonb NOT NULL DEFAULT '[]'::jsonb,
      uploaded_by          uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      uploaded_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
      ${AUDIT_COLS}
    );
    CREATE INDEX imaging_studies_patient_idx ON imaging_studies (patient_id, study_date DESC);

    CREATE TABLE referrals (
      id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id                uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id               uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      encounter_id             uuid REFERENCES encounters(id) ON DELETE SET NULL,
      referral_type            text NOT NULL DEFAULT 'outbound' CHECK (referral_type IN ('inbound','outbound')),
      specialist_practitioner_id uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      specialist_name          text NOT NULL,
      specialty                text NOT NULL,
      specialist_contact       jsonb NOT NULL DEFAULT '{}'::jsonb,
      specialist_address       jsonb NOT NULL DEFAULT '{}'::jsonb,
      external_clinic          jsonb NOT NULL DEFAULT '{}'::jsonb,
      reason                   text NOT NULL,
      clinical_history         text,
      current_medications      jsonb NOT NULL DEFAULT '[]'::jsonb,
      test_results             jsonb NOT NULL DEFAULT '{}'::jsonb,
      urgency                  text NOT NULL DEFAULT 'Medium' CHECK (urgency IN ('Low','Medium','High','Urgent','Emergency')),
      preferred_date           date,
      preferred_time           text,
      status                   text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','In Progress','Completed','Cancelled')),
      status_notes             text,
      insurance_info           jsonb NOT NULL DEFAULT '{}'::jsonb,
      referring_provider       jsonb NOT NULL DEFAULT '{}'::jsonb,
      referred_by              uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      special_instructions     text,
      attachments              jsonb NOT NULL DEFAULT '[]'::jsonb,
      shareable_link           jsonb NOT NULL DEFAULT '{}'::jsonb,
      ${AUDIT_COLS}
    );
    CREATE INDEX referrals_clinic_idx ON referrals (clinic_id, created_at DESC);
    CREATE INDEX referrals_patient_idx ON referrals (patient_id);

    CREATE TABLE teleconsultations (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id         uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id        uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
      practitioner_id   uuid REFERENCES practitioners(id) ON DELETE SET NULL,
      appointment_id    uuid REFERENCES appointments(id) ON DELETE SET NULL,
      encounter_id      uuid REFERENCES encounters(id) ON DELETE SET NULL,
      scheduled_at      timestamptz NOT NULL,
      duration_minutes  integer NOT NULL DEFAULT 30,
      status            text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','Waiting','In Progress','Completed','Cancelled','No Show')),
      meeting_id        text,
      meeting_link      text,
      reason            text,
      notes             text,
      diagnosis         text,
      prescription_text text,
      participants      jsonb NOT NULL DEFAULT '[]'::jsonb,
      started_at        timestamptz,
      ended_at          timestamptz,
      ${AUDIT_COLS}
    );
    CREATE INDEX teleconsultations_clinic_idx ON teleconsultations (clinic_id, scheduled_at DESC);
    ALTER TABLE appointments ADD CONSTRAINT appointments_teleconsultation_fk FOREIGN KEY (teleconsultation_id) REFERENCES teleconsultations(id) ON DELETE SET NULL;

    CREATE TABLE invoices (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id        uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      patient_id       uuid REFERENCES patients(id) ON DELETE RESTRICT,
      appointment_id   uuid REFERENCES appointments(id) ON DELETE SET NULL,
      encounter_id     uuid REFERENCES encounters(id) ON DELETE SET NULL,
      invoice_number   text NOT NULL,
      invoice_date     date NOT NULL DEFAULT current_date,
      due_date         date,
      status           text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Draft','Pending','Approved','Rejected','Paid','Partially Paid','Overdue','Cancelled')),
      currency         text NOT NULL DEFAULT 'INR',
      subtotal         numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      tax              numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
      discount         numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
      total            numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
      paid_amount      numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      payment_method   text,
      line_items       jsonb NOT NULL DEFAULT '[]'::jsonb,
      payments         jsonb NOT NULL DEFAULT '[]'::jsonb,
      notes            text,
      description      text,
      approved_by      uuid REFERENCES users(id) ON DELETE SET NULL,
      rejected_by      uuid REFERENCES users(id) ON DELETE SET NULL,
      rejection_reason text,
      ${AUDIT_COLS}
    );
    CREATE UNIQUE INDEX invoices_number_uidx ON invoices (clinic_id, invoice_number);
    CREATE INDEX invoices_clinic_idx ON invoices (clinic_id, invoice_date DESC);
    CREATE INDEX invoices_patient_idx ON invoices (patient_id);

    CREATE TABLE notifications (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id   uuid REFERENCES clinics(id) ON DELETE CASCADE,
      user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
      type        text NOT NULL,
      title       text NOT NULL,
      message     text NOT NULL,
      data        jsonb NOT NULL DEFAULT '{}'::jsonb,
      read_at     timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
    CREATE INDEX notifications_clinic_idx ON notifications (clinic_id, created_at DESC);

    CREATE TABLE audit_logs (
      id             bigserial PRIMARY KEY,
      occurred_at    timestamptz NOT NULL DEFAULT now(),
      user_id        uuid,
      role           text,
      clinic_id      uuid,
      action         text NOT NULL,
      resource_type  text,
      resource_id    text,
      ip             text,
      user_agent     text,
      request_id     text,
      result         text,
      details        jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX audit_logs_clinic_time_idx ON audit_logs (clinic_id, occurred_at DESC);
    CREATE INDEX audit_logs_user_time_idx ON audit_logs (user_id, occurred_at DESC);
    CREATE INDEX audit_logs_resource_idx ON audit_logs (resource_type, resource_id);
    CREATE INDEX audit_logs_action_idx ON audit_logs (action, occurred_at DESC);

    CREATE TABLE system_settings (
      key         text PRIMARY KEY,
      value       jsonb NOT NULL,
      description text,
      updated_by  uuid,
      updated_at  timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE integration_configs (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id   uuid REFERENCES clinics(id) ON DELETE CASCADE,
      name        text NOT NULL,
      type        text NOT NULL,
      config      jsonb NOT NULL DEFAULT '{}'::jsonb,
      is_enabled  boolean NOT NULL DEFAULT false,
      ${AUDIT_COLS}
    );
    CREATE UNIQUE INDEX integration_configs_uidx ON integration_configs (COALESCE(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

    CREATE TABLE fhir_resource_refs (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id        uuid REFERENCES clinics(id) ON DELETE CASCADE,
      resource_type    text NOT NULL,
      resource_id      uuid NOT NULL,
      external_system  text NOT NULL,
      external_id      text NOT NULL,
      last_synced_at   timestamptz,
      created_at       timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX fhir_resource_refs_uidx ON fhir_resource_refs (external_system, resource_type, resource_id);

    CREATE TABLE outbox_events (
      id              uuid PRIMARY KEY,
      event_type      text NOT NULL,
      aggregate_type  text NOT NULL,
      aggregate_id    text,
      clinic_id       uuid,
      actor_id        uuid,
      payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at      timestamptz NOT NULL DEFAULT now(),
      published_at    timestamptz,
      attempts        integer NOT NULL DEFAULT 0,
      last_error      text,
      next_attempt_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX outbox_events_pending_idx ON outbox_events (next_attempt_at) WHERE published_at IS NULL;

    CREATE TABLE legacy_id_map (
      collection  text NOT NULL,
      legacy_id   text NOT NULL,
      new_id      uuid NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (collection, legacy_id)
    );
    CREATE INDEX legacy_id_map_new_idx ON legacy_id_map (new_id);
  `);

  const versioned = ['clinics', 'users', 'practitioners', 'patients', 'appointments', 'encounters', 'clinical_conditions', 'allergies', 'medications', 'prescriptions', 'vitals', 'lab_orders', 'lab_results', 'imaging_orders', 'imaging_studies', 'documents', 'referrals', 'teleconsultations', 'invoices', 'integration_configs'];
  for (const t of versioned) {
    await knex.raw(`CREATE TRIGGER ${t}_touch BEFORE UPDATE ON ${t} FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_version()`);
  }

  // Patient clinical timeline as a single UNION ALL view (paginated by the timeline service).
  await knex.raw(`
    CREATE VIEW patient_timeline AS
      SELECT 'appointment' AS event_type, a.id, a.clinic_id, a.patient_id, a.scheduled_at AS occurred_at, a.status, a.appointment_type AS title, a.reason AS description, a.created_at FROM appointments a WHERE a.deleted_at IS NULL
      UNION ALL SELECT 'encounter', e.id, e.clinic_id, e.patient_id, e.started_at, e.status, e.encounter_type, e.reason, e.created_at FROM encounters e WHERE e.deleted_at IS NULL
      UNION ALL SELECT 'vitals', v.id, v.clinic_id, v.patient_id, v.recorded_at, 'Completed', 'Vitals Recorded', v.notes, v.created_at FROM vitals v WHERE v.deleted_at IS NULL
      UNION ALL SELECT 'condition', c.id, c.clinic_id, c.patient_id, COALESCE(c.onset_date::timestamptz, c.created_at), c.clinical_status, c.display, c.notes, c.created_at FROM clinical_conditions c WHERE c.deleted_at IS NULL
      UNION ALL SELECT 'prescription', p.id, p.clinic_id, p.patient_id, p.prescribed_at, p.status, 'Prescription Created', p.diagnosis, p.created_at FROM prescriptions p WHERE p.deleted_at IS NULL
      UNION ALL SELECT 'lab_order', lo.id, lo.clinic_id, lo.patient_id, lo.ordered_at, lo.status, lo.test_name, lo.notes, lo.created_at FROM lab_orders lo WHERE lo.deleted_at IS NULL
      UNION ALL SELECT 'lab_result', lr.id, lr.clinic_id, lr.patient_id, lr.result_date, lr.status, 'Lab Result', lr.summary, lr.created_at FROM lab_results lr WHERE lr.deleted_at IS NULL
      UNION ALL SELECT 'imaging', i.id, i.clinic_id, i.patient_id, i.study_date, i.status, i.title, i.description, i.created_at FROM imaging_studies i WHERE i.deleted_at IS NULL
      UNION ALL SELECT 'referral', r.id, r.clinic_id, r.patient_id, r.created_at, r.status, r.specialty, r.reason, r.created_at FROM referrals r WHERE r.deleted_at IS NULL
      UNION ALL SELECT 'document', d.id, d.clinic_id, d.patient_id, d.created_at, d.status, COALESCE(d.title, d.original_file_name), d.description, d.created_at FROM documents d WHERE d.deleted_at IS NULL AND d.patient_id IS NOT NULL
      UNION ALL SELECT 'registration', pt.id, pt.clinic_id, pt.id, pt.created_at, pt.status, 'Patient Registered', NULL, pt.created_at FROM patients pt WHERE pt.deleted_at IS NULL;
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP VIEW IF EXISTS patient_timeline`);
  const tables = ['legacy_id_map', 'outbox_events', 'fhir_resource_refs', 'integration_configs', 'system_settings', 'audit_logs', 'notifications', 'invoices', 'teleconsultations', 'referrals', 'imaging_studies', 'imaging_orders', 'lab_results', 'documents', 'lab_orders', 'vitals', 'prescription_items', 'prescriptions', 'medications', 'allergies', 'clinical_conditions', 'encounters', 'appointments', 'patient_identifiers', 'patients', 'practitioners', 'otp_challenges', 'auth_sessions', 'users', 'clinics', 'role_permissions', 'permissions', 'roles'];
  await knex.raw(`ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_teleconsultation_fk`);
  await knex.raw(`ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_profile_document_fk, DROP CONSTRAINT IF EXISTS patients_government_document_fk`);
  await knex.raw(`ALTER TABLE practitioners DROP CONSTRAINT IF EXISTS practitioners_profile_document_fk`);
  for (const t of tables) await knex.raw(`DROP TABLE IF EXISTS ${t} CASCADE`);
  await knex.raw(`DROP FUNCTION IF EXISTS set_updated_at_and_version()`);
};
