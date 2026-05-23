const express = require('express');
const router = express.Router();
const MedicalImage = require('../models/MedicalImage');
const { auth } = require('../middleware/auth');

// @route   GET /api/medical-images
// @desc    Get all medical images
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { patientId, imageType, bodyPart, status = 'Active', limit = 50 } = req.query;
    
    let query = { status };
    
    if (patientId) query.patientId = patientId;
    if (imageType) query.imageType = imageType;
    if (bodyPart) query.bodyPart = bodyPart;
    
    const images = await MedicalImage.find(query)
      .populate('patientId', 'fullName uhid phone')
      .populate('uploadedBy', 'fullName specialty')
      .populate('clinicId', 'name')
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: images,
      count: images.length
    });
  } catch (error) {
    console.error('Error fetching medical images:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medical images',
      error: error.message
    });
  }
});

// @route   GET /api/medical-images/patient/:patientId
// @desc    Get medical images for a specific patient
// @access  Private
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { imageType, status = 'Active' } = req.query;
    
    const images = await MedicalImage.findByPatient(patientId, { imageType, status })
      .populate('uploadedBy', 'fullName specialty')
      .populate('clinicId', 'name');
    
    res.json({
      success: true,
      data: images,
      count: images.length
    });
  } catch (error) {
    console.error('Error fetching patient medical images:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient medical images',
      error: error.message
    });
  }
});

// @route   GET /api/medical-images/:id
// @desc    Get a single medical image by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const image = await MedicalImage.findById(req.params.id)
      .populate('patientId', 'fullName uhid phone email')
      .populate('uploadedBy', 'fullName specialty')
      .populate('clinicId', 'name');
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Medical image not found'
      });
    }
    
    res.json({
      success: true,
      data: image
    });
  } catch (error) {
    console.error('Error fetching medical image:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medical image',
      error: error.message
    });
  }
});

// @route   POST /api/medical-images
// @desc    Create a new medical image
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const imageData = {
      ...req.body,
      uploadedBy: req.user._id
    };
    
    const image = await MedicalImage.create(imageData);
    
    const populatedImage = await MedicalImage.findById(image._id)
      .populate('patientId', 'fullName uhid')
      .populate('uploadedBy', 'fullName specialty');
    
    res.status(201).json({
      success: true,
      message: 'Medical image uploaded successfully',
      data: populatedImage
    });
  } catch (error) {
    console.error('Error creating medical image:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading medical image',
      error: error.message
    });
  }
});

// @route   PUT /api/medical-images/:id
// @desc    Update a medical image
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const image = await MedicalImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Medical image not found'
      });
    }
    
    const allowedUpdates = [
      'title', 'description', 'imageType', 'bodyPart',
      'associatedDiagnosis', 'tags', 'isPrivate', 'status'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        image[field] = req.body[field];
      }
    });
    
    await image.save();
    
    res.json({
      success: true,
      message: 'Medical image updated successfully',
      data: image
    });
  } catch (error) {
    console.error('Error updating medical image:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating medical image',
      error: error.message
    });
  }
});

// @route   DELETE /api/medical-images/:id
// @desc    Delete (archive) a medical image
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const image = await MedicalImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Medical image not found'
      });
    }
    
    await image.archive();
    
    res.json({
      success: true,
      message: 'Medical image archived successfully'
    });
  } catch (error) {
    console.error('Error deleting medical image:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting medical image',
      error: error.message
    });
  }
});

module.exports = router;
