'use strict';
/**
 * One-time / repeatable: give every clinic a map point (latitude/longitude and
 * the GeoJSON `location` the patient app's "nearest hospital" search reads).
 *
 *   npm run geocode:clinics
 *
 * Clinics without a point are geocoded from their address; clinics that have
 * latitude/longitude but no `location` get it filled in. Clinics whose address
 * cannot be found are listed at the end so an admin can place the pin by hand
 * (Edit Clinic > Find on map).
 */
require('dotenv').config();
const { connectMongo, closeMongo } = require('../infrastructure/mongodb/connection');
const { withSystem } = require('../infrastructure/mongodb/tenant');
const { validPoint } = require('../common/geo/geocoder');
const { resolveLocation } = require('../modules/clinics/clinicService');

async function main() {
  await connectMongo();
  const rows = await withSystem((db) => db.c('clinics').find({}, { sort: { name: 1 } }));
  const notFound = [];
  let geocoded = 0; let filled = 0;
  for (const row of rows) {
    const hasPoint = row.latitude != null && row.longitude != null && validPoint(Number(row.latitude), Number(row.longitude));
    if (hasPoint && row.location) continue;
    const patch = hasPoint
      ? await resolveLocation({ latitude: row.latitude, longitude: row.longitude, geoSource: row.geoSource }, row)
      : await resolveLocation({}, row);
    if (!patch.location) {
      notFound.push(row);
      console.log(`✗ ${row.name}: address not found`);
      continue;
    }
    await withSystem((db) => db.c('clinics').updateOne({ _id: row._id }, patch));
    if (hasPoint) filled++;
    else {
      geocoded++;
      console.log(`✓ ${row.name}: ${patch.latitude.toFixed(5)}, ${patch.longitude.toFixed(5)} (by ${patch.geoSource})`);
    }
  }
  console.log(`\n${rows.length} clinic(s); ${geocoded} geocoded; ${filled} given a map location from saved coordinates.`);
  if (notFound.length) {
    console.log('\nPlace these by hand (Edit Clinic > Find on map, then drag the pin):');
    for (const r of notFound) console.log(`  - ${r.name}: ${[r.address, r.city, r.state, r.zipCode, r.country].filter(Boolean).join(', ')}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await closeMongo().catch(() => {}); });
