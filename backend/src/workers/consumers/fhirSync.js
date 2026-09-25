'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withSystem } = require('../../infrastructure/postgres/tenant');
const { isMongoConnected } = require('../../infrastructure/mongodb/connection');
const fhir = require('../../fhir/mappings');

/**
 * Snapshots the FHIR projection of changed resources for interoperability audit
 * and marks fhir_resource_refs as needing a push to configured external systems.
 */
async function fhirSyncHandler(event) {
  const map = { patient: ['patients', (row) => fhir.patient(row)], encounter: ['encounters', (row) => fhir.encounter(row)], appointment: ['appointments', (row) => fhir.appointment(row)], document: ['documents', (row) => fhir.documentReference(row)] };
  const m = map[event.aggregateType];
  if (!m || !event.aggregateId) return;
  const row = await withSystem((trx) => trx(m[0]).where({ id: event.aggregateId }).first(), getKnex());
  if (!row) return;
  const resource = m[1](row);
  if (isMongoConnected()) {
    const { FhirPayloadSnapshot } = require('../../infrastructure/mongodb/models');
    await FhirPayloadSnapshot.create({ clinicId: event.clinicId, resourceType: resource.resourceType, resourceId: resource.id, direction: 'export', resource, actorId: event.actorId, requestId: event.id });
  }
  await withSystem((trx) => trx('fhir_resource_refs').where({ resource_type: resource.resourceType, resource_id: resource.id }).update({ last_synced_at: null }), getKnex());
}
module.exports = { fhirSyncHandler };
