const { MongoClient } = require('mongodb');

// Connection URI
const uri = 'mongodb+srv://souban:souban123@smaartdb.turl6oh.mongodb.net/?retryWrites=true&w=majority&appName=SmaartDB';

async function main() {
  const client = new MongoClient(uri);
  
  try {
    // Connect to the MongoDB cluster
    await client.connect();
    console.log('Connected to MongoDB');
    
    // Connect to the database
    const database = client.db('SmaartDB');
    const patients = database.collection('patients');
    
    // Get total count of patients
    const count = await patients.countDocuments();
    console.log(`\nTotal Patients: ${count}`);
    
    if (count > 0) {
      // Get a sample patient
      const samplePatient = await patients.findOne({});
      console.log('\nSample Patient:');
      console.log(JSON.stringify({
        _id: samplePatient._id,
        fullName: samplePatient.fullName,
        uhid: samplePatient.uhid,
        phone: samplePatient.phone,
        email: samplePatient.email,
        gender: samplePatient.gender,
        dateOfBirth: samplePatient.dateOfBirth,
        // Add other fields you're interested in
      }, null, 2));
      
      // Check if patient has any images
      const medicalImages = database.collection('medicalimages');
      const imageCount = await medicalImages.countDocuments({ patientId: samplePatient._id });
      console.log(`\nThis patient has ${imageCount} medical images.`);
      
      if (imageCount > 0) {
        const sampleImage = await medicalImages.findOne({ patientId: samplePatient._id });
        console.log('\nSample Medical Image:');
        console.log(JSON.stringify({
          _id: sampleImage._id,
          title: sampleImage.title,
          imageType: sampleImage.imageType,
          imageUrl: sampleImage.imageUrl,
          uploadedAt: sampleImage.uploadedAt
        }, null, 2));
      }
    }
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    // Close the connection
    await client.close();
    console.log('\nConnection closed.');
  }
}

main().catch(console.error);
