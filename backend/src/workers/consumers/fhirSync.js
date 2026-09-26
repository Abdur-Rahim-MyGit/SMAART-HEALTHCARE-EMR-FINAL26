'use strict';
const { withSystem } = require('../../infrastructure/mongodb/tenant');
const fhir = require('../../fhir/mappings');

/**
 * Snapshots the FHIR projection of changed resources for interoperability audit
 * and marks fhir_resource_refs as needing a push to configured external systems.
 */
async function fhirSyncHandler(event) {
  const map = { patient: ['patients', (row) => fhir.patient(row)], encounter: ['encounters', (row) => fhir.encounter(row)], appointment: ['appointments', (row) => fhir.appointment(row)], document: ['documents', (row) => fhir.documentReference(row)] };
  const m = map[event.aggregateType];
  if (!m || !event.aggregateId) return;
  await withSystem(async (db) => {
    const row = await db.c(m[0]).findById(event.aggregateId, { includeDeleted: true });
    if (!row) return;
    const resource = m[1](row);
    await db.c('fhir_payload_snapshots').insertOne({ clinicId: event.clinicId || row.clinicId || null, resourceType: resource.resourceType, resourceId: resource.id, direction: 'export', resource, actorId: event.actorId || null, requestId: event.id || null });
    await db.c('fhir_resource_refs').updateMany({ resourceType: resource.resourceType, resourceId: resource.id }, { lastSyncedAt: null });
  });
}
module.exports = { fhirSyncHandler };
