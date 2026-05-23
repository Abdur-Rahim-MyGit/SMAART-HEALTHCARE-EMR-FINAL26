const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('../models/User');
const Clinic = require('../models/Clinic');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Sample doctors data
const sampleDoctors = [
  {
    firstName: 'John',
    lastName: 'Smith',
    fullName: 'Dr. John Smith',
    email: 'john.smith@hospital.com',
    password: 'password123',
    phone: '+1-555-0101',
    role: 'doctor',
    specialization: 'Cardiology',
    specialty: 'Cardiology',
    licenseNumber: 'MD001234',
    isActive: true
  },
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    fullName: 'Dr. Sarah Johnson',
    email: 'sarah.johnson@hospital.com',
    password: 'password123',
    phone: '+1-555-0102',
    role: 'doctor',
    specialization: 'Pediatrics',
    specialty: 'Pediatrics',
    licenseNumber: 'MD001235',
    isActive: true
  },
  {
    firstName: 'Michael',
    lastName: 'Brown',
    fullName: 'Dr. Michael Brown',
    email: 'michael.brown@hospital.com',
    password: 'password123',
    phone: '+1-555-0103',
    role: 'doctor',
    specialization: 'Orthopedics',
    specialty: 'Orthopedics',
    licenseNumber: 'MD001236',
    isActive: true
  },
  {
    firstName: 'Emily',
    lastName: 'Davis',
    fullName: 'Dr. Emily Davis',
    email: 'emily.davis@hospital.com',
    password: 'password123',
    phone: '+1-555-0104',
    role: 'doctor',
    specialization: 'Dermatology',
    specialty: 'Dermatology',
    licenseNumber: 'MD001237',
    isActive: true
  },
  {
    firstName: 'David',
    lastName: 'Wilson',
    fullName: 'Dr. David Wilson',
    email: 'david.wilson@hospital.com',
    password: 'password123',
    phone: '+1-555-0105',
    role: 'doctor',
    specialization: 'Neurology',
    specialty: 'Neurology',
    licenseNumber: 'MD001238',
    isActive: true
  }
];

const addSampleDoctors = async () => {
  try {
    console.log('🔄 Adding sample doctors...');
    
    // Get the first clinic to assign doctors to
    const firstClinic = await Clinic.findOne();
    if (!firstClinic) {
      console.log('⚠️  No clinics found. Creating a sample clinic first...');
      
      const sampleClinic = new Clinic({
        name: 'Sample Medical Center',
        type: 'Hospital',
        address: '123 Medical Street, Health City, HC 12345',
        phone: '+1-555-0100',
        email: 'info@samplemedical.com',
        adminEmail: 'admin@samplemedical.com',
        adminPassword: await bcrypt.hash('admin123', 10),
        status: 'active'
      });
      
      await sampleClinic.save();
      console.log('✅ Sample clinic created');
    }
    
    const clinic = await Clinic.findOne();
    console.log('📋 Using clinic:', clinic.name);
    
    // Check if doctors already exist
    const existingDoctors = await User.find({ role: 'doctor' });
    console.log(`📊 Found ${existingDoctors.length} existing doctors`);
    
    // Add sample doctors
    for (const doctorData of sampleDoctors) {
      // Check if doctor already exists
      const existingDoctor = await User.findOne({ email: doctorData.email });
      
      if (existingDoctor) {
        console.log(`⏭️  Doctor ${doctorData.email} already exists, skipping...`);
        continue;
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(doctorData.password, 10);
      
      // Create doctor with clinic reference
      const doctor = new User({
        ...doctorData,
        password: hashedPassword,
        clinicId: clinic._id,
        isVerified: true
      });
      
      await doctor.save();
      console.log(`✅ Added doctor: ${doctorData.fullName} (${doctorData.specialization})`);
    }
    
    // Show final count
    const totalDoctors = await User.find({ role: 'doctor' });
    console.log(`\n🎉 Total doctors in database: ${totalDoctors.length}`);
    
    // Show sample data
    console.log('\n📋 Sample doctor data:');
    totalDoctors.slice(0, 3).forEach(doctor => {
      console.log(`   - ${doctor.fullName || doctor.firstName + ' ' + doctor.lastName} (${doctor.specialization || doctor.specialty})`);
    });
    
  } catch (error) {
    console.error('❌ Error adding sample doctors:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the script
const runScript = async () => {
  await connectDB();
  await addSampleDoctors();
};

runScript();
