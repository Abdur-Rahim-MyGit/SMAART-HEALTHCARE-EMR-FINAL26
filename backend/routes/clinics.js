const express = require("express");
const Clinic = require("../models/Clinic");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Nurse = require("../models/Nurse");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// Get all clinics
router.get("/", auth, async (req, res) => {
  try {
    let clinics;
    
    // Super master admin can see all clinics
    if (req.user.role === "super_master_admin") {
      clinics = await Clinic.find().sort({ createdAt: -1 });
    } 
    // Clinic admin can only see their own clinic
    else if (req.user.role === "clinic_admin" && req.user.clinicId) {
      const clinic = await Clinic.findById(req.user.clinicId);
      clinics = clinic ? [clinic] : [];
    }
    // Other roles get empty array
    else {
      clinics = [];
    }

    res.json({ success: true, clinics });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinics",
      error: error.message,
    });
  }
});

// Get clinic by ID
router.get("/:id", auth, async (req, res) => {
  try {
    console.log("📋 Fetching clinic:", req.params.id);
    const clinic = await Clinic.findById(req.params.id);

    if (!clinic) {
      console.log("❌ Clinic not found:", req.params.id);
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
    }

    console.log("✅ Clinic fetched successfully:", {
      id: clinic._id,
      name: clinic.name,
      additionalUsersCount: clinic.additionalUsers?.length || 0,
      hasValidityPeriod: !!clinic.validityPeriod,
    });

    res.json({ success: true, clinic });
  } catch (error) {
    console.error("❌ Error fetching clinic:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinic",
      error: error.message,
    });
  }
});

// Create new clinic
router.post("/", auth, authorize("super_master_admin"), async (req, res) => {
  console.log("User making request:", req.user);
  console.log("User role:", req.user?.role);
  try {
    console.log("Received clinic creation request:", req.body);

    const {
      adminUsername,
      adminPassword,
      adminContact,
      adminEmail,
      validityPeriod,
      gstNumber,
      panNumber,
      tanNumber,
      bankAccountNumber,
      additionalUsers,
      complianceDocuments,
      services,
      specialties,
      ...clinicData
    } = req.body;

    // Validate required fields
    if (!adminUsername || !adminPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Admin credentials are required (adminUsername, adminPassword)",
      });
    }

    // Check for duplicate clinic admin email (if provided)
    if (adminEmail) {
      const existingClinic = await Clinic.findOne({ adminEmail });
      if (existingClinic) {
        return res.status(400).json({
          success: false,
          message: "A clinic with this admin email already exists",
        });
      }
    }

    // Prepare validity period data
    let startDate, endDate, validityDuration;
    
    if (validityPeriod) {
      startDate = validityPeriod.startDate ? new Date(validityPeriod.startDate) : new Date();
      endDate = validityPeriod.endDate ? new Date(validityPeriod.endDate) : null;
      validityDuration = validityPeriod.duration ? parseInt(validityPeriod.duration) : null;
    } else {
      startDate = new Date();
      endDate = null;
      validityDuration = null;
    }

    // Calculate end date if not provided
    if (!endDate && validityDuration) {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + validityDuration);
    } else if (!endDate) {
      // Default to 1 year from start date
      endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Calculate duration if not provided
    if (!validityDuration) {
      const diffTime = Math.abs(endDate - startDate);
      validityDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
    }

    // Validate minimum 1 year duration
    const oneYearFromStart = new Date(startDate);
    oneYearFromStart.setFullYear(oneYearFromStart.getFullYear() + 1);

    if (endDate < oneYearFromStart) {
      return res.status(400).json({
        success: false,
        message:
          "Clinic validity period must be at least 1 year from start date",
      });
    }

    // Create clinic first
    const clinic = new Clinic({
      ...clinicData,
      // Default adminName to adminUsername or ownerName if not provided
      adminName: clinicData.adminName || adminUsername || clinicData.ownerName || "Admin",
      adminUsername: adminUsername,
      adminPassword: adminPassword,
      adminContact: adminContact || clinicData.phone || "",
      adminEmail: adminEmail || clinicData.email || "",
      // Services & Specialties
      services: services || [],
      specialties: specialties || [],
      // Legal & Compliance Fields
      gstNumber: gstNumber || "",
      panNumber: panNumber || "",
      tanNumber: tanNumber || "",
      bankAccountNumber: bankAccountNumber || "",
      // Additional Users (if provided)
      additionalUsers: additionalUsers || [],
      validityPeriod: {
        startDate: startDate,
        endDate: endDate,
        duration: validityDuration,
        isExpired: false,
      },
    });

    await clinic.save();

    res.status(201).json({
      success: true,
      message: "Clinic created successfully",
      clinic: clinic,
    });
  } catch (error) {
    console.error("Clinic creation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create clinic",
      error: error.message,
    });
  }
});

// Update clinic
router.put("/:id", auth, async (req, res) => {
  try {
    console.log("🔄 Clinic update request:", {
      clinicId: req.params.id,
      userId: req.user?.id,
      userRole: req.user?.role,
      bodyKeys: Object.keys(req.body),
      additionalUsersCount: req.body.additionalUsers?.length || 0,
    });

    const clinic = await Clinic.findById(req.params.id);
    if (!clinic) {
      console.log("❌ Clinic not found:", req.params.id);
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
    }

    // Check permissions - allow clinic users to edit their own clinic
    const userCanEdit =
      req.user.role === "super_master_admin" || // Super master admin can edit any clinic
      (req.user.role === "super_admin" &&
        clinic._id.toString() === req.user.clinicId?.toString()) || // Super admin can edit their own clinic
      (req.user.role === "clinic_admin" &&
        req.user.type === "clinic" &&
        clinic._id.toString() === req.user.clinicId?.toString()); // Clinic admin/user can edit their own clinic

    if (!userCanEdit) {
      console.log("❌ Access denied:", {
        userRole: req.user.role,
        userType: req.user.type,
        userClinicId: req.user.clinicId?.toString(),
        targetClinicId: clinic._id.toString(),
      });
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied - insufficient permissions",
        });
    }

    // Log the update data
    console.log("📝 Updating clinic with data:", {
      name: req.body.name,
      additionalUsers: req.body.additionalUsers?.map((u) => ({
        name: u.name,
        email: u.email,
      })),
    });

    // Handle validity period update if provided
    if (req.body.validityPeriod) {
      const { startDate, endDate, duration } = req.body.validityPeriod;

      // Ensure validityPeriod has proper structure with Date objects
      if (startDate) {
        req.body.validityPeriod.startDate = new Date(startDate);
      }
      if (endDate) {
        req.body.validityPeriod.endDate = new Date(endDate);
      }
      if (duration) {
        req.body.validityPeriod.duration = parseInt(duration);
      }

      // Validate validity period only if both dates are provided
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const oneYearFromStart = new Date(start);
        oneYearFromStart.setFullYear(oneYearFromStart.getFullYear() + 1);

        if (end < oneYearFromStart) {
          return res.status(400).json({
            success: false,
            message:
              "Clinic validity period must be at least 1 year from start date",
          });
        }

        // Calculate duration in months if not provided
        if (!duration) {
          const diffTime = Math.abs(end - start);
          req.body.validityPeriod.duration = Math.ceil(
            diffTime / (1000 * 60 * 60 * 24 * 30.44)
          );
        }
      }
    }

    // Clean the additionalUsers data - remove invalid _id fields
    const cleanedData = { ...req.body };
    if (cleanedData.additionalUsers) {
      cleanedData.additionalUsers = cleanedData.additionalUsers.map((user) => {
        const cleanUser = { ...user };
        // Remove _id if it's not a valid MongoDB ObjectId
        if (
          cleanUser._id &&
          (typeof cleanUser._id === "number" ||
            !/^[0-9a-fA-F]{24}$/.test(cleanUser._id))
        ) {
          delete cleanUser._id;
        }
        return cleanUser;
      });
    }

    // Update clinic without strict validators to avoid schema validation issues
    const updatedClinic = await Clinic.findByIdAndUpdate(
      req.params.id,
      cleanedData,
      { new: true, runValidators: false }
    );

    if (!updatedClinic) {
      console.log("❌ Clinic not found after update:", req.params.id);
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
    }
    console.log("✅ Clinic updated successfully");
    res.json({
      success: true,
      message: "Clinic updated successfully",
      clinic: updatedClinic,
    });
  } catch (error) {
    console.error("❌ Clinic update error:", error);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
    });

    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      console.error("Validation errors:", validationErrors);
      
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update clinic",
      error: error.message,
    });
  }
});

// Delete clinic
router.delete(
  "/:id",
  auth,
  authorize("super_master_admin"),
  async (req, res) => {
    try {
      const clinic = await Clinic.findById(req.params.id);
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }

      await Clinic.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: "Clinic deleted successfully" });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to delete clinic",
        error: error.message,
      });
    }
  }
);

// Get clinic-specific data (patients, doctors, nurses)
router.get("/:id/dashboard-data", auth, async (req, res) => {
  try {
    const clinicId = req.params.id;

    // Check if user has access to this clinic
    if (
      req.user.type === "clinic" &&
      req.user.clinicId.toString() !== clinicId
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied to this clinic data" });
    }

    if (
      req.user.role === "super_admin" &&
      req.user.clinicId.toString() !== clinicId
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied to this clinic data" });
    }

    if (
      req.user.role === "clinic_admin" &&
      req.user.clinicId.toString() !== clinicId
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied to this clinic data" });
    }

    // Get clinic info
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
    }

    // Get patients for this clinic
    const patients = await require("../models/Patient")
      .find({ clinicId })
      .select("fullName dateOfBirth gender modeOfCare bloodType createdAt")
      .sort({ createdAt: -1 })
      .limit(10);

    // Get doctors for this clinic
    const doctors = await Doctor.find({
      clinicId,
      isActive: { $ne: false },
    })
      .select("fullName firstName lastName email phone specialty specialization createdAt")
      .sort({ createdAt: -1 });

    // Get nurses for this clinic
    const nurses = await Nurse.find({
      clinicId,
      isActive: { $ne: false },
    })
      .select("fullName firstName lastName email phone department createdAt")
      .sort({ createdAt: -1 });

    // Get total counts
    const totalPatients = await require("../models/Patient").countDocuments({
      clinicId,
    });
    const totalDoctors = await Doctor.countDocuments({
      clinicId,
      isActive: { $ne: false },
    });
    const totalNurses = await Nurse.countDocuments({
      clinicId,
      isActive: { $ne: false },
    });
    const totalStaff = totalDoctors + totalNurses;

    // Get recent appointments (if appointments model exists)
    let todayAppointments = 0;
    try {
      const Appointment = require("../models/Appointment");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      todayAppointments = await Appointment.countDocuments({
        clinicId,
        appointmentDate: { $gte: today, $lt: tomorrow },
      });
    } catch (error) {
      console.log("Appointments model not found or error:", error.message);
    }

    res.json({
      success: true,
      data: {
        clinic: {
          id: clinic._id,
          name: clinic.name,
          adminEmail: clinic.adminEmail,
          phone: clinic.phone,
          address: clinic.address,
          city: clinic.city,
          state: clinic.state,
        },
        stats: {
          totalPatients,
          totalDoctors,
          totalNurses,
          totalStaff,
          todayAppointments,
        },
        patients: patients.map((p) => ({
          id: p._id,
          name: p.fullName,
          age: new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear(),
          gender: p.gender,
          bloodType: p.bloodType,
          modeOfCare: p.modeOfCare,
          registeredDate: p.createdAt,
        })),
        doctors: doctors.map((d) => ({
          id: d._id,
          name: d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim(),
          email: d.email,
          phone: d.phone,
          specialization: d.specialty || d.specialization,
          joinedDate: d.createdAt,
        })),
        nurses: nurses.map((n) => ({
          id: n._id,
          name: n.fullName || `${n.firstName || ''} ${n.lastName || ''}`.trim(),
          email: n.email,
          phone: n.phone,
          department: n.department,
          joinedDate: n.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching clinic dashboard data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinic data",
      error: error.message,
    });
  }
});

// Get clinics expiring soon
router.get(
  "/expiring/:days?",
  auth,
  authorize("super_master_admin"),
  async (req, res) => {
    try {
      const days = parseInt(req.params.days) || 30;
      const expiringSoon = await Clinic.findExpiringSoon(days).sort({
        "validityPeriod.endDate": 1,
      });

      res.json({
        success: true,
        clinics: expiringSoon,
        count: expiringSoon.length,
        daysFilter: days,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch expiring clinics",
        error: error.message,
      });
    }
  }
);

// Get expired clinics
router.get(
  "/expired/list",
  auth,
  authorize("super_master_admin"),
  async (req, res) => {
    try {
      const expired = await Clinic.findExpired().sort({
        "validityPeriod.endDate": -1,
      });

      res.json({
        success: true,
        clinics: expired,
        count: expired.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch expired clinics",
        error: error.message,
      });
    }
  }
);

// Renew clinic validity
router.put(
  "/:id/renew",
  auth,
  authorize("super_master_admin"),
  async (req, res) => {
    try {
      const { newEndDate, renewalReason, durationMonths } = req.body;
      const clinic = await Clinic.findById(req.params.id);

      if (!clinic) {
        return res.status(404).json({
          success: false,
          message: "Clinic not found",
        });
      }

      let endDate;
      if (newEndDate) {
        endDate = new Date(newEndDate);
      } else if (durationMonths) {
        endDate = new Date();
        endDate.setMonth(endDate.getMonth() + parseInt(durationMonths));
      } else {
        // Default to 1 year extension
        endDate = new Date(clinic.validityPeriod.endDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Validate minimum extension
      const currentEnd = new Date(clinic.validityPeriod.endDate);
      const minExtension = new Date(currentEnd);
      minExtension.setMonth(minExtension.getMonth() + 12);

      if (endDate < minExtension) {
        return res.status(400).json({
          success: false,
          message: "Renewal must extend validity by at least 12 months",
        });
      }

      const renewed = clinic.renewValidity(
        endDate,
        req.user._id,
        renewalReason
      );

      if (!renewed) {
        return res.status(400).json({
          success: false,
          message: "Failed to renew clinic validity",
        });
      }

      await clinic.save();

      const updatedClinic = await Clinic.findById(clinic._id);

      res.json({
        success: true,
        message: "Clinic validity renewed successfully",
        clinic: updatedClinic,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to renew clinic validity",
        error: error.message,
      });
    }
  }
);

// Get clinic validity status
router.get("/:id/validity", auth, async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id);

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    // Check authorization
    if (
      req.user.role !== "super_master_admin" &&
      req.user.role !== "super_admin" &&
      req.user.clinicId?.toString() !== clinic._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const validityInfo = {
      startDate: clinic.validityPeriod.startDate,
      endDate: clinic.validityPeriod.endDate,
      duration: clinic.validityPeriod.duration,
      isExpired: clinic.isExpired(),
      daysUntilExpiry: clinic.getDaysUntilExpiry(),
      renewalHistory: clinic.validityPeriod.renewalHistory,
    };

    res.json({
      success: true,
      validity: validityInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch clinic validity",
      error: error.message,
    });
  }
});

// Add additional user to clinic
router.post(
  "/:id/users",
  auth,
  authorize("super_master_admin", "super_admin"),
  async (req, res) => {
    try {
      const clinic = await Clinic.findById(req.params.id);
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }

      // Check permissions for super_admin
      if (
        req.user.role === "super_admin" &&
        clinic._id.toString() !== req.user.clinicId.toString()
      ) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      const { name, phone, email, password } = req.body;

      if (!name || !phone || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "All fields are required (name, phone, email, password)",
        });
      }

      // Check if email already exists in additional users
      const existingUser = clinic.additionalUsers.find(
        (user) => user.email === email
      );
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "A user with this email already exists",
        });
      }

      const newUser = {
        name,
        phone,
        email,
        password,
        role: "user",
        isActive: true,
      };

      clinic.additionalUsers.push(newUser);
      await clinic.save();

      res.status(201).json({
        success: true,
        message: "Additional user added successfully",
        user: clinic.additionalUsers[clinic.additionalUsers.length - 1],
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to add additional user",
        error: error.message,
      });
    }
  }
);

// Get additional users for a clinic
router.get(
  "/:id/users",
  auth,
  authorize("super_master_admin", "super_admin"),
  async (req, res) => {
    try {
      const clinic = await Clinic.findById(req.params.id);
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }

      // Check permissions for super_admin
      if (
        req.user.role === "super_admin" &&
        clinic._id.toString() !== req.user.clinicId.toString()
      ) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      res.json({
        success: true,
        users: clinic.additionalUsers,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch additional users",
        error: error.message,
      });
    }
  }
);

// Update additional user
router.put(
  "/:id/users/:userId",
  auth,
  authorize("super_master_admin", "super_admin"),
  async (req, res) => {
    try {
      const clinic = await Clinic.findById(req.params.id);
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }

      // Check permissions for super_admin
      if (
        req.user.role === "super_admin" &&
        clinic._id.toString() !== req.user.clinicId.toString()
      ) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      const userIndex = clinic.additionalUsers.findIndex(
        (user) => user._id.toString() === req.params.userId
      );
      if (userIndex === -1) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const { name, phone, email, password, isActive } = req.body;

      // Check if email already exists in other users
      const existingUser = clinic.additionalUsers.find(
        (user, index) => user.email === email && index !== userIndex
      );
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "A user with this email already exists",
        });
      }

      // Update user fields
      if (name) clinic.additionalUsers[userIndex].name = name;
      if (phone) clinic.additionalUsers[userIndex].phone = phone;
      if (email) clinic.additionalUsers[userIndex].email = email;
      if (password) clinic.additionalUsers[userIndex].password = password;
      if (typeof isActive === "boolean")
        clinic.additionalUsers[userIndex].isActive = isActive;

      await clinic.save();

      res.json({
        success: true,
        message: "User updated successfully",
        user: clinic.additionalUsers[userIndex],
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to update user",
        error: error.message,
      });
    }
  }
);

// Delete additional user
router.delete(
  "/:id/users/:userId",
  auth,
  authorize("super_master_admin", "super_admin"),
  async (req, res) => {
    try {
      const clinic = await Clinic.findById(req.params.id);
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }

      // Check permissions for super_admin
      if (
        req.user.role === "super_admin" &&
        clinic._id.toString() !== req.user.clinicId.toString()
      ) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      const userIndex = clinic.additionalUsers.findIndex(
        (user) => user._id.toString() === req.params.userId
      );
      if (userIndex === -1) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      clinic.additionalUsers.splice(userIndex, 1);
      await clinic.save();

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to delete user",
        error: error.message,
      });
    }
  }
);

// Test endpoint for debugging clinic data structure
router.get("/:id/debug", auth, async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id);

    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
    }

    // Return detailed clinic structure for debugging
    const debugInfo = {
      _id: clinic._id,
      name: clinic.name,
      type: clinic.type,
      hasValidityPeriod: !!clinic.validityPeriod,
      validityPeriod: clinic.validityPeriod,
      additionalUsersCount: clinic.additionalUsers?.length || 0,
      additionalUsers:
        clinic.additionalUsers?.map((user) => ({
          _id: user._id,
          name: user.name,
          email: user.email,
          hasPassword: !!user.password,
          isActive: user.isActive,
        })) || [],
      hasSpecialties: !!clinic.specialties,
      specialtiesCount: clinic.specialties?.length || 0,
      hasServices: !!clinic.services,
      servicesCount: clinic.services?.length || 0,
      createdAt: clinic.createdAt,
      updatedAt: clinic.updatedAt,
    };

    res.json({
      success: true,
      debug: debugInfo,
      fullClinic: clinic,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to debug clinic",
      error: error.message,
    });
  }
});

module.exports = router;
