import React, { useState, useEffect } from "react";
import {
  Calendar,
  Plus,
  Search,
  Clock,
  User,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Building2,
  Filter,
  Eye,
  Edit,
  Trash2,
} from "lucide-react";
import { appointmentsAPI } from "../../services/api";
import AppointmentRequestsPanel from "./AppointmentRequestsPanel";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "react-hot-toast";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";

const Appointments = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState("latest");

  // Enhanced search filters
  const [filters, setFilters] = useState({
    patientName: "",
    clinic: "",
    doctor: "",
    specificDate: "",
    priority: "",
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    scheduled: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    todayAppointments: 0,
    upcomingAppointments: 0,
  });

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      // Get the token from localStorage
      const token = localStorage.getItem("token");
      console.log("Auth Token:", token ? "Token exists" : "No token found");

      console.log("Current user:", user);
      console.log("Fetching appointments from API...");

      // Make the API call with the token in the headers
      const response = await appointmentsAPI.getAll();
      console.log("API Response Status:", response.status);
      console.log("API Response Headers:", response.headers);
      console.log("API Response Data:", response.data);

      if (response.data && response.data.success) {
        const appointmentsData = response.data.appointments || [];
        console.log("Appointments data:", appointmentsData);
        console.log("Total appointments fetched:", appointmentsData.length);
        setAppointments(appointmentsData);
        calculateStats(appointmentsData);
      } else {
        console.error("API returned success=false:", response.data);
        toast.error(response.data?.message || "Failed to fetch appointments");
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
      console.error("Error response:", error.response);
      console.error("Error message:", error.message);
      toast.error(
        error.response?.data?.message || "Failed to fetch appointments"
      );
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (appointmentsData) => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const stats = {
      total: appointmentsData.length,
      scheduled: appointmentsData.filter((apt) => apt.status === "Pending")
        .length,
      confirmed: appointmentsData.filter((apt) => apt.status === "Confirmed")
        .length,
      completed: appointmentsData.filter((apt) => apt.status === "Completed")
        .length,
      cancelled: appointmentsData.filter(
        (apt) => apt.status === "Cancelled" || apt.status === "No Show"
      ).length,
      todayAppointments: appointmentsData.filter((apt) => {
        if (!apt.date) return false;
        try {
          const aptDate = new Date(apt.date);
          if (isNaN(aptDate.getTime())) return false;
          return aptDate.toISOString().split("T")[0] === todayStr;
        } catch (e) {
          return false;
        }
      }).length,
      upcomingAppointments: appointmentsData.filter((apt) => {
        if (!apt.date) return false;
        try {
          const aptDate = new Date(apt.date);
          if (isNaN(aptDate.getTime())) return false;
          return (
            aptDate > today &&
            (apt.status === "Pending" || apt.status === "Confirmed")
          );
        } catch (e) {
          return false;
        }
      }).length,
    };

    setStats(stats);
  };

  const filteredAppointments = appointments.filter((appointment) => {
    const matchesSearch =
      (appointment.patientId?.fullName || appointment.patientName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      appointment.doctorId?.fullName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      appointment.clinicId?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      appointment.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.appointmentType
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "" || appointment.status === statusFilter;

    const matchesType =
      appointmentTypeFilter === "" ||
      appointment.appointmentType === appointmentTypeFilter;

    const matchesDate = () => {
      if (dateFilter === "") return true;
      if (!appointment.date) return false;
      try {
        const appointmentDate = new Date(appointment.date);
        if (isNaN(appointmentDate.getTime())) return false;
        const today = new Date();

        switch (dateFilter) {
          case "today":
            return isToday(appointmentDate);
          case "tomorrow":
            return isTomorrow(appointmentDate);
          case "yesterday":
            return isYesterday(appointmentDate);
          case "upcoming":
            return appointmentDate > today;
          case "past":
            return appointmentDate < today;
          default:
            return true;
        }
      } catch (e) {
        return false;
      }
    };

    // Enhanced individual field filters
    const matchesPatientName =
      !filters.patientName ||
      (appointment.patientId?.fullName || appointment.patientName || "")
        .toLowerCase()
        .includes(filters.patientName.toLowerCase());

    const matchesClinic =
      !filters.clinic ||
      appointment.clinicId?.name
        ?.toLowerCase()
        .includes(filters.clinic.toLowerCase());

    const matchesDoctor =
      !filters.doctor ||
      appointment.doctorId?.fullName
        ?.toLowerCase()
        .includes(filters.doctor.toLowerCase());

    const matchesSpecificDate =
      !filters.specificDate ||
      (appointment.date && (() => {
        try {
          const d = new Date(appointment.date);
          if (isNaN(d.getTime())) return false;
          return d.toISOString().split("T")[0] === filters.specificDate;
        } catch (e) {
          return false;
        }
      })());

    const matchesPriority =
      !filters.priority ||
      filters.priority === "all" ||
      (appointment.priority || "low").toLowerCase() ===
        filters.priority.toLowerCase();

    return (
      matchesSearch &&
      matchesStatus &&
      matchesType &&
      matchesDate() &&
      matchesPatientName &&
      matchesClinic &&
      matchesDoctor &&
      matchesSpecificDate &&
      matchesPriority
    );
  });

  // Sort filtered appointments
  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    switch (sortBy) {
      case "latest":
        // Sort by creation date (latest first), then by appointment date (latest first)
        const createdAtDiff =
          new Date(b.createdAt || b.updatedAt || 0) -
          new Date(a.createdAt || a.updatedAt || 0);
        if (createdAtDiff !== 0) return createdAtDiff;
        return new Date(b.date || 0) - new Date(a.date || 0);

      case "oldest":
        // Sort by creation date (oldest first), then by appointment date (oldest first)
        const createdAtDiffOld =
          new Date(a.createdAt || a.updatedAt || 0) -
          new Date(b.createdAt || b.updatedAt || 0);
        if (createdAtDiffOld !== 0) return createdAtDiffOld;
        return new Date(a.date || 0) - new Date(b.date || 0);

      case "appointment_date_asc":
        // Sort by appointment date (earliest first)
        return new Date(a.date || 0) - new Date(b.date || 0);

      case "appointment_date_desc":
        // Sort by appointment date (latest first)
        return new Date(b.date || 0) - new Date(a.date || 0);

      case "patient_name":
        // Sort by patient name alphabetically
        const nameA = a.patientId?.fullName || a.patientName || "";
        const nameB = b.patientId?.fullName || b.patientName || "";
        return nameA.localeCompare(nameB);

      case "status":
        // Sort by status
        return (a.status || "").localeCompare(b.status || "");

      default:
        return 0;
    }
  });

  const getStatusColor = (status) => {
    const colors = {
      Pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      Confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      "In Progress": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      Completed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      Cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      "No Show": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      normal: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return colors[priority] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  };

  const formatAppointmentDate = (date) => {
    if (!date) return "N/A";
    try {
      const appointmentDate = new Date(date);
      if (isNaN(appointmentDate.getTime())) return "N/A";
      if (isToday(appointmentDate)) {
        return "Today";
      } else if (isTomorrow(appointmentDate)) {
        return "Tomorrow";
      } else if (isYesterday(appointmentDate)) {
        return "Yesterday";
      } else {
        return format(appointmentDate, "MMM dd, yyyy");
      }
    } catch (e) {
      return "N/A";
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, description }) => (
    <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-800 hover:shadow-lg dark:shadow-gray-900 transition-all duration-200 hover:border-[#004D99] dark:hover:border-blue-400">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color} shadow-sm`}>
          <Icon className="h-6 w-6 text-white dark:text-gray-100" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004D99] dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-gray-50 dark:bg-black p-6">
      {/* Incoming appointment requests from the public SMAART appointment website */}
      <AppointmentRequestsPanel onReviewed={fetchAppointments} />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#e6f0ff] to-[#e6f7f5] dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Appointments Management
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              {user.role === "patient"
                ? "Your appointment history and upcoming visits"
                : "Comprehensive appointment management system"}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchAppointments}
              className="bg-white/80 backdrop-blur text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg text-sm font-medium hover:bg-white dark:hover:bg-gray-900 dark:bg-gray-950 transition-all flex items-center shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <Activity className="h-4 w-4 mr-2" />
              Refresh Data
            </button>
            {(user.role === "patient" ||
              user.role === "super_master_admin" ||
              user.role === "clinic_admin") && (
              <button className="bg-gradient-to-r from-[#004D99] to-[#42A89B] text-white dark:text-gray-100 py-2 px-4 rounded-lg text-sm font-medium hover:from-[#003d80] hover:to-[#3a7d92] transition-all flex items-center shadow-lg dark:shadow-gray-900">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Live
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Appointments"
          value={stats.total}
          icon={Calendar}
          color="bg-[#004D99] dark:bg-blue-500"
          description="All appointments in system"
        />
        <StatCard
          title="Today's Appointments"
          value={stats.todayAppointments}
          icon={Clock}
          color="bg-blue-500"
          description="Scheduled for today"
        />
        <StatCard
          title="Upcoming"
          value={stats.upcomingAppointments}
          icon={TrendingUp}
          color="bg-green-500"
          description="Future appointments"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle}
          color="bg-gray-500"
          description="Successfully completed"
        />
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm p-6 border border-gray-100 dark:border dark:border-gray-800 hover:shadow-lg dark:shadow-gray-900 transition-all duration-200">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <div className="w-1 h-6 bg-[#004D99] rounded-full mr-3"></div>
            Status Overview
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Scheduled</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.scheduled}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Confirmed</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.confirmed}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.completed}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Cancelled/No Show</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.cancelled}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm p-6 border border-gray-100 dark:border dark:border-gray-800 hover:shadow-lg dark:shadow-gray-900 transition-all duration-200">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <div className="w-1 h-6 bg-[#42A89B] rounded-full mr-3"></div>
            Quick Actions
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => setDateFilter("today")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center"
            >
              <Clock className="h-4 w-4 mr-3 text-[#004D99] dark:text-blue-400" />
              <span className="text-sm text-gray-900 dark:text-gray-300">View Today's Appointments</span>
            </button>
            <button
              onClick={() => setStatusFilter("Scheduled")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center"
            >
              <AlertCircle className="h-4 w-4 mr-3 text-[#004D99] dark:text-blue-400" />
              <span className="text-sm text-gray-900 dark:text-gray-300">Pending Confirmations</span>
            </button>
            <button
              onClick={() => setDateFilter("upcoming")}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center"
            >
              <TrendingUp className="h-4 w-4 mr-3 text-[#004D99] dark:text-blue-400" />
              <span className="text-sm text-gray-900 dark:text-gray-300">Upcoming Appointments</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm p-6 border border-gray-100 dark:border dark:border-gray-800 hover:shadow-lg dark:shadow-gray-900 transition-all duration-200">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <div className="w-1 h-6 bg-gradient-to-b from-[#004D99] to-[#42A89B] rounded-full mr-3"></div>
            Recent Activity
          </h3>
          <div className="space-y-3">
            {appointments.slice(0, 3).map((appointment, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[#004D99] to-[#42A89B] rounded-full flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white dark:text-gray-100" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {appointment.patientId?.fullName ||
                      appointment.patientName ||
                      "Unknown Patient"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatAppointmentDate(appointment.date)} •{" "}
                    {appointment.time}
                  </p>
                </div>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                    appointment.status
                  )}`}
                >
                  {appointment.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Search and Filters */}
      <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm p-6 border border-gray-100 dark:border dark:border-gray-800 hover:shadow-lg dark:shadow-gray-900 transition-all duration-200">
        {/* Quick Search */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Quick search across all fields..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-4 py-3 border rounded-lg transition-all flex items-center ${
                showAdvancedFilters
                  ? "bg-[#004D99] text-white border-[#004D99] dark:bg-blue-600 dark:border-blue-600"
                  : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700"
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Advanced Filters
              {(filters.patientName ||
                filters.clinic ||
                filters.doctor ||
                filters.specificDate ||
                filters.priority) && (
                <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                  {
                    [
                      filters.patientName,
                      filters.clinic,
                      filters.doctor,
                      filters.specificDate,
                      filters.priority,
                    ].filter(Boolean).length
                  }
                </span>
              )}
            </button>

            <select
              className="px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="latest">Latest First</option>
              <option value="oldest">Oldest First</option>
              <option value="appointment_date_desc">
                Appointment Date (Latest)
              </option>
              <option value="appointment_date_asc">
                Appointment Date (Earliest)
              </option>
              <option value="patient_name">Patient Name (A-Z)</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters - Collapsible */}
        {showAdvancedFilters && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Filter className="h-5 w-5 mr-2 text-[#004D99]" />
              Advanced Search Filters
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Patient Name Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <User className="h-4 w-4 inline mr-1" />
                  Patient Name
                </label>
                <input
                  type="text"
                  placeholder="Search by patient name..."
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  value={filters.patientName}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      patientName: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Clinic Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Building2 className="h-4 w-4 inline mr-1" />
                  Clinic
                </label>
                <input
                  type="text"
                  placeholder="Search by clinic name..."
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  value={filters.clinic}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, clinic: e.target.value }))
                  }
                />
              </div>

              {/* Doctor Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <User className="h-4 w-4 inline mr-1" />
                  Doctor
                </label>
                <input
                  type="text"
                  placeholder="Search by doctor name..."
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  value={filters.doctor}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, doctor: e.target.value }))
                  }
                />
              </div>

              {/* Specific Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Specific Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  value={filters.specificDate}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      specificDate: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Activity className="h-4 w-4 inline mr-1" />
                  Priority
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  value={filters.priority}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      priority: e.target.value,
                    }))
                  }
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {filteredAppointments.length} of {appointments.length}{" "}
                appointments found
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFilters({
                      patientName: "",
                      clinic: "",
                      doctor: "",
                      specificDate: "",
                      priority: "",
                    });
                    setSearchTerm("");
                  }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowAdvancedFilters(false)}
                  className="px-4 py-2 text-sm bg-[#004D99] text-white dark:text-gray-100 rounded-lg hover:bg-[#003d80] dark:hover:bg-blue-700 transition-all"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Appointments Table */}
      <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-100 dark:border dark:border-gray-800 overflow-hidden hover:shadow-lg dark:shadow-gray-900 transition-all duration-200">
        <div className="px-6 py-4 border-b border-gray-200 dark:border dark:border-gray-800 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <div className="w-1 h-6 bg-gradient-to-b from-[#004D99] to-[#42A89B] rounded-full mr-3"></div>
              Appointments List ({sortedAppointments.length})
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Sorted by:{" "}
              <span className="font-medium text-[#004D99] dark:text-blue-400">
                {sortBy === "latest"
                  ? "Latest First"
                  : sortBy === "oldest"
                  ? "Oldest First"
                  : sortBy === "appointment_date_desc"
                  ? "Appointment Date (Latest)"
                  : sortBy === "appointment_date_asc"
                  ? "Appointment Date (Earliest)"
                  : sortBy === "patient_name"
                  ? "Patient Name (A-Z)"
                  : sortBy === "status"
                  ? "Status"
                  : "Latest First"}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y dark:divide-gray-700 divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2 text-[#004D99]" />
                    Patient
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    <Building2 className="h-4 w-4 mr-2 text-[#004D99]" />
                    Clinic
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2 text-[#004D99]" />
                    Doctor
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-[#004D99]" />
                    Date & Time
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  <div className="flex items-center">
                    <Activity className="h-4 w-4 mr-2 text-[#004D99]" />
                    Priority
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedAppointments.map((appointment) => (
                <tr
                  key={appointment._id}
                  className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-green-50 dark:hover:from-gray-800 dark:hover:to-gray-800 transition-all duration-200 border-l-4 border-transparent hover:border-[#004D99] dark:hover:border-blue-400"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-blue-100 dark:bg-gray-900 flex items-center justify-center">
                        {appointment.patientId?.profileImage ? (
                          <img
                            src={appointment.patientId.profileImage}
                            alt={appointment.patientId?.fullName || "Patient"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              // Fallback to initials if image fails to load
                              e.target.style.display = "none";
                              e.target.nextElementSibling.style.display =
                                "flex";
                            }}
                          />
                        ) : null}
                        <span
                          className="text-blue-600 dark:text-blue-400 font-medium text-sm"
                          style={{
                            display: appointment.patientId?.profileImage
                              ? "none"
                              : "flex",
                          }}
                        >
                          {appointment.patientId?.fullName
                            ? appointment.patientId.fullName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .substring(0, 2)
                            : "P"}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {appointment.patientId?.fullName ||
                            appointment.patientName ||
                            "Unknown Patient"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Age {appointment.patientId?.age || "N/A"} •{" "}
                          {appointment.patientId?.gender || "N/A"}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {appointment.patientId?.phone ||
                            appointment.patientId?.attenderMobile ||
                            "N/A"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {appointment.clinicId?.name || "Unknown Clinic"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {appointment.clinicId?.type || "Cardiology"} •{" "}
                          {appointment.clinicId?.city || "Bangalore"},{" "}
                          {appointment.clinicId?.state || "Karnataka"}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {appointment.clinicId?.phone || "+91756749"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {appointment.doctorId?.fullName
                            ? `Dr. ${appointment.doctorId.fullName}`
                            : "Unknown Doctor"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {appointment.doctorId?.specialty ||
                            "General Practice"}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {appointment.doctorId?.phone || "+91754247432"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatAppointmentDate(appointment.date)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {appointment.time || "17:30"} (
                      {appointment.duration || "30"}min)
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(
                        appointment.priority || "low"
                      )}`}
                    >
                      {(appointment.priority || "LOW").toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedAppointments.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-10 w-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No appointments found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchTerm || statusFilter || appointmentTypeFilter || dateFilter
                ? "Try adjusting your search filters or clear all filters to see all appointments."
                : "No appointments have been scheduled yet. Create your first appointment to get started."}
            </p>
            {(searchTerm ||
              statusFilter ||
              appointmentTypeFilter ||
              dateFilter) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("");
                  setAppointmentTypeFilter("");
                  setDateFilter("");
                }}
                className="bg-[#004D99] text-white dark:text-gray-100 px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d80] dark:hover:bg-blue-700 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Appointments;
