const express = require('express');
const ConsultantDashboard = require('../models/ConsultantDashboard');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Create new consultant session
router.post('/', auth, async (req, res) => {
  try {
    const {
      patientId,
      sessionTime,
      duration,
      consultationType,
      consultationMode,
      chiefComplaint,
      historyOfPresentIllness,
      pastMedicalHistory,
      currentMedications,
      vitalSigns,
      physicalExamination,
      assessment,
      treatmentPlan,
      diagnosticOrders,
      followUp,
      patientEducation,
      billing,
      consultantNotes
    } = req.body;

    // Generate unique session ID
    const sessionId = `CS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get consultant info from authenticated user
    const consultant = await Doctor.findById(req.user.id);
    if (!consultant) {
      return res.status(404).json({
        success: false,
        message: 'Consultant not found'
      });
    }

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Create consultant dashboard entry
    const consultantSession = new ConsultantDashboard({
      consultantId: req.user.id,
      consultantName: consultant.fullName,
      patientId,
      sessionId,
      sessionDate: new Date(),
      sessionTime,
      duration,
      consultationType,
      consultationMode,
      chiefComplaint,
      historyOfPresentIllness,
      pastMedicalHistory,
      currentMedications,
      vitalSigns,
      physicalExamination,
      assessment,
      treatmentPlan,
      diagnosticOrders,
      followUp,
      patientEducation,
      billing,
      consultantNotes,
      status: 'In Progress'
    });

    await consultantSession.save();

    // Populate the response
    const populatedSession = await ConsultantDashboard.findById(consultantSession._id)
      .populate('patientId', 'fullName dateOfBirth gender phone email address')
      .populate('consultantId', 'fullName specialty email phone');

    res.status(201).json({
      success: true,
      message: 'Consultant session created successfully',
      session: populatedSession
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create consultant session',
      error: error.message
    });
  }
});

// Get all consultant sessions with filtering
router.get('/', auth, async (req, res) => {
  try {
    const {
      consultantId,
      patientId,
      status,
      consultationType,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    // Build filter object
    const filter = {};
    
    // Role-based filtering
    if (req.user.role !== 'super_master_admin') {
      filter.consultantId = req.user.id;
    }
    
    if (consultantId) filter.consultantId = consultantId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    if (consultationType) filter.consultationType = consultationType;
    
    if (startDate || endDate) {
      filter.sessionDate = {};
      if (startDate) filter.sessionDate.$gte = new Date(startDate);
      if (endDate) filter.sessionDate.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get sessions with pagination
    const sessions = await ConsultantDashboard.find(filter)
      .populate('patientId', 'fullName dateOfBirth gender phone email address')
      .populate('consultantId', 'fullName specialty email phone')
      .sort({ sessionDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalSessions = await ConsultantDashboard.countDocuments(filter);

    res.json({
      success: true,
      sessions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalSessions / parseInt(limit)),
        totalSessions,
        hasNext: skip + sessions.length < totalSessions,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consultant sessions',
      error: error.message
    });
  }
});

// Get single consultant session by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const session = await ConsultantDashboard.findById(req.params.id)
      .populate('patientId', 'fullName dateOfBirth gender phone email address medicalHistory')
      .populate('consultantId', 'fullName specialty email phone');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultant session not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'super_master_admin' && session.consultantId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch consultant session',
      error: error.message
    });
  }
});

// Update consultant session
router.put('/:id', auth, async (req, res) => {
  try {
    const session = await ConsultantDashboard.findById(req.params.id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultant session not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'super_master_admin' && session.consultantId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update session
    const updatedSession = await ConsultantDashboard.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
    .populate('patientId', 'fullName dateOfBirth gender phone email address')
    .populate('consultantId', 'fullName specialty email phone');

    res.json({
      success: true,
      message: 'Consultant session updated successfully',
      session: updatedSession
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update consultant session',
      error: error.message
    });
  }
});

// Complete consultant session
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const session = await ConsultantDashboard.findById(req.params.id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultant session not found'
      });
    }

    // Check authorization
    if (session.consultantId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the consultant can complete their session'
      });
    }

    await session.completeSession();

    const updatedSession = await ConsultantDashboard.findById(req.params.id)
      .populate('patientId', 'fullName dateOfBirth gender phone email')
      .populate('consultantId', 'fullName specialty email phone');

    res.json({
      success: true,
      message: 'Consultant session completed successfully',
      session: updatedSession
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to complete consultant session',
      error: error.message
    });
  }
});

// Sign consultant session
router.patch('/:id/sign', auth, async (req, res) => {
  try {
    const { signatureData } = req.body;
    
    const session = await ConsultantDashboard.findById(req.params.id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultant session not found'
      });
    }

    // Check authorization
    if (session.consultantId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the consultant can sign their session'
      });
    }

    await session.signSession(signatureData);

    const updatedSession = await ConsultantDashboard.findById(req.params.id)
      .populate('patientId', 'fullName dateOfBirth gender phone email')
      .populate('consultantId', 'fullName specialty email phone');

    res.json({
      success: true,
      message: 'Consultant session signed successfully',
      session: updatedSession
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to sign consultant session',
      error: error.message
    });
  }
});

// Add medication to treatment plan
router.post('/:id/medications', auth, async (req, res) => {
  try {
    const session = await ConsultantDashboard.findById(req.params.id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultant session not found'
      });
    }

    // Check authorization
    if (session.consultantId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await session.addMedication(req.body);

    const updatedSession = await ConsultantDashboard.findById(req.params.id)
      .populate('patientId', 'fullName dateOfBirth gender phone email')
      .populate('consultantId', 'fullName specialty email phone');

    res.json({
      success: true,
      message: 'Medication added successfully',
      session: updatedSession
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add medication',
      error: error.message
    });
  }
});


// Add referral
router.post('/:id/referrals', auth, async (req, res) => {
  try {
    const session = await ConsultantDashboard.findById(req.params.id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultant session not found'
      });
    }

    // Check authorization
    if (session.consultantId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await session.addReferral(req.body);

    const updatedSession = await ConsultantDashboard.findById(req.params.id)
      .populate('patientId', 'fullName dateOfBirth gender phone email')
      .populate('consultantId', 'fullName specialty email phone');

    res.json({
      success: true,
      message: 'Referral added successfully',
      session: updatedSession
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add referral',
      error: error.message
    });
  }
});

// Get consultant dashboard analytics
router.get('/analytics/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build filter for date range
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.sessionDate = {};
      if (startDate) dateFilter.sessionDate.$gte = new Date(startDate);
      if (endDate) dateFilter.sessionDate.$lte = new Date(endDate);
    }

    // Role-based filtering
    const consultantFilter = req.user.role !== 'super_master_admin' 
      ? { consultantId: req.user.id, ...dateFilter }
      : dateFilter;

    // Get analytics data
    const [
      totalSessions,
      completedSessions,
      pendingSessions,
      sessionsByType,
      sessionsByStatus,
      averageSessionDuration,
      totalPatientsConsulted,
      totalMedicationsPrescribed
    ] = await Promise.all([
      ConsultantDashboard.countDocuments(consultantFilter),
      ConsultantDashboard.countDocuments({ ...consultantFilter, status: { $in: ['Completed', 'Signed'] } }),
      ConsultantDashboard.countDocuments({ ...consultantFilter, status: 'In Progress' }),
      ConsultantDashboard.aggregate([
        { $match: consultantFilter },
        { $group: { _id: '$consultationType', count: { $sum: 1 } } }
      ]),
      ConsultantDashboard.aggregate([
        { $match: consultantFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      ConsultantDashboard.aggregate([
        { $match: consultantFilter },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
      ]),
      ConsultantDashboard.distinct('patientId', consultantFilter).then(patients => patients.length),
      ConsultantDashboard.aggregate([
        { $match: consultantFilter },
        { $project: { medicationCount: { $size: '$treatmentPlan.medications' } } },
        { $group: { _id: null, total: { $sum: '$medicationCount' } } }
      ]),
    ]);

    res.json({
      success: true,
      analytics: {
        totalSessions,
        completedSessions,
        pendingSessions,
        completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0,
        sessionsByType: sessionsByType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        sessionsByStatus: sessionsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        averageSessionDuration: averageSessionDuration[0]?.avgDuration || 0,
        totalPatientsConsulted,
        totalMedicationsPrescribed: totalMedicationsPrescribed[0]?.total || 0,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// Delete consultant session
router.delete('/:id', auth, async (req, res) => {
  try {
    const session = await ConsultantDashboard.findById(req.params.id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Consultant session not found'
      });
    }

    // Check authorization - only super admin or the consultant can delete
    if (req.user.role !== 'super_master_admin' && session.consultantId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await ConsultantDashboard.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Consultant session deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete consultant session',
      error: error.message
    });
  }
});

module.exports = router;
