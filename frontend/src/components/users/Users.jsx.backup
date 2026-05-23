import React, { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, User } from 'lucide-react'
import { usersAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'react-hot-toast'

const Users = () => {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const params = user.role === 'super_admin' ? { clinicId: user.clinicId } : {}
      const response = await usersAPI.getAll(params)
      if (response.data.success) {
        setUsers(response.data.users)
      }
    } catch (error) {
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(userItem => {
    const matchesSearch = 
      userItem.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userItem.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userItem.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === '' || userItem.role === roleFilter
    
    return matchesSearch && matchesRole
  })

  const getRoleBadgeColor = (role) => {
    const colors = {
      'super_master_admin': 'bg-purple-100 text-purple-800',
      'super_admin': 'bg-blue-100 text-blue-800',
      'doctor': 'bg-green-100 text-green-800',
      'nurse': 'bg-yellow-100 text-yellow-800',
      'billing_staff': 'bg-orange-100 text-orange-800',
      'pharmacy_staff': 'bg-pink-100 text-pink-800',
      'patient': 'bg-gray-100 text-gray-800'
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {user.role === 'super_admin' ? 'Staff Management' : 'Users'}
          </h1>
          <p className="text-gray-600">Manage system users and staff members</p>
        </div>
        <button className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </button>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search users..."
              className="form-input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="form-input w-48"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="doctor">Doctors</option>
            <option value="nurse">Nurses</option>
            <option value="billing_staff">Billing Staff</option>
            <option value="pharmacy_staff">Pharmacy Staff</option>
            {user.role === 'super_master_admin' && (
              <>
                <option value="super_admin">Super Admins</option>
                <option value="patient">Patients</option>
              </>
            )}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((userItem) => (
                <tr key={userItem._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="bg-primary-100 h-10 w-10 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-medium">
                          {userItem.firstName[0]}{userItem.lastName[0]}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {userItem.firstName} {userItem.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{userItem.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(userItem.role)}`}>
                      {userItem.role.replace('_', ' ').toUpperCase()}
                    </span>
                    {userItem.specialization && (
                      <div className="text-xs text-gray-500 mt-1">{userItem.specialization}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {userItem.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      userItem.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {userItem.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button className="text-primary-600 hover:text-primary-900">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500">
              {searchTerm || roleFilter ? 'Try adjusting your search filters.' : 'Get started by adding your first user.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Users