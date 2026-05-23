const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(
  "mongodb+srv://naif:naif123@smaartdb.turl6oh.mongodb.net/SmaartDB",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

async function createAdminUsers() {
  try {
    console.log("Creating admin users...");

    // Clear existing users
    await User.deleteMany({});
    console.log("Cleared existing user records");

    // Hash password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Sample admin users (only super_master_admin for now)
    const adminUsers = [
      {
        firstName: "Super Master",
        lastName: "Admin",
        email: "supermaster@admin.com",
        phone: "+1234567890",
        password: hashedPassword,
        role: "super_master_admin",
        isVerified: true,
        isActive: true,
      },
      {
        firstName: "Naif",
        lastName: "Basha",
        email: "naifbasha50@gmail.com",
        phone: "+1234567893",
        password: hashedPassword,
        role: "super_master_admin",
        isVerified: true,
        isActive: true,
      },
    ];

    // Create admin users
    const createdUsers = await User.insertMany(adminUsers);
    console.log(`\nCreated ${createdUsers.length} admin users:`);

    for (const user of createdUsers) {
      console.log(
        `- ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role}`
      );
    }

    // Verify by fetching all users
    const allUsers = await User.find({});
    console.log(`\nTotal users in database: ${allUsers.length}`);

    console.log("\nLogin credentials for testing:");
    console.log(
      "Email: supermaster@admin.com | Password: admin123 | Role: super_master_admin"
    );
    console.log(
      "Email: super@admin.com | Password: admin123 | Role: super_admin"
    );
    console.log(
      "Email: jameel@gmail.com | Password: admin123 | Role: super_admin"
    );
    console.log(
      "Email: naifbasha50@gmail.com | Password: admin123 | Role: super_master_admin"
    );
  } catch (error) {
    console.error("Error creating admin users:", error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the creation
createAdminUsers();
