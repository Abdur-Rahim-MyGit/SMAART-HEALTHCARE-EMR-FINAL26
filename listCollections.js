require('dotenv').config();
const mongoose = require('mongoose');

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smaart-emr');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn.connection.db;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Main function to list collections
const listCollections = async () => {
  let client;
  try {
    // Connect to database
    const db = await connectDB();
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    
    console.log('\n=== Database Collections ===');
    
    // Get count for each collection
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`- ${collection.name}: ${count} documents`);
      
      // If it's the medicalimages collection, show some details
      if (collection.name === 'medicalimages' && count > 0) {
        const sample = await db.collection('medicalimages').findOne({});
        console.log('  Sample document:');
        console.log(JSON.stringify(sample, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error listing collections:', error.message);
  } finally {
    // Close the connection
    if (mongoose.connection) {
      await mongoose.connection.close();
      console.log('\nDatabase connection closed.');
    }
  }
};

// Run the function
listCollections();
