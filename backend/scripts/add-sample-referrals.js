const mongoose = require("mongoose");
const Referral = require("../models/Referral");
const Patient = require("../models/Patient");
const User = require("../models/User");

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

const addSampleReferrals = async () => {
  try {
    // Get existing patients and doctors
    const patients = await Patient.find().limit(10);
    const doctors = await User.find({ role: 'doctor' }).limit(5);

    if (patients.length === 0 || doctors.length === 0) {
      console.log("❌ Need patients and doctors in database first");
      return;
    }

    console.log(`📋 Found ${patients.length} patients, ${doctors.length} doctors`);

    // Clear existing referrals
    await Referral.deleteMany({});
    console.log("🗑️  Cleared existing referrals");

    // Sample specialties and reasons
    const specialties = [
      'Cardiology', 'Neurology', 'Orthopedics', 'Dermatology', 'Psychiatry',
      'Endocrinology', 'Gastroenterology', 'Pulmonology', 'Rheumatology', 'Oncology'
    ];

    const reasons = [
      'Chest pain evaluation', 'Neurological assessment', 'Joint pain management',
      'Skin condition evaluation', 'Mental health consultation', 'Diabetes management',
      'Digestive issues', 'Breathing difficulties', 'Arthritis treatment', 'Cancer screening'
    ];

    const statuses = ['Pending', 'Scheduled', 'Completed', 'Cancelled'];
    const urgencies = ['Routine', 'Urgent', 'Emergency'];

    const sampleReferrals = [];

    for (let i = 0; i < 25; i++) {
      const patient = patients[Math.floor(Math.random() * patients.length)];
      const doctor = doctors[Math.floor(Math.random() * doctors.length)];
      const specialty = specialties[Math.floor(Math.random() * specialties.length)];
      const reason = reasons[Math.floor(Math.random() * reasons.length)];
      
      // Generate dates
      const referralDate = new Date();
      referralDate.setDate(referralDate.getDate() - Math.floor(Math.random() * 60)); // Last 60 days
      
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + Math.floor(Math.random() * 30)); // Next 30 days

      const referral = {
        patientId: patient._id,
        patientName: patient.fullName,
        specialistName: `Dr. ${specialty.slice(0, 3)} Specialist`,
        specialty: specialty,
        specialistContact: {
          phone: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
          email: `${specialty.toLowerCase()}@specialist.com`
        },
        specialistAddress: {
          street: `${Math.floor(Math.random() * 999) + 1} Medical Plaza`,
          city: ['Chennai', 'Bangalore', 'Mumbai', 'Delhi'][Math.floor(Math.random() * 4)],
          state: ['Tamil Nadu', 'Karnataka', 'Maharashtra', 'Delhi'][Math.floor(Math.random() * 4)],
          zipCode: `${Math.floor(Math.random() * 900000) + 100000}`
        },
        referralDate: referralDate,
        appointmentDate: Math.random() > 0.3 ? appointmentDate : null,
        reason: reason,
        urgency: urgencies[Math.floor(Math.random() * urgencies.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        diagnosis: `Preliminary ${specialty.toLowerCase()} condition`,
        symptoms: `Patient reports ${reason.toLowerCase()}`,
        treatmentHistory: `Previous treatment with Dr. ${doctor.firstName} ${doctor.lastName}`,
        medications: [
          {
            name: ['Aspirin', 'Ibuprofen', 'Paracetamol', 'Metformin'][Math.floor(Math.random() * 4)],
            dosage: '500mg',
            frequency: 'Twice daily'
          }
        ],
        referringProvider: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        providerNotes: `Referral to ${specialty} for specialized care`,
        followUpRequired: Math.random() > 0.3,
        followUpDate: Math.random() > 0.5 ? appointmentDate : null,
        createdAt: referralDate,
        updatedAt: new Date()
      };

      sampleReferrals.push(referral);
    }

    // Insert referrals
    const insertedReferrals = await Referral.insertMany(sampleReferrals);
    console.log(`✅ Added ${insertedReferrals.length} sample referrals`);

    // Display summary
    console.log("\n📊 Referrals Summary:");
    const statusCounts = {};
    const urgencyCounts = {};
    const specialtyCounts = {};

    for (const referral of insertedReferrals) {
      statusCounts[referral.status] = (statusCounts[referral.status] || 0) + 1;
      urgencyCounts[referral.urgency] = (urgencyCounts[referral.urgency] || 0) + 1;
      specialtyCounts[referral.specialty] = (specialtyCounts[referral.specialty] || 0) + 1;
    }

    console.log("   📈 Status Distribution:");
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`      ${status}: ${count}`);
    });

    console.log("   🚨 Urgency Distribution:");
    Object.entries(urgencyCounts).forEach(([urgency, count]) => {
      console.log(`      ${urgency}: ${count}`);
    });

    console.log("   🏥 Top Specialties:");
    Object.entries(specialtyCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([specialty, count]) => {
        console.log(`      ${specialty}: ${count}`);
      });

    // Show sample referrals
    console.log("\n📋 Sample Referrals:");
    for (const referral of insertedReferrals.slice(0, 3)) {
      console.log(`   • ${referral.patientName} → ${referral.specialistName} (${referral.specialty})`);
      console.log(`     Status: ${referral.status} | Urgency: ${referral.urgency} | Date: ${referral.referralDate.toDateString()}`);
      console.log(`     Reason: ${referral.reason}`);
    }

    console.log("🎉 Successfully added sample referrals with real patient relationships!");
    
  } catch (error) {
    console.error("❌ Error adding sample referrals:", error.message);
  }
};

const main = async () => {
  await connectDB();
  await addSampleReferrals();
  mongoose.connection.close();
  console.log("🔐 Database connection closed");
};

main().catch(console.error);
