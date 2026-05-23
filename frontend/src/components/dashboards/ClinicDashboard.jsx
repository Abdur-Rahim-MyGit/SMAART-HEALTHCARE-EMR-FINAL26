import React, { useState, useEffect } from "react";
import {
  Building2,
  Users,
  Calendar,
  Activity,
  Phone,
  Mail,
  MapPin,
  Clock,
  User,
  Stethoscope,
  UserCheck,
  Settings,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Eye,
  Plus,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { clinicsAPI } from "../../services/api";
import { toast } from "react-hot-toast";

const ClinicDashboard = () => {
  const { user } = useAuth();
  const [clinicData, setClinicData] = useState(null);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalDoctors: 0,
    totalNurses: 0,
    todayAppointments: 0,
    totalStaff: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadClinicData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (!user?.clinicId) {
        toast.error("No clinic ID found");
        return;
      }

      console.log("Loading clinic data for clinic ID:", user.clinicId);
      const response = await clinicsAPI.getDashboardData(user.clinicId);
      console.log("Clinic dashboard response:", response.data);

      if (response.data.success) {
        const { data } = response.data;
        setClinicData(data.clinic);
        setStats(data.stats);
        setPatients(data.patients || []);
        setDoctors(data.doctors || []);
        setNurses(data.nurses || []);

        if (isRefresh) {
          toast.success("Data refreshed successfully", { duration: 1000 });
        }
      } else {
        toast.error("Failed to load clinic data");
      }
    } catch (error) {
      console.error("Error loading clinic data:", error);
      toast.error("Failed to load clinic data: " + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadClinicData();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadClinicData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.clinicId]);

  const StatCard = ({ title, value, icon: Icon, color, trend, trendValue }) => (
    <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-lg dark:shadow-gray-900 transition-all duration-200 hover:border-[#004D99] dark:border-blue-400/20">
      <div className="flex items-center">
        <div className={`p-2 sm:p-3 rounded-lg ${color} shadow-sm flex-shrink-0`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white dark:text-gray-100" />
        </div>
        <div className="ml-3 sm:ml-4 min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
            {title}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {trend && (
            <div
              className={`flex items-center mt-1 text-xs font-medium ${
                trend === "up" ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend === "up" ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Matching Appointments Page Style */}
      <div className="bg-gradient-to-r from-[#e6f0ff] to-[#e6f7f5] dark:from-gray-800 dark:to-gray-800 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white truncate">
              Welcome to {clinicData?.name || "Jameel's Clinic"}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
              Clinic Management Dashboard
            </p>
            {clinicData && (
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                {clinicData.city || "Chennai"},{" "}
                {clinicData.state || "Tamil Nadu"}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={() => loadClinicData(true)}
              disabled={refreshing}
              className="bg-white/80 backdrop-blur text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg text-sm font-medium hover:bg-white dark:hover:bg-gray-900 dark:bg-gray-950 transition-all flex items-center justify-center shadow-sm border border-gray-200 dark:border dark:border-gray-800 disabled:opacity-50"
            >
              <Activity
                className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">{refreshing ? "Refreshing..." : "Refresh Data"}</span>
              <span className="sm:hidden">{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
            <div className="flex items-center space-x-2 bg-white dark:bg-gray-950/80 backdrop-blur px-3 py-2 rounded-lg shadow-sm border border-gray-200 dark:border dark:border-gray-800">
              <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
              <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium truncate">
                <span className="hidden sm:inline">Clinic login successful</span>
                <span className="sm:hidden">Active</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Clinic Information Card */}
      <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-200 dark:border dark:border-gray-800 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
          <Building2 className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-primary-600" />
          Clinic Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="flex items-center space-x-3">
            <User className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Admin</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {clinicData?.adminName || user?.adminName || "Admin Name"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Mail className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {clinicData?.adminEmail || user?.email || "admin@clinic.com"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Phone className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {clinicData?.phone || "+1 (555) 123-4567"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Address
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {clinicData?.address || "123 Healthcare St, Medical City"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Operating Hours
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                8:00 AM - 6:00 PM
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Activity className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <StatCard
          title="Total Patients"
          value={stats.totalPatients}
          icon={Users}
          color="bg-[#004D99]"
          trend="up"
          trendValue="+12%"
        />
        <StatCard
          title="Doctors"
          value={stats.totalDoctors}
          icon={Stethoscope}
          color="bg-green-500"
          trend="up"
          trendValue="+2"
        />
        <StatCard
          title="Nurses"
          value={stats.totalNurses}
          icon={UserCheck}
          color="bg-purple-500"
          trend="up"
          trendValue="+3"
        />
        <StatCard
          title="Today's Appointments"
          value={stats.todayAppointments}
          icon={Calendar}
          color="bg-orange-500"
          trend="up"
          trendValue="+8%"
        />
        <StatCard
          title="Total Staff"
          value={stats.totalStaff}
          icon={Activity}
          color="bg-red-500"
          trend="up"
          trendValue="+5%"
        />
        <StatCard
          title="All Departments"
          value={stats.totalDoctors + stats.totalNurses}
          icon={BarChart3}
          color="bg-blue-500"
          trend="up"
          trendValue="+15%"
        />
      </div>
      {/* Recent Patients */}
      <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-200 dark:border dark:border-gray-800 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center min-w-0">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-primary-600 flex-shrink-0" />
            <span className="truncate">Recent Patients</span>
          </h2>
          <button
            onClick={() => navigate("/patients")}
            className="flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 text-xs sm:text-sm font-medium transition-colors flex-shrink-0"
          >
            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden sm:inline">View All</span>
            <span className="sm:hidden">All</span>
          </button>
        </div>
        {patients.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {patients.slice(0, 5).map((patient) => (
              <div
                key={patient.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="bg-primary-100 p-2 rounded-full flex-shrink-0">
                    <User className="h-4 w-4 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
                      {patient.name}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                      {patient.age} years • {patient.gender} •{" "}
                      {patient.bloodType}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right flex-shrink-0 pl-11 sm:pl-0">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {patient.modeOfCare}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(patient.registeredDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No patients found
          </p>
        )}
      </div>

      {/* Doctors and Nurses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Doctors */}
        <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-200 dark:border dark:border-gray-800 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center min-w-0">
              <Stethoscope className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-green-600 flex-shrink-0" />
              <span className="truncate">Doctors ({stats.totalDoctors})</span>
            </h2>
            <button
              onClick={() => navigate("/doctors")}
              className="flex items-center text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-xs sm:text-sm font-medium transition-colors flex-shrink-0"
            >
              <span className="hidden sm:inline">View Doctors</span>
              <span className="sm:hidden">View</span>
            </button>
          </div>
          {doctors.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {doctors.slice(0, 4).map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="bg-green-100 p-2 rounded-full flex-shrink-0">
                      <Stethoscope className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
                        {doctor.name}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                        {doctor.specialization || "General Medicine"}
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0 pl-11 sm:pl-0">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                      {doctor.phone}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(doctor.joinedDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No doctors found
            </p>
          )}
        </div>

        {/* Nurses */}
        <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-200 dark:border dark:border-gray-800 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center min-w-0">
              <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-purple-600 flex-shrink-0" />
              <span className="truncate">Nurses ({stats.totalNurses})</span>
            </h2>
            <button
              onClick={() => navigate("/NurseManagement")}
              className="flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 text-xs sm:text-sm font-medium transition-colors flex-shrink-0"
            >
              <span className="hidden sm:inline">View Nurse</span>
              <span className="sm:hidden">View</span>
            </button>
          </div>
          {nurses.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {nurses.slice(0, 4).map((nurse) => (
                <div
                  key={nurse.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="bg-purple-100 p-2 rounded-full flex-shrink-0">
                      <UserCheck className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
                        {nurse.name}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                        {nurse.department || "General Care"}
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0 pl-11 sm:pl-0">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                      {nurse.phone}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(nurse.joinedDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No nurses found
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClinicDashboard;
