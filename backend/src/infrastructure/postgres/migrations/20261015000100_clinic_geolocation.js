'use strict';
/**
 * Where the clinic is on the map, so the patient app can list the nearest
 * hospitals. latitude/longitude come from the address (geocoder) or from the
 * admin dragging the pin; geo_source records which:
 *   'address' | 'zip' | 'city' (geocoder, best to coarsest) | 'pin' (set by hand)
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE clinics
      ADD COLUMN IF NOT EXISTS latitude    double precision CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
      ADD COLUMN IF NOT EXISTS longitude   double precision CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
      ADD COLUMN IF NOT EXISTS geo_source  text CHECK (geo_source IS NULL OR geo_source IN ('address', 'zip', 'city', 'pin')),
      ADD COLUMN IF NOT EXISTS geocoded_at timestamptz
  `);
};
exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE clinics DROP COLUMN IF EXISTS latitude, DROP COLUMN IF EXISTS longitude, DROP COLUMN IF EXISTS geo_source, DROP COLUMN IF EXISTS geocoded_at`);
};
