import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Calendar, 
  DollarSign, 
  UserPlus, 
  Building2, 
  Activity, 
  TrendingUp, 
  Clock,
  Stethoscope,
  FileText,
  Settings,
  BarChart3,
  Download,
  ChevronDown,
  FileSpreadsheet
} from 'lucide-react'
import { usersAPI, appointmentsAPI, patientsAPI, clinicsAPI } from '../../services/api'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import * as XLSX from 'xlsx'

const SuperAdminDashboard = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalStaff: 0,
    totalPatients: 0,
    totalAppointments: 0,
    monthlyRevenue: 0,
    todayAppointments: 0,
    activeDoctors: 0,
    pendingAppointments: 0
  })
  const [clinicInfo, setClinicInfo] = useState(null)
  const [recentAppointments, setRecentAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, patientsResponse, appointmentsResponse, clinicResponse] = await Promise.all([
          usersAPI.getAll({ clinicId: user.clinicId }),
          patientsAPI.getAll({ clinicId: user.clinicId }),
          appointmentsAPI.getAll({ clinicId: user.clinicId }),
          clinicsAPI.getById(user.clinicId)
        ])

        if (clinicResponse.data.success) {
          setClinicInfo(clinicResponse.data.clinic)
        }

        if (usersResponse.data.success) {
          const users = usersResponse.data.users
          const doctors = users.filter(u => u.role === 'doctor')
          setStats(prev => ({
            ...prev,
            totalStaff: users.filter(u => u.role !== 'patient').length,
            activeDoctors: doctors.filter(d => d.isActive).length
          }))
        }

        if (patientsResponse.data.success) {
          setStats(prev => ({
            ...prev,
            totalPatients: patientsResponse.data.patients.length
          }))
        }

        if (appointmentsResponse.data.success) {
          const appointments = appointmentsResponse.data.appointments
          const today = new Date().toDateString()
          const todayAppointments = appointments.filter(apt => 
            new Date(apt.appointmentDate).toDateString() === today
          )
          const pendingAppointments = appointments.filter(apt => apt.status === 'scheduled')
          
          setStats(prev => ({
            ...prev,
            totalAppointments: appointments.length,
            todayAppointments: todayAppointments.length,
            pendingAppointments: pendingAppointments.length
          }))
          
          setRecentAppointments(appointments.slice(0, 5))
        }
      } catch (error) {
        toast.error('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    if (user.clinicId) {
      fetchData()
    }
  }, [user.clinicId])

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportDropdown && !event.target.closest('.export-dropdown')) {
        setShowExportDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportDropdown])

  // Export functions
  const exportToExcel = (data, filename, sheetName) => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      XLSX.writeFile(workbook, `${filename}.xlsx`)
      toast.success(`${filename} exported successfully!`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export data')
    }
  }

  const handleExportAppointments = async () => {
    setIsExporting(true)
    try {
      const response = await appointmentsAPI.getAll({ clinicId: user.clinicId })
      if (response.data.success) {
        const appointments = response.data.appointments
        const exportData = appointments.map(appointment => ({
          'Patient Name': appointment.patientName || 'N/A',
          'Doctor Name': appointment.doctorName || 'N/A',
          'Date': appointment.appointmentDate || new Date(appointment.createdAt).toLocaleDateString(),
          'Time': appointment.appointmentTime || 'Time TBD',
          'Status': appointment.status || 'Pending',
          'Created At': new Date(appointment.createdAt).toLocaleString()
        }))
        exportToExcel(exportData, 'appointments_list', 'Appointments')
      }
    } catch (error) {
      toast.error('Failed to fetch appointments data')
    } finally {
      setIsExporting(false)
      setShowExportDropdown(false)
    }
  }

  const handleExportPatients = async () => {
    setIsExporting(true)
    try {
      const response = await patientsAPI.getAll({ clinicId: user.clinicId })
      if (response.data.success) {
        const patients = response.data.patients
        const exportData = patients.map(patient => ({
          'Name': patient.fullName || (patient.firstName && patient.lastName ? `${patient.firstName} ${patient.lastName}` : 'Unknown'),
          'Email': patient.email || 'No email',
          'Phone': patient.phone || 'No phone',
          'Date of Birth': patient.dateOfBirth || 'Not provided',
          'Gender': patient.gender || 'Not specified',
          'Address': patient.address || 'No address',
          'Created At': new Date(patient.createdAt).toLocaleString()
        }))
        exportToExcel(exportData, 'patients_list', 'Patients')
      }
    } catch (error) {
      toast.error('Failed to fetch patients data')
    } finally {
      setIsExporting(false)
      setShowExportDropdown(false)
    }
  }

  const handleExportStaff = async () => {
    setIsExporting(true)
    try {
      const response = await usersAPI.getAll({ clinicId: user.clinicId })
      if (response.data.success) {
        const users = response.data.users
        const staff = users.filter(u => u.role !== 'patient')
        const exportData = staff.map(staffMember => ({
          'Name': staffMember.fullName || (staffMember.firstName && staffMember.lastName ? `${staffMember.firstName} ${staffMember.lastName}` : 'Unknown'),
          'Email': staffMember.email || 'No email',
          'Phone': staffMember.phone || 'No phone',
          'Role': staffMember.role || 'Staff',
          'Status': staffMember.isActive ? 'Active' : 'Inactive',
          'Created At': new Date(staffMember.createdAt).toLocaleString()
        }))
        exportToExcel(exportData, 'staff_list', 'Staff')
      }
    } catch (error) {
      toast.error('Failed to fetch staff data')
    } finally {
      setIsExporting(false)
      setShowExportDropdown(false)
    }
  }

  const handleExportDoctors = async () => {
    setIsExporting(true)
    try {
      const response = await usersAPI.getAll({ clinicId: user.clinicId })
      if (response.data.success) {
        const users = response.data.users
        const doctors = users.filter(u => u.role === 'doctor')
        const exportData = doctors.map(doctor => ({
          'Name': doctor.fullName || (doctor.firstName && doctor.lastName ? `${doctor.firstName} ${doctor.lastName}` : 'Dr. Unknown'),
          'Email': doctor.email || 'No email',
          'Phone': doctor.phone || 'No phone',
          'Specialty': doctor.specialization || doctor.specialty || 'General Medicine',
          'Status': doctor.isActive ? 'Active' : 'Inactive',
          'Created At': new Date(doctor.createdAt).toLocaleString()
        }))
        exportToExcel(exportData, 'doctors_list', 'Doctors')
      }
    } catch (error) {
      toast.error('Failed to fetch doctors data')
    } finally {
      setIsExporting(false)
      setShowExportDropdown(false)
    }
  }

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5 hover:shadow-card hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center">
        <div className={`p-3 rounded-xl text-white ${color} ring-4 ring-primary-50 shadow-soft`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="ml-4">
          <p className="text-xs font-medium text-gray-500">{title}</p>
          <p className="text-[22px] leading-tight font-bold text-gray-900">
            {loading ? '…' : value}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-900">
            {clinicInfo ? `${clinicInfo.name} Dashboard` : 'Clinic Dashboard'}
          </h1>
          <p className="text-sm text-gray-500">Manage your clinic operations efficiently</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Building2 className="h-4 w-4" />
            <span>Super Admin</span>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            className="bg-white/80 backdrop-blur text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-white transition-all flex items-center shadow-sm border border-gray-200"
          >
            <Activity className="h-4 w-4 mr-2" />
            Refresh Data
          </button>
          
          {/* Export Button with Dropdown */}
          <div className="relative export-dropdown">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              disabled={isExporting}
              className="bg-white/80 backdrop-blur text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-white transition-all flex items-center shadow-sm border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export Data
              <ChevronDown className="h-4 w-4 ml-2" />
            </button>
            
            {showExportDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="py-2">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    Export Lists
                  </div>
                  <button
                    onClick={handleExportAppointments}
                    disabled={isExporting}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-3 text-green-600" />
                    Appointments
                  </button>
                  <button
                    onClick={handleExportPatients}
                    disabled={isExporting}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-3 text-blue-600" />
                    Patients
                  </button>
                  <button
                    onClick={handleExportStaff}
                    disabled={isExporting}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-3 text-purple-600" />
                    Staff Members
                  </button>
                  <button
                    onClick={handleExportDoctors}
                    disabled={isExporting}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-3 text-indigo-600" />
                    Doctors
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2 bg-white/80 backdrop-blur px-3 py-2 rounded-lg shadow-sm border border-gray-200">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-700 font-medium">
              System Online
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Staff Members"
          value={stats.totalStaff}
          icon={Users}
          color="bg-primary-500"
        />
        <StatCard
          title="Total Patients"
          value={stats.totalPatients}
          icon={UserPlus}
          color="bg-green-500"
        />
        <StatCard
          title="Today's Appointments"
          value={stats.todayAppointments}
          icon={Clock}
          color="bg-blue-500"
        />
        <StatCard
          title="Active Doctors"
          value={stats.activeDoctors}
          icon={Stethoscope}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Clinic Overview</h3>
            <Settings className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Appointments</span>
              <span className="font-medium">{stats.totalAppointments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pending Appointments</span>
              <span className="font-medium text-orange-600">{stats.pendingAppointments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active Staff</span>
              <span className="font-medium text-green-600">{stats.totalStaff}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Clinic Status</span>
              <span className="font-medium text-green-600">Active</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Activity className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {recentAppointments.length > 0 ? (
              recentAppointments.map((appointment, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {appointment.patientName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(appointment.appointmentDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-4">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-2">
            <button className="w-full btn-primary text-left justify-start">
              <UserPlus className="h-4 w-4 mr-2" />
              Add New Patient
            </button>
            <button className="w-full btn-secondary text-left justify-start">
              <Users className="h-4 w-4 mr-2" />
              Manage Staff
            </button>
            <button className="w-full btn-secondary text-left justify-start">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Appointment
            </button>
            <button className="w-full btn-secondary text-left justify-start">
              <Settings className="h-4 w-4 mr-2" />
              Clinic Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SuperAdminDashboard