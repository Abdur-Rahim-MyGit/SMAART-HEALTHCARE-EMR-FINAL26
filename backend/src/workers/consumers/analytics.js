'use strict';
const { getLogger } = require('../../common/logging/logger');
/** Analytics sink: counts events by type. Never receives clinical payload details beyond ids. */
async function analyticsHandler(event) {
  getLogger().debug({ type: event.type, clinicId: event.clinicId }, 'analytics event');
}
module.exports = { analyticsHandler };
