import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Stethoscope,
  GraduationCap,
  Building,
  Search,
  Filter,
  Eye,
  Edit,
  Users,
  UserCheck,
  UserX,
  Award,
} from "lucide-react";
import { doctorsAPI, clinicsAPI } from "../../services/api";

const Doctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch doctors data
  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const params = {
        limit: 100, // Get all doctors for client-side filtering
      };

      const response = await doctorsAPI.getAll(params);
      if (response.data.success) {
        // Debug log to see the structure of doctors data
        console.log("Doctors data structure:", response.data.data?.[0]);
        setDoctors(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching doctors:", error);
      toast.error("Failed to fetch doctors data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch clinics data
  const fetchClinics = async () => {
    try {
      const response = await clinicsAPI.getAll();
      if (response.data.success) {
        setClinics(response.data.clinics);
      }
    } catch (error) {
      console.error("Error fetching clinics:", error);
    }
  };

  useEffect(() => {
    fetchDoctors();
    fetchClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Filter doctors based on search and filters
  const filteredDoctors = (() => {
    let list = doctors || [];

    // Apply specialty filter
    if (selectedSpecialty) {
      list = list.filter((doctor) => doctor.specialty === selectedSpecialty);
    }

    // Apply status filter
    if (selectedStatus) {
      list = list.filter((doctor) =>
        selectedStatus === "active" ? doctor.isActive : !doctor.isActive
      );
    }

    // Apply search filter
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      list = list.filter((doctor) => {
        // Get various searchable fields
        const searchFields = [
          doctor.fullName || "",
          doctor.firstName || "",
          doctor.lastName || "",
          doctor.displayName || "",
          doctor.email || "",
          doctor.phone || "",
          doctor.specialty || "",
          doctor.qualification || "",
          doctor.uhid || "",
          doctor.clinicName || "",
          doctor.clinicId?.name || "",
        ];

        return searchFields.some((field) =>
          field.toLowerCase().includes(searchLower)
        );
      });
    }

    // Debug log for search results
    if (searchTerm) {
      console.log("Search term:", searchTerm);
      console.log("Total doctors:", doctors.length);
      console.log("Filtered results:", list.length);
      console.log("Sample doctor for debugging:", doctors[0]);
    }

    return list;
  })();

  // Get unique specialties for filter
  const specialties = [...new Set(doctors.map((doctor) => doctor.specialty))];

  // View doctor details
  const viewDoctorDetails = (doctor) => {
    setSelectedDoctor(doctor);
    setShowModal(true);
  };

  // Format address
  const formatAddress = (address) => {
    if (!address) return "N/A";
    return `${address.city}, ${address.state}`;
  };

  // Get clinic name (similar to patients list)
  const getClinicName = (doctor) => {
    return (
      doctor.clinicName ||
      doctor.clinicId?.name ||
      clinics.find((c) => c._id === doctor.clinicId)?.name ||
      "N/A"
    );
  };

  // Get clinic details
  const getClinicDetails = (doctor) => {
    const clinic =
      doctor.clinicId || clinics.find((c) => c._id === doctor.clinicId);
    return clinic || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Doctor Details Modal
  const DoctorModal = ({ doctor, isOpen, onClose }) => {
    if (!isOpen || !doctor) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-950 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Doctor Details
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 dark:text-gray-400"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profile Section */}
              <div className="md:col-span-1">
                <div className="text-center">
                  <img
                    src={doctor.profileImage || "/api/placeholder/150/150"}
                    alt={doctor.fullName}
                    className="h-32 w-32 rounded-full mx-auto object-cover border-4 border-gray-200 dark:border-gray-800"
                  />
                  <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
                    {doctor.displayName || `Dr. ${doctor.fullName}`}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">{doctor.specialty}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    UHID: {doctor.uhid}
                  </p>
                </div>
              </div>

              {/* Details Section */}
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                      Contact Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{doctor.email}</span>
                      </div>
                      {doctor.phone && (
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{doctor.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                      Professional Info
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <GraduationCap className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{doctor.qualification}</span>
                      </div>
                      <div className="flex items-center">
                        <Stethoscope className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{doctor.specialty}</span>
                      </div>
                      {doctor.clinicId && (
                        <div className="flex items-center">
                          <Building className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{doctor.clinicId.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {doctor.about && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">About</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{doctor.about}</p>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                      Current Address
                    </h4>
                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatAddress(doctor.currentAddress)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                      Permanent Address
                    </h4>
                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatAddress(doctor.permanentAddress)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Doctors</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage doctor records and information</p>
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
              placeholder="Search doctors by name, email, specialty, or UHID..."
              className={`form-input pl-10 ${
                searchTerm ? "border-blue-300 ring-1 ring-blue-200" : ""
              }`}
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                console.log("Doctor search term changed:", value);
                setSearchTerm(value);
              }}
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

          {/* Specialty Filter */}
          <div className="min-w-[200px]">
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="form-input"
            >
              <option value="">All Specialties</option>
              {specialties.filter(Boolean).map((specialty) => (
                <option key={specialty} value={specialty}>
                  {specialty}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="min-w-[150px]">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="form-input"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Filter Status */}
          {(searchTerm || selectedSpecialty || selectedStatus) && (
            <div className="flex items-center text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
              <Filter className="h-4 w-4 mr-2" />
              {filteredDoctors.length} of {doctors.length} doctors
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedSpecialty("");
                  setSelectedStatus("");
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
                  Doctor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Specialty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Location
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
              {filteredDoctors.map((doctor) => (
                <tr
                  key={doctor._id}
                  className="hover:bg-primary-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  onClick={() => viewDoctorDetails(doctor)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {doctor.profileImage ? (
                          <img
                            src={doctor.profileImage}
                            alt={doctor.fullName}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="bg-primary-100 h-10 w-10 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-medium">
                              {doctor.fullName
                                ? doctor.fullName
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .substring(0, 2)
                                : "D"}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          Dr. {doctor.fullName || "Unknown"}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {doctor.email || "No email"}
                        </div>
                        <div className="text-xs text-gray-400">
                          UHID: {doctor.uhid || "N/A"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center">
                        <Stethoscope className="h-4 w-4 text-gray-400 mr-2" />
                        {doctor.specialty}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <GraduationCap className="h-4 w-4 text-gray-400 mr-2" />
                        {doctor.qualification}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {doctor.phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-gray-400 mr-1" />
                        {doctor.phone}
                      </div>
                    )}
                    <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs mt-1">
                      <Mail className="h-3 w-3 text-gray-400 mr-1" />
                      {doctor.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                      {formatAddress(doctor.currentAddress)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        doctor.isActive
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                      }`}
                    >
                      {doctor.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    <div className="text-gray-800 dark:text-gray-200 font-medium">
                      {getClinicName(doctor)}
                    </div>
                    {(() => {
                      const clinic = getClinicDetails(doctor);
                      if (clinic) {
                        return (
                          <>
                            {clinic.address && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                 {clinic.address}
                              </div>
                            )}
                            {clinic.phone && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                📞 {clinic.phone}
                              </div>
                            )}
                            {clinic.email && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                ✉️ {clinic.email}
                              </div>
                            )}
                          </>
                        );
                      }
                      return null;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDoctors.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No doctors found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || selectedSpecialty || selectedStatus
                ? "Try adjusting your search or filter criteria."
                : "No doctors available."}
            </p>
          </div>
        )}
      </div>

      {/* Doctor Details Modal */}
      <DoctorModal
        doctor={selectedDoctor}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
};

export default Doctors;
