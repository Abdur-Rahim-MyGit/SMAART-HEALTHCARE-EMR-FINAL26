const mongoose = require("mongoose");
const Consultation = require("../models/Consultation");
const Patient = require("../models/Patient");
const User = require("../models/User");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(
  process.env.MONGODB_URI,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

async function addSampleConsultations() {
  try {
    console.log("Adding sample consultations with prescriptions and diagnoses...");

    // Get existing patients (we'll need to create some if none exist)
    let patients = await Patient.find({}).limit(3);
    
    if (patients.length === 0) {
      console.log("No patients found, creating sample patients...");
      
      // Create sample patients
      const samplePatients = [
        {
          fullName: "John Doe",
          phone: "1234567890",
          email: "john.doe@example.com",
          dateOfBirth: new Date("1985-05-15"),
          gender: "Male",
          bloodGroup: "O+",
          uhid: "P0001"
        },
        {
          fullName: "Jane Smith",
          phone: "0987654321", 
          email: "jane.smith@example.com",
          dateOfBirth: new Date("1990-08-22"),
          gender: "Female",
          bloodGroup: "A+",
          uhid: "P0002"
        },
        {
          fullName: "Ahmed Hassan",
          phone: "1122334455",
          email: "ahmed.hassan@example.com", 
          dateOfBirth: new Date("1978-12-10"),
          gender: "Male",
          bloodGroup: "B+",
          uhid: "P0003"
        }
      ];

      patients = await Patient.insertMany(samplePatients);
      console.log(`Created ${patients.length} sample patients`);
    }

    // Get existing doctors/users
    let doctors = await User.find({ role: { $in: ['doctor', 'super_master_admin'] } }).limit(2);
    
    if (doctors.length === 0) {
      console.log("No doctors found, using admin users...");
      doctors = await User.find({}).limit(2);
    }

    // Sample consultations with prescriptions and diagnoses
    const sampleConsultations = [
      {
        patientId: patients[0]._id,
        patientName: patients[0].fullName,
        consultationType: "General",
        mode: "In-person",
        date: new Date("2025-10-31"),
        time: "10:30",
        duration: 30,
        provider: "Dr. Aisha Khan",
        doctorId: doctors[0]?._id,
        diagnosis: "Hypertension",
        notes: "Patient shows elevated blood pressure readings. Lifestyle modifications recommended.",
        status: "Completed",
        prescriptions: [
          {
            medication: "Lisinopril",
            dosage: "10mg",
            frequency: "Once daily",
            duration: "30 days",
            instructions: "Take with food in the morning"
          },
          {
            medication: "Amlodipine", 
            dosage: "5mg",
            frequency: "Once daily",
            duration: "30 days",
            instructions: "Take at bedtime"
          }
        ]
      },
      {
        patientId: patients[1]._id,
        patientName: patients[1].fullName,
        consultationType: "Follow-up",
        mode: "Video",
        date: new Date("2025-10-30"),
        time: "14:15",
        duration: 20,
        provider: "Dr. James Smith",
        doctorId: doctors[1]?._id || doctors[0]?._id,
        diagnosis: "Type 2 Diabetes Mellitus",
        notes: "Blood glucose levels improving with current medication. Continue monitoring.",
        status: "Completed",
        prescriptions: [
          {
            medication: "Metformin",
            dosage: "500mg",
            frequency: "Twice daily",
            duration: "90 days", 
            instructions: "Take with meals"
          }
        ]
      },
      {
        patientId: patients[0]._id,
        patientName: patients[0].fullName,
        consultationType: "Emergency",
        mode: "In-person",
        date: new Date("2025-10-25"),
        time: "16:45",
        duration: 45,
        provider: "Dr. Sarah Wilson",
        doctorId: doctors[0]?._id,
        diagnosis: "Acute Bronchitis",
        notes: "Patient presented with persistent cough and chest congestion. Prescribed antibiotics and bronchodilator.",
        status: "Completed",
        prescriptions: [
          {
            medication: "Amoxicillin",
            dosage: "500mg",
            frequency: "Three times daily",
            duration: "7 days",
            instructions: "Take with food, complete full course"
          },
          {
            medication: "Salbutamol Inhaler",
            dosage: "100mcg",
            frequency: "As needed",
            duration: "30 days",
            instructions: "2 puffs when experiencing breathing difficulty"
          }
        ]
      },
      {
        patientId: patients[2]._id,
        patientName: patients[2].fullName,
        consultationType: "Specialist",
        mode: "In-person", 
        date: new Date("2025-10-20"),
        time: "11:00",
        duration: 60,
        provider: "Dr. Michael Brown",
        doctorId: doctors[1]?._id || doctors[0]?._id,
        diagnosis: "Hyperlipidemia",
        notes: "Elevated cholesterol levels detected in recent lab work. Starting statin therapy.",
        status: "Completed",
        prescriptions: [
          {
            medication: "Atorvastatin",
            dosage: "20mg",
            frequency: "Once daily",
            duration: "90 days",
            instructions: "Take at bedtime with or without food"
          }
        ]
      }
    ];

    // Insert sample consultations
    const insertedConsultations = await Consultation.insertMany(sampleConsultations);
    console.log(`✅ Successfully added ${insertedConsultations.length} sample consultations`);

    // Display summary
    console.log("\n📋 Sample Consultations Summary:");
    insertedConsultations.forEach((consultation, index) => {
      console.log(`${index + 1}. ${consultation.patientName} - ${consultation.diagnosis}`);
      console.log(`   Prescriptions: ${consultation.prescriptions.length} medications`);
      console.log(`   Date: ${consultation.date.toDateString()}`);
      console.log("");
    });

  } catch (error) {
    console.error("❌ Error adding sample consultations:", error);
  } finally {
    mongoose.connection.close();
    console.log("📴 Database connection closed");
  }
}

// Run the script
addSampleConsultations();
