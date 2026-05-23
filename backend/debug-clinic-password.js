require('dotenv').config();
const mongoose = require('mongoose');
const Clinic = require('./models/Clinic');

async function debugClinicPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smaart-emr');
    console.log('Connected to MongoDB');

    // Find the clinic by email
    const clinic = await Clinic.findOne({ adminEmail: 'smaartdatabase@gmail.com' });

    if (!clinic) {
      console.log('❌ Clinic not found with email: smaartdatabase@gmail.com');
      await mongoose.disconnect();
      return;
    }

    console.log('🏥 Found clinic:', clinic.name);
    console.log('📧 Admin Email:', clinic.adminEmail);
    console.log('🔑 Password exists:', !!clinic.adminPassword);

    if (clinic.adminPassword) {
      console.log('📏 Password length:', clinic.adminPassword.length);
      console.log('🔍 Password starts with:', clinic.adminPassword.substring(0, 3));
      console.log('🔍 Password ends with:', clinic.adminPassword.substring(clinic.adminPassword.length - 3));
      console.log('🔍 Password contains spaces:', clinic.adminPassword.includes(' '));
      console.log('🔍 Password contains newlines:', clinic.adminPassword.includes('\n') || clinic.adminPassword.includes('\r'));

      // Check for common issues
      const trimmedPassword = clinic.adminPassword.trim();
      console.log('✂️  After trim length:', trimmedPassword.length);
      console.log('🔄 Password changed after trim:', clinic.adminPassword !== trimmedPassword);
    }

    console.log('🟢 Is Active:', clinic.isActive);
    console.log('⏰ Is Expired:', clinic.isExpired ? 'YES' : 'NO');

    // Test the login logic
    console.log('\n🧪 TESTING LOGIN LOGIC:');
    const testPasswords = [
      'password123',
      'Password123',
      'password123 ',
      ' password123',
      'password123\n',
      clinic.adminPassword || '',
      (clinic.adminPassword || '').trim()
    ];

    testPasswords.forEach((testPwd, index) => {
      const matches = clinic.adminPassword === testPwd;
      console.log(`Test ${index + 1}: "${testPwd.replace(/\n/g, '\\n')}" → ${matches ? '✅ MATCH' : '❌ NO MATCH'}`);
    });

  } catch (error) {
    console.error('❌ Error debugging clinic password:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugClinicPassword();
