import React from 'react'
import { Pill, Package, AlertTriangle, TrendingUp } from 'lucide-react'

const PharmacyDashboard = () => {
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
        <h1 className="text-3xl font-bold text-gray-900">Pharmacy Dashboard</h1>
        <p className="text-gray-600">Manage medications and inventory</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Prescriptions"
          value="24"
          icon={Pill}
          color="bg-primary-500"
        />
        <StatCard
          title="In Stock"
          value="156"
          icon={Package}
          color="bg-green-500"
        />
        <StatCard
          title="Low Stock"
          value="12"
          icon={AlertTriangle}
          color="bg-yellow-500"
        />
        <StatCard
          title="Dispensed Today"
          value="18"
          icon={TrendingUp}
          color="bg-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Prescriptions</h3>
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <Pill className="h-5 w-5 text-primary-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">RX001 - Amoxicillin 500mg</p>
                <p className="text-xs text-gray-500">Patient: PAT001234</p>
              </div>
            </div>
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <Pill className="h-5 w-5 text-primary-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">RX002 - Lisinopril 10mg</p>
                <p className="text-xs text-gray-500">Patient: PAT001235</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full btn-primary text-left justify-start">
              <Pill className="h-4 w-4 mr-2" />
              Dispense Medication
            </button>
            <button className="w-full btn-secondary text-left justify-start">
              <Package className="h-4 w-4 mr-2" />
              Check Inventory
            </button>
            <button className="w-full btn-secondary text-left justify-start">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Low Stock Alerts
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PharmacyDashboard