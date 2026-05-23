const { MongoClient } = require('mongodb');

// Connection URI - Replace with your actual MongoDB connection string
const uri = 'mongodb+srv://souban:souban123@smaartdb.turl6oh.mongodb.net/?retryWrites=true&w=majority&appName=SmaartDB';

async function main() {
  const client = new MongoClient(uri);
  
  try {
    // Connect to the MongoDB cluster
    await client.connect();
    console.log('Connected to MongoDB');
    
    // Connect to the database
    const database = client.db('SmaartDB');
    
    // List all collections
    const collections = await database.listCollections().toArray();
    console.log('\n=== Collections ===');
    console.log(collections.map(c => c.name).join('\n'));
    
    // Check if medicalimages collection exists
    const medicalImages = database.collection('medicalimages');
    const count = await medicalImages.countDocuments();
    
    console.log(`\nMedical Images Collection: ${count} documents`);
    
    if (count > 0) {
      // Get a sample document
      const sample = await medicalImages.findOne({});
      console.log('\nSample Medical Image Document:');
      console.log(JSON.stringify(sample, null, 2));
      
      // Get count by image type
      const types = await medicalImages.aggregate([
        { $group: { _id: '$imageType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      
      console.log('\nCount by Image Type:');
      types.forEach(type => {
        console.log(`- ${type._id || 'N/A'}: ${type.count}`);
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
