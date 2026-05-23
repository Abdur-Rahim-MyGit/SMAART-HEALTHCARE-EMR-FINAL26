const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const Doctor = require('../models/Doctor');
const Clinic = require('../models/Clinic');

// Sample doctors data
const sampleDoctors = [
  {
    fullName: 'Dr. Rajesh Kumar',
    email: 'rajesh.kumar@hospital.com',
    password: 'password123',
    specialty: 'Cardiology',
    phone: '+91-9876543210',
    profileImage: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face',
    uhid: 'DOC001',
    qualification: 'MBBS, MD (Cardiology)',
    currentAddress: {
      street: '123 Medical Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400001',
      country: 'India'
    },
    permanentAddress: {
      street: '456 Home Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400002',
      country: 'India'
    },
    about: 'Experienced cardiologist with over 15 years of practice. Specializes in interventional cardiology and heart disease prevention.',
    role: 'doctor',
    isActive: true
  },
  {
    fullName: 'Dr. Priya Sharma',
    email: 'priya.sharma@hospital.com',
    password: 'password123',
    specialty: 'Pediatrics',
    phone: '+91-9876543211',
    profileImage: 'https://images.unsplash.com/photo-1594824475317-8b7f8c8b8b8b?w=150&h=150&fit=crop&crop=face',
    uhid: 'DOC002',
    qualification: 'MBBS, MD (Pediatrics)',
    currentAddress: {
      street: '789 Children Street',
      city: 'Delhi',
      state: 'Delhi',
      zipCode: '110001',
      country: 'India'
    },
    permanentAddress: {
      street: '321 Family Street',
      city: 'Delhi',
      state: 'Delhi',
      zipCode: '110002',
      country: 'India'
    },
    about: 'Dedicated pediatrician focusing on child healthcare and development. Expert in neonatal care and childhood diseases.',
    role: 'doctor',
    isActive: true
  },
  {
    fullName: 'Dr. Amit Patel',
    email: 'amit.patel@hospital.com',
    password: 'password123',
    specialty: 'Orthopedics',
    phone: '+91-9876543212',
    profileImage: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&h=150&fit=crop&crop=face',
    uhid: 'DOC003',
    qualification: 'MBBS, MS (Orthopedics)',
    currentAddress: {
      street: '456 Bone Street',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560001',
      country: 'India'
    },
    permanentAddress: {
      street: '789 Joint Street',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560002',
      country: 'India'
    },
    about: 'Orthopedic surgeon specializing in joint replacement and sports medicine. Over 12 years of surgical experience.',
    role: 'doctor',
    isActive: true
  },
  {
    fullName: 'Dr. Sunita Reddy',
    email: 'sunita.reddy@hospital.com',
    password: 'password123',
    specialty: 'Gynecology',
    phone: '+91-9876543213',
    profileImage: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face',
    uhid: 'DOC004',
    qualification: 'MBBS, MD (Gynecology & Obstetrics)',
    currentAddress: {
      street: '321 Women Street',
      city: 'Hyderabad',
      state: 'Telangana',
      zipCode: '500001',
      country: 'India'
    },
    permanentAddress: {
      street: '654 Care Street',
      city: 'Hyderabad',
      state: 'Telangana',
      zipCode: '500002',
      country: 'India'
    },
    about: 'Experienced gynecologist and obstetrician. Specializes in high-risk pregnancies and minimally invasive surgeries.',
    role: 'doctor',
    isActive: true
  },
  {
    fullName: 'Dr. Vikram Singh',
    email: 'vikram.singh@hospital.com',
    password: 'password123',
    specialty: 'Neurology',
    phone: '+91-9876543214',
    profileImage: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face',
    uhid: 'DOC005',
    qualification: 'MBBS, DM (Neurology)',
    currentAddress: {
      street: '987 Brain Street',
      city: 'Chennai',
      state: 'Tamil Nadu',
      zipCode: '600001',
      country: 'India'
    },
    permanentAddress: {
      street: '123 Nerve Street',
      city: 'Chennai',
      state: 'Tamil Nadu',
      zipCode: '600002',
      country: 'India'
    },
    about: 'Neurologist with expertise in stroke management and epilepsy treatment. Research interest in neurodegenerative diseases.',
    role: 'doctor',
    isActive: true
  },
  {
    fullName: 'Dr. Meera Joshi',
    email: 'meera.joshi@hospital.com',
    password: 'password123',
    specialty: 'Dermatology',
    phone: '+91-9876543215',
    profileImage: 'https://images.unsplash.com/photo-1594824475317-8b7f8c8b8b8b?w=150&h=150&fit=crop&crop=face',
    uhid: 'DOC006',
    qualification: 'MBBS, MD (Dermatology)',
    currentAddress: {
      street: '654 Skin Street',
      city: 'Pune',
      state: 'Maharashtra',
      zipCode: '411001',
      country: 'India'
    },
    permanentAddress: {
      street: '987 Beauty Street',
      city: 'Pune',
      state: 'Maharashtra',
      zipCode: '411002',
      country: 'India'
    },
    about: 'Dermatologist specializing in cosmetic dermatology and skin cancer treatment. Expert in laser therapies.',
    role: 'doctor',
    isActive: true
  }
];

async function addSampleDoctors() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the first clinic to assign doctors to
    const clinic = await Clinic.findOne();
    if (!clinic) {
      console.log('❌ No clinic found. Please create a clinic first.');
      process.exit(1);
    }

    console.log(`📋 Using clinic: ${clinic.name} (${clinic._id})`);

    // Clear existing sample doctors
    await Doctor.deleteMany({ 
      email: { $in: sampleDoctors.map(d => d.email) } 
    });
    console.log('🧹 Cleared existing sample doctors');

    // Add clinic ID to all doctors and hash passwords
    for (let doctorData of sampleDoctors) {
      try {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(doctorData.password, salt);

        // Create doctor with clinic ID
        const doctor = new Doctor({
          ...doctorData,
          passwordHash,
          clinicId: clinic._id
        });
        delete doctor.password; // Remove plain password

        await doctor.save();
        console.log(`✅ Added doctor: ${doctor.fullName} (${doctor.email})`);
      } catch (error) {
        console.error(`❌ Error adding doctor ${doctorData.fullName}:`, error.message);
      }
    }

    // Display summary
    const totalDoctors = await Doctor.countDocuments();
    const activeDoctors = await Doctor.countDocuments({ isActive: true });
    
    console.log('\n📊 Summary:');
    console.log(`Total Doctors: ${totalDoctors}`);
    console.log(`Active Doctors: ${activeDoctors}`);
    console.log(`Clinic: ${clinic.name}`);

    // Display specialties
    const specialties = await Doctor.aggregate([
      { $group: { _id: '$specialty', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n🏥 Specialties:');
    specialties.forEach(spec => {
      console.log(`  ${spec._id}: ${spec.count} doctors`);
    });

    console.log('\n🎉 Sample doctors added successfully!');
    console.log('📍 You can now view them at: http://localhost:3000/doctors');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📤 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  addSampleDoctors();
}

module.exports = { addSampleDoctors, sampleDoctors };
