const { MongoClient } = require('mongodb');

// Connection URI
const uri = 'mongodb+srv://souban:souban123@smaartdb.turl6oh.mongodb.net/?retryWrites=true&w=majority&appName=SmaartDB';

async function main() {
  const client = new MongoClient(uri);
  
  try {
    // Connect to the MongoDB cluster
    await client.connect();
    console.log('Connected to MongoDB');
    
    // Connect to the test database
    const database = client.db('test');
    const medicalImages = database.collection('medicalimages');
    const patients = database.collection('patients');
    
    // Get a patient ID (you can replace this with a specific patient ID)
    const patient = await patients.findOne({});
    
    if (!patient) {
      console.log('No patients found in the database.');
      return;
    }
    
    console.log(`\nPatient: ${patient.fullName} (ID: ${patient._id})`);
    
    // Find all medical images for this patient
    const images = await medicalImages.find({ patientId: patient._id.toString() }).toArray();
    
    console.log(`\nFound ${images.length} medical images for this patient.`);
    
    if (images.length > 0) {
      console.log('\nMedical Images:');
      images.forEach((img, index) => {
        console.log(`\n[${index + 1}] ${img.title} (${img.imageType})`);
        console.log(`- URL: ${img.imageUrl || img.cloudinaryUrl}`);
        console.log(`- Uploaded: ${new Date(img.uploadedAt || img.createdAt).toLocaleDateString()}`);
        console.log(`- Body Part: ${img.bodyPart || 'Not specified'}`);
        console.log(`- Description: ${img.description || 'No description'}`);
      });
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
