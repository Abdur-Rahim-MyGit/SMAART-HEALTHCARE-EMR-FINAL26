const mongoose = require('mongoose');
const connectDB = require('./config/database');

async function checkDatabase() {
  try {
    await connectDB();
    console.log('✅ Successfully connected to database');

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Available collections:');
    if (collections.length === 0) {
      console.log('   No collections found');
    } else {
      collections.forEach(collection => {
        console.log('   -', collection.name);
      });
    }

    // Check referrals collection
    const Referral = require('./models/Referral');
    const referralCount = await Referral.countDocuments();
    console.log(`🔢 Total referrals in database: ${referralCount}`);

    // Show sample referrals if any exist
    if (referralCount > 0) {
      const sampleReferrals = await Referral.find({}).limit(3);
      console.log('📋 Sample referrals:');
      sampleReferrals.forEach((ref, index) => {
        console.log(`   ${index + 1}. ${ref.patientName} -> ${ref.specialistName} (${ref.status})`);
      });
    } else {
      console.log('📭 No referrals found in database');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

checkDatabase();
