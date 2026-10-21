import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { prescriptionsAPI, doctorsAPI } from "../../services/api";
import { toast } from "react-hot-toast";
import {
  Search,
  Pill,
  Users,
  FileText,
  Building2,
  User,
  Phone,
  Calendar,
  Filter,
  Eye,
  Edit,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle,
  UserCheck,
} from "lucide-react";

// Backend statuses are "Active" | "Completed" | "Cancelled".
const statusKey = (p) => String(p?.status || "").toLowerCase();

// patientId / doctorId are populated refs ({ fullName, ... }) or null.
const personName = (ref) =>
  ref?.fullName ||
  [ref?.firstName, ref?.lastName].filter(Boolean).join(" ") ||
  "—";

const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

const PrescriptionManagement = () => {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalPrescriptions: 0,
    activePrescriptions: 0,
    cancelledPrescriptions: 0,
    completedPrescriptions: 0,
  });

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDoctor, setFilterDoctor] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchData();
    fetchDoctors();
  }, []);

  // Prescriptions are clinic-scoped by the backend (tenantScope), so a clinic admin
  // only ever receives their own clinic's records.
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await prescriptionsAPI.getAll({ limit: 200 });
      const prescriptionData = res?.data?.prescriptions || res?.data?.data || [];

      setPrescriptions(prescriptionData);

      const byStatus = (s) =>
        prescriptionData.filter((p) => statusKey(p) === s).length;
      setStats({
        totalPrescriptions:
          res?.data?.pagination?.total ?? prescriptionData.length,
        activePrescriptions: byStatus("active"),
        cancelledPrescriptions: byStatus("cancelled"),
        completedPrescriptions: byStatus("completed"),
      });
    } catch (err) {
      console.error("Error fetching prescriptions:", err);
      setError("Failed to load prescriptions");
      toast.error("Failed to fetch prescriptions");
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await doctorsAPI.getAll();
      setDoctors(res?.data?.doctors || res?.data?.data || []);
    } catch (e) {
      console.error("Error fetching doctors:", e);
    }
  };

  // Filter prescriptions based on search and filters
  const filteredPrescriptions = (() => {
    let list = prescriptions || [];

    // Apply status filter
    if (filterStatus !== "all") {
      list = list.filter((p) => statusKey(p) === filterStatus);
    }

    // Apply doctor filter
    if (filterDoctor !== "all") {
      list = list.filter((p) => p.doctorId?._id === filterDoctor);
    }

    // Apply search filter
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      list = list.filter((prescription) => {
        const patientName = personName(prescription.patientId).toLowerCase();
        const doctorName = personName(prescription.doctorId).toLowerCase();
        const prescriptionNumber = (
          prescription.prescriptionNumber || ""
        ).toLowerCase();
        const diagnosis = prescription.diagnosis?.toLowerCase() || "";
        const medications = (prescription.medications || [])
          .map((m) => (m.name || "").toLowerCase())
          .join(" ");

        return (
          patientName.includes(searchLower) ||
          doctorName.includes(searchLower) ||
          prescriptionNumber.includes(searchLower) ||
          diagnosis.includes(searchLower) ||
          medications.includes(searchLower)
        );
      });
    }

    return list;
  })();

  // View prescription details
  const viewPrescriptionDetails = (prescription) => {
    setSelectedPrescription(prescription);
    setShowModal(true);
  };

  // Get status color
  const getStatusColor = (prescription) => {
    switch (statusKey(prescription)) {
      case "active":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-gray-100 dark:bg-gray-900 text-gray-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  // Get status text
  const getStatusText = (prescription) => prescription.status || "Unknown";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Prescription Details Modal Component
  const PrescriptionModal = ({ prescription, isOpen, onClose }) => {
    if (!isOpen || !prescription) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-950 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Prescription Details
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 dark:text-gray-400 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Prescription Info */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Prescription Information
                  </h3>
                  <div className="bg-gray-50 dark:bg-black p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Prescription #:</span>
                      <span>{prescription.prescriptionNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Issue Date:</span>
                      <span>{formatDate(prescription.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Follow-up:</span>
                      <span>{formatDate(prescription.followUpDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          prescription
                        )}`}
                      >
                        {getStatusText(prescription)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Patient Info */}
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Patient
                  </h4>
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary-100 h-10 w-10 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {personName(prescription.patientId)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Age: {prescription.patientId?.age ?? "—"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {prescription.patientId?.phone}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Doctor Info */}
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Prescribing Doctor
                  </h4>
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 h-10 w-10 rounded-full flex items-center justify-center">
                      <UserCheck className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {personName(prescription.doctorId)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {prescription.doctorId?.specialization}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Medications & Diagnosis */}
              <div className="space-y-4">
                {/* Diagnosis */}
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Diagnosis
                  </h4>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                    <p className="text-gray-800 dark:text-gray-200">
                      {prescription.diagnosis || "—"}
                    </p>
                  </div>
                </div>

                {/* Medications */}
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Medications
                  </h4>
                  <div className="space-y-3">
                    {(prescription.medications || []).map((med, index) => (
                      <div
                        key={index}
                        className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg"
                      >
                        <div className="flex items-center mb-2">
                          <Pill className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                          <span className="font-medium text-blue-900 dark:text-blue-300">
                            {med.name}
                          </span>
                        </div>
                        <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                          <p>
                            <strong>Dosage:</strong> {med.dosage}
                          </p>
                          <p>
                            <strong>Frequency:</strong> {med.frequency}
                          </p>
                          <p>
                            <strong>Duration:</strong> {med.duration}
                          </p>
                          {med.instructions && (
                            <p>
                              <strong>Instructions:</strong> {med.instructions}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {prescription.notes && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Notes
                    </h4>
                    <div className="bg-gray-50 dark:bg-black p-3 rounded-lg">
                      <p className="text-gray-700 dark:text-gray-300">
                        {prescription.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6 space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:bg-black dark:hover:bg-gray-900 dark:bg-gray-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Prescriptions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {user?.role === "clinic_admin"
              ? "Manage prescriptions for your clinic"
              : "Manage prescription records and medications"}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalPrescriptions}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.activePrescriptions}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center">
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Cancelled
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.cancelledPrescriptions}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Completed
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.completedPrescriptions}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card dark:bg-gray-950 dark:border-gray-800">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search Filter */}
          <div className="relative flex-1 max-w-lg">
            <Search
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                searchTerm ? "text-blue-500" : "text-gray-400"
              }`}
            />
            <input
              type="text"
              placeholder="Search by patient, doctor, prescription #, or medication..."
              className={`form-input pl-10 ${
                searchTerm ? "border-blue-300 ring-1 ring-blue-200" : ""
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 dark:text-gray-400"
              >
                ×
              </button>
            )}
          </div>

          {/* Doctor Filter */}
          <div className="min-w-[200px]">
            <select
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
              className="form-input"
            >
              <option value="all">All Doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {personName(doctor)}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="min-w-[150px]">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="form-input"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Filter Status */}
          {(searchTerm || filterDoctor !== "all" || filterStatus !== "all") && (
            <div className="flex items-center text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
              <Filter className="h-4 w-4 mr-2" />
              {filteredPrescriptions.length} of {prescriptions.length}{" "}
              prescriptions
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterDoctor("all");
                  setFilterStatus("all");
                }}
                className="ml-2 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 font-medium"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-black">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Prescription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Doctor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Medications
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dates
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPrescriptions.map((prescription) => (
                <tr
                  key={prescription._id}
                  className="hover:bg-primary-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  onClick={() => viewPrescriptionDetails(prescription)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="bg-blue-100 h-10 w-10 rounded-full flex items-center justify-center mr-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {prescription.prescriptionNumber}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {prescription.diagnosis}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {personName(prescription.patientId)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Age: {prescription.patientId?.age ?? "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {personName(prescription.doctorId)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {prescription.doctorId?.specialization}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {(prescription.medications || [])
                        .slice(0, 2)
                        .map((med, index) => (
                          <div key={index} className="flex items-center mb-1">
                            <Pill className="h-3 w-3 text-gray-400 mr-1" />
                            <span>
                              {med.name} ({med.dosage})
                            </span>
                          </div>
                        ))}
                      {(prescription.medications || []).length > 2 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          +{prescription.medications.length - 2} more
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        prescription
                      )}`}
                    >
                      {getStatusText(prescription)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      <div>
                        <div>Issued: {formatDate(prescription.date)}</div>
                        {prescription.followUpDate && (
                          <div>
                            Follow-up: {formatDate(prescription.followUpDate)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPrescriptions.length === 0 && (
          <div className="text-center py-12">
            <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No prescriptions found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || filterDoctor !== "all" || filterStatus !== "all"
                ? "Try adjusting your search or filter criteria."
                : error || "No prescriptions available."}
            </p>
          </div>
        )}
      </div>

      {/* Prescription Details Modal */}
      {showModal && selectedPrescription && (
        <PrescriptionModal
          prescription={selectedPrescription}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default PrescriptionManagement;
