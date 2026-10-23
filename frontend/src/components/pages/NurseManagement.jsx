import React, { useState, useEffect } from "react";
import { usersAPI, clinicsAPI, nursesAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "react-hot-toast";
import {
  Search,
  UserCheck,
  UserX,
  Users,
  Activity,
  Building2,
  Mail,
  Phone,
  MapPin,
  Award,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

const NurseManagement = () => {
  const { user } = useAuth();
  const [nurses, setNurses] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClinic, setFilterClinic] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await nursesAPI.getAll();
      let nursesData = [];
      if (res?.data?.success && res.data.nurses) nursesData = res.data.nurses;
      else if (res?.data?.data) nursesData = res.data.data;
      else if (Array.isArray(res?.data)) nursesData = res.data;

      // Filter nurses by current clinic admin's clinic if applicable
      if (user?.role === "clinic_admin" && user?.clinicId) {
        nursesData = (nursesData || []).filter((nurse) => {
          const nurseClinicId =
            nurse.clinicId?._id || nurse.clinicId || nurse.clinic?._id;
          return nurseClinicId === user.clinicId;
        });
      }

      setNurses(nursesData || []);
    } catch (err) {
      console.error("Error fetching nurses:", err);
      toast.error("Failed to fetch nurses data");
    } finally {
      setLoading(false);
    }
  };

  const fetchClinics = async () => {
    try {
      const r = await clinicsAPI.getAll();
      let clinicsData = [];
      if (r?.data?.success && r.data.clinics) clinicsData = r.data.clinics;
      else if (Array.isArray(r?.data)) clinicsData = r.data;

      if (user?.role === "clinic_admin" && user?.clinicId) {
        clinicsData = (clinicsData || []).filter(
          (clinic) => clinic._id === user.clinicId
        );
      }
      setClinics(clinicsData || []);
    } catch (err) {
      console.error("Error fetching clinics:", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchClinics();
  }, []);

  // Filtered nurses
  const filteredNurses = nurses.filter((nurse) => {
    const nurseClinicId =
      nurse.clinicId?._id || nurse.clinicId || nurse.clinic?._id;

    const matchesClinic =
      filterClinic === "all" || nurseClinicId === filterClinic;

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" ? nurse.isActive : !nurse.isActive);

    const matchesSearch =
      !searchTerm ||
      (nurse.fullName || `${nurse.firstName || ""} ${nurse.lastName || ""}`)
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (nurse.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (nurse.specialization || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (nurse.licenseNumber || "").toLowerCase().includes(searchTerm.toLowerCase());

    return matchesClinic && matchesStatus && matchesSearch;
  });

  // Calculate statistics
  const activeCount = nurses.filter((n) => n.isActive).length;
  const distinctClinics = [
    ...new Set(
      nurses
        .map((n) => n.clinicName || n.clinicId?.name || n.clinic?.name)
        .filter(Boolean)
    ),
  ];

  const stats = {
    totalNurses: nurses.length,
    activeNurses: activeCount,
    inactiveNurses: nurses.length - activeCount,
    clinicsCount: distinctClinics.length || clinics.length,
  };

  // Pagination calculation
  const totalPages = Math.ceil(filteredNurses.length / itemsPerPage) || 1;
  const paginatedNurses = filteredNurses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getNurseName = (nurse) => {
    return (
      nurse.fullName ||
      `${nurse.firstName || ""} ${nurse.lastName || ""}`.trim() ||
      nurse.displayName ||
      "Unnamed Nurse"
    );
  };

  const getNurseInitials = (nurse) => {
    return getNurseName(nurse)
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getClinicName = (nurse) => {
    return (
      nurse.clinicName ||
      nurse.clinicId?.name ||
      nurse.clinic?.name ||
      clinics.find(
        (c) =>
          c._id === (nurse.clinicId?._id || nurse.clinicId || nurse.clinic?._id)
      )?.name ||
      "SMAART Network"
    );
  };

  const viewNurseDetails = (nurse) => {
    setSelectedNurse(nurse);
    setShowModal(true);
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
                <UserCheck className="h-6 w-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Nurses Management
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">
              {user?.role === "clinic_admin"
                ? `Manage nursing staff and department assignments for ${clinics[0]?.name || "your clinic"}`
                : "Manage nursing staff records, clinical assignments, and departmental credentials"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                fetchData();
                fetchClinics();
                toast.success("Nurses data refreshed");
              }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur text-gray-700 dark:text-gray-200 py-2.5 px-4 rounded-xl text-sm font-medium hover:bg-white dark:hover:bg-gray-800 transition-all flex items-center shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <Activity className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
              Refresh Data
            </button>
            <div className="bg-gradient-to-r from-[#004D99] to-[#42A89B] text-white py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center shadow-md">
              <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></span>
              {stats.activeNurses} Active
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
                Total Nurses
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.totalNurses}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Registered staff</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Active Staff
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.activeNurses}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">On duty or available</p>
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
                Inactive Staff
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {stats.inactiveNurses}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave or off duty</p>
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
                Clinic Locations
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {stats.clinicsCount}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Facilities deployed</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Building2 className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Card with Search, Filter & Table */}
      <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search nurses by name, email, specialization, or license..."
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {user?.role !== "clinic_admin" && (
              <select
                value={filterClinic}
                onChange={(e) => {
                  setFilterClinic(e.target.value);
                  setCurrentPage(1);
                }}
                className="form-input py-2 text-sm min-w-[180px]"
              >
                <option value="all">All Clinics</option>
                {clinics.map((clinic) => (
                  <option key={clinic._id} value={clinic._id}>
                    {clinic.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="form-input py-2 text-sm min-w-[140px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {(searchTerm || filterClinic !== "all" || filterStatus !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterClinic("all");
                setFilterStatus("all");
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        {/* Nurses Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50/80 dark:bg-gray-900/80">
              <tr>
                <th className="px-3.5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Nurse Staff
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Specialization & Exp
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Clinic
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
              {paginatedNurses.map((nurse) => (
                <tr
                  key={nurse._id}
                  className="hover:bg-blue-50/40 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
                  onClick={() => viewNurseDetails(nurse)}
                >
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center overflow-hidden flex-shrink-0 text-xs">
                        {nurse.profileImage ? (
                          <img
                            src={nurse.profileImage}
                            alt={getNurseName(nurse)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getNurseInitials(nurse)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[170px]">
                          {getNurseName(nurse)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[170px]">
                          {nurse.email || "No email"}
                        </div>
                        {nurse.licenseNumber && (
                          <span className="text-[10px] text-gray-400 font-mono block">
                            License: {nurse.licenseNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-xs">
                    <div className="flex items-center text-sm font-medium text-gray-900 dark:text-white">
                      <Award className="h-4 w-4 text-emerald-500 mr-1.5 flex-shrink-0" />
                      <span className="truncate max-w-[160px]">{nurse.specialization || "General Nursing"}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-5.5">
                      {nurse.experience || nurse.experienceYears
                        ? `${nurse.experience || nurse.experienceYears} yrs experience`
                        : "Standard experience"}
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-xs">
                    {nurse.phone ? (
                      <div className="flex items-center text-gray-800 dark:text-gray-200">
                        <Phone className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                        <span className="truncate max-w-[130px]">{nurse.phone}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">No phone</span>
                    )}
                    {nurse.email && (
                      <div className="flex items-center text-gray-500 dark:text-gray-400 mt-1">
                        <Mail className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                        <span className="truncate max-w-[130px]">{nurse.email}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-xs text-gray-700 dark:text-gray-300">
                    <div className="flex items-center font-medium">
                      <Building2 className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                      <span className="truncate max-w-[160px]">{getClinicName(nurse)}</span>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                        nurse.isActive
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400"
                          : "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400"
                      }`}
                    >
                      {nurse.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 whitespace-nowrap text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        viewNurseDetails(nurse);
                      }}
                      className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="View Nurse Details"
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
        {filteredNurses.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              No nurses found
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Try adjusting your search keywords or active filters.
            </p>
          </div>
        )}

        {/* Pagination */}
        {filteredNurses.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Showing{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {Math.min(currentPage * itemsPerPage, filteredNurses.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {filteredNurses.length}
              </span>{" "}
              nurses
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

      {/* Nurse Details Modal */}
      {showModal && selectedNurse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-950 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-800 shadow-2xl">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-xl">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Nurse Profile Details
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Clinical nurse credentials & assignments
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
                <div className="h-24 w-24 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-3xl overflow-hidden flex-shrink-0 shadow-sm border-2 border-emerald-200 dark:border-emerald-800">
                  {selectedNurse.profileImage ? (
                    <img
                      src={selectedNurse.profileImage}
                      alt={getNurseName(selectedNurse)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getNurseInitials(selectedNurse)
                  )}
                </div>
                <div className="text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {getNurseName(selectedNurse)}
                    </h2>
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        selectedNurse.isActive
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                      }`}
                    >
                      {selectedNurse.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium mt-1">
                    {selectedNurse.specialization || "General Nursing"}
                  </p>
                  {selectedNurse.licenseNumber && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                      License: {selectedNurse.licenseNumber}
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
                      <span>{selectedNurse.email || "No email"}</span>
                    </div>
                    {selectedNurse.phone && (
                      <div className="flex items-center text-gray-800 dark:text-gray-200">
                        <Phone className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span>{selectedNurse.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                    Clinic & Department
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center font-medium text-gray-900 dark:text-white">
                      <Building2 className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                      {getClinicName(selectedNurse)}
                    </div>
                    {selectedNurse.department && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Department: {selectedNurse.department}
                      </div>
                    )}
                    {selectedNurse.shift && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Shift: {selectedNurse.shift}
                      </div>
                    )}
                  </div>
                </div>
              </div>
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

export default NurseManagement;
