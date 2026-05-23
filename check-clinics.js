require('dotenv').config();
const mongoose = require('mongoose');
const Clinic = require('./models/Clinic');

async function checkClinics() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smaart-emr');
    console.log('Connected to MongoDB');

    const clinics = await Clinic.find({}).select('name adminEmail adminUsername adminPassword isActive isExpired');
    console.log('📋 Found', clinics.length, 'clinics:');

    clinics.forEach((clinic, index) => {
      console.log(`\n🏥 Clinic ${index + 1}:`);
      console.log(`   Name: ${clinic.name}`);
      console.log(`   Admin Email: ${clinic.adminEmail}`);
      console.log(`   Admin Username: ${clinic.adminUsername}`);
      console.log(`   Has Password: ${clinic.adminPassword ? 'YES' : 'NO'}`);
      console.log(`   Password Length: ${clinic.adminPassword ? clinic.adminPassword.length : 0}`);
      console.log(`   Is Active: ${clinic.isActive}`);
      console.log(`   Is Expired: ${clinic.isExpired ? 'YES' : 'NO'}`);

      // Show first few characters of password for debugging
      if (clinic.adminPassword) {
        console.log(`   Password Preview: "${clinic.adminPassword.substring(0, 3)}...${clinic.adminPassword.substring(clinic.adminPassword.length - 3)}"`);
      }
    });

    if (clinics.length === 0) {
      console.log('\n❌ No clinics found in database!');
      console.log('💡 You may need to create a clinic first through the Super Master Admin dashboard.');
    }

  } catch (error) {
    console.error('❌ Error checking clinics:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkClinics();
