const { MongoClient } = require('mongodb');

// Connection URI
const uri = 'mongodb+srv://<REDACTED-ROTATE-THIS-CREDENTIAL>';

async function main() {
  const client = new MongoClient(uri);
  
  try {
    // Connect to the MongoDB cluster
    await client.connect();
    console.log('Connected to MongoDB');
    
    // List all databases
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();
    
    console.log('\n=== Available Databases ===');
    databases.databases.forEach(db => {
      console.log(`- ${db.name} (Size: ${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    // For each database, list collections
    for (const dbInfo of databases.databases) {
      if (dbInfo.name === 'admin' || dbInfo.name === 'local' || dbInfo.name === 'config') continue;
      
      console.log(`\n=== Collections in ${dbInfo.name} ===`);
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      
      if (collections.length > 0) {
        for (const collection of collections) {
          const count = await db.collection(collection.name).countDocuments();
          console.log(`- ${collection.name}: ${count} documents`);
          
          // Show a sample document for collections with data
          if (count > 0 && (collection.name === 'medicalimages' || collection.name === 'patients')) {
            const sample = await db.collection(collection.name).findOne({});
            console.log('  Sample document:');
            console.log(JSON.stringify(sample, null, 2));
          }
        }
      } else {
        console.log('No collections found');
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
