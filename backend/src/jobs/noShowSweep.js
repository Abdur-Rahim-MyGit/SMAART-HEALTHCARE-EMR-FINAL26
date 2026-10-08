'use strict';
/**
 * Automatic No Show for EMR appointments.
 *
 * Every minute, appointments still Scheduled or Confirmed whose scheduledAt is
 * more than NO_SHOW_GRACE_MINUTES (default 10) in the past become "No Show".
 * Staff can still change the status by hand afterwards, and a visit that took
 * place should be marked Completed before the grace period ends, as before.
 *
 * Runs as the system role (bypasses tenant scoping) and writes one audit row
 * per appointment so automatic no-shows are traceable.
 */
const { withSystem } = require('../infrastructure/mongodb/tenant');
const { auditInTrx } = require('../modules/audit/auditRepository');
const { getLogger } = require('../common/logging/logger');

const graceMinutes = () => Math.max(0, Number(process.env.NO_SHOW_GRACE_MINUTES || 10));

async function sweepNoShows() {
  const minutes = graceMinutes();
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return withSystem(async (db) => {
    const col = db.c('appointments');
    const due = await col.find(
      { status: { $in: ['Scheduled', 'Confirmed'] }, scheduledAt: { $lte: cutoff } },
      { projection: { _id: 1, clinicId: 1, patientId: 1, status: 1 } }
    );
    let marked = 0;
    for (const a of due) {
      // Only if nobody changed it in the meantime.
      const updated = await col.updateOne({ _id: a._id, status: a.status }, { status: 'No Show', noShowAt: new Date(), noShowAuto: true });
      if (!updated) continue;
      marked++;
      await auditInTrx(db, { role: 'system', clinicId: a.clinicId, userId: null }, {
        action: 'APPOINTMENT_NO_SHOW_AUTO', resourceType: 'appointment', resourceId: a._id,
        details: { patientId: a.patientId, graceMinutes: minutes },
      });
    }
    return marked;
  });
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
