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
    
    // Get all medical images
    const allImages = await medicalImages.find({}).toArray();
    
    console.log(`\nFound ${allImages.length} medical images in total.`);
    
    if (allImages.length > 0) {
      console.log('\n=== Medical Images ===');
      
      // Group images by patient
      const imagesByPatient = {};
      
      for (const img of allImages) {
        const patientId = img.patientId;
        if (!imagesByPatient[patientId]) {
          imagesByPatient[patientId] = [];
        }
        imagesByPatient[patientId].push(img);
      }
      
      // Display images by patient
      for (const [patientId, images] of Object.entries(imagesByPatient)) {
        let patientName = 'Unknown Patient';
        
        try {
          const patient = await patients.findOne({ _id: patientId });
          if (patient && patient.fullName) {
            patientName = patient.fullName;
          }
        } catch (e) {
          console.error(`Error fetching patient ${patientId}:`, e.message);
        }
        
        console.log(`\nPatient: ${patientName} (ID: ${patientId})`);
        console.log(`- Total Images: ${images.length}`);
        
        // Group by image type
        const byType = {};
        images.forEach(img => {
          const type = img.imageType || 'Uncategorized';
          if (!byType[type]) byType[type] = [];
          byType[type].push(img);
        });
        
        // Display by type
        for (const [type, typeImages] of Object.entries(byType)) {
          console.log(`\n  ${type} (${typeImages.length}):`);
          typeImages.forEach((img, idx) => {
            console.log(`  ${idx + 1}. ${img.title || 'Untitled'}`);
            console.log(`     URL: ${img.imageUrl || img.cloudinaryUrl || 'No URL available'}`);
            console.log(`     Uploaded: ${new Date(img.uploadedAt || img.createdAt).toLocaleString()}`);
            if (img.description) console.log(`     Description: ${img.description}`);
          });
        }
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
