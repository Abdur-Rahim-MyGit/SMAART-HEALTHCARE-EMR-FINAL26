const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Patient = require("../models/Patient");
const Clinic = require("../models/Clinic");

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://souban:souban123@smaartdb.turl6oh.mongodb.net/?retryWrites=true&w=majority&appName=SmaartDB");
    console.log("✅ MongoDB Connected Successfully!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

const sampleInvoices = [
  {
    patientName: "Paul McCartney",
    invoiceNumber: "TEMP-001",
    invoiceDate: new Date("2024-01-15"),
    dueDate: new Date("2024-02-15"),
    status: "Paid",
    paymentStatus: "Paid",
    paymentMethod: "Insurance",
    paymentDate: new Date("2024-01-20"),
    items: [
      {
        description: "General Consultation",
        quantity: 1,
        unitPrice: 1500,
        total: 1500
      },
      {
        description: "Blood Test - CBC",
        quantity: 1,
        unitPrice: 800,
        total: 800
      },
      {
        description: "ECG",
        quantity: 1,
        unitPrice: 600,
        total: 600
      }
    ],
    subtotal: 2900,
    taxRate: 18,
    taxAmount: 522,
    discountAmount: 0,
    totalAmount: 3422,
    paidAmount: 3422,
    balanceAmount: 0,
    notes: "Patient covered under Star Health insurance",
    terms: "Net 30"
  },
  {
    patientName: "Martin Smith",
    invoiceNumber: "TEMP-002",
    invoiceDate: new Date("2024-01-18"),
    dueDate: new Date("2024-02-18"),
    status: "Paid",
    paymentStatus: "Paid",
    paymentMethod: "Credit Card",
    paymentDate: new Date("2024-01-25"),
    items: [
      {
        description: "Cardiology Consultation",
        quantity: 1,
        unitPrice: 2000,
        total: 2000
      },
      {
        description: "2D Echo",
        quantity: 1,
        unitPrice: 2500,
        total: 2500
      }
    ],
    subtotal: 4500,
    taxRate: 18,
    taxAmount: 810,
    discountAmount: 225,
    totalAmount: 5085,
    paidAmount: 5085,
    balanceAmount: 0,
    notes: "5% discount applied for senior citizen",
    terms: "Net 30"
  },
  {
    patientName: "Raj Kumar",
    invoiceNumber: "TEMP-006",
    invoiceDate: new Date("2024-01-22"),
    dueDate: new Date("2024-02-22"),
    status: "Sent",
    paymentStatus: "Partial",
    paymentMethod: "Cash",
    items: [
      {
        description: "Dermatology Consultation",
        quantity: 1,
        unitPrice: 1200,
        total: 1200
      },
      {
        description: "Skin Biopsy",
        quantity: 1,
        unitPrice: 3000,
        total: 3000
      },
      {
        description: "Medication",
        quantity: 2,
        unitPrice: 450,
        total: 900
      }
    ],
    subtotal: 5100,
    taxRate: 18,
    taxAmount: 918,
    discountAmount: 0,
    totalAmount: 6018,
    paidAmount: 3000,
    balanceAmount: 3018,
    notes: "Partial payment received, balance due by due date",
    terms: "Net 30"
  },
  {
    patientName: "Priya Sharma",
    invoiceNumber: "TEMP-003",
    invoiceDate: new Date("2024-01-25"),
    dueDate: new Date("2024-02-25"),
    status: "Overdue",
    paymentStatus: "Unpaid",
    items: [
      {
        description: "Gynecology Consultation",
        quantity: 1,
        unitPrice: 1800,
        total: 1800
      },
      {
        description: "Ultrasound - Pelvis",
        quantity: 1,
        unitPrice: 1500,
        total: 1500
      },
      {
        description: "Pap Smear",
        quantity: 1,
        unitPrice: 800,
        total: 800
      }
    ],
    subtotal: 4100,
    taxRate: 18,
    taxAmount: 738,
    discountAmount: 0,
    totalAmount: 4838,
    paidAmount: 0,
    balanceAmount: 4838,
    notes: "Patient requested extension, currently overdue",
    terms: "Net 30"
  },
  {
    patientName: "Anita Desai",
    invoiceNumber: "TEMP-004",
    invoiceDate: new Date("2024-01-28"),
    dueDate: new Date("2024-02-28"),
    status: "Draft",
    paymentStatus: "Unpaid",
    items: [
      {
        description: "Psychiatry Consultation",
        quantity: 1,
        unitPrice: 2500,
        total: 2500
      },
      {
        description: "Therapy Session",
        quantity: 3,
        unitPrice: 1200,
        total: 3600
      }
    ],
    subtotal: 6100,
    taxRate: 18,
    taxAmount: 1098,
    discountAmount: 305,
    totalAmount: 6893,
    paidAmount: 0,
    balanceAmount: 6893,
    notes: "Draft invoice, pending approval",
    terms: "Net 30"
  },
  {
    patientName: "Vikram Singh",
    invoiceNumber: "TEMP-005",
    invoiceDate: new Date("2024-02-01"),
    dueDate: new Date("2024-03-01"),
    status: "Paid",
    paymentStatus: "Paid",
    paymentMethod: "Bank Transfer",
    paymentDate: new Date("2024-02-05"),
    items: [
      {
        description: "Orthopedic Consultation",
        quantity: 1,
        unitPrice: 1600,
        total: 1600
      },
      {
        description: "X-Ray - Knee",
        quantity: 2,
        unitPrice: 600,
        total: 1200
      },
      {
        description: "Physiotherapy Session",
        quantity: 5,
        unitPrice: 800,
        total: 4000
      }
    ],
    subtotal: 6800,
    taxRate: 18,
    taxAmount: 1224,
    discountAmount: 340,
    totalAmount: 7684,
    paidAmount: 7684,
    balanceAmount: 0,
    notes: "Full payment received via bank transfer",
    terms: "Net 30"
  }
];

const addSampleInvoices = async () => {
  try {
    // Get the first clinic to associate invoices with
    const clinic = await Clinic.findOne();
    if (!clinic) {
      console.log("❌ No clinics found. Please add clinics first.");
      return;
    }

    // Get some patients to associate with invoices
    const patients = await Patient.find().limit(6);
    if (patients.length === 0) {
      console.log("❌ No patients found. Please add patients first.");
      return;
    }

    console.log(`📋 Found clinic: ${clinic.name}`);
    console.log(`📋 Found ${patients.length} patients`);

    // Clear existing invoices (optional)
    await Invoice.deleteMany({});
    console.log("🗑️  Cleared existing invoices");

    // Add sample invoices
    for (let i = 0; i < sampleInvoices.length && i < patients.length; i++) {
      const invoiceData = sampleInvoices[i];
      const patient = patients[i];

      const invoice = new Invoice({
        patientId: patient._id,
        patientName: patient.fullName,
        clinicId: clinic._id,
        ...invoiceData
      });

      await invoice.save();
      console.log(`✅ Added invoice: ${invoiceData.invoiceNumber} for ${invoiceData.patientName}`);
    }

    console.log("🎉 Successfully added all sample invoices!");

  } catch (error) {
    console.error("❌ Error adding sample invoices:", error.message);
  }
};

const main = async () => {
  await connectDB();
  await addSampleInvoices();
  mongoose.connection.close();
  console.log("🔐 Database connection closed");
};

main().catch(console.error);
