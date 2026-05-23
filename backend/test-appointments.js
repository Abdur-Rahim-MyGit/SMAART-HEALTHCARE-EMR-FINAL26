const mongoose = require("mongoose");
const Appointment = require("./models/Appointment");
const Patient = require("./models/Patient");
const Doctor = require("./models/Doctor");
const Clinic = require("./models/Clinic");
require("dotenv").config();

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://souban:souban123@smaartdb.turl6oh.mongodb.net/?retryWrites=true&w=majority&appName=SmaartDB";

async function testAppointments() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("\n--- Testing Appointments Collection ---\n");

    // Count total appointments
    const count = await Appointment.countDocuments();
    console.log(`Total appointments in database: ${count}`);

    // Get all appointments
    const appointments = await Appointment.find()
      .populate("patientId", "fullName phone email profileImage")
      .populate("doctorId", "fullName specialty")
      .populate("clinicId", "name")
      .limit(5);

    console.log(`\nFirst 5 appointments:`);
    appointments.forEach((apt, index) => {
      console.log(`\n${index + 1}. Appointment ID: ${apt._id}`);
      console.log(`   Patient: ${apt.patientId?.fullName || "N/A"}`);
      console.log(`   Profile Image: ${apt.patientId?.profileImage || "N/A"}`);
      console.log(`   Doctor: ${apt.doctorId?.fullName || "N/A"}`);
      console.log(`   Clinic: ${apt.clinicId?.name || "N/A"}`);
      console.log(`   Date: ${apt.date}`);
      console.log(`   Time: ${apt.time}`);
      console.log(`   Status: ${apt.status}`);
    });

    console.log("\n✅ Test completed successfully");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Full error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n📴 Database connection closed");
    process.exit(0);
  }
}

testAppointments();
