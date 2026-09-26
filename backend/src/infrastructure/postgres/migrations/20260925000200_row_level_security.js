'use strict';
/**
 * Row level security: clinic-owned tables are only visible to the clinic set in
 * app.clinic_id, unless the session role is super_master_admin or system.
 * The application role (APP_DB_ROLE, default smaart_app) is granted DML only and
 * is subject to these policies; audit_logs is append-only for it.
 */
const TENANT_TABLES = ['patients', 'patient_identifiers', 'practitioners', 'appointments', 'encounters', 'clinical_conditions', 'allergies', 'medications', 'prescriptions', 'prescription_items', 'vitals', 'lab_orders', 'lab_results', 'imaging_orders', 'imaging_studies', 'documents', 'referrals', 'teleconsultations', 'invoices'];
const NULLABLE_TENANT_TABLES = ['users', 'notifications', 'integration_configs', 'fhir_resource_refs'];
const APP_ROLE = process.env.APP_DB_ROLE || 'smaart_app';

const policy = `(
  current_setting('app.role', true) IN ('super_master_admin', 'system')
  OR clinic_id = NULLIF(current_setting('app.clinic_id', true), '')::uuid
)`;

exports.up = async function up(knex) {
  for (const t of TENANT_TABLES) {
    await knex.raw(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    await knex.raw(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`);
    await knex.raw(`CREATE POLICY ${t}_tenant_isolation ON ${t} USING ${policy} WITH CHECK ${policy}`);
  }
  for (const t of NULLABLE_TENANT_TABLES) {
    await knex.raw(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    await knex.raw(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`);
    await knex.raw(`CREATE POLICY ${t}_tenant_isolation ON ${t} USING ${policy} WITH CHECK ${policy}`);
  }
  // audit_logs: clinic admins read their own clinic only; nobody updates or deletes through the app role.
  await knex.raw(`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY`);
  await knex.raw(`ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY`);
  await knex.raw(`CREATE POLICY audit_logs_read ON audit_logs FOR SELECT USING ${policy}`);
  await knex.raw(`CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (true)`);

  const roleExists = await knex.raw(`SELECT 1 FROM pg_roles WHERE rolname = ?`, [APP_ROLE]);
  if (roleExists.rows.length) {
    await knex.raw(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
    await knex.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
    await knex.raw(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`);
    await knex.raw(`REVOKE UPDATE, DELETE ON audit_logs FROM ${APP_ROLE}`);
    await knex.raw(`REVOKE UPDATE, DELETE, INSERT ON schema_migrations, schema_migrations_lock FROM ${APP_ROLE}`);
    await knex.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE}`);
    await knex.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${APP_ROLE}`);
  }
};

exports.down = async function down(knex) {
  for (const t of [...TENANT_TABLES, ...NULLABLE_TENANT_TABLES]) {
    await knex.raw(`DROP POLICY IF EXISTS ${t}_tenant_isolation ON ${t}`);
    await knex.raw(`ALTER TABLE ${t} DISABLE ROW LEVEL SECURITY`);
  }
  await knex.raw(`DROP POLICY IF EXISTS audit_logs_read ON audit_logs`);
  await knex.raw(`DROP POLICY IF EXISTS audit_logs_insert ON audit_logs`);
  await knex.raw(`ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY`);
};
