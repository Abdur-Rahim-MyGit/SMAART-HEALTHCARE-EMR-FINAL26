const express = require('express');
const router = express.Router();
const Consultation = require('../models/Consultation');
const Patient = require('../models/Patient');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// @route   GET /api/consultations
// @desc    Get all consultations
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, provider, search } = req.query;
    
    let query = {};
    
    // Add filters
    if (status) query.status = status;
    if (type) query.consultationType = type;
    if (provider) query.provider = { $regex: provider, $options: 'i' };
    if (search) {
      query.$or = [
        { patientName: { $regex: search, $options: 'i' } },
        { provider: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } }
      ];
    }

    const consultations = await Consultation.find(query)
      .populate('patientId', 'fullName phone email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: -1, time: -1 });

    const total = await Consultation.countDocuments(query);

    res.json({
      success: true,
      data: consultations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching consultations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching consultations',
      error: error.message
    });
  }
});

// @route   GET /api/consultations/patient/:patientId
// @desc    Get consultations by patient ID
// @access  Private
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const consultations = await Consultation.find({ patientId: req.params.patientId })
      .populate('patientId', 'fullName phone email dateOfBirth gender')
      .sort({ date: -1, time: -1 });
    
    res.json({
      success: true,
      consultations: consultations
    });
  } catch (error) {
    console.error('Error fetching patient consultations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching patient consultations',
      error: error.message
    });
  }
});

// @route   GET /api/consultations/patient/:patientId/diagnoses
// @desc    Get diagnoses for a specific patient
// @access  Private
router.get('/patient/:patientId/diagnoses', auth, async (req, res) => {
  try {
    const diagnoses = await Consultation.find({
      patientId: req.params.patientId,
      diagnosis: { $ne: '' }
    })
      .populate('doctorId', 'name specialty')
      .select('diagnosis notes createdAt')
      .sort('-createdAt');
    
    res.json({
      success: true,
      data: diagnoses
    });
  } catch (error) {
    console.error('Error fetching patient diagnoses:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching patient diagnoses',
      error: error.message
    });
  }
});

// @route   GET /api/consultations/:id
// @desc    Get consultation by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .populate('patientId', 'fullName phone email dateOfBirth gender');
    
    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    res.json({
      success: true,
      data: consultation
    });
  } catch (error) {
    console.error('Error fetching consultation:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching consultation',
      error: error.message
    });
  }
});

// @route   POST /api/consultations
// @desc    Create new consultation
// @access  Private
router.post('/', [
  auth,
  body('patientId').isMongoId().withMessage('Valid patient ID is required'),
  body('patientName').notEmpty().withMessage('Patient name is required'),
  body('consultationType').isIn(['General', 'Specialist', 'Follow-up', 'Emergency', 'Telemedicine']).withMessage('Valid consultation type is required'),
  body('mode').isIn(['In-person', 'Video', 'Phone', 'Chat']).withMessage('Valid consultation mode is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('time').notEmpty().withMessage('Time is required'),
  body('provider').notEmpty().withMessage('Provider is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      patientId,
      patientName,
      consultationType,
      mode,
      date,
      time,
      duration,
      provider,
      reason,
      symptoms,
      patientNotes,
      priority
    } = req.body;

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const consultation = new Consultation({
      patientId,
      patientName,
      consultationType,
      mode,
      date,
      time,
      duration: duration || 30,
      provider,
      reason,
      symptoms,
      patientNotes,
      priority: priority || 'Medium'
    });

    await consultation.save();

    res.status(201).json({
      success: true,
      message: 'Consultation created successfully',
      data: consultation
    });
  } catch (error) {
    console.error('Error creating consultation:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating consultation',
      error: error.message
    });
  }
});

// @route   PUT /api/consultations/:id
// @desc    Update consultation
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id);
    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    const allowedUpdates = [
      'consultationType', 'mode', 'date', 'time', 'duration', 'provider',
      'reason', 'symptoms', 'patientNotes', 'providerNotes', 'status',
      'priority', 'followUpRequired', 'followUpDate', 'followUpNotes'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        consultation[field] = req.body[field];
      }
    });

    consultation.updatedAt = new Date();
    await consultation.save();

    res.json({
      success: true,
      message: 'Consultation updated successfully',
      data: consultation
    });
  } catch (error) {
    console.error('Error updating consultation:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating consultation',
      error: error.message
    });
  }
});

// @route   POST /api/consultations/:id/prescriptions
// @desc    Add prescription to consultation
// @access  Private
router.post('/:id/prescriptions', [
  auth,
  body('medication').notEmpty().withMessage('Medication is required'),
  body('dosage').notEmpty().withMessage('Dosage is required'),
  body('frequency').notEmpty().withMessage('Frequency is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const consultation = await Consultation.findById(req.params.id);
    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    const { medication, dosage, frequency, duration, instructions } = req.body;

    await consultation.addPrescription({
      medication,
      dosage,
      frequency,
      duration,
      instructions
    });

    res.json({
      success: true,
      message: 'Prescription added successfully',
      data: consultation
    });
  } catch (error) {
    console.error('Error adding prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding prescription',
      error: error.message
    });
  }
});

// @route   POST /api/consultations/:id/lab-tests
// @desc    Add lab test to consultation
// @access  Private
router.post('/:id/lab-tests', [
  auth,
  body('testName').notEmpty().withMessage('Test name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const consultation = await Consultation.findById(req.params.id);
    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    const { testName, reason, priority } = req.body;

    await consultation.addLabTest({
      testName,
      reason,
      priority: priority || 'Routine'
    });

    res.json({
      success: true,
      message: 'Lab test added successfully',
      data: consultation
    });
  } catch (error) {
    console.error('Error adding lab test:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding lab test',
      error: error.message
    });
  }
});

// @route   PUT /api/consultations/:id/status
// @desc    Update consultation status
// @access  Private
router.put('/:id/status', [
  auth,
  body('status').isIn(['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'No Show']).withMessage('Valid status is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const consultation = await Consultation.findById(req.params.id);
    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found'
      });
    }

    const { status } = req.body;

    switch (status) {
      case 'In Progress':
        await consultation.start();
        break;
      case 'Completed':
        await consultation.complete();
        break;
      case 'Cancelled':
        await consultation.cancel();
        break;
      case 'No Show':
        await consultation.markNoShow();
        break;
      default:
        consultation.status = status;
        await consultation.save();
    }

    res.json({
      success: true,
      message: 'Consultation status updated successfully',
      data: consultation
    });
  } catch (error) {
    console.error('Error updating consultation status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating consultation status',
      error: error.message
    });
  }
});

// @route   GET /api/consultations/stats/overview
// @desc    Get consultation statistics
// @access  Private
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const totalConsultations = await Consultation.countDocuments();
    const scheduledConsultations = await Consultation.countDocuments({ status: 'Scheduled' });
    const completedConsultations = await Consultation.countDocuments({ status: 'Completed' });
    const inProgressConsultations = await Consultation.countDocuments({ status: 'In Progress' });
    
    // Get consultation types distribution
    const consultationTypes = await Consultation.aggregate([
      { $group: { _id: '$consultationType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get consultation modes distribution
    const consultationModes = await Consultation.aggregate([
      { $group: { _id: '$mode', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalConsultations,
        scheduledConsultations,
        completedConsultations,
        inProgressConsultations,
        consultationTypes,
        consultationModes
      }
    });
  } catch (error) {
    console.error('Error fetching consultation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching consultation statistics',
      error: error.message
    });
  }
});

module.exports = router;
