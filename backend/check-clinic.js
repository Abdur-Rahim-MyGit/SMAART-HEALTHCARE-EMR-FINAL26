const mongoose = require("mongoose");
const MONGODB_URI = "mongodb+srv://souban:souban123@smaartdb.turl6oh.mongodb.net/emr_healthcare_db?retryWrites=true&w=majority&appName=SmaartDB";

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");
    const db = mongoose.connection.db;
    const clinics = await db.collection("clinics").find({}).sort({createdAt: -1}).limit(1).toArray();
    console.log("Latest clinic:");
    console.log(JSON.stringify(clinics[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
