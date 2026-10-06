'use strict';
const { withTenant } = require('../../infrastructure/mongodb/tenant');
const { ROLES } = require('../../common/security/rbac');
const { serializeRow } = require('../../common/utils/serialize');
const { readiness } = require('../health/routes');
const { cached } = require('../../infrastructure/redis/cache');

const dayKey = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: `$${field}` } });
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

async function superMasterStats(scope) {
  return withTenant(scope, async (db) => {
    const thirty = new Date(Date.now() - 30 * 86400000);
    const clinics = db.c('clinics'), users = db.c('users'), pract = db.c('practitioners'), refs = db.c('referrals');
    const [totalClinics, activeClinics, totalUsers, activeUsers, totalDoctors, activeDoctors, totalNurses, totalPatients, totalAdmins, totalAppointments, totalReferrals, pendingReferrals, urgentReferrals, totalLabTests, recentUsers, recentClinics, revenueAgg, roleAgg] = await Promise.all([
      clinics.count({}), clinics.count({ isActive: true }),
      users.count({}), users.count({ isActive: true }),
      pract.count({ kind: 'doctor' }), pract.count({ kind: 'doctor', isActive: true }),
      pract.count({ kind: 'nurse' }), db.c('patients').count({}),
      users.count({ role: ROLES.CLINIC_ADMIN }), db.c('appointments').count({}),
      refs.count({}), refs.count({ status: 'Pending' }), refs.count({ urgency: { $in: ['High', 'Urgent', 'Emergency'] } }),
      db.c('lab_orders').count({}), users.count({ createdAt: { $gte: thirty } }), clinics.count({ createdAt: { $gte: thirty } }),
      db.c('invoices').aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: null, revenue: { $sum: '$total' } } }]),
      users.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ]);
    return {
      overview: { totalClinics, activeClinics, totalUsers, activeUsers, totalDoctors: activeDoctors, totalNurses, totalPatients, totalAppointments, totalLabTests, totalReferrals, totalRevenue: Number((revenueAgg[0] || {}).revenue) || 0 },
      breakdown: { userRoles: roleAgg.map((r) => ({ _id: r._id, count: r.count })), clinicStats: [{ _id: 'active', count: activeClinics }, { _id: 'inactive', count: totalClinics - activeClinics }], usersByRole: { doctors: totalDoctors, nurses: totalNurses, patients: totalPatients, admins: totalAdmins }, referrals: { total: totalReferrals, pending: pendingReferrals, urgent: urgentReferrals, completed: totalReferrals - pendingReferrals } },
      trends: { recentUsers, recentClinics, growthRate: { users: totalUsers ? Math.round((recentUsers / totalUsers) * 100) : 0, clinics: totalClinics ? Math.round((recentClinics / totalClinics) * 100) : 0 } },
    };
  });
}

async function overview(scope) {
  return withTenant(scope, async (db) => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const today = startOfToday(); const tomorrow = new Date(today.getTime() + 86400000);
    const [totalPatients, newPatients, totalAppointments, todayAppointments, totalDoctors, totalEncounters, pendingReferrals, urgentReferrals, money] = await Promise.all([
      db.c('patients').count({}), db.c('patients').count({ createdAt: { $gte: monthStart } }),
      db.c('appointments').count({}), db.c('appointments').count({ scheduledAt: { $gte: today, $lt: tomorrow } }),
      db.c('practitioners').count({ kind: 'doctor', isActive: true }), db.c('encounters').count({}),
      db.c('referrals').count({ status: 'Pending' }), db.c('referrals').count({ urgency: { $in: ['High', 'Urgent', 'Emergency'] } }),
      db.c('invoices').aggregate([{ $group: { _id: null, revenue: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$total', 0] } }, outstanding: { $sum: { $cond: [{ $in: ['$status', ['Paid', 'Cancelled', 'Rejected']] }, 0, { $subtract: ['$total', { $ifNull: ['$paidAmount', 0] }] }] } } } }]),
    ]);
    const m = money[0] || {};
    return { overview: { patients: { total: totalPatients, new: newPatients }, appointments: { total: totalAppointments, today: todayAppointments }, doctors: { total: totalDoctors }, consultations: { total: totalEncounters }, revenue: Number(m.revenue) || 0, outstandingInvoices: Number(m.outstanding) || 0, urgentReferrals, pendingReferrals } };
  });
}

async function recentActivity(scope) {
  return withTenant(scope, async (db) => {
    const recent = (name) => db.c(name).find({}, { sort: { createdAt: -1 }, limit: 10 });
    const [appointments, encounters, invoices, referrals] = await Promise.all([recent('appointments'), recent('encounters'), recent('invoices'), recent('referrals')]);
    return { appointments: serializeRow(appointments), consultations: serializeRow(encounters), invoices: serializeRow(invoices), referrals: serializeRow(referrals) };
  });
}

async function analytics(scope, period = '30d') {
  const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[period] || 30;
  return withTenant(scope, async (db) => {
    const since = new Date(Date.now() - days * 86400000);
    const [appointmentsTrend, revenueTrend, patientsTrend, byStatus, byType] = await Promise.all([
      db.c('appointments').aggregate([{ $match: { scheduledAt: { $gte: since } } }, { $group: { _id: dayKey('scheduledAt'), count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      db.c('invoices').aggregate([{ $match: { status: 'Paid', invoiceDate: { $gte: since } } }, { $group: { _id: dayKey('invoiceDate'), total: { $sum: '$total' } } }, { $sort: { _id: 1 } }]),
      db.c('patients').aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: dayKey('createdAt'), count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      db.c('appointments').aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      db.c('appointments').aggregate([{ $group: { _id: '$appointmentType', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    ]);
    return { period, trends: { appointments: appointmentsTrend, revenue: revenueTrend.map((r) => ({ _id: r._id, total: Number(r.total) })), patients: patientsTrend }, distributions: { appointmentStatus: byStatus, appointmentType: byType } };
  });
}

/** System health for the admin dashboard: no process internals, only service states and record counts. */
async function systemHealth(scope) {
  return withTenant(scope, async (db) => {
    const r = await cached('system:readiness', 15, readiness);
    const yesterday = new Date(Date.now() - 86400000);
    const n = (name, filter = {}) => db.c(name).count(filter);
    const [patientsN, doctorsN, appointmentsN, consultationsN, invoicesN, referralsN, a24, c24, i24, r24] = await Promise.all([
      n('patients'), n('practitioners', { kind: 'doctor' }), n('appointments'), n('encounters'), n('invoices'), n('referrals'),
      n('appointments', { createdAt: { $gte: yesterday } }), n('encounters', { createdAt: { $gte: yesterday } }), n('invoices', { createdAt: { $gte: yesterday } }), n('referrals', { createdAt: { $gte: yesterday } }),
    ]);
    const collections = { patients: patientsN, doctors: doctorsN, appointments: appointmentsN, consultations: consultationsN, invoices: invoicesN, referrals: referralsN };
    const up = process.uptime();
    return { database: { status: r.ready ? 'Connected' : 'Degraded', collections, totalRecords: Object.values(collections).reduce((a, b) => a + b, 0) }, services: r.checks.map((c) => ({ name: c.name, status: c.status, latencyMs: c.latencyMs, mode: c.mode })), activity: { last24Hours: { appointments: a24, consultations: c24, invoices: i24, referrals: r24 } }, system: { uptime: `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m`, uptimeSeconds: Math.round(up) } };
  });
}

async function alerts(scope) {
  return withTenant(scope, async (db) => {
    const out = [];
    const urgent = await db.c('referrals').count({ urgency: { $in: ['High', 'Urgent', 'Emergency'] }, status: 'Pending' });
    if (urgent) out.push({ type: 'warning', title: 'Urgent referrals pending', message: `${urgent} urgent referral(s) awaiting action`, count: urgent });
    const overdue = await db.c('invoices').count({ status: 'Overdue' });
    if (overdue) out.push({ type: 'warning', title: 'Overdue invoices', message: `${overdue} invoice(s) overdue`, count: overdue });
    if (scope.role === ROLES.SUPER_MASTER_ADMIN) {
      const now = new Date(); const in30 = new Date(Date.now() + 30 * 86400000);
      const expiring = await db.c('clinics').count({ validityEnd: { $gte: now, $lte: in30 } });
      if (expiring) out.push({ type: 'info', title: 'Clinics expiring soon', message: `${expiring} clinic(s) expire within 30 days`, count: expiring });
      const expired = await db.c('clinics').count({ validityEnd: { $lt: now } });
      if (expired) out.push({ type: 'error', title: 'Expired clinics', message: `${expired} clinic(s) have expired validity`, count: expired });
    }
    return out;
  });
}

module.exports = { superMasterStats, overview, recentActivity, analytics, systemHealth, alerts };
