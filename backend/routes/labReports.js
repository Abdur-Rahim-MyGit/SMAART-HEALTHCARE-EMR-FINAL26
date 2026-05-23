const express = require('express');
const router = express.Router();
const LabReport = require('../models/LabReport');
const { auth } = require('../middleware/auth');

// @route   GET /api/lab-reports
// @desc    Get all lab reports
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { patientId, clinicId, startDate, endDate, limit = 100 } = req.query;
    
    const query = {};
    
    if (patientId) query.patientId = patientId;
    if (clinicId) query.clinicId = clinicId;
    
    if (startDate || endDate) {
      query.testDate = {};
      if (startDate) query.testDate.$gte = new Date(startDate);
      if (endDate) query.testDate.$lte = new Date(endDate);
    }
    
    const reports = await LabReport.find(query)
      .populate('patientId', 'fullName uhid phone email')
      .populate('uploadedBy', 'fullName email')
      .sort({ testDate: -1, uploadedAt: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    console.error('Error fetching lab reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching lab reports',
      error: error.message
    });
  }
});

// @route   GET /api/lab-reports/patient/:patientId
// @desc    Get lab reports for a specific patient
// @access  Private
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;
    
    const options = { limit: parseInt(limit) };
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    
    const reports = await LabReport.getPatientReports(patientId, options);
    
    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error('Error fetching patient lab reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient lab reports',
      error: error.message
    });
  }
});

// @route   GET /api/lab-reports/clinic/:clinicId
// @desc    Get lab reports for a specific clinic
// @access  Private
router.get('/clinic/:clinicId', auth, async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const options = { 
      page: parseInt(page), 
      limit: parseInt(limit) 
    };
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    
    const reports = await LabReport.getClinicReports(clinicId, options);
    
    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error('Error fetching clinic lab reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clinic lab reports',
      error: error.message
    });
  }
});

// @route   GET /api/lab-reports/:id
// @desc    Get a single lab report by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const report = await LabReport.findById(req.params.id)
      .populate('patientId', 'fullName uhid phone email')
      .populate('uploadedBy', 'fullName email');
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Lab report not found'
      });
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching lab report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching lab report',
      error: error.message
    });
  }
});

// @route   POST /api/lab-reports
// @desc    Create a new lab report
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const reportData = {
      ...req.body,
      uploadedBy: req.user._id,
      uploadedByModel: req.user.role === 'doctor' ? 'Doctor' : 
                       req.user.role === 'nurse' ? 'Nurse' : 'Clinic'
    };
    
    const report = await LabReport.create(reportData);
    
    const populatedReport = await LabReport.findById(report._id)
      .populate('patientId', 'fullName uhid')
      .populate('uploadedBy', 'fullName email');
    
    res.status(201).json({
      success: true,
      message: 'Lab report created successfully',
      data: populatedReport
    });
  } catch (error) {
    console.error('Error creating lab report:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating lab report',
      error: error.message
    });
  }
});

// @route   PUT /api/lab-reports/:id
// @desc    Update a lab report
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const report = await LabReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Lab report not found'
      });
    }
    
    const updatedReport = await LabReport.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('patientId', 'fullName uhid')
      .populate('uploadedBy', 'fullName email');
    
    res.json({
      success: true,
      message: 'Lab report updated successfully',
      data: updatedReport
    });
  } catch (error) {
    console.error('Error updating lab report:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating lab report',
      error: error.message
    });
  }
});

// @route   DELETE /api/lab-reports/:id
// @desc    Delete a lab report
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const report = await LabReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Lab report not found'
      });
    }
    
    // TODO: Delete file from Cloudinary using cloudinaryPublicId
    // const cloudinary = require('cloudinary').v2;
    // await cloudinary.uploader.destroy(report.cloudinaryPublicId);
    
    await report.deleteOne();
    
    res.json({
      success: true,
      message: 'Lab report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lab report:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting lab report',
      error: error.message
    });
  }
});

// @route   GET /api/lab-reports/:id/download
// @desc    Download a lab report file
// @access  Private
router.get('/:id/download', auth, async (req, res) => {
  try {
    const report = await LabReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Lab report not found'
      });
    }
    
    // Redirect to the file path (Cloudinary URL)
    res.redirect(report.filePath);
  } catch (error) {
    console.error('Error downloading lab report:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading lab report',
      error: error.message
    });
  }
});

module.exports = router;
