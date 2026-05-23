const express = require("express");
const Billing = require("../models/Billing");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Get bills
router.get("/", auth, async (req, res) => {
  try {
    const filter = {};

    if (req.user.role !== "super_master_admin") {
      filter.clinicId = req.user.clinicId;
    }

    const bills = await Billing.find(filter)
      .populate("patientId", "patientId userId")
      .populate("appointmentId", "appointmentId")
      .populate("clinicId", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, bills });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch bills",
        error: error.message,
      });
  }
});

// Create bill
router.post("/", auth, async (req, res) => {
  try {
    const bill = new Billing({
      ...req.body,
      clinicId: req.user.clinicId,
    });

    await bill.save();

    const populatedBill = await Billing.findById(bill._id)
      .populate("patientId", "patientId userId")
      .populate("appointmentId", "appointmentId")
      .populate("clinicId", "name");

    res.status(201).json({
      success: true,
      message: "Bill created successfully",
      bill: populatedBill,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to create bill",
        error: error.message,
      });
  }
});

// Update bill
router.put("/:id", auth, async (req, res) => {
  try {
    const updatedBill = await Billing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate("patientId", "patientId userId")
      .populate("appointmentId", "appointmentId")
      .populate("clinicId", "name");

    if (!updatedBill) {
      return res
        .status(404)
        .json({ success: false, message: "Bill not found" });
    }

    res.json({
      success: true,
      message: "Bill updated successfully",
      bill: updatedBill,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to update bill",
        error: error.message,
      });
  }
});

module.exports = router;
