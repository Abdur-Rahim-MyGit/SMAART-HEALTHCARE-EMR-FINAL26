const express = require('express');
const router = express.Router();
const Consultation = require('../models/Consultation');
const Prescription = require('../models/Prescription');
const { auth } = require('../middleware/auth');

// @route   GET /api/prescriptions/patient/:patientId
// @desc    Get prescriptions for a specific patient from Prescription collection
// @access  Private
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    // Fetch from the separate Prescription collection
    const prescriptions = await Prescription.find({
      patientId: req.params.patientId
    })
      .populate('doctorId', 'fullName specialty')
      .populate('patientId', 'fullName')
      .sort('-date -createdAt');
    
    res.json({
      success: true,
      prescriptions: prescriptions
    });
  } catch (error) {
    console.error('Error fetching patient prescriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching patient prescriptions',
      error: error.message
    });
  }
});

module.exports = router;
