/**
 * Diagnostic script to check clinic data structure
 */

const mongoose = require("mongoose");
require("dotenv").config();

// Import models
const Clinic = require("./models/Clinic");

const diagnoseClinics = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/smaart-team"
    );
    console.log("✅ Connected to MongoDB");

    // Count total clinics
    const totalClinics = await Clinic.countDocuments();
    console.log(`📊 Total clinics in database: ${totalClinics}`);

    if (totalClinics === 0) {
      console.log("⚠️  No clinics found in database");
      return;
    }

    // Get first few clinics to understand structure
    const sampleClinics = await Clinic.find({}).limit(3);

    console.log("\n🏥 Sample clinic data structures:");
    console.log("=".repeat(50));

    sampleClinics.forEach((clinic, index) => {
      console.log(`\nClinic ${index + 1}:`);
      console.log(`  Name: ${clinic.name || "N/A"}`);
      console.log(`  Email: ${clinic.email || "N/A"}`);
      console.log(`  Admin Email: ${clinic.adminEmail || "N/A"}`);
      console.log(`  Admin Username: ${clinic.adminUsername || "N/A"}`);
      console.log(`  Owner Name: ${clinic.ownerName || "N/A"}`);
      console.log(`  Has resetOTP field: ${clinic.resetOTP !== undefined}`);
      console.log(
        `  Has resetOTPExpires field: ${clinic.resetOTPExpires !== undefined}`
      );
    });

    // Check specifically for the email from screenshot
    const targetEmail = "psycbaka@gmail.com";
    console.log(`\n🔍 Searching specifically for: ${targetEmail}`);

    const byEmail = await Clinic.findOne({ email: targetEmail });
    const byAdminEmail = await Clinic.findOne({ adminEmail: targetEmail });

    console.log(`  Found by 'email' field: ${byEmail ? "✅ YES" : "❌ NO"}`);
    console.log(
      `  Found by 'adminEmail' field: ${byAdminEmail ? "✅ YES" : "❌ NO"}`
    );

    if (byEmail) {
      console.log(`  Clinic name: ${byEmail.name}`);
      console.log(
        `  Admin password exists: ${byEmail.adminPassword ? "✅ YES" : "❌ NO"}`
      );
    }

    if (byAdminEmail) {
      console.log(`  Clinic name: ${byAdminEmail.name}`);
      console.log(
        `  Admin password exists: ${
          byAdminEmail.adminPassword ? "✅ YES" : "❌ NO"
        }`
      );
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("\n👋 Database connection closed");
  }
};

diagnoseClinics();
