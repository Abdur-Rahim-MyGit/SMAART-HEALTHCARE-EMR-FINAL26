const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const clinicRoutes = require("./routes/clinics");
const doctorRoutes = require("./routes/doctors");
const appointmentRoutes = require("./routes/appointments");
const patientRoutes = require("./routes/patients");
const billingRoutes = require("./routes/billing");
const pharmacyRoutes = require("./routes/pharmacy");
const notificationRoutes = require("./routes/notifications");
const auditRoutes = require("./routes/audit");
const nursesRoutes = require("./routes/nurses");
const dashboardRoutes = require("./routes/dashboard");
const referralsRoutes = require("./routes/referrals");
const invoicesRoutes = require("./routes/invoices");
const searchRoutes = require("./routes/search");
const patientCaseLogRoutes = require("./routes/patientCaseLogs");
const consultationsRoutes = require("./routes/consultations");
const prescriptionsRoutes = require("./routes/prescriptions");
const vitalsRoutes = require("./routes/vitals");
const labReportsRoutes = require("./routes/labReports");
const medicalImagesRoutes = require("./routes/medicalImages");
const teleconsultationsRoutes = require("./routes/teleconsultations");
const postsRoutes = require("./routes/posts");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import database configuration
const connectDB = require("./config/database");

// Connect to MongoDB
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/clinics", clinicRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/nurses", nursesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/referrals", referralsRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/case-logs", patientCaseLogRoutes);
app.use("/api/consultations", consultationsRoutes);
app.use("/api/prescriptions", prescriptionsRoutes);
app.use("/api/vitals", vitalsRoutes);
app.use("/api/lab-reports", labReportsRoutes);
app.use("/api/medical-images", medicalImagesRoutes);
app.use("/api/teleconsultations", teleconsultationsRoutes);
app.use("/api/posts", postsRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
