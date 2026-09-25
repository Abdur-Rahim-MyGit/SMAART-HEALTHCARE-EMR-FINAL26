const mongoose = require('mongoose');
const Patient = require('../models/Patient');

mongoose.connect('mongodb+srv://<REDACTED-ROTATE-THIS-CREDENTIAL>')
.then(async () => {
  console.log('Checking existing patients...');
  const patients = await Patient.find({});
  console.log('Existing patients:', patients.length);
  
  if (patients.length > 0) {
    patients.forEach(p => {
      console.log('- ID:', p._id.toString(), 'Name:', p.fullName);
    });
  } else {
    console.log('No patients found in database');
  }
  
  mongoose.connection.close();
})
.catch(err => {
  console.error('Error:', err.message);
  mongoose.connection.close();
});
