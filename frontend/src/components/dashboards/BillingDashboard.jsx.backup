import React from 'react'
import { CreditCard, DollarSign, FileText, Clock } from 'lucide-react'

const BillingDashboard = () => {
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
        <h1 className="text-3xl font-bold text-gray-900">Billing Dashboard</h1>
        <p className="text-gray-600">Manage payments and invoices</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value="$15,420"
          icon={DollarSign}
          color="bg-green-500"
        />
        <StatCard
          title="Pending Bills"
          value="8"
          icon={Clock}
          color="bg-yellow-500"
        />
        <StatCard
          title="Paid Today"
          value="$2,340"
          icon={CreditCard}
          color="bg-primary-500"
        />
        <StatCard
          title="Outstanding"
          value="$1,280"
          icon={FileText}
          color="bg-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <CreditCard className="h-5 w-5 text-green-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">PAT001234 - Consultation</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              <span className="text-sm font-medium text-green-600">$120</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-yellow-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">PAT001235 - Lab Tests</p>
                  <p className="text-xs text-gray-500">4 hours ago</p>
                </div>
              </div>
              <span className="text-sm font-medium text-yellow-600">Pending</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full btn-primary text-left justify-start">
              <FileText className="h-4 w-4 mr-2" />
              Create Invoice
            </button>
            <button className="w-full btn-secondary text-left justify-start">
              <CreditCard className="h-4 w-4 mr-2" />
              Process Payment
            </button>
            <button className="w-full btn-secondary text-left justify-start">
              <DollarSign className="h-4 w-4 mr-2" />
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BillingDashboard