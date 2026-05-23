const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const { auth: authenticate, authorize } = require('../middleware/auth');

// Global search endpoint
router.get('/global', authenticate, async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    const user = req.user;

    if (!query || query.trim().length < 2) {
      return res.json({
        patients: [],
        appointments: [],
        doctors: [],
        clinics: []
      });
    }

    const searchRegex = new RegExp(query, 'i');
    const results = {};

    // Search patients based on user role
    try {
      let patientQuery = {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { patientId: searchRegex }
        ]
      };

      // Apply role-based filtering for patients
      if (user.role === 'clinic_admin' && user.clinicId) {
        patientQuery.clinicId = user.clinicId;
      } else if (user.role === 'super_admin' && user.clinicId) {
        patientQuery.clinicId = user.clinicId;
      } else if (user.role === 'doctor') {
        // Doctors can see patients they have appointments with
        const doctorAppointments = await Appointment.find({ doctorId: user._id }).distinct('patientId');
        patientQuery._id = { $in: doctorAppointments };
      } else if (user.role === 'patient') {
        patientQuery._id = user._id;
      }

      results.patients = await Patient.find(patientQuery)
        .populate('clinicId', 'name')
        .limit(parseInt(limit) / 4)
        .lean();
    } catch (error) {
      console.error('Patient search error:', error);
      results.patients = [];
    }

    // Search appointments based on user role
    try {
      let appointmentQuery = {};

      // Apply role-based filtering for appointments
      if (user.role === 'clinic_admin' && user.clinicId) {
        appointmentQuery.clinicId = user.clinicId;
      } else if (user.role === 'super_admin' && user.clinicId) {
        appointmentQuery.clinicId = user.clinicId;
      } else if (user.role === 'doctor') {
        appointmentQuery.doctorId = user._id;
      } else if (user.role === 'patient') {
        appointmentQuery.patientId = user._id;
      }

      results.appointments = await Appointment.find(appointmentQuery)
        .populate('patientId', 'firstName lastName patientId')
        .populate('doctorId', 'firstName lastName specialization')
        .populate('clinicId', 'name type')
        .sort({ date: -1 })
        .limit(parseInt(limit) / 4)
        .lean()
        .then(appointments => {
          // Filter by search query
          return appointments.filter(apt => {
            const patientName = `${apt.patientId?.firstName} ${apt.patientId?.lastName}`.toLowerCase();
            const doctorName = `${apt.doctorId?.firstName} ${apt.doctorId?.lastName}`.toLowerCase();
            const type = apt.type?.toLowerCase() || '';
            const status = apt.status?.toLowerCase() || '';
            const reason = apt.reason?.toLowerCase() || '';
            const queryLower = query.toLowerCase();

            return patientName.includes(queryLower) || 
                   doctorName.includes(queryLower) || 
                   type.includes(queryLower) || 
                   status.includes(queryLower) || 
                   reason.includes(queryLower);
          });
        });
    } catch (error) {
      console.error('Appointment search error:', error);
      results.appointments = [];
    }

    // Search doctors based on user role
    try {
      let doctorQuery = {
        role: 'doctor',
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { specialization: searchRegex },
          { phone: searchRegex }
        ]
      };

      // Apply role-based filtering for doctors
      if (user.role === 'clinic_admin' && user.clinicId) {
        doctorQuery.clinicId = user.clinicId;
      } else if (user.role === 'super_admin' && user.clinicId) {
        doctorQuery.clinicId = user.clinicId;
      }

      results.doctors = await User.find(doctorQuery)
        .populate('clinicId', 'name')
        .select('-password')
        .limit(parseInt(limit) / 4)
        .lean();
    } catch (error) {
      console.error('Doctor search error:', error);
      results.doctors = [];
    }

    // Search clinics (only for super_master_admin)
    try {
      if (user.role === 'super_master_admin') {
        const clinicQuery = {
          $or: [
            { name: searchRegex },
            { type: searchRegex },
            { city: searchRegex },
            { state: searchRegex },
            { ownerName: searchRegex },
            { registrationNumber: searchRegex }
          ]
        };

        results.clinics = await Clinic.find(clinicQuery)
          .limit(parseInt(limit) / 4)
          .lean();
      } else {
        results.clinics = [];
      }
    } catch (error) {
      console.error('Clinic search error:', error);
      results.clinics = [];
    }

    res.json(results);
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
});

// Search suggestions endpoint
router.get('/suggestions', authenticate, async (req, res) => {
  try {
    const { q: query } = req.query;
    const user = req.user;

    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    const searchRegex = new RegExp(query, 'i');
    const suggestions = [];

    // Get patient suggestions
    try {
      let patientQuery = {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex }
        ]
      };

      if (user.role === 'clinic_admin' && user.clinicId) {
        patientQuery.clinicId = user.clinicId;
      }

      const patients = await Patient.find(patientQuery)
        .select('firstName lastName patientId')
        .limit(5)
        .lean();

      patients.forEach(patient => {
        suggestions.push({
          text: `${patient.firstName} ${patient.lastName}`,
          type: 'patient',
          id: patient._id
        });
      });
    } catch (error) {
      console.error('Patient suggestions error:', error);
    }

    // Get doctor suggestions
    try {
      let doctorQuery = {
        role: 'doctor',
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { specialization: searchRegex }
        ]
      };

      if (user.role === 'clinic_admin' && user.clinicId) {
        doctorQuery.clinicId = user.clinicId;
      }

      const doctors = await User.find(doctorQuery)
        .select('firstName lastName specialization')
        .limit(5)
        .lean();

      doctors.forEach(doctor => {
        suggestions.push({
          text: `Dr. ${doctor.firstName} ${doctor.lastName}`,
          type: 'doctor',
          id: doctor._id
        });
      });
    } catch (error) {
      console.error('Doctor suggestions error:', error);
    }

    res.json(suggestions.slice(0, 10));
  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({ message: 'Failed to get suggestions', error: error.message });
  }
});

// Recent searches endpoint
router.get('/recent', authenticate, (req, res) => {
  try {
    // This would typically be stored in database per user
    // For now, return empty array as frontend handles localStorage
    res.json([]);
  } catch (error) {
    console.error('Recent searches error:', error);
    res.status(500).json({ message: 'Failed to get recent searches', error: error.message });
  }
});

module.exports = router;
