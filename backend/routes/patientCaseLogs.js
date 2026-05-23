const express = require('express');
const router = express.Router();
const PatientCaseLog = require('../models/PatientCaseLog');
const Patient = require('../models/Patient');
const { auth, authorize } = require('../middleware/auth');

// Get patient case log by patient ID
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Check if user has access to this patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Role-based access control
    if (req.user.role === 'patient' && req.user._id.toString() !== patient.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'clinic_admin' && req.user.clinicId.toString() !== patient.clinicId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    let caseLog = await PatientCaseLog.findByPatientId(patientId);
    
    // Create case log if it doesn't exist
    if (!caseLog) {
      caseLog = new PatientCaseLog({
        patientId,
        clinicId: patient.clinicId,
        currentSession: {
          isActive: false,
          sessionCount: 0,
          totalSessionTime: 0
        },
        medicalCases: [],
        loginHistory: [],
        activityLog: [],
        medicalSummary: {
          chronicConditions: [],
          allergies: [],
          currentMedications: [],
          pastSurgeries: [],
          familyHistory: []
        }
      });
      await caseLog.save();
      
      // Update patient with case log reference
      patient.caseLogId = caseLog._id;
      await patient.save();
    }

    res.json({
      success: true,
      data: caseLog
    });

  } catch (error) {
    console.error('Error fetching patient case log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient case log',
      error: error.message
    });
  }
});

// Record patient login
router.post('/login/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { ipAddress, userAgent, deviceInfo, loginMethod = 'password' } = req.body;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    let caseLog = await PatientCaseLog.findOne({ patientId });
    if (!caseLog) {
      caseLog = new PatientCaseLog({
        patientId,
        clinicId: patient.clinicId
      });
    }

    // Add login record
    await caseLog.addLoginRecord({
      loginTime: new Date(),
      ipAddress,
      userAgent,
      deviceInfo,
      loginMethod
    });

    // Update patient login tracking
    patient.loginTracking.lastLoginTime = new Date();
    patient.loginTracking.totalLogins += 1;
    patient.loginTracking.isCurrentlyLoggedIn = true;
    patient.loginTracking.lastActiveDate = new Date();
    
    // Calculate login streak
    const lastLogin = patient.loginTracking.lastLoginTime;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastLogin && lastLogin.toDateString() === yesterday.toDateString()) {
      patient.loginTracking.loginStreak += 1;
    } else if (!lastLogin || lastLogin.toDateString() !== today.toDateString()) {
      patient.loginTracking.loginStreak = 1;
    }

    await patient.save();

    res.json({
      success: true,
      message: 'Login recorded successfully',
      data: {
        loginTime: new Date(),
        totalLogins: patient.loginTracking.totalLogins,
        loginStreak: patient.loginTracking.loginStreak
      }
    });

  } catch (error) {
    console.error('Error recording patient login:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record login',
      error: error.message
    });
  }
});

// Record patient logout
router.post('/logout/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { sessionDuration, ipAddress } = req.body;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const caseLog = await PatientCaseLog.findOne({ patientId });
    if (caseLog) {
      await caseLog.addLogoutRecord({
        sessionDuration,
        ipAddress
      });
    }

    // Update patient login tracking
    patient.loginTracking.lastLogoutTime = new Date();
    patient.loginTracking.isCurrentlyLoggedIn = false;
    await patient.save();

    res.json({
      success: true,
      message: 'Logout recorded successfully'
    });

  } catch (error) {
    console.error('Error recording patient logout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record logout',
      error: error.message
    });
  }
});

// Create new medical case
router.post('/case/:patientId', auth, authorize('doctor', 'clinic_admin', 'super_admin', 'super_master_admin'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const caseData = req.body;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    let caseLog = await PatientCaseLog.findOne({ patientId });
    if (!caseLog) {
      caseLog = new PatientCaseLog({
        patientId,
        clinicId: patient.clinicId
      });
    }

    // Add clinic ID to case data
    caseData.clinicId = patient.clinicId;

    await caseLog.createNewCase(caseData, req.user._id);

    // Update patient medical summary
    patient.medicalSummary.totalCases += 1;
    patient.medicalSummary.activeCases += 1;
    patient.medicalSummary.lastUpdated = new Date();
    await patient.save();

    res.json({
      success: true,
      message: 'Medical case created successfully',
      data: caseLog.medicalCases[caseLog.medicalCases.length - 1]
    });

  } catch (error) {
    console.error('Error creating medical case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create medical case',
      error: error.message
    });
  }
});

// Update medical case
router.put('/case/:patientId/:caseId', auth, authorize('doctor', 'clinic_admin', 'super_admin', 'super_master_admin'), async (req, res) => {
  try {
    const { patientId, caseId } = req.params;
    const updateData = req.body;

    const caseLog = await PatientCaseLog.findOne({ patientId });
    if (!caseLog) {
      return res.status(404).json({
        success: false,
        message: 'Case log not found'
      });
    }

    await caseLog.updateCase(caseId, updateData, req.user._id);

    res.json({
      success: true,
      message: 'Medical case updated successfully'
    });

  } catch (error) {
    console.error('Error updating medical case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medical case',
      error: error.message
    });
  }
});

// Get patient login history
router.get('/login-history/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const caseLog = await PatientCaseLog.findOne({ patientId })
      .select('loginHistory currentSession')
      .populate('patientId', 'firstName lastName email');

    if (!caseLog) {
      return res.status(404).json({
        success: false,
        message: 'Case log not found'
      });
    }

    // Sort login history by most recent first
    const sortedHistory = caseLog.loginHistory
      .sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime))
      .slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        loginHistory: sortedHistory,
        currentSession: caseLog.currentSession,
        totalLogins: caseLog.loginHistory.length
      }
    });

  } catch (error) {
    console.error('Error fetching login history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch login history',
      error: error.message
    });
  }
});

// Get patient activity log
router.get('/activity/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 100, offset = 0, action } = req.query;

    const caseLog = await PatientCaseLog.findOne({ patientId })
      .select('activityLog')
      .populate('patientId', 'firstName lastName email');

    if (!caseLog) {
      return res.status(404).json({
        success: false,
        message: 'Case log not found'
      });
    }

    let activities = caseLog.activityLog;

    // Filter by action if specified
    if (action) {
      activities = activities.filter(activity => activity.action === action);
    }

    // Sort by most recent first and apply pagination
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        activities: sortedActivities,
        totalActivities: activities.length
      }
    });

  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity log',
      error: error.message
    });
  }
});

// Get active cases for a clinic
router.get('/active-cases/:clinicId', auth, authorize('doctor', 'clinic_admin', 'super_admin', 'super_master_admin'), async (req, res) => {
  try {
    const { clinicId } = req.params;

    const activeCases = await PatientCaseLog.getActiveCases(clinicId);

    res.json({
      success: true,
      data: activeCases
    });

  } catch (error) {
    console.error('Error fetching active cases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active cases',
      error: error.message
    });
  }
});

// Add activity log entry
router.post('/activity/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { action, description, metadata } = req.body;

    const caseLog = await PatientCaseLog.findOne({ patientId });
    if (!caseLog) {
      return res.status(404).json({
        success: false,
        message: 'Case log not found'
      });
    }

    caseLog.activityLog.push({
      action,
      description,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata
    });

    await caseLog.save();

    res.json({
      success: true,
      message: 'Activity logged successfully'
    });

  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log activity',
      error: error.message
    });
  }
});

// Update medical summary
router.put('/medical-summary/:patientId', auth, authorize('doctor', 'clinic_admin', 'super_admin', 'super_master_admin'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const summaryData = req.body;

    const caseLog = await PatientCaseLog.findOne({ patientId });
    if (!caseLog) {
      return res.status(404).json({
        success: false,
        message: 'Case log not found'
      });
    }

    // Update medical summary
    Object.assign(caseLog.medicalSummary, summaryData);
    caseLog.medicalSummary.lastUpdated = new Date();

    await caseLog.save();

    // Also update patient's quick access medical summary
    const patient = await Patient.findById(patientId);
    if (patient) {
      Object.assign(patient.medicalSummary, {
        chronicConditions: summaryData.chronicConditions || patient.medicalSummary.chronicConditions,
        currentMedications: summaryData.currentMedications || patient.medicalSummary.currentMedications,
        allergies: summaryData.allergies || patient.medicalSummary.allergies,
        lastUpdated: new Date()
      });
      await patient.save();
    }

    res.json({
      success: true,
      message: 'Medical summary updated successfully'
    });

  } catch (error) {
    console.error('Error updating medical summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medical summary',
      error: error.message
    });
  }
});

module.exports = router;
