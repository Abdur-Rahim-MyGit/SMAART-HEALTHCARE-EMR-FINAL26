const mongoose = require("mongoose");
const Patient = require("../models/Patient");
const User = require("../models/User");
const Clinic = require("../models/Clinic");

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://souban:souban123@smaartdb.turl6oh.mongodb.net/?retryWrites=true&w=majority&appName=SmaartDB");
    console.log("✅ MongoDB Connected Successfully!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

const samplePatients = [
  {
    fullName: "Paul McCartney",
    dateOfBirth: new Date("1990-05-15"),
    gender: "male",
    maritalStatus: false,
    aadhaarNumber: "123456789012",
    attenderEmail: "paul.mccartney@email.com",
    attenderMobile: "9840987654",
    attenderWhatsapp: "9840987654",
    city: "Bangalore",
    nationality: "Indian",
    pinCode: "560001",
    modeOfCare: "In-person",
    bloodType: "O+",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face&auto=format",
    emergencyContact: {
      name: "Jane McCartney",
      relationship: "Sister",
      phone: "9876543210"
    },
    insuranceInfo: {
      provider: "Star Health",
      policyNumber: "SH123456",
      groupNumber: "GRP001"
    }
  },
  {
    fullName: "Martin Smith",
    dateOfBirth: new Date("1985-08-22"),
    gender: "male",
    maritalStatus: true,
    aadhaarNumber: "234567890123",
    attenderEmail: "martin.smith@email.com",
    attenderMobile: "9876543210",
    attenderWhatsapp: "9876543210",
    city: "Mumbai",
    nationality: "Indian",
    pinCode: "400001",
    modeOfCare: "Virtual",
    bloodType: "A+",
    imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format",
    emergencyContact: {
      name: "Sarah Smith",
      relationship: "Wife",
      phone: "9123456789"
    },
    insuranceInfo: {
      provider: "HDFC Ergo",
      policyNumber: "HD789012",
      groupNumber: "GRP002"
    }
  },
  {
    fullName: "Raj Kumar",
    dateOfBirth: new Date("1992-12-10"),
    gender: "male",
    maritalStatus: false,
    aadhaarNumber: "345678901234",
    attenderEmail: "raj.kumar@email.com",
    attenderMobile: "9234567890",
    attenderWhatsapp: "9234567890",
    city: "Delhi",
    nationality: "Indian",
    pinCode: "110001",
    modeOfCare: "Hybrid",
    bloodType: "B+",
    imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face&auto=format",
    emergencyContact: {
      name: "Priya Kumar",
      relationship: "Mother",
      phone: "9345678901"
    },
    insuranceInfo: {
      provider: "ICICI Lombard",
      policyNumber: "IC345678",
      groupNumber: "GRP003"
    }
  },
  {
    fullName: "Priya Sharma",
    dateOfBirth: new Date("1988-03-18"),
    gender: "female",
    maritalStatus: true,
    aadhaarNumber: "456789012345",
    attenderEmail: "priya.sharma@email.com",
    attenderMobile: "9345678901",
    attenderWhatsapp: "9345678901",
    city: "Chennai",
    nationality: "Indian",
    pinCode: "600001",
    modeOfCare: "In-person",
    bloodType: "AB+",
    imageUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face&auto=format",
    emergencyContact: {
      name: "Amit Sharma",
      relationship: "Husband",
      phone: "9456789012"
    },
    insuranceInfo: {
      provider: "Bajaj Allianz",
      policyNumber: "BA456789",
      groupNumber: "GRP004"
    }
  },
  {
    fullName: "Anita Desai",
    dateOfBirth: new Date("1995-07-25"),
    gender: "female",
    maritalStatus: false,
    aadhaarNumber: "567890123456",
    attenderEmail: "anita.desai@email.com",
    attenderMobile: "9456789012",
    attenderWhatsapp: "9456789012",
    city: "Pune",
    nationality: "Indian",
    pinCode: "411001",
    modeOfCare: "Virtual",
    bloodType: "O-",
    imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face&auto=format",
    emergencyContact: {
      name: "Ravi Desai",
      relationship: "Father",
      phone: "9567890123"
    },
    insuranceInfo: {
      provider: "New India Assurance",
      policyNumber: "NI567890",
      groupNumber: "GRP005"
    }
  },
  {
    fullName: "Vikram Singh",
    dateOfBirth: new Date("1987-11-30"),
    gender: "male",
    maritalStatus: true,
    aadhaarNumber: "678901234567",
    attenderEmail: "vikram.singh@email.com",
    attenderMobile: "9567890123",
    attenderWhatsapp: "9567890123",
    city: "Hyderabad",
    nationality: "Indian",
    pinCode: "500001",
    modeOfCare: "Home Care",
    bloodType: "A-",
    imageUrl: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=150&h=150&fit=crop&crop=face&auto=format",
    emergencyContact: {
      name: "Meera Singh",
      relationship: "Wife",
      phone: "9678901234"
    },
    insuranceInfo: {
      provider: "Oriental Insurance",
      policyNumber: "OI678901",
      groupNumber: "GRP006"
    }
  }
];

const addSamplePatients = async () => {
  try {
    // Get the first clinic to associate patients with
    const clinic = await Clinic.findOne();
    if (!clinic) {
      console.log("❌ No clinics found. Please add clinics first.");
      return;
    }

    console.log(`📋 Found clinic: ${clinic.name}`);

    // Clear existing patients (optional)
    await Patient.deleteMany({});
    console.log("🗑️  Cleared existing patients");

    // Add sample patients
    for (const patientData of samplePatients) {
      // Create user account for patient
      const user = new User({
        firstName: patientData.fullName.split(" ")[0],
        lastName: patientData.fullName.split(" ").slice(1).join(" "),
        email: patientData.attenderEmail,
        phone: patientData.attenderMobile,
        role: "patient",
        clinicId: clinic._id,
        isActive: true,
        isVerified: true
      });
      await user.save();

      // Create patient record
      const patient = new Patient({
        ...patientData,
        userId: user._id,
        clinicId: clinic._id,
        category: "Classic"
      });
      
      await patient.save();
      console.log(`✅ Added patient: ${patientData.fullName} with profile picture`);
    }

    console.log("🎉 Successfully added all sample patients with real profile pictures!");
    
  } catch (error) {
    console.error("❌ Error adding sample patients:", error.message);
  }
};

const main = async () => {
  await connectDB();
  await addSamplePatients();
  mongoose.connection.close();
  console.log("🔐 Database connection closed");
};

main().catch(console.error);
