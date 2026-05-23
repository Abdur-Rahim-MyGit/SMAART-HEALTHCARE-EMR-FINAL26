const express = require('express');
const router = express.Router();
const Referral = require('../models/Referral');
const Patient = require('../models/Patient');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// @route   GET /api/referrals
// @desc    Get all referrals
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, urgency, specialty, search, patientId } = req.query;
    let query = {};

    // Add filters
    if (patientId) query.patientId = patientId;
    if (status) query.status = status;
    if (urgency) query.urgency = urgency;
    if (specialty) query.specialty = { $regex: specialty, $options: 'i' };
    if (search) {
      query.$or = [
        { patientName: { $regex: search, $options: 'i' } },
        { specialistName: { $regex: search, $options: 'i' } },
        { specialty: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } },
        { 'referringProvider.name': { $regex: search, $options: 'i' } }
      ];
    }

    const referrals = await Referral.find(query)
      .populate('patientId', 'fullName phone email dateOfBirth gender address uhid')
      .populate('referredBy', 'fullName specialty')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .lean(); // ensure plain JS object for clean response

    const total = await Referral.countDocuments(query);

    res.json({
      success: true,
      data: referrals.map(r => ({
        ...r,
        referringProvider: r.referringProvider || { name: 'N/A' }
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching referrals',
      error: error.message
    });
  }
});

// @route   GET /api/referrals/:id
// @desc    Get referral by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id)
      .populate('patientId', 'fullName phone email dateOfBirth gender address')
      .lean();

    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }

    res.json({
      success: true,
      data: {
        ...referral,
        referringProvider: referral.referringProvider || { name: 'N/A' }
      }
    });
  } catch (error) {
    console.error('Error fetching referral:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching referral',
      error: error.message
    });
  }
});

// @route   POST /api/referrals
// @desc    Create new referral
// @access  Private
router.post('/', [
  auth,
  body('patientId').isMongoId().withMessage('Valid patient ID is required'),
  body('patientName').notEmpty().withMessage('Patient name is required'),
  body('specialistName').notEmpty().withMessage('Specialist name is required'),
  body('specialty').notEmpty().withMessage('Specialty is required'),
  body('reason').notEmpty().withMessage('Referral reason is required'),
  body('urgency').isIn(['Routine', 'Urgent', 'Emergency']).withMessage('Valid urgency level is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const {
      patientId,
      patientName,
      specialistName,
      specialty,
      specialistContact,
      specialistAddress,
      reason,
      clinicalHistory,
      currentMedications,
      testResults,
      urgency,
      preferredDate,
      preferredTime,
      insuranceInfo,
      referringProvider,
      specialInstructions
    } = req.body;

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const referral = new Referral({
      patientId,
      patientName,
      specialistName,
      specialty,
      specialistContact,
      specialistAddress,
      reason,
      clinicalHistory,
      currentMedications,
      testResults,
      urgency,
      preferredDate,
      preferredTime,
      insuranceInfo,
      referringProvider: referringProvider || { name: 'N/A' },
      specialInstructions
    });

    await referral.save();

    res.status(201).json({
      success: true,
      message: 'Referral created successfully',
      data: referral
    });
  } catch (error) {
    console.error('Error creating referral:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating referral',
      error: error.message
    });
  }
});

// @route   PUT /api/referrals/:id
// @desc    Update referral
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }

    const allowedUpdates = [
      'specialistName', 'specialty', 'specialistContact', 'specialistAddress',
      'reason', 'clinicalHistory', 'currentMedications', 'testResults',
      'urgency', 'preferredDate', 'preferredTime', 'appointmentDate', 'status', 'statusNotes',
      'insuranceInfo', 'specialInstructions', 'referringProvider'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        referral[field] = req.body[field];
      }
    });

    referral.updatedAt = new Date();
    await referral.save();

    res.json({
      success: true,
      message: 'Referral updated successfully',
      data: referral
    });
  } catch (error) {
    console.error('Error updating referral:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating referral',
      error: error.message
    });
  }
});

// Other routes (status, urgency, urgent, overdue, stats) stay unchanged...

module.exports = router;


/*const express = require('express');
const router = express.Router();
const Referral = require('../models/Referral');
const Patient = require('../models/Patient');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// @route   GET /api/referrals
// @desc    Get all referrals
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, urgency, specialty, search } = req.query;
    
    let query = {};
    
    // Add filters
    if (status) query.status = status;
    if (urgency) query.urgency = urgency;
    if (specialty) query.specialty = { $regex: specialty, $options: 'i' };
    if (search) {
      query.$or = [
        { patientName: { $regex: search, $options: 'i' } },
        { specialistName: { $regex: search, $options: 'i' } },
        { specialty: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } }
      ];
    }

    const referrals = await Referral.find(query)
      .populate('patientId', 'fullName phone email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Referral.countDocuments(query);

    res.json({
      success: true,
      data: referrals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching referrals',
      error: error.message
    });
  }
});

// @route   GET /api/referrals/:id
// @desc    Get referral by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id)
      .populate('patientId', 'fullName phone email dateOfBirth gender address');
    
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found'
      });
    }

    res.json({
      success: true,
      data: referral
    });
  } catch (error) {
    console.error('Error fetching referral:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching referral',
      error: error.message
    });
  }
});

// @route   POST /api/referrals
// @desc    Create new referral
// @access  Private
router.post('/', [
  auth,
  body('patientId').isMongoId().withMessage('Valid patient ID is required'),
  body('patientName').notEmpty().withMessage('Patient name is required'),
  body('specialistName').notEmpty().withMessage('Specialist name is required'),
  body('specialty').notEmpty().withMessage('Specialty is required'),
  body('reason').notEmpty().withMessage('Referral reason is required'),
  body('urgency').isIn(['Routine', 'Urgent', 'Emergency']).withMessage('Valid urgency level is required')
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
      specialistName,
      specialty,
      specialistContact,
      specialistAddress,
      reason,
      clinicalHistory,
      currentMedications,
      testResults,
      urgency,
      preferredDate,
      preferredTime,
      insuranceInfo,
      referringProvider,
      specialInstructions
    } = req.body;

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const referral = new Referral({
      patientId,
      patientName,
      specialistName,
      specialty,
      specialistContact,
      specialistAddress,
      reason,
      clinicalHistory,
      currentMedications,
      testResults,
      urgency,
      preferredDate,
      preferredTime,
      insuranceInfo,
      referringProvider,
      specialInstructions
    });

    await referral.save();

    res.status(201).json({
      success: true,
      message: 'Referral created successfully',
      data: referral
    });
  } catch (error) {
    console.error('Error creating referral:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating referral',
      error: error.message
    });
  }
});

// @route   PUT /api/referrals/:id
// @desc    Update referral
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found'
      });
    }

    const allowedUpdates = [
      'specialistName', 'specialty', 'specialistContact', 'specialistAddress',
      'reason', 'clinicalHistory', 'currentMedications', 'testResults',
      'urgency', 'preferredDate', 'preferredTime', 'appointmentDate', 'status', 'statusNotes',
      'insuranceInfo', 'specialInstructions'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        referral[field] = req.body[field];
      }
    });

    referral.updatedAt = new Date();
    await referral.save();

    res.json({
      success: true,
      message: 'Referral updated successfully',
      data: referral
    });
  } catch (error) {
    console.error('Error updating referral:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating referral',
      error: error.message
    });
  }
});

// @route   PUT /api/referrals/:id/status
// @desc    Update referral status
// @access  Private
router.put('/:id/status', [
  auth,
  body('status').isIn(['Pending', 'Scheduled', 'Completed', 'Cancelled', 'No Show']).withMessage('Valid status is required')
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

    const referral = await Referral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found'
      });
    }

    const { status, notes } = req.body;

    switch (status) {
      case 'Scheduled':
        await referral.schedule();
        break;
      case 'Completed':
        await referral.complete();
        break;
      case 'Cancelled':
        await referral.cancel();
        break;
      case 'No Show':
        await referral.markNoShow();
        break;
      default:
        referral.status = status;
        await referral.save();
    }

    res.json({
      success: true,
      message: 'Referral status updated successfully',
      data: referral
    });
  } catch (error) {
    console.error('Error updating referral status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating referral status',
      error: error.message
    });
  }
});

// @route   PUT /api/referrals/:id/urgency
// @desc    Update referral urgency
// @access  Private
router.put('/:id/urgency', [
  auth,
  body('urgency').isIn(['Routine', 'Urgent', 'Emergency']).withMessage('Valid urgency level is required')
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

    const referral = await Referral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found'
      });
    }

    const { urgency } = req.body;
    referral.urgency = urgency;
    await referral.save();

    res.json({
      success: true,
      message: 'Referral urgency updated successfully',
      data: referral
    });
  } catch (error) {
    console.error('Error updating referral urgency:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating referral urgency',
      error: error.message
    });
  }
});

// @route   GET /api/referrals/urgent
// @desc    Get urgent referrals
// @access  Private
router.get('/urgent', auth, async (req, res) => {
  try {
    const urgentReferrals = await Referral.findUrgent();

    res.json({
      success: true,
      data: urgentReferrals
    });
  } catch (error) {
    console.error('Error fetching urgent referrals:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching urgent referrals',
      error: error.message
    });
  }
});

// @route   GET /api/referrals/overdue
// @desc    Get overdue referrals
// @access  Private
router.get('/overdue', auth, async (req, res) => {
  try {
    const overdueReferrals = await Referral.findOverdue();

    res.json({
      success: true,
      data: overdueReferrals
    });
  } catch (error) {
    console.error('Error fetching overdue referrals:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching overdue referrals',
      error: error.message
    });
  }
});

// @route   GET /api/referrals/stats/overview
// @desc    Get referral statistics
// @access  Private
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const totalReferrals = await Referral.countDocuments();
    const pendingReferrals = await Referral.countDocuments({ status: 'Pending' });
    const approvedReferrals = await Referral.countDocuments({ status: 'Approved' });
    const completedReferrals = await Referral.countDocuments({ status: 'Completed' });
    const urgentReferrals = await Referral.countDocuments({ urgency: { $in: ['High', 'Urgent'] } });
    
    // Get specialties distribution
    const specialties = await Referral.aggregate([
      { $group: { _id: '$specialty', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get urgency distribution
    const urgencyDistribution = await Referral.aggregate([
      { $group: { _id: '$urgency', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalReferrals,
        pendingReferrals,
        approvedReferrals,
        completedReferrals,
        urgentReferrals,
        specialties,
        urgencyDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching referral statistics',
      error: error.message
    });
  }
});

module.exports = router;
*/