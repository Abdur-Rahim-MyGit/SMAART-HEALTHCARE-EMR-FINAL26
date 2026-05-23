const express = require('express');
const User = require('../models/User');
const { auth, authorize, authorizeClinic } = require('../middleware/auth');

const router = express.Router();

// Test endpoint to check doctors without auth (temporary for debugging)
router.get('/test-doctors', async (req, res) => {
  try {
    console.log('Fetching doctors for testing...');
    
    // First, let's check all users to see what's in the database
    const allUsers = await User.find({}).select('role fullName firstName lastName email');
    console.log('All users in database:', allUsers.length);
    console.log('User roles:', allUsers.map(u => ({ role: u.role, name: u.fullName || u.firstName + ' ' + u.lastName })));
    
    const doctors = await User.find({ role: 'doctor' })
      .populate('clinicId', 'name')
      .select('-password -otp -otpExpires')
      .sort({ createdAt: -1 });

    console.log('Found doctors:', doctors.length);
    if (doctors.length > 0) {
      console.log('Sample doctor data:', doctors[0]);
    }

    res.json({ 
      success: true, 
      count: doctors.length,
      doctors: doctors,
      sampleDoctor: doctors[0], // Include sample for debugging
      allUsersCount: allUsers.length,
      userRoles: allUsers.map(u => u.role)
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch doctors', 
      error: error.message 
    });
  }
});

// Get all users (admin only)
router.get('/', auth, authorize('super_master_admin', 'super_admin', 'clinic_admin'), authorizeClinic, async (req, res) => {
  try {
    const { role, clinicId } = req.query;
    const filter = {};
    
    console.log('Users API - Query params:', { role, clinicId });
    console.log('Users API - User role:', req.user.role);
    console.log('Users API - User clinicId:', req.user.clinicId);
    
    if (role) filter.role = role;
    
    // Super Admin and Clinic Admin can only see users from their clinic
    if (req.user.role === 'super_admin' || req.user.role === 'clinic_admin') {
      if (req.user.clinicId) {
        filter.clinicId = req.user.clinicId;
      }
    } else if (clinicId) {
      filter.clinicId = clinicId;
    }
    // For super_master_admin, don't add clinicId filter to see all users

    console.log('Users API - Filter:', filter);

    const users = await User.find(filter)
      .populate('clinicId', 'name')
      .select('-password -otp -otpExpires')
      .sort({ createdAt: -1 });

    console.log('Users API - Found users:', users.length);
    if (users.length > 0) {
      console.log('Users API - Sample user:', users[0]);
    }

    res.json({ success: true, users, count: users.length });
  } catch (error) {
    console.error('Users API - Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('clinicId', 'name')
      .select('-password -otp -otpExpires');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user', error: error.message });
  }
});

// Update user
router.put('/:id', auth, async (req, res) => {
  try {
    const { firstName, lastName, phone, specialization, licenseNumber, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check permissions
    if (req.user.role === 'super_admin' && user.clinicId.toString() !== req.user.clinicId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { firstName, lastName, phone, specialization, licenseNumber, isActive },
      { new: true, runValidators: true }
    ).populate('clinicId', 'name').select('-password -otp -otpExpires');

    res.json({ success: true, message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
});

// Delete user
router.delete('/:id', auth, authorize('super_master_admin', 'super_admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check permissions
    if (req.user.role === 'super_admin' && user.clinicId.toString() !== req.user.clinicId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
});

module.exports = router;