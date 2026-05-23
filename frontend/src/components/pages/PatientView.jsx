import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Heart,
  CreditCard,
  History,
  FileText,
  Camera,
  Users,
  Pill,
  Stethoscope,
  ClipboardList,
  Activity,
  Brain,
  UserCheck,
  Building,
  Video,
  Clock,
  RefreshCw,
  Syringe,
  AlertTriangle,
  Scissors,
  Eye,
  Download,
  Upload,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import {
  patientsAPI,
  appointmentsAPI,
  referralsAPI,
  billingAPI,
  invoicesAPI,
  consultationsAPI,
  prescriptionsAPI,
  vitalsAPI,
  labReportsAPI,
  medicalImagesAPI,
} from "../../services/api";

const PatientView = () => {
  // ============================================================================
  // 1. URL Parameter Extraction - Extract patient ID from URL
  // ============================================================================
  const { patientId } = useParams();
  const navigate = useNavigate();

  // ============================================================================
  // 2. Component State Management
  // ============================================================================
  const [activeTab, setActiveTab] = useState("profile");
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tab-specific data states (lazy loaded)
  const [appointments, setAppointments] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [billingRecords, setBillingRecords] = useState([]);
  const [caseLogs, setCaseLogs] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  // Loading states for each data type
  const [loadingAdditionalData, setLoadingAdditionalData] = useState(false);
  const [loadingCaseLogs, setLoadingCaseLogs] = useState(false);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);

  // ============================================================================
  // 3. Patient Data Loading Flow - Main patient details loader
  // ============================================================================
  const loadPatientDetails = async () => {
    setLoading(true);
    try {
      const response = await patientsAPI.getById(patientId);
      if (response.data.success) {
        const backendPatient = response.data.patient;

        // Transform backend data to match frontend structure
        const transformedPatient = {
          _id: backendPatient._id, // Keep the actual MongoDB _id
          pid: backendPatient.uhid || backendPatient._id,
          uhid: backendPatient.uhid,
          firstName: backendPatient.fullName.split(" ")[0],
          lastName: backendPatient.fullName.split(" ").slice(1).join(" "),
          fullName: backendPatient.fullName,
          gender: backendPatient.gender,
          dateOfBirth: backendPatient.dateOfBirth,
          age:
            backendPatient.age ||
            new Date().getFullYear() -
              new Date(backendPatient.dateOfBirth).getFullYear(),
          phone: backendPatient.phone,
          email: backendPatient.email,
          bloodGroup: backendPatient.bloodGroup,
          occupation: backendPatient.occupation,
          referringDoctor: backendPatient.referringDoctor,
          referredClinic: backendPatient.referredClinic,
          governmentId: backendPatient.governmentId,
          idNumber: backendPatient.idNumber,
          governmentDocument: backendPatient.governmentDocument,
          address: {
            street: backendPatient.address?.street || "",
            city: backendPatient.address?.city || "",
            state: backendPatient.address?.state || "",
            zipCode: backendPatient.address?.zipCode || "",
            country: backendPatient.address?.country || "",
          },
          emergencyContact: {
            name: backendPatient.emergencyContact?.name || "",
            relationship: backendPatient.emergencyContact?.relationship || "",
            phone: backendPatient.emergencyContact?.phone || "",
          },
          insurance: {
            provider: backendPatient.insurance?.provider || "",
            policyNumber: backendPatient.insurance?.policyNumber || "",
            groupNumber: backendPatient.insurance?.groupNumber || "",
          },
          medicalHistory: {
            conditions: backendPatient.medicalHistory?.conditions || [],
            allergies: backendPatient.medicalHistory?.allergies || [],
            medications: backendPatient.medicalHistory?.medications || [],
            surgeries: backendPatient.medicalHistory?.surgeries || [],
          },
          assignedDoctors: backendPatient.assignedDoctors || [],
          status: backendPatient.status || "Active",
          lastVisit: backendPatient.lastVisit,
          photo: backendPatient.profileImage,
          notes: backendPatient.notes || "",
          createdAt: backendPatient.createdAt,
          updatedAt: backendPatient.updatedAt,
          // Legacy fields for backward compatibility
          wallets: {
            general: backendPatient.wallet?.general || 0,
            pharmacy: backendPatient.wallet?.pharmacy || 0,
          },
          categoryHistory: {
            old: "-",
            new: "General",
            date: backendPatient.createdAt,
          },
          visits:
            backendPatient.checkInHistory?.map((visit) => ({
              clinicName: visit.clinicName,
              clinicCode: visit.clinicType,
              checkIn: visit.checkedInOn,
              checkOut: visit.checkOut || null,
            })) || [],
          payments: {
            credits:
              backendPatient.paymentCreditHistory?.map((credit) => ({
                mode: credit.payMode,
                reference: credit.reference,
                createdBy: credit.creditedBy,
                createdAt: credit.creditedOn,
                amount: credit.amount,
              })) || [],
            debits:
              backendPatient.paymentDebitHistory?.map((debit) => ({
                mode: debit.payType,
                reference: debit.reference,
                details: debit.details,
                debitedOn: debit.debitedOn,
                amount: debit.amount,
              })) || [],
          },
        };
        // Store patient in state - triggers UI re-render
        setPatient(transformedPatient);
      }
    } catch (error) {
      console.error("Error fetching patient:", error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // 4. Component Lifecycle Trigger - Load patient data on mount
  // ============================================================================
  useEffect(() => {
    if (patientId) {
      loadPatientDetails();
      loadAdditionalData();
    }
  }, [patientId]);

  // ============================================================================
  // 5. Additional Data Loading - Fetch appointments, referrals, billing
  // ============================================================================
  const loadAdditionalData = async () => {
    setLoadingAdditionalData(true);
    try {
      // Parallel data fetching for better performance
      const [appointmentsRes, referralsRes, billingRes, invoicesRes] =
        await Promise.allSettled([
          appointmentsAPI.getAll({ patientId }),
          referralsAPI.getAll({ patientId }),
          billingAPI.getAll({ patientId }),
          invoicesAPI.getByPatient(patientId),
        ]);

      // Process appointments
      if (
        appointmentsRes.status === "fulfilled" &&
        appointmentsRes.value.data.success
      ) {
        setAppointments(
          appointmentsRes.value.data.data ||
            appointmentsRes.value.data.appointments ||
            []
        );
      }

      // Process referrals
      if (
        referralsRes.status === "fulfilled" &&
        referralsRes.value.data.success
      ) {
        setReferrals(
          referralsRes.value.data.data ||
            referralsRes.value.data.referrals ||
            []
        );
      }

      // Process billing records
      if (billingRes.status === "fulfilled" && billingRes.value.data.success) {
        setBillingRecords(billingRes.value.data.billingRecords || []);
      }

      // Process invoices
      if (
        invoicesRes.status === "fulfilled" &&
        invoicesRes.value.data.success
      ) {
        setBillingRecords(invoicesRes.value.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching additional data:", error);
    } finally {
      setLoadingAdditionalData(false);
    }
  };

  // ============================================================================
  // 6. Tab-Based Lazy Loading - Load prescriptions when prescriptions tab is accessed
  // ============================================================================
  useEffect(() => {
    if (
      activeTab === "prescriptions" &&
      patient &&
      prescriptions.length === 0
    ) {
      loadPrescriptions();
    }
  }, [activeTab, patient]);

  const loadPrescriptions = async () => {
    if (!patient) return;

    setLoadingPrescriptions(true);
    try {
      const patientDbId = patient._id || patientId;
      const response = await prescriptionsAPI.getByPatient(patientDbId);

      // Handle different response formats
      const prescriptionsData =
        response.prescriptions ||
        response.data?.prescriptions ||
        response.data ||
        response ||
        [];

      setPrescriptions(
        Array.isArray(prescriptionsData) ? prescriptionsData : []
      );
    } catch (error) {
      console.error("Error loading prescriptions:", error);
      setPrescriptions([]);
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  // ============================================================================
  // 7. Case Logs Timeline Generation - Unified timeline from multiple sources
  // ============================================================================
  useEffect(() => {
    if (activeTab === "case-logs" && patient && caseLogs.length === 0) {
      loadCaseLogs();
    }
  }, [activeTab, patient]);

  const loadCaseLogs = async () => {
    if (!patient) return;

    setLoadingCaseLogs(true);
    try {
      // Use the actual MongoDB _id for database queries
      const patientDbId = patient._id || patientId;
      console.log("🔍 Loading case logs for patient ID:", patientDbId);
      console.log("🔍 Patient object:", patient);

      // Fetch unified case logs from backend
      const response = await patientsAPI.getCaseLogs(patientDbId);
      console.log("🔍 API Response:", response);

      if (response.data.success) {
        // Store timeline in state
        setCaseLogs(response.data.data || []);
        console.log("✅ Case logs loaded:", response.data.data);
        console.log("✅ Case logs count:", response.data.data?.length);
      } else {
        console.log("❌ API returned success: false");
      }
    } catch (error) {
      console.error("❌ Error loading case logs:", error);
      console.error("❌ Error response:", error.response?.data);

      // Fallback: Build timeline from available data if API fails
      const timelineEntries = [];

      // Transform appointments to timeline
      appointments.forEach((appointment) => {
        timelineEntries.push({
          id: `appointment-${appointment._id}`,
          type: "appointment",
          title: `${appointment.appointmentType || "Appointment"} Scheduled`,
          description: `Appointment with ${
            appointment.doctorId?.fullName || "Doctor"
          }`,
          performedBy: appointment.doctorId?.fullName
            ? `Dr. ${appointment.doctorId.fullName || ""}`
            : "Doctor",
          timestamp: appointment.appointmentDate || appointment.createdAt,
          details: {
            time: appointment.time,
            type: appointment.appointmentType,
            status: appointment.status,
            notes: appointment.notes,
          },
          status: appointment.status || "Scheduled",
          iconType:
            appointment.type === "teleconsultation" ? "Video" : "Calendar",
          iconBgColor:
            appointment.type === "teleconsultation"
              ? "bg-purple-100"
              : "bg-blue-100",
          iconColor:
            appointment.type === "teleconsultation"
              ? "text-purple-600"
              : "text-blue-600",
        });
      });

      // Sort timeline chronologically (newest first)
      timelineEntries.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      setCaseLogs(timelineEntries);
    } finally {
      setLoadingCaseLogs(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "case-logs", label: "Case Logs", icon: FileText },
    { id: "assessments", label: "Assessments", icon: ClipboardList },
    { id: "test-reports", label: "Test Reports", icon: Activity },
    { id: "prescriptions", label: "Prescriptions", icon: Pill },
    { id: "treatment-history", label: "Treatment History", icon: History },
    { id: "referrals", label: "Referrals", icon: Users },
    { id: "invoices", label: "Invoices", icon: CreditCard },
    { id: "patient-uploads", label: "Patient Uploads", icon: Camera },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004D99] dark:border-blue-400"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
            Patient not found
          </h2>
          <button
            onClick={() => navigate("/patients")}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-[#004D99] to-[#42A89B] text-white dark:text-gray-100 rounded-lg hover:from-[#003d80] hover:to-[#3a7d92]"
          >
            Back to Patients
          </button>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <PatientProfileTab
            patient={patient}
            appointments={appointments}
            referrals={referrals}
            billingRecords={billingRecords}
            loadingAdditionalData={loadingAdditionalData}
          />
        );
      case "case-logs":
        return (
          <CaseLogsTab
            patient={patient}
            caseLogs={caseLogs}
            loading={loadingCaseLogs}
          />
        );
      case "assessments":
        return <AssessmentsTab patient={patient} />;
      case "test-reports":
        return <TestReportsTab patient={patient} />;
      case "prescriptions":
        return (
          <PrescriptionsTab
            patient={patient}
            prescriptions={prescriptions}
            loading={loadingPrescriptions}
          />
        );
      case "treatment-history":
        return <TreatmentHistoryTab patient={patient} />;
      case "referrals":
        return <ReferralTab patient={patient} referrals={referrals} />;
      case "invoices":
        return (
          <InvoicesTab patient={patient} billingRecords={billingRecords} />
        );
      case "patient-uploads":
        return <PatientUploadsTab patient={patient} />;
      default:
        return <PatientProfileTab patient={patient} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <div className="bg-white dark:bg-gray-950/70 backdrop-blur border-b border-gray-100">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left section - Logo and Patient IDs */}
            <div className="flex items-center space-x-6">
              {/* MIAS Logo */}
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-[#004D99] to-[#42A89B] rounded-lg flex items-center justify-center">
                  <span className="text-white dark:text-gray-100 font-bold text-lg">
                    SM
                  </span>
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white dark:text-white">
                  SMAART HEALTHCARE
                </span>
              </div>

              {/* Status Badge */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  patient.status === "Active"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                }`}
              >
                {patient.status}
              </span>
            </div>

            {/* Right section - Wallet Balances */}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-t">
          <div className="px-6">
            <div className="flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? "border-primary-600 text-primary-700"
                        : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white dark:text-white hover:border-gray-200 dark:border-gray-800"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white dark:bg-gray-950 min-h-[calc(100vh-200px)]">
        {renderTabContent()}
      </div>
    </div>
  );
};

// Investigation History Tab Component - Displays vitals records and lab reports
const InvestigationHistoryTab = ({ patient }) => {
  const [vitalsRecords, setVitalsRecords] = useState([]);
  const [labReports, setLabReports] = useState([]);
  const [loadingVitals, setLoadingVitals] = useState(false);
  const [loadingLabReports, setLoadingLabReports] = useState(false);
  const [selectedVitalRecord, setSelectedVitalRecord] = useState(null);

  // Fetch vitals data from API
  useEffect(() => {
    const fetchVitals = async () => {
      if (!patient?._id) return;

      setLoadingVitals(true);
      try {
        const response = await vitalsAPI.getByPatient(patient._id);
        console.log("Vitals API Response:", response);

        // Handle different response formats
        let vitalsData = [];
        if (response.data?.vitals) {
          vitalsData = response.data.vitals;
        } else if (response.data?.data) {
          vitalsData = response.data.data;
        } else if (Array.isArray(response.data)) {
          vitalsData = response.data;
        }

        setVitalsRecords(vitalsData);
      } catch (error) {
        console.error("Error fetching vitals:", error);
        setVitalsRecords([]);
      } finally {
        setLoadingVitals(false);
      }
    };

    fetchVitals();
  }, [patient]);

  // Fetch lab reports from API
  useEffect(() => {
    const fetchLabReports = async () => {
      if (!patient?._id) return;

      setLoadingLabReports(true);
      try {
        const response = await labReportsAPI.getByPatient(patient._id);
        console.log("Lab Reports API Response:", response);

        // Handle different response formats
        let reportsData = [];
        if (response.data?.reports) {
          reportsData = response.data.reports;
        } else if (response.data?.data) {
          reportsData = response.data.data;
        } else if (Array.isArray(response.data)) {
          reportsData = response.data;
        }

        setLabReports(reportsData);
      } catch (error) {
        console.error("Error fetching lab reports:", error);
        setLabReports([]);
      } finally {
        setLoadingLabReports(false);
      }
    };

    fetchLabReports();
  }, [patient]);

  const getCardColor = (color) => {
    switch (color) {
      case "red":
        return "bg-red-50 border-red-200 text-red-800";
      case "cyan":
        return "bg-cyan-50 border-cyan-200 text-cyan-800";
      case "orange":
        return "bg-orange-50 border-orange-200 text-orange-800";
      case "purple":
        return "bg-purple-50 border-purple-200 text-purple-800";
      case "blue":
        return "bg-blue-50 dark:bg-blue-900/10 border-blue-200 text-blue-800";
      case "green":
        return "bg-green-50 border-green-200 text-green-800";
      default:
        return "bg-gray-50 dark:bg-black border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200";
    }
  };

  const getVitalColor = (vitalType) => {
    const type = vitalType?.toLowerCase() || "";
    if (type.includes("blood pressure") || type.includes("bp"))
      return {
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-800",
      };
    if (type.includes("heart") || type.includes("pulse"))
      return {
        bg: "bg-cyan-50",
        border: "border-cyan-200",
        text: "text-cyan-800",
      };
    if (type.includes("temperature") || type.includes("temp"))
      return {
        bg: "bg-orange-50",
        border: "border-orange-200",
        text: "text-orange-800",
      };
    if (type.includes("oxygen") || type.includes("spo2"))
      return {
        bg: "bg-purple-50",
        border: "border-purple-200",
        text: "text-purple-800",
      };
    if (type.includes("weight"))
      return {
        bg: "bg-blue-50 dark:bg-blue-900/10",
        border: "border-blue-200",
        text: "text-blue-800",
      };
    if (type.includes("height"))
      return {
        bg: "bg-green-50",
        border: "border-green-200",
        text: "text-green-800",
      };
    return {
      bg: "bg-gray-50 dark:bg-black",
      border: "border-gray-200 dark:border-gray-800",
      text: "text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200",
    };
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-2">
          Investigations & Vitals
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Patient vital signs and investigation records
        </p>
      </div>

      {/* Vital Signs History Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Activity className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
              Vital Signs History
            </h3>
          </div>
          {vitalsRecords.length > 0 && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {vitalsRecords.length} record(s)
            </span>
          )}
        </div>

        {loadingVitals ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-3">
              Loading vitals...
            </p>
          </div>
        ) : vitalsRecords.length === 0 ? (
          <div className="bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg p-8 text-center">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
              No Vitals Records
            </h4>
            <p className="text-gray-600 dark:text-gray-400">
              Vital signs will appear here when recorded.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vitalsRecords.map((vitalRecord, index) => (
              <div
                key={vitalRecord._id || index}
                className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors"
                onClick={() =>
                  setSelectedVitalRecord(
                    selectedVitalRecord?._id === vitalRecord._id
                      ? null
                      : vitalRecord
                  )
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Activity className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white dark:text-white">
                        Vitals Record #{vitalsRecords.length - index}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {vitalRecord.visitDate
                          ? format(
                              new Date(vitalRecord.visitDate),
                              "MMM dd, yyyy"
                            )
                          : vitalRecord.createdAt
                          ? format(
                              new Date(vitalRecord.createdAt),
                              "MMM dd, yyyy"
                            )
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {vitalRecord.visitDate
                        ? format(new Date(vitalRecord.visitDate), "hh:mm a")
                        : vitalRecord.createdAt
                        ? format(new Date(vitalRecord.createdAt), "hh:mm a")
                        : ""}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        selectedVitalRecord?._id === vitalRecord._id
                          ? "rotate-180"
                          : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {/* Expanded Vital Details */}
                {selectedVitalRecord?._id === vitalRecord._id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Blood Pressure */}
                      {vitalRecord.vitalSigns?.bloodPressure?.systolic && (
                        <div
                          className={`border-2 rounded-lg p-4 ${
                            getVitalColor("blood pressure").bg
                          } ${getVitalColor("blood pressure").border} ${
                            getVitalColor("blood pressure").text
                          }`}
                        >
                          <h4 className="font-semibold text-sm mb-1">
                            Blood Pressure
                          </h4>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-bold">
                              {vitalRecord.vitalSigns.bloodPressure.systolic}/
                              {vitalRecord.vitalSigns.bloodPressure.diastolic}
                            </span>
                            <span className="text-sm font-medium">
                              {vitalRecord.vitalSigns.bloodPressure.unit ||
                                "mmHg"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Heart Rate */}
                      {vitalRecord.vitalSigns?.heartRate?.value && (
                        <div
                          className={`border-2 rounded-lg p-4 ${
                            getVitalColor("heart rate").bg
                          } ${getVitalColor("heart rate").border} ${
                            getVitalColor("heart rate").text
                          }`}
                        >
                          <h4 className="font-semibold text-sm mb-1">
                            Heart Rate
                          </h4>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-bold">
                              {vitalRecord.vitalSigns.heartRate.value}
                            </span>
                            <span className="text-sm font-medium">
                              {vitalRecord.vitalSigns.heartRate.unit || "bpm"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Temperature */}
                      {vitalRecord.vitalSigns?.temperature?.value && (
                        <div
                          className={`border-2 rounded-lg p-4 ${
                            getVitalColor("temperature").bg
                          } ${getVitalColor("temperature").border} ${
                            getVitalColor("temperature").text
                          }`}
                        >
                          <h4 className="font-semibold text-sm mb-1">
                            Temperature
                          </h4>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-bold">
                              {vitalRecord.vitalSigns.temperature.value}
                            </span>
                            <span className="text-sm font-medium">
                              {vitalRecord.vitalSigns.temperature.unit || "°C"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Oxygen Saturation */}
                      {vitalRecord.vitalSigns?.oxygenSaturation?.value && (
                        <div
                          className={`border-2 rounded-lg p-4 ${
                            getVitalColor("oxygen").bg
                          } ${getVitalColor("oxygen").border} ${
                            getVitalColor("oxygen").text
                          }`}
                        >
                          <h4 className="font-semibold text-sm mb-1">
                            Oxygen Saturation
                          </h4>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-bold">
                              {vitalRecord.vitalSigns.oxygenSaturation.value}
                            </span>
                            <span className="text-sm font-medium">
                              {vitalRecord.vitalSigns.oxygenSaturation.unit ||
                                "%"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Weight */}
                      {vitalRecord.vitalSigns?.weight?.value && (
                        <div
                          className={`border-2 rounded-lg p-4 ${
                            getVitalColor("weight").bg
                          } ${getVitalColor("weight").border} ${
                            getVitalColor("weight").text
                          }`}
                        >
                          <h4 className="font-semibold text-sm mb-1">Weight</h4>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-bold">
                              {vitalRecord.vitalSigns.weight.value}
                            </span>
                            <span className="text-sm font-medium">
                              {vitalRecord.vitalSigns.weight.unit || "kg"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Height */}
                      {vitalRecord.vitalSigns?.height?.value && (
                        <div
                          className={`border-2 rounded-lg p-4 ${
                            getVitalColor("height").bg
                          } ${getVitalColor("height").border} ${
                            getVitalColor("height").text
                          }`}
                        >
                          <h4 className="font-semibold text-sm mb-1">Height</h4>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-bold">
                              {vitalRecord.vitalSigns.height.value}
                            </span>
                            <span className="text-sm font-medium">
                              {vitalRecord.vitalSigns.height.unit || "cm"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* BMI */}
                      {vitalRecord.vitalSigns?.bmi?.value && (
                        <div
                          className={`border-2 rounded-lg p-4 ${
                            getVitalColor("bmi").bg
                          } ${getVitalColor("bmi").border} ${
                            getVitalColor("bmi").text
                          }`}
                        >
                          <h4 className="font-semibold text-sm mb-1">BMI</h4>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-bold">
                              {vitalRecord.vitalSigns.bmi.value}
                            </span>
                          </div>
                          {vitalRecord.vitalSigns.bmi.category && (
                            <span className="text-xs mt-1 inline-block px-2 py-0.5 bg-white dark:bg-gray-950 rounded">
                              {vitalRecord.vitalSigns.bmi.category}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Respiratory Rate */}
                      {vitalRecord.vitalSigns?.respiratoryRate?.value && (
                        <div
                          className={`border-2 rounded-lg p-4 ${
                            getVitalColor("respiratory").bg
                          } ${getVitalColor("respiratory").border} ${
                            getVitalColor("respiratory").text
                          }`}
                        >
                          <h4 className="font-semibold text-sm mb-1">
                            Respiratory Rate
                          </h4>
                          <div className="flex items-baseline space-x-1">
                            <span className="text-2xl font-bold">
                              {vitalRecord.vitalSigns.respiratoryRate.value}
                            </span>
                            <span className="text-sm font-medium">
                              {vitalRecord.vitalSigns.respiratoryRate.unit ||
                                "breaths/min"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Recorded By Info */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {vitalRecord.recordedByName && (
                          <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                            <User className="h-4 w-4" />
                            <span>
                              Recorded by: {vitalRecord.recordedByName} (
                              {vitalRecord.recordedByRole})
                            </span>
                          </div>
                        )}
                        {vitalRecord.visitDate && (
                          <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Visit Date:{" "}
                              {format(
                                new Date(vitalRecord.visitDate),
                                "MMM dd, yyyy"
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Clinical Notes */}
                      {vitalRecord.clinicalNotes?.nurseObservations
                        ?.additionalNotes && (
                        <div className="mt-3 col-span-2 bg-gray-50 dark:bg-black rounded p-3">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Notes:{" "}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {
                              vitalRecord.clinicalNotes.nurseObservations
                                .additionalNotes
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lab Results & Tests Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
              Lab Results & Tests
            </h3>
          </div>
          {labReports.length > 0 && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {labReports.length} report(s)
            </span>
          )}
        </div>

        {loadingLabReports ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-3">
              Loading lab reports...
            </p>
          </div>
        ) : labReports.length === 0 ? (
          <div className="bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg p-8 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
              No Lab Results Available
            </h4>
            <p className="text-gray-600 dark:text-gray-400">
              Laboratory test results and investigation reports will appear here
              when available.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {labReports.map((report) => (
              <div
                key={report._id}
                className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <FileText className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white dark:text-white">
                        {report.testName}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {report.testDate
                          ? format(new Date(report.testDate), "MMM dd, yyyy")
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lab Name */}
                {report.labName && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Lab:{" "}
                    </span>
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      {report.labName}
                    </span>
                  </div>
                )}

                {/* File Information */}
                {report.fileName && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      File:{" "}
                    </span>
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      {report.fileName}
                    </span>
                  </div>
                )}

                {/* File Type and Size */}
                <div className="flex items-center gap-2 mb-2">
                  {report.fileType && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
                      {report.fileType.toUpperCase()}
                    </span>
                  )}
                  {report.fileSize && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {(report.fileSize / 1024).toFixed(2)} KB
                    </span>
                  )}
                </div>

                {/* Notes */}
                {report.notes && (
                  <div className="mb-3 p-2 bg-gray-50 dark:bg-black rounded text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Notes:{" "}
                    </span>
                    {report.notes}
                  </div>
                )}

                {/* Footer with uploader and action buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex flex-col">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium">Uploaded by:</span>{" "}
                      {report.uploadedBy?.fullName || "Unknown"}
                    </div>
                    {report.uploadedAt && (
                      <div className="text-xs text-gray-400">
                        {format(new Date(report.uploadedAt), "MMM dd, yyyy")}
                      </div>
                    )}
                  </div>

                  {report.filePath && (
                    <a
                      href={report.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1 text-xs text-white dark:text-gray-100 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
                    >
                      View Report
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Patient History Tab Component
const PatientHistoryTab = ({ patient }) => {
  // Initialize medicalHistory with empty arrays to prevent undefined errors
  const [medicalHistory, setMedicalHistory] = useState({
    conditions: [],
    allergies: [],
    medications: [],
    surgeries: [],
    familyHistory: [],
    socialHistory: {},
  });
  const [loading, setLoading] = useState(false);

  // Fetch patient medical history from patients collection
  useEffect(() => {
    const fetchMedicalHistory = async () => {
      if (!patient?._id) return;

      // First, try to use medical history from patient prop if available
      if (patient.medicalHistory) {
        const medHistory = patient.medicalHistory;
        setMedicalHistory({
          conditions: Array.isArray(medHistory.conditions)
            ? medHistory.conditions
            : [],
          allergies: Array.isArray(medHistory.allergies)
            ? medHistory.allergies
            : [],
          medications: Array.isArray(medHistory.medications)
            ? medHistory.medications
            : [],
          surgeries: Array.isArray(medHistory.surgeries)
            ? medHistory.surgeries
            : [],
          familyHistory: Array.isArray(medHistory.familyHistory)
            ? medHistory.familyHistory
            : [],
          socialHistory: medHistory.socialHistory || {},
        });
        console.log("Using medical history from patient prop:", medHistory);
        return;
      }

      setLoading(true);

      try {
        // Fetch patient details including medical history from patients collection
        const response = await patientsAPI.getById(patient._id);

        if (response.data.success && response.data.patient) {
          const patientData = response.data.patient;

          // Extract medical history from the patient object
          const medHistory = patientData.medicalHistory || {};

          console.log("Raw medical history from API:", medHistory);
          console.log("Patient data from API:", patientData);

          // Update medical history state with data from patient collection
          const updatedHistory = {
            conditions: Array.isArray(medHistory.conditions)
              ? medHistory.conditions
              : [],
            allergies: Array.isArray(medHistory.allergies)
              ? medHistory.allergies
              : [],
            medications: Array.isArray(medHistory.medications)
              ? medHistory.medications
              : [],
            surgeries: Array.isArray(medHistory.surgeries)
              ? medHistory.surgeries
              : [],
            familyHistory: Array.isArray(medHistory.familyHistory)
              ? medHistory.familyHistory
              : [],
            socialHistory: medHistory.socialHistory || {},
          };

          setMedicalHistory(updatedHistory);

          console.log("Medical history state updated:", updatedHistory);
          console.log("Counts:", {
            conditions: updatedHistory.conditions.length,
            allergies: updatedHistory.allergies.length,
            medications: updatedHistory.medications.length,
            surgeries: updatedHistory.surgeries.length,
          });
        }
      } catch (error) {
        console.error("Error fetching patient medical history:", error);
        console.error("Error details:", error.response?.data);

        // Set empty medical history on error
        setMedicalHistory({
          conditions: [],
          allergies: [],
          medications: [],
          surgeries: [],
          familyHistory: [],
          socialHistory: {},
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMedicalHistory();
  }, [patient?._id, patient?.medicalHistory]);

  const getTypeColor = (type) => {
    switch (type.toLowerCase()) {
      case "consultation":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400";
      case "lab test":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400";
      case "follow-up":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400";
      case "prescription":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200";
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "results available":
        return "bg-blue-100 text-blue-700";
      case "dispensed":
        return "bg-purple-100 text-purple-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300";
    }
  };

  // Helper function to render a list of items
  const renderList = (items, emptyMessage) => {
    if (!items || items.length === 0) {
      return (
        <p className="text-gray-500 dark:text-gray-400 italic">
          {emptyMessage}
        </p>
      );
    }
    return (
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={`item-${index}`}
            className="text-gray-700 dark:text-gray-300"
          >
            {item.name || item}
            {item.date && (
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                ({new Date(item.date).toLocaleDateString()})
              </span>
            )}
            {item.notes && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {item.notes}
              </p>
            )}
          </li>
        ))}
      </ul>
    );
  };

  // Render medical history section
  const renderMedicalHistory = () => {
    return (
      <div className="space-y-6">
        {/* Medical History Section */}
        <div className="bg-white dark:bg-gray-950 rounded-lg shadow overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-900/10 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200 flex items-center">
              <ClipboardList className="h-5 w-5 mr-2 text-blue-600" />
              Medical History
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Patient Name
                </h3>
                <p className="text-gray-900 dark:text-white dark:text-white">
                  {patient?.fullName || "N/A"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Date of Birth
                </h3>
                <p className="text-gray-900 dark:text-white dark:text-white">
                  {patient?.dateOfBirth
                    ? new Date(patient.dateOfBirth).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Blood Group
                </h3>
                <p className="text-gray-900 dark:text-white dark:text-white">
                  {patient?.bloodGroup || "N/A"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Last Updated
                </h3>
                <p className="text-gray-900 dark:text-white dark:text-white">
                  {patient?.updatedAt
                    ? new Date(patient.updatedAt).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </div>

            {/* Medical Conditions */}
            <div className="mt-6">
              <h3 className="text-base font-medium text-gray-900 dark:text-white dark:text-white mb-3 flex items-center">
                <Activity className="h-5 w-5 text-blue-600 mr-2" />
                Medical Conditions
              </h3>
              <div className="bg-gray-50 dark:bg-black p-4 rounded">
                {renderList(
                  medicalHistory.conditions,
                  "No medical conditions recorded"
                )}
              </div>
            </div>

            {/* Allergies */}
            <div className="mt-6">
              <h3 className="text-base font-medium text-gray-900 dark:text-white dark:text-white mb-3 flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                Allergies
              </h3>
              <div className="bg-gray-50 dark:bg-black p-4 rounded">
                {medicalHistory.allergies &&
                medicalHistory.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {medicalHistory.allergies.map((allergy, index) => (
                      <span
                        key={`allergy-${index}`}
                        className="bg-red-50 text-red-800 text-sm px-3 py-1 rounded-full border border-red-100"
                      >
                        {allergy}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    No allergies recorded
                  </p>
                )}
              </div>
            </div>

            {/* Current Medications */}
            <div className="mt-6">
              <h3 className="text-base font-medium text-gray-900 dark:text-white dark:text-white mb-3 flex items-center">
                <Pill className="h-5 w-5 text-green-600 mr-2" />
                Current Medications
              </h3>
              <div className="bg-gray-50 dark:bg-black p-4 rounded">
                {renderList(
                  medicalHistory.medications,
                  "No current medications recorded"
                )}
              </div>
            </div>

            {/* Surgical History */}
            <div className="mt-6">
              <h3 className="text-base font-medium text-gray-900 dark:text-white dark:text-white mb-3 flex items-center">
                <Scissors className="h-5 w-5 text-purple-600 mr-2" />
                Surgical History
              </h3>
              <div className="bg-gray-50 dark:bg-black p-4 rounded">
                {renderList(
                  medicalHistory.surgeries,
                  "No surgical history recorded"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-2">
          Patient Medical History
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Complete medical, family, and social history from patient collection
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading medical history...
          </p>
        </div>
      ) : (
        renderMedicalHistory()
      )}
    </div>
  );
};

// Referral Tab Component
const ReferralTab = ({ patient, referrals = [] }) => {
  const [referralsList, setReferralsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);

  // Fetch referrals from API
  useEffect(() => {
    const fetchReferrals = async () => {
      if (!patient?._id) return;

      setLoading(true);
      try {
        const response = await referralsAPI.getAll({ patientId: patient._id });
        console.log("Referrals API Response:", response);

        // Handle different response formats
        let referralsData = [];
        if (response.data?.referrals) {
          referralsData = response.data.referrals;
        } else if (response.data?.data) {
          referralsData = response.data.data;
        } else if (Array.isArray(response.data)) {
          referralsData = response.data;
        }

        console.log("Parsed Referrals Data:", referralsData);
        console.log("Sample Referral (if exists):", referralsData[0]);

        setReferralsList(referralsData);
      } catch (error) {
        console.error("Error fetching referrals:", error);
        setReferralsList([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReferrals();
  }, [patient]);

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "normal":
      case "low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300";
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-2">
          Referrals
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Referrals to specialists and other healthcare providers
        </p>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading referrals...
          </p>
        </div>
      ) : referralsList.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No Referrals
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Referrals will appear here when created.
          </p>
        </div>
      ) : (
        /* Referral Accordion List */
        <div className="space-y-3">
          {referralsList.map((referral, index) => (
            <div
              key={referral._id || referral.id}
              className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden"
            >
              {/* Accordion Header */}
              <button
                onClick={() =>
                  setExpandedIndex(expandedIndex === index ? null : index)
                }
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users
                    className={`h-5 w-5 ${
                      referral.referralType === "outbound"
                        ? "text-blue-600"
                        : "text-green-600"
                    }`}
                  />
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white">
                      {referral.specialistName || "Specialist Referral"}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {referral.specialty} •{" "}
                      {format(new Date(referral.createdAt), "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-md text-sm font-medium ${getStatusColor(
                      referral.status
                    )}`}
                  >
                    {referral.status}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform ${
                      expandedIndex === index ? "transform rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Accordion Content */}
              {expandedIndex === index && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-200 dark:border-gray-800 space-y-4">
                  {/* Urgency Badge */}
                  {referral.urgency && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                          referral.urgency
                        )}`}
                      >
                        {referral.urgency} Priority
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {referral.referralType === "outbound"
                          ? "Outbound"
                          : "Inbound"}{" "}
                        Referral
                      </span>
                    </div>
                  )}

                  {/* Patient Information Section */}
                  {referral.patientId && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 border border-indigo-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        Patient Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Name:
                          </span>
                          <p className="text-gray-900 dark:text-white dark:text-white">
                            {referral.patientId.fullName ||
                              referral.patientName}
                          </p>
                        </div>
                        {referral.patientId.uhid && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              UHID:
                            </span>
                            <p className="text-gray-900 dark:text-white dark:text-white">
                              {referral.patientId.uhid}
                            </p>
                          </div>
                        )}
                        {referral.patientId.phone && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Phone:
                            </span>
                            <p className="text-gray-900 dark:text-white dark:text-white">
                              {referral.patientId.phone}
                            </p>
                          </div>
                        )}
                        {referral.patientId.email && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Email:
                            </span>
                            <p className="text-gray-900 dark:text-white dark:text-white truncate">
                              {referral.patientId.email}
                            </p>
                          </div>
                        )}
                        {referral.patientId.dateOfBirth && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              DOB:
                            </span>
                            <p className="text-gray-900 dark:text-white dark:text-white">
                              {format(
                                new Date(referral.patientId.dateOfBirth),
                                "MMM dd, yyyy"
                              )}
                            </p>
                          </div>
                        )}
                        {referral.patientId.gender && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              Gender:
                            </span>
                            <p className="text-gray-900 dark:text-white dark:text-white capitalize">
                              {referral.patientId.gender}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Referral Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-1">
                          Specialist:
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300">
                          {referral.specialistName}
                        </p>
                        {referral.externalClinic && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {referral.externalClinic}
                          </p>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-1">
                          Created:
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300">
                          {referral.createdAt
                            ? format(
                                new Date(referral.createdAt),
                                "MMM dd, yyyy 'at' hh:mm a"
                              )
                            : "N/A"}
                        </p>
                      </div>

                      {referral.preferredDate && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-1">
                            Preferred Date:
                          </h4>
                          <p className="text-gray-700 dark:text-gray-300">
                            {format(
                              new Date(referral.preferredDate),
                              "MMM dd, yyyy"
                            )}
                            {referral.preferredTime &&
                              ` at ${referral.preferredTime}`}
                          </p>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-1">
                          Reason for Referral:
                        </h4>
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 rounded-md p-3">
                          <p className="text-blue-800 text-sm">
                            {referral.reason}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-1">
                          Referring Provider:
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300">
                          {referral.referringProvider?.name || "N/A"}
                        </p>
                        {referral.referringProvider?.phone && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {referral.referringProvider.phone}
                          </p>
                        )}
                      </div>

                      {referral.specialistContact?.phone && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-1">
                            Specialist Contact:
                          </h4>
                          <p className="text-gray-700 dark:text-gray-300">
                            {referral.specialistContact.phone}
                          </p>
                          {referral.specialistContact.email && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {referral.specialistContact.email}
                            </p>
                          )}
                        </div>
                      )}

                      {referral.clinicalHistory && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-1">
                            Clinical History:
                          </h4>
                          <div className="bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-md p-3">
                            <p className="text-gray-700 dark:text-gray-300 text-sm">
                              {referral.clinicalHistory}
                            </p>
                          </div>
                        </div>
                      )}

                      {referral.statusNotes && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-1">
                            Status Notes:
                          </h4>
                          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                            <p className="text-yellow-800 text-sm">
                              {referral.statusNotes}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Additional Information */}
                  {(referral.currentMedications?.length > 0 ||
                    referral.specialInstructions) && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                      {referral.currentMedications?.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                            Current Medications:
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {referral.currentMedications.map((med, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 rounded text-xs"
                              >
                                {med}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {referral.specialInstructions && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-1">
                            Special Instructions:
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                            {referral.specialInstructions}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Patient Profile Tab Component
const PatientProfileTab = ({
  patient,
  appointments = [],
  referrals = [],
  billingRecords = [],
  loadingAdditionalData = false,
}) => {
  const getAgeFromDOB = (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Patient Profile Section */}
      <div className="bg-gradient-to-r from-[#e6f0ff] to-[#e6f7f5] dark:from-gray-900 dark:to-gray-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-6">
          Patient Profile
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Photo and Basic IDs */}
          <div className="flex flex-col items-center space-y-4">
            {patient.photo ? (
              <img
                src={patient.photo}
                alt="Patient"
                className="h-32 w-32 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-lg dark:shadow-gray-900"
              />
            ) : (
              <div className="h-32 w-32 rounded-full bg-gradient-to-r from-[#cce0ff] to-[#ccebf0] dark:from-gray-700 dark:to-gray-600 flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-lg dark:shadow-gray-900">
                <span className="text-[#004D99] font-bold text-4xl">
                  {patient.firstName ? patient.firstName[0].toUpperCase() : "P"}
                </span>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className="bg-white dark:bg-gray-950 rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-[#004D99]" /> Basic Information
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  UHID:
                </span>
                <span className="ml-2 text-gray-900 dark:text-white dark:text-white">
                  {patient.uhid || patient.pid}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Full Name:
                </span>
                <span className="ml-2 text-gray-900 dark:text-white dark:text-white">
                  {patient.fullName}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Gender:
                </span>
                <span className="ml-2 text-gray-900 dark:text-white dark:text-white">
                  {patient.gender}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  DOB / Age:
                </span>
                <span className="ml-2 text-gray-900 dark:text-white dark:text-white">
                  {format(new Date(patient.dateOfBirth), "dd/MM/yyyy")} →{" "}
                  {getAgeFromDOB(patient.dateOfBirth)} Y
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Mobile:
                </span>
                <span className="ml-2 text-gray-900 dark:text-white dark:text-white">
                  {patient.phone}
                </span>
              </div>
              {patient.email && (
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Email:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-white dark:text-white">
                    {patient.email}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Address & Insurance */}
          <div className="bg-white dark:bg-gray-950 rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-[#004D99]" /> Address &
              Insurance
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Address:
                </span>
                <div className="text-gray-900 dark:text-white dark:text-white text-sm mt-1">
                  {patient.address.street}
                  <br />
                  {patient.address.city}
                  <br />
                  {patient.address.zipCode}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Insurance:
                </span>
                <span className="ml-2 text-gray-900 dark:text-white dark:text-white">
                  {patient.insurance?.provider || "(empty)"}
                </span>
              </div>
              {patient.bloodGroup && (
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Blood Group:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-white dark:text-white">
                    {patient.bloodGroup}
                  </span>
                </div>
              )}
              {patient.occupation && (
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Occupation:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-white dark:text-white">
                    {patient.occupation}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Information */}
      {(patient.wallets?.general > 0 || patient.wallets?.pharmacy > 0) && (
        <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
            <CreditCard className="h-5 w-5 mr-2 text-[#004D99]" />
            Wallet Balance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  General Wallet
                </span>
                <span className="text-lg font-bold text-green-600">
                  ₹{patient.wallets.general || 0}
                </span>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Pharmacy Wallet
                </span>
                <span className="text-lg font-bold text-blue-600">
                  ₹{patient.wallets.pharmacy || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Visit History */}
      {patient.visits && patient.visits.length > 0 && (
        <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
            <Building className="h-5 w-5 mr-2 text-[#004D99]" />
            Recent Visits
          </h3>
          <div className="space-y-3">
            {patient.visits.slice(0, 3).map((visit, index) => (
              <div
                key={index}
                className="border-l-4 border-blue-200 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-r-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white dark:text-white">
                      {visit.clinicName}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Type: {visit.clinicCode}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Check-in: {formatDate(visit.checkIn)}
                    </p>
                  </div>
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full">
                    Visit #{index + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History Summary */}
      {(patient.payments?.credits?.length > 0 ||
        patient.payments?.debits?.length > 0) && (
        <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
            <CreditCard className="h-5 w-5 mr-2 text-[#004D99]" />
            Recent Payment Activity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Credits */}
            {patient.payments.credits &&
              patient.payments.credits.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-600 mb-3">
                    Recent Credits
                  </h4>
                  <div className="space-y-2">
                    {patient.payments.credits
                      .slice(0, 3)
                      .map((credit, index) => (
                        <div key={index} className="bg-green-50 p-3 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {credit.mode}
                            </span>
                            <span className="font-medium text-green-600">
                              +₹{credit.amount}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(credit.createdAt)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Debits */}
            {patient.payments.debits && patient.payments.debits.length > 0 && (
              <div>
                <h4 className="font-medium text-red-600 mb-3">Recent Debits</h4>
                <div className="space-y-2">
                  {patient.payments.debits.slice(0, 3).map((debit, index) => (
                    <div key={index} className="bg-red-50 p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {debit.mode}
                        </span>
                        <span className="font-medium text-red-600">
                          -₹{debit.amount}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(debit.debitedOn)}
                      </p>
                      {debit.details && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {debit.details}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clinic Category History */}
      <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
          <History className="h-5 w-5 mr-2 text-[#004D99]" />
          Clinic Category History
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-600 dark:text-gray-400">
              Old Category:
            </span>
            <p className="text-gray-900 dark:text-white dark:text-white">
              {patient.categoryHistory.old}
            </p>
          </div>
          <div>
            <span className="font-medium text-gray-600 dark:text-gray-400">
              New Category:
            </span>
            <p className="text-gray-900 dark:text-white dark:text-white">
              {patient.categoryHistory.new}
            </p>
          </div>
          <div>
            <span className="font-medium text-gray-600 dark:text-gray-400">
              Dated On:
            </span>
            <p className="text-gray-900 dark:text-white dark:text-white">
              {formatDate(patient.categoryHistory.date)}
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Contact Information */}
      {(patient.emergencyContact?.name || patient.emergencyContact?.phone) && (
        <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
            <Phone className="h-5 w-5 mr-2 text-[#004D99]" />
            Emergency Contact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Name
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                {patient.emergencyContact.name || "N/A"}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Relationship
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                {patient.emergencyContact.relationship || "N/A"}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Phone
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                {patient.emergencyContact.phone || "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Insurance Details */}
      {(patient.insurance?.provider || patient.insurance?.policyNumber) && (
        <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
            <CreditCard className="h-5 w-5 mr-2 text-[#004D99]" />
            Insurance Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Provider
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                {patient.insurance.provider || "N/A"}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Policy Number
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                {patient.insurance.policyNumber || "N/A"}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Group Number
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                {patient.insurance.groupNumber || "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Government ID Information */}
      {(patient.governmentId || patient.idNumber) && (
        <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-[#004D99]" />
            Government ID
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-yellow-50 rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                ID Type
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                {patient.governmentId || "N/A"}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                ID Number
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                {patient.idNumber || "N/A"}
              </p>
            </div>
            {patient.governmentDocument && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Document
                </span>
                <a
                  href={patient.governmentDocument}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  View Document
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Medical History */}
      {(patient.medicalHistory?.conditions?.length > 0 ||
        patient.medicalHistory?.allergies?.length > 0 ||
        patient.medicalHistory?.medications?.length > 0 ||
        patient.medicalHistory?.surgeries?.length > 0) && (
        <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
            <Heart className="h-5 w-5 mr-2 text-[#004D99]" />
            Medical History
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {patient.medicalHistory.conditions?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                  Medical Conditions
                </h4>
                <div className="space-y-1">
                  {patient.medicalHistory.conditions.map((condition, index) => (
                    <span
                      key={index}
                      className="inline-block bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 text-xs px-2 py-1 rounded-full mr-2 mb-1"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {patient.medicalHistory.allergies?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                  Allergies
                </h4>
                <div className="space-y-1">
                  {patient.medicalHistory.allergies.map((allergy, index) => (
                    <span
                      key={index}
                      className="inline-block bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 text-xs px-2 py-1 rounded-full mr-2 mb-1"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {patient.medicalHistory.medications?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                  Current Medications
                </h4>
                <div className="space-y-1">
                  {patient.medicalHistory.medications.map(
                    (medication, index) => (
                      <span
                        key={index}
                        className="inline-block bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs px-2 py-1 rounded-full mr-2 mb-1"
                      >
                        {medication}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {patient.medicalHistory.surgeries?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                  Previous Surgeries
                </h4>
                <div className="space-y-1">
                  {patient.medicalHistory.surgeries.map((surgery, index) => (
                    <span
                      key={index}
                      className="inline-block bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 text-xs px-2 py-1 rounded-full mr-2 mb-1"
                    >
                      {surgery}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Referral Information */}
      {(patient.referringDoctor || patient.referredClinic) && (
        <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-[#004D99]" />
            Referral Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-indigo-50 rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Referring Doctor
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                {patient.referringDoctor || "N/A"}
              </p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Referred Clinic
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                {patient.referredClinic || "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Patient Status & Registration Info */}
      <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
          <Activity className="h-5 w-5 mr-2 text-[#004D99]" />
          Patient Status & Timeline
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-black rounded-lg p-4">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Current Status
            </span>
            <p className="text-lg font-semibold text-green-600">
              {patient.status || "Active"}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-black rounded-lg p-4">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Patient ID (UHID)
            </span>
            <p className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
              {patient.uhid || patient.pid}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-black rounded-lg p-4">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Registration Date
            </span>
            <p className="text-sm text-gray-900 dark:text-white dark:text-white">
              {formatDate(patient.createdAt)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-black rounded-lg p-4">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Last Visit
            </span>
            <p className="text-sm text-gray-900 dark:text-white dark:text-white">
              {patient.lastVisit ? formatDate(patient.lastVisit) : "N/A"}
            </p>
          </div>
        </div>
        {patient.notes && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Notes
            </span>
            <p className="text-sm text-gray-900 dark:text-white dark:text-white mt-1">
              {patient.notes}
            </p>
          </div>
        )}
      </div>

      {/* Real-Time Appointments */}
      <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-[#004D99]" />
          Recent Appointments
          {loadingAdditionalData && (
            <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-[#004D99] dark:border-blue-400"></div>
          )}
        </h3>
        {appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments.slice(0, 5).map((appointment, index) => (
              <div
                key={index}
                className="border-l-4 border-green-200 dark:border-green-600 bg-green-50 dark:bg-green-900/20 p-4 rounded-r-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white dark:text-white">
                      {appointment.appointmentType || "General Consultation"}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Doctor:{" "}
                      {appointment.doctorId?.fullName ||
                        appointment.provider ||
                        "N/A"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Date: {formatDate(appointment.date)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Time: {appointment.time || "N/A"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      appointment.status?.toLowerCase() === "completed"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                        : appointment.status?.toLowerCase() === "confirmed"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                        : appointment.status?.toLowerCase() === "scheduled"
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
                        : appointment.status?.toLowerCase() === "cancelled"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                        : "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200"
                    }`}
                  >
                    {appointment.status || "Scheduled"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No appointments found
          </p>
        )}
      </div>

      {/* Real-Time Referrals */}
      <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
          <Users className="h-5 w-5 mr-2 text-[#004D99]" />
          Recent Referrals
          {loadingAdditionalData && (
            <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-[#004D99] dark:border-blue-400"></div>
          )}
        </h3>
        {referrals.length > 0 ? (
          <div className="space-y-3">
            {referrals.slice(0, 5).map((referral, index) => (
              <div
                key={index}
                className="border-l-4 border-purple-200 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-r-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white dark:text-white">
                      {referral.specialty || "Specialist Referral"}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      To: {referral.specialistName || "Specialist"}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      From:{" "}
                      {referral.referringProvider?.name ||
                        referral.referredBy?.fullName ||
                        "Primary Care"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Date: {formatDate(referral.createdAt)}
                    </p>
                    {referral.reason && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Reason: {referral.reason}
                      </p>
                    )}
                    {referral.urgency && (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                          referral.urgency === "High"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                            : referral.urgency === "Medium"
                            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                        }`}
                      >
                        {referral.urgency} Priority
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      referral.status?.toLowerCase() === "completed"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                        : referral.status?.toLowerCase() === "in progress"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                        : referral.status?.toLowerCase() === "approved"
                        ? "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400"
                        : referral.status?.toLowerCase() === "pending"
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
                        : referral.status?.toLowerCase() === "cancelled"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                        : "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200"
                    }`}
                  >
                    {referral.status || "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No referrals found
          </p>
        )}
      </div>

      {/* Real-Time Billing Summary */}
      {billingRecords.length > 0 && (
        <div className="bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
          <h3 className="font-semibent text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
            <CreditCard className="h-5 w-5 mr-2 text-[#004D99]" />
            Recent Billing Records
            {loadingAdditionalData && (
              <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-[#004D99] dark:border-blue-400"></div>
            )}
          </h3>
          <div className="space-y-3">
            {billingRecords.slice(0, 3).map((record, index) => (
              <div
                key={index}
                className="border-l-4 border-orange-200 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-r-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white dark:text-white">
                      {record.description || "Medical Service"}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Amount: ₹{record.amount || "0"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Date: {formatDate(record.billingDate || record.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      record.status === "paid"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                        : record.status === "pending"
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
                        : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                    }`}
                  >
                    {record.status || "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
const ImageGalleryTab = ({ patient }) => {
  const [governmentDocuments, setGovernmentDocuments] = useState([]);
  const [medicalImages, setMedicalImages] = useState([]);
  const [patientPictures, setPatientPictures] = useState([]);
  const [activeTab, setActiveTab] = useState("documents");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState({
    government: false,
    medical: false,
    profile: false,
  });

  // Function to manually trigger a refresh of medical images
  const refreshMedicalImages = async () => {
    if (!patient?._id) {
      setError("No patient ID available");
      return;
    }

    setLoading((prev) => ({ ...prev, medical: true }));
    setError(null);

    try {
      console.log(
        `[DEBUG] Fetching medical images for patient ID: ${patient._id}`
      );
      const response = await medicalImagesAPI.getByPatient(patient._id);
      console.log("[DEBUG] API Response:", response);

      // Handle different response formats
      let imagesData = [];
      if (response.data?.data) {
        // Handle paginated response
        imagesData = response.data.data;
      } else if (Array.isArray(response.data)) {
        // Handle direct array response
        imagesData = response.data;
      } else if (
        response.data?.success &&
        Array.isArray(response.data.medicalImages)
      ) {
        // Handle success object with medicalImages array
        imagesData = response.data.medicalImages;
      } else if (response.data?.success && response.data.data) {
        // Handle another possible response format
        imagesData = response.data.data;
      } else {
        console.warn("[DEBUG] Unexpected API response format:", response);
      }

      console.log(`[DEBUG] Processed ${imagesData.length} medical images`);

      // Process and validate each image
      const processedImages = imagesData
        .filter((img) => img && (img.imageUrl || img.cloudinaryUrl)) // Ensure we have a valid URL
        .map((img) => ({
          ...img,
          id:
            img._id ||
            img.id ||
            `img-${Math.random().toString(36).substr(2, 9)}`,
          type: "medical",
          title: img.title || `Medical Image ${img.imageType || ""}`.trim(),
          imageUrl: img.imageUrl || img.cloudinaryUrl,
          uploadedAt:
            img.createdAt || img.uploadedAt || new Date().toISOString(),
          uploadedBy: img.uploadedBy || { fullName: "System" },
          description:
            img.description ||
            `Medical image taken on ${new Date(
              img.imageTakenDate || new Date()
            ).toLocaleDateString()}`,
        }));

      setMedicalImages(processedImages);

      if (processedImages.length === 0) {
        console.log("[DEBUG] No medical images found for this patient");
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch medical images";
      console.error("[DEBUG] Error fetching medical images:", {
        error: errorMessage,
        response: error.response?.data,
        patientId: patient._id,
      });
      setError(`Error loading medical images: ${errorMessage}`);
      setMedicalImages([]);
    } finally {
      setLoading((prev) => ({ ...prev, medical: false }));
    }
  };

  // Fetch all images when component mounts or patient changes
  useEffect(() => {
    if (!patient?._id) return;

    // Fetch government documents
    const fetchGovernmentDocs = async () => {
      setLoading((prev) => ({ ...prev, government: true }));
      try {
        const govDocs = [];
        if (patient.governmentDocument) {
          govDocs.push({
            id: "gov-doc-1",
            title: "Government Document",
            description: patient.governmentDocument,
            imageUrl: patient.governmentDocument,
            type: "government",
            uploadedAt: patient.updatedAt || new Date().toISOString(),
          });
        }
        setGovernmentDocuments(govDocs);
      } catch (error) {
        console.error("Error fetching government documents:", error);
        setGovernmentDocuments([]);
      } finally {
        setLoading((prev) => ({ ...prev, government: false }));
      }
    };

    // Fetch medical images from MedicalImage collection
    const fetchMedicalImages = async () => {
      if (!patient?._id) {
        console.log(
          "[DEBUG] No patient ID available, skipping medical images fetch"
        );
        setMedicalImages([]);
        return;
      }

      setLoading((prev) => ({ ...prev, medical: true }));
      setError(null);

      try {
        console.log(
          `[DEBUG] Fetching medical images for patient: ${patient._id}`
        );
        const response = await medicalImagesAPI.getByPatient(patient._id);
        console.log("[DEBUG] API Response:", response);

        // Handle different response formats
        let imagesData = [];
        if (response.data?.data) {
          // Handle paginated response
          imagesData = response.data.data;
        } else if (Array.isArray(response.data)) {
          // Handle direct array response
          imagesData = response.data;
        } else if (
          response.data?.success &&
          Array.isArray(response.data.medicalImages)
        ) {
          // Handle success object with medicalImages array
          imagesData = response.data.medicalImages;
        } else if (response.data?.success && response.data.data) {
          // Handle another possible response format
          imagesData = response.data.data;
        } else {
          console.warn("[DEBUG] Unexpected API response format:", response);
        }

        console.log(`[DEBUG] Processed ${imagesData.length} medical images`);

        // Process and validate each image
        const processedImages = imagesData
          .filter((img) => img && (img.imageUrl || img.cloudinaryUrl)) // Ensure we have a valid URL
          .map((img) => ({
            ...img,
            id:
              img._id ||
              img.id ||
              `img-${Math.random().toString(36).substr(2, 9)}`,
            type: "medical",
            title: img.title || `Medical Image ${img.imageType || ""}`.trim(),
            imageUrl: img.imageUrl || img.cloudinaryUrl,
            uploadedAt:
              img.createdAt || img.uploadedAt || new Date().toISOString(),
            uploadedBy: img.uploadedBy || { fullName: "System" },
            description:
              img.description ||
              `Medical image taken on ${new Date(
                img.imageTakenDate || new Date()
              ).toLocaleDateString()}`,
          }));

        setMedicalImages(processedImages);

        if (processedImages.length === 0) {
          console.log("[DEBUG] No medical images found for this patient");
        }
      } catch (error) {
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          "Failed to fetch medical images";
        console.error("[DEBUG] Error fetching medical images:", {
          error: errorMessage,
          response: error.response?.data,
          patientId: patient._id,
        });
        setError(`Error loading medical images: ${errorMessage}`);
        setMedicalImages([]);
      } finally {
        setLoading((prev) => ({ ...prev, medical: false }));
      }
    };

    // Fetch patient profile pictures
    const fetchPatientPictures = async () => {
      setLoading((prev) => ({ ...prev, profile: true }));
      try {
        const profilePics = [];
        if (patient.photo) {
          profilePics.push({
            id: "profile-pic",
            title: "Profile Picture",
            description: "Patient profile photo",
            imageUrl: patient.photo,
            type: "profile",
            uploadedAt: patient.updatedAt || new Date().toISOString(),
          });
        }
        setPatientPictures(profilePics);
      } catch (error) {
        console.error("Error fetching patient pictures:", error);
        setPatientPictures([]);
      } finally {
        setLoading((prev) => ({ ...prev, profile: false }));
      }
    };

    // Execute all fetches in parallel
    Promise.all([
      fetchGovernmentDocs(),
      fetchMedicalImages(),
      fetchPatientPictures(),
    ]);
  }, [patient]);

  // Combine profile pictures and government documents into one category
  const allDocuments = [...patientPictures, ...governmentDocuments].sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );

  // Sort medical images by upload date (newest first)
  const sortedMedicalImages = [...medicalImages].sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );

  // Get the appropriate images based on active tab
  const getCurrentImages = () => {
    if (activeTab === "documents") return allDocuments;
    if (activeTab === "medical") return sortedMedicalImages;
    return [];
  };

  const currentImages = getCurrentImages();
  const isLoading = Object.values(loading).some((val) => val === true);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-2">
              Image Gallery
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Medical images and documents for {patient?.fullName || "patient"}
            </p>
          </div>
          <button
            onClick={refreshMedicalImages}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center"
            disabled={loading.medical}
          >
            {loading.medical ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white dark:text-gray-100"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded relative"
            role="alert"
          >
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
            <button
              onClick={() => setError(null)}
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
            >
              <span className="sr-only">Close</span>
              <svg
                className="fill-current h-6 w-6 text-red-500"
                role="button"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
              >
                <title>Close</title>
                <path d="M14.348 14.849a1.2 1.2 0 01-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 11-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 111.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 111.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 010 1.698z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("documents")}
            className={`${
              activeTab === "documents"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-700"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Government Documents ({allDocuments.length})
          </button>
          <button
            onClick={() => setActiveTab("medical")}
            className={`${
              activeTab === "medical"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-700"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Medical Images ({sortedMedicalImages.length})
          </button>
        </nav>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading {activeTab === "documents" ? "documents" : "medical images"}
            ...
          </p>
        </div>
      ) : currentImages.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {currentImages.map((item, index) => (
            <div
              key={`${item.type}-${item.id || index}`}
              className="bg-white dark:bg-gray-950 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-800"
            >
              <div className="relative aspect-w-4 aspect-h-3">
                <img
                  src={item.imageUrl || item.cloudinaryUrl}
                  alt={item.title || `${item.type} image`}
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    e.target.src =
                      item.type === "government"
                        ? "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgdmlld0JveD0iMCAwIDIwMCAyNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyNTAiIGZpbGw9IiNGM0Y0RjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzlDQTNCRiI+RG9jdW1lbnQ8L3RleHQ+PC9zdmc+"
                        : "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNFNUU3RUIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzlDQTNCRiI+SW1hZ2U8L3RleHQ+PC9zdmc+";
                  }}
                />
                {item.type === "medical" && item.imageType && (
                  <div className="absolute top-2 right-2">
                    <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                      {item.imageType}
                    </span>
                  </div>
                )}
                {item.type === "profile" && (
                  <div className="absolute top-2 right-2">
                    <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">
                      Profile
                    </span>
                  </div>
                )}
                {item.type === "government" && (
                  <div className="absolute top-2 right-2">
                    <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-medium">
                      Document
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900 dark:text-white dark:text-white mb-1 line-clamp-1">
                  {item.title ||
                    `${
                      item.type.charAt(0).toUpperCase() + item.type.slice(1)
                    } ${index + 1}`}
                </h3>
                {item.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    {item.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                  <span>
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </span>
                  <span>
                    {item.uploadedAt
                      ? format(new Date(item.uploadedAt), "MMM dd, yyyy")
                      : ""}
                  </span>
                </div>
                {item.uploadedBy && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Uploaded by: {item.uploadedBy.fullName || "System"}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-gray-950 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <Camera className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            {activeTab === "documents"
              ? "No government documents found"
              : "No medical images found"}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {activeTab === "documents"
              ? "No government documents or profile pictures have been uploaded for this patient."
              : "No medical images have been uploaded for this patient yet."}
          </p>
        </div>
      )}
    </div>
  );
};

// Drug History Tab Component
const DrugHistoryTab = ({ patient }) => {
  // Sample drug history data
  const drugHistory = [
    {
      id: 1,
      medication: "Lisinopril",
      genericName: "Lisinopril",
      dosage: "10mg",
      frequency: "Once daily",
      startDate: "2024-01-20",
      endDate: null,
      prescribingDoctor: "Dr. Sarah Wilson",
      indication: "Hypertension",
      status: "active",
      sideEffects: "None reported",
      effectiveness: "Good blood pressure control",
    },
    {
      id: 2,
      medication: "Atorvastatin",
      genericName: "Atorvastatin Calcium",
      dosage: "20mg",
      frequency: "Once daily",
      startDate: "2024-01-15",
      endDate: null,
      prescribingDoctor: "Dr. Michael Brown",
      indication: "Hyperlipidemia",
      status: "active",
      sideEffects: "Mild muscle aches (resolved)",
      effectiveness: "Cholesterol reduced by 25%",
    },
    {
      id: 3,
      medication: "Amlodipine",
      genericName: "Amlodipine",
      dosage: "5mg",
      frequency: "Once daily",
      startDate: "2024-01-20",
      endDate: null,
      prescribingDoctor: "Dr. Sarah Wilson",
      indication: "Hypertension (added to regimen)",
      status: "active",
      sideEffects: "Mild ankle swelling",
      effectiveness: "Improved blood pressure control",
    },
    {
      id: 4,
      medication: "Acetaminophen",
      genericName: "Acetaminophen",
      dosage: "500mg",
      frequency: "Every 6 hours as needed",
      startDate: "2023-11-10",
      endDate: "2023-11-17",
      prescribingDoctor: "Dr. Emergency Team",
      indication: "Pain relief (Acute Bronchitis)",
      status: "discontinued",
      sideEffects: "None",
      effectiveness: "Effective pain relief",
    },
    {
      id: 5,
      medication: "Loratadine",
      genericName: "Loratadine",
      dosage: "10mg",
      frequency: "Once daily as needed",
      startDate: "2023-08-05",
      endDate: null,
      prescribingDoctor: "Dr. Lisa Anderson",
      indication: "Allergic Rhinitis",
      status: "as_needed",
      sideEffects: "None",
      effectiveness: "Good symptom control",
    },
    {
      id: 6,
      medication: "Ibuprofen",
      genericName: "Ibuprofen",
      dosage: "400mg",
      frequency: "Every 8 hours as needed",
      startDate: "2023-06-20",
      endDate: "2023-07-05",
      prescribingDoctor: "Dr. Orthopedic Team",
      indication: "Post-surgical pain",
      status: "discontinued",
      sideEffects: "Mild stomach upset",
      effectiveness: "Effective pain management",
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400";
      case "discontinued":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400";
      case "as_needed":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400";
      case "on_hold":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200";
    }
  };

  const getEffectivenessColor = (effectiveness) => {
    if (
      effectiveness.toLowerCase().includes("good") ||
      effectiveness.toLowerCase().includes("effective")
    ) {
      return "text-green-600";
    } else if (effectiveness.toLowerCase().includes("moderate")) {
      return "text-yellow-600";
    } else {
      return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-6">
        Drug History
      </h2>

      <div className="space-y-4">
        {drugHistory.map((drug) => (
          <div
            key={drug.id}
            className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6 shadow-sm"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                    {drug.medication}
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({drug.genericName})
                  </span>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                      drug.status
                    )}`}
                  >
                    {drug.status.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <div>
                    <span className="font-medium">Dosage:</span> {drug.dosage}
                  </div>
                  <div>
                    <span className="font-medium">Frequency:</span>{" "}
                    {drug.frequency}
                  </div>
                  <div>
                    <span className="font-medium">Prescribed by:</span>{" "}
                    {drug.prescribingDoctor}
                  </div>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <span className="font-medium">Indication:</span>{" "}
                  {drug.indication}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                      Start Date:
                    </span>{" "}
                    {drug.startDate}
                    {drug.endDate && (
                      <>
                        <br />
                        <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                          End Date:
                        </span>{" "}
                        {drug.endDate}
                      </>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                      Effectiveness:
                    </span>
                    <span
                      className={`ml-1 ${getEffectivenessColor(
                        drug.effectiveness
                      )}`}
                    >
                      {drug.effectiveness}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white dark:text-white mb-1">
                    Side Effects:
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300">
                    {drug.sideEffects}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white dark:text-white mb-1">
                    Notes:
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300">
                    {drug.effectiveness}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {drugHistory.length === 0 && (
        <div className="text-center py-12">
          <Pill className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No drug history
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Medication history will appear here as prescriptions are added to
            the patient's record.
          </p>
        </div>
      )}
    </div>
  );
};

// Family History Tab Component
const FamilyHistoryTab = ({ patient }) => {
  // Sample family history data
  const familyHistory = [
    {
      id: 1,
      relationship: "Father",
      name: "John Doe Sr.",
      age: 68,
      livingStatus: "Alive",
      conditions: [
        "Hypertension",
        "Type 2 Diabetes",
        "Coronary Artery Disease",
      ],
      ageOfOnset: [45, 52, 60],
      notes:
        "Father had heart bypass surgery at age 60. Well controlled on medications.",
    },
    {
      id: 2,
      relationship: "Mother",
      name: "Jane Doe",
      age: 65,
      livingStatus: "Alive",
      conditions: ["Osteoarthritis", "Hypothyroidism"],
      ageOfOnset: [55, 58],
      notes:
        "Mother has joint pain but manages well with physical therapy and medications.",
    },
    {
      id: 3,
      relationship: "Brother",
      name: "Michael Doe",
      age: 42,
      livingStatus: "Alive",
      conditions: ["Hypertension"],
      ageOfOnset: [38],
      notes:
        "Brother diagnosed with hypertension during routine check-up. No complications.",
    },
    {
      id: 4,
      relationship: "Sister",
      name: "Sarah Doe",
      age: 35,
      livingStatus: "Alive",
      conditions: ["Migraine Headaches"],
      ageOfOnset: [25],
      notes:
        "Sister experiences occasional migraines, well controlled with preventive medications.",
    },
    {
      id: 5,
      relationship: "Paternal Grandfather",
      name: "Robert Doe",
      age: 72,
      livingStatus: "Deceased",
      conditions: ["Myocardial Infarction", "Stroke"],
      ageOfOnset: [65, 70],
      notes:
        "Grandfather passed away from complications of heart disease and stroke.",
    },
    {
      id: 6,
      relationship: "Maternal Grandmother",
      name: "Mary Smith",
      age: 78,
      livingStatus: "Alive",
      conditions: ["Breast Cancer", "Osteoporosis"],
      ageOfOnset: [68, 72],
      notes:
        "Grandmother survived breast cancer and manages osteoporosis with medications and exercise.",
    },
  ];

  const getLivingStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case "alive":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400";
      case "deceased":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200";
    }
  };

  const getRelationshipColor = (relationship) => {
    switch (relationship.toLowerCase()) {
      case "father":
      case "mother":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400";
      case "brother":
      case "sister":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400";
      case "paternal grandfather":
      case "paternal grandmother":
      case "maternal grandfather":
      case "maternal grandmother":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200";
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-6">
        Family History
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {familyHistory.map((member) => (
          <div
            key={member.id}
            className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6 shadow-sm"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                  {member.name}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRelationshipColor(
                      member.relationship
                    )}`}
                  >
                    {member.relationship}
                  </span>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getLivingStatusColor(
                      member.livingStatus
                    )}`}
                  >
                    {member.livingStatus}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900 dark:text-white dark:text-white">
                  Age: {member.age}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                  Medical Conditions:
                </h4>
                {member.conditions.length > 0 ? (
                  <div className="space-y-2">
                    {member.conditions.map((condition, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-700 dark:text-gray-300">
                          {condition}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          Onset: {member.ageOfOnset[index]} years
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No known conditions
                  </p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                  Notes:
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {member.notes}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {familyHistory.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No family history
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Family medical history will appear here as it is documented in the
            patient's record.
          </p>
        </div>
      )}
    </div>
  );
};

// Nurse Notes Tab Component
const NurseNotesTab = ({ patient }) => {
  // Sample nurse notes data
  const nurseNotes = [
    {
      id: 1,
      date: "2024-01-20",
      time: "09:30 AM",
      nurse: "Nurse Johnson",
      shift: "Morning",
      category: "Vital Signs",
      notes:
        "BP 142/88, HR 72, RR 16, Temp 98.6°F, O2 Sat 98% RA. Patient reports mild headache, no chest pain. Medication administered as ordered.",
      followUp: "Monitor BP q2h, assess pain level",
    },
    {
      id: 2,
      date: "2024-01-20",
      time: "14:15 PM",
      nurse: "Nurse Smith",
      shift: "Afternoon",
      category: "Assessment",
      notes:
        "Patient resting comfortably. Incision site clean and dry, no signs of infection. Pain level 3/10. Ambulated 50 feet with minimal assistance. Voided 300cc clear yellow urine.",
      followUp: "Continue pain management, encourage ambulation",
    },
    {
      id: 3,
      date: "2024-01-19",
      time: "22:00 PM",
      nurse: "Nurse Davis",
      shift: "Night",
      category: "Medication",
      notes:
        "Administered scheduled medications: Lisinopril 10mg PO, Atorvastatin 20mg PO. Patient tolerated well, no adverse reactions noted. BP pre-med 148/92, post-med 138/84.",
      followUp: "Monitor for medication effectiveness",
    },
    {
      id: 4,
      date: "2024-01-19",
      time: "06:45 AM",
      nurse: "Nurse Wilson",
      shift: "Morning",
      category: "Education",
      notes:
        "Patient educated on medication regimen and importance of adherence. Demonstrated proper technique for BP monitoring at home. Provided written instructions and medication schedule.",
      followUp: "Reinforce teaching as needed",
    },
    {
      id: 5,
      date: "2024-01-18",
      time: "16:30 PM",
      nurse: "Nurse Brown",
      shift: "Afternoon",
      category: "Discharge Planning",
      notes:
        "Discussed discharge plan with patient and family. Arranged for home health nursing visits. Confirmed follow-up appointment with primary care provider. Provided medication reconciliation.",
      followUp: "Ensure all discharge instructions understood",
    },
  ];

  const getCategoryColor = (category) => {
    switch (category.toLowerCase()) {
      case "vital signs":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400";
      case "assessment":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400";
      case "medication":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400";
      case "education":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400";
      case "discharge planning":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200";
    }
  };

  const getShiftColor = (shift) => {
    switch (shift.toLowerCase()) {
      case "morning":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400";
      case "afternoon":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400";
      case "night":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200";
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-6">
        Nurse Notes
      </h2>
      <div className="space-y-4">
        {nurseNotes.length > 0 ? (
          nurseNotes.map((note) => (
            <div
              key={note.id}
              className="bg-white dark:bg-gray-950 p-4 rounded-lg shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white dark:text-white">
                    {note.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {note.date} • {note.nurse}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getCategoryColor(
                    note.category
                  )}`}
                >
                  {note.category}
                </span>
              </div>
              <p className="mt-2 text-gray-700 dark:text-gray-300">
                {note.notes}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-gray-50 dark:bg-black rounded-lg">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white">
              No nurse notes found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              There are no nurse notes for this patient.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const AdmissionHistoryTab = ({ patient }) => {
  // Sample admission history data
  const admissionHistory = [
    {
      id: 1,
      admissionDate: "2024-01-15",
      dischargeDate: "2024-01-17",
      duration: "2 days",
      admissionType: "Emergency",
      admittingDoctor: "Dr. Emergency Team",
      primaryDiagnosis: "Acute Chest Pain",
      department: "Cardiology",
      roomNumber: "ICU-205",
      dischargeDisposition: "Home",
      complications: "None",
      followUp: "Cardiology clinic in 1 week",
      notes:
        "Patient presented with acute chest pain. ECG showed no acute changes. Troponins negative. Discharged with cardiology follow-up.",
    },
    {
      id: 2,
      admissionDate: "2023-11-10",
      dischargeDate: "2023-11-12",
      duration: "2 days",
      admissionType: "Emergency",
      admittingDoctor: "Dr. Emergency Team",
      primaryDiagnosis: "Acute Bronchitis",
      department: "Internal Medicine",
      roomNumber: "MED-312",
      dischargeDisposition: "Home",
      complications: "None",
      followUp: "Primary care in 1 week",
      notes:
        "Admitted for respiratory distress. Treated with bronchodilators and antibiotics. Improved significantly.",
    },
    {
      id: 3,
      admissionDate: "2023-06-20",
      dischargeDate: "2023-06-25",
      duration: "5 days",
      admissionType: "Elective",
      admittingDoctor: "Dr. Orthopedic Team",
      primaryDiagnosis: "Right Knee Arthroplasty",
      department: "Orthopedics",
      roomNumber: "ORTH-108",
      dischargeDisposition: "Rehabilitation Facility",
      complications: "Post-operative pain well controlled",
      followUp: "Orthopedic clinic in 2 weeks",
      notes:
        "Elective total knee replacement. Surgery uncomplicated. Physical therapy initiated. Discharged to rehab for continued recovery.",
    },
  ];

  const getAdmissionTypeColor = (type) => {
    switch (type.toLowerCase()) {
      case "emergency":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400";
      case "urgent":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400";
      case "elective":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200";
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-6">
        Admission History
      </h2>

      <div className="space-y-6">
        {admissionHistory.map((admission) => (
          <div
            key={admission.id}
            className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm"
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white dark:text-white">
                    {admission.primaryDiagnosis}
                  </h3>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>Admitted: {admission.admissionDate}</span>
                    <span>Discharged: {admission.dischargeDate}</span>
                    <span>Duration: {admission.duration}</span>
                  </div>
                </div>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getAdmissionTypeColor(
                    admission.admissionType
                  )}`}
                >
                  {admission.admissionType}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                    Admitting Doctor:
                  </span>
                  <p className="text-gray-700 dark:text-gray-300">
                    {admission.admittingDoctor}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                    Department:
                  </span>
                  <p className="text-gray-700 dark:text-gray-300">
                    {admission.department}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                    Room:
                  </span>
                  <p className="text-gray-700 dark:text-gray-300">
                    {admission.roomNumber}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                    Disposition:
                  </span>
                  <p className="text-gray-700 dark:text-gray-300">
                    {admission.dischargeDisposition}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                  Clinical Summary:
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {admission.notes}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                    Complications:
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {admission.complications}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                    Follow-up Care:
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {admission.followUp}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {admissionHistory.length === 0 && (
        <div className="text-center py-12">
          <Building className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No admission history
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Hospital admission records will appear here as they are added to the
            patient's medical record.
          </p>
        </div>
      )}
    </div>
  );
};

// Treatment Plan Tab Component
const TreatmentPlanTab = ({ patient }) => {
  const [treatmentHistory, setTreatmentHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch treatment history from prescriptions collection
  useEffect(() => {
    const fetchTreatmentHistory = async () => {
      if (!patient?._id) return;

      setLoading(true);
      try {
        const response = await prescriptionsAPI.getByPatient(patient._id);
        console.log(
          "Treatment History - Prescriptions API Response:",
          response
        );

        // Handle different response formats
        let prescriptionsData = [];
        if (response.data?.prescriptions) {
          prescriptionsData = response.data.prescriptions;
        } else if (response.data?.data) {
          prescriptionsData = response.data.data;
        } else if (Array.isArray(response.data)) {
          prescriptionsData = response.data;
        } else if (response.prescriptions) {
          prescriptionsData = response.prescriptions;
        }

        // Transform prescription data to treatment history format
        const treatments = prescriptionsData.map((prescription) => ({
          id: prescription._id,
          treatmentId:
            prescription.prescriptionNumber ||
            `RX-${prescription._id.slice(-6)}`,
          date: prescription.date
            ? format(new Date(prescription.date), "MMM dd, yyyy")
            : "N/A",
          status: prescription.status || "Active",
          diagnosis: prescription.diagnosis || "No diagnosis provided",
          prescribedMedications: prescription.medications || [],
          doctor:
            prescription.doctorId?.fullName ||
            prescription.doctorId?.name ||
            "Healthcare Provider",
          notes: prescription.notes,
          followUpDate: prescription.followUpDate,
          followUpInstructions: prescription.followUpInstructions,
          createdAt: prescription.createdAt || prescription.date,
        }));

        // Sort by date (most recent first)
        treatments.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.date);
          const dateB = new Date(b.createdAt || b.date);
          return dateB - dateA;
        });

        setTreatmentHistory(treatments);
        console.log("Transformed treatment history:", treatments);
      } catch (error) {
        console.error("Error fetching treatment history:", error);
        setTreatmentHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTreatmentHistory();
  }, [patient]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-2">
          Treatment History
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Medications, prescriptions, and treatment plans
        </p>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading treatment history...
          </p>
        </div>
      ) : treatmentHistory.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12">
          <ClipboardList className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No treatment history
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Treatment records will appear here as they are added to the
            patient's medical record.
          </p>
        </div>
      ) : (
        /* Treatment Records */
        <div className="space-y-4">
          {treatmentHistory.map((treatment) => (
            <div
              key={treatment.id}
              className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Treatment Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Pill className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white">
                      {treatment.treatmentId}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {treatment.date}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    treatment.status === "Active"
                      ? "bg-blue-600 text-white"
                      : treatment.status === "Completed"
                      ? "bg-green-600 text-white"
                      : "bg-gray-600 text-white"
                  }`}
                >
                  {treatment.status}
                </span>
              </div>

              {/* Diagnosis Section */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-blue-600 mb-2">
                  Diagnosis
                </h4>
                <p className="text-gray-900 dark:text-white dark:text-white">
                  {treatment.diagnosis}
                </p>
              </div>

              {/* Prescribed Medications Section */}
              {treatment.prescribedMedications.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center mb-3">
                    <Pill className="h-4 w-4 text-gray-600 dark:text-gray-400 mr-2" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white dark:text-white">
                      Prescribed Medications (
                      {treatment.prescribedMedications.length})
                    </h4>
                  </div>

                  <div className="space-y-3">
                    {treatment.prescribedMedications.map(
                      (medication, index) => (
                        <div
                          key={index}
                          className="border-l-4 border-green-400 bg-green-50 p-4 rounded-r-lg"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-semibold text-gray-900 dark:text-white dark:text-white">
                              {medication.name}
                            </h5>
                            <span className="text-green-600 font-medium">
                              {medication.dosage}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                            <div>
                              <span className="font-medium">Frequency:</span>{" "}
                              {medication.frequency}
                            </div>
                            <div>
                              <span className="font-medium">Duration:</span>{" "}
                              {medication.duration}
                            </div>
                          </div>

                          {medication.instructions && (
                            <div className="text-sm">
                              <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                                Instructions:
                              </span>
                              <span className="text-gray-700 dark:text-gray-300 italic">
                                {" "}
                                {medication.instructions}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Notes Section */}
              {treatment.notes && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-yellow-800 mb-1">
                    Additional Notes
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {treatment.notes}
                  </p>
                </div>
              )}

              {/* Follow-up Information */}
              {(treatment.followUpDate || treatment.followUpInstructions) && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-purple-800 mb-2">
                    Follow-up
                  </h4>
                  {treatment.followUpDate && (
                    <div className="flex items-center text-sm text-gray-700 dark:text-gray-300 mb-1">
                      <Calendar className="h-4 w-4 mr-2 text-purple-600" />
                      <span>
                        Date:{" "}
                        {format(
                          new Date(treatment.followUpDate),
                          "MMM dd, yyyy"
                        )}
                      </span>
                    </div>
                  )}
                  {treatment.followUpInstructions && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                      {treatment.followUpInstructions}
                    </p>
                  )}
                </div>
              )}

              {/* Doctor Information */}
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-800">
                <User className="h-4 w-4 mr-1" />
                <span>Prescribed by: {treatment.doctor}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Diagnosis History Tab Component - Shows diagnosis details and prescriptions
// ============================================================================
const DiagnosisHistoryTab = ({
  patient,
  prescriptions = [],
  loading = false,
}) => {
  const [diagnosisHistory, setDiagnosisHistory] = useState([]);
  const [activeSection, setActiveSection] = useState("diagnosis");
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);

  // Fetch diagnosis history from prescriptions database
  useEffect(() => {
    const fetchDiagnosisHistory = async () => {
      if (!patient) return;

      setLoadingDiagnosis(true);
      try {
        // Fetch prescriptions which contain diagnosis information
        const patientDbId = patient._id;
        const prescriptionsRes = await prescriptionsAPI.getByPatient(
          patientDbId
        );

        console.log("Prescriptions API Response:", prescriptionsRes);

        const allDiagnoses = [];

        // Handle different response formats
        let prescriptionsData = [];
        if (prescriptionsRes.data?.prescriptions) {
          prescriptionsData = prescriptionsRes.data.prescriptions;
        } else if (prescriptionsRes.data?.data) {
          prescriptionsData = prescriptionsRes.data.data;
        } else if (Array.isArray(prescriptionsRes.data)) {
          prescriptionsData = prescriptionsRes.data;
        } else if (prescriptionsRes.prescriptions) {
          prescriptionsData = prescriptionsRes.prescriptions;
        }

        console.log("Extracted prescriptions data:", prescriptionsData);

        // Extract diagnosis from prescriptions data
        if (prescriptionsData && prescriptionsData.length > 0) {
          console.log("Found prescriptions data:", prescriptionsData);

          // Group prescriptions by consultation/date to extract unique diagnoses
          const consultationMap = new Map();

          prescriptionsData.forEach((prescription) => {
            // Extract diagnosis field from prescription
            const diagnosisText =
              prescription.diagnosis ||
              prescription.diagnosisText ||
              prescription.chiefComplaint;

            if (diagnosisText) {
              const consultationId =
                prescription.consultationId || prescription._id;

              if (!consultationMap.has(consultationId)) {
                consultationMap.set(consultationId, {
                  id: `prescription-diagnosis-${consultationId}`,
                  date:
                    prescription.prescribedOn || prescription.createdAt
                      ? format(
                          new Date(
                            prescription.prescribedOn || prescription.createdAt
                          ),
                          "MMM dd, yyyy"
                        )
                      : "N/A",
                  diagnosis: diagnosisText,
                  doctor:
                    prescription.prescribedBy ||
                    prescription.doctorName ||
                    "Healthcare Provider",
                  notes:
                    prescription.consultationNotes ||
                    prescription.notes ||
                    `Prescribed: ${
                      prescription.medication ||
                      prescription.medicineName ||
                      "Medication"
                    } ${prescription.dosage || ""}`,
                  createdAt:
                    prescription.prescribedOn || prescription.createdAt,
                  medications: [
                    prescription.medication || prescription.medicineName,
                  ],
                });
              } else {
                // Add medication to existing diagnosis entry
                const existing = consultationMap.get(consultationId);
                const medName =
                  prescription.medication || prescription.medicineName;
                if (medName && !existing.medications.includes(medName)) {
                  existing.medications.push(medName);
                  if (!existing.notes.includes(medName)) {
                    existing.notes += `, ${medName} ${
                      prescription.dosage || ""
                    }`;
                  }
                }
              }
            }
          });

          // Convert map to array
          consultationMap.forEach((diagnosis) => {
            allDiagnoses.push(diagnosis);
          });

          console.log("Extracted diagnoses from prescriptions:", allDiagnoses);
        } else {
          console.log("No prescription data found for patient:", patientDbId);
        }

        // Also try to get direct diagnosis data from consultations as backup
        try {
          const diagnosesRes = await consultationsAPI.getDiagnosesByPatient(
            patientDbId
          );
          if (diagnosesRes.data.success && diagnosesRes.data.data) {
            diagnosesRes.data.data.forEach((diagnosis) => {
              // Avoid duplicates by checking if we already have this consultation
              if (
                !allDiagnoses.find((d) => d.id === `diagnosis-${diagnosis._id}`)
              ) {
                allDiagnoses.push({
                  id: `diagnosis-${diagnosis._id}`,
                  date: diagnosis.createdAt
                    ? format(new Date(diagnosis.createdAt), "MMM dd, yyyy")
                    : "N/A",
                  diagnosis: diagnosis.diagnosis,
                  doctor: diagnosis.doctorId?.name || "Healthcare Provider",
                  notes: diagnosis.notes || "No notes available",
                  createdAt: diagnosis.createdAt,
                });
              }
            });
          }
        } catch (diagnosisError) {
          console.log(
            "Diagnosis API not available, using prescription data only"
          );
        }

        // Sort by date (most recent first)
        allDiagnoses.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.date || "1970-01-01");
          const dateB = new Date(b.createdAt || b.date || "1970-01-01");
          return dateB - dateA;
        });

        setDiagnosisHistory(allDiagnoses);
      } catch (error) {
        console.error(
          "Error fetching diagnosis history from prescriptions:",
          error
        );
        // Set empty array if API fails
        setDiagnosisHistory([]);
      } finally {
        setLoadingDiagnosis(false);
      }
    };

    if (patient?._id) {
      fetchDiagnosisHistory();
    }
  }, [patient]);

  const getSeverityColor = (severity) => {
    switch (severity.toLowerCase()) {
      case "mild":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400";
      case "moderate":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400";
      case "severe":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400";
      case "resolved":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400";
      case "chronic":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200";
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-2">
          Diagnosis History
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Diagnoses from prescriptions and medical records
        </p>
      </div>

      {/* Loading State */}
      {loadingDiagnosis ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-4">
            Loading diagnosis history...
          </p>
        </div>
      ) : diagnosisHistory.length === 0 ? (
        <div className="text-center py-12">
          <Stethoscope className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No diagnosis history
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Diagnosis records will appear here as they are added to the
            patient's medical record.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {diagnosisHistory.map((d) => (
            <div
              key={d.id}
              className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6 shadow-sm"
            >
              <div className="flex items-center space-x-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                  Diagnosis
                </h3>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-4">
                <p className="text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200">
                  {d.diagnosis}
                </p>
              </div>

              <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>{d.doctor}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>{d.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Case Log Tab Component - Displays unified timeline from all sources
// ============================================================================
const CaseLogTab = ({ patient, caseLogs = [], loading = false, patientId }) => {
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Map icon types to actual icon components
  const getIconComponent = (iconType) => {
    switch (iconType) {
      case "Pill":
        return Pill;
      case "Activity":
        return Activity;
      case "Stethoscope":
        return Stethoscope;
      case "Video":
        return Video;
      case "Calendar":
        return Calendar;
      case "FileText":
        return FileText;
      case "Syringe":
        return Syringe;
      default:
        return FileText;
    }
  };

  // Get status class based on status
  const getStatusClass = (status) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "completed" || statusLower === "active") {
      return "bg-green-100 text-green-700";
    } else if (statusLower === "cancelled") {
      return "bg-red-100 text-red-700";
    } else if (statusLower === "in progress") {
      return "bg-yellow-100 text-yellow-700";
    } else {
      return "bg-blue-100 text-blue-700";
    }
  };

  // Render icon dynamically based on iconType
  const renderIcon = (iconType) => {
    const IconComponent = getIconComponent(iconType);
    return <IconComponent className="h-5 w-5" />;
  };

  return (
    <div className="p-6">
      {/* Header Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white mb-2">
          Case Logs
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Unified patient activity timeline from all sources
        </p>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-5 shadow-sm animate-pulse"
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-xl"></div>
                <div className="flex-1 min-w-0">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Debug Info */}
      {!loading && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            <strong>Debug:</strong> Found {caseLogs.length} case log entries
          </p>
          {caseLogs.length > 0 && (
            <p className="text-xs text-yellow-600 mt-1">
              Types: {[...new Set(caseLogs.map((log) => log.type))].join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Case Logs Content */}
      {!loading && (
        <div className="space-y-4">
          {caseLogs.map((entry) => (
            <div key={entry.id}>
              <div
                onClick={() =>
                  setSelectedEntry(
                    selectedEntry?.id === entry.id ? null : entry
                  )
                }
                className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-blue-400 transition-colors p-5 shadow-sm cursor-pointer"
              >
                <div className="flex items-start space-x-4">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-12 h-12 ${entry.iconBgColor} rounded-xl flex items-center justify-center ${entry.iconColor}`}
                  >
                    {renderIcon(entry.iconType)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white dark:text-white">
                            {entry.title}
                          </h3>
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(
                              entry.status
                            )}`}
                          >
                            {entry.status}
                          </span>
                        </div>

                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          {entry.description}
                        </p>

                        {/* Timestamp and performer information */}
                        <div className="space-y-1">
                          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {new Date(entry.timestamp).toLocaleDateString()}{" "}
                                at{" "}
                                {new Date(entry.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            {entry.performedBy && (
                              <div className="flex items-center space-x-1">
                                <User className="h-3 w-3" />
                                <span>by {entry.performedBy}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Type badge */}
                      <div className="flex-shrink-0 ml-4">
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 text-gray-700 dark:text-gray-300 capitalize">
                          {entry.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedEntry?.id === entry.id && entry.details && (
                <div className="mt-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 p-5">
                  <h4 className="text-md font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-blue-600" />
                    Detailed Information
                  </h4>

                  <div className="bg-white dark:bg-gray-950 rounded-lg p-4 space-y-3">
                    {/* Render details based on entry type */}
                    {entry.type === "prescription" && (
                      <div className="border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-r">
                        <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                          {entry.details.medication}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {entry.details.dosage &&
                            `Dosage: ${entry.details.dosage}`}
                          {entry.details.frequency &&
                            ` | Frequency: ${entry.details.frequency}`}
                        </p>
                        {entry.details.duration && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Duration: {entry.details.duration}
                          </p>
                        )}
                        {entry.details.instructions && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Instructions: {entry.details.instructions}
                          </p>
                        )}
                        {entry.details.count && (
                          <p className="text-xs text-blue-600 mt-2 font-medium">
                            {entry.details.count}
                          </p>
                        )}
                      </div>
                    )}

                    {entry.type === "consultation" && (
                      <div className="space-y-2">
                        {entry.details.mode && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Mode:
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white dark:text-white">
                              {entry.details.mode}
                            </span>
                          </div>
                        )}
                        {entry.details.duration && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Duration:
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white dark:text-white">
                              {entry.details.duration} minutes
                            </span>
                          </div>
                        )}
                        {entry.details.symptoms && (
                          <div>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Symptoms:
                            </span>
                            <p className="text-sm text-gray-900 dark:text-white dark:text-white mt-1">
                              {entry.details.symptoms}
                            </p>
                          </div>
                        )}
                        {entry.details.providerNotes && (
                          <div>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Provider Notes:
                            </span>
                            <p className="text-sm text-gray-900 dark:text-white dark:text-white mt-1">
                              {entry.details.providerNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {entry.type === "appointment" && (
                      <div className="space-y-2">
                        {entry.details.time && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Time:
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white dark:text-white">
                              {entry.details.time}
                            </span>
                          </div>
                        )}
                        {entry.details.type && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Type:
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white dark:text-white">
                              {entry.details.type}
                            </span>
                          </div>
                        )}
                        {entry.details.notes && (
                          <div>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Notes:
                            </span>
                            <p className="text-sm text-gray-900 dark:text-white dark:text-white mt-1">
                              {entry.details.notes}
                            </p>
                          </div>
                        )}
                        {entry.details.diagnosis && (
                          <div>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Diagnosis:
                            </span>
                            <p className="text-sm text-gray-900 dark:text-white dark:text-white mt-1">
                              {entry.details.diagnosis}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {entry.type === "visit" && (
                      <div className="space-y-2">
                        {entry.details.clinicType && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Clinic Type:
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white dark:text-white">
                              {entry.details.clinicType}
                            </span>
                          </div>
                        )}
                        {entry.details.clinicName && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Clinic:
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white dark:text-white">
                              {entry.details.clinicName}
                            </span>
                          </div>
                        )}
                        {entry.details.checkOut && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Check-out:
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white dark:text-white">
                              {format(
                                new Date(entry.details.checkOut),
                                "MMM dd, yyyy 'at' hh:mm a"
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && caseLogs.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No case log entries
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Patient activity from all sources will appear here.
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// NEW TAB COMPONENTS
// ============================================================================

// Case Logs Tab - Timestamped patient activity timeline
const CaseLogsTab = ({ patient, caseLogs, loading }) => {
  const getActivityIcon = (type) => {
    switch (type) {
      case "vitals":
        return {
          icon: Heart,
          color: "text-pink-600",
          bg: "bg-pink-100 dark:bg-pink-900/30",
        };
      case "prescription":
        return {
          icon: Pill,
          color: "text-blue-600",
          bg: "bg-blue-100 dark:bg-blue-900/30",
        };
      case "teleconsultation":
        return {
          icon: Video,
          color: "text-orange-600",
          bg: "bg-orange-100 dark:bg-orange-900/30",
        };
      case "appointment":
        return {
          icon: Calendar,
          color: "text-purple-600",
          bg: "bg-purple-100 dark:bg-purple-900/30",
        };
      case "consultation":
        return {
          icon: Stethoscope,
          color: "text-green-600",
          bg: "bg-green-100 dark:bg-green-900/30",
        };
      default:
        return {
          icon: FileText,
          color: "text-gray-600 dark:text-gray-400",
          bg: "bg-gray-100 dark:bg-gray-900",
        };
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: {
        label: "Completed",
        class:
          "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 dark:bg-green-900/30 dark:text-green-400",
      },
      scheduled: {
        label: "Scheduled",
        class:
          "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 dark:bg-blue-900/30 dark:text-blue-400",
      },
      cancelled: {
        label: "Cancelled",
        class: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 dark:bg-red-900/30 dark:text-red-400",
      },
      pending: {
        label: "Pending",
        class:
          "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 dark:bg-yellow-900/30 dark:text-yellow-400",
      },
    };

    const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.class}`}
      >
        {config.label}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Case Logs
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Timestamped patient activity timeline
        </p>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : caseLogs && caseLogs.length > 0 ? (
        <div className="space-y-4">
          {caseLogs.map((log, index) => {
            const { icon: Icon, color, bg } = getActivityIcon(log.type);
            const logDate = new Date(log.timestamp);

            return (
              <div
                key={index}
                className="bg-white dark:bg-gray-950 border dark:border-gray-800 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}
                  >
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Date and Time */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {logDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span>•</span>
                      <span>
                        {logDate.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white dark:text-white mb-1">
                      {log.title}
                    </h3>

                    {/* Description */}
                    {log.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {log.description}
                      </p>
                    )}

                    {/* Performed By */}
                    {log.performedBy && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <User className="h-3 w-3" />
                        <span>by {log.performedBy}</span>
                      </div>
                    )}

                    {/* Additional Details */}
                    {log.details && (
                      <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        {log.details.notes && (
                          <p className="italic">"{log.details.notes}"</p>
                        )}
                        {log.details.duration && (
                          <p className="mt-1">
                            Duration: {log.details.duration}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  {log.status && (
                    <div className="flex-shrink-0">
                      {getStatusBadge(log.status)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-black rounded-lg">
          <FileText className="h-16 w-16 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No activity recorded yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Patient activity from all sources will appear here
          </p>
        </div>
      )}
    </div>
  );
};

// Assessments Tab - General and Condition-Specific Assessments
const AssessmentsTab = ({ patient }) => {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [assessmentType, setAssessmentType] = useState("general");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
            Assessments
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            General and condition-specific patient assessments
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <FileText className="h-4 w-4" />
          New Assessment
        </button>
      </div>

      {/* Assessment Type Tabs */}
      <div className="flex gap-4 border-b dark:border-gray-800">
        <button
          onClick={() => setAssessmentType("general")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            assessmentType === "general"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white dark:text-white dark:hover:text-gray-200"
          }`}
        >
          General Assessment
        </button>
        <button
          onClick={() => setAssessmentType("condition")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            assessmentType === "condition"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white dark:text-white dark:hover:text-gray-200"
          }`}
        >
          Condition-Specific
        </button>
      </div>

      {/* Assessment List */}
      <div className="grid gap-4">
        <div className="text-center py-12 bg-gray-50 dark:bg-black rounded-lg">
          <ClipboardList className="h-16 w-16 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No assessments yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Start by creating a new assessment for this patient
          </p>
          <button className="btn-primary">Create First Assessment</button>
        </div>
      </div>
    </div>
  );
};

// Test Reports Tab - Investigation Results
const TestReportsTab = ({ patient }) => {
  const [vitals, setVitals] = useState([]);
  const [labReports, setLabReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVital, setSelectedVital] = useState(null);
  const [showVitalModal, setShowVitalModal] = useState(false);
  const [expandedVitalIndex, setExpandedVitalIndex] = useState(null);
  const [expandedLabIndex, setExpandedLabIndex] = useState(null);
  const [selectedLabReport, setSelectedLabReport] = useState(null);
  const [showLabReportModal, setShowLabReportModal] = useState(false);

  useEffect(() => {
    if (patient) {
      loadInvestigationsData();
    }
  }, [patient]);

  const loadInvestigationsData = async () => {
    if (!patient) return;

    setLoading(true);
    try {
      const patientDbId = patient._id;

      // Fetch vitals and lab reports in parallel
      const [vitalsRes, labReportsRes] = await Promise.allSettled([
        vitalsAPI.getByPatient(patientDbId),
        labReportsAPI.getByPatient(patientDbId),
      ]);

      console.log("Vitals Response:", vitalsRes);
      console.log("Lab Reports Response:", labReportsRes);

      if (vitalsRes.status === "fulfilled" && vitalsRes.value.data.success) {
        setVitals(vitalsRes.value.data.data || []);
        console.log("Vitals loaded:", vitalsRes.value.data.data);
      }

      if (
        labReportsRes.status === "fulfilled" &&
        labReportsRes.value.data.success
      ) {
        setLabReports(labReportsRes.value.data.data || []);
        console.log("Lab Reports loaded:", labReportsRes.value.data.data);
      }
    } catch (error) {
      console.error("Error loading investigations data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Investigations & Vitals
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Vital signs, lab results, and medical investigations
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Vital Signs History */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-5 w-5 text-pink-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                Vital Signs History
              </h3>
            </div>

            {vitals && vitals.length > 0 ? (
              <div className="space-y-3">
                {vitals.map((vital, index) => (
                  <div
                    key={vital._id || index}
                    className="bg-white dark:bg-gray-950 border dark:border-gray-800 rounded-lg overflow-hidden"
                  >
                    {/* Accordion Header */}
                    <button
                      onClick={() =>
                        setExpandedVitalIndex(
                          expandedVitalIndex === index ? null : index
                        )
                      }
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-750 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Heart className="h-5 w-5 text-pink-600" />
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-900 dark:text-white dark:text-white">
                            Vitals Record #{vitals.length - index}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(
                              vital.visitDate || vital.createdAt
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform ${
                          expandedVitalIndex === index
                            ? "transform rotate-180"
                            : ""
                        }`}
                      />
                    </button>

                    {/* Accordion Content */}
                    {expandedVitalIndex === index && vital.vitalSigns && (
                      <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-800">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {vital.vitalSigns.bloodPressure?.systolic && (
                            <div className="bg-pink-50 dark:bg-pink-900/10 rounded-lg p-3">
                              <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                                Blood Pressure
                              </span>
                              <span className="font-bold text-gray-900 dark:text-white dark:text-white text-lg">
                                {vital.vitalSigns.bloodPressure.systolic}/
                                {vital.vitalSigns.bloodPressure.diastolic}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                mmHg
                              </span>
                            </div>
                          )}
                          {vital.vitalSigns.heartRate?.value && (
                            <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-3">
                              <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                                Heart Rate
                              </span>
                              <span className="font-bold text-gray-900 dark:text-white dark:text-white text-lg">
                                {vital.vitalSigns.heartRate.value}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                {vital.vitalSigns.heartRate.unit}
                              </span>
                            </div>
                          )}
                          {vital.vitalSigns.temperature?.value && (
                            <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-3">
                              <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                                Temperature
                              </span>
                              <span className="font-bold text-gray-900 dark:text-white dark:text-white text-lg">
                                {vital.vitalSigns.temperature.value}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                {vital.vitalSigns.temperature.unit}
                              </span>
                            </div>
                          )}
                          {vital.vitalSigns.oxygenSaturation?.value && (
                            <div className="bg-blue-50 dark:bg-blue-900/10 dark:bg-blue-900/10 rounded-lg p-3">
                              <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                                Oxygen Saturation
                              </span>
                              <span className="font-bold text-gray-900 dark:text-white dark:text-white text-lg">
                                {vital.vitalSigns.oxygenSaturation.value}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                %
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedVital(vital);
                            setShowVitalModal(true);
                          }}
                          className="mt-3 text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View Full Details
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 dark:bg-black rounded-lg">
                <Heart className="h-12 w-12 text-gray-300 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-gray-600 dark:text-gray-400">
                  No vital signs recorded
                </p>
              </div>
            )}
          </div>

          {/* Lab Reports & Tests */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                Lab Reports & Tests
              </h3>
            </div>

            {labReports && labReports.length > 0 ? (
              <div className="space-y-3">
                {labReports.map((report, index) => (
                  <div
                    key={report._id || index}
                    className="bg-white dark:bg-gray-950 border dark:border-gray-800 rounded-lg overflow-hidden"
                  >
                    {/* Accordion Header */}
                    <button
                      onClick={() =>
                        setExpandedLabIndex(
                          expandedLabIndex === index ? null : index
                        )
                      }
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-750 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-900 dark:text-white dark:text-white">
                            {report.testName || "Lab Test"}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(
                              report.testDate || report.createdAt
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform ${
                          expandedLabIndex === index
                            ? "transform rotate-180"
                            : ""
                        }`}
                      />
                    </button>

                    {/* Accordion Content */}
                    {expandedLabIndex === index && (
                      <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-800 space-y-3">
                        {/* Test Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {report.category && (
                            <div className="bg-blue-50 dark:bg-blue-900/10 dark:bg-blue-900/10 rounded-lg p-3">
                              <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                                Category
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                                {report.category}
                              </span>
                            </div>
                          )}
                          {report.uploadedDate && (
                            <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3">
                              <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                                Uploaded
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                                {new Date(
                                  report.uploadedDate
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Notes */}
                        {report.notes && (
                          <div className="bg-gray-50 dark:bg-black rounded-lg p-3">
                            <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                              Notes
                            </span>
                            <p className="text-sm text-gray-900 dark:text-white dark:text-white">
                              {report.notes}
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={() => {
                              setSelectedLabReport(report);
                              setShowLabReportModal(true);
                            }}
                            className="flex-1 text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center justify-center gap-1 py-2 border border-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                            View Report
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const response = await labReportsAPI.download(
                                  report._id
                                );
                                const url = window.URL.createObjectURL(
                                  new Blob([response.data])
                                );
                                const link = document.createElement("a");
                                link.href = url;
                                link.setAttribute(
                                  "download",
                                  `${report.testName || "lab-report"}.pdf`
                                );
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                              } catch (error) {
                                console.error(
                                  "Error downloading report:",
                                  error
                                );
                                alert("Failed to download report");
                              }
                            }}
                            className="flex-1 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 dark:text-gray-400 dark:hover:text-gray-300 text-sm font-medium flex items-center justify-center gap-1 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-900 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 dark:bg-black rounded-lg">
                <FileText className="h-12 w-12 text-gray-300 dark:text-gray-500 mx-auto mb-2" />
                <p className="text-gray-600 dark:text-gray-400">
                  No lab reports available
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vitals Detail Modal */}
      {showVitalModal && selectedVital && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-950 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-950 border-b dark:border-gray-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                    Vitals Record #
                    {vitals.findIndex((v) => v._id === selectedVital._id) + 1}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(
                      selectedVital.visitDate || selectedVital.createdAt
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVitalModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Vital Signs Section */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-white dark:text-white mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-pink-600" />
                  Vital Signs
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Blood Pressure */}
                  {selectedVital.vitalSigns?.bloodPressure?.systolic && (
                    <div className="border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10 p-4 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Heart className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Blood Pressure
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
                        {selectedVital.vitalSigns.bloodPressure.systolic}/
                        {selectedVital.vitalSigns.bloodPressure.diastolic}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        mmHg
                      </p>
                    </div>
                  )}

                  {/* Heart Rate */}
                  {selectedVital.vitalSigns?.heartRate?.value && (
                    <div className="border-l-4 border-pink-500 bg-pink-50 dark:bg-pink-900/10 p-4 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Heart className="h-4 w-4 text-pink-600" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Heart Rate
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
                        {selectedVital.vitalSigns.heartRate.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedVital.vitalSigns.heartRate.unit}
                      </p>
                    </div>
                  )}

                  {/* Temperature */}
                  {selectedVital.vitalSigns?.temperature?.value && (
                    <div className="border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/10 p-4 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Temperature
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
                        {selectedVital.vitalSigns.temperature.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedVital.vitalSigns.temperature.unit}
                      </p>
                    </div>
                  )}

                  {/* Weight */}
                  {selectedVital.vitalSigns?.weight?.value && (
                    <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/10 dark:bg-blue-900/10 p-4 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Weight
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
                        {selectedVital.vitalSigns.weight.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedVital.vitalSigns.weight.unit}
                      </p>
                    </div>
                  )}

                  {/* Height */}
                  {selectedVital.vitalSigns?.height?.value && (
                    <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-900/10 p-4 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Height
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
                        {selectedVital.vitalSigns.height.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedVital.vitalSigns.height.unit}
                      </p>
                    </div>
                  )}

                  {/* Respiratory Rate */}
                  {selectedVital.vitalSigns?.respiratoryRate?.value && (
                    <div className="border-l-4 border-teal-500 bg-teal-50 dark:bg-teal-900/10 p-4 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="h-4 w-4 text-teal-600" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Respiratory Rate
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
                        {selectedVital.vitalSigns.respiratoryRate.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        breaths/min
                      </p>
                    </div>
                  )}

                  {/* Oxygen Saturation */}
                  {selectedVital.vitalSigns?.oxygenSaturation?.value && (
                    <div className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/10 p-4 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Heart className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Oxygen Saturation
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
                        {selectedVital.vitalSigns.oxygenSaturation.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        %
                      </p>
                    </div>
                  )}

                  {/* BMI */}
                  {selectedVital.vitalSigns?.bmi?.value && (
                    <div className="border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          BMI
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
                        {selectedVital.vitalSigns.bmi.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedVital.vitalSigns.bmi.category || "kg/m²"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Clinical Notes Section */}
              {selectedVital.clinicalNotes && (
                <div className="space-y-4">
                  <h5 className="font-semibold text-gray-900 dark:text-white dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Clinical Information
                  </h5>

                  {/* Chief Complaint */}
                  {selectedVital.clinicalNotes.chiefComplaint?.complaint && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border-l-4 border-yellow-400">
                      <h6 className="font-medium text-yellow-900 dark:text-yellow-300 mb-2">
                        Chief Complaint
                      </h6>
                      <p className="text-yellow-800 dark:text-yellow-200">
                        {selectedVital.clinicalNotes.chiefComplaint.complaint}
                      </p>
                      {selectedVital.clinicalNotes.chiefComplaint.duration && (
                        <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                          Duration:{" "}
                          {selectedVital.clinicalNotes.chiefComplaint.duration}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Allergies */}
                  {(selectedVital.clinicalNotes.allergies?.drug?.length > 0 ||
                    selectedVital.clinicalNotes.allergies?.food?.length > 0 ||
                    selectedVital.clinicalNotes.allergies?.environment?.length >
                      0) && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-400">
                      <h6 className="font-medium text-red-900 dark:text-red-300 mb-2">
                        Allergies
                      </h6>
                      <div className="space-y-2">
                        {selectedVital.clinicalNotes.allergies.drug?.length >
                          0 && (
                          <div>
                            <span className="text-red-800 dark:text-red-300 font-medium text-sm">
                              Drug:{" "}
                            </span>
                            <span className="text-red-700 dark:text-red-200">
                              {selectedVital.clinicalNotes.allergies.drug.join(
                                ", "
                              )}
                            </span>
                          </div>
                        )}
                        {selectedVital.clinicalNotes.allergies.food?.length >
                          0 && (
                          <div>
                            <span className="text-red-800 dark:text-red-300 font-medium text-sm">
                              Food:{" "}
                            </span>
                            <span className="text-red-700 dark:text-red-200">
                              {selectedVital.clinicalNotes.allergies.food.join(
                                ", "
                              )}
                            </span>
                          </div>
                        )}
                        {selectedVital.clinicalNotes.allergies.environment
                          ?.length > 0 && (
                          <div>
                            <span className="text-red-800 dark:text-red-300 font-medium text-sm">
                              Environmental:{" "}
                            </span>
                            <span className="text-red-700 dark:text-red-200">
                              {selectedVital.clinicalNotes.allergies.environment.join(
                                ", "
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Current Medications */}
                  {selectedVital.clinicalNotes.currentMedications?.length >
                    0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-400">
                      <h6 className="font-medium text-blue-900 dark:text-blue-300 dark:text-blue-300 mb-2">
                        Current Medications
                      </h6>
                      <div className="space-y-2">
                        {selectedVital.clinicalNotes.currentMedications.map(
                          (med, index) => (
                            <div
                              key={index}
                              className="text-blue-800 dark:text-blue-200"
                            >
                              <span className="font-medium">{med.name}</span>
                              {med.dosage && (
                                <span className="text-blue-700 dark:text-blue-300">
                                  {" "}
                                  - {med.dosage}
                                </span>
                              )}
                              {med.frequency && (
                                <span className="text-blue-600 dark:text-blue-400">
                                  {" "}
                                  ({med.frequency})
                                </span>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Medical History */}
                  {selectedVital.clinicalNotes.pastMedicalHistory
                    ?.chronicIllnesses?.length > 0 && (
                    <div className="bg-gray-50 dark:bg-black p-4 rounded-lg border-l-4 border-gray-400">
                      <h6 className="font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                        Chronic Illnesses
                      </h6>
                      <p className="text-gray-700 dark:text-gray-300">
                        {selectedVital.clinicalNotes.pastMedicalHistory.chronicIllnesses.join(
                          ", "
                        )}
                      </p>
                    </div>
                  )}

                  {/* Family History */}
                  {selectedVital.clinicalNotes.familyMedicalHistory && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-l-4 border-green-400">
                      <h6 className="font-medium text-green-900 dark:text-green-300 mb-2">
                        Family Medical History
                      </h6>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {selectedVital.clinicalNotes.familyMedicalHistory
                          .diabetes && (
                          <span className="text-green-700 dark:text-green-300">
                            ✓ Diabetes
                          </span>
                        )}
                        {selectedVital.clinicalNotes.familyMedicalHistory
                          .hypertension && (
                          <span className="text-green-700 dark:text-green-300">
                            ✓ Hypertension
                          </span>
                        )}
                        {selectedVital.clinicalNotes.familyMedicalHistory
                          .heartDisease && (
                          <span className="text-green-700 dark:text-green-300">
                            ✓ Heart Disease
                          </span>
                        )}
                        {selectedVital.clinicalNotes.familyMedicalHistory
                          .cancer && (
                          <span className="text-green-700 dark:text-green-300">
                            ✓ Cancer
                          </span>
                        )}
                      </div>
                      {selectedVital.clinicalNotes.familyMedicalHistory.other
                        ?.length > 0 && (
                        <p className="text-green-700 dark:text-green-300 mt-2">
                          Other:{" "}
                          {selectedVital.clinicalNotes.familyMedicalHistory.other.join(
                            ", "
                          )}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Nurse Observations */}
                  {(selectedVital.clinicalNotes.nurseObservations
                    ?.generalAppearance ||
                    selectedVital.clinicalNotes.nurseObservations
                      ?.specialRemarks ||
                    selectedVital.clinicalNotes.nurseObservations
                      ?.additionalNotes) && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border-l-4 border-purple-400">
                      <h6 className="font-medium text-purple-900 dark:text-purple-300 mb-2">
                        Nurse Observations
                      </h6>
                      <div className="space-y-2">
                        {selectedVital.clinicalNotes.nurseObservations
                          .generalAppearance && (
                          <div>
                            <span className="text-purple-800 dark:text-purple-300 font-medium text-sm">
                              General Appearance:{" "}
                            </span>
                            <span className="text-purple-700 dark:text-purple-200">
                              {
                                selectedVital.clinicalNotes.nurseObservations
                                  .generalAppearance
                              }
                            </span>
                          </div>
                        )}
                        {selectedVital.clinicalNotes.nurseObservations
                          .specialRemarks && (
                          <div>
                            <span className="text-purple-800 dark:text-purple-300 font-medium text-sm">
                              Special Remarks:{" "}
                            </span>
                            <span className="text-purple-700 dark:text-purple-200">
                              {
                                selectedVital.clinicalNotes.nurseObservations
                                  .specialRemarks
                              }
                            </span>
                          </div>
                        )}
                        {selectedVital.clinicalNotes.nurseObservations
                          .additionalNotes && (
                          <div>
                            <span className="text-purple-800 dark:text-purple-300 font-medium text-sm">
                              Additional Notes:{" "}
                            </span>
                            <span className="text-purple-700 dark:text-purple-200">
                              {
                                selectedVital.clinicalNotes.nurseObservations
                                  .additionalNotes
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Record Information */}
              <div className="border-t dark:border-gray-800 pt-4">
                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
                  Record Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Status:</p>
                    <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                      Draft
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Type:</p>
                    <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                      Post Consultation
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">UHID:</p>
                    <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                      {selectedVital.uhid || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">
                      Visit Date:
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                      {new Date(
                        selectedVital.visitDate || selectedVital.createdAt
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  {selectedVital.recordedByName && (
                    <div className="col-span-2">
                      <p className="text-gray-600 dark:text-gray-400">
                        Healthcare Staff:
                      </p>
                      <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                        {selectedVital.recordedByName}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 dark:bg-black px-6 py-4 flex justify-end gap-3 border-t dark:border-gray-700">
              <button
                onClick={() => setShowVitalModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-950 dark:bg-gray-800 border dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-50 dark:bg-black0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lab Report Detail Modal */}
      {showLabReportModal && selectedLabReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-950 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-950 border-b dark:border-gray-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                    {selectedLabReport.testName || "Lab Test"}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Test Date:{" "}
                    {new Date(
                      selectedLabReport.testDate || selectedLabReport.createdAt
                    ).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLabReportModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Report Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-black rounded-lg p-4">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Test Date
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                    {new Date(
                      selectedLabReport.testDate || selectedLabReport.createdAt
                    ).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Lab Name
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                    {selectedLabReport.labName || "City Diagnostics"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Uploaded
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                    {selectedLabReport.uploadedAt
                      ? new Date(
                          selectedLabReport.uploadedAt
                        ).toLocaleDateString("en-GB")
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Patient
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                    {patient?.fullName || "N/A"}
                  </p>
                </div>
              </div>

              {/* Notes Section */}
              {selectedLabReport.notes && (
                <div className="bg-blue-50 dark:bg-blue-900/10 dark:bg-blue-900/10 rounded-lg p-4 border-l-4 border-blue-500">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 dark:text-blue-300 mb-2">
                    Notes:
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300">
                    {selectedLabReport.notes}
                  </p>
                </div>
              )}

              {/* Report Preview/Content */}
              <div className="bg-white dark:bg-gray-950 dark:bg-gray-750 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8">
                {selectedLabReport.filePath ? (
                  <div className="space-y-4">
                    <div className="text-center mb-4">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                        {selectedLabReport.testName || "Lab Test Report"}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        File: {selectedLabReport.fileName}
                      </p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 max-h-[500px] overflow-auto">
                      <img
                        src={selectedLabReport.filePath}
                        alt="Lab Report"
                        className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextElementSibling.style.display = "block";
                        }}
                      />
                      <div
                        style={{ display: "none" }}
                        className="text-center py-8"
                      >
                        <FileText className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">
                          Report preview not available
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                          Click download to view the full report
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
                      Lab Report Document
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {selectedLabReport.testName || "Lab Test Report"}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No preview available. Click download to view the report.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 dark:bg-black px-6 py-4 flex justify-end gap-3 border-t dark:border-gray-700">
              <button
                onClick={async () => {
                  try {
                    const response = await labReportsAPI.download(
                      selectedLabReport._id
                    );
                    const url = window.URL.createObjectURL(
                      new Blob([response.data])
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.setAttribute(
                      "download",
                      `${selectedLabReport.testName || "lab-report"}.pdf`
                    );
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  } catch (error) {
                    console.error("Error downloading report:", error);
                    alert("Failed to download report");
                  }
                }}
                className="px-4 py-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={() => setShowLabReportModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-950 dark:bg-gray-800 border dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-50 dark:bg-black0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Prescriptions Tab - Treatment Prescriptions
const PrescriptionsTab = ({ patient, prescriptions, loading }) => {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const toggleAccordion = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
            Prescriptions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Treatment prescriptions and medications
          </p>
        </div>
      </div>

      {/* Prescriptions Accordion List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : prescriptions && prescriptions.length > 0 ? (
        <div className="space-y-3">
          {prescriptions.map((prescription, index) => (
            <div
              key={prescription._id || index}
              className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden"
            >
              {/* Accordion Header */}
              <button
                onClick={() => toggleAccordion(index)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Pill className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white">
                      Treatment #
                      {prescription.treatmentId ||
                        `RX${String(index + 1).padStart(7, "0")}`}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(prescription.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-semibold rounded-full">
                    {prescription.status || "Completed"}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform ${
                      expandedIndex === index ? "transform rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Accordion Content */}
              {expandedIndex === index && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-200 dark:border-gray-800 space-y-4">
                  {/* Diagnosis */}
                  {prescription.diagnosis && (
                    <div className="bg-gray-50 dark:bg-black rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Diagnosis
                      </h4>
                      <p className="text-gray-900 dark:text-white dark:text-white">
                        {prescription.diagnosis}
                      </p>
                    </div>
                  )}

                  {/* Medications */}
                  {prescription.medications &&
                    prescription.medications.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                          <Pill className="h-4 w-4" />
                          Prescribed Medications (
                          {prescription.medications.length})
                        </h4>
                        <div className="space-y-3">
                          {prescription.medications.map((med, medIndex) => (
                            <div
                              key={medIndex}
                              className="bg-green-50 dark:bg-green-900/10 rounded-lg p-4 border-l-4 border-green-500"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h5 className="font-bold text-gray-900 dark:text-white dark:text-white">
                                  {med.name || med.medicineName}
                                </h5>
                                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm font-bold rounded">
                                  {med.dosage || "1000mg"}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {med.frequency || "Once a day"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {med.duration || "7 days"}
                                </span>
                              </div>
                              {med.instructions && (
                                <p className="text-sm text-gray-700 dark:text-gray-300 italic mt-2">
                                  <span className="font-medium not-italic">
                                    Instructions:
                                  </span>{" "}
                                  {med.instructions}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Footer */}
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-800">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Dr.{" "}
                      {prescription.doctor?.fullName ||
                        prescription.doctorName ||
                        "Abdul Rahim"}
                    </span>
                    {prescription.followUpDate && (
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Follow-up:{" "}
                        {new Date(prescription.followUpDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-black dark:bg-gray-950 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <Pill className="h-16 w-16 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No prescriptions yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create treatment prescriptions for this patient
          </p>
          <button className="btn-primary">Create First Prescription</button>
        </div>
      )}
    </div>
  );
};

// Treatment History Tab - Past Treatments and Interventions
const TreatmentHistoryTab = ({ patient }) => {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
            Treatment History
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Past treatments, interventions, and therapy sessions
          </p>
        </div>
      </div>

      {/* Treatment Timeline */}
      <div className="grid gap-4">
        <div className="text-center py-12 bg-gray-50 dark:bg-black rounded-lg">
          <History className="h-16 w-16 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No treatment history
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Treatment records will appear here once sessions are completed
          </p>
        </div>
      </div>
    </div>
  );
};

// Invoices Tab - Billing Records
const InvoicesTab = ({ patient, billingRecords }) => {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 dark:bg-green-900/30 dark:text-green-400";
      case "pending":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "overdue":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 dark:bg-red-900/30 dark:text-red-400";
      case "cancelled":
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 dark:text-gray-200 dark:text-gray-200 dark:bg-black/30 dark:text-gray-400";
      default:
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
            Invoices
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Billing records and payment history
          </p>
        </div>
      </div>

      {/* Invoices Accordion List */}
      <div className="space-y-3">
        {billingRecords && billingRecords.length > 0 ? (
          billingRecords.map((record, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-950 border dark:border-gray-800 rounded-lg overflow-hidden"
            >
              {/* Accordion Header */}
              <button
                onClick={() =>
                  setExpandedIndex(expandedIndex === index ? null : index)
                }
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white">
                      Invoice #
                      {record.invoiceNo ||
                        `INV-${String(index + 1).padStart(4, "0")}`}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {record.date ||
                        new Date(record.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                      • ₹{record.total?.toLocaleString() || "0"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      record.status
                    )}`}
                  >
                    {record.status || "Rejected"}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform ${
                      expandedIndex === index ? "transform rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Accordion Content */}
              {expandedIndex === index && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-200 dark:border-gray-800 space-y-4">
                  {/* Invoice Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/10 dark:bg-blue-900/10 rounded-lg p-3">
                      <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                        Invoice Date
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                        {record.date ||
                          new Date(record.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3">
                      <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                        Total Amount
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white dark:text-white text-lg">
                        ₹{record.total?.toLocaleString() || "0"}
                      </span>
                    </div>
                    {record.discount > 0 && (
                      <div className="bg-purple-50 dark:bg-purple-900/10 rounded-lg p-3">
                        <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                          Discount
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                          ₹{record.discount?.toLocaleString() || "0"}
                        </span>
                      </div>
                    )}
                    {record.tax > 0 && (
                      <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-3">
                        <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                          Tax
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white dark:text-white">
                          ₹{record.tax?.toLocaleString() || "0"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Line Items */}
                  {record.lineItems && record.lineItems.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Services & Items
                      </h4>
                      <div className="bg-gray-50 dark:bg-black rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 dark:bg-gray-900 dark:bg-gray-800">
                            <tr>
                              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">
                                Description
                              </th>
                              <th className="px-4 py-2 text-center text-gray-700 dark:text-gray-300">
                                Qty
                              </th>
                              <th className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                                Unit Price
                              </th>
                              <th className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                            {record.lineItems.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 text-gray-900 dark:text-white dark:text-white">
                                  {item.description}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">
                                  {item.qty}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                  ₹{item.unitPrice?.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white dark:text-white">
                                  ₹
                                  {(item.qty * item.unitPrice).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Patient & Contact Information */}
                  <div className="bg-blue-50 dark:bg-blue-900/10 dark:bg-blue-900/10 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 dark:text-blue-300 mb-2">
                      Patient Information
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Patient:
                        </span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white dark:text-white">
                          {record.patientName || patient?.fullName || "N/A"}
                        </span>
                      </div>
                      {record.phone && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Phone:
                          </span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white dark:text-white">
                            {record.phone}
                          </span>
                        </div>
                      )}
                      {record.email && (
                        <div className="col-span-2">
                          <span className="text-gray-600 dark:text-gray-400">
                            Email:
                          </span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white dark:text-white">
                            {record.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  {record.address && (
                    <div className="bg-gray-50 dark:bg-black rounded-lg p-3">
                      <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                        Billing Address
                      </span>
                      <p className="text-sm text-gray-900 dark:text-white dark:text-white">
                        {record.address.line1}
                        {record.address.line2 && `, ${record.address.line2}`}
                        <br />
                        {record.address.city}, {record.address.state} -{" "}
                        {record.address.zipCode}
                      </p>
                    </div>
                  )}

                  {/* Remarks */}
                  {record.remarks && (
                    <div className="bg-gray-50 dark:bg-black rounded-lg p-3">
                      <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                        Remarks
                      </span>
                      <p className="text-sm text-gray-900 dark:text-white dark:text-white">
                        {record.remarks}
                      </p>
                    </div>
                  )}

                  {/* Approval/Rejection Info */}
                  {(record.approvedBy || record.rejectedBy) && (
                    <div
                      className={`rounded-lg p-3 ${
                        record.status === "Approved"
                          ? "bg-green-50 dark:bg-green-900/10"
                          : "bg-red-50 dark:bg-red-900/10"
                      }`}
                    >
                      <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                        {record.status === "Approved"
                          ? "Approved On"
                          : "Rejected On"}
                      </span>
                      <p className="text-sm text-gray-900 dark:text-white dark:text-white">
                        {(record.approvedAt || record.rejectedAt) && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            {" "}
                            {new Date(
                              record.approvedAt || record.rejectedAt
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                      {record.rejectionReason && (
                        <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                          Reason: {record.rejectionReason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button className="flex-1 text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center justify-center gap-1 py-2 border border-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors">
                      <Eye className="h-4 w-4" />
                      View Invoice
                    </button>
                    <button className="flex-1 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 dark:text-gray-400 dark:hover:text-gray-300 text-sm font-medium flex items-center justify-center gap-1 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-900 transition-colors">
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-gray-50 dark:bg-black rounded-lg">
            <CreditCard className="h-16 w-16 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
              No invoices yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create invoices for patient services
            </p>
            <button className="btn-primary">Create First Invoice</button>
          </div>
        )}
      </div>
    </div>
  );
};

// Patient Uploads Tab - Documents Uploaded by Patient
const PatientUploadsTab = ({ patient }) => {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Fetch medical images when component mounts
  useEffect(() => {
    if (patient?._id) {
      loadMedicalImages();
    }
  }, [patient]);

  const loadMedicalImages = async () => {
    setLoading(true);
    try {
      const response = await medicalImagesAPI.getByPatient(patient._id);
      if (response.data.success) {
        setUploads(response.data.data || []);
      }
    } catch (error) {
      console.error("Error loading medical images:", error);
      setUploads([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewImage = (image) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };

  const handleDownloadImage = async (image) => {
    try {
      window.open(image.imageUrl, "_blank");
    } catch (error) {
      console.error("Error downloading image:", error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
            Patient Uploads
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Medical images and documents uploaded by the patient
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : uploads.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12 bg-gray-50 dark:bg-black rounded-lg">
          <Camera className="h-16 w-16 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">
            No uploads yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Patient-uploaded medical images will appear here
          </p>
        </div>
      ) : (
        /* Uploads Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {uploads.map((image) => (
            <div
              key={image._id}
              className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Image Preview */}
              <div className="relative h-48 bg-gray-100 dark:bg-gray-900">
                <img
                  src={image.imageUrl}
                  alt={image.title || "Medical Image"}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => handleViewImage(image)}
                  onError={(e) => {
                    e.target.src = "https://via.placeholder.com/400x300?text=Image+Not+Available";
                  }}
                />
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                    {image.category || "General"}
                  </span>
                </div>
              </div>

              {/* Image Details */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white dark:text-white mb-2 truncate">
                  {image.title || "Untitled Image"}
                </h3>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <p>
                    <span className="font-medium">Uploaded:</span>{" "}
                    {new Date(image.uploadedAt).toLocaleDateString()}
                  </p>
                  {image.description && (
                    <p className="line-clamp-2">{image.description}</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewImage(image)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                  <button
                    onClick={() => handleDownloadImage(image)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-950 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
                {selectedImage.title || "Medical Image"}
              </h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4">
              {/* Image */}
              <div className="mb-4">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.title}
                  className="w-full h-auto rounded-lg"
                  onError={(e) => {
                    e.target.src = "https://via.placeholder.com/800x600?text=Image+Not+Available";
                  }}
                />
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Category
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                    {selectedImage.category || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Uploaded
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                    {new Date(selectedImage.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                {selectedImage.uploadedBy && (
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Uploaded By
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white dark:text-white">
                      {selectedImage.uploadedBy.fullName || "N/A"}
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedImage.description && (
                <div className="mb-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Description
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white dark:text-white">
                    {selectedImage.description}
                  </p>
                </div>
              )}

              {/* Notes */}
              {selectedImage.notes && (
                <div className="bg-blue-50 dark:bg-blue-900/10 dark:bg-blue-900/10 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white dark:text-white">
                    {selectedImage.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => handleDownloadImage(selectedImage)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={() => setShowImageModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientView;
