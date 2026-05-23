const express = require('express');
const router = express.Router();
const Teleconsultation = require('../models/Teleconsultation');
const { auth } = require('../middleware/auth');

// GET all teleconsultations with populated references
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    
    // Filter by clinic if user is clinic admin
    if (req.user.role === 'clinic_admin' && req.user.clinicId) {
      filter.clinicId = req.user.clinicId;
    }
    
    // Filter by patient if user is a patient
    if (req.user.role === 'patient' && req.user.patientId) {
      filter.patientId = req.user.patientId;
    }
    
    // Filter by doctor if user is a doctor
    if (req.user.role === 'doctor' && req.user.doctorId) {
      filter.doctorId = req.user.doctorId;
    }
    
    const teleconsultations = await Teleconsultation.find(filter)
      .populate('patientId', 'fullName phone email age gender')
      .populate('doctorId', 'fullName specialty phone email')
      .populate('clinicId', 'name city state phone')
      .populate('appointmentId')
      .sort({ scheduledDate: -1, createdAt: -1 });
    
    res.json({
      success: true,
      teleconsultations,
      count: teleconsultations.length
    });
  } catch (error) {
    console.error('Error fetching teleconsultations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teleconsultations',
      error: error.message
    });
  }
});

// GET teleconsultation by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const teleconsultation = await Teleconsultation.findById(req.params.id)
      .populate('patientId', 'fullName phone email age gender')
      .populate('doctorId', 'fullName specialty phone email')
      .populate('clinicId', 'name city state phone')
      .populate('appointmentId');
    
    if (!teleconsultation) {
      return res.status(404).json({
        success: false,
        message: 'Teleconsultation not found'
      });
    }
    
    res.json({
      success: true,
      teleconsultation
    });
  } catch (error) {
    console.error('Error fetching teleconsultation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teleconsultation',
      error: error.message
    });
  }
});

// GET teleconsultations by patient
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const teleconsultations = await Teleconsultation.find({
      patientId: req.params.patientId
    })
      .populate('patientId', 'fullName phone email age gender')
      .populate('doctorId', 'fullName specialty phone email')
      .populate('clinicId', 'name city state phone')
      .sort({ scheduledDate: -1 });
    
    res.json({
      success: true,
      teleconsultations,
      count: teleconsultations.length
    });
  } catch (error) {
    console.error('Error fetching patient teleconsultations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient teleconsultations',
      error: error.message
    });
  }
});

// GET teleconsultations by doctor
router.get('/doctor/:doctorId', auth, async (req, res) => {
  try {
    const teleconsultations = await Teleconsultation.find({
      doctorId: req.params.doctorId
    })
      .populate('patientId', 'fullName phone email age gender')
      .populate('doctorId', 'fullName specialty phone email')
      .populate('clinicId', 'name city state phone')
      .sort({ scheduledDate: -1 });
    
    res.json({
      success: true,
      teleconsultations,
      count: teleconsultations.length
    });
  } catch (error) {
    console.error('Error fetching doctor teleconsultations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor teleconsultations',
      error: error.message
    });
  }
});

// GET teleconsultation stats
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const filter = {};
    
    // Filter by clinic if user is clinic admin
    if (req.user.role === 'clinic_admin' && req.user.clinicId) {
      filter.clinicId = req.user.clinicId;
    }
    
    const totalConsultations = await Teleconsultation.countDocuments(filter);
    const scheduled = await Teleconsultation.countDocuments({ ...filter, status: 'Scheduled' });
    const active = await Teleconsultation.countDocuments({ 
      ...filter, 
      status: { $in: ['Started', 'In Progress'] } 
    });
    const completed = await Teleconsultation.countDocuments({ ...filter, status: 'Completed' });
    const cancelled = await Teleconsultation.countDocuments({ ...filter, status: 'Cancelled' });
    
    res.json({
      success: true,
      stats: {
        totalConsultations,
        scheduled,
        active,
        completed,
        cancelled
      }
    });
  } catch (error) {
    console.error('Error fetching teleconsultation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teleconsultation stats',
      error: error.message
    });
  }
});

// POST create new teleconsultation
router.post('/', auth, async (req, res) => {
  try {
    const teleconsultation = new Teleconsultation(req.body);
    await teleconsultation.save();
    
    // Populate references before sending response
    await teleconsultation.populate('patientId', 'fullName phone email age gender');
    await teleconsultation.populate('doctorId', 'fullName specialty phone email');
    await teleconsultation.populate('clinicId', 'name city state phone');
    
    res.status(201).json({
      success: true,
      message: 'Teleconsultation created successfully',
      teleconsultation
    });
  } catch (error) {
    console.error('Error creating teleconsultation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create teleconsultation',
      error: error.message
    });
  }
});

// PUT update teleconsultation
router.put('/:id', auth, async (req, res) => {
  try {
    const teleconsultation = await Teleconsultation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('patientId', 'fullName phone email age gender')
      .populate('doctorId', 'fullName specialty phone email')
      .populate('clinicId', 'name city state phone');
    
    if (!teleconsultation) {
      return res.status(404).json({
        success: false,
        message: 'Teleconsultation not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Teleconsultation updated successfully',
      teleconsultation
    });
  } catch (error) {
    console.error('Error updating teleconsultation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update teleconsultation',
      error: error.message
    });
  }
});

// POST start teleconsultation
router.post('/:id/join', auth, async (req, res) => {
  try {
    const teleconsultation = await Teleconsultation.findById(req.params.id);
    
    if (!teleconsultation) {
      return res.status(404).json({
        success: false,
        message: 'Teleconsultation not found'
      });
    }
    
    // Start meeting if not already started
    if (teleconsultation.status === 'Scheduled') {
      await teleconsultation.startMeeting();
    }
    
    // Add participant
    const { userId, userType, name, role } = req.body;
    if (userId && userType && name) {
      await teleconsultation.addParticipant(userId, userType, name, role);
    }
    
    await teleconsultation.populate('patientId', 'fullName phone email age gender');
    await teleconsultation.populate('doctorId', 'fullName specialty phone email');
    await teleconsultation.populate('clinicId', 'name city state phone');
    
    res.json({
      success: true,
      message: 'Joined teleconsultation successfully',
      teleconsultation
    });
  } catch (error) {
    console.error('Error joining teleconsultation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join teleconsultation',
      error: error.message
    });
  }
});

// POST end teleconsultation
router.post('/:id/end', auth, async (req, res) => {
  try {
    const teleconsultation = await Teleconsultation.findById(req.params.id);
    
    if (!teleconsultation) {
      return res.status(404).json({
        success: false,
        message: 'Teleconsultation not found'
      });
    }
    
    await teleconsultation.endMeeting();
    
    // Update consultation notes if provided
    if (req.body.consultationNotes) {
      teleconsultation.consultationNotes = req.body.consultationNotes;
    }
    if (req.body.diagnosis) {
      teleconsultation.diagnosis = req.body.diagnosis;
    }
    if (req.body.prescription) {
      teleconsultation.prescription = req.body.prescription;
    }
    
    await teleconsultation.save();
    await teleconsultation.populate('patientId', 'fullName phone email age gender');
    await teleconsultation.populate('doctorId', 'fullName specialty phone email');
    await teleconsultation.populate('clinicId', 'name city state phone');
    
    res.json({
      success: true,
      message: 'Teleconsultation ended successfully',
      teleconsultation
    });
  } catch (error) {
    console.error('Error ending teleconsultation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end teleconsultation',
      error: error.message
    });
  }
});

// DELETE teleconsultation
router.delete('/:id', auth, async (req, res) => {
  try {
    const teleconsultation = await Teleconsultation.findByIdAndDelete(req.params.id);
    
    if (!teleconsultation) {
      return res.status(404).json({
        success: false,
        message: 'Teleconsultation not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Teleconsultation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting teleconsultation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete teleconsultation',
      error: error.message
    });
  }
});

module.exports = router;
