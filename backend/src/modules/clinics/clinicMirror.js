'use strict';
/**
 * Copies an EMR clinic into the shared MongoDB `clinics` collection, the one the
 * patient (Physio) app searches for "nearest hospital" (GeoJSON point,
 * [longitude, latitude], 2dsphere index) and the consultant app lists.
 *
 * The Mongo document id is kept in legacy_id_map (collection 'clinics'), the same
 * table the legacy-data migration filled, so a clinic that came from the old
 * Mongo EMR updates its existing document instead of getting a duplicate.
 * Best effort: Postgres stays the source of truth and a failure here is logged,
 * never thrown back at the admin's save.
 */
const { getKnex } = require('../../infrastructure/postgres/knex');
const { isMongoConnected, mongoose } = require('../../infrastructure/mongodb/connection');
const { getLogger } = require('../../common/logging/logger');

/** The patient app's service ids; it lists a clinic for physio only when it offers physio. */
function appServices(services) {
  const list = Array.isArray(services) ? services : [];
  const out = new Set();
  for (const s of list) {
    const v = String(s || '').trim().toLowerCase();
    if (!v) continue;
    out.add(/physio/.test(v) ? 'physio' : v);
  }
  return [...out];
}

function parseJsonArray(v) {
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v || '[]'); return Array.isArray(p) ? p : []; } catch { return []; }
}

/** @param {object} row a clinics table row (snake_case) */
async function mirrorClinicToMongo(row) {
  if (!row || !isMongoConnected()) return { mirrored: false, reason: 'mongo-not-connected' };
  try {
    const knex = getKnex();
    const map = await knex('legacy_id_map').where({ collection: 'clinics', new_id: row.id }).first('legacy_id');
    const hasPoint = Number.isFinite(row.latitude) && Number.isFinite(row.longitude);
    const doc = {
      name: row.name,
      type: row.type || undefined,
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      country: row.country || 'India',
      zipCode: row.zip_code || '',
      phone: row.phone || '',
      email: row.email || '',
      website: row.website || '',
      services: appServices(parseJsonArray(row.services)),
      isActive: row.is_active !== false && !row.deleted_at,
      emrClinicId: row.id,
      source: 'emr',
      ...(hasPoint ? {
        location: { type: 'Point', coordinates: [row.longitude, row.latitude] },
        latitude: row.latitude,
        longitude: row.longitude,
        geoSource: row.geo_source || null,
      } : {}),
      updatedAt: new Date(),
    };
    Object.keys(doc).forEach((k) => doc[k] === undefined && delete doc[k]);
    const clinics = mongoose.connection.collection('clinics');

    if (map && mongoose.Types.ObjectId.isValid(map.legacy_id)) {
      await clinics.updateOne({ _id: new mongoose.Types.ObjectId(map.legacy_id) }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
      return { mirrored: true, mongoId: map.legacy_id };
    }
    // Not mapped yet: reuse a document already carrying this EMR id, else create one.
    const existing = await clinics.findOne({ emrClinicId: row.id }, { projection: { _id: 1 } });
    const _id = existing ? existing._id : new mongoose.Types.ObjectId();
    await clinics.updateOne({ _id }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    await knex('legacy_id_map').insert({ collection: 'clinics', legacy_id: String(_id), new_id: row.id }).onConflict(['collection', 'legacy_id']).ignore();
    return { mirrored: true, mongoId: String(_id) };
  } catch (err) {
    getLogger().warn({ err, clinicId: row.id }, 'clinic mirror to MongoDB failed');
    return { mirrored: false, reason: err.message };
  }
}

/** A removed clinic disappears from the patient app too (isActive false; the document is kept). */
async function deactivateClinicMirror(clinicId) {
  if (!isMongoConnected()) return;
  try {
    const map = await getKnex()('legacy_id_map').where({ collection: 'clinics', new_id: clinicId }).first('legacy_id');
    const or = [{ emrClinicId: clinicId }];
    if (map && mongoose.Types.ObjectId.isValid(map.legacy_id)) or.push({ _id: new mongoose.Types.ObjectId(map.legacy_id) });
    await mongoose.connection.collection('clinics').updateMany({ $or: or }, { $set: { isActive: false, updatedAt: new Date() } });
  } catch (err) {
    getLogger().warn({ err, clinicId }, 'clinic mirror deactivate failed');
  }
}

module.exports = { mirrorClinicToMongo, deactivateClinicMirror, appServices };
