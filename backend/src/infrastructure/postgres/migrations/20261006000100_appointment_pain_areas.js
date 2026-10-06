'use strict';
/**
 * Where it hurts, from the Physio app's body map. pain_areas holds the raw
 * selection ([{ bodyPart: 'right_knee', side?, severity? }]) so the UI can label
 * it ("Knee (Right)"); pain_level is the 0-10 score and pain_duration the
 * patient's wording ("Less than 1 week").
 */
exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS pain_areas    jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS pain_level    integer CHECK (pain_level IS NULL OR pain_level BETWEEN 0 AND 10),
      ADD COLUMN IF NOT EXISTS pain_duration text
  `);
};
exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE appointments DROP COLUMN IF EXISTS pain_areas, DROP COLUMN IF EXISTS pain_level, DROP COLUMN IF EXISTS pain_duration`);
};
