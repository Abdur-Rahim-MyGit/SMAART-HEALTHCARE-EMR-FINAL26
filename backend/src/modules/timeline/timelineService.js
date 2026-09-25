'use strict';
/**
 * Patient clinical timeline. Reads the patient_timeline view (one indexed UNION
 * over the clinical tables) with cursor pagination, and offers the legacy
 * "case logs" projection the existing patient page renders.
 */
const { getKnex } = require('../../infrastructure/postgres/knex');
const { withTenant } = require('../../infrastructure/postgres/tenant');
const { notFound } = require('../../common/errors/AppError');
const { auditInTrx } = require('../audit/auditRepository');

const TYPES = ['registration', 'appointment', 'encounter', 'vitals', 'condition', 'prescription', 'lab_order', 'lab_result', 'imaging', 'referral', 'document'];

function encodeCursor(row) {
  return Buffer.from(JSON.stringify([new Date(row.occurred_at).toISOString(), row.id])).toString('base64url');
}
function decodeCursor(c) {
  try {
    const [at, id] = JSON.parse(Buffer.from(c, 'base64url').toString());
    return { at: new Date(at), id };
  } catch {
    return null;
  }
}

async function patientTimeline(scope, patientId, { cursor, limit = 50, types }, ctx) {
  return withTenant(scope, async (trx) => {
    const patient = await trx('patients').where({ id: patientId }).whereNull('deleted_at').first('id', 'clinic_id');
    if (!patient) throw notFound('Patient');
    let q = trx('patient_timeline').where('patient_id', patientId);
    const wanted = types ? types.split(',').filter((t) => TYPES.includes(t)) : null;
    if (wanted && wanted.length) q = q.whereIn('event_type', wanted);
    const c = cursor ? decodeCursor(cursor) : null;
    if (c) q = q.whereRaw('(occurred_at, id) < (?, ?)', [c.at, c.id]);
    const rows = await q.orderBy('occurred_at', 'desc').orderBy('id', 'desc').limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    await auditInTrx(trx, scope, { action: 'MEDICAL_RECORD_VIEWED', resourceType: 'patient', resourceId: patientId, requestId: ctx.requestId, ip: ctx.ip, details: { view: 'timeline' } });
    return { data: page.map((r) => ({ id: r.id, type: r.event_type, title: r.title, description: r.description, status: r.status, occurredAt: r.occurred_at })), nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null };
  }, getKnex());
}

const ICONS = {
  vitals: { iconType: 'Activity', iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  prescription: { iconType: 'Pill', iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
  consultation: { iconType: 'Stethoscope', iconBgColor: 'bg-green-100', iconColor: 'text-green-600' },
  appointment: { iconType: 'Calendar', iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
  teleconsultation: { iconType: 'Video', iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  lab: { iconType: 'FlaskConical', iconBgColor: 'bg-amber-100', iconColor: 'text-amber-600' },
  imaging: { iconType: 'Image', iconBgColor: 'bg-cyan-100', iconColor: 'text-cyan-600' },
  referral: { iconType: 'Share2', iconBgColor: 'bg-pink-100', iconColor: 'text-pink-600' },
  registration: { iconType: 'UserPlus', iconBgColor: 'bg-green-100', iconColor: 'text-green-600' },
};

/** Legacy `/patients/:id/case-logs` projection used by PatientView.jsx. */
async function legacyCaseLogs(scope, patientId, ctx) {
  return withTenant(scope, async (trx) => {
    const patient = await trx('patients').where({ id: patientId }).whereNull('deleted_at').first();
    if (!patient) throw notFound('Patient');
    const [vitals, prescriptions, encounters, appointments, labOrders, imaging, referrals] = await Promise.all([
      trx('vitals').where({ patient_id: patientId }).whereNull('deleted_at').orderBy('recorded_at', 'desc').limit(200),
      trx('prescriptions as p').leftJoin('practitioners as d', 'd.id', 'p.practitioner_id').select('p.*', 'd.full_name as doctor_name').where('p.patient_id', patientId).whereNull('p.deleted_at').orderBy('p.prescribed_at', 'desc').limit(200),
      trx('encounters').where({ patient_id: patientId }).whereNull('deleted_at').orderBy('started_at', 'desc').limit(200),
      trx('appointments as a').leftJoin('practitioners as d', 'd.id', 'a.practitioner_id').select('a.*', 'd.full_name as doctor_name').where('a.patient_id', patientId).whereNull('a.deleted_at').orderBy('a.scheduled_at', 'desc').limit(200),
      trx('lab_orders').where({ patient_id: patientId }).whereNull('deleted_at').orderBy('ordered_at', 'desc').limit(100),
      trx('imaging_studies').where({ patient_id: patientId }).whereNull('deleted_at').orderBy('study_date', 'desc').limit(100),
      trx('referrals').where({ patient_id: patientId }).whereNull('deleted_at').orderBy('created_at', 'desc').limit(100),
    ]);
    const items = await trx('prescription_items').whereIn('prescription_id', prescriptions.map((p) => p.id)).orderBy('sort_order');
    const itemsByRx = {};
    for (const i of items) (itemsByRx[i.prescription_id] = itemsByRx[i.prescription_id] || []).push(i);

    const logs = [];
    for (const v of vitals) {
      const parts = [];
      if (v.systolic && v.diastolic) parts.push(`BP: ${v.systolic}/${v.diastolic}`);
      if (v.temperature) parts.push(`Temp: ${v.temperature}${v.temperature_unit || ''}`);
      if (v.heart_rate) parts.push(`HR: ${v.heart_rate} bpm`);
      if (v.respiratory_rate) parts.push(`RR: ${v.respiratory_rate}`);
      if (v.oxygen_saturation) parts.push(`SpO2: ${v.oxygen_saturation}%`);
      logs.push({ id: `vitals-${v.id}`, type: 'vitals', title: 'Vitals Recorded', description: parts.join(', ') || 'Patient vitals were recorded', performedBy: v.recorded_by_name || 'Healthcare Provider', timestamp: v.recorded_at, details: { bloodPressure: v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : null, temperature: v.temperature ? `${v.temperature}${v.temperature_unit || ''}` : null, heartRate: v.heart_rate ? String(v.heart_rate) : null, respiratoryRate: v.respiratory_rate ? String(v.respiratory_rate) : null, oxygenSaturation: v.oxygen_saturation ? String(v.oxygen_saturation) : null, weight: v.weight_kg ? String(v.weight_kg) : null, height: v.height_cm ? String(v.height_cm) : null, bmi: v.bmi ? String(v.bmi) : null, summary: parts.join(', ') }, status: 'Completed', ...ICONS.vitals });
    }
    for (const p of prescriptions) {
      const meds = itemsByRx[p.id] || [];
      const doctorName = p.doctor_name ? `Dr. ${p.doctor_name}` : 'Doctor';
      meds.forEach((m, index) => logs.push({ id: `prescription-${p.id}-${index}`, type: 'prescription', title: 'Prescription Created', description: m.name || 'Medication prescribed', performedBy: doctorName, timestamp: p.prescribed_at, details: { medication: m.name, dosage: m.dosage, frequency: m.frequency, duration: m.duration, instructions: m.instructions, diagnosis: p.diagnosis, prescriptionNumber: p.prescription_number, count: `${meds.length} medication${meds.length > 1 ? 's' : ''}` }, status: p.status || 'Active', ...ICONS.prescription }));
    }
    for (const e of encounters) logs.push({ id: `consultation-${e.id}`, type: 'consultation', title: 'Consultation', description: `${e.encounter_type || 'General'} consultation - ${e.reason || 'Medical consultation'}`, performedBy: e.provider_name || 'Healthcare Provider', timestamp: e.started_at, details: { mode: e.mode, duration: e.duration_minutes, status: e.status, symptoms: e.symptoms, providerNotes: e.provider_notes, diagnosis: e.diagnosis_summary }, status: e.status || 'Completed', ...ICONS.consultation });
    for (const a of appointments) {
      const tele = a.is_virtual || a.appointment_type === 'Teleconsultation';
      const doctorName = a.doctor_name ? `Dr. ${a.doctor_name}` : 'Doctor';
      logs.push({ id: `appointment-${a.id}`, type: 'appointment', title: tele ? 'Teleconsultation' : 'Appointment', description: `${a.appointment_type || 'Consultation'} with ${doctorName}`, performedBy: doctorName, timestamp: a.scheduled_at, details: { time: a.scheduled_time, type: a.appointment_type, status: a.status, notes: a.notes }, status: a.status || 'Scheduled', ...(tele ? ICONS.teleconsultation : ICONS.appointment) });
    }
    for (const l of labOrders) logs.push({ id: `lab-${l.id}`, type: 'lab', title: 'Lab Test Ordered', description: l.test_name, performedBy: 'Laboratory', timestamp: l.ordered_at, details: { status: l.status, priority: l.priority, labName: l.lab_name }, status: l.status, ...ICONS.lab });
    for (const i of imaging) logs.push({ id: `imaging-${i.id}`, type: 'imaging', title: i.modality, description: i.title, performedBy: 'Imaging', timestamp: i.study_date, details: { bodyPart: i.body_part, diagnosis: i.associated_diagnosis }, status: i.status, ...ICONS.imaging });
    for (const r of referrals) logs.push({ id: `referral-${r.id}`, type: 'referral', title: 'Referral', description: `${r.specialty} - ${r.specialist_name}`, performedBy: r.referring_provider?.name || 'Provider', timestamp: r.created_at, details: { urgency: r.urgency, status: r.status, reason: r.reason }, status: r.status, ...ICONS.referral });
    logs.push({ id: `registration-${patient.id}`, type: 'registration', title: 'Patient Registered', description: 'Patient record created', performedBy: 'Reception', timestamp: patient.created_at, details: {}, status: 'Completed', ...ICONS.registration });
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    await auditInTrx(trx, scope, { action: 'MEDICAL_RECORD_VIEWED', resourceType: 'patient', resourceId: patientId, requestId: ctx.requestId, ip: ctx.ip, details: { view: 'case-logs' } });
    return logs;
  }, getKnex());
}

module.exports = { patientTimeline, legacyCaseLogs, TYPES };
