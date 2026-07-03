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
const appointmentRequestRoutes = require("./routes/appointmentRequests");
const carePlanRoutes = require("./routes/carePlan");
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
app.use("/api/appointment-requests", appointmentRequestRoutes);
app.use("/api/care-plan", carePlanRoutes);
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

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`⚠️ Port ${port} is in use. Attempting to free it...`);
      const { execSync } = require("child_process");
      try {
        // Find and kill the process using the port
        const result = execSync(
          `netstat -ano | findstr ":${port}" | findstr "LISTENING"`,
          { encoding: "utf8" }
        );
        const lines = result.trim().split("\n");
        const pids = new Set();
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== "0" && pid !== String(process.pid)) {
            pids.add(pid);
          }
        }
        for (const pid of pids) {
          try {
            execSync(`taskkill /PID ${pid} /F`, { encoding: "utf8" });
            console.log(`✅ Killed process ${pid} on port ${port}`);
          } catch (e) {
            // Process may have already exited
          }
        }
        // Retry after a short delay
        setTimeout(() => {
          console.log(`🔄 Retrying server startup on port ${port}...`);
          startServer(port);
        }, 1500);
      } catch (e) {
        console.error(`❌ Could not free port ${port}. Please kill the process manually.`);
        process.exit(1);
      }
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });
};

startServer(PORT);
