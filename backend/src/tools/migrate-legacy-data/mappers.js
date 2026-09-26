'use strict';
/** Pure mapping from legacy Mongo documents to PostgreSQL rows and new Mongo documents. */
const str = (v) => (v === undefined || v === null ? null : String(v));
const date = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const num = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const json = (v, def) => JSON.stringify(v === undefined || v === null ? def : v);
const lower = (v) => (v ? String(v).trim().toLowerCase() : null);
const legacy = (collection, id) => ({ collection, id: String(id) });
const combine = (d, t) => { const x = date(d); if (!x) return null; if (t && /^\d{1,2}:\d{2}/.test(t)) { const [h, m] = t.split(':').map(Number); x.setHours(h, m, 0, 0); } return x; };

async function buildPlan(src, { uuidFor, report, hashPassword, ROLES }) {
  const tables = { clinics: [], users: [], practitioners: [], patients: [], patient_identifiers: [], appointments: [], encounters: [], vitals: [], prescriptions: [], prescription_items: [], documents: [], lab_orders: [], lab_results: [], imaging_studies: [], referrals: [], teleconsultations: [], invoices: [] };
  const mongo = { clinicalNotes: [], communityPosts: [], activityLogs: [] };
  const clinicIds = new Set();
  const seenEmails = new Set();
  const cid = (v) => (v && (v._id || v) ? uuidFor('clinics', v._id || v) : null);
  const pid = (v) => (v && (v._id || v) ? uuidFor('patients', v._id || v) : null);
  const did = (v) => (v && (v._id || v) ? uuidFor('doctors', v._id || v) : null);

  // ---- clinics + clinic admin users ----
  for (const c of src.clinics) {
    const id = uuidFor('clinics', c._id);
    clinicIds.add(id);
    const start = date(c.validityPeriod?.startDate) || date(c.createdAt) || new Date();
    let end = date(c.validityPeriod?.endDate);
    if (!end || end <= start) { end = new Date(start); end.setMonth(end.getMonth() + (num(c.validityPeriod?.duration) || 12)); }
    tables.clinics.push({ __legacy: legacy('clinics', c._id), id, clinic_code: str(c.clinicId), name: c.name || 'Unnamed clinic', type: str(c.type), registration_number: str(c.registrationNumber), year_of_establishment: num(c.yearOfEstablishment), address: str(c.address), city: str(c.city), state: str(c.state), country: str(c.country), zip_code: str(c.zipCode), phone: str(c.phone), email: lower(c.email), website: str(c.website), owner_name: str(c.ownerName), owner_medical_id: str(c.ownerMedicalId), admin_name: str(c.adminName), admin_contact: str(c.adminContact), admin_email: lower(c.adminEmail) || `clinic-${id}@migrated.invalid`, admin_username: str(c.adminUsername), trade_license: str(c.tradeLicense), medical_council_cert: str(c.medicalCouncilCert), tax_id: str(c.taxId), accreditation: str(c.accreditation), specialties: json(c.specialties, []), services: json(c.services, []), operating_hours: str(c.operatingHours), staff_count: num(c.staffCount), beds: num(c.beds), pharmacy_available: !!c.pharmacyAvailable, laboratory_available: !!c.laboratoryAvailable, payment_methods: json(c.paymentMethods, []), bank_info: str(c.bankInfo), is_active: c.isActive !== false, validity_start: start, validity_end: end, validity_duration_months: num(c.validityPeriod?.duration) || 12, renewal_history: json(c.validityPeriod?.renewalHistory, []), created_at: date(c.createdAt) || new Date(), updated_at: date(c.updatedAt) || new Date() });
    const adminEmail = lower(c.adminEmail);
    if (adminEmail && !seenEmails.has(adminEmail)) {
      seenEmails.add(adminEmail);
      const stored = c.adminPassword || c.passwordHash;
      // bcrypt hashes are kept (verified + rehashed to Argon2id on first login); plaintext is hashed now.
      const passwordHash = stored && String(stored).startsWith('$2') ? stored : stored ? await hashPassword(String(stored).length >= 8 ? String(stored) : `${stored}${'0'.repeat(8 - String(stored).length)}`) : await hashPassword(`Reset-${id}`);
      if (stored && !String(stored).startsWith('$2')) report.warnings.push(`clinic ${c.name}: admin password was stored in plaintext; it was hashed. Force a reset.`);
      if (!stored) report.warnings.push(`clinic ${c.name}: no admin password; a random one was set, admin must use password reset.`);
      const [first, ...rest] = String(c.adminName || 'Clinic Admin').split(' ');
      tables.users.push({ __legacy: legacy('clinic-admins', c._id), id: uuidFor('clinic-admins', c._id), clinic_id: id, role: ROLES.CLINIC_ADMIN, email: adminEmail, password_hash: passwordHash, first_name: first, last_name: rest.join(' ') || null, full_name: c.adminName || null, phone: str(c.adminContact), username: str(c.adminUsername), is_active: c.isActive !== false, is_verified: true, created_at: date(c.createdAt) || new Date() });
    } else if (adminEmail) report.warnings.push(`clinic ${c.name}: duplicate admin email ${adminEmail}; no additional admin user created.`);
  }

  // ---- super master admins (only role kept from the legacy users collection) ----
  for (const u of src.users) {
    if (u.role !== 'super_master_admin') { report.warnings.push(`user ${u.email}: legacy role ${u.role} removed (not an EMR role)`); continue; }
    const email = lower(u.email);
    if (!email || seenEmails.has(email)) continue;
    seenEmails.add(email);
    tables.users.push({ __legacy: legacy('users', u._id), id: uuidFor('users', u._id), clinic_id: null, role: ROLES.SUPER_MASTER_ADMIN, email, password_hash: u.password && String(u.password).startsWith('$2') ? u.password : await hashPassword(`Reset-${uuidFor('users', u._id)}`), first_name: str(u.firstName), last_name: str(u.lastName), full_name: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || null, phone: str(u.phone), is_active: u.isActive !== false, is_verified: true, last_login_at: date(u.lastLogin), created_at: date(u.createdAt) || new Date() });
  }

  // ---- practitioners (doctors, nurses): clinical resources, no credentials ----
  for (const d of src.doctors) {
    const clinic = cid(d.clinicId);
    if (!clinic || !clinicIds.has(clinic)) { report.warnings.push(`doctor ${d.fullName}: unknown clinic, skipped`); continue; }
    tables.practitioners.push({ __legacy: legacy('doctors', d._id), id: uuidFor('doctors', d._id), clinic_id: clinic, kind: 'doctor', full_name: d.fullName || 'Unknown', email: lower(d.email), phone: str(d.phone), specialty: str(d.specialty || d.specialization), qualification: str(d.qualification), license_number: str(d.licenseNumber), about: str(d.about), languages: json(d.languages, []), uhid: str(d.uhid), profile_image_url: d.profileImage && /^https?:/.test(d.profileImage) ? d.profileImage : null, current_address: d.currentAddress ? JSON.stringify(d.currentAddress) : null, permanent_address: d.permanentAddress ? JSON.stringify(d.permanentAddress) : null, is_active: d.isActive !== false, created_at: date(d.createdAt) || new Date() });
  }
  for (const n of src.nurses) {
    const clinic = cid(n.clinicId);
    if (!clinic || !clinicIds.has(clinic)) { report.warnings.push(`nurse ${n.fullName}: unknown clinic, skipped`); continue; }
    tables.practitioners.push({ __legacy: legacy('nurses', n._id), id: uuidFor('nurses', n._id), clinic_id: clinic, kind: 'nurse', full_name: n.fullName || 'Unknown', email: lower(n.email), phone: str(n.phone), department: str(n.department), shift: str(n.shift), license_number: str(n.licenseNumber), experience_years: num(n.experience), uhid: str(n.uhid), profile_image_url: n.profileImage && /^https?:/.test(n.profileImage) ? n.profileImage : null, is_active: n.isActive !== false, created_at: date(n.createdAt) || new Date() });
  }
  const practitionerIds = new Set(tables.practitioners.map((p) => p.id));
  const pract = (v) => { const id = did(v); return id && practitionerIds.has(id) ? id : null; };

  // ---- patients ----
  const patientIds = new Set();
  for (const p of src.patients) {
    const clinic = cid(p.clinicId);
    if (!clinic || !clinicIds.has(clinic)) { report.warnings.push(`patient ${p.fullName}: unknown clinic, skipped`); continue; }
    const id = uuidFor('patients', p._id);
    patientIds.add(id);
    const attrs = {};
    for (const k of ['attenderWhatsapp', 'referringDoctor', 'referredClinic', 'notes', 'occupation']) if (p[k]) attrs[k] = p[k];
    if (p.medicalHistory) attrs.legacyMedicalHistory = p.medicalHistory;
    tables.patients.push({ __legacy: legacy('patients', p._id), id, clinic_id: clinic, full_name: p.fullName || 'Unknown', date_of_birth: date(p.dateOfBirth), gender: p.gender ? String(p.gender).toLowerCase() : null, phone: str(p.phone || p.attenderMobile), email: lower(p.email), blood_group: str(p.bloodGroup || p.bloodType), marital_status: typeof p.maritalStatus === 'boolean' ? (p.maritalStatus ? 'Married' : 'Single') : str(p.maritalStatus), nationality: str(p.nationality), occupation: str(p.occupation), mode_of_care: str(p.modeOfCare), city: str(p.city || p.address?.city), pin_code: str(p.pinCode || p.address?.zipCode), address: json(typeof p.address === 'object' ? p.address : p.address ? { street: p.address } : {}, {}), emergency_contact: json(p.emergencyContact, {}), insurance: json(p.insurance || p.insuranceInfo, {}), attender_email: lower(p.attenderEmail), attender_mobile: str(p.attenderMobile), attender_whatsapp: str(p.attenderWhatsapp), referring_doctor: str(p.referringDoctor), referred_clinic: str(p.referredClinic), hand_dominance: str(p.handDominance), is_under_18: !!p.isUnder18, parent_guardian: json(p.parentGuardian, {}), notes: str(p.notes), profile_image_url: (p.profileImage || p.imageUrl) && /^https?:/.test(p.profileImage || p.imageUrl) ? p.profileImage || p.imageUrl : null, status: 'active', last_visit_at: date(p.lastVisit), next_appointment_at: date(p.nextAppointment), attributes: JSON.stringify(attrs), created_at: date(p.createdAt) || new Date() });
    if (p.profileImage && /^data:/.test(p.profileImage)) report.warnings.push(`patient ${p.fullName}: inline base64 profile image not migrated (re-upload through the document service)`);
    if (p.uhid) tables.patient_identifiers.push({ id: uuidFor('patient-uhid', p._id), clinic_id: clinic, patient_id: id, system: 'uhid', value: String(p.uhid).toUpperCase() });
    if (p.aadhaarNumber) tables.patient_identifiers.push({ id: uuidFor('patient-aadhaar', p._id), clinic_id: clinic, patient_id: id, system: 'aadhaar', value: String(p.aadhaarNumber) });
    tables.patient_identifiers.push({ id: uuidFor('patient-legacy', p._id), clinic_id: clinic, patient_id: id, system: 'legacy_mongo', value: String(p._id) });
  }
  const okPatient = (v) => { const id = pid(v); return id && patientIds.has(id) ? id : null; };

  // ---- appointments ----
  for (const a of src.appointments) {
    const patient = okPatient(a.patientId); const clinic = cid(a.clinicId);
    if (!patient || !clinic) { report.warnings.push(`appointment ${a._id}: orphan, skipped`); continue; }
    tables.appointments.push({ __legacy: legacy('appointments', a._id), id: uuidFor('appointments', a._id), clinic_id: clinic, patient_id: patient, practitioner_id: pract(a.doctorId), appointment_type: str(a.appointmentType) || 'General Consultation', scheduled_at: combine(a.date || a.appointmentDate, a.time) || date(a.createdAt) || new Date(), scheduled_time: str(a.time), duration_minutes: Math.min(480, Math.max(5, num(a.duration) || 30)), status: ['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No Show'].includes(a.status) ? a.status : 'Scheduled', priority: ['low', 'normal', 'high'].includes(a.priority) ? a.priority : 'normal', reason: str(a.reason), notes: str(a.notes), instructions: str(a.instructions), location: str(a.location), provider_name: str(a.provider), is_virtual: !!a.isVirtual, meeting_link: str(a.meetingLink), follow_up_required: !!a.followUpRequired, follow_up_date: date(a.followUpDate), reminder_sent: !!a.reminderSent, created_at: date(a.createdAt) || new Date() });
  }

  // ---- consultations → encounters (+ clinical notes in Mongo) ----
  for (const c of src.consultations) {
    const patient = okPatient(c.patientId); const clinic = cid(c.clinicId);
    if (!patient || !clinic) { report.warnings.push(`consultation ${c._id}: orphan, skipped`); continue; }
    const id = uuidFor('consultations', c._id);
    tables.encounters.push({ __legacy: legacy('consultations', c._id), id, clinic_id: clinic, patient_id: patient, encounter_type: str(c.consultationType) || 'General', mode: str(c.mode) || 'In-person', status: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'No Show'].includes(c.status) ? c.status : 'Completed', priority: str(c.priority) || 'Medium', started_at: combine(c.date, c.time) || date(c.createdAt) || new Date(), duration_minutes: num(c.duration), reason: str(c.reason), symptoms: json(Array.isArray(c.symptoms) ? c.symptoms : c.symptoms ? [c.symptoms] : [], []), diagnosis_summary: str(c.diagnosis), provider_name: c.provider === 'Dr. Johnson' ? null : str(c.provider), provider_notes: str(c.providerNotes), patient_notes: str(c.patientNotes), recommendations: json(c.recommendations, []), follow_up_required: !!c.followUpRequired, follow_up_date: date(c.followUpDate), follow_up_notes: str(c.followUpNotes), created_at: date(c.createdAt) || new Date() });
    if (c.providerNotes) mongo.clinicalNotes.push({ clinicId: clinic, patientId: patient, encounterId: id, noteType: 'consultation', title: 'Migrated consultation note', content: { text: c.providerNotes, recommendations: c.recommendations || [] }, status: 'final' });
    for (const rx of c.prescriptions || []) {
      const rxId = uuidFor('consultation-rx', `${c._id}:${rx._id || rx.medication}`);
      tables.prescriptions.push({ id: rxId, clinic_id: clinic, patient_id: patient, encounter_id: id, prescription_number: `MIG-${rxId.slice(0, 8)}`, prescribed_at: combine(c.date, c.time) || date(c.createdAt) || new Date(), diagnosis: str(c.diagnosis), status: 'Completed', created_at: date(c.createdAt) || new Date() });
      tables.prescription_items.push({ id: uuidFor('consultation-rx-item', `${c._id}:${rx._id || rx.medication}`), prescription_id: rxId, clinic_id: clinic, name: rx.medication || rx.name || 'Unknown', dosage: str(rx.dosage), frequency: str(rx.frequency), duration: str(rx.duration), instructions: str(rx.instructions), sort_order: 0 });
    }
    for (const lt of c.labTests || []) tables.lab_orders.push({ id: uuidFor('consultation-lab', `${c._id}:${lt._id || lt.testName}`), clinic_id: clinic, patient_id: patient, encounter_id: id, test_name: lt.testName || 'Lab test', priority: ['Routine', 'Urgent', 'Emergency'].includes(lt.priority) ? lt.priority : 'Routine', status: 'completed', ordered_at: date(c.createdAt) || new Date(), notes: str(lt.notes), created_at: date(c.createdAt) || new Date() });
  }

  // ---- vitals ----
  for (const v of src.vitals) {
    const patient = okPatient(v.patientId); const clinic = cid(v.clinicId);
    if (!patient || !clinic) { report.warnings.push(`vitals ${v._id}: orphan, skipped`); continue; }
    const vs = v.vitalSigns || {};
    const val = (x) => (x && typeof x === 'object' ? num(x.value) : num(x));
    tables.vitals.push({ __legacy: legacy('vitals', v._id), id: uuidFor('vitals', v._id), clinic_id: clinic, patient_id: patient, recorded_at: date(v.visitDate) || date(v.createdAt) || new Date(), recorded_by_name: str(v.recordedByName), recorded_by_role: str(v.recordedByRole), systolic: num(vs.bloodPressure?.systolic), diastolic: num(vs.bloodPressure?.diastolic), heart_rate: val(vs.heartRate), temperature: val(vs.temperature), temperature_unit: vs.temperature?.unit || '°F', respiratory_rate: val(vs.respiratoryRate), oxygen_saturation: val(vs.oxygenSaturation), weight_kg: val(vs.weight), height_cm: val(vs.height), bmi: val(vs.bmi), bmi_category: str(vs.bmi?.category), blood_sugar: val(vs.bloodSugar), notes: str(v.notes), clinical_notes: json(v.clinicalNotes, {}), created_at: date(v.createdAt) || new Date() });
  }

  // ---- prescriptions ----
  for (const p of src.prescriptions) {
    const patient = okPatient(p.patientId); const clinic = cid(p.clinicId);
    if (!patient || !clinic) { report.warnings.push(`prescription ${p._id}: orphan, skipped`); continue; }
    const id = uuidFor('prescriptions', p._id);
    tables.prescriptions.push({ __legacy: legacy('prescriptions', p._id), id, clinic_id: clinic, patient_id: patient, practitioner_id: pract(p.doctorId), prescription_number: str(p.prescriptionNumber) || `MIG-${id.slice(0, 8)}`, prescribed_at: date(p.date) || date(p.createdAt) || new Date(), diagnosis: str(p.diagnosis), notes: str(p.notes), status: ['Active', 'Completed', 'Cancelled'].includes(p.status) ? p.status : 'Active', follow_up_date: date(p.followUpDate), follow_up_instructions: str(p.followUpInstructions), created_at: date(p.createdAt) || new Date() });
    (p.medications || []).forEach((m, i) => tables.prescription_items.push({ id: uuidFor('prescription-items', `${p._id}:${i}`), prescription_id: id, clinic_id: clinic, name: m.name || 'Unknown', dosage: str(m.dosage), frequency: str(m.frequency), duration: str(m.duration), instructions: str(m.instructions), sort_order: i }));
  }

  // ---- lab reports → documents (legacy_url or cloudinary key) + lab order/result ----
  for (const r of src.labreports) {
    const patient = okPatient(r.patientId); const clinic = cid(r.clinicId);
    if (!patient || !clinic) { report.warnings.push(`lab report ${r._id}: orphan, skipped`); continue; }
    const docId = uuidFor('labreport-doc', r._id);
    const cloud = r.cloudinaryPublicId && !/^https?:/.test(r.cloudinaryPublicId);
    tables.documents.push({ id: docId, clinic_id: clinic, patient_id: patient, document_type: 'lab_report', category: 'lab', title: str(r.testName), original_file_name: r.fileName || 'report', mime_type: r.fileType && r.fileType.includes('/') ? r.fileType : r.fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream', size_bytes: num(r.fileSize) || 0, storage_provider: cloud ? 'cloudinary' : 'legacy_url', storage_key: cloud ? r.cloudinaryPublicId : r.filePath || 'unknown', storage_resource_type: cloud ? (r.fileType && r.fileType.startsWith('image') ? 'image' : 'raw') : null, legacy_url: r.filePath && /^https?:/.test(r.filePath) ? r.filePath : null, status: 'available', created_at: date(r.uploadedAt) || date(r.createdAt) || new Date() });
    const orderId = uuidFor('labreport-order', r._id);
    tables.lab_orders.push({ id: orderId, clinic_id: clinic, patient_id: patient, test_name: r.testName || 'Lab test', lab_name: str(r.labName), status: 'completed', ordered_at: date(r.testDate) || date(r.createdAt) || new Date(), notes: str(r.notes), created_at: date(r.createdAt) || new Date() });
    tables.lab_results.push({ __legacy: legacy('labreports', r._id), id: uuidFor('labreports', r._id), clinic_id: clinic, patient_id: patient, lab_order_id: orderId, document_id: docId, result_date: date(r.testDate) || date(r.createdAt) || new Date(), status: 'final', lab_name: str(r.labName), notes: str(r.notes), created_at: date(r.createdAt) || new Date() });
  }

  // ---- medical images → documents + imaging studies ----
  for (const m of src.medicalimages) {
    const patient = okPatient(m.patientId); const clinic = cid(m.clinicId) || (() => { const p = tables.patients.find((x) => x.id === patient); return p ? p.clinic_id : null; })();
    if (!patient || !clinic) { report.warnings.push(`medical image ${m._id}: orphan, skipped`); continue; }
    const docId = uuidFor('medicalimage-doc', m._id);
    const cloud = !!m.cloudinaryPublicId;
    tables.documents.push({ id: docId, clinic_id: clinic, patient_id: patient, document_type: str(m.imageType) || 'imaging', category: 'imaging', title: str(m.title), description: str(m.description), original_file_name: m.fileName || 'image', mime_type: m.mimeType || 'image/jpeg', size_bytes: num(m.fileSize) || 0, storage_provider: cloud ? 'cloudinary' : 'legacy_url', storage_key: cloud ? m.cloudinaryPublicId : m.imageUrl || m.cloudinaryUrl || 'unknown', storage_resource_type: cloud ? (m.mimeType === 'application/pdf' ? 'raw' : 'image') : null, legacy_url: !cloud ? m.imageUrl || m.cloudinaryUrl || null : null, status: m.status === 'Deleted' ? 'deleted' : 'available', is_private: m.isPrivate !== false, tags: json(m.tags, []), created_at: date(m.createdAt) || new Date() });
    tables.imaging_studies.push({ __legacy: legacy('medicalimages', m._id), id: uuidFor('medicalimages', m._id), clinic_id: clinic, patient_id: patient, document_id: docId, modality: str(m.imageType) || 'Other', body_part: m.bodyPart || null, title: m.title || m.imageType || 'Medical image', description: str(m.description), associated_diagnosis: str(m.associatedDiagnosis), study_date: date(m.imageTakenDate) || date(m.createdAt) || new Date(), status: ['Active', 'Archived', 'Deleted'].includes(m.status) ? m.status : 'Active', is_private: !!m.isPrivate, tags: json(m.tags, []), uploaded_by: pract(m.uploadedBy), created_at: date(m.createdAt) || new Date() });
  }

  // ---- referrals ----
  for (const r of src.referrals) {
    const patient = okPatient(r.patientId); const clinic = cid(r.clinicId);
    if (!patient || !clinic) { report.warnings.push(`referral ${r._id}: orphan, skipped`); continue; }
    tables.referrals.push({ __legacy: legacy('referrals', r._id), id: uuidFor('referrals', r._id), clinic_id: clinic, patient_id: patient, referral_type: r.referralType === 'inbound' ? 'inbound' : 'outbound', specialist_practitioner_id: pract(r.specialistId), specialist_name: r.specialistName || 'Unknown', specialty: r.specialty || 'General', specialist_contact: json(r.specialistContact, {}), specialist_address: json(r.specialistAddress, {}), external_clinic: json(r.externalClinic, {}), reason: r.reason || 'Not recorded', clinical_history: str(r.clinicalHistory), current_medications: json(r.currentMedications, []), test_results: json(r.testResults, {}), urgency: ['Low', 'Medium', 'High', 'Urgent', 'Emergency'].includes(r.urgency) ? r.urgency : 'Medium', preferred_date: date(r.preferredDate), preferred_time: str(r.preferredTime), status: ['Pending', 'Approved', 'In Progress', 'Completed', 'Cancelled'].includes(r.status) ? r.status : 'Pending', status_notes: str(r.statusNotes), insurance_info: json(r.insuranceInfo, {}), referring_provider: json(typeof r.referringProvider === 'string' ? { name: r.referringProvider } : r.referringProvider, {}), referred_by: pract(r.referredBy), special_instructions: str(r.specialInstructions), attachments: json(r.attachments, []), shareable_link: json(r.shareableLink, {}), created_at: date(r.createdAt) || new Date() });
  }

  // ---- teleconsultations ----
  for (const t of src.teleconsultations) {
    const patient = okPatient(t.patientId); const clinic = cid(t.clinicId);
    if (!patient || !clinic) { report.warnings.push(`teleconsultation ${t._id}: orphan, skipped`); continue; }
    tables.teleconsultations.push({ __legacy: legacy('teleconsultations', t._id), id: uuidFor('teleconsultations', t._id), clinic_id: clinic, patient_id: patient, practitioner_id: pract(t.doctorId), scheduled_at: date(t.scheduledDate) || date(t.createdAt) || new Date(), duration_minutes: num(t.duration) || 30, status: ['Scheduled', 'Waiting', 'In Progress', 'Completed', 'Cancelled', 'No Show'].includes(t.status) ? t.status : 'Scheduled', meeting_id: str(t.meetingId), meeting_link: str(t.meetingLink), reason: str(t.reason), notes: str(t.notes), diagnosis: str(t.diagnosis), prescription_text: str(t.prescription), participants: '[]', started_at: date(t.startedAt), ended_at: date(t.endedAt), created_at: date(t.createdAt) || new Date() });
  }

  // ---- invoices (Invoice + Billing collections unified) ----
  const money = (v) => Math.round((num(v) || 0) * 100) / 100;
  const inv = (i, collection) => {
    const patient = okPatient(i.patientId); const clinic = cid(i.clinicId);
    if (!clinic) { report.warnings.push(`${collection} ${i._id}: unknown clinic, skipped`); return; }
    const total = money(i.total ?? i.totalAmount ?? i.amount);
    const paid = i.status === 'Paid' || i.paymentStatus === 'paid' ? total : money(i.paidAmount);
    const status = ['Draft', 'Pending', 'Approved', 'Rejected', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'].includes(i.status) ? i.status : i.paymentStatus === 'paid' ? 'Paid' : 'Pending';
    const id = uuidFor(collection, i._id);
    tables.invoices.push({ __legacy: legacy(collection, i._id), id, clinic_id: clinic, patient_id: patient, invoice_number: str(i.invoiceNo || i.invoiceNumber || i.billId) || `MIG-${id.slice(0, 8)}`, invoice_date: date(i.invoiceDate || i.date || i.createdAt) || new Date(), due_date: date(i.dueDate), status, subtotal: money(i.subtotal ?? total), tax: money(i.tax), discount: money(i.discount), total, paid_amount: paid, payment_method: str(i.paymentMethod), line_items: json(i.lineItems || i.items, []), payments: json(i.payments, []), notes: str(i.notes), description: str(i.description), created_at: date(i.createdAt) || new Date() });
  };
  for (const i of src.invoices) inv(i, 'invoices');
  for (const b of src.billings) inv(b, 'billings');

  // ---- community posts → Mongo ----
  for (const p of src.posts) {
    const clinic = cid(p.clinicId);
    if (!clinic) continue;
    mongo.communityPosts.push({ legacyId: String(p._id), clinicId: clinic, authorId: p.authorId && /^[0-9a-f]{24}$/i.test(p.authorId) ? uuidFor('users', p.authorId) : uuidFor('posts-author', p.author || 'unknown'), author: str(p.author) || 'Unknown', title: p.title || 'Untitled', content: p.content || '', excerpt: str(p.excerpt), category: str(p.category) || 'General', tags: p.tags || [], featured: !!p.featured, published: p.published !== false, status: ['Draft', 'Published', 'Archived'].includes(p.status) ? p.status : 'Published', views: num(p.views) || 0, likes: num(p.likes) || 0, likedBy: [], comments: (p.comments || []).map((c) => ({ userId: uuidFor('posts-commenter', c.author || 'unknown'), author: c.author, content: c.content, createdAt: date(c.createdAt) || new Date() })), createdAt: date(p.createdAt) || new Date() });
  }
  // ---- case log activity → Mongo activity logs ----
  for (const l of src.patientcaselogs) {
    const patient = okPatient(l.patientId);
    const clinic = patient ? tables.patients.find((x) => x.id === patient)?.clinic_id : null;
    if (!patient || !clinic) continue;
    for (const a of l.activityLog || []) mongo.activityLogs.push({ clinicId: clinic, patientId: patient, action: a.action || 'activity', description: str(a.description), performedByName: str(a.performedByName), metadata: a.metadata || {}, occurredAt: date(a.timestamp) || new Date() });
    for (const h of l.loginHistory || []) mongo.activityLogs.push({ clinicId: clinic, patientId: patient, action: 'legacy_login', description: `Login via ${h.loginMethod || 'password'}`, metadata: { ip: h.ipAddress }, occurredAt: date(h.loginTime) || new Date() });
  }

  const order = ['clinics', 'users', 'practitioners', 'patients', 'patient_identifiers', 'documents', 'appointments', 'encounters', 'vitals', 'prescriptions', 'prescription_items', 'lab_orders', 'lab_results', 'imaging_studies', 'referrals', 'teleconsultations', 'invoices'];
  return { tables, mongo, order };
}
module.exports = { buildPlan };
