const express = require("express");
const Appointment = require("../models/Appointment");
const Patient = require("../models/Patient");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Get appointments
router.get("/", auth, async (req, res) => {
  try {
    const { date, doctorId, patientId, status } = req.query;
    const filter = {};

    // Role-based filtering
    if (req.user.role === "patient") {
      const patient = await Patient.findOne({ userId: req.user._id });
      filter.patientId = patient._id;
    } else if (req.user.role === "doctor") {
      filter.doctorId = req.user._id;
    } else if (req.user.role !== "super_master_admin") {
      filter.clinicId = req.user.clinicId;
    }

    // Additional filters
    if (date)
      filter.date = { $gte: new Date(date), $lt: new Date(date + "T23:59:59") };
    if (doctorId) filter.doctorId = doctorId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;

    const appointments = await Appointment.find(filter)
      .populate(
        "patientId",
        "patientId userId fullName phone attenderMobile attenderEmail age gender bloodType city nationality profileImage"
      )
      .populate("doctorId", "fullName specialty phone email clinicId")
      .populate("clinicId", "name city state address phone email type")
      .populate("createdBy", "firstName lastName role email")
      .populate("updatedBy", "firstName lastName role email")
      .sort({ createdAt: -1, date: -1, time: -1 });

    res.json({ success: true, appointments });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: error.message,
    });
  }
});

// Create appointment
router.post("/", auth, async (req, res) => {
  try {
    const appointment = new Appointment({
      ...req.body,
      clinicId: req.user.clinicId,
      createdBy: req.user._id,
    });

    await appointment.save();

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate(
        "patientId",
        "patientId userId fullName phone attenderMobile attenderEmail age gender bloodType city nationality profileImage"
      )
      .populate("doctorId", "fullName specialty phone email clinicId")
      .populate("clinicId", "name city state address phone email type")
      .populate("createdBy", "firstName lastName role email")
      .populate("updatedBy", "firstName lastName role email");

    res.status(201).json({
      success: true,
      message: "Appointment created successfully",
      appointment: populatedAppointment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create appointment",
      error: error.message,
    });
  }
});

// Update appointment
router.put("/:id", auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    )
      .populate(
        "patientId",
        "patientId userId fullName phone attenderMobile attenderEmail age gender bloodType city nationality profileImage"
      )
      .populate("doctorId", "fullName specialty phone email clinicId")
      .populate("clinicId", "name city state address phone email type")
      .populate("createdBy", "firstName lastName role email")
      .populate("updatedBy", "firstName lastName role email");

    res.json({
      success: true,
      message: "Appointment updated successfully",
      appointment: updatedAppointment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update appointment",
      error: error.message,
    });
  }
});

module.exports = router;
