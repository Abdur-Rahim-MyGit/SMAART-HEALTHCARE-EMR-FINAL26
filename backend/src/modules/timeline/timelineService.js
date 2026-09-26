'use strict';
/**
 * Patient clinical timeline: one $unionWith aggregation across the clinical
 * collections with cursor pagination, plus the legacy "case logs" projection.
 */
const { withTenant } = require('../../infrastructure/mongodb/tenant');
const { notFound } = require('../../common/errors/AppError');
const { auditInTrx } = require('../audit/auditRepository');

const SOURCES = [
  ['appointment', 'appointments', { occurredAt: '$scheduledAt', status: '$status', title: '$appointmentType', description: '$reason' }],
  ['encounter', 'encounters', { occurredAt: '$startedAt', status: '$status', title: '$encounterType', description: '$reason' }],
  ['vitals', 'vitals', { occurredAt: '$recordedAt', status: 'Completed', title: 'Vitals Recorded', description: '$notes' }],
  ['condition', 'clinical_conditions', { occurredAt: { $ifNull: ['$onsetDate', '$createdAt'] }, status: '$clinicalStatus', title: '$display', description: '$notes' }],
  ['prescription', 'prescriptions', { occurredAt: '$prescribedAt', status: '$status', title: 'Prescription Created', description: '$diagnosis' }],
  ['lab_order', 'lab_orders', { occurredAt: '$orderedAt', status: '$status', title: '$testName', description: '$notes' }],
  ['lab_result', 'lab_results', { occurredAt: '$resultDate', status: '$status', title: 'Lab Result', description: '$summary' }],
  ['imaging', 'imaging_studies', { occurredAt: '$studyDate', status: '$status', title: '$title', description: '$description' }],
  ['referral', 'referrals', { occurredAt: '$createdAt', status: '$status', title: '$specialty', description: '$reason' }],
  ['document', 'documents', { occurredAt: '$createdAt', status: '$status', title: { $ifNull: ['$title', '$originalFileName'] }, description: '$description' }],
];
const TYPES = ['registration', ...SOURCES.map((s) => s[0])];

const encodeCursor = (row) => Buffer.from(JSON.stringify([new Date(row.occurredAt).toISOString(), row.id])).toString('base64url');
function decodeCursor(c) { try { const [at, id] = JSON.parse(Buffer.from(c, 'base64url').toString()); return { at: new Date(at), id }; } catch { return null; } }

async function patientTimeline(scope, patientId, { cursor, limit = 50, types }, ctx) {
  return withTenant(scope, async (db) => {
    const patient = await db.c('patients').findById(patientId);
    if (!patient) throw notFound('Patient');
    const wanted = types ? types.split(',').filter((t) => TYPES.includes(t)) : TYPES;
    const events = [];
    if (wanted.includes('registration')) events.push({ id: patient._id, type: 'registration', title: 'Patient Registered', description: null, status: patient.status, occurredAt: patient.createdAt });
    for (const [type, coll, proj] of SOURCES) {
      if (!wanted.includes(type)) continue;
      const rows = await db.c(coll).aggregate([{ $match: { patientId, ...(coll === 'documents' ? { status: 'available' } : {}) } }, { $project: { _id: 1, type: { $literal: type }, ...proj } }, { $sort: { occurredAt: -1 } }, { $limit: 500 }]);
      for (const r of rows) events.push({ id: r._id, type, title: r.title, description: r.description, status: r.status, occurredAt: r.occurredAt });
    }
    events.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt) || (b.id > a.id ? 1 : -1));
    const c = cursor ? decodeCursor(cursor) : null;
    const after = c ? events.filter((e) => new Date(e.occurredAt) < c.at || (new Date(e.occurredAt).getTime() === c.at.getTime() && e.id < c.id)) : events;
    const page = after.slice(0, limit);
    await auditInTrx(db, scope, { action: 'MEDICAL_RECORD_VIEWED', resourceType: 'patient', resourceId: patientId, requestId: ctx.requestId, ip: ctx.ip, details: { view: 'timeline' } });
    return { data: page, nextCursor: after.length > limit ? encodeCursor(page[page.length - 1]) : null };
  });
}

const ICONS = { vitals: { iconType: 'Activity', iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' }, prescription: { iconType: 'Pill', iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600' }, consultation: { iconType: 'Stethoscope', iconBgColor: 'bg-green-100', iconColor: 'text-green-600' }, appointment: { iconType: 'Calendar', iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600' }, teleconsultation: { iconType: 'Video', iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' }, lab: { iconType: 'FlaskConical', iconBgColor: 'bg-amber-100', iconColor: 'text-amber-600' }, imaging: { iconType: 'Image', iconBgColor: 'bg-cyan-100', iconColor: 'text-cyan-600' }, referral: { iconType: 'Share2', iconBgColor: 'bg-pink-100', iconColor: 'text-pink-600' }, registration: { iconType: 'UserPlus', iconBgColor: 'bg-green-100', iconColor: 'text-green-600' } };

/** Legacy `/patients/:id/case-logs` projection used by PatientView.jsx. */
async function legacyCaseLogs(scope, patientId, ctx) {
  return withTenant(scope, async (db) => {
    const patient = await db.c('patients').findById(patientId);
    if (!patient) throw notFound('Patient');
    const q = (coll, sort) => db.c(coll).find({ patientId }, { sort, limit: 200 });
    const [vitals, prescriptions, encounters, appointments, labOrders, imaging, referrals] = await Promise.all([q('vitals', { recordedAt: -1 }), q('prescriptions', { prescribedAt: -1 }), q('encounters', { startedAt: -1 }), q('appointments', { scheduledAt: -1 }), q('lab_orders', { orderedAt: -1 }), q('imaging_studies', { studyDate: -1 }), q('referrals', { createdAt: -1 })]);
    const practIds = [...new Set([...prescriptions.map((p) => p.practitionerId), ...appointments.map((a) => a.practitionerId)].filter(Boolean))];
    const pr = practIds.length ? await db.c('practitioners').find({ _id: { $in: practIds } }, { projection: { fullName: 1 } }) : [];
    const pname = Object.fromEntries(pr.map((p) => [p._id, p.fullName]));
    const logs = [];
    for (const v of vitals) {
      const parts = [];
      if (v.systolic && v.diastolic) parts.push(`BP: ${v.systolic}/${v.diastolic}`);
      if (v.temperature) parts.push(`Temp: ${v.temperature}${v.temperatureUnit || ''}`);
      if (v.heartRate) parts.push(`HR: ${v.heartRate} bpm`);
      if (v.respiratoryRate) parts.push(`RR: ${v.respiratoryRate}`);
      if (v.oxygenSaturation) parts.push(`SpO2: ${v.oxygenSaturation}%`);
      logs.push({ id: `vitals-${v._id}`, type: 'vitals', title: 'Vitals Recorded', description: parts.join(', ') || 'Patient vitals were recorded', performedBy: v.recordedByName || 'Healthcare Provider', timestamp: v.recordedAt, details: { bloodPressure: v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : null, temperature: v.temperature ? `${v.temperature}${v.temperatureUnit || ''}` : null, heartRate: v.heartRate ? String(v.heartRate) : null, respiratoryRate: v.respiratoryRate ? String(v.respiratoryRate) : null, oxygenSaturation: v.oxygenSaturation ? String(v.oxygenSaturation) : null, weight: v.weightKg ? String(v.weightKg) : null, height: v.heightCm ? String(v.heightCm) : null, bmi: v.bmi ? String(v.bmi) : null, summary: parts.join(', ') }, status: 'Completed', ...ICONS.vitals });
    }
    for (const p of prescriptions) {
      const doctorName = pname[p.practitionerId] ? `Dr. ${pname[p.practitionerId]}` : 'Doctor';
      (p.medications || []).forEach((m, index) => logs.push({ id: `prescription-${p._id}-${index}`, type: 'prescription', title: 'Prescription Created', description: m.name || 'Medication prescribed', performedBy: doctorName, timestamp: p.prescribedAt, details: { medication: m.name, dosage: m.dosage, frequency: m.frequency, duration: m.duration, instructions: m.instructions, diagnosis: p.diagnosis, prescriptionNumber: p.prescriptionNumber, count: `${p.medications.length} medication${p.medications.length > 1 ? 's' : ''}` }, status: p.status || 'Active', ...ICONS.prescription }));
    }
    for (const e of encounters) logs.push({ id: `consultation-${e._id}`, type: 'consultation', title: 'Consultation', description: `${e.encounterType || 'General'} consultation - ${e.reason || 'Medical consultation'}`, performedBy: e.providerName || 'Healthcare Provider', timestamp: e.startedAt, details: { mode: e.mode, duration: e.durationMinutes, status: e.status, symptoms: e.symptoms, providerNotes: e.providerNotes, diagnosis: e.diagnosisSummary }, status: e.status || 'Completed', ...ICONS.consultation });
    for (const a of appointments) {
      const tele = a.isVirtual || a.appointmentType === 'Teleconsultation';
      const doctorName = pname[a.practitionerId] ? `Dr. ${pname[a.practitionerId]}` : 'Doctor';
      logs.push({ id: `appointment-${a._id}`, type: 'appointment', title: tele ? 'Teleconsultation' : 'Appointment', description: `${a.appointmentType || 'Consultation'} with ${doctorName}`, performedBy: doctorName, timestamp: a.scheduledAt, details: { time: a.scheduledTime, type: a.appointmentType, status: a.status, notes: a.notes }, status: a.status || 'Scheduled', ...(tele ? ICONS.teleconsultation : ICONS.appointment) });
    }
    for (const l of labOrders) logs.push({ id: `lab-${l._id}`, type: 'lab', title: 'Lab Test Ordered', description: l.testName, performedBy: 'Laboratory', timestamp: l.orderedAt, details: { status: l.status, priority: l.priority, labName: l.labName }, status: l.status, ...ICONS.lab });
    for (const i of imaging) logs.push({ id: `imaging-${i._id}`, type: 'imaging', title: i.modality, description: i.title, performedBy: 'Imaging', timestamp: i.studyDate, details: { bodyPart: i.bodyPart, diagnosis: i.associatedDiagnosis }, status: i.status, ...ICONS.imaging });
    for (const r of referrals) logs.push({ id: `referral-${r._id}`, type: 'referral', title: 'Referral', description: `${r.specialty} - ${r.specialistName}`, performedBy: r.referringProvider?.name || 'Provider', timestamp: r.createdAt, details: { urgency: r.urgency, status: r.status, reason: r.reason }, status: r.status, ...ICONS.referral });
    logs.push({ id: `registration-${patient._id}`, type: 'registration', title: 'Patient Registered', description: 'Patient record created', performedBy: 'Reception', timestamp: patient.createdAt, details: {}, status: 'Completed', ...ICONS.registration });
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    await auditInTrx(db, scope, { action: 'MEDICAL_RECORD_VIEWED', resourceType: 'patient', resourceId: patientId, requestId: ctx.requestId, ip: ctx.ip, details: { view: 'case-logs' } });
    return logs;
  });
}
module.exports = { patientTimeline, legacyCaseLogs, TYPES };
