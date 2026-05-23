const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./models/User");

const checkAdminUsers = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/emr_healthcare_db"
    );

    console.log("🔍 Checking admin users in database...\n");

    const admins = await User.find({
      role: { $in: ["super_master_admin", "super_admin"] },
    })
      .select("firstName lastName email role isActive")
      .lean();

    if (admins.length > 0) {
      console.log("👑 Admin Users Found:");
      console.log("=".repeat(50));
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.firstName} ${admin.lastName}`);
        console.log(`   📧 Email: ${admin.email}`);
        console.log(`   🔑 Role: ${admin.role}`);
        console.log(`   ✅ Active: ${admin.isActive ? "Yes" : "No"}`);
        console.log("");
      });

      console.log("💡 To see nurse data in the frontend:");
      console.log("   1. Go to http://localhost:3000");
      console.log("   2. Log in with one of the admin emails above");
      console.log("   3. Navigate to Nurses Management");
      console.log('   4. You should see the "Seed Nurse" record');
    } else {
      console.log("⚠️ No admin users found!");
      console.log("💡 You need to create an admin user first.");
      console.log("   Option 1: Register through the frontend as super_admin");
      console.log("   Option 2: Create one manually in the database");
    }

    await mongoose.disconnect();
    console.log("\n✅ Check completed");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

checkAdminUsers();
