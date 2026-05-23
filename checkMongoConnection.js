require('dotenv').config();
const mongoose = require('mongoose');

console.log('Connecting to MongoDB...');
console.log('Connection string:', process.env.MONGODB_URI);

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);
    return conn.connection.db;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

const checkConnection = async () => {
  try {
    const db = await connectDB();
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n=== Collections ===');
    
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`- ${collection.name}: ${count} documents`);
    }
    
    // Check if medicalimages collection exists
    const hasMedicalImages = collections.some(c => c.name === 'medicalimages');
    
    if (hasMedicalImages) {
      console.log('\nMedical Images Collection:');
      const medicalImages = db.collection('medicalimages');
      const count = await medicalImages.countDocuments();
      console.log(`Total documents: ${count}`);
      
      if (count > 0) {
        const sample = await medicalImages.findOne({});
        console.log('Sample document:', JSON.stringify(sample, null, 2));
      }
    } else {
      console.log('\nMedical Images collection not found.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nConnection closed.');
  }
};

checkConnection();
