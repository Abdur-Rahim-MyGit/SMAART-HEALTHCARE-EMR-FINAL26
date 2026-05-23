import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { Heart } from "lucide-react";

// Loading Components
import HealthcareLoadingScreen from "./components/loading/HealthcareLoadingScreen";
import LogoutAnimation from "./components/loading/LogoutAnimation";

// Auth Components
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import OTPVerification from "./components/auth/OTPVerification";
import ForgotPassword from "./components/auth/ForgotPassword";
import ResetPassword from "./components/auth/ResetPassword";

// Layout
import DashboardLayout from "./components/layout/DashboardLayout";

// Dashboard Components
import SuperMasterAdminDashboard from "./components/dashboards/SuperMasterAdminDashboard";
import SuperAdminDashboard from "./components/dashboards/SuperAdminDashboard";
import DoctorDashboard from "./components/dashboards/DoctorDashboard";
import NurseDashboard from "./components/dashboards/NurseDashboard";
import BillingDashboard from "./components/dashboards/BillingDashboard";
import PharmacyDashboard from "./components/dashboards/PharmacyDashboard";
import PatientDashboard from "./components/dashboards/PatientDashboard";
import ClinicDashboard from "./components/dashboards/ClinicDashboard";

// Feature Components
import Clinics from "./components/clinics/Clinics";
import Users from "./components/users/Users";
import Patients from "./components/patients/Patients";
import Appointments from "./components/appointments/Appointments";
import DoctorsManagement from "./components/pages/DoctorsManagement";
import Doctors from "./components/pages/Doctors";
import NurseManagement from "./components/pages/NurseManagement";
import PrescriptionManagement from "./components/pages/PrescriptionManagement";
import TeleconsultationManagement from "./components/pages/TeleconsultationManagement";
import Referrals from "./components/pages/Referrals";
import ReportsAnalytics from "./components/pages/ReportsAnalytics";
import BillingInsurance from "./components/pages/BillingInsurance";
import CommunityHub from "./components/pages/CommunityHub";
import ClinicEdit from "./components/clinics/ClinicEdit";
import PharmacyManagement from "./components/pages/PharmacyManagement";
import StaffManagement from "./components/pages/StaffManagement";
import Settings from "./components/pages/Settings";
import CustomerSupport from "./components/pages/CustomerSupport";
import PatientView from "./components/pages/PatientView";

function App() {
  const { user, loading, showLogoutAnimation, hideLogoutAnimation } = useAuth();
  const [showInitialLoading, setShowInitialLoading] = useState(false);
  const location = useLocation();

  // Debug logging
  console.log("App.jsx - Current user:", user);
  console.log("App.jsx - Loading state:", loading);
  console.log("App.jsx - Current pathname:", location.pathname);

  // Show initial loading screen only when on login page (not logged in)
  useEffect(() => {
    // Only show loading screen if user is not logged in and we're on login page or root
    if (
      !user &&
      !loading &&
      (location.pathname === "/login" || location.pathname === "/")
    ) {
      setShowInitialLoading(true);
      const timer = setTimeout(() => {
        setShowInitialLoading(false);
      }, 3000); // Show for 3 seconds

      return () => clearTimeout(timer);
    }
  }, [user, loading, location.pathname]);

  // Show logout animation
  if (showLogoutAnimation) {
    return <LogoutAnimation onComplete={() => hideLogoutAnimation()} />;
  }

  // Show initial healthcare loading screen only when not logged in and on login page
  if (showInitialLoading && !user) {
    return (
      <HealthcareLoadingScreen
        onComplete={() => setShowInitialLoading(false)}
      />
    );
  }

  // Show auth loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="relative mx-auto w-16 h-16 mb-4">
            <div className="absolute inset-0 bg-transparent rounded-full flex items-center justify-center animate-heartbeat">
              <Heart className="w-8 h-8 text-blue-500" />
            </div>
            <div className="absolute inset-0 bg-blue-200 rounded-full opacity-30 animate-ping"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-300 animate-pulse">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<OTPVerification />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    );
  }

  const getDashboardComponent = (role) => {
    console.log("User role:", role); // Debug log
    switch (role) {
      case "super_master_admin":
        return <SuperMasterAdminDashboard />;
      case "super_admin":
        return <SuperAdminDashboard />;
      case "clinic_admin":
        return <ClinicDashboard />;
      case "doctor":
        return <DoctorDashboard />;
      case "nurse":
        return <NurseDashboard />;
      case "billing_staff":
        return <BillingDashboard />;
      case "pharmacy_staff":
        return <PharmacyDashboard />;
      case "patient":
        return <PatientDashboard />;
      default:
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Invalid Role
            </h2>
            <p className="text-gray-600 dark:text-gray-400">Role: {role || "undefined"}</p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={getDashboardComponent(user?.role)} />
        <Route path="/dashboard" element={getDashboardComponent(user?.role)} />

        {/* Super Master Admin Routes */}
        {user.role === "super_master_admin" && (
          <>
            <Route path="/clinics" element={<Clinics />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/nurses" element={<NurseManagement />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/reports-analytics" element={<ReportsAnalytics />} />
            <Route path="/billing-insurance" element={<BillingInsurance />} />
            <Route path="/pharmacy" element={<PharmacyManagement />} />
            <Route path="/users" element={<StaffManagement />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:patientId" element={<PatientView />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/support" element={<CustomerSupport />} />
            <Route path="/billing-insurance" element={<BillingInsurance />} />
            <Route path="/clinic-edit" element={<ClinicEdit />} />
          </>
        )}

        {/* Super Admin Routes */}
        {user.role === "super_admin" && (
          <>
            <Route path="/users" element={<Users />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:patientId" element={<PatientView />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/reports-analytics" element={<ReportsAnalytics />} />
            <Route path="/billing-insurance" element={<BillingInsurance />} />
            <Route path="/pharmacy" element={<PharmacyManagement />} />
            <Route path="/settings" element={<Settings />} />
          </>
        )}

        {/* Clinic Admin Routes */}
        {user.role === "clinic_admin" && (
          <>
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:patientId" element={<PatientView />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/nurses" element={<NurseManagement />} />
            <Route path="/prescriptions" element={<PrescriptionManagement />} />
            <Route
              path="/teleconsultation"
              element={<TeleconsultationManagement />}
            />
            <Route path="/invoices" element={<BillingInsurance />} />
            <Route path="/community" element={<CommunityHub />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/settings" element={<Settings />} />
          </>
        )}

        {/* Doctor/Nurse Routes */}
        {(user.role === "doctor" ||
          user.role === "nurse" ||
          user.role === "super_admin") && (
          <>
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:patientId" element={<PatientView />} />
          </>
        )}

        {/* Billing Staff Routes */}
        {user.role === "billing_staff" && (
          <Route path="/billing-insurance" element={<BillingInsurance />} />
        )}

        {/* Patient Routes */}
        {user.role === "patient" && (
          <Route path="/appointments" element={<Appointments />} />
        )}

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </DashboardLayout>
  );
}

export default App;
