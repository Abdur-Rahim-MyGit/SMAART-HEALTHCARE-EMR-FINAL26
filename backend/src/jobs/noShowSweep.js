'use strict';
/**
 * Automatic No Show for EMR appointments.
 *
 * Every minute, appointments still Scheduled or Confirmed whose scheduled_at is
 * more than NO_SHOW_GRACE_MINUTES (default 10) in the past become "No Show".
 * Staff can still change the status by hand afterwards, and a visit that took
 * place should be marked Completed before the grace period ends, as before.
 *
 * Runs as the system role (bypasses tenant policies) and writes one audit row
 * per appointment so automatic no-shows are traceable.
 */
const { getKnex } = require('../infrastructure/postgres/knex');
const { withSystem } = require('../infrastructure/postgres/tenant');
const { getLogger } = require('../common/logging/logger');

const graceMinutes = () => Math.max(0, Number(process.env.NO_SHOW_GRACE_MINUTES || 10));

async function sweepNoShows(knex = getKnex()) {
  const minutes = graceMinutes();
  return withSystem(async (trx) => {
    const rows = await trx('appointments')
      .whereIn('status', ['Scheduled', 'Confirmed'])
      .whereNull('deleted_at')
      .where('scheduled_at', '<=', trx.raw(`now() - (? * interval '1 minute')`, [minutes]))
      .update({ status: 'No Show' })
      .returning(['id', 'clinic_id', 'patient_id']);
    if (rows.length) {
      await trx('audit_logs').insert(rows.map((r) => ({
        clinic_id: r.clinic_id,
        action: 'APPOINTMENT_NO_SHOW_AUTO',
        resource_type: 'appointment',
        resource_id: r.id,
        result: 'SUCCESS',
        details: JSON.stringify({ patientId: r.patient_id, graceMinutes: minutes }),
      })));
    }
    return rows.length;
  }, knex);
}

let timer = null;
function startNoShowSweep() {
  if (timer) return;
  const log = getLogger();
  const tick = () => sweepNoShows()
    .then((n) => { if (n) log.info({ marked: n, graceMinutes: graceMinutes() }, 'appointments marked No Show'); })
    .catch((err) => log.error({ err }, 'no-show sweep failed'));
  tick();
  timer = setInterval(tick, 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
  log.info({ graceMinutes: graceMinutes() }, 'no-show sweep started');
}

module.exports = { startNoShowSweep, sweepNoShows };
