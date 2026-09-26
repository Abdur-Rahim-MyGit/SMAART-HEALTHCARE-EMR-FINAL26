'use strict';
/** Pharmacy inventory per clinic (the Pharmacy Management page contract). */
const APP_ROLE = process.env.APP_DB_ROLE || 'smaart_app';
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE inventory_items (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id     uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
      name          text NOT NULL,
      generic_name  text,
      category      text NOT NULL DEFAULT 'General',
      form          text,
      strength      text,
      unit          text NOT NULL DEFAULT 'unit',
      stock         integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
      min_stock     integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
      price         numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
      cost_price    numeric(12,2) CHECK (cost_price IS NULL OR cost_price >= 0),
      supplier      text,
      manufacturer  text,
      batch_number  text,
      expiry_date   date,
      location      text,
      description   text,
      is_active     boolean NOT NULL DEFAULT true,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now(),
      created_by    uuid,
      updated_by    uuid,
      deleted_at    timestamptz,
      version       integer NOT NULL DEFAULT 1
    );
    CREATE INDEX inventory_items_clinic_idx ON inventory_items (clinic_id, name);
    CREATE INDEX inventory_items_expiry_idx ON inventory_items (clinic_id, expiry_date);
    CREATE TRIGGER inventory_items_touch BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_version();
    ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;
    CREATE POLICY inventory_items_tenant_isolation ON inventory_items
      USING (current_setting('app.role', true) IN ('super_master_admin', 'system') OR clinic_id = NULLIF(current_setting('app.clinic_id', true), '')::uuid)
      WITH CHECK (current_setting('app.role', true) IN ('super_master_admin', 'system') OR clinic_id = NULLIF(current_setting('app.clinic_id', true), '')::uuid);
  `);
  const roleExists = await knex.raw(`SELECT 1 FROM pg_roles WHERE rolname = ?`, [APP_ROLE]);
  if (roleExists.rows.length) await knex.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items TO ${APP_ROLE}`);
};
exports.down = async function down(knex) {
  await knex.raw(`DROP TABLE IF EXISTS inventory_items CASCADE`);
};
