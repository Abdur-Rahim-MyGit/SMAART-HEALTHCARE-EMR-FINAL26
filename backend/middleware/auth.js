const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Clinic = require('../models/Clinic');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's a clinic token
    if (decoded.type === 'clinic' && decoded.clinicId) {
      const clinic = await Clinic.findById(decoded.clinicId);
      if (!clinic) {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
      }
      
      // Create a user-like object for clinic
      req.user = {
        _id: clinic._id,
        id: clinic._id,
        name: clinic.name,
        email: clinic.adminEmail,
        role: 'clinic_admin',
        clinicId: clinic._id,
        adminUsername: clinic.adminUsername,
        type: 'clinic'
      };
      return next();
    }
    
    // Handle regular user token
    const user = await User.findById(decoded.userId).populate('clinicId');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('Authorization check - Required roles:', roles);
    console.log('User role:', req.user?.role);
    if (!roles.includes(req.user.role)) {
      console.log('Authorization failed - insufficient permissions');
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user?.role}` 
      });
    }
    console.log('Authorization successful');
    next();
  };
};

// Clinic-specific authorization for Super Admins
const authorizeClinic = (req, res, next) => {
  // Super Master Admin has access to all clinics
  if (req.user.role === 'super_master_admin') {
    return next();
  }
  
  // Super Admin can only access their own clinic
  if (req.user.role === 'super_admin') {
    const requestedClinicId = req.params.clinicId || req.body.clinicId || req.query.clinicId;
    
    if (requestedClinicId && requestedClinicId !== req.user.clinicId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only manage your own clinic.'
      });
    }
    return next();
  }
  
  // Other roles need specific clinic access validation
  next();
};

module.exports = { auth, authorize, authorizeClinic };