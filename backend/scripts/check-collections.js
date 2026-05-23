const mongoose = require("mongoose");
const User = require("../models/User");
const Nurse = require("../models/Nurse");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(
  "mongodb+srv://naif:naif123@smaartdb.turl6oh.mongodb.net/SmaartDB",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

async function checkCollections() {
  try {
    console.log("Checking database collections...");

    // Check all users
    const allUsers = await User.find({});
    console.log(`\nTotal users in User collection: ${allUsers.length}`);

    if (allUsers.length > 0) {
      console.log("\nUser records by role:");
      const roleCount = {};
      allUsers.forEach((user) => {
        roleCount[user.role] = (roleCount[user.role] || 0) + 1;
      });
      Object.entries(roleCount).forEach(([role, count]) => {
        console.log(`- ${role}: ${count}`);
      });

      console.log("\nAll users:");
      allUsers.forEach((user) => {
        console.log(
          `- ${user.email} (${user.role}) - ${user.firstName} ${user.lastName}`
        );
      });
    }

    // Check nurses collection
    const allNurses = await Nurse.find({});
    console.log(`\nTotal records in Nurse collection: ${allNurses.length}`);

    if (allNurses.length > 0) {
      console.log("\nNurse records:");
      allNurses.forEach((nurse) => {
        console.log(
          `- ${nurse.email} - ${nurse.fullName} - License: ${nurse.licenseNumber}`
        );
      });
    }

    // Check database name
    const dbName = mongoose.connection.name;
    console.log(`\nConnected to database: ${dbName}`);

    // List all collections
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    console.log("\nAll collections in database:");
    collections.forEach((collection) => {
      console.log(`- ${collection.name}`);
    });
  } catch (error) {
    console.error("Error checking collections:", error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the check
checkCollections();
