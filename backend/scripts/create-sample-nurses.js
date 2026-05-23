const mongoose = require("mongoose");
const Nurse = require("../models/Nurse");
const Clinic = require("../models/Clinic");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(
  "mongodb+srv://naif:naif123@smaartdb.turl6oh.mongodb.net/SmaartDB",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

async function createSampleNurses() {
  try {
    console.log("Creating sample nurse data...");

    // First, let's check if there are any clinics
    const clinics = await Clinic.find({});
    console.log(`Found ${clinics.length} clinics in database`);

    let defaultClinicId = null;
    if (clinics.length > 0) {
      defaultClinicId = clinics[0]._id;
      console.log(`Using clinic: ${clinics[0].name} (ID: ${defaultClinicId})`);
    }

    // Clear existing nurses
    await Nurse.deleteMany({});
    console.log("Cleared existing nurse records");

    // Sample nurse data
    const sampleNurses = [
      {
        firstName: "Seed",
        lastName: "Nurse",
        email: "nurse.seed@clinic.com",
        phone: "+966501234567",
        licenseNumber: "LIC-SEED-001",
        specialization: "General Nursing",
        experience: 5,
        clinicId: defaultClinicId,
        shift: "morning",
        department: "General Ward",
        bloodType: "O+",
        address: {
          street: "123 Healthcare Street",
          city: "Riyadh",
          state: "Riyadh Province",
          zipCode: "12345",
          country: "Saudi Arabia",
        },
        emergencyContact: {
          name: "Emergency Contact",
          phone: "+966501234568",
          relationship: "Spouse",
        },
        dateOfBirth: new Date("1990-01-15"),
        gender: "female",
        salary: 8000,
        qualifications: [
          { degree: "BSN", institution: "King Saud University", year: 2012 },
          { degree: "RN", institution: "Saudi Nursing Council", year: 2012 },
        ],
        certifications: [
          {
            name: "BLS",
            issuedBy: "American Heart Association",
            issuedDate: new Date("2023-01-01"),
            expiryDate: new Date("2025-01-01"),
          },
          {
            name: "ACLS",
            issuedBy: "American Heart Association",
            issuedDate: new Date("2023-01-01"),
            expiryDate: new Date("2025-01-01"),
          },
        ],
        isActive: true,
        dateOfJoining: new Date("2023-01-01"),
      },
      {
        firstName: "Sarah",
        lastName: "Johnson",
        email: "sarah.johnson@clinic.com",
        phone: "+966501234569",
        licenseNumber: "LIC-SJ-002",
        specialization: "ICU Nursing",
        experience: 8,
        clinicId: defaultClinicId,
        shift: "night",
        department: "ICU",
        bloodType: "A+",
        address: {
          street: "456 Medical Avenue",
          city: "Jeddah",
          state: "Makkah Province",
          zipCode: "23456",
          country: "Saudi Arabia",
        },
        emergencyContact: {
          name: "John Johnson",
          phone: "+966501234570",
          relationship: "Husband",
        },
        dateOfBirth: new Date("1988-03-20"),
        gender: "female",
        salary: 12000,
        qualifications: [
          {
            degree: "BSN",
            institution: "Princess Nourah University",
            year: 2010,
          },
          {
            degree: "MSN",
            institution: "King Abdulaziz University",
            year: 2015,
          },
          { degree: "RN", institution: "Saudi Nursing Council", year: 2010 },
        ],
        certifications: [
          {
            name: "BLS",
            issuedBy: "American Heart Association",
            issuedDate: new Date("2022-01-01"),
            expiryDate: new Date("2024-01-01"),
          },
          {
            name: "ACLS",
            issuedBy: "American Heart Association",
            issuedDate: new Date("2022-01-01"),
            expiryDate: new Date("2024-01-01"),
          },
          {
            name: "CCRN",
            issuedBy: "AACN",
            issuedDate: new Date("2020-01-01"),
            expiryDate: new Date("2023-01-01"),
          },
        ],
        isActive: true,
        dateOfJoining: new Date("2022-06-15"),
      },
      {
        firstName: "Ahmed",
        lastName: "Hassan",
        email: "ahmed.hassan@clinic.com",
        phone: "+966501234571",
        licenseNumber: "LIC-AH-003",
        specialization: "Emergency Nursing",
        experience: 3,
        clinicId: defaultClinicId,
        shift: "morning",
        department: "Emergency",
        bloodType: "B+",
        address: {
          street: "789 Care Boulevard",
          city: "Dammam",
          state: "Eastern Province",
          zipCode: "34567",
          country: "Saudi Arabia",
        },
        emergencyContact: {
          name: "Fatima Hassan",
          phone: "+966501234572",
          relationship: "Sister",
        },
        dateOfBirth: new Date("1992-07-10"),
        gender: "male",
        salary: 9000,
        qualifications: [
          {
            degree: "BSN",
            institution: "Imam Abdulrahman University",
            year: 2016,
          },
          { degree: "RN", institution: "Saudi Nursing Council", year: 2016 },
        ],
        certifications: [
          {
            name: "BLS",
            issuedBy: "American Heart Association",
            issuedDate: new Date("2024-01-01"),
            expiryDate: new Date("2026-01-01"),
          },
          {
            name: "PALS",
            issuedBy: "American Heart Association",
            issuedDate: new Date("2024-01-01"),
            expiryDate: new Date("2026-01-01"),
          },
        ],
        isActive: true,
        dateOfJoining: new Date("2024-01-10"),
      },
    ];

    // Create nurse records
    const createdNurses = await Nurse.insertMany(sampleNurses);
    console.log(`\nCreated ${createdNurses.length} nurse records:`);

    for (const nurse of createdNurses) {
      console.log(
        `- ${nurse.fullName} (${nurse.email}) - License: ${nurse.licenseNumber} - Department: ${nurse.department}`
      );
    }

    // Verify by fetching all nurses
    const allNurses = await Nurse.find({}).populate("clinicId", "name");
    console.log(`\nTotal nurses in database: ${allNurses.length}`);
  } catch (error) {
    console.error("Error creating sample nurses:", error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the creation
createSampleNurses();
