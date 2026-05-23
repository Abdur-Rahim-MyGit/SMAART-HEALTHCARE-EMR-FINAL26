// routes/patients.js

const express = require("express");
const Patient = require("../models/Patient");
const User = require("../models/User");
const Consultation = require("../models/Consultation");
const Appointment = require("../models/Appointment");
const PatientCaseLog = require("../models/PatientCaseLog");
const Vitals = require("../models/Vitals");
const Prescription = require("../models/Prescription");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Add patient
router.post("/", auth, async (req, res) => {
  try {
    const user = new User({
      // Using a placeholder name for the associated user account
      firstName: req.body.fullName.split(" ")[0],
      lastName: "User",
      email: req.body.attenderEmail,
      phone: req.body.attenderMobile,
      role: "patient",
      clinicId: req.user.clinicId,
    });
    await user.save();

    // Extract last name from full name
    const nameParts = req.body.fullName.split(" ");
    const lastName = nameParts.length > 1 ? nameParts.pop() : "";

    const patientData = {
      ...req.body,
      lastName: lastName,
      userId: user._id,
      clinicId: req.user.clinicId,
      // Initialize new fields with default or empty values
      wallet: { general: 3430, pharmacy: 32 }, // Example initial values
      // The following will be populated with mock data for demonstration
      clinicCategoryHistory: [
        {
          sno: 1,
          oldCategory: "Classic",
          newCategory: "Classic",
          datedOn: new Date("2023-11-13T10:21:00Z"),
        },
      ],
      checkInHistory: [
        {
          sno: 1,
          clinicType: "LIG",
          clinicName: "Integrated Clinic 1",
          checkedInOn: new Date("2023-11-24T10:32:00Z"),
        },
        {
          sno: 2,
          clinicType: "UG",
          clinicName: "Ward 1 - OBG",
          checkedInOn: new Date("2023-11-20T12:48:00Z"),
        },
        {
          sno: 3,
          clinicType: "PG",
          clinicName: "OBG",
          checkedInOn: new Date("2023-11-15T11:32:00Z"),
        },
      ],
      paymentCreditHistory: [
        {
          sno: 1,
          payMode: "ADM FREE",
          reference: "231113150213206",
          creditedBy: "Vincent B",
          creditedOn: new Date("2023-11-13T10:22:00Z"),
          amount: 5000,
        },
      ],
      paymentDebitHistory: [
        {
          sno: 1,
          payType: "Wallet",
          reference: "Item Cost",
          details: "General Ward Bed charge per day",
          debitedOn: new Date("2024-04-07T14:18:00Z"),
          amount: 20,
        },
      ],
    };

    const patient = new Patient(patientData);
    await patient.save();

    res
      .status(201)
      .json({ success: true, message: "Patient added successfully", patient });
  } catch (error) {
    console.error("Patient creation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add patient",
      error: error.message,
    });
  }
});

// GET all patients - This route works as is, will return new fields automatically
router.get("/", auth, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== "super_master_admin") {
      filter.clinicId = req.user.clinicId;
    }
    const patients = await Patient.find(filter)
      .populate('clinicId', 'name city state')
      .populate('assignedDoctors', 'firstName lastName fullName specialty')
      .sort({ createdAt: -1 });
    res.json({ success: true, patients });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch patients",
      error: error.message,
    });
  }
});

// GET unified case logs for a patient - MUST come before /:id route
router.get("/:patientId/case-logs", auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Validate ObjectId format
    if (!patientId || !patientId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID format"
      });
    }
    
    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    // Check access permissions
    if (
      req.user.role !== "super_master_admin" &&
      patient.clinicId.toString() !== req.user.clinicId.toString()
    ) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    // Fetch data from your actual MongoDB collections in parallel
    const [consultations, appointments, vitals, prescriptions, patientCaseLog] = await Promise.allSettled([
      Consultation.find({ patientId })
        .populate('patientId', 'fullName')
        .sort({ date: -1, createdAt: -1 })
        .lean(),
      Appointment.find({ patientId })
        .populate('doctorId', 'fullName specialty')
        .populate('patientId', 'fullName')
        .sort({ appointmentDate: -1, createdAt: -1 })
        .lean(),
      Vitals.find({ patientId })
        .sort({ visitDate: -1, createdAt: -1 })
        .lean(),
      Prescription.find({ patientId })
        .populate('doctorId', 'fullName specialty')
        .sort({ date: -1, createdAt: -1 })
        .lean(),
      PatientCaseLog.findOne({ patientId })
        .populate('medicalCases.createdBy', 'firstName lastName')
        .populate('medicalCases.assignedTo', 'firstName lastName')
        .lean()
    ]);

    // Extract successful results
    const consultationsData = consultations.status === 'fulfilled' ? consultations.value : [];
    const appointmentsData = appointments.status === 'fulfilled' ? appointments.value : [];
    const vitalsData = vitals.status === 'fulfilled' ? vitals.value : [];
    const prescriptionsData = prescriptions.status === 'fulfilled' ? prescriptions.value : [];
    const caseLogData = patientCaseLog.status === 'fulfilled' ? patientCaseLog.value : null;

    // Debug logging
    console.log(`🔍 Debug for patient ${patientId}:`);
    console.log(`📅 Appointments found: ${appointmentsData.length}`);
    console.log(`🩺 Consultations found: ${consultationsData.length}`);
    console.log(`💊 Prescriptions found: ${prescriptionsData.length}`);
    console.log(`❤️ Vitals records found: ${vitalsData.length}`);
    console.log(`📋 Case log found:`, !!caseLogData);
    if (caseLogData) {
      console.log(`📋 Medical cases in case log: ${caseLogData.medicalCases?.length || 0}`);
    }

    // Transform and merge data into unified format
    const caseLogs = [];

    // Transform Vitals from separate collection
    vitalsData.forEach(vitalRecord => {
      const vs = vitalRecord.vitalSigns;
      const vitalsSummary = [];
      
      if (vs.bloodPressure?.systolic && vs.bloodPressure?.diastolic) {
        vitalsSummary.push(`BP: ${vs.bloodPressure.systolic}/${vs.bloodPressure.diastolic}`);
      }
      if (vs.temperature?.value) vitalsSummary.push(`Temp: ${vs.temperature.value}${vs.temperature.unit}`);
      if (vs.heartRate?.value) vitalsSummary.push(`HR: ${vs.heartRate.value} ${vs.heartRate.unit}`);
      if (vs.respiratoryRate?.value) vitalsSummary.push(`RR: ${vs.respiratoryRate.value}`);
      if (vs.oxygenSaturation?.value) vitalsSummary.push(`SpO2: ${vs.oxygenSaturation.value}%`);
      
      caseLogs.push({
        id: `vitals-${vitalRecord._id}`,
        type: 'vitals',
        title: 'Vitals Recorded',
        description: vitalsSummary.join(', ') || 'Patient vitals were recorded',
        performedBy: vitalRecord.recordedByName || 'Healthcare Provider',
        timestamp: vitalRecord.visitDate || vitalRecord.createdAt,
        details: {
          bloodPressure: vs.bloodPressure?.systolic && vs.bloodPressure?.diastolic 
            ? `${vs.bloodPressure.systolic}/${vs.bloodPressure.diastolic}` 
            : null,
          temperature: vs.temperature?.value ? `${vs.temperature.value}${vs.temperature.unit}` : null,
          heartRate: vs.heartRate?.value ? `${vs.heartRate.value}` : null,
          respiratoryRate: vs.respiratoryRate?.value ? `${vs.respiratoryRate.value}` : null,
          oxygenSaturation: vs.oxygenSaturation?.value ? `${vs.oxygenSaturation.value}` : null,
          weight: vs.weight?.value ? `${vs.weight.value}` : null,
          height: vs.height?.value ? `${vs.height.value}` : null,
          bmi: vs.bmi?.value ? `${vs.bmi.value}` : null,
          summary: vitalsSummary.join(', ')
        },
        status: 'Completed',
        iconType: 'Activity',
        iconBgColor: 'bg-purple-100',
        iconColor: 'text-purple-600'
      });
    });

    // Transform Prescriptions from separate collection
    prescriptionsData.forEach(prescription => {
      const doctorName = prescription.doctorId 
        ? `Dr. ${prescription.doctorId.fullName || ''}`.trim()
        : 'Doctor';
      
      // Add each medication as a separate entry
      if (prescription.medications && prescription.medications.length > 0) {
        prescription.medications.forEach((med, index) => {
          caseLogs.push({
            id: `prescription-${prescription._id}-${index}`,
            type: 'prescription',
            title: 'Prescription Created',
            description: med.name || 'Medication prescribed',
            performedBy: doctorName,
            timestamp: prescription.date || prescription.createdAt,
            details: {
              medication: med.name,
              dosage: med.dosage,
              frequency: med.frequency,
              duration: med.duration,
              instructions: med.instructions,
              diagnosis: prescription.diagnosis,
              prescriptionNumber: prescription.prescriptionNumber,
              count: `${prescription.medications.length} medication${prescription.medications.length > 1 ? 's' : ''}`
            },
            status: prescription.status || 'Active',
            iconType: 'Pill',
            iconBgColor: 'bg-blue-100',
            iconColor: 'text-blue-600'
          });
        });
      }
    });

    // Transform Consultations
    consultationsData.forEach(consultation => {
      caseLogs.push({
        id: `consultation-${consultation._id}`,
        type: 'consultation',
        title: 'Consultation',
        description: `${consultation.consultationType || 'General'} consultation - ${consultation.reason || 'Medical consultation'}`,
        performedBy: consultation.provider || 'Healthcare Provider',
        timestamp: consultation.date || consultation.createdAt,
        details: {
          mode: consultation.mode,
          duration: consultation.duration,
          status: consultation.status,
          symptoms: consultation.symptoms,
          providerNotes: consultation.providerNotes,
          diagnosis: consultation.diagnosis
        },
        status: consultation.status || 'Completed',
        iconType: 'Stethoscope',
        iconBgColor: 'bg-green-100',
        iconColor: 'text-green-600'
      });
    });

    // Transform Appointments
    appointmentsData.forEach(appointment => {
      const doctorName = appointment.doctorId 
        ? `Dr. ${appointment.doctorId.fullName || ''}`.trim()
        : 'Doctor';

      caseLogs.push({
        id: `appointment-${appointment._id}`,
        type: 'appointment',
        title: appointment.type === 'teleconsultation' ? 'Teleconsultation' : 'Appointment',
        description: `${appointment.appointmentType || 'Consultation'} with ${doctorName}`,
        performedBy: doctorName,
        timestamp: appointment.appointmentDate || appointment.createdAt,
        details: {
          time: appointment.time,
          type: appointment.appointmentType,
          status: appointment.status,
          notes: appointment.notes,
          diagnosis: appointment.diagnosis
        },
        status: appointment.status || 'Scheduled',
        iconType: appointment.type === 'teleconsultation' ? 'Video' : 'Calendar',
        iconBgColor: appointment.type === 'teleconsultation' ? 'bg-purple-100' : 'bg-blue-100',
        iconColor: appointment.type === 'teleconsultation' ? 'text-purple-600' : 'text-blue-600'
      });
    });

    // Add vitals from patient check-in history (if available)
    if (patient.checkInHistory && patient.checkInHistory.length > 0) {
      patient.checkInHistory.forEach((visit, index) => {
        caseLogs.push({
          id: `visit-${index}`,
          type: 'visit',
          title: 'Patient Visit',
          description: `Check-in at ${visit.clinicName}`,
          performedBy: 'Reception',
          timestamp: visit.checkedInOn,
          details: {
            clinicType: visit.clinicType,
            clinicName: visit.clinicName,
            checkOut: visit.checkOut
          },
          status: visit.checkOut ? 'Completed' : 'In Progress',
          iconType: 'Activity',
          iconBgColor: 'bg-purple-100',
          iconColor: 'text-purple-600'
        });
      });
    }

    // Sort all case logs by timestamp (most recent first)
    caseLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: caseLogs,
      count: caseLogs.length
    });

  } catch (error) {
    console.error("Error fetching unified case logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch case logs",
      error: error.message,
    });
  }
});

// GET patient by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }
    // Check if user has access to this patient's clinic
    if (
      req.user.role !== "super_master_admin" &&
      patient.clinicId.toString() !== req.user.clinicId.toString()
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    res.json({ success: true, patient });
  } catch (error) {
    console.error("Error fetching patient:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patient",
      error: error.message,
    });
  }
});

// PUT update patient
router.put("/:id", auth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }
    // Check if user has access to this patient's clinic
    if (
      req.user.role !== "super_master_admin" &&
      patient.clinicId.toString() !== req.user.clinicId.toString()
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    const updatedPatient = await Patient.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({
      success: true,
      message: "Patient updated successfully",
      patient: updatedPatient,
    });
  } catch (error) {
    console.error("Error updating patient:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update patient",
      error: error.message,
    });
  }
});

// DELETE patient
router.delete("/:id", auth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }
    // Check if user has access to this patient's clinic
    if (
      req.user.role !== "super_master_admin" &&
      patient.clinicId.toString() !== req.user.clinicId.toString()
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Patient deleted successfully" });
  } catch (error) {
    console.error("Error deleting patient:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete patient",
      error: error.message,
    });
  }
});

module.exports = router;
