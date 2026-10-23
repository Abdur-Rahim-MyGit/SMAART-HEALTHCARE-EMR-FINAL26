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
  Users,
  UserCheck,
  UserX,
  Award,
  Activity,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { doctorsAPI, clinicsAPI } from "../../services/api";

const Doctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedClinic, setSelectedClinic] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch doctors data
  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const params = { limit: 200 };
      const response = await doctorsAPI.getAll(params);
      if (response.data.success) {
        setDoctors(response.data.data || response.data.doctors || []);
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
        setClinics(response.data.clinics || []);
      }
    } catch (error) {
      console.error("Error fetching clinics:", error);
    }
  };

  useEffect(() => {
    fetchDoctors();
    fetchClinics();
  }, []);

  // Filter doctors based on search and filters
  const filteredDoctors = (() => {
    let list = doctors || [];

    if (selectedSpecialty) {
      list = list.filter((doctor) => doctor.specialty === selectedSpecialty);
    }

    if (selectedClinic) {
      list = list.filter((doctor) => {
        const cId = doctor.clinicId?._id || doctor.clinicId;
        return cId === selectedClinic;
      });
    }

    if (selectedStatus) {
      list = list.filter((doctor) =>
        selectedStatus === "active" ? doctor.isActive : !doctor.isActive
      );
    }

    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      list = list.filter((doctor) => {
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

    return list;
  })();

  // Unique specialties for filter
  const specialties = [...new Set(doctors.map((doctor) => doctor.specialty))].filter(Boolean);

  // Statistics
  const stats = {
    total: doctors.length,
    active: doctors.filter((d) => d.isActive).length,
    inactive: doctors.filter((d) => !d.isActive).length,
    specialties: specialties.length,
  };

  // Pagination calculation
  const totalPages = Math.ceil(filteredDoctors.length / itemsPerPage) || 1;
  const paginatedDoctors = filteredDoctors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const viewDoctorDetails = (doctor) => {
    setSelectedDoctor(doctor);
    setShowModal(true);
  };

  const formatAddress = (address) => {
    if (!address) return "N/A";
    if (typeof address === "string") return address;
    return [address.city, address.state].filter(Boolean).join(", ") || "N/A";
  };

  const getClinicName = (doctor) => {
    return (
      doctor.clinicName ||
      doctor.clinicId?.name ||
      clinics.find((c) => c._id === (doctor.clinicId?._id || doctor.clinicId))?.name ||
      "SMAART Network"
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Signature EMR Gradient Header Banner */}
      <div className="bg-gradient-to-r from-[#e6f0ff] to-[#e6f7f5] dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6 shadow-sm border border-blue-50/50 dark:border-gray-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
                <Stethoscope className="h-6 w-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Doctors Management
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">
              Comprehensive doctor directory, medical credentials, and clinical specialties
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                fetchDoctors();
                fetchClinics();
                toast.success("Doctors data refreshed");
              }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur text-gray-700 dark:text-gray-200 py-2.5 px-4 rounded-xl text-sm font-medium hover:bg-white dark:hover:bg-gray-800 transition-all flex items-center shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <Activity className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
              Refresh Data
            </button>
            <div className="bg-gradient-to-r from-[#004D99] to-[#42A89B] text-white py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center shadow-md">
              <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></span>
              {stats.active} Active
            </div>
          </div>
        </div>
      </div>

      {/* KPI Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-gray-950 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total Doctors
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.total}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All clinical practitioners</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Stethoscope className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Active Doctors
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.active}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Available for consultation</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <UserCheck className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Inactive Doctors
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {stats.inactive}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">On leave or deactivated</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <UserX className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Specialties
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {stats.specialties}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Distinct medical domains</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Award className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Card with Search, Filter & Table */}
      <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 sm:p-6">
        {/* Search & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search doctors by name, email, specialty, or UHID..."
              className="form-input pl-10 pr-10 w-full"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={selectedSpecialty}
              onChange={(e) => {
                setSelectedSpecialty(e.target.value);
                setCurrentPage(1);
              }}
              className="form-input py-2 text-sm"
            >
              <option value="">All Specialties</option>
              {specialties.map((specialty) => (
                <option key={specialty} value={specialty}>
                  {specialty}
                </option>
              ))}
            </select>

            <select
              value={selectedClinic}
              onChange={(e) => {
                setSelectedClinic(e.target.value);
                setCurrentPage(1);
              }}
              className="form-input py-2 text-sm"
            >
              <option value="">All Clinics</option>
              {clinics.map((clinic) => (
                <option key={clinic._id} value={clinic._id}>
                  {clinic.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="form-input py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {(searchTerm || selectedSpecialty || selectedClinic || selectedStatus) && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedSpecialty("");
                setSelectedClinic("");
                setSelectedStatus("");
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        {/* Doctors Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50/80 dark:bg-gray-900/80">
              <tr>
                <th className="px-3.5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Doctor
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Specialty & Qualification
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Clinic & Location
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3.5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-100 dark:divide-gray-800/80">
              {paginatedDoctors.map((doctor) => (
                <tr
                  key={doctor._id}
                  className="hover:bg-blue-50/40 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
                  onClick={() => viewDoctorDetails(doctor)}
                >
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center overflow-hidden flex-shrink-0 text-xs">
                        {doctor.profileImage ? (
                          <img
                            src={doctor.profileImage}
                            alt={doctor.fullName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (doctor.fullName || "DR")
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .substring(0, 2)
                            .toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[170px]">
                          Dr. {doctor.fullName || "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[170px]">
                          {doctor.email || "No email"}
                        </div>
                        {doctor.uhid && (
                          <span className="text-[10px] text-gray-400 font-mono block">
                            UHID: {doctor.uhid}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-xs">
                    <div className="flex items-center text-sm font-medium text-gray-900 dark:text-white">
                      <Stethoscope className="h-4 w-4 text-blue-500 mr-1.5 flex-shrink-0" />
                      <span className="truncate max-w-[160px]">{doctor.specialty || "General Medicine"}</span>
                    </div>
                    {doctor.qualification && (
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <GraduationCap className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                        <span className="truncate max-w-[160px]">{doctor.qualification}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-xs">
                    {doctor.phone ? (
                      <div className="flex items-center text-gray-800 dark:text-gray-200">
                        <Phone className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                        <span className="truncate max-w-[130px]">{doctor.phone}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">No phone</span>
                    )}
                    {doctor.email && (
                      <div className="flex items-center text-gray-500 dark:text-gray-400 mt-1">
                        <Mail className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                        <span className="truncate max-w-[130px]">{doctor.email}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-xs text-gray-700 dark:text-gray-300">
                    <div className="flex items-center font-medium">
                      <Building className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                      <span className="truncate max-w-[160px]">{getClinicName(doctor)}</span>
                    </div>
                    {doctor.currentAddress && (
                      <div className="flex items-center text-gray-500 dark:text-gray-400 mt-1">
                        <MapPin className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                        <span className="truncate max-w-[160px]">{formatAddress(doctor.currentAddress)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3.5 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                        doctor.isActive
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400"
                          : "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400"
                      }`}
                    >
                      {doctor.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 whitespace-nowrap text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        viewDoctorDetails(doctor);
                      }}
                      className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="View Doctor Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredDoctors.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              No doctors found
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Try adjusting your search keywords or active filters.
            </p>
          </div>
        )}

        {/* Pagination */}
        {filteredDoctors.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Showing{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {Math.min(currentPage * itemsPerPage, filteredDoctors.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {filteredDoctors.length}
              </span>{" "}
              doctors
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold px-2 text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Doctor Details Modal */}
      {showModal && selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-950 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-800 shadow-2xl">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-xl">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Doctor Profile Details
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Verified practitioner information
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="h-24 w-24 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-3xl overflow-hidden flex-shrink-0 shadow-sm border-2 border-blue-200 dark:border-blue-800">
                  {selectedDoctor.profileImage ? (
                    <img
                      src={selectedDoctor.profileImage}
                      alt={selectedDoctor.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (selectedDoctor.fullName || "DR")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase()
                  )}
                </div>
                <div className="text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Dr. {selectedDoctor.fullName || "Unknown"}
                    </h2>
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        selectedDoctor.isActive
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                      }`}
                    >
                      {selectedDoctor.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-blue-600 dark:text-blue-400 text-sm font-medium mt-1">
                    {selectedDoctor.specialty || "Specialist"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Qualification: {selectedDoctor.qualification || "MBBS / Specialist"}
                  </p>
                  {selectedDoctor.uhid && (
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      UHID: {selectedDoctor.uhid}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                    Contact Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-800 dark:text-gray-200">
                      <Mail className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                      <span>{selectedDoctor.email || "No email"}</span>
                    </div>
                    {selectedDoctor.phone && (
                      <div className="flex items-center text-gray-800 dark:text-gray-200">
                        <Phone className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span>{selectedDoctor.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                    Clinic Affiliation
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center font-medium text-gray-900 dark:text-white">
                      <Building className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                      {getClinicName(selectedDoctor)}
                    </div>
                    <div className="flex items-start text-xs text-gray-500 dark:text-gray-400">
                      <MapPin className="h-3.5 w-3.5 mr-1.5 mt-0.5 text-gray-400 flex-shrink-0" />
                      {formatAddress(selectedDoctor.currentAddress)}
                    </div>
                  </div>
                </div>
              </div>

              {selectedDoctor.about && (
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    Professional Biography
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {selectedDoctor.about}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 rounded-xl text-sm font-semibold transition-colors"
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

export default Doctors;
