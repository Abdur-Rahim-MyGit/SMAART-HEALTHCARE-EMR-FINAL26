const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Medication name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  
  // Generic and Brand Names
  genericName: {
    type: String,
    trim: true,
    maxlength: [200, 'Generic name cannot exceed 200 characters']
  },
  
  brandName: {
    type: String,
    trim: true,
    maxlength: [200, 'Brand name cannot exceed 200 characters']
  },
  
  // Classification
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Pain Relief',
      'Antibiotic',
      'Diabetes',
      'Cardiovascular',
      'Gastrointestinal',
      'Respiratory',
      'Neurological',
      'Dermatological',
      'Ophthalmological',
      'Orthopedic',
      'Psychiatric',
      'Oncology',
      'Immunology',
      'Endocrine',
      'Hematology',
      'Nephrology',
      'Urology',
      'Gynecology',
      'Pediatric',
      'Geriatric',
      'Emergency',
      'Anesthesia',
      'Vitamins & Supplements',
      'Vaccines',
      'Other'
    ],
    default: 'Other'
  },
  
  // Dosage Information
  strength: {
    type: String,
    required: [true, 'Strength is required'],
    trim: true
  },
  
  dosageForm: {
    type: String,
    required: [true, 'Dosage form is required'],
    enum: [
      'Tablet',
      'Capsule',
      'Syrup',
      'Injection',
      'Cream',
      'Ointment',
      'Drops',
      'Inhaler',
      'Patch',
      'Suppository',
      'Powder',
      'Solution',
      'Suspension',
      'Gel',
      'Lotion',
      'Spray',
      'Other'
    ],
    default: 'Tablet'
  },
  
  // Stock Management
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  
  minStock: {
    type: Number,
    required: [true, 'Minimum stock level is required'],
    min: [0, 'Minimum stock cannot be negative'],
    default: 10
  },
  
  maxStock: {
    type: Number,
    min: [0, 'Maximum stock cannot be negative'],
    default: 1000
  },
  
  // Pricing
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  
  costPrice: {
    type: Number,
    min: [0, 'Cost price cannot be negative']
  },
  
  // Supplier Information
  supplier: {
    type: String,
    required: [true, 'Supplier is required'],
    trim: true,
    maxlength: [200, 'Supplier name cannot exceed 200 characters']
  },
  
  supplierContact: {
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  
  // Dates
  manufacturingDate: {
    type: Date
  },
  
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required']
  },
  
  // Batch Information
  batchNumber: {
    type: String,
    trim: true,
    maxlength: [100, 'Batch number cannot exceed 100 characters']
  },
  
  // Storage Requirements
  storageConditions: {
    type: String,
    enum: [
      'Room Temperature',
      'Refrigerated (2-8°C)',
      'Frozen (-20°C)',
      'Cool & Dry Place',
      'Protect from Light',
      'Controlled Room Temperature',
      'Other'
    ],
    default: 'Room Temperature'
  },
  
  // Regulatory Information
  drugLicenseNumber: {
    type: String,
    trim: true
  },
  
  scheduledDrug: {
    type: Boolean,
    default: false
  },
  
  prescriptionRequired: {
    type: Boolean,
    default: true
  },
  
  // Clinical Information
  activeIngredient: {
    type: String,
    trim: true
  },
  
  contraindications: {
    type: String,
    trim: true
  },
  
  sideEffects: {
    type: String,
    trim: true
  },
  
  interactions: {
    type: String,
    trim: true
  },
  
  // Status and Flags
  status: {
    type: String,
    enum: ['inStock', 'lowStock', 'outOfStock', 'expiringSoon', 'expired', 'discontinued'],
    default: 'inStock'
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  isDiscontinued: {
    type: Boolean,
    default: false
  },
  
  // Clinic Reference
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  
  // Audit Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // System Fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
medicationSchema.index({ name: 1 });
medicationSchema.index({ category: 1 });
medicationSchema.index({ supplier: 1 });
medicationSchema.index({ status: 1 });
medicationSchema.index({ expiryDate: 1 });
medicationSchema.index({ clinicId: 1 });
medicationSchema.index({ isActive: 1 });
medicationSchema.index({ createdAt: -1 });

// Compound indexes
medicationSchema.index({ clinicId: 1, status: 1 });
medicationSchema.index({ clinicId: 1, category: 1 });
medicationSchema.index({ clinicId: 1, expiryDate: 1 });

// Virtual for total value
medicationSchema.virtual('totalValue').get(function() {
  return this.stock * this.price;
});

// Virtual for stock status
medicationSchema.virtual('stockStatus').get(function() {
  if (this.stock === 0) return 'outOfStock';
  if (this.stock <= this.minStock) return 'lowStock';
  return 'inStock';
});

// Virtual for expiry status
medicationSchema.virtual('expiryStatus').get(function() {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  if (this.expiryDate <= now) return 'expired';
  if (this.expiryDate <= thirtyDaysFromNow) return 'expiringSoon';
  return 'valid';
});

// Pre-save middleware to update status
medicationSchema.pre('save', function(next) {
  // Update stock status
  if (this.stock === 0) {
    this.status = 'outOfStock';
  } else if (this.stock <= this.minStock) {
    this.status = 'lowStock';
  } else {
    // Check expiry status
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    if (this.expiryDate <= now) {
      this.status = 'expired';
    } else if (this.expiryDate <= thirtyDaysFromNow) {
      this.status = 'expiringSoon';
    } else {
      this.status = 'inStock';
    }
  }
  
  this.updatedAt = new Date();
  next();
});

// Static methods
medicationSchema.statics.findByClinic = function(clinicId) {
  return this.find({ clinicId, isActive: true });
};

medicationSchema.statics.findLowStock = function(clinicId) {
  return this.find({ 
    clinicId, 
    isActive: true,
    $expr: { $lte: ['$stock', '$minStock'] }
  });
};

medicationSchema.statics.findExpiringSoon = function(clinicId, days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    clinicId,
    isActive: true,
    expiryDate: { $lte: futureDate, $gt: new Date() }
  });
};

medicationSchema.statics.findByCategory = function(clinicId, category) {
  return this.find({ clinicId, category, isActive: true });
};

// Instance methods
medicationSchema.methods.updateStock = function(quantity, operation = 'set') {
  if (operation === 'add') {
    this.stock += quantity;
  } else if (operation === 'subtract') {
    this.stock = Math.max(0, this.stock - quantity);
  } else {
    this.stock = Math.max(0, quantity);
  }
  
  return this.save();
};

medicationSchema.methods.checkExpiry = function() {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  if (this.expiryDate <= now) return 'expired';
  if (this.expiryDate <= thirtyDaysFromNow) return 'expiringSoon';
  return 'valid';
};

module.exports = mongoose.model('Medication', medicationSchema);
