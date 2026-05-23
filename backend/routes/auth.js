const express = require("express");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const Patient = require("../models/Patient");
const Clinic = require("../models/Clinic");
const PatientCaseLog = require("../models/PatientCaseLog");
const { auth } = require("../middleware/auth");
const {
  sendRegistrationOTP,
  sendPasswordResetOTP,
  sendLoginOTP,
  sendWelcomeEmail,
  testEmailConfig,
} = require("../services/emailService");

const router = express.Router();

// Helper function to track patient login activity
const trackPatientLogin = async (userId, req, loginMethod = "password") => {
  try {
    // Find patient by userId
    const patient = await Patient.findOne({ userId });
    if (!patient) return; // Not a patient, skip tracking

    // Get or create case log
    let caseLog = await PatientCaseLog.findOne({ patientId: patient._id });
    if (!caseLog) {
      caseLog = new PatientCaseLog({
        patientId: patient._id,
        clinicId: patient.clinicId,
        currentSession: {
          isActive: false,
          sessionCount: 0,
          totalSessionTime: 0,
        },
        medicalCases: [],
        loginHistory: [],
        activityLog: [],
        medicalSummary: {
          chronicConditions: [],
          allergies: [],
          currentMedications: [],
          pastSurgeries: [],
          familyHistory: [],
        },
      });
    }

    // Track login
    await caseLog.addLoginRecord({
      loginTime: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      deviceInfo: req.get("User-Agent"),
      loginMethod,
    });

    // Update patient login tracking
    patient.loginTracking = patient.loginTracking || {};
    patient.loginTracking.lastLoginTime = new Date();
    patient.loginTracking.totalLogins =
      (patient.loginTracking.totalLogins || 0) + 1;
    patient.loginTracking.isCurrentlyLoggedIn = true;
    patient.loginTracking.lastActiveDate = new Date();

    // Calculate login streak
    const lastLogin = patient.loginTracking.lastLoginTime;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastLogin && lastLogin.toDateString() === yesterday.toDateString()) {
      patient.loginTracking.loginStreak =
        (patient.loginTracking.loginStreak || 0) + 1;
    } else if (
      !lastLogin ||
      lastLogin.toDateString() !== today.toDateString()
    ) {
      patient.loginTracking.loginStreak = 1;
    }

    await patient.save();

    // Update patient case log reference if not set
    if (!patient.caseLogId) {
      patient.caseLogId = caseLog._id;
      await patient.save();
    }

    console.log(`✅ Patient login tracked for user ${userId}`);
  } catch (error) {
    console.error("❌ Error tracking patient login:", error);
    // Don't throw error to avoid breaking login flow
  }
};

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Register user (with OTP verification)
router.post("/register", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
      clinicId,
      specialization,
      licenseNumber,
      dateOfBirth,
      gender,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !phone || !role) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: firstName, lastName, email, password, phone, role",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    // Create new user with proper clinicId handling
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
      clinicId: role === "super_admin" && clinicId ? clinicId : undefined,
      specialization,
      licenseNumber,
      isVerified: role === "super_master_admin", // Auto-verify super master admin
    });

    await user.save();

    // Create patient record if role is patient
    if (role === "patient") {
      await Patient.create({
        userId: user._id,
        clinicId,
        dateOfBirth,
        gender,
        emergencyContact: req.body.emergencyContact,
      });
    }

    // For super_master_admin, skip OTP and return token immediately
    if (role === "super_master_admin") {
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || "fallback_secret",
        { expiresIn: "7d" }
      );

      return res.status(201).json({
        success: true,
        message: "Super Master Admin registered and logged in successfully",
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          clinicId: user.clinicId,
        },
      });
    }

    // Generate and send OTP for other roles
    const otp = user.generateOTP();
    await user.save();

    // Send OTP email
    try {
      await sendRegistrationOTP(email, otp, firstName);
      console.log(`✅ Registration OTP sent successfully to ${email}`);
    } catch (emailError) {
      console.error(
        "❌ Failed to send registration OTP email:",
        emailError.message
      );
      // Continue with registration even if email fails
    }

    res.status(201).json({
      success: true,
      message:
        "User registered successfully. Please verify your email with the OTP sent to your email address.",
      userId: user._id,
      otp: process.env.NODE_ENV === "development" ? otp : undefined, // Only show OTP in development
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
});

// Create initial Super Master Admin (for testing)
router.post("/create-super-master-admin", async (req, res) => {
  try {
    // Check if Super Master Admin already exists
    const existingSuperMaster = await User.findOne({
      role: "super_master_admin",
    });
    if (existingSuperMaster) {
      return res.status(400).json({
        success: false,
        message: "Super Master Admin already exists",
        email: existingSuperMaster.email,
      });
    }

    // Create Super Master Admin
    const superMasterAdmin = new User({
      firstName: "Super",
      lastName: "Master Admin",
      email: "supermaster@admin.com",
      password: "password123",
      phone: "1234567890",
      role: "super_master_admin",
      isVerified: true,
    });

    await superMasterAdmin.save();

    res.status(201).json({
      success: true,
      message: "Super Master Admin created successfully",
      user: {
        email: superMasterAdmin.email,
        role: superMasterAdmin.role,
      },
    });
  } catch (error) {
    console.error("Super Master Admin creation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create Super Master Admin",
      error: error.message,
    });
  }
});

// Quick register (no OTP verification - for development/testing)
router.post("/quick-register", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
      clinicId,
      specialization,
      licenseNumber,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !phone || !role) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: firstName, lastName, email, password, phone, role",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    // Create new user (already verified)
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
      clinicId: role === "super_admin" && clinicId ? clinicId : undefined,
      specialization,
      licenseNumber,
      isVerified: true, // Skip OTP verification
    });

    await user.save();

    // Create patient record if role is patient
    if (role === "patient") {
      await Patient.create({
        userId: user._id,
        clinicId,
        dateOfBirth: req.body.dateOfBirth,
        gender: req.body.gender,
        emergencyContact: req.body.emergencyContact,
      });
    }

    // Generate token immediately
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "User registered and logged in successfully",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
        specialization: user.specialization,
      },
    });
  } catch (error) {
    console.error("Quick registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.otp !== otp || user.otpExpires < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Send welcome email after successful verification
    try {
      await sendWelcomeEmail(user.email, user.firstName, user.role);
      console.log(`✅ Welcome email sent to ${user.email}`);
    } catch (emailError) {
      console.error("❌ Failed to send welcome email:", emailError.message);
      // Don't fail the verification if welcome email fails
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    res.json({
      success: true,
      message: "Email verified successfully! Welcome to Smaart Healthcare.",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "OTP verification failed",
      error: error.message,
    });
  }
});

// Forgot Password - send OTP to email (supports both user and clinic)
router.post("/forgot-password", async (req, res) => {
  try {
    const { email, type = "user" } = req.body; // Add type parameter
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    let targetEntity = null;
    let entityName = "";
    let otp = "";

    if (type === "clinic") {
      // Handle clinic password reset - check both email and adminEmail fields
      targetEntity = await Clinic.findOne({
        $or: [{ email: email }, { adminEmail: email }],
      });

      if (!targetEntity) {
        console.log(`❌ Clinic not found for email: ${email}`);
        return res.status(404).json({
          success: false,
          message: "Clinic not found with this email address",
        });
      }

      console.log(`✅ Clinic found: ${targetEntity.name} for email: ${email}`);

      // Generate OTP for clinic
      otp = Math.floor(100000 + Math.random() * 900000).toString();
      targetEntity.resetOTP = otp;
      targetEntity.resetOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      entityName = targetEntity.ownerName || targetEntity.name || "Admin";
    } else {
      // Handle user password reset
      targetEntity = await User.findOne({ email });
      if (!targetEntity) {
        console.log(`❌ User not found for email: ${email}`);
        return res.status(404).json({
          success: false,
          message: "User not found with this email address",
        });
      }

      console.log(
        `✅ User found: ${
          targetEntity.fullName || targetEntity.firstName
        } for email: ${email}`
      );

      // Generate OTP for user password reset (using resetOTP fields)
      otp = Math.floor(100000 + Math.random() * 900000).toString();
      targetEntity.resetOTP = otp;
      targetEntity.resetOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      entityName = targetEntity.fullName || targetEntity.firstName || "User";
    }

    await targetEntity.save();

    // Send OTP email using email service
    try {
      await sendPasswordResetOTP(email, otp, entityName);
      console.log(
        `✅ Password reset OTP sent successfully to ${email} (${type})`
      );

      res.json({
        success: true,
        message: `Password reset OTP sent to your email address. Please check your inbox.`,
        type: type, // Return the type for frontend handling
        otp: process.env.NODE_ENV === "development" ? otp : undefined, // Only show OTP in development
      });
    } catch (emailError) {
      console.error(
        "❌ Failed to send password reset OTP email:",
        emailError.message
      );

      // Return error if email sending fails
      res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again later.",
        error: emailError.message,
        otp: process.env.NODE_ENV === "development" ? otp : undefined, // Show OTP in dev even if email fails
      });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
});

// Verify reset OTP (supports both user and clinic)
router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { email, otp, type = "user" } = req.body;

    let targetEntity = null;

    if (type === "clinic") {
      // Handle clinic OTP verification - check both email and adminEmail fields
      targetEntity = await Clinic.findOne({
        $or: [{ email: email }, { adminEmail: email }],
      });
      if (!targetEntity) {
        console.log(`❌ Clinic not found for OTP verification: ${email}`);
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }

      if (
        targetEntity.resetOTP !== otp ||
        !targetEntity.resetOTPExpires ||
        targetEntity.resetOTPExpires < new Date()
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired OTP" });
      }
    } else {
      // Handle user OTP verification
      targetEntity = await User.findOne({ email });
      if (!targetEntity) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      if (
        targetEntity.resetOTP !== otp ||
        !targetEntity.resetOTPExpires ||
        targetEntity.resetOTPExpires < new Date()
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired OTP" });
      }
    }

    res.json({ success: true, message: "OTP verified", type: type });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "OTP verification failed",
      error: error.message,
    });
  }
});

// Reset password (supports both user and clinic)
router.post("/reset-password", async (req, res) => {
  try {
    const { email, password, type = "user" } = req.body;

    let targetEntity = null;

    if (type === "clinic") {
      // Handle clinic password reset - check both email and adminEmail fields
      targetEntity = await Clinic.findOne({
        $or: [{ email: email }, { adminEmail: email }],
      });
      if (!targetEntity) {
        console.log(`❌ Clinic not found for password reset: ${email}`);
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }

      // Ensure OTP previously generated and still valid
      if (
        !targetEntity.resetOTP ||
        !targetEntity.resetOTPExpires ||
        targetEntity.resetOTPExpires < new Date()
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Please request a new OTP" });
      }

      // Update clinic admin password (stored as plain text)
      targetEntity.adminPassword = password;
      targetEntity.resetOTP = undefined;
      targetEntity.resetOTPExpires = undefined;
    } else {
      // Handle user password reset
      targetEntity = await User.findOne({ email });
      if (!targetEntity) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Ensure OTP previously generated and still valid
      if (
        !targetEntity.resetOTP ||
        !targetEntity.resetOTPExpires ||
        targetEntity.resetOTPExpires < new Date()
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Please request a new OTP" });
      }

      // Update user password (will be hashed by the model)
      targetEntity.password = password;
      targetEntity.resetOTP = undefined;
      targetEntity.resetOTPExpires = undefined;
    }

    await targetEntity.save();
    console.log(`✅ Password updated successfully for ${email} (${type})`);

    res.json({
      success: true,
      message: "Password updated successfully",
      type: type,
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({
      success: false,
      message: "Password reset failed",
      error: error.message,
    });
  }
});

// Request OTP for login
router.post("/request-login-otp", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    // Generate 4-digit OTP with shorter expiration for login (5 minutes)
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await user.save();

    // Send login OTP email
    try {
      await sendLoginOTP(email, otp, user.firstName);
      console.log(`✅ Login OTP sent successfully to ${email}`);

      res.json({
        success: true,
        message:
          "Login OTP sent to your email address. Please check your inbox.",
        userId: user._id,
        otp: process.env.NODE_ENV === "development" ? otp : undefined, // Only show OTP in development
      });
    } catch (emailError) {
      console.error("❌ Failed to send login OTP email:", emailError.message);

      // Return error if email sending fails
      res.status(500).json({
        success: false,
        message: "Failed to send login OTP email. Please try again later.",
        error: emailError.message,
        otp: process.env.NODE_ENV === "development" ? otp : undefined, // Show OTP in dev even if email fails
      });
    }
  } catch (error) {
    console.error("Request login OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process login OTP request",
      error: error.message,
    });
  }
});

// Verify OTP and complete login
router.post("/verify-login-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        success: false,
        message: "User ID and OTP are required",
      });
    }

    const user = await User.findById(userId).populate("clinicId");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check OTP
    if (user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Clear OTP
    user.otp = undefined;
    user.otpExpires = undefined;
    user.lastLogin = new Date();
    await user.save();

    // Track patient login activity (if user is a patient)
    await trackPatientLogin(user._id, req, "otp");

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const responseData = {
      success: true,
      message: "Login successful with OTP verification",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
        specialization: user.specialization,
      },
    };

    res.json(responseData);
  } catch (error) {
    console.error("Verify login OTP error:", error);
    res.status(500).json({
      success: false,
      message: "OTP verification failed",
      error: error.message,
    });
  }
});

// Traditional Login (without OTP)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).populate("clinicId");

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res
        .status(400)
        .json({ success: false, message: "Please verify your email first" });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Track patient login activity (if user is a patient)
    await trackPatientLogin(user._id, req, "password");

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const responseData = {
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
        specialization: user.specialization,
      },
    };

    res.json(responseData);
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json({ success: false, message: "Login failed", error: error.message });
  }
});

// Clinic Login
router.post("/clinic-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(`🔐 Clinic login attempt for email: ${email}`);

    // ONLY check clinic collection - never check User collection
    const clinic = await Clinic.findOne({ adminEmail: email });

    if (!clinic) {
      console.log(`❌ No clinic found with admin email: ${email}`);
      return res
        .status(400)
        .json({ success: false, message: "Invalid clinic credentials" });
    }

    console.log(`📋 Found clinic: ${clinic.name}, checking password...`);

    // Check password using the proper comparePassword method
    const isPasswordValid = await clinic.comparePassword(password);

    if (!isPasswordValid) {
      console.log(`❌ Invalid password for clinic: ${clinic.name}`);
      return res
        .status(400)
        .json({ success: false, message: "Invalid clinic credentials" });
    }

    // Check if clinic is active
    if (!clinic.isActive) {
      console.log(`❌ Clinic is inactive: ${clinic.name}`);
      return res
        .status(400)
        .json({ success: false, message: "Clinic account is inactive" });
    }

    // Check if clinic is expired
    if (clinic.isExpired && clinic.isExpired()) {
      console.log(`❌ Clinic validity expired: ${clinic.name}`);
      return res.status(400).json({
        success: false,
        message: "Clinic validity has expired. Please contact administrator.",
      });
    }

    console.log(`✅ Clinic login successful: ${clinic.name}`);

    // Generate token for clinic with clear type identification
    const token = jwt.sign(
      {
        clinicId: clinic._id,
        type: "clinic",
        email: clinic.adminEmail,
        role: "clinic_admin",
      },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const responseData = {
      success: true,
      message: "Clinic login successful",
      token,
      clinic: {
        id: clinic._id,
        name: clinic.name,
        email: clinic.adminEmail,
        role: "clinic_admin",
        clinicId: clinic._id,
        adminUsername: clinic.adminUsername,
        adminName: clinic.adminName,
        type: "clinic",
      },
    };

    res.json(responseData);
  } catch (error) {
    console.error("Clinic login error:", error);
    res.status(500).json({
      success: false,
      message: "Clinic login failed",
      error: error.message,
    });
  }
});

// Test email configuration
router.get("/test-email", async (req, res) => {
  try {
    const result = await testEmailConfig();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Email configuration test failed",
      error: error.message,
    });
  }
});

// Send test OTP email (for development/testing)
router.post("/send-test-otp", async (req, res) => {
  try {
    const { email, type = "registration" } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const testOTP = Math.floor(100000 + Math.random() * 900000).toString();

    let result;
    if (type === "password_reset") {
      result = await sendPasswordResetOTP(email, testOTP, "Test User");
    } else if (type === "login") {
      result = await sendLoginOTP(email, testOTP, "Test User");
    } else {
      result = await sendRegistrationOTP(email, testOTP, "Test User");
    }

    res.json({
      success: true,
      message: `Test ${type} OTP email sent successfully`,
      otp: testOTP, // For testing purposes
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send test email",
      error: error.message,
    });
  }
});

// Get current user
router.get("/me", auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
        clinicId: req.user.clinicId,
        specialization: req.user.specialization,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get user data",
      error: error.message,
    });
  }
});

module.exports = router;
