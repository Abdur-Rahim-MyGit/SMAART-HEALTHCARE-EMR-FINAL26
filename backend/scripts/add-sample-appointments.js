const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
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

const addSampleAppointments = async () => {
  try {
    // Get existing patients, doctors, and clinics
    const patients = await Patient.find().limit(5);
    const doctors = await User.find({ role: 'doctor' }).limit(3);
    const clinics = await Clinic.find().limit(2);

    if (patients.length === 0 || doctors.length === 0 || clinics.length === 0) {
      console.log("❌ Need patients, doctors, and clinics in database first");
      return;
    }

    console.log(`📋 Found ${patients.length} patients, ${doctors.length} doctors, ${clinics.length} clinics`);

    // Clear existing appointments
    await Appointment.deleteMany({});
    console.log("🗑️  Cleared existing appointments");

    // Create sample appointments
    const appointmentTypes = ['Consultation', 'Follow-up', 'Vaccination', 'Specialist Consultation', 'Emergency Visit'];
    const statuses = ['Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'];
    const priorities = ['low', 'normal', 'high', 'urgent'];

    const sampleAppointments = [];

    for (let i = 0; i < 15; i++) {
      const patient = patients[Math.floor(Math.random() * patients.length)];
      const doctor = doctors[Math.floor(Math.random() * doctors.length)];
      const clinic = clinics[Math.floor(Math.random() * clinics.length)];
      
      // Generate dates for the next 30 days
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + Math.floor(Math.random() * 30) - 15); // -15 to +15 days
      
      const appointment = {
        patientId: patient._id,
        doctorId: doctor._id,
        clinicId: clinic._id,
        appointmentType: appointmentTypes[Math.floor(Math.random() * appointmentTypes.length)],
        date: baseDate,
        time: `${Math.floor(Math.random() * 12) + 8}:${Math.random() > 0.5 ? '00' : '30'}`,
        duration: Math.random() > 0.5 ? 30 : 60,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        reason: `${appointmentTypes[Math.floor(Math.random() * appointmentTypes.length)]} needed`,
        notes: `Sample appointment for ${patient.fullName}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      sampleAppointments.push(appointment);
    }

    // Insert appointments
    const insertedAppointments = await Appointment.insertMany(sampleAppointments);
    console.log(`✅ Added ${insertedAppointments.length} sample appointments`);

    // Display summary
    console.log("\n📊 Appointment Summary:");
    for (const appointment of insertedAppointments.slice(0, 5)) {
      const patient = await Patient.findById(appointment.patientId);
      const doctor = await User.findById(appointment.doctorId);
      const clinic = await Clinic.findById(appointment.clinicId);
      
      console.log(`   • ${appointment.appointmentType} - ${patient.fullName} with Dr. ${doctor.firstName} ${doctor.lastName} at ${clinic.name}`);
      console.log(`     Date: ${appointment.date.toDateString()} ${appointment.time} | Status: ${appointment.status} | Priority: ${appointment.priority}`);
    }

    console.log("🎉 Successfully added sample appointments with real relationships!");
    
  } catch (error) {
    console.error("❌ Error adding sample appointments:", error.message);
  }
};

const main = async () => {
  await connectDB();
  await addSampleAppointments();
  mongoose.connection.close();
  console.log("🔐 Database connection closed");
};

main().catch(console.error);
