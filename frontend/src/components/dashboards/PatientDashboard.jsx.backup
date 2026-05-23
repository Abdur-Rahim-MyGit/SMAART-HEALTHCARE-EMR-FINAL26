import React from 'react'
import { Calendar, FileText, CreditCard, User } from 'lucide-react'

const PatientDashboard = () => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Patient Dashboard</h1>
        <p className="text-gray-600">Your healthcare information at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Upcoming Appointments"
          value="2"
          icon={Calendar}
          color="bg-primary-500"
        />
        <StatCard
          title="Medical Records"
          value="8"
          icon={FileText}
          color="bg-green-500"
        />
        <StatCard
          title="Pending Bills"
          value="1"
          icon={CreditCard}
          color="bg-yellow-500"
        />
        <StatCard
          title="Prescriptions"
          value="3"
          icon={User}
          color="bg-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Appointments</h3>
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-primary-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Dr. Smith - Cardiology</p>
                <p className="text-xs text-gray-500">Tomorrow at 10:00 AM</p>
              </div>
            </div>
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-primary-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Dr. Johnson - Follow-up</p>
                <p className="text-xs text-gray-500">Friday at 2:30 PM</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full btn-primary text-left justify-start">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <Calendar className="h-4 w-4 mr-2" />
                Live Appointments
              </div>
            </button>
            <button className="w-full btn-secondary text-left justify-start">
              <FileText className="h-4 w-4 mr-2" />
              View Medical Records
            </button>
            <button className="w-full btn-secondary text-left justify-start">
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Bills
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PatientDashboard