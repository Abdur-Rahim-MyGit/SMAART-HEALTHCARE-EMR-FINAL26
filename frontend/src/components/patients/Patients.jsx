import React, { useState, useEffect } from "react";
import {
  Search,
  Eye,
  Edit,
  Building2,
  Filter,
  Trash2,
  Phone,
  Mail,
  MapPin,
  UserPlus,
  User,
  ChevronDown,
  ChevronUp,
  X,
  Users,
  Activity,
  MapPin as Location,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { patientsAPI, clinicsAPI } from "../../services/api";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import PatientModal from "./PatientModal";
import PatientViewModal from "./PatientViewModal";

const Patients = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClinic, setSelectedClinic] = useState("");
  // removed Add Patient modal: patients are fetched from backend
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Individual search filters
  const [filters, setFilters] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "",
    city: "",
    status: "all", // all, active, inactive
    clinic: "",
  });

  // Advanced filters visibility
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: false,
    aadhaarNumber: "",
    attenderEmail: "",
    attenderMobile: "",
    attenderWhatsapp: "",
    city: "",
    nationality: "",
    pinCode: "",
    modeOfCare: "",
    bloodType: "",
    emergencyContact: {
      name: "",
      relationship: "",
      phone: "",
    },
    insuranceInfo: {
      provider: "",
      policyNumber: "",
      groupNumber: "",
    },
  });

  useEffect(() => {
    fetchPatients();
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    try {
      const response = await clinicsAPI.getAll();
      if (response.data.success) {
        console.log(
          "Fetched clinics:",
          response.data.clinics.length,
          response.data.clinics.slice(0, 2)
        ); // Debug: log clinics
        setClinics(response.data.clinics);
      }
    } catch (error) {
      toast.error("Failed to fetch clinics");
      console.error("Error fetching clinics:", error);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await patientsAPI.getAll();
      if (response.data.success) {
        console.log("Fetched patients:", response.data.patients.slice(0, 2)); // Debug: log first 2 patients
        setPatients(response.data.patients);
      }
    } catch (error) {
      toast.error("Failed to fetch patients");
      console.error("Error fetching patients:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter((patient) => {
    try {
      // General search term (searches across all fields)
      const matchesSearchTerm =
        !searchTerm ||
        patient.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.phone?.includes(searchTerm) ||
        patient.patientId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.address?.city
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        patient.address?.state
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        patient.emergencyContact?.name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      // Individual field filters
      const matchesName =
        !filters.name ||
        patient.fullName?.toLowerCase().includes(filters.name.toLowerCase());

      const matchesPhone =
        !filters.phone || patient.phone?.includes(filters.phone);

      const matchesEmail =
        !filters.email ||
        patient.email?.toLowerCase().includes(filters.email.toLowerCase());

      const matchesGender =
        !filters.gender ||
        filters.gender === "" ||
        patient.gender?.toLowerCase() === filters.gender.toLowerCase();

      const matchesCity =
        !filters.city ||
        patient.address?.city
          ?.toLowerCase()
          .includes(filters.city.toLowerCase());

      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active" &&
          (patient.status === "Active" || patient.isActive)) ||
        (filters.status === "inactive" &&
          (patient.status === "Inactive" || !patient.isActive));

      // Improved clinic filtering with better error handling
      let matchesClinic = true;
      if (filters.clinic && filters.clinic !== "") {
        // Handle both populated (object) and unpopulated (string) clinicId
        const patientClinicId = typeof patient.clinicId === 'object' 
          ? patient.clinicId?._id 
          : patient.clinicId;
        
        matchesClinic =
          patientClinicId === filters.clinic ||
          patientClinicId?.toString() === filters.clinic ||
          patient.clinic?._id === filters.clinic ||
          patient.clinic?._id?.toString() === filters.clinic;
      }

      return (
        matchesSearchTerm &&
        matchesName &&
        matchesPhone &&
        matchesEmail &&
        matchesGender &&
        matchesCity &&
        matchesStatus &&
        matchesClinic
      );
    } catch (error) {
      console.error("Error filtering patient:", patient, error);
      return true; // Include patient if there's an error to avoid blank screen
    }
  });

  // Pagination calculations
  const totalFilteredItems = filteredPatients.length;
  const totalPages = Math.ceil(totalFilteredItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPatients = filteredPatients.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleItemsPerPageChange = (items) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const getPaginationRange = () => {
    const range = [];
    const maxVisible = 5; // Show up to 5 page numbers

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + maxVisible - 1);

      if (start > 1) {
        range.push(1);
        if (start > 2) range.push("...");
      }

      for (let i = start; i <= end; i++) {
        range.push(i);
      }

      if (end < totalPages) {
        if (end < totalPages - 1) range.push("...");
        range.push(totalPages);
      }
    }

    return range;
  };

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

  const getClinicName = (patient) => {
    // Check if clinicId is populated (object with name)
    if (patient.clinicId && typeof patient.clinicId === 'object' && patient.clinicId.name) {
      return patient.clinicId.name;
    }
    // Fallback to other possible fields
    return (
      patient.clinicName ||
      patient.clinic?.name ||
      clinics.find((c) => c._id === patient.clinicId)?.name ||
      "—"
    );
  };

  const getDoctorName = (patient) => {
    // Check if assignedDoctors array is populated
    if (patient.assignedDoctors && Array.isArray(patient.assignedDoctors) && patient.assignedDoctors.length > 0) {
      const doctor = patient.assignedDoctors[0];
      if (typeof doctor === 'object') {
        // Doctor is populated
        const name = doctor.fullName || 
                     `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();
        return name || "—";
      }
    }
    
    // Fallback to other possible fields
    const fromObject =
      patient.doctorName ||
      patient.assignedDoctorName ||
      patient.primaryDoctorName ||
      (patient.primaryDoctor &&
        `${patient.primaryDoctor.firstName || ""} ${
          patient.primaryDoctor.lastName || ""
        }`.trim()) ||
      (patient.assignedDoctor &&
        `${patient.assignedDoctor.firstName || ""} ${
          patient.assignedDoctor.lastName || ""
        }`.trim());
    return fromObject && fromObject.trim() !== "" ? fromObject : "—";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Debug logging
  if (filters.clinic && filteredPatients.length === 0 && patients.length > 0) {
    console.log("Clinic filter causing empty results:");
    console.log("Selected clinic ID:", filters.clinic);
    console.log(
      "Available patients clinic IDs:",
      patients
        .map((p) => ({
          id: p._id,
          clinicId: p.clinicId,
          clinicName: p.clinicName,
          clinic: p.clinic,
        }))
        .slice(0, 3)
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Patients</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage patient records and information
          </p>
        </div>
        {/* Add Patient removed: patients come from backend */}
      </div>

      <div className="card dark:bg-gray-950 dark:border dark:border-gray-800">
        {/* Search and Filter Section */}
        <div className="mb-6 space-y-4">
          {/* General Search Bar */}
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Quick search across all patient fields..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Toggle Advanced Filters */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`ml-4 px-4 py-2 text-sm font-medium rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center gap-2 ${
                filters.name ||
                filters.phone ||
                filters.email ||
                filters.gender ||
                filters.city ||
                filters.status !== "all" ||
                filters.clinic
                  ? "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <Filter className="h-4 w-4" />
              Advanced Filters
              {(filters.name ||
                filters.phone ||
                filters.email ||
                filters.gender ||
                filters.city ||
                filters.status !== "all" ||
                filters.clinic) && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white dark:text-gray-100 bg-blue-600 rounded-full">
                  {
                    [
                      filters.name,
                      filters.phone,
                      filters.email,
                      filters.gender,
                      filters.city,
                      filters.status !== "all" ? "status" : "",
                      filters.clinic,
                    ].filter(Boolean).length
                  }
                </span>
              )}
              {showAdvancedFilters ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Individual Search Fields */}
          {showAdvancedFilters && (
            <div className="border-t dark:border dark:border-gray-800 pt-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Search by Individual Fields
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Patient Name Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Patient Name
                  </label>
                  <input
                    type="text"
                    placeholder="Search by name..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
                    value={filters.name}
                    onChange={(e) =>
                      setFilters({ ...filters, name: e.target.value })
                    }
                  />
                </div>

                {/* Phone Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="Search by phone..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
                    value={filters.phone}
                    onChange={(e) =>
                      setFilters({ ...filters, phone: e.target.value })
                    }
                  />
                </div>

                {/* Email Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email Address
                  </label>
                  <input
                    type="text"
                    placeholder="Search by email..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
                    value={filters.email}
                    onChange={(e) =>
                      setFilters({ ...filters, email: e.target.value })
                    }
                  />
                </div>

                {/* Gender Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Gender
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white"
                    value={filters.gender}
                    onChange={(e) =>
                      setFilters({ ...filters, gender: e.target.value })
                    }
                  >
                    <option value="">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* City Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Location className="h-3 w-3" />
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="Search by city..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
                    value={filters.city}
                    onChange={(e) =>
                      setFilters({ ...filters, city: e.target.value })
                    }
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Status
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white"
                    value={filters.status}
                    onChange={(e) =>
                      setFilters({ ...filters, status: e.target.value })
                    }
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Clinic Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Clinic ({clinics.length} available)
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:text-white"
                    value={filters.clinic}
                    onChange={(e) => {
                      console.log("Selected clinic:", e.target.value);
                      setFilters({ ...filters, clinic: e.target.value });
                    }}
                    disabled={clinics.length === 0}
                  >
                    <option value="">All Clinics</option>
                    {clinics && clinics.length > 0 ? (
                      clinics.map((clinic) => (
                        <option
                          key={clinic._id || clinic.id}
                          value={clinic._id || clinic.id}
                        >
                          {clinic.name || "Unnamed Clinic"}
                        </option>
                      ))
                    ) : (
                      <option disabled>Loading clinics...</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Clear Filters Button */}
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilters({
                      name: "",
                      phone: "",
                      email: "",
                      gender: "",
                      city: "",
                      status: "all",
                      clinic: "",
                    });
                  }}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Clear All Filters
                </button>

                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {filteredPatients.length} patients found{" "}
                  {filteredPatients.length !== patients.length &&
                    `(${patients.length} total)`}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-black">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Age/Gender
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Clinic
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-700">
              {currentPatients.map((patient) => (
                <tr
                  key={patient._id}
                  className="hover:bg-primary-50 dark:hover:bg-gray-900 cursor-pointer transition-colors"
                  onClick={() => handleViewPatient(patient)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                        {patient.profileImage ? (
                          <img
                            src={patient.profileImage}
                            alt={patient.fullName || "Patient"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextElementSibling.style.display =
                                "flex";
                            }}
                          />
                        ) : null}
                        <User
                          className="h-5 w-5 text-gray-600"
                          style={{
                            display: patient.profileImage ? "none" : "block",
                          }}
                        />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {patient.fullName || "Unknown"}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {patient.email || "No email"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {patient.age || getAgeFromDOB(patient.dateOfBirth)} years
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                      {patient.gender?.replace("_", " ")}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-gray-400 mr-1" />
                      {patient.phone}
                    </div>
                    {patient.emergencyContact?.name && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Emergency: {patient.emergencyContact.name}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                      {patient.address?.city || "Not provided"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        patient.status === "Active"
                          ? "bg-green-100 text-green-800"
                          : patient.status === "Inactive"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {patient.status || "Active"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    <div className="text-gray-800 dark:text-gray-200">
                      {getClinicName(patient)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Doctor: {getDoctorName(patient)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {currentPatients.length === 0 && filteredPatients.length === 0 && (
          <div className="text-center py-12">
            <UserPlus className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No patients found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm
                ? "Try adjusting your search term."
                : "No patients available."}
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {filteredPatients.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-black border-t dark:border-gray-700">
            {/* Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) =>
                  handleItemsPerPageChange(Number(e.target.value))
                }
                className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-700 dark:text-gray-300">per page</span>
            </div>

            {/* Pagination info */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Showing {startIndex + 1} to{" "}
                {Math.min(endIndex, totalFilteredItems)} of {totalFilteredItems}{" "}
                results
              </span>

              {/* Pagination buttons */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* First page */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="First page"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </button>

                  {/* Previous page */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {getPaginationRange().map((page, index) => (
                      <button
                        key={index}
                        onClick={() =>
                          typeof page === "number" && handlePageChange(page)
                        }
                        disabled={page === "..."}
                        className={`px-3 py-1 text-sm rounded ${
                          page === currentPage
                            ? "bg-blue-600 text-white"
                            : page === "..."
                            ? "cursor-default dark:text-gray-400"
                            : "hover:bg-gray-200 dark:hover:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  {/* Next page */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {/* Last page */}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Last page"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Patient modal removed: creation moved to registration flow or admin tools */}

      {/* Edit Patient Modal */}
      {showEditModal && selectedPatient && (
        <PatientModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPatient(null);
          }}
          onSave={handleUpdatePatient}
          title="Edit Patient"
          formData={formData}
          setFormData={setFormData}
          isEdit={true}
        />
      )}

      {/* View Patient Modal - Kept for potential future use, but navigation is used instead */}
      {/* {showViewModal && selectedPatient && (
        <PatientViewModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedPatient(null);
          }}
          patient={selectedPatient}
        />
      )} */}
    </div>
  );

  // CRUD Functions
  async function handleAddPatient(patientData) {
    try {
      const response = await patientsAPI.create(patientData);
      if (response.data.success) {
        toast.success("Patient added successfully");
        setPatients([response.data.patient, ...patients]);
        setShowAddModal(false);
        resetFormData();
      }
    } catch (error) {
      toast.error("Failed to add patient");
    }
  }

  async function handleUpdatePatient(patientData) {
    try {
      const response = await patientsAPI.update(
        selectedPatient._id,
        patientData
      );
      if (response.data.success) {
        toast.success("Patient updated successfully");
        fetchPatients();
        setShowEditModal(false);
        setSelectedPatient(null);
        resetFormData();
      }
    } catch (error) {
      toast.error("Failed to update patient");
    }
  }

  async function handleDeletePatient(patientId) {
    if (window.confirm("Are you sure you want to delete this patient?")) {
      try {
        const response = await patientsAPI.delete(patientId);
        if (response.data.success) {
          toast.success("Patient deleted successfully");
          fetchPatients();
        }
      } catch (error) {
        toast.error("Failed to delete patient");
      }
    }
  }

  function handleViewPatient(patient) {
    // Navigate to the detailed PatientView page
    navigate(`/patients/${patient._id}`);
  }

  function handleEditPatient(patient) {
    setSelectedPatient(patient);
    setFormData({
      fullName: patient.fullName || "",
      dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.split("T")[0] : "",
      gender: patient.gender || "",
      phone: patient.phone || "",
      email: patient.email || "",
      address: {
        street: patient.address?.street || "",
        city: patient.address?.city || "",
        state: patient.address?.state || "",
        zipCode: patient.address?.zipCode || "",
        country: patient.address?.country || "India",
      },
      emergencyContact: {
        name: patient.emergencyContact?.name || "",
        relationship: patient.emergencyContact?.relationship || "",
        phone: patient.emergencyContact?.phone || "",
      },
      medicalHistory: {
        conditions: patient.medicalHistory?.conditions || [],
        allergies: patient.medicalHistory?.allergies || [],
        medications: patient.medicalHistory?.medications || [],
      },
      notes: patient.notes || "",
    });
    setShowEditModal(true);
  }

  const resetFormData = () => {
    setFormData({
      fullName: "",
      dateOfBirth: "",
      gender: "",
      maritalStatus: false,
      aadhaarNumber: "",
      attenderEmail: "",
      attenderMobile: "",
      attenderWhatsapp: "",
      city: "",
      nationality: "",
      pinCode: "",
      modeOfCare: "",
      bloodType: "",
      emergencyContact: {
        name: "",
        relationship: "",
        phone: "",
      },
      insuranceInfo: {
        provider: "",
        policyNumber: "",
        groupNumber: "",
      },
    });
  };
};

export default Patients;
