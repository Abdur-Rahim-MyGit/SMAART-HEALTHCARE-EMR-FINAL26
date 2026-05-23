const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import the Clinic model
const Clinic = require('../models/Clinic');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/emr_healthcare_db');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Sample clinic data
const sampleClinics = [
  {
    clinicId: "CLINIC001",
    name: "HealWell Clinic",
    type: "Multispeciality",
    registrationNumber: "REG2025HW01",
    yearOfEstablishment: 2020,
    address: "12 MG Road",
    city: "Bangalore",
    state: "Karnataka",
    country: "India",
    zipCode: "560001",
    phone: "9845012345",
    email: "info@healwell.in",
    website: "www.healwell.in",
    ownerName: "Dr. Ramesh Kumar",
    adminContact: "9845098765",
    adminEmail: "admin@healwell.in",
    specialties: ["General Medicine", "Cardiology", "Orthopedics"],
    services: ["Physio", "Nutrition", "Pharmacy"],
    adminUsername: "healadmin1",
    adminPassword: "Heal@123",
    gstNumber: "29ABCDE1234F1Z5",
    panNumber: "ABCDE1234F",
    tanNumber: "BLRT12345A",
    bankAccountNumber: "50123456789",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC002",
    name: "MindCare Centre",
    type: "Mental Health",
    registrationNumber: "REG2025MC02",
    yearOfEstablishment: 2019,
    address: "45 Green Street",
    city: "Chennai",
    state: "Tamil Nadu",
    country: "India",
    zipCode: "600042",
    phone: "9841022334",
    email: "care@mindcare.in",
    ownerName: "Dr. Priya Menon",
    adminContact: "9841076543",
    adminEmail: "admin@mindcare.in",
    specialties: ["Psychology", "Psychiatry", "Counseling"],
    services: ["Minds", "Nutrition"],
    adminUsername: "mindadmin",
    adminPassword: "Mind@001",
    gstNumber: "33ABCFD5678H1Z6",
    panNumber: "ABCFD5678H",
    tanNumber: "CHNT56789A",
    bankAccountNumber: "60123456788",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC003",
    name: "PhysioPoint",
    type: "Physiotherapy",
    registrationNumber: "REG2025PP03",
    yearOfEstablishment: 2021,
    address: "77 Residency Road",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    zipCode: "500081",
    phone: "9000012345",
    email: "contact@physiopoint.in",
    website: "www.physiopoint.in",
    ownerName: "Dr. Arjun Rao",
    adminContact: "9000076543",
    adminEmail: "admin@physiopoint.in",
    specialties: ["Physiotherapy", "Sports Medicine", "Rehabilitation"],
    services: ["Physio", "Balance"],
    adminUsername: "physioadmin",
    adminPassword: "Physio@22",
    gstNumber: "36ABCGJ8901L1Z7",
    panNumber: "ABCGJ8901L",
    tanNumber: "HYDT12390B",
    bankAccountNumber: "70123456787",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC004",
    name: "NutriPlus Clinic",
    type: "Nutrition & Wellness",
    registrationNumber: "REG2025NP04",
    yearOfEstablishment: 2018,
    address: "10 Anna Salai",
    city: "Chennai",
    state: "Tamil Nadu",
    country: "India",
    zipCode: "600002",
    phone: "9884009988",
    email: "hello@nutriplus.in",
    website: "www.nutriplus.in",
    ownerName: "Dr. Shalini Gupta",
    adminContact: "9884065432",
    adminEmail: "admin@nutriplus.in",
    specialties: ["Nutrition", "Dietetics", "Wellness"],
    services: ["Nutrition", "ReproX"],
    adminUsername: "nutriadmin",
    adminPassword: "Nutri@321",
    gstNumber: "33ABCIK3456P1Z9",
    panNumber: "ABCIK3456P",
    tanNumber: "CHNT65432B",
    bankAccountNumber: "80123456786",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC005",
    name: "EyeSure Centre",
    type: "Eye Care",
    registrationNumber: "REG2025ES05",
    yearOfEstablishment: 2022,
    address: "9 JP Nagar",
    city: "Bangalore",
    state: "Karnataka",
    country: "India",
    zipCode: "560078",
    phone: "9916001212",
    email: "eyesure@clinic.in",
    ownerName: "Dr. Anil Desai",
    adminContact: "9916076543",
    adminEmail: "admin@eyesure.in",
    specialties: ["Ophthalmology", "Eye Surgery", "Vision Care"],
    services: ["Eyes", "Pharmacy"],
    adminUsername: "eyeadmin",
    adminPassword: "Eye@123",
    gstNumber: "29ABCLM9876R1Z2",
    panNumber: "ABCLM9876R",
    tanNumber: "BLRT76543C",
    bankAccountNumber: "90123456785",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC006",
    name: "ReproLife Clinic",
    type: "Fertility",
    registrationNumber: "REG2025RL06",
    yearOfEstablishment: 2017,
    address: "22 Park Street",
    city: "Kolkata",
    state: "West Bengal",
    country: "India",
    zipCode: "700016",
    phone: "9831009988",
    email: "reprolife@clinic.in",
    website: "www.reprolife.in",
    ownerName: "Dr. Neha Banerjee",
    adminContact: "9831076543",
    adminEmail: "admin@reprolife.in",
    specialties: ["Fertility", "Reproductive Medicine", "IVF"],
    services: ["ReproX", "Nutrition"],
    adminUsername: "reproadmin",
    adminPassword: "Repro@456",
    gstNumber: "19ABCMN5432T1Z8",
    panNumber: "ABCMN5432T",
    tanNumber: "KOLT87654D",
    bankAccountNumber: "91123456784",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC007",
    name: "LifeBalance Clinic",
    type: "Physiotherapy",
    registrationNumber: "REG2025LB07",
    yearOfEstablishment: 2020,
    address: "15 Banjara Hills",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    zipCode: "500034",
    phone: "9701009988",
    email: "info@lifebalance.in",
    ownerName: "Dr. Suresh Kumar",
    adminContact: "9701076543",
    adminEmail: "admin@lifebalance.in",
    specialties: ["Physiotherapy", "Balance Therapy", "Rehabilitation"],
    services: ["Physio", "Balance", "Nutrition"],
    adminUsername: "lifebaladmin",
    adminPassword: "Life@789",
    gstNumber: "36ABCPQ3210L1Z4",
    panNumber: "ABCPQ3210L",
    tanNumber: "HYDT65432E",
    bankAccountNumber: "92123456783",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC008",
    name: "MedNova Clinic",
    type: "Multispeciality",
    registrationNumber: "REG2025MN08",
    yearOfEstablishment: 2019,
    address: "55 Park Lane",
    city: "Delhi",
    state: "Delhi",
    country: "India",
    zipCode: "110001",
    phone: "9810012345",
    email: "info@mednova.in",
    website: "www.mednova.in",
    ownerName: "Dr. Meera Singh",
    adminContact: "9810076543",
    adminEmail: "admin@mednova.in",
    specialties: ["General Medicine", "Cardiology", "Orthopedics", "Ophthalmology"],
    services: ["Physio", "Eyes", "Nutrition"],
    adminUsername: "mednovaadmin",
    adminPassword: "Med@101",
    gstNumber: "07ABCRS6543Q1Z1",
    panNumber: "ABCRS6543Q",
    tanNumber: "DELT43210F",
    bankAccountNumber: "93123456782",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC009",
    name: "CureWell Diagnostics",
    type: "Diagnostic Centre",
    registrationNumber: "REG2025CW09",
    yearOfEstablishment: 2021,
    address: "88 MG Road",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    zipCode: "411001",
    phone: "9820012345",
    email: "info@curewell.in",
    ownerName: "Dr. Rahul Patil",
    adminContact: "9820076543",
    adminEmail: "admin@curewell.in",
    specialties: ["Pathology", "Radiology", "Laboratory Medicine"],
    services: ["Blood Parameters", "Pharmacy"],
    adminUsername: "cureadmin",
    adminPassword: "Cure@102",
    gstNumber: "27ABCTU6789E1Z3",
    panNumber: "ABCTU6789E",
    tanNumber: "PNET54321G",
    bankAccountNumber: "94123456781",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC010",
    name: "PureMind Clinic",
    type: "Psychology",
    registrationNumber: "REG2025PM10",
    yearOfEstablishment: 2018,
    address: "21 Brigade Road",
    city: "Bangalore",
    state: "Karnataka",
    country: "India",
    zipCode: "560025",
    phone: "9844001122",
    email: "info@puremind.in",
    website: "www.puremind.in",
    ownerName: "Dr. Farah Ahmed",
    adminContact: "9844065432",
    adminEmail: "admin@puremind.in",
    specialties: ["Psychology", "Mental Health", "Counseling"],
    services: ["Minds", "Balance"],
    adminUsername: "pureadmin",
    adminPassword: "Pure@333",
    gstNumber: "29ABCVX4321J1Z6",
    panNumber: "ABCVX4321J",
    tanNumber: "BLRT32109H",
    bankAccountNumber: "95123456780",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC011",
    name: "VitalHealth Clinic",
    type: "General Health",
    registrationNumber: "REG2025VH11",
    yearOfEstablishment: 2019,
    address: "7 Rajaji Road",
    city: "Coimbatore",
    state: "Tamil Nadu",
    country: "India",
    zipCode: "641001",
    phone: "9790012345",
    email: "info@vitalhealth.in",
    ownerName: "Dr. Dinesh Raj",
    adminContact: "9790076543",
    adminEmail: "admin@vitalhealth.in",
    specialties: ["General Medicine", "Family Medicine", "Preventive Care"],
    services: ["Physio", "Nutrition", "Pharmacy"],
    adminUsername: "vitaladmin",
    adminPassword: "Vital@444",
    gstNumber: "33ABCYZ2109K1Z3",
    panNumber: "ABCYZ2109K",
    tanNumber: "CBET65433I",
    bankAccountNumber: "96123456779",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC012",
    name: "CardioLife Centre",
    type: "Cardiology",
    registrationNumber: "REG2025CL12",
    yearOfEstablishment: 2017,
    address: "25 MG Road",
    city: "Bangalore",
    state: "Karnataka",
    country: "India",
    zipCode: "560001",
    phone: "9845054321",
    email: "contact@cardiolife.in",
    ownerName: "Dr. Manoj Nair",
    adminContact: "9845076543",
    adminEmail: "admin@cardiolife.in",
    specialties: ["Cardiology", "Cardiac Surgery", "Interventional Cardiology"],
    services: ["Blood Parameters", "Nutrition"],
    adminUsername: "cardioadmin",
    adminPassword: "Cardio@555",
    gstNumber: "29ABCAA7654R1Z7",
    panNumber: "ABCAA7654R",
    tanNumber: "BLRT89076J",
    bankAccountNumber: "97123456778",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC013",
    name: "MindBloom",
    type: "Psychology",
    registrationNumber: "REG2025MB13",
    yearOfEstablishment: 2020,
    address: "60 RK Salai",
    city: "Chennai",
    state: "Tamil Nadu",
    country: "India",
    zipCode: "600004",
    phone: "9841078901",
    email: "info@mindbloom.in",
    website: "www.mindbloom.in",
    ownerName: "Dr. Kavitha Devi",
    adminContact: "9841076543",
    adminEmail: "admin@mindbloom.in",
    specialties: ["Psychology", "Mental Health", "Behavioral Therapy"],
    services: ["Minds", "ReproX"],
    adminUsername: "mindbloom",
    adminPassword: "Bloom@888",
    gstNumber: "33ABCAA2345H1Z5",
    panNumber: "ABCAA2345H",
    tanNumber: "CHNT76543K",
    bankAccountNumber: "98123456777",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC014",
    name: "FitPlus Rehab",
    type: "Rehabilitation",
    registrationNumber: "REG2025FP14",
    yearOfEstablishment: 2021,
    address: "80 Old Airport Rd",
    city: "Bangalore",
    state: "Karnataka",
    country: "India",
    zipCode: "560017",
    phone: "9945012345",
    email: "contact@fitplus.in",
    ownerName: "Dr. Arun Joseph",
    adminContact: "9945076543",
    adminEmail: "admin@fitplus.in",
    specialties: ["Physical Therapy", "Rehabilitation", "Sports Medicine"],
    services: ["Physio", "Balance"],
    adminUsername: "fitadmin",
    adminPassword: "Fit@999",
    gstNumber: "29ABCDF7654K1Z9",
    panNumber: "ABCDF7654K",
    tanNumber: "BLRT65432L",
    bankAccountNumber: "99123456776",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC015",
    name: "Rejuve Clinic",
    type: "Wellness",
    registrationNumber: "REG2025RJ15",
    yearOfEstablishment: 2019,
    address: "90 Residency Rd",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    zipCode: "500081",
    phone: "9000056789",
    email: "info@rejuve.in",
    ownerName: "Dr. Sneha Reddy",
    adminContact: "9000076543",
    adminEmail: "admin@rejuve.in",
    specialties: ["Wellness", "Anti-Aging", "Holistic Medicine"],
    services: ["Nutrition", "Physio"],
    adminUsername: "rejuveadmin",
    adminPassword: "Rejuve@222",
    gstNumber: "36ABCFG9876M1Z3",
    panNumber: "ABCFG9876M",
    tanNumber: "HYDT76543M",
    bankAccountNumber: "10012345675",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC016",
    name: "Harmony Health",
    type: "Multispeciality",
    registrationNumber: "REG2025HH16",
    yearOfEstablishment: 2018,
    address: "120 Hill View Rd",
    city: "Kochi",
    state: "Kerala",
    country: "India",
    zipCode: "682001",
    phone: "9876543210",
    email: "info@harmony.in",
    ownerName: "Dr. Renu Thomas",
    adminContact: "9876501234",
    adminEmail: "admin@harmony.in",
    specialties: ["General Medicine", "Cardiology", "Ophthalmology"],
    services: ["Physio", "Eyes", "Blood Parameters"],
    adminUsername: "harmonyadmin",
    adminPassword: "Harm@333",
    gstNumber: "32ABCHK6789R1Z2",
    panNumber: "ABCHK6789R",
    tanNumber: "KCHT65432N",
    bankAccountNumber: "10123456774",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC017",
    name: "Nova Women Care",
    type: "Gynaecology",
    registrationNumber: "REG2025NW17",
    yearOfEstablishment: 2020,
    address: "45 Park Road",
    city: "Chennai",
    state: "Tamil Nadu",
    country: "India",
    zipCode: "600008",
    phone: "9841065432",
    email: "info@novawomen.in",
    ownerName: "Dr. Leena Joseph",
    adminContact: "9841078901",
    adminEmail: "admin@novawomen.in",
    specialties: ["Gynecology", "Obstetrics", "Reproductive Health"],
    services: ["ReproX", "Nutrition"],
    adminUsername: "novawomen",
    adminPassword: "Nova@111",
    gstNumber: "33ABCHI0987T1Z5",
    panNumber: "ABCHI0987T",
    tanNumber: "CHNT54321O",
    bankAccountNumber: "10223456773",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC018",
    name: "CareMed Clinic",
    type: "General Health",
    registrationNumber: "REG2025CM18",
    yearOfEstablishment: 2019,
    address: "5 MG Road",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    zipCode: "411001",
    phone: "9820011223",
    email: "info@caremed.in",
    website: "www.caremed.in",
    ownerName: "Dr. Prakash Patil",
    adminContact: "9820076543",
    adminEmail: "admin@caremed.in",
    specialties: ["General Medicine", "Family Medicine", "Internal Medicine"],
    services: ["Physio", "Pharmacy"],
    adminUsername: "careadmin",
    adminPassword: "Care@909",
    gstNumber: "27ABCLU4567E1Z4",
    panNumber: "ABCLU4567E",
    tanNumber: "PNET76543P",
    bankAccountNumber: "10323456772",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC019",
    name: "VisionCare Eye Hospital",
    type: "Eye Care",
    registrationNumber: "REG2025VC19",
    yearOfEstablishment: 2017,
    address: "99 Nehru Road",
    city: "Delhi",
    state: "Delhi",
    country: "India",
    zipCode: "110011",
    phone: "9810098765",
    email: "info@visioncare.in",
    website: "www.visioncare.in",
    ownerName: "Dr. Rajesh Malhotra",
    adminContact: "9810076543",
    adminEmail: "admin@visioncare.in",
    specialties: ["Ophthalmology", "Retina Surgery", "Cornea Surgery"],
    services: ["Eyes", "Pharmacy"],
    adminUsername: "visionadmin",
    adminPassword: "Vision@555",
    gstNumber: "07ABCDF2345Q1Z8",
    panNumber: "ABCDF2345Q",
    tanNumber: "DELT32109Q",
    bankAccountNumber: "10423456771",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  },
  {
    clinicId: "CLINIC020",
    name: "MedBridge Clinic",
    type: "Multispeciality",
    registrationNumber: "REG2025MB20",
    yearOfEstablishment: 2018,
    address: "25 Link Road",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    zipCode: "400001",
    phone: "9820010001",
    email: "info@medbridge.in",
    ownerName: "Dr. Sanjay Iyer",
    adminContact: "9820076543",
    adminEmail: "admin@medbridge.in",
    specialties: ["General Medicine", "Cardiology", "Orthopedics", "Neurology"],
    services: ["Physio", "Nutrition", "Pharmacy"],
    adminUsername: "medbridge",
    adminPassword: "Med@Bridge",
    gstNumber: "27ABCGK9876V1Z3",
    panNumber: "ABCGK9876V",
    tanNumber: "MUMT87654R",
    bankAccountNumber: "10523456770",
    validityPeriod: {
      startDate: new Date("2025-10-14"),
      endDate: new Date("2026-10-14"),
      duration: 12
    }
  }
];

// Function to hash passwords
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Function to add clinics to database
const addClinicsToDatabase = async () => {
  try {
    console.log('🚀 Starting to add clinics to database...');
    
    // Clear existing clinics (optional - remove this if you want to keep existing data)
    // await Clinic.deleteMany({});
    // console.log('🗑️ Cleared existing clinics');
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const clinicData of sampleClinics) {
      try {
        // Check if clinic already exists
        const existingClinic = await Clinic.findOne({ 
          $or: [
            { clinicId: clinicData.clinicId },
            { registrationNumber: clinicData.registrationNumber },
            { adminEmail: clinicData.adminEmail }
          ]
        });
        
        if (existingClinic) {
          console.log(`⏭️ Skipping ${clinicData.name} - already exists`);
          skippedCount++;
          continue;
        }
        
        // Hash the admin password
        clinicData.adminPassword = await hashPassword(clinicData.adminPassword);
        
        // Create new clinic
        const clinic = new Clinic(clinicData);
        await clinic.save();
        
        console.log(`✅ Added: ${clinicData.name} (${clinicData.clinicId})`);
        addedCount++;
        
      } catch (error) {
        console.error(`❌ Error adding ${clinicData.name}:`, error.message);
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Successfully added: ${addedCount} clinics`);
    console.log(`⏭️ Skipped (already exists): ${skippedCount} clinics`);
    console.log(`📝 Total processed: ${addedCount + skippedCount} clinics`);
    
  } catch (error) {
    console.error('❌ Error adding clinics:', error);
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await addClinicsToDatabase();
    console.log('\n🎉 Clinic data seeding completed!');
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
main();
