'use strict';
/**
 * One-time / repeatable: give every clinic a map point and copy it to the
 * shared MongoDB `clinics` collection the patient app searches.
 *
 *   npm run geocode:clinics            clinics without a point are geocoded
 *   npm run geocode:clinics -- --all   also re-copy every clinic to MongoDB
 *
 * Clinics whose address cannot be found are listed at the end so an admin can
 * place the pin by hand (Edit Clinic > Find on map).
 */
require('dotenv').config();
const { getKnex, closeKnex } = require('../infrastructure/postgres/knex');
const { withSystem } = require('../infrastructure/postgres/tenant');
const { connectMongo, closeMongo } = require('../infrastructure/mongodb/connection');
const { geocodeAddress } = require('../common/geo/geocoder');
const { mirrorClinicToMongo } = require('../modules/clinics/clinicMirror');

async function main() {
  const all = process.argv.includes('--all');
  await connectMongo().catch((err) => console.warn('MongoDB not connected, copy step skipped:', err.message));
  const rows = await withSystem((trx) => trx('clinics').whereNull('deleted_at').orderBy('name'), getKnex());
  const notFound = [];
  let geocoded = 0; let copied = 0;
  for (const row of rows) {
    if (row.latitude == null || row.longitude == null) {
      const hit = await geocodeAddress({ address: row.address, city: row.city, state: row.state, zipCode: row.zip_code, country: row.country });
      if (hit) {
        const patch = { latitude: hit.latitude, longitude: hit.longitude, geo_source: hit.source, geocoded_at: new Date() };
        await withSystem((trx) => trx('clinics').where({ id: row.id }).update(patch), getKnex());
        Object.assign(row, patch);
        geocoded++;
        console.log(`✓ ${row.name}: ${hit.latitude.toFixed(5)}, ${hit.longitude.toFixed(5)} (by ${hit.source})`);
      } else {
        notFound.push(row);
        console.log(`✗ ${row.name}: address not found`);
      }
    } else if (!all) {
      continue;
    }
    const m = await mirrorClinicToMongo(row);
    if (m.mirrored) copied++;
  }
  console.log(`\n${rows.length} clinic(s); ${geocoded} geocoded; ${copied} copied to MongoDB.`);
  if (notFound.length) {
    console.log('\nPlace these by hand (Edit Clinic > Find on map, then drag the pin):');
    for (const r of notFound) console.log(`  - ${r.name}: ${[r.address, r.city, r.state, r.zip_code, r.country].filter(Boolean).join(', ')}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await closeMongo().catch(() => {}); await closeKnex().catch(() => {}); });
