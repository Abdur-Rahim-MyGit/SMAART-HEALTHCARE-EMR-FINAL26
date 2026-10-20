import React, { useState, useEffect } from 'react'
import { Users, Search, Plus, Edit, Trash2, Mail, Phone, Calendar, Shield, Clock, UserCheck, UserX, Building2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { usersAPI, clinicsAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

// EMR application users (backend roles: super_master_admin | clinic_admin).
const ROLE_LABELS = {
  super_master_admin: 'Super Admin',
  clinic_admin: 'Clinic Admin',
}

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'clinic_admin',
  clinicId: '',
  password: '',
}

const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : '—')

const StaffManagement = () => {
  const { user } = useAuth()
  const [staff, setStaff] = useState([])
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUsers()
    clinicsAPI
      .getAll()
      .then((res) => setClinics(res?.data?.clinics || []))
      .catch((err) => console.error('Error fetching clinics:', err))
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await usersAPI.getAll()
      setStaff(res?.data?.users || [])
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err.response?.data?.message || 'Failed to load users')
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (member = null) => {
    setEditing(member)
    setForm(
      member
        ? {
            ...emptyForm,
            firstName: member.firstName || '',
            lastName: member.lastName || '',
            email: member.email || '',
            phone: member.phone || '',
            role: member.role,
            clinicId: member.clinicId?._id || '',
          }
        : emptyForm
    )
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const payload = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim(),
        }
        if (form.password) payload.password = form.password
        await usersAPI.update(editing._id, payload)
        toast.success('User updated')
      } else {
        const payload = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim(),
          role: form.role,
          password: form.password,
        }
        if (form.role === 'clinic_admin') payload.clinicId = form.clinicId
        await usersAPI.create(payload)
        toast.success('User created')
      }
      setShowModal(false)
      fetchUsers()
    } catch (err) {
      console.error('Error saving user:', err)
      toast.error(err.response?.data?.message || 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (member) => {
    try {
      await usersAPI.update(member._id, { isActive: !member.isActive })
      toast.success(member.isActive ? 'User deactivated' : 'User activated')
      fetchUsers()
    } catch (err) {
      console.error('Error updating user status:', err)
      toast.error(err.response?.data?.message || 'Failed to update user')
    }
  }

  const handleDelete = async (member) => {
    if (!window.confirm(`Delete user ${member.fullName || member.email}? They will no longer be able to sign in.`)) return
    try {
      await usersAPI.delete(member._id)
      toast.success('User deleted')
      fetchUsers()
    } catch (err) {
      console.error('Error deleting user:', err)
      toast.error(err.response?.data?.message || 'Failed to delete user')
    }
  }

  const filteredStaff = staff.filter((member) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      !q ||
      (member.fullName || '').toLowerCase().includes(q) ||
      (member.email || '').toLowerCase().includes(q) ||
      (member.phone || '').toLowerCase().includes(q) ||
      (member.clinicId?.name || '').toLowerCase().includes(q)
    const matchesRole = filterRole === 'all' || member.role === filterRole
    const matchesStatus =
      filterStatus === 'all' || (filterStatus === 'active' ? member.isActive : !member.isActive)
    return matchesSearch && matchesRole && matchesStatus
  })

  const stats = {
    total: staff.length,
    active: staff.filter((s) => s.isActive).length,
    inactive: staff.filter((s) => !s.isActive).length,
    clinicAdmins: staff.filter((s) => s.role === 'clinic_admin').length,
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-white'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
          <Users className="h-8 w-8 mr-3 text-gray-700 dark:text-gray-300" />
          Staff / Users
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Manage EMR user accounts and access</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <UserCheck className="h-8 w-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Inactive</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.inactive}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Clinic Admins</p>
              <p className="text-2xl font-bold text-blue-600">{stats.clinicAdmins}</p>
            </div>
            <Shield className="h-8 w-8 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search by name, email, phone or clinic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-gray-500 focus:border-gray-500 bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          >
            <option value="all">All Roles</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            onClick={() => openModal()}
            className="bg-gray-900 text-white dark:text-gray-100 px-6 py-3 rounded-md hover:bg-gray-800 transition-colors flex items-center justify-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Users className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
            Users ({filteredStaff.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-black">
                <tr>
                  {['User', 'Contact', 'Role & Clinic', 'Activity', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredStaff.map((member) => {
                  const isSelf = member._id === (user?._id || user?.id)
                  return (
                    <tr key={member._id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="bg-gray-100 dark:bg-gray-800 h-10 w-10 rounded-full flex items-center justify-center">
                            <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{member.fullName || '—'}</div>
                            {member.username && (
                              <div className="text-xs text-gray-400">@{member.username}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white flex items-center mb-1">
                          <Mail className="h-4 w-4 mr-2 text-gray-600 dark:text-gray-400" />
                          {member.email}
                        </div>
                        {member.phone && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                            <Phone className="h-4 w-4 mr-2 text-gray-600 dark:text-gray-400" />
                            {member.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-medium ${member.role === 'super_master_admin' ? 'text-purple-600' : 'text-blue-600'}`}>
                          {ROLE_LABELS[member.role] || member.role}
                        </div>
                        {member.clinicId?.name && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                            <Building2 className="h-3 w-3 mr-1" />
                            {member.clinicId.name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-600 dark:text-gray-400" />
                          Created: {formatDate(member.createdAt)}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1">
                          <Clock className="h-4 w-4 mr-2 text-gray-600 dark:text-gray-400" />
                          Last Login: {formatDate(member.lastLogin)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            member.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openModal(member)}
                            title="Edit user"
                            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-lg transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {!isSelf && (
                            <>
                              <button
                                onClick={() => toggleActive(member)}
                                title={member.isActive ? 'Deactivate user' : 'Activate user'}
                                className="text-yellow-600 hover:text-yellow-800 p-2 hover:bg-yellow-50 rounded-lg transition-colors"
                              >
                                {member.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => handleDelete(member)}
                                title="Delete user"
                                className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredStaff.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No users found</h3>
            <p className="text-gray-600 dark:text-gray-400">{error || 'Try adjusting your search criteria or add a new user.'}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="bg-white dark:bg-gray-950 rounded-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editing ? 'Edit User' : 'Add User'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First name *</label>
                <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last name</label>
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
              </div>
              {!editing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role *</label>
                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  {form.role === 'clinic_admin' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clinic *</label>
                      <select required value={form.clinicId} onChange={(e) => setForm({ ...form, clinicId: e.target.value })} className={inputClass}>
                        <option value="">Select clinic</option>
                        {clinics.map((c) => (
                          <option key={c._id || c.id} value={c._id || c.id}>
                            {c.name || 'Unnamed Clinic'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {editing ? 'New password (leave blank to keep current)' : 'Password *'}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required={!editing}
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default StaffManagement
