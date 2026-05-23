import React, { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Save,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Bell,
  Shield,
  Database,
  Globe,
  Moon,
  Sun,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { usersAPI } from '../../services/api'

const Settings = () => {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [showPassword, setShowPassword] = useState(false)
  
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    appointmentReminders: true,
    systemAlerts: true,
    weeklyReports: false
  })

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: 30,
    loginAlerts: true
  })

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: theme === 'dark' ? Moon : Sun }
  ]

  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }))
  }

  const handleNotificationChange = (key) => {
    setNotificationSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSecurityChange = (key, value) => {
    setSecuritySettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSaveProfile = async () => {
    setLoading(true)
    try {
      // Validate password change if attempted
      if (profileData.newPassword) {
        if (profileData.newPassword !== profileData.confirmPassword) {
          toast.error('Passwords do not match')
          setLoading(false)
          return
        }
        if (profileData.newPassword.length < 6) {
          toast.error('Password must be at least 6 characters')
          setLoading(false)
          return
        }
      }

      // Update profile via API
      await usersAPI.update(user._id, {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone
      })

      toast.success('✅ Profile updated successfully!')
      
      // Clear password fields
      setProfileData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }))
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    try {
      // Save settings to backend or localStorage
      localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings))
      localStorage.setItem('securitySettings', JSON.stringify(securitySettings))
      
      toast.success('✅ Settings saved successfully!')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  // Load settings on mount
  useEffect(() => {
    const savedNotifications = localStorage.getItem('notificationSettings')
    const savedSecurity = localStorage.getItem('securitySettings')
    
    if (savedNotifications) {
      setNotificationSettings(JSON.parse(savedNotifications))
    }
    if (savedSecurity) {
      setSecuritySettings(JSON.parse(savedSecurity))
    }
  }, [])

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center">
              <SettingsIcon className="h-6 w-6 mr-3 text-[#004D99]" />
              Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your account settings and preferences
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-800">
          <nav className="flex space-x-8 px-6 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#004D99] text-[#004D99]'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-300 hover:border-gray-300 dark:border-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) => handleProfileChange('firstName', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) => handleProfileChange('lastName', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 dark:bg-gray-800 dark:text-gray-300 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => handleProfileChange('phone', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Change Password
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={profileData.currentPassword}
                        onChange={(e) => handleProfileChange('currentPassword', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent dark:bg-gray-900 dark:text-white pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      New Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={profileData.newPassword}
                      onChange={(e) => handleProfileChange('newPassword', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={profileData.confirmPassword}
                      onChange={(e) => handleProfileChange('confirmPassword', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="bg-[#004D99] text-white py-2 px-6 rounded-lg font-medium hover:bg-[#003d80] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Security Settings
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Add an extra layer of security</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securitySettings.twoFactorAuth}
                        onChange={(e) => handleSecurityChange('twoFactorAuth', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-950 after:border-gray-300 dark:border-gray-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-700 peer-checked:bg-[#004D99]"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Login Alerts</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Get notified of new login attempts</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securitySettings.loginAlerts}
                        onChange={(e) => handleSecurityChange('loginAlerts', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-950 after:border-gray-300 dark:border-gray-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-700 peer-checked:bg-[#004D99]"></div>
                    </label>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      value={securitySettings.sessionTimeout}
                      onChange={(e) => handleSecurityChange('sessionTimeout', parseInt(e.target.value))}
                      min="5"
                      max="120"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#004D99] focus:border-transparent dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  disabled={loading}
                  className="bg-[#004D99] text-white py-2 px-6 rounded-lg font-medium hover:bg-[#003d80] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Notification Preferences
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Email Notifications</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Receive updates via email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.emailNotifications}
                        onChange={() => handleNotificationChange('emailNotifications')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-950 after:border-gray-300 dark:border-gray-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-700 peer-checked:bg-[#004D99]"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Appointment Reminders</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Get reminded about upcoming appointments</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.appointmentReminders}
                        onChange={() => handleNotificationChange('appointmentReminders')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-950 after:border-gray-300 dark:border-gray-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-700 peer-checked:bg-[#004D99]"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">System Alerts</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Important system notifications</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.systemAlerts}
                        onChange={() => handleNotificationChange('systemAlerts')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-950 after:border-gray-300 dark:border-gray-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-700 peer-checked:bg-[#004D99]"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Weekly Reports</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Receive weekly activity summaries</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.weeklyReports}
                        onChange={() => handleNotificationChange('weeklyReports')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-950 after:border-gray-300 dark:border-gray-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-700 peer-checked:bg-[#004D99]"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  disabled={loading}
                  className="bg-[#004D99] text-white py-2 px-6 rounded-lg font-medium hover:bg-[#003d80] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Theme Preferences
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                        {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Currently using {theme} theme
                      </p>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className="bg-[#004D99] text-white py-2 px-4 rounded-lg font-medium hover:bg-[#003d80] transition-colors"
                    >
                      Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
                    </button>
                  </div>

                  <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 rounded-lg border border-blue-200 dark:border-gray-700">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                          Theme Applied Successfully
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300">
                          Your theme preference is automatically saved and will persist across sessions.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings
