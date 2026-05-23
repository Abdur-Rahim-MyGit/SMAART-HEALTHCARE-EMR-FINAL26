const mongoose = require('mongoose');

// Database configuration and connection setup
const connectDB = async () => {
  try {
    // MongoDB connection string for local development with MongoDB Compass
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/emr_healthcare_db';
    
    // Connection options for better performance and compatibility
    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    const conn = await mongoose.connect(mongoURI, options);

    console.log('🚀 EMR Healthcare System - Database Connection Status');
    console.log('='.repeat(50));
    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`📍 Database Name: ${conn.connection.name}`);
    console.log(`🌐 Host: ${conn.connection.host}:${conn.connection.port}`);
    console.log(`🔗 Connection String: ${mongoURI}`);
    console.log('='.repeat(50));
    console.log('💡 MongoDB Compass Instructions:');
    console.log('   1. Open MongoDB Compass');
    console.log('   2. Use connection string: mongodb://localhost:27017');
    console.log('   3. Database name: emr_healthcare_db');
    console.log('='.repeat(50));
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

    return conn;
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('\n💡 Troubleshooting Tips:');
    console.log('   1. Make sure MongoDB is installed and running');
    console.log('   2. Check if MongoDB service is started');
    console.log('   3. Verify connection string: mongodb://localhost:27017');
    console.log('   4. For Windows: Start MongoDB service or run mongod.exe');
    console.log('   5. For MongoDB Compass: Use mongodb://localhost:27017\n');
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('📴 MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    console.error('Error during database disconnection:', error);
    process.exit(1);
  }
});

module.exports = connectDB;
