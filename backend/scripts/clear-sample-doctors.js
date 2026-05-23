const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Doctor = require('../models/Doctor');

// Sample doctor emails to remove
const sampleDoctorEmails = [
  'rajesh.kumar@hospital.com',
  'priya.sharma@hospital.com',
  'amit.patel@hospital.com',
  'sunita.reddy@hospital.com',
  'vikram.singh@hospital.com',
  'meera.joshi@hospital.com'
];

async function clearSampleDoctors() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Count existing sample doctors
    const sampleDoctorsCount = await Doctor.countDocuments({
      email: { $in: sampleDoctorEmails }
    });

    console.log(`📊 Found ${sampleDoctorsCount} sample doctors to remove`);

    if (sampleDoctorsCount > 0) {
      // Remove sample doctors
      const result = await Doctor.deleteMany({
        email: { $in: sampleDoctorEmails }
      });

      console.log(`🗑️  Removed ${result.deletedCount} sample doctors`);
    } else {
      console.log('✅ No sample doctors found - database is clean');
    }

    // Display current doctor count
    const totalDoctors = await Doctor.countDocuments();
    const activeDoctors = await Doctor.countDocuments({ isActive: true });
    
    console.log('\n📊 Current Database Status:');
    console.log(`Total Doctors: ${totalDoctors}`);
    console.log(`Active Doctors: ${activeDoctors}`);

    if (totalDoctors > 0) {
      // Show real doctors in database
      const realDoctors = await Doctor.find()
        .select('fullName email specialty uhid isActive')
        .limit(10);
      
      console.log('\n👨‍⚕️ Real Doctors in Database:');
      realDoctors.forEach((doctor, index) => {
        console.log(`${index + 1}. Dr. ${doctor.fullName} (${doctor.email}) - ${doctor.specialty} - ${doctor.isActive ? 'Active' : 'Inactive'}`);
      });
    } else {
      console.log('\n⚠️  No real doctors found in database');
      console.log('💡 You need to add real doctors through your registration system or admin panel');
    }

    console.log('\n🎉 Database cleanup completed!');
clscls
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
  clearSampleDoctors();
}

module.exports = { clearSampleDoctors };
