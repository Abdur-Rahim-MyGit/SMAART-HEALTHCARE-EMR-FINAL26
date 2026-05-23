const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// @route   GET /api/doctors
// @desc    Get all doctors
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, specialty, status, search } = req.query;
    
    let query = {};
    
    // Add filters
    if (specialty) query.specialty = specialty;
    if (status) query.isActive = status === 'active';
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { specialty: { $regex: search, $options: 'i' } }
      ];
    }

    const doctors = await Doctor.find(query)
      .select('-passwordHash')
      .populate('clinicId', 'name address phone')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Doctor.countDocuments(query);

    res.json({
      success: true,
      data: doctors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching doctors',
      error: error.message
    });
  }
});

// @route   GET /api/doctors/:id
// @desc    Get doctor by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .select('-passwordHash')
      .populate('clinicId', 'name address phone email');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.json({
      success: true,
      data: doctor
    });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching doctor',
      error: error.message
    });
  }
});

// @route   POST /api/doctors
// @desc    Create new doctor
// @access  Private (Admin only)
router.post('/', [
  auth,
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('profileImage').notEmpty().withMessage('Profile image is required'),
  body('uhid').notEmpty().withMessage('UHID is required'),
  body('qualification').notEmpty().withMessage('Qualification is required'),
  body('clinicId').notEmpty().withMessage('Clinic ID is required'),
  body('currentAddress.street').notEmpty().withMessage('Current address street is required'),
  body('currentAddress.city').notEmpty().withMessage('Current address city is required'),
  body('currentAddress.state').notEmpty().withMessage('Current address state is required'),
  body('currentAddress.zipCode').notEmpty().withMessage('Current address zip code is required'),
  body('permanentAddress.street').notEmpty().withMessage('Permanent address street is required'),
  body('permanentAddress.city').notEmpty().withMessage('Permanent address city is required'),
  body('permanentAddress.state').notEmpty().withMessage('Permanent address state is required'),
  body('permanentAddress.zipCode').notEmpty().withMessage('Permanent address zip code is required'),
  body('specialty').optional().isString(),
  body('phone').optional().isString(),
  body('about').optional().isString()
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
      fullName, 
      email, 
      password, 
      specialty, 
      phone, 
      role, 
      profileImage,
      uhid,
      qualification,
      clinicId,
      currentAddress,
      permanentAddress,
      about
    } = req.body;

    // Check if doctor already exists
    const existingDoctor = await Doctor.findOne({ 
      $or: [{ email }, { uhid }] 
    });
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: existingDoctor.email === email 
          ? 'Doctor with this email already exists'
          : 'Doctor with this UHID already exists'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const doctor = new Doctor({
      fullName,
      email,
      passwordHash,
      specialty: specialty || 'General Practitioner',
      phone,
      profileImage,
      uhid: uhid.toUpperCase(),
      qualification,
      clinicId,
      currentAddress,
      permanentAddress,
      about,
      role: role || 'doctor'
    });

    await doctor.save();

    // Return doctor without password
    const doctorResponse = doctor.toObject();
    delete doctorResponse.passwordHash;

    res.status(201).json({
      success: true,
      message: 'Doctor created successfully',
      data: doctorResponse
    });
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating doctor',
      error: error.message
    });
  }
});

// @route   PUT /api/doctors/:id
// @desc    Update doctor
// @access  Private
router.put('/:id', [
  auth,
  body('fullName').optional().notEmpty(),
  body('email').optional().isEmail(),
  body('specialty').optional().isString(),
  body('phone').optional().isString()
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

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const { fullName, email, specialty, phone, isActive } = req.body;

    // Check if email is being changed and if it already exists
    if (email && email !== doctor.email) {
      const existingDoctor = await Doctor.findOne({ email });
      if (existingDoctor) {
        return res.status(400).json({
          success: false,
          message: 'Doctor with this email already exists'
        });
      }
    }

    // Update fields
    if (fullName) doctor.fullName = fullName;
    if (email) doctor.email = email;
    if (specialty) doctor.specialty = specialty;
    if (phone) doctor.phone = phone;
    if (typeof isActive === 'boolean') doctor.isActive = isActive;
    
    doctor.updatedAt = new Date();

    await doctor.save();

    // Return doctor without password
    const doctorResponse = doctor.toObject();
    delete doctorResponse.passwordHash;

    res.json({
      success: true,
      message: 'Doctor updated successfully',
      data: doctorResponse
    });
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating doctor',
      error: error.message
    });
  }
});

// @route   DELETE /api/doctors/:id
// @desc    Delete doctor (soft delete by setting isActive to false)
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Soft delete by setting isActive to false
    doctor.isActive = false;
    doctor.updatedAt = new Date();
    await doctor.save();

    res.json({
      success: true,
      message: 'Doctor deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting doctor',
      error: error.message
    });
  }
});

// @route   GET /api/doctors/stats/overview
// @desc    Get doctors statistics
// @access  Private
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const totalDoctors = await Doctor.countDocuments();
    const activeDoctors = await Doctor.countDocuments({ isActive: true });
    const inactiveDoctors = await Doctor.countDocuments({ isActive: false });
    
    // Get specialties distribution
    const specialties = await Doctor.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$specialty', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalDoctors,
        activeDoctors,
        inactiveDoctors,
        specialties
      }
    });
  } catch (error) {
    console.error('Error fetching doctor stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching doctor statistics',
      error: error.message
    });
  }
});

module.exports = router;
