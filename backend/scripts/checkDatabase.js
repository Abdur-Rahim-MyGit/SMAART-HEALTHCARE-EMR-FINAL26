const mongoose = require("mongoose");
require("dotenv").config();

// Import models
const User = require("../models/User");
const Clinic = require("../models/Clinic");
const Appointment = require("../models/Appointment");
const Patient = require("../models/Patient");

// Import database configuration
const connectDB = require("../config/database");

const checkDatabase = async () => {
  try {
    console.log("🔍 Connecting to MongoDB...");

    // Connect to database
    await connectDB();

    console.log("\n📊 Database Status Check:");
    console.log("=".repeat(50));

    // Check collections and counts
    const userCount = await User.countDocuments();
    const nurseCount = await User.countDocuments({ role: "nurse" });
    const clinicCount = await Clinic.countDocuments();
    const appointmentCount = await Appointment.countDocuments();
    const patientCount = await Patient.countDocuments();

    console.log(`👥 Total Users: ${userCount}`);
    console.log(`👩‍⚕️ Nurses: ${nurseCount}`);
    console.log(`🏥 Clinics: ${clinicCount}`);
    console.log(`📅 Appointments: ${appointmentCount}`);
    console.log(`🧑‍🤝‍🧑 Patients: ${patientCount}`);

    if (nurseCount > 0) {
      console.log("\n👩‍⚕️ Nurse Records:");
      console.log("-".repeat(30));

      const nurses = await User.find({ role: "nurse" })
        .populate("clinicId", "name")
        .select("-password -otp -otpExpires")
        .lean();

      nurses.forEach((nurse, index) => {
        console.log(`${index + 1}. ${nurse.firstName} ${nurse.lastName}`);
        console.log(`   Email: ${nurse.email}`);
        console.log(`   Phone: ${nurse.phone || "N/A"}`);
        console.log(`   License: ${nurse.licenseNumber || "N/A"}`);
        console.log(`   Specialization: ${nurse.specialization || "N/A"}`);
        console.log(`   Clinic: ${nurse.clinicId?.name || "Unassigned"}`);
        console.log(`   Status: ${nurse.isActive ? "Active" : "Inactive"}`);
        console.log(`   Created: ${nurse.createdAt}`);
        console.log("");
      });
    } else {
      console.log("\n⚠️ No nurse records found in the database");
    }

    if (userCount === 0) {
      console.log("\n💡 Database appears to be empty. You may need to:");
      console.log("   1. Run a seeder script to populate initial data");
      console.log("   2. Register users through the application");
      console.log("   3. Import data from another source");
    }

    console.log("\n✅ Database check completed");
  } catch (error) {
    console.error("❌ Error checking database:", error.message);

    if (error.name === "MongoServerSelectionTimeoutError") {
      console.log("\n💡 Connection troubleshooting:");
      console.log("   1. Make sure MongoDB is running");
      console.log("   2. Check your MONGODB_URI environment variable");
      console.log("   3. Verify network connectivity");
      console.log(
        "   4. For local MongoDB: try mongodb://localhost:27017/emr_healthcare_db"
      );
    }
  } finally {
    await mongoose.connection.close();
    console.log("📴 Database connection closed");
    process.exit(0);
  }
};

// Run the check
checkDatabase();
