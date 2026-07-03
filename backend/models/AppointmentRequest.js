const mongoose = require('mongoose');

/**
 * Appointment requests submitted from the public SMAART appointment website.
 *
 * Maps to the SHARED `appointmentrequests` collection (same database used by the
 * website, the Physio app and the Consultant dashboard). The EMR dashboard only
 * reads these and flips `status` on review — it never creates them here.
 */
const appointmentRequestSchema = new mongoose.Schema(
  {
    patientName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    mobileNumber: { type: String, trim: true },

    services: { type: [String], default: [] },

    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' },
    clinicName: { type: String, trim: true },
    location: {
      latitude: Number,
      longitude: Number,
      address: String,
      city: String,
      country: String,
    },

    preferredDate: { type: Date },
    preferredTime: { type: String, trim: true },
    appointmentType: { type: String, default: 'in_person' },
    notes: { type: String, trim: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'info_requested'],
      default: 'pending',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId },
    reviewNotes: { type: String, trim: true },
    source: { type: String, default: 'public_website' },
  },
  { strict: false, timestamps: true, collection: 'appointmentrequests' }
);

module.exports = mongoose.model('AppointmentRequest', appointmentRequestSchema);
