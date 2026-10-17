'use strict';
require('dotenv').config();
const { ObjectId } = require('mongodb');
const { connectMongo, closeMongo } = require('../infrastructure/mongodb/connection');
const { withSystem } = require('../infrastructure/mongodb/tenant');
const { hashPassword } = require('../common/security/password');
const { ROLES } = require('../common/security/rbac');
const clinicService = require('../modules/clinics/clinicService');
const authService = require('../modules/auth/authService');

const USERS_TO_ADD = [
  {
    name: 'Rahim',
    email: 'rahim@gmail.com',
    password: 'rahim@123',
  },
  {
    name: 'Fareeda',
    email: 'fareeda@gmail.com',
    password: 'fareeda@123',
  },
  {
    name: 'Rashad',
    email: 'rashad@gmail.com',
    password: 'rashad@123',
  },
];

const CLINICS_TO_ONBOARD = [
  {
    name: 'SMAART Healthcare Clinic - Chennai',
    clinicId: 'CLN-CHN-001',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    address: '124 Anna Salai, Thousand Lights',
    zipCode: '600006',
    latitude: 13.0604,
    longitude: 80.2496,
    geoSource: 'pin',
    phone: '+91 44 2855 1001',
    email: 'contact.chennai@smaart.local',
    adminName: 'Chennai Admin',
    adminUsername: 'chennai',
    adminEmail: 'chennai@gmail.com',
    adminPassword: 'chennai@123',
    adminContact: '+91 98401 23456',
    ownerName: 'Dr. S. Ramanathan',
    type: 'Multi-Speciality Hospital',
    operatingHours: 'Mon-Sat 08:00 AM - 08:00 PM',
    staffCount: 35,
    beds: 25,
    pharmacyAvailable: true,
    laboratoryAvailable: true,
    specialties: ['General Medicine', 'Physiotherapy', 'Cardiology', 'Orthopedics'],
    services: ['Consultation', 'Physical Therapy', 'ECG', 'Lab Diagnostics', 'Pharmacy'],
    paymentMethods: ['Cash', 'Credit Card', 'UPI', 'Insurance'],
    validityPeriod: { duration: 12 },
  },
  {
    name: 'SMAART Healthcare Clinic - Adyar',
    clinicId: 'CLN-ADY-002',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    address: '22 Sardar Patel Road, Adyar',
    zipCode: '600020',
    latitude: 13.0012,
    longitude: 80.2565,
    geoSource: 'pin',
    phone: '+91 44 2441 2002',
    email: 'contact.adyar@smaart.local',
    adminName: 'Adyar Admin',
    adminUsername: 'adyar',
    adminEmail: 'adyar@gmail.com',
    adminPassword: 'adyar@123',
    adminContact: '+91 98402 11223',
    ownerName: 'Dr. A. Meenakshi',
    type: 'Rehabilitation & Wellness Clinic',
    operatingHours: 'Mon-Sat 08:30 AM - 08:30 PM',
    staffCount: 26,
    beds: 16,
    pharmacyAvailable: true,
    laboratoryAvailable: true,
    specialties: ['Physiotherapy', 'General Medicine', 'Pediatrics', 'Neurology'],
    services: ['Consultation', 'Physical Therapy', 'Pediatric Care', 'Vaccination', 'Pharmacy'],
    paymentMethods: ['Cash', 'Credit Card', 'UPI', 'Insurance'],
    validityPeriod: { duration: 12 },
  },
  {
    name: 'SMAART Healthcare Clinic - Anna Nagar',
    clinicId: 'CLN-ANG-003',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    address: '15 2nd Avenue, Anna Nagar',
    zipCode: '600040',
    latitude: 13.0850,
    longitude: 80.2101,
    geoSource: 'pin',
    phone: '+91 44 2621 3003',
    email: 'contact.annanagar@smaart.local',
    adminName: 'Anna Nagar Admin',
    adminUsername: 'annanagar',
    adminEmail: 'annanagar@gmail.com',
    adminPassword: 'annanagar@123',
    adminContact: '+91 98403 22334',
    ownerName: 'Dr. K. Swaminathan',
    type: 'Speciality Care Center',
    operatingHours: 'Mon-Sat 08:00 AM - 08:00 PM',
    staffCount: 30,
    beds: 18,
    pharmacyAvailable: true,
    laboratoryAvailable: true,
    specialties: ['General Medicine', 'Physiotherapy', 'Orthopedics', 'Dermatology'],
    services: ['Consultation', 'Physical Therapy', 'Orthopedic Rehab', 'Diagnostics', 'Pharmacy'],
    paymentMethods: ['Cash', 'Credit Card', 'UPI', 'Insurance'],
    validityPeriod: { duration: 12 },
  },
  {
    name: 'SMAART Healthcare Clinic - Velachery',
    clinicId: 'CLN-VEL-004',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    address: '88 Velachery Bypass Road',
    zipCode: '600042',
    latitude: 12.9815,
    longitude: 80.2180,
    geoSource: 'pin',
    phone: '+91 44 2244 4004',
    email: 'contact.velachery@smaart.local',
    adminName: 'Velachery Admin',
    adminUsername: 'velachery',
    adminEmail: 'velachery@gmail.com',
    adminPassword: 'velachery@123',
    adminContact: '+91 98404 33445',
    ownerName: 'Dr. R. Karthikeyan',
    type: 'Community Health Clinic',
    operatingHours: 'Mon-Sat 08:30 AM - 08:00 PM',
    staffCount: 22,
    beds: 12,
    pharmacyAvailable: true,
    laboratoryAvailable: true,
    specialties: ['General Medicine', 'Physiotherapy', 'Diabetology', 'Cardiology'],
    services: ['Consultation', 'Physiotherapy', 'Diabetes Care', 'ECG', 'Pharmacy'],
    paymentMethods: ['Cash', 'Credit Card', 'UPI', 'Insurance'],
    validityPeriod: { duration: 12 },
  },
  {
    name: 'SMAART Healthcare Clinic - Tambaram',
    clinicId: 'CLN-TBM-005',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    address: '50 GST Road, Tambaram Sanatorium',
    zipCode: '600047',
    latitude: 12.9249,
    longitude: 80.1000,
    geoSource: 'pin',
    phone: '+91 44 2226 5005',
    email: 'contact.tambaram@smaart.local',
    adminName: 'Tambaram Admin',
    adminUsername: 'tambaram',
    adminEmail: 'tambaram@gmail.com',
    adminPassword: 'tambaram@123',
    adminContact: '+91 98405 44556',
    ownerName: 'Dr. M. Senthil Kumar',
    type: 'Outpatient Clinic',
    operatingHours: 'Mon-Sat 09:00 AM - 08:00 PM',
    staffCount: 20,
    beds: 10,
    pharmacyAvailable: true,
    laboratoryAvailable: true,
    specialties: ['General Medicine', 'Physiotherapy', 'Pulmonology', 'Geriatrics'],
    services: ['Consultation', 'Physical Therapy', 'Geriatric Care', 'Lab Diagnostics', 'Pharmacy'],
    paymentMethods: ['Cash', 'Credit Card', 'UPI', 'Insurance'],
    validityPeriod: { duration: 12 },
  },
  {
    name: 'TTT',
    clinicId: 'CLN-TTT-006',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    address: '77 TTT Boulevard, T. Nagar',
    zipCode: '600017',
    latitude: 13.0418,
    longitude: 80.2341,
    geoSource: 'pin',
    phone: '+91 44 2434 7777',
    email: 'contact.ttt@smaart.local',
    adminName: 'TTT Admin',
    adminUsername: 'ttt',
    adminEmail: 'ttt@gmail.com',
    adminPassword: 'ttt@123',
    adminContact: '+91 98406 77777',
    ownerName: 'Dr. T. Thiyagarajan',
    type: 'Multi-Speciality Hospital',
    operatingHours: 'Mon-Sat 08:00 AM - 08:00 PM',
    staffCount: 32,
    beds: 22,
    pharmacyAvailable: true,
    laboratoryAvailable: true,
    specialties: ['General Medicine', 'Physiotherapy', 'Cardiology', 'Orthopedics'],
    services: ['Consultation', 'Physical Therapy', 'ECG', 'Lab Diagnostics', 'Pharmacy'],
    paymentMethods: ['Cash', 'Credit Card', 'UPI', 'Insurance'],
    validityPeriod: { duration: 12 },
  },
  {
    name: 'SMAART Healthcare Clinic - Coimbatore',
    clinicId: 'CLN-CBE-007',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    country: 'India',
    address: '45 DB Road, RS Puram',
    zipCode: '641002',
    latitude: 11.0168,
    longitude: 76.9558,
    geoSource: 'pin',
    phone: '+91 422 254 2002',
    email: 'contact.coimbatore@smaart.local',
    adminName: 'Coimbatore Admin',
    adminUsername: 'coimbatore',
    adminEmail: 'coimbatore@gmail.com',
    adminPassword: 'coimbatore@123',
    adminContact: '+91 98402 34567',
    ownerName: 'Dr. K. Balasubramanian',
    type: 'Rehabilitation & Wellness Clinic',
    operatingHours: 'Mon-Sat 08:30 AM - 08:30 PM',
    staffCount: 28,
    beds: 15,
    pharmacyAvailable: true,
    laboratoryAvailable: true,
    specialties: ['General Medicine', 'Physiotherapy', 'Neurology', 'Pediatrics'],
    services: ['Consultation', 'Physical Therapy', 'Pediatric Care', 'Vaccination', 'Pharmacy'],
    paymentMethods: ['Cash', 'Credit Card', 'UPI', 'Insurance'],
    validityPeriod: { duration: 12 },
  },
  {
    name: 'SMAART Healthcare Clinic - Madurai',
    clinicId: 'CLN-MDU-008',
    city: 'Madurai',
    state: 'Tamil Nadu',
    country: 'India',
    address: '78 KK Nagar Main Road',
    zipCode: '625020',
    latitude: 9.9252,
    longitude: 78.1198,
    geoSource: 'pin',
    phone: '+91 452 245 3003',
    email: 'contact.madurai@smaart.local',
    adminName: 'Madurai Admin',
    adminUsername: 'madurai',
    adminEmail: 'madurai@gmail.com',
    adminPassword: 'madurai@123',
    adminContact: '+91 98403 45678',
    ownerName: 'Dr. M. Soundararajan',
    type: 'Speciality Care Center',
    operatingHours: 'Mon-Sat 08:00 AM - 08:00 PM',
    staffCount: 22,
    beds: 12,
    pharmacyAvailable: true,
    laboratoryAvailable: true,
    specialties: ['General Medicine', 'Physiotherapy', 'Dermatology', 'Orthopedics'],
    services: ['Consultation', 'Rehabilitation', 'Skin Clinic', 'Pharmacy', 'Laboratory'],
    paymentMethods: ['Cash', 'Credit Card', 'UPI', 'Insurance'],
    validityPeriod: { duration: 12 },
  },
  {
    name: 'SMAART Healthcare Clinic - Trichy',
    clinicId: 'CLN-TRY-009',
    city: 'Tiruchirappalli',
    state: 'Tamil Nadu',
    country: 'India',
    address: '12 Thillai Nagar 11th Cross',
    zipCode: '620018',
    latitude: 10.7905,
    longitude: 78.7047,
    geoSource: 'pin',
    phone: '+91 431 276 4004',
    email: 'contact.trichy@smaart.local',
    adminName: 'Trichy Admin',
    adminUsername: 'trichy',
    adminEmail: 'trichy@gmail.com',
    adminPassword: 'trichy@123',
    adminContact: '+91 98404 56789',
    ownerName: 'Dr. R. Senthamilselvan',
    type: 'Community Health Clinic',
    operatingHours: 'Mon-Sat 08:30 AM - 07:30 PM',
    staffCount: 20,
    beds: 10,
    pharmacyAvailable: true,
    laboratoryAvailable: true,
    specialties: ['General Medicine', 'Physiotherapy', 'ENT', 'Diabetology'],
    services: ['Consultation', 'Physical Therapy', 'Hearing Test', 'Diabetes Care', 'Pharmacy'],
    paymentMethods: ['Cash', 'Credit Card', 'UPI', 'Insurance'],
    validityPeriod: { duration: 12 },
  },
  {
    name: 'SMAART Healthcare Clinic - Salem',
    clinicId: 'CLN-SLM-010',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    address: '89 Meyyanur Bypass Road, Fairlands',
    zipCode: '636004',
    latitude: 11.6643,
    longitude: 78.1460,
    geoSource: 'pin',
    phone: '+91 427 244 5005',
    email: 'contact.salem@smaart.local',
    adminName: 'Salem Admin',
    adminUsername: 'salem',
    adminEmail: 'salem@gmail.com',
    adminPassword: 'salem@123',
    adminContact: '+91 98405 67890',
    ownerName: 'Dr. V. Murugan',
    type: 'Outpatient Clinic',
    operatingHours: 'Mon-Sat 09:00 AM - 08:00 PM',
    staffCount: 18,
    beds: 8,
    pharmacyAvailable: true,
    laboratoryAvailable: true,
    specialties: ['General Medicine', 'Physiotherapy', 'Pulmonology', 'Geriatrics'],
    services: ['Consultation', 'Physiotherapy', 'Spirometry', 'Elderly Care', 'Pharmacy'],
    paymentMethods: ['Cash', 'Credit Card', 'UPI', 'Insurance'],
    validityPeriod: { duration: 12 },
  },
];

async function main() {
  console.log('Connecting to MongoDB...');
  await connectMongo();

  const scope = {
    role: ROLES.SUPER_MASTER_ADMIN,
    clinicId: null,
    userId: 'seed-admin',
  };
  const ctx = { requestId: 'seed-task', ip: '127.0.0.1' };

  console.log('\n--- 1. CREATING / UPDATING USERS ---');
  for (const user of USERS_TO_ADD) {
    const email = user.email.toLowerCase();
    const passwordHash = await hashPassword(user.password);
    const [firstName, ...rest] = user.name.split(' ');

    await withSystem(async (db) => {
      const usersCol = db.c('users');
      const existing = await usersCol.findOne({ email }, { includeDeleted: true });
      if (existing) {
        await usersCol.updateOne(
          { _id: existing._id },
          {
            passwordHash,
            role: ROLES.SUPER_MASTER_ADMIN,
            clinicId: null,
            firstName,
            lastName: rest.join(' ') || null,
            fullName: user.name,
            isActive: true,
            isVerified: true,
            deletedAt: null,
            failedLoginAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: new Date(),
          },
          { includeDeleted: true }
        );
        console.log(`✓ Updated user: ${user.name} (${email}) | Pass: ${user.password}`);
      } else {
        await usersCol.insertOne({
          email,
          passwordHash,
          role: ROLES.SUPER_MASTER_ADMIN,
          clinicId: null,
          firstName,
          lastName: rest.join(' ') || null,
          fullName: user.name,
          phone: null,
          username: user.name.toLowerCase(),
          isActive: true,
          isVerified: true,
          lastLoginAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
        });
        console.log(`✓ Created user: ${user.name} (${email}) | Pass: ${user.password}`);
      }

      // Also mirror to legacy admins collection if it exists
      const { getDb } = require('../infrastructure/mongodb/connection');
      await getDb().collection('admins').updateOne(
        { email },
        {
          $set: {
            name: user.name,
            email,
            password: passwordHash,
            role: 'admin',
            updatedAt: new Date(),
          },
          $setOnInsert: {
            _id: new ObjectId(),
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    });
  }

  console.log('\n--- 2. ONBOARDING 5 CLINICS ---');
  const { getDb } = require('../infrastructure/mongodb/connection');
  const rawClinics = getDb().collection('clinics');
  // Fix any clinic missing clinicId
  await rawClinics.updateMany({ clinicId: { $exists: false } }, [
    { $set: { clinicId: { $ifNull: ['$clinicCode', { $toString: '$_id' }] } } },
  ]);
  try {
    const idxs = await rawClinics.indexes();
    const cIdIdx = idxs.find((i) => i.name === 'clinicId_1');
    if (cIdIdx && !cIdIdx.sparse) {
      console.log('Rebuilding clinicId_1 index as sparse...');
      await rawClinics.dropIndex('clinicId_1');
      await rawClinics.createIndex({ clinicId: 1 }, { unique: true, sparse: true });
    }
  } catch (e) {
    console.warn('Index rebuild note:', e.message);
  }

  for (const clinicInput of CLINICS_TO_ONBOARD) {
    const adminEmail = clinicInput.adminEmail.toLowerCase();
    let clinicResult;

    await withSystem(async (db) => {
      const existingClinic = await db.c('clinics').findOne({
        $or: [{ name: clinicInput.name }, { adminEmail }],
      });

      if (existingClinic) {
        console.log(`Clinic '${clinicInput.name}' already exists (_id: ${existingClinic._id}). Updating admin credentials...`);
        await clinicService.update(
          scope,
          existingClinic._id,
          {
            ...clinicInput,
            adminEmail: clinicInput.adminEmail,
            adminPassword: clinicInput.adminPassword,
          },
          ctx
        );
        clinicResult = existingClinic;
        console.log(`✓ Updated clinic: ${clinicInput.name} | City: ${clinicInput.city}`);
      } else {
        // Also check if admin user exists beforehand
        const existingAdminUser = await db.c('users').findOne({ email: adminEmail }, { includeDeleted: true });
        if (existingAdminUser) {
          await db.c('users').deleteOne({ _id: existingAdminUser._id });
        }
        clinicResult = await clinicService.create(scope, clinicInput, ctx);
        console.log(`✓ Created clinic: ${clinicResult.name} (_id: ${clinicResult._id}) | City: ${clinicInput.city}`);
      }
    });
  }

  console.log('\n--- 3. VERIFYING AUTHENTICATION ---');
  for (const u of USERS_TO_ADD) {
    try {
      const res = await authService.passwordLogin(
        { email: u.email, password: u.password },
        { ip: '127.0.0.1', userAgent: 'seed-test', requestId: 'verify' }
      );
      console.log(`✓ Login SUCCESS for user ${u.name}: [${u.email}] -> Role: ${res.user.role}`);
    } catch (err) {
      console.error(`✗ Login FAILED for user ${u.name}: [${u.email}] ->`, err.message);
    }
  }

  for (const c of CLINICS_TO_ONBOARD) {
    try {
      const res = await authService.clinicLogin(
        { email: c.adminEmail, password: c.adminPassword },
        { ip: '127.0.0.1', userAgent: 'seed-test', requestId: 'verify' }
      );
      console.log(`✓ Clinic Login SUCCESS for ${c.city} clinic: [${c.adminEmail}] -> Clinic: ${res.clinic.name}`);
    } catch (err) {
      console.error(`✗ Clinic Login FAILED for ${c.city}: [${c.adminEmail}] ->`, err.message);
    }
  }

  console.log('\nAll users and clinics onboarded and verified successfully!');
}

main()
  .then(() => closeMongo())
  .catch(async (err) => {
    console.error('Migration failed:', err);
    await closeMongo();
    process.exit(1);
  });
