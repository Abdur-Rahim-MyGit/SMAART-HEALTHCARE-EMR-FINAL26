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
    <div className="card">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '...' : value}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
        <p className="text-gray-600">Manage your patients and appointments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Schedule</h3>
          <div className="space-y-3">
            {appointments.length > 0 ? (
              appointments.map((appointment) => (
                <div key={appointment._id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <Clock className="h-5 w-5 text-primary-500 mr-3" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {appointment.timeSlot.start} - Patient ID: {appointment.patientId?.patientId}
                    </p>
                    <p className="text-xs text-gray-500">{appointment.reason}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    appointment.status === 'completed' 
                      ? 'bg-green-100 text-green-800'
                      : appointment.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {appointment.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No appointments scheduled for today</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full btn-primary text-left justify-start">
              <Calendar className="h-4 w-4 mr-2" />
              View All Appointments
            </button>
            <button className="w-full btn-secondary text-left justify-start">
              <Users className="h-4 w-4 mr-2" />
              Patient Records
            </button>
            <button className="w-full btn-secondary text-left justify-start">
              <FileText className="h-4 w-4 mr-2" />
              Write Prescription
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DoctorDashboard