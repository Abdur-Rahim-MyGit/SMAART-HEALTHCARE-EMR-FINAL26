const mongoose = require('mongoose');
const connectDB = require('../config/database');

async function checkReferrals() {
  try {
    await connectDB();
    console.log('✅ Successfully connected to database');

    // Import Referral model
    const Referral = require('../models/Referral');

    // Get total count
    const referralCount = await Referral.countDocuments();
    console.log(`🔢 Total referrals in database: ${referralCount}`);

    if (referralCount > 0) {
      console.log('\n📋 All Referrals in Database:');
      console.log('='.repeat(80));

      const referrals = await Referral.find({})
        .populate('patientId', 'fullName phone email')
        .sort({ createdAt: -1 });

      referrals.forEach((referral, index) => {
        console.log(`${index + 1}. ${referral.patientName} -> ${referral.specialistName}`);
        console.log(`   Specialty: ${referral.specialty}`);
        console.log(`   Reason: ${referral.reason}`);
        console.log(`   Urgency: ${referral.urgency}`);
        console.log(`   Status: ${referral.status}`);
        console.log(`   Created: ${referral.createdAt.toLocaleDateString()}`);
        if (referral.patientId) {
          console.log(`   Patient Phone: ${referral.patientId.phone || 'N/A'}`);
        }
        console.log('');
      });

      // Show statistics
      console.log('📊 Referral Statistics:');
      console.log('-'.repeat(40));
      const stats = await Referral.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      stats.forEach(stat => {
        console.log(`   ${stat._id}: ${stat.count}`);
      });

      const urgencyStats = await Referral.aggregate([
        { $group: { _id: '$urgency', count: { $sum: 1 } } }
      ]);

      console.log('\n   By Urgency:');
      urgencyStats.forEach(stat => {
        console.log(`   ${stat._id}: ${stat.count}`);
      });

    } else {
      console.log('📭 No referrals found in database');
      console.log('\n💡 To add sample referrals, run: node scripts/add-sample-referrals.js');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error checking referrals:', error.message);
  }
}

checkReferrals();
