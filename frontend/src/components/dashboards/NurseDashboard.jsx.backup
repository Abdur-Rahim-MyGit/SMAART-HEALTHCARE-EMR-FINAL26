import React, { useState, useEffect } from 'react'
import { Users, Calendar, Activity, Heart, Building2, MapPin, Phone, Mail } from 'lucide-react'
import { nursesAPI, clinicsAPI } from '../../services/api'
import { toast } from 'react-hot-toast'

const NurseDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    nurses: [],
    clinicInfo: null,
    stats: {
      totalNurses: 0,
      activeNurses: 0,
      assignedPatients: 0,
      todayTasks: 0
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch nurses data
      const nursesResponse = await nursesAPI.getAll()
      let nursesData = []
      
      if (nursesResponse?.data?.success && nursesResponse.data.nurses) {
        nursesData = nursesResponse.data.nurses
      }

      // Get clinic information from the first nurse's clinic data
      let clinicInfo = null
      if (nursesData.length > 0 && nursesData[0].clinicId) {
        clinicInfo = nursesData[0].clinicId
      }

      // Calculate stats
      const activeNurses = nursesData.filter(nurse => nurse.isActive !== false).length
      
      setDashboardData({
        nurses: nursesData,
        clinicInfo: clinicInfo,
        stats: {
          totalNurses: nursesData.length,
          activeNurses: activeNurses,
          assignedPatients: nursesData.reduce((acc, nurse) => acc + (nurse.assignedPatients || 0), 0) || 12,
          todayTasks: 8 // This would come from a tasks API in real implementation
        }
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="card">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004D99]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Clinic Information */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nurse Dashboard</h1>
            <p className="text-gray-600">Patient care and clinical support</p>
          </div>
          
          {/* Clinic Information */}
          {dashboardData.clinicInfo && (
            <div className="bg-gradient-to-r from-[#004D99] to-[#42A89B] rounded-lg p-4 text-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{dashboardData.clinicInfo.name}</h3>
                  <div className="flex items-center text-sm text-white/80">
                    <MapPin className="h-3 w-3 mr-1" />
                    <span>{dashboardData.clinicInfo.address}</span>
                  </div>
                  {dashboardData.clinicInfo.phone && (
                    <div className="flex items-center text-sm text-white/80">
                      <Phone className="h-3 w-3 mr-1" />
                      <span>{dashboardData.clinicInfo.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Nurses"
          value={dashboardData.stats.totalNurses}
          icon={Users}
          color="bg-[#004D99]"
        />
        <StatCard
          title="Active Nurses"
          value={dashboardData.stats.activeNurses}
          icon={Activity}
          color="bg-green-500"
        />
        <StatCard
          title="Assigned Patients"
          value={dashboardData.stats.assignedPatients}
          icon={Calendar}
          color="bg-blue-500"
        />
        <StatCard
          title="Today's Tasks"
          value={dashboardData.stats.todayTasks}
          icon={Heart}
          color="bg-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Nurses */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-[#004D99]" />
            Recent Nurses
          </h3>
          <div className="space-y-3">
            {dashboardData.nurses.slice(0, 5).map((nurse, index) => (
              <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-gradient-to-r from-[#004D99] to-[#42A89B] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {nurse.firstName ? `${nurse.firstName[0]}${nurse.lastName?.[0] || ''}` : 'N'}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {nurse.firstName && nurse.lastName ? `${nurse.firstName} ${nurse.lastName}` : nurse.fullName || 'Unnamed Nurse'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {nurse.specialization || nurse.department || 'General Nursing'}
                  </p>
                  <div className="flex items-center text-xs text-gray-400 mt-1">
                    <Building2 className="h-3 w-3 mr-1" />
                    <span>{nurse.clinicId?.name || 'No Clinic Assigned'}</span>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${nurse.isActive !== false ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              </div>
            ))}
            {dashboardData.nurses.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No nurses found</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-[#004D99]" />
            Today's Tasks
          </h3>
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <Activity className="h-5 w-5 text-[#004D99] mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Record vital signs for Ward A</p>
                <p className="text-xs text-gray-500">8 patients remaining</p>
              </div>
            </div>
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <Heart className="h-5 w-5 text-red-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Medication rounds</p>
                <p className="text-xs text-gray-500">Due in 30 minutes</p>
              </div>
            </div>
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Patient assessments</p>
                <p className="text-xs text-gray-500">5 pending reviews</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Heart className="h-5 w-5 mr-2 text-[#004D99]" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            <button className="w-full bg-gradient-to-r from-[#004D99] to-[#42A89B] text-white py-2 px-4 rounded-lg text-sm font-medium hover:from-[#003d80] hover:to-[#3a7d92] transition-all flex items-center justify-center">
              <Activity className="h-4 w-4 mr-2" />
              Record Vitals
            </button>
            <button className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all flex items-center justify-center">
              <Users className="h-4 w-4 mr-2" />
              Patient Care Plans
            </button>
            <button className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all flex items-center justify-center">
              <Heart className="h-4 w-4 mr-2" />
              Medication Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NurseDashboard