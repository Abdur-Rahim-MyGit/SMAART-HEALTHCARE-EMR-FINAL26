const express = require('express');
const router = express.Router();
const Vitals = require('../models/Vitals');
const { auth } = require('../middleware/auth');

// @route   GET /api/vitals
// @desc    Get all vitals records
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { patientId, clinicId, startDate, endDate, limit = 100 } = req.query;
    
    const query = {};
    
    if (patientId) query.patientId = patientId;
    if (clinicId) query.clinicId = clinicId;
    
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }
    
    const vitals = await Vitals.find(query)
      .populate('patientId', 'fullName uhid phone')
      .populate('clinicId', 'name')
      .sort({ visitDate: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: vitals.length,
      vitals
    });
  } catch (error) {
    console.error('Error fetching vitals:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vitals records',
      error: error.message
    });
  }
});

// @route   GET /api/vitals/patient/:patientId
// @desc    Get vitals records for a specific patient
// @access  Private
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;
    
    const query = { patientId };
    
    if (startDate || endDate) {
      query.visitDate = {};
      if (startDate) query.visitDate.$gte = new Date(startDate);
      if (endDate) query.visitDate.$lte = new Date(endDate);
    }
    
    const vitals = await Vitals.find(query)
      .populate('clinicId', 'name')
      .sort({ visitDate: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: vitals.length,
      data: vitals
    });
  } catch (error) {
    console.error('Error fetching patient vitals:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient vitals',
      error: error.message
    });
  }
});

// @route   GET /api/vitals/:id
// @desc    Get a single vitals record by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const vital = await Vitals.findById(req.params.id)
      .populate('patientId', 'fullName uhid phone email')
      .populate('clinicId', 'name');
    
    if (!vital) {
      return res.status(404).json({
        success: false,
        message: 'Vitals record not found'
      });
    }
    
    res.json({
      success: true,
      data: vital
    });
  } catch (error) {
    console.error('Error fetching vital record:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vital record',
      error: error.message
    });
  }
});

// @route   POST /api/vitals
// @desc    Create a new vitals record
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const vitalData = {
      ...req.body,
      recordedBy: req.user._id,
      recordedByName: req.user.fullName || req.user.name,
      recordedByRole: req.user.role
    };
    
    const vital = await Vitals.create(vitalData);
    
    const populatedVital = await Vitals.findById(vital._id)
      .populate('patientId', 'fullName uhid')
      .populate('clinicId', 'name');
    
    res.status(201).json({
      success: true,
      message: 'Vitals record created successfully',
      data: populatedVital
    });
  } catch (error) {
    console.error('Error creating vitals record:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating vitals record',
      error: error.message
    });
  }
});

// @route   PUT /api/vitals/:id
// @desc    Update a vitals record
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const vital = await Vitals.findById(req.params.id);
    
    if (!vital) {
      return res.status(404).json({
        success: false,
        message: 'Vitals record not found'
      });
    }
    
    const updatedVital = await Vitals.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('patientId', 'fullName uhid')
      .populate('clinicId', 'name');
    
    res.json({
      success: true,
      message: 'Vitals record updated successfully',
      data: updatedVital
    });
  } catch (error) {
    console.error('Error updating vitals record:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating vitals record',
      error: error.message
    });
  }
});

// @route   DELETE /api/vitals/:id
// @desc    Delete a vitals record
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const vital = await Vitals.findById(req.params.id);
    
    if (!vital) {
      return res.status(404).json({
        success: false,
        message: 'Vitals record not found'
      });
    }
    
    await vital.deleteOne();
    
    res.json({
      success: true,
      message: 'Vitals record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting vitals record:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting vitals record',
      error: error.message
    });
  }
});

module.exports = router;
