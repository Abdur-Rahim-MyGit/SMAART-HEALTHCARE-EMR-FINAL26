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
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all duration-200 hover:border-[#004D99]/20">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color} shadow-sm`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className={`flex items-center mt-1 text-xs font-medium ${
              trend === 'up' 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {trend === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
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
    <div className="space-y-6">
      {/* Header - Matching Appointments Page Style */}
      <div className="bg-gradient-to-r from-[#e6f0ff] to-[#e6f7f5] rounded-xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome to {clinicData?.name || "Jameel's Clinic"}
            </h1>
            <p className="text-gray-600 mt-2">
              Clinic Management Dashboard
            </p>
            {clinicData && (
              <p className="text-gray-500 text-sm mt-1">
                {clinicData.city || "Chennai"}, {clinicData.state || "Tamil Nadu"}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => loadClinicData(true)}
              disabled={refreshing}
              className="bg-white/80 backdrop-blur text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-white transition-all flex items-center shadow-sm border border-gray-200 disabled:opacity-50"
            >
              <Activity className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <div className="flex items-center space-x-2 bg-white/80 backdrop-blur px-3 py-2 rounded-lg shadow-sm border border-gray-200">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700 font-medium">Clinic login successful</span>
            </div>
          </div>
        </div>
      </div>

      {/* Clinic Information Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Building2 className="h-6 w-6 mr-2 text-primary-600" />
          Clinic Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <User className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Admin</p>
              <p className="font-medium">
                {clinicData?.adminName || user?.adminName || "Admin Name"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Mail className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">
                {clinicData?.adminEmail || user?.email || "admin@clinic.com"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Phone className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-medium">
                {clinicData?.phone || "+1 (555) 123-4567"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <MapPin className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Address</p>
              <p className="font-medium">
                {clinicData?.address || "123 Healthcare St, Medical City"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Clock className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Operating Hours</p>
              <p className="font-medium">8:00 AM - 6:00 PM</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Activity className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex items-center justify-center p-4 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
            <Users className="h-6 w-6 text-primary-600 mr-2" />
            <span className="font-medium text-primary-700">Manage Staff</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
            <Calendar className="h-6 w-6 text-green-600 mr-2" />
            <span className="font-medium text-green-700">
              View Appointments
            </span>
          </button>
          <button className="flex items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
            <BarChart3 className="h-6 w-6 text-purple-600 mr-2" />
            <span className="font-medium text-purple-700">View Reports</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
            <Settings className="h-6 w-6 text-gray-600 mr-2" />
            <span className="font-medium text-gray-700">Settings</span>
          </button>
        </div>
      </div>

      {/* Recent Patients */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Users className="h-6 w-6 mr-2 text-primary-600" />
            Recent Patients
          </h2>
          <button className="flex items-center text-primary-600 hover:text-primary-800 text-sm font-medium">
            <Eye className="h-4 w-4 mr-1" />
            View All
          </button>
        </div>
        {patients.length > 0 ? (
          <div className="space-y-3">
            {patients.slice(0, 5).map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-primary-100 p-2 rounded-full">
                    <User className="h-4 w-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{patient.name}</p>
                    <p className="text-sm text-gray-500">
                      {patient.age} years • {patient.gender} •{" "}
                      {patient.bloodType}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{patient.modeOfCare}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(patient.registeredDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No patients found</p>
        )}
      </div>

      {/* Doctors and Nurses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doctors */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Stethoscope className="h-6 w-6 mr-2 text-green-600" />
              Doctors ({stats.totalDoctors})
            </h2>
            <button className="flex items-center text-green-600 hover:text-green-800 text-sm font-medium">
              <Plus className="h-4 w-4 mr-1" />
              Add Doctor
            </button>
          </div>
          {doctors.length > 0 ? (
            <div className="space-y-3">
              {doctors.slice(0, 4).map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-100 p-2 rounded-full">
                      <Stethoscope className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{doctor.name}</p>
                      <p className="text-sm text-gray-500">
                        {doctor.specialization || "General Medicine"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{doctor.phone}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(doctor.joinedDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No doctors found</p>
          )}
        </div>

        {/* Nurses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <UserCheck className="h-6 w-6 mr-2 text-purple-600" />
              Nurses ({stats.totalNurses})
            </h2>
            <button className="flex items-center text-purple-600 hover:text-purple-800 text-sm font-medium">
              <Plus className="h-4 w-4 mr-1" />
              Add Nurse
            </button>
          </div>
          {nurses.length > 0 ? (
            <div className="space-y-3">
              {nurses.slice(0, 4).map((nurse) => (
                <div
                  key={nurse.id}
                  className="flex items-center justify-between p-3 bg-purple-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-purple-100 p-2 rounded-full">
                      <UserCheck className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{nurse.name}</p>
                      <p className="text-sm text-gray-500">
                        {nurse.department || "General Care"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{nurse.phone}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(nurse.joinedDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No nurses found</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClinicDashboard;
