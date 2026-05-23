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

async function migrateNurses() {
  try {
    console.log("Starting nurse migration...");

    // Find all users with role 'nurse'
    const nurseUsers = await User.find({ role: "nurse" });
    console.log(`Found ${nurseUsers.length} nurse records in User collection`);

    if (nurseUsers.length === 0) {
      console.log("No nurse records found to migrate.");
      return;
    }

    // Check if nurses already exist in Nurse collection
    const existingNurses = await Nurse.find({});
    console.log(
      `Found ${existingNurses.length} existing records in Nurse collection`
    );

    let migratedCount = 0;

    for (const nurseUser of nurseUsers) {
      // Check if this nurse already exists in Nurse collection
      const existingNurse = await Nurse.findOne({ email: nurseUser.email });

      if (existingNurse) {
        console.log(
          `Nurse with email ${nurseUser.email} already exists in Nurse collection, skipping...`
        );
        continue;
      }

      // Create new nurse record from user data
      const nurseData = {
        firstName: nurseUser.firstName || "",
        lastName: nurseUser.lastName || "",
        email: nurseUser.email,
        phone: nurseUser.phone || "",
        licenseNumber: `LIC-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 5)
          .toUpperCase()}`, // Generate a license number
        specialization: nurseUser.specialization || "General Nursing",
        experience: nurseUser.experience || 0,
        clinicId: nurseUser.clinicId || null,
        shift: "Day", // Default shift
        department: nurseUser.department || "General",
        address: {
          street: nurseUser.address || "",
          city: "",
          state: "",
          zipCode: "",
          country: "Saudi Arabia",
        },
        emergencyContact: {
          name: "",
          phone: "",
          relationship: "",
        },
        dateOfBirth: nurseUser.dateOfBirth || new Date("1990-01-01"),
        gender: nurseUser.gender || "Other",
        salary: nurseUser.salary || 0,
        qualifications: [],
        certifications: [],
        isActive: true,
        joiningDate: nurseUser.createdAt || new Date(),
      };

      // Create the nurse record
      const newNurse = new Nurse(nurseData);
      await newNurse.save();

      console.log(
        `Migrated nurse: ${nurseUser.email} (${nurseUser.firstName} ${nurseUser.lastName})`
      );
      migratedCount++;
    }

    console.log(`\nMigration completed!`);
    console.log(`Total nurses migrated: ${migratedCount}`);
    console.log(
      `\nNurse collection now has ${await Nurse.countDocuments()} records`
    );

    // Display all nurses for verification
    const allNurses = await Nurse.find({}).populate("clinicId", "name");
    console.log("\nAll nurses in Nurse collection:");
    allNurses.forEach((nurse) => {
      console.log(
        `- ${nurse.fullName} (${nurse.email}) - License: ${
          nurse.licenseNumber
        } - Clinic: ${nurse.clinicId?.name || "No clinic"}`
      );
    });
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the migration
migrateNurses();
