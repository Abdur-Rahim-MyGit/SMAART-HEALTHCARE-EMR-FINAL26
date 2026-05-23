const mongoose = require('mongoose');

const PatientCaseLogSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  
  // Login Tracking
  loginHistory: [{
    loginTime: {
      type: Date,
      default: Date.now
    },
    logoutTime: {
      type: Date
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    deviceInfo: {
      type: String
    },
    sessionDuration: {
      type: Number // in minutes
    },
    loginMethod: {
      type: String,
      enum: ['password', 'otp', 'biometric', 'social'],
      default: 'password'
    }
  }],

  // Current Session Info
  currentSession: {
    isActive: {
      type: Boolean,
      default: false
    },
    lastLoginTime: {
      type: Date
    },
    lastLogoutTime: {
      type: Date
    },
    sessionCount: {
      type: Number,
      default: 0
    },
    totalSessionTime: {
      type: Number,
      default: 0 // in minutes
    }
  },

  // Medical Case Details
  medicalCases: [{
    caseId: {
      type: String,
      unique: true,
      required: true
    },
    caseTitle: {
      type: String,
      required: true
    },
    caseType: {
      type: String,
      enum: ['consultation', 'emergency', 'follow-up', 'surgery', 'therapy', 'diagnostic', 'preventive'],
      required: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed', 'cancelled'],
      default: 'open'
    },
    
    // Medical Details
    symptoms: [{
      symptom: String,
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe']
      },
      duration: String,
      notes: String
    }],
    
    diagnosis: [{
      condition: String,
      icd10Code: String,
      diagnosisDate: Date,
      diagnosedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      confidence: {
        type: String,
        enum: ['suspected', 'probable', 'confirmed']
      },
      notes: String
    }],
    
    treatment: [{
      treatmentType: {
        type: String,
        enum: ['medication', 'surgery', 'therapy', 'lifestyle', 'monitoring']
      },
      description: String,
      startDate: Date,
      endDate: Date,
      prescribedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      dosage: String,
      frequency: String,
      notes: String
    }],
    
    // Case Timeline
    timeline: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      eventType: {
        type: String,
        enum: ['created', 'updated', 'appointment', 'test', 'treatment', 'note', 'resolved']
      },
      description: String,
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      attachments: [{
        fileName: String,
        fileType: String,
        fileSize: Number,
        fileUrl: String,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }]
    }],
    
    // Associated Records
    appointments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    }],
    
    labTests: [{
      testId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LabTest'
      },
      testName: String,
      testDate: Date,
      results: String,
      normalRange: String,
      status: String
    }],
    
    prescriptions: [{
      prescriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription'
      },
      medicationName: String,
      dosage: String,
      frequency: String,
      duration: String,
      prescribedDate: Date
    }],
    
    // Case Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true
    },
    
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    
    // Case Resolution
    resolution: {
      resolvedAt: Date,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      resolutionSummary: String,
      outcome: {
        type: String,
        enum: ['recovered', 'improved', 'stable', 'deteriorated', 'deceased', 'transferred']
      },
      followUpRequired: {
        type: Boolean,
        default: false
      },
      followUpDate: Date,
      followUpNotes: String
    }
  }],

  // Activity Tracking
  activityLog: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      enum: ['login', 'logout', 'view_record', 'update_profile', 'book_appointment', 'cancel_appointment', 'view_reports', 'download_report', 'message_sent', 'payment_made']
    },
    description: String,
    ipAddress: String,
    userAgent: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  }],

  // Medical History Summary
  medicalSummary: {
    chronicConditions: [String],
    allergies: [String],
    currentMedications: [String],
    pastSurgeries: [{
      surgery: String,
      date: Date,
      hospital: String,
      surgeon: String
    }],
    familyHistory: [{
      relation: String,
      condition: String,
      ageOfOnset: Number
    }],
    socialHistory: {
      smoking: {
        status: {
          type: String,
          enum: ['never', 'former', 'current']
        },
        packsPerDay: Number,
        yearsSmoked: Number
      },
      alcohol: {
        status: {
          type: String,
          enum: ['never', 'occasional', 'regular', 'heavy']
        },
        drinksPerWeek: Number
      },
      exercise: {
        frequency: String,
        type: String
      }
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },

  // Privacy and Consent
  privacySettings: {
    dataSharing: {
      type: Boolean,
      default: false
    },
    researchParticipation: {
      type: Boolean,
      default: false
    },
    marketingCommunications: {
      type: Boolean,
      default: false
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
PatientCaseLogSchema.index({ patientId: 1, 'medicalCases.caseId': 1 });
PatientCaseLogSchema.index({ 'medicalCases.status': 1 });
PatientCaseLogSchema.index({ 'medicalCases.priority': 1 });
PatientCaseLogSchema.index({ 'medicalCases.createdAt': -1 });
PatientCaseLogSchema.index({ 'loginHistory.loginTime': -1 });
PatientCaseLogSchema.index({ 'activityLog.timestamp': -1 });

// Virtual for active cases count
PatientCaseLogSchema.virtual('activeCasesCount').get(function() {
  return this.medicalCases.filter(medicalCase => ['open', 'in-progress'].includes(medicalCase.status)).length;
});

// Virtual for total login count
PatientCaseLogSchema.virtual('totalLogins').get(function() {
  return this.loginHistory.length;
});

// Pre-save middleware to update timestamps
PatientCaseLogSchema.pre('save', function(next) {
  if (this.isModified('medicalCases')) {
    this.medicalCases.forEach(medicalCase => {
      if (medicalCase.isModified || medicalCase.isNew) {
        medicalCase.updatedAt = new Date();
      }
    });
  }
  next();
});

// Static methods
PatientCaseLogSchema.statics.findByPatientId = function(patientId) {
  return this.findOne({ patientId }).populate([
    { path: 'patientId', select: 'firstName lastName email phone' },
    { path: 'medicalCases.createdBy', select: 'firstName lastName role' },
    { path: 'medicalCases.assignedTo', select: 'firstName lastName specialization' },
    { path: 'medicalCases.diagnosis.diagnosedBy', select: 'firstName lastName role' },
    { path: 'medicalCases.treatment.prescribedBy', select: 'firstName lastName role' }
  ]);
};

PatientCaseLogSchema.statics.getActiveCases = function(clinicId) {
  return this.find({
    clinicId,
    'medicalCases.status': { $in: ['open', 'in-progress'] }
  }).populate('patientId', 'firstName lastName patientId');
};

// Instance methods
PatientCaseLogSchema.methods.addLoginRecord = function(loginData) {
  this.loginHistory.push(loginData);
  this.currentSession.lastLoginTime = new Date();
  this.currentSession.sessionCount += 1;
  this.currentSession.isActive = true;
  
  // Add activity log entry
  this.activityLog.push({
    action: 'login',
    description: 'Patient logged into the system',
    ipAddress: loginData.ipAddress,
    userAgent: loginData.userAgent
  });
  
  return this.save();
};

PatientCaseLogSchema.methods.addLogoutRecord = function(sessionData) {
  // Update current session
  this.currentSession.isActive = false;
  this.currentSession.lastLogoutTime = new Date();
  
  // Update the latest login record with logout info
  if (this.loginHistory.length > 0) {
    const latestLogin = this.loginHistory[this.loginHistory.length - 1];
    latestLogin.logoutTime = new Date();
    if (sessionData.sessionDuration) {
      latestLogin.sessionDuration = sessionData.sessionDuration;
      this.currentSession.totalSessionTime += sessionData.sessionDuration;
    }
  }
  
  // Add activity log entry
  this.activityLog.push({
    action: 'logout',
    description: 'Patient logged out of the system',
    ipAddress: sessionData.ipAddress
  });
  
  return this.save();
};

PatientCaseLogSchema.methods.createNewCase = function(caseData, createdBy) {
  const caseId = `CASE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const newCase = {
    caseId,
    ...caseData,
    createdBy,
    timeline: [{
      eventType: 'created',
      description: `Case created: ${caseData.caseTitle}`,
      performedBy: createdBy
    }]
  };
  
  this.medicalCases.push(newCase);
  
  // Add activity log entry
  this.activityLog.push({
    action: 'case_created',
    description: `New medical case created: ${caseData.caseTitle}`,
    metadata: { caseId }
  });
  
  return this.save();
};

PatientCaseLogSchema.methods.updateCase = function(caseId, updateData, updatedBy) {
  const caseIndex = this.medicalCases.findIndex(c => c.caseId === caseId);
  if (caseIndex === -1) {
    throw new Error('Case not found');
  }
  
  const medicalCase = this.medicalCases[caseIndex];
  Object.assign(medicalCase, updateData);
  medicalCase.updatedAt = new Date();
  
  // Add timeline entry
  medicalCase.timeline.push({
    eventType: 'updated',
    description: 'Case updated',
    performedBy: updatedBy
  });
  
  // Add activity log entry
  this.activityLog.push({
    action: 'case_updated',
    description: `Medical case updated: ${medicalCase.caseTitle}`,
    metadata: { caseId }
  });
  
  return this.save();
};

module.exports = mongoose.model('PatientCaseLog', PatientCaseLogSchema);
