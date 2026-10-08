'use strict';
const { notify } = require('../../modules/notifications/notificationService');

const TITLES = {
  'patient.created': ['New Patient Registered', 'A new patient was added'],
  'appointment.created': ['New Appointment', 'An appointment was scheduled'],
  'appointment.cancelled': ['Appointment Cancelled', 'An appointment was cancelled'],
  'encounter.completed': ['Consultation Completed', 'A consultation was completed'],
  'prescription.created': ['Prescription Created', 'A prescription was issued'],
  'lab.result.created': ['Lab Result Available', 'A lab result was recorded'],
  'document.uploaded': ['Document Uploaded', 'A document was uploaded'],
  'referral.created': ['New Referral', 'A referral was created'],
};
async function notificationHandler(event) {
  const t = TITLES[event.type];
  if (!t || !event.clinicId) return;
  await notify({ clinicId: event.clinicId, type: event.type, title: t[0], message: t[1], data: { aggregateType: event.aggregateType, aggregateId: event.aggregateId, ...event.payload } });
}
module.exports = { notificationHandler };
