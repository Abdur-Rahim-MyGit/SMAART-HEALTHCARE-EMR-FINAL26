import React, { useState, useEffect } from 'react'
import { Calendar, Users, Clock, FileText } from 'lucide-react'
import { appointmentsAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

const DoctorDashboard = () => {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [stats, setStats] = useState({
    todayAppointments: 0,
    totalPatients: 0,
    completedToday: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd')
        const response = await appointmentsAPI.getAll({ 
          doctorId: user.id,
          date: today 
        })

        if (response.data.success) {
          const todayAppts = response.data.appointments
          setAppointments(todayAppts)
          setStats({
            todayAppointments: todayAppts.length,
            totalPatients: new Set(todayAppts.map(apt => apt.patientId)).size,
            completedToday: todayAppts.filter(apt => apt.status === 'completed').length
          })
        }
      } catch (error) {
        toast.error('Failed to load appointments')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user.id])

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="card dark:bg-gray-950 dark:border dark:border-gray-800 p-4 sm:p-6">
      <div className="flex items-center">
        <div className={`p-2 sm:p-3 rounded-lg ${color} flex-shrink-0`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white dark:text-gray-100" />
        </div>
        <div className="ml-3 sm:ml-4 min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {loading ? '...' : value}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Doctor Dashboard</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Manage your patients and appointments</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <StatCard
          title="Today's Appointments"
          value={stats.todayAppointments}
          icon={Calendar}
          color="bg-primary-500"
        />
        <StatCard
          title="Patients Today"
          value={stats.totalPatients}
          icon={Users}
          color="bg-green-500"
        />
        <StatCard
          title="Completed"
          value={stats.completedToday}
          icon={FileText}
          color="bg-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card dark:bg-gray-950 dark:border dark:border-gray-800 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Today's Schedule</h3>
          <div className="space-y-2 sm:space-y-3">
            {appointments.length > 0 ? (
              appointments.map((appointment) => (
                <div key={appointment._id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 p-3 bg-gray-50 dark:bg-black rounded-lg">
                  <div className="flex items-center flex-1 min-w-0">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary-500 mr-2 sm:mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                        {appointment.timeSlot.start} - Patient ID: {appointment.patientId?.patientId}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{appointment.reason}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full flex-shrink-0 self-start sm:self-center ml-6 sm:ml-0 ${
                    appointment.status === 'completed' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : appointment.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {appointment.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No appointments scheduled for today</p>
              </div>
            )}
          </div>
        </div>

        <div className="card dark:bg-gray-950 dark:border dark:border-gray-800 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full btn-primary text-left justify-start text-sm sm:text-base py-2 sm:py-2.5">
              <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">View All Appointments</span>
            </button>
            <button className="w-full btn-secondary text-left justify-start text-sm sm:text-base py-2 sm:py-2.5">
              <Users className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">Patient Records</span>
            </button>
            <button className="w-full btn-secondary text-left justify-start text-sm sm:text-base py-2 sm:py-2.5">
              <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">Write Prescription</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DoctorDashboard