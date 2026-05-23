const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/emr_healthcare', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const patientSchema = new mongoose.Schema({}, { strict: false });
const Patient = mongoose.model('Patient', patientSchema);

async function migrateGenderValues() {
  try {
    console.log('🔄 Starting gender values migration...');
    
    // Update all existing patients with old gender values
    const updates = [
      { from: 'Male', to: 'male' },
      { from: 'Female', to: 'female' },
      { from: 'Other', to: 'other' },
      { from: 'Prefer not to say', to: 'prefer_not_to_say' }
    ];

    for (const update of updates) {
      const result = await Patient.updateMany(
        { gender: update.from },
        { $set: { gender: update.to } }
      );
      console.log(`✅ Updated ${result.modifiedCount} patients from '${update.from}' to '${update.to}'`);
    }

    console.log('🎉 Gender values migration completed successfully!');
    
    // Display current gender distribution
    const genderStats = await Patient.aggregate([
      { $group: { _id: '$gender', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('\n📊 Current gender distribution:');
    genderStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} patients`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
}

migrateGenderValues();
