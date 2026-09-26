'use strict';
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { ROLES } = require('../../common/security/rbac');
const { serializeRow } = require('../../common/utils/serialize');
const { readiness } = require('../health/routes');
const { cached } = require('../../infrastructure/redis/cache');

const scopedCount = async (trx, scope, table, extra = (q) => q) => Number((await extra(trx(table).whereNull('deleted_at').modify((q) => { if (scope.clinicId) q.where('clinic_id', scope.clinicId); })).count({ c: '*' }))[0].c);

async function superMasterStats(scope) {
  return withTenant(scope, async (trx) => {
    const n = async (q) => Number((await q.count({ c: '*' }))[0].c);
    const thirty = new Date(Date.now() - 30 * 86400000);
    const [totalClinics, activeClinics, totalUsers, activeUsers, totalDoctors, activeDoctors, totalNurses, totalPatients, totalAdmins, totalAppointments, totalReferrals, pendingReferrals, urgentReferrals, totalLabTests, recentUsers, recentClinics] = await Promise.all([
      n(trx('clinics').whereNull('deleted_at')), n(trx('clinics').whereNull('deleted_at').where('is_active', true)),
      n(trx('users').whereNull('deleted_at')), n(trx('users').whereNull('deleted_at').where('is_active', true)),
      n(trx('practitioners').whereNull('deleted_at').where('kind', 'doctor')), n(trx('practitioners').whereNull('deleted_at').where({ kind: 'doctor', is_active: true })),
      n(trx('practitioners').whereNull('deleted_at').where('kind', 'nurse')), n(trx('patients').whereNull('deleted_at')),
      n(trx('users').whereNull('deleted_at').where('role', ROLES.CLINIC_ADMIN)), n(trx('appointments').whereNull('deleted_at')),
      n(trx('referrals').whereNull('deleted_at')), n(trx('referrals').whereNull('deleted_at').where('status', 'Pending')), n(trx('referrals').whereNull('deleted_at').whereIn('urgency', ['High', 'Urgent', 'Emergency'])),
      n(trx('lab_orders').whereNull('deleted_at')), n(trx('users').whereNull('deleted_at').where('created_at', '>=', thirty)), n(trx('clinics').whereNull('deleted_at').where('created_at', '>=', thirty)),
    ]);
    const [{ revenue }] = await trx('invoices').whereNull('deleted_at').where('status', 'Paid').sum({ revenue: 'total' });
    const userRoles = (await trx('users').whereNull('deleted_at').select('role').count({ count: '*' }).groupBy('role').orderBy('count', 'desc')).map((r) => ({ _id: r.role, count: Number(r.count) }));
    return {
      overview: { totalClinics, activeClinics, totalUsers, activeUsers, totalDoctors: activeDoctors, totalNurses, totalPatients, totalAppointments, totalLabTests, totalReferrals, totalRevenue: Number(revenue) || 0 },
      breakdown: { userRoles, clinicStats: [{ _id: 'active', count: activeClinics }, { _id: 'inactive', count: totalClinics - activeClinics }], usersByRole: { doctors: totalDoctors, nurses: totalNurses, patients: totalPatients, admins: totalAdmins }, referrals: { total: totalReferrals, pending: pendingReferrals, urgent: urgentReferrals, completed: totalReferrals - pendingReferrals } },
      trends: { recentUsers, recentClinics, growthRate: { users: totalUsers ? Math.round((recentUsers / totalUsers) * 100) : 0, clinics: totalClinics ? Math.round((recentClinics / totalClinics) * 100) : 0 } },
    };
  }, getKnex());
}

async function overview(scope) {
  return withTenant(scope, async (trx) => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [totalPatients, newPatients, totalAppointments, todayAppointments, totalDoctors, totalEncounters, pendingReferrals, urgentReferrals] = await Promise.all([
      scopedCount(trx, scope, 'patients'), scopedCount(trx, scope, 'patients', (q) => q.where('created_at', '>=', monthStart)),
      scopedCount(trx, scope, 'appointments'), scopedCount(trx, scope, 'appointments', (q) => q.whereRaw('scheduled_at::date = current_date')),
      scopedCount(trx, scope, 'practitioners', (q) => q.where({ kind: 'doctor', is_active: true })), scopedCount(trx, scope, 'encounters'),
      scopedCount(trx, scope, 'referrals', (q) => q.where('status', 'Pending')), scopedCount(trx, scope, 'referrals', (q) => q.whereIn('urgency', ['High', 'Urgent', 'Emergency'])),
    ]);
    const inv = trx('invoices').whereNull('deleted_at').modify((q) => { if (scope.clinicId) q.where('clinic_id', scope.clinicId); });
    const [{ revenue }] = await inv.clone().where('status', 'Paid').sum({ revenue: 'total' });
    const [{ outstanding }] = await inv.clone().whereNotIn('status', ['Paid', 'Cancelled', 'Rejected']).sum({ outstanding: trx.raw('total - paid_amount') });
    return { overview: { patients: { total: totalPatients, new: newPatients }, appointments: { total: totalAppointments, today: todayAppointments }, doctors: { total: totalDoctors }, consultations: { total: totalEncounters }, revenue: Number(revenue) || 0, outstandingInvoices: Number(outstanding) || 0, urgentReferrals, pendingReferrals } };
  }, getKnex());
}

async function recentActivity(scope) {
  return withTenant(scope, async (trx) => {
    const s = (t, col) => trx(t).whereNull('deleted_at').modify((q) => { if (scope.clinicId) q.where('clinic_id', scope.clinicId); }).orderBy(col, 'desc').limit(10);
    const [appointments, encounters, invoices, referrals] = await Promise.all([s('appointments', 'created_at'), s('encounters', 'created_at'), s('invoices', 'created_at'), s('referrals', 'created_at')]);
    return { appointments: serializeRow(appointments), consultations: serializeRow(encounters), invoices: serializeRow(invoices), referrals: serializeRow(referrals) };
  }, getKnex());
}

async function analytics(scope, period = '30d') {
  const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[period] || 30;
  return withTenant(scope, async (trx) => {
    const since = new Date(Date.now() - days * 86400000);
    const clinicFilter = (q) => { if (scope.clinicId) q.where('clinic_id', scope.clinicId); };
    const appointmentsTrend = await trx('appointments').whereNull('deleted_at').modify(clinicFilter).where('scheduled_at', '>=', since).select(trx.raw("to_char(scheduled_at::date, 'YYYY-MM-DD') as day")).count({ count: '*' }).groupBy('day').orderBy('day');
    const revenueTrend = await trx('invoices').whereNull('deleted_at').modify(clinicFilter).where('status', 'Paid').where('invoice_date', '>=', since).select(trx.raw("to_char(invoice_date, 'YYYY-MM-DD') as day")).sum({ total: 'total' }).groupBy('day').orderBy('day');
    const patientsTrend = await trx('patients').whereNull('deleted_at').modify(clinicFilter).where('created_at', '>=', since).select(trx.raw("to_char(created_at::date, 'YYYY-MM-DD') as day")).count({ count: '*' }).groupBy('day').orderBy('day');
    const byStatus = await trx('appointments').whereNull('deleted_at').modify(clinicFilter).select('status').count({ count: '*' }).groupBy('status');
    const byType = await trx('appointments').whereNull('deleted_at').modify(clinicFilter).select('appointment_type').count({ count: '*' }).groupBy('appointment_type').orderBy('count', 'desc').limit(10);
    return { period, trends: { appointments: appointmentsTrend.map((r) => ({ _id: r.day, count: Number(r.count) })), revenue: revenueTrend.map((r) => ({ _id: r.day, total: Number(r.total) })), patients: patientsTrend.map((r) => ({ _id: r.day, count: Number(r.count) })) }, distributions: { appointmentStatus: byStatus.map((r) => ({ _id: r.status, count: Number(r.count) })), appointmentType: byType.map((r) => ({ _id: r.appointment_type, count: Number(r.count) })) } };
  }, getKnex());
}

/** System health for the admin dashboard: no process internals, only service states and record counts. */
async function systemHealth(scope) {
  return withTenant(scope, async (trx) => {
    const r = await cached('system:readiness', 15, readiness);
    const yesterday = new Date(Date.now() - 86400000);
    const n = (t, extra) => scopedCount(trx, scope, t, extra);
    const collections = { patients: await n('patients'), doctors: await n('practitioners', (q) => q.where('kind', 'doctor')), appointments: await n('appointments'), consultations: await n('encounters'), invoices: await n('invoices'), referrals: await n('referrals') };
    const last24Hours = { appointments: await n('appointments', (q) => q.where('created_at', '>=', yesterday)), consultations: await n('encounters', (q) => q.where('created_at', '>=', yesterday)), invoices: await n('invoices', (q) => q.where('created_at', '>=', yesterday)), referrals: await n('referrals', (q) => q.where('created_at', '>=', yesterday)) };
    const up = process.uptime();
    return { database: { status: r.ready ? 'Connected' : 'Degraded', collections, totalRecords: Object.values(collections).reduce((a, b) => a + b, 0) }, services: r.checks.map((c) => ({ name: c.name, status: c.status, latencyMs: c.latencyMs, mode: c.mode })), activity: { last24Hours }, system: { uptime: `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m`, uptimeSeconds: Math.round(up) } };
  }, getKnex());
}

async function alerts(scope) {
  return withTenant(scope, async (trx) => {
    const out = [];
    const urgent = await scopedCount(trx, scope, 'referrals', (q) => q.whereIn('urgency', ['High', 'Urgent', 'Emergency']).where('status', 'Pending'));
    if (urgent) out.push({ type: 'warning', title: 'Urgent referrals pending', message: `${urgent} urgent referral(s) awaiting action`, count: urgent });
    const overdue = await scopedCount(trx, scope, 'invoices', (q) => q.where('status', 'Overdue'));
    if (overdue) out.push({ type: 'warning', title: 'Overdue invoices', message: `${overdue} invoice(s) overdue`, count: overdue });
    if (scope.role === ROLES.SUPER_MASTER_ADMIN) {
      const expiring = await trx('clinics').whereNull('deleted_at').where('validity_end', '>=', trx.fn.now()).andWhere('validity_end', '<=', trx.raw("now() + interval '30 days'")).count({ c: '*' });
      if (Number(expiring[0].c)) out.push({ type: 'info', title: 'Clinics expiring soon', message: `${expiring[0].c} clinic(s) expire within 30 days`, count: Number(expiring[0].c) });
      const expired = await trx('clinics').whereNull('deleted_at').where('validity_end', '<', trx.fn.now()).count({ c: '*' });
      if (Number(expired[0].c)) out.push({ type: 'error', title: 'Expired clinics', message: `${expired[0].c} clinic(s) have expired validity`, count: Number(expired[0].c) });
    }
    return out;
  }, getKnex());
}

module.exports = { superMasterStats, overview, recentActivity, analytics, systemHealth, alerts };
