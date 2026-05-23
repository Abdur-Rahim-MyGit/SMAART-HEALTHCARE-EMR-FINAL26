const express = require("express");
const router = express.Router();
const Nurse = require("../models/Nurse");
const { auth } = require("../middleware/auth");

// GET /api/nurses - Get all nurses
router.get("/", auth, async (req, res) => {
  try {
    const { clinicId: clinicQuery, isActive } = req.query;
    const filter = {};

    // Apply clinic filtering based on user role
    if (req.user.role === "super_master_admin") {
      // Super master admin can view all nurses
      if (clinicQuery) filter.clinicId = clinicQuery;
    } else if (req.user.role === "super_admin") {
      // Super admin can view nurses in their clinic only
      if (clinicQuery) {
        if (clinicQuery !== req.user.clinicId?.toString()) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You can only view nurses for your clinic.",
          });
        }
        filter.clinicId = clinicQuery;
      } else {
        filter.clinicId = req.user.clinicId;
      }
    } else {
      // Other authenticated users: restrict to their clinic
      if (req.user.clinicId) filter.clinicId = req.user.clinicId;
      if (clinicQuery && clinicQuery !== req.user.clinicId?.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view nurses for your clinic.",
        });
      }
    }

    // Filter by active status if provided
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const nurses = await Nurse.find(filter)
      .populate("clinicId", "name address phone")
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: true, nurses, count: nurses.length });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch nurses",
      error: error.message,
    });
  }
});

// GET /api/nurses/:id - Get nurse by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const nurse = await Nurse.findById(req.params.id)
      .populate("clinicId", "name address phone")
      .lean({ virtuals: true });

    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: "Nurse not found",
      });
    }

    // Check if user can view this nurse
    if (
      req.user.role !== "super_master_admin" &&
      nurse.clinicId?.toString() !== req.user.clinicId?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view nurses from your clinic.",
      });
    }

    res.json({ success: true, nurse });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch nurse",
      error: error.message,
    });
  }
});

// POST /api/nurses - Create new nurse
router.post("/", auth, async (req, res) => {
  try {
    // Only super_master_admin and super_admin can create nurses
    if (!["super_master_admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions to create nurses.",
      });
    }

    const nurseData = req.body;

    // If super_admin, restrict to their clinic
    if (req.user.role === "super_admin") {
      nurseData.clinicId = req.user.clinicId;
    }

    const nurse = new Nurse(nurseData);
    await nurse.save();

    const populatedNurse = await Nurse.findById(nurse._id)
      .populate("clinicId", "name address phone")
      .lean({ virtuals: true });

    res.status(201).json({
      success: true,
      message: "Nurse created successfully",
      nurse: populatedNurse,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      res.status(400).json({
        success: false,
        message: `${field} already exists`,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to create nurse",
        error: error.message,
      });
    }
  }
});

// PUT /api/nurses/:id - Update nurse
router.put("/:id", auth, async (req, res) => {
  try {
    const nurse = await Nurse.findById(req.params.id);

    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: "Nurse not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "super_master_admin" &&
      nurse.clinicId?.toString() !== req.user.clinicId?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only update nurses from your clinic.",
      });
    }

    const updatedNurse = await Nurse.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate("clinicId", "name address phone")
      .lean({ virtuals: true });

    res.json({
      success: true,
      message: "Nurse updated successfully",
      nurse: updatedNurse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update nurse",
      error: error.message,
    });
  }
});

// DELETE /api/nurses/:id - Delete nurse (soft delete by setting isActive to false)
router.delete("/:id", auth, async (req, res) => {
  try {
    // Only super_master_admin and super_admin can delete nurses
    if (!["super_master_admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions to delete nurses.",
      });
    }

    const nurse = await Nurse.findById(req.params.id);

    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: "Nurse not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "super_master_admin" &&
      nurse.clinicId?.toString() !== req.user.clinicId?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only delete nurses from your clinic.",
      });
    }

    // Soft delete - set isActive to false
    nurse.isActive = false;
    await nurse.save();

    res.json({
      success: true,
      message: "Nurse deactivated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete nurse",
      error: error.message,
    });
  }
});

// PATCH /api/nurses/:id/activate - Reactivate nurse
router.patch("/:id/activate", auth, async (req, res) => {
  try {
    // Only super_master_admin and super_admin can reactivate nurses
    if (!["super_master_admin", "super_admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions to activate nurses.",
      });
    }

    const nurse = await Nurse.findById(req.params.id);

    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: "Nurse not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "super_master_admin" &&
      nurse.clinicId?.toString() !== req.user.clinicId?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You can only activate nurses from your clinic.",
      });
    }

    nurse.isActive = true;
    await nurse.save();

    res.json({
      success: true,
      message: "Nurse activated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to activate nurse",
      error: error.message,
    });
  }
});

module.exports = router;
