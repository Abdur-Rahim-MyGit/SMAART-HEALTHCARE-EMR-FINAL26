require('dotenv').config();
const mongoose = require('mongoose');

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smaart-emr', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// MedicalImage Schema
const medicalImageSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  imageUrl: String,
  imageType: String,
  title: String,
  description: String,
  createdAt: { type: Date, default: Date.now },
  // Add other fields as per your schema
}, { collection: 'medicalimages' });

const MedicalImage = mongoose.model('MedicalImage', medicalImageSchema);

// Main function to check medical images
const checkMedicalImages = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Count total documents
    const count = await MedicalImage.countDocuments({});
    console.log(`\nTotal medical images in database: ${count}`);
    
    if (count > 0) {
      // Get sample of documents
      const sample = await MedicalImage.findOne({}).limit(1);
      console.log('\nSample medical image document:');
      console.log({
        _id: sample._id,
        patientId: sample.patientId,
        imageType: sample.imageType,
        title: sample.title,
        imageUrl: sample.imageUrl ? `${sample.imageUrl.substring(0, 50)}...` : 'N/A',
        createdAt: sample.createdAt
      });
      
      // Get count by image type
      const types = await MedicalImage.aggregate([
        { $group: { _id: '$imageType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      console.log('\nCount by image type:');
      types.forEach(type => {
        console.log(`- ${type._id || 'N/A'}: ${type.count}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking medical images:', error.message);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
};

// Run the function
checkMedicalImages();
