require('dotenv').config();
const mongoose = require('mongoose');
const Clinic = require('./models/Clinic');

async function createTestClinic() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smaart-emr');
    console.log('Connected to MongoDB');

    // Check if test clinic already exists
    const existingClinic = await Clinic.findOne({ adminEmail: 'clinic@admin.com' });
    if (existingClinic) {
      console.log('✅ Test clinic already exists!');
      console.log('🏥 Clinic Details:');
      console.log('   Name:', existingClinic.name);
      console.log('   Admin Email:', existingClinic.adminEmail);
      console.log('   Admin Username:', existingClinic.adminUsername);
      console.log('   Password: test123');
      console.log('   Is Active:', existingClinic.isActive);
      await mongoose.disconnect();
      return;
    }

    // Create a test clinic
    const testClinic = new Clinic({
      name: 'Test Medical Clinic',
      type: 'Multi speciality',
      registrationNumber: 'TEST001',
      yearOfEstablishment: 2024,
      address: '123 Test Street',
      city: 'Test City',
      state: 'Test State',
      country: 'India',
      zipCode: '110001',
      phone: '9876543210',
      email: 'info@testclinic.com',
      website: 'https://testclinic.com',

      // Admin credentials
      adminName: 'Clinic Admin',
      adminContact: '9876543210',
      adminEmail: 'clinic@admin.com',
      adminUsername: 'clinicadmin',
      adminPassword: 'test123', // Plain text for clinics

      // Owner information (required)
      ownerName: 'Dr. Test Owner',
      ownerMedicalId: 'MED001',

      // Clinic ID
      clinicId: 'TEST' + Math.floor(100 + Math.random() * 900),

      // Validity period (1 year from now)
      validityPeriod: {
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        duration: 12
      },

      isActive: true,
      isExpired: false,

      // Default arrays
      specialties: ['General Medicine', 'Cardiology'],
      services: ['Consultation', 'Diagnosis'],
      operatingHours: '9 AM - 6 PM',
      paymentMethods: ['Cash', 'Card', 'UPI'],
    });

    await testClinic.save();
    console.log('✅ Test clinic created successfully!');
    console.log('');
    console.log('🏥 Clinic Details:');
    console.log('   Name:', testClinic.name);
    console.log('   Admin Email:', testClinic.adminEmail);
    console.log('   Admin Username:', testClinic.adminUsername);
    console.log('   Password: test123');
    console.log('   Is Active:', testClinic.isActive);
    console.log('');
    console.log('🔐 You can now login with:');
    console.log('   Email: clinic@admin.com');
    console.log('   Password: test123');
    console.log('');
    console.log('📍 Remember to select "Clinic Login" from the login page!');

  } catch (error) {
    console.error('❌ Error creating test clinic:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createTestClinic();
