import React, { useState, useEffect } from 'react'
import { 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  Activity, 
  Heart, 
  Pill, 
 
  UserCheck,
  Save,
  CheckCircle,
  Edit,
  Plus,
  Trash2
} from 'lucide-react'
import { consultantDashboardAPI } from '../../services/api'
import { toast } from 'react-hot-toast'

const ConsultantDashboard = () => {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await consultantDashboardAPI.getAll()
      if (response.data.success) {
        setSessions(response.data.sessions)
        if (response.data.sessions.length > 0) {
          setSelectedSession(response.data.sessions[0])
        }
      }
    } catch (error) {
      toast.error('Failed to fetch consultant sessions')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSession = async () => {
    try {
      const response = await consultantDashboardAPI.update(selectedSession._id, selectedSession)
      if (response.data.success) {
        toast.success('Session updated successfully')
        setIsEditing(false)
        fetchSessions()
      }
    } catch (error) {
      toast.error('Failed to update session')
    }
  }

  const handleCompleteSession = async () => {
    try {
      const response = await consultantDashboardAPI.complete(selectedSession._id)
      if (response.data.success) {
        toast.success('Session completed successfully')
        fetchSessions()
      }
    } catch (error) {
      toast.error('Failed to complete session')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">EMR - Consultant Dashboard</h1>
          <p className="text-gray-600">Electronic Medical Records & Consultation Management</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="btn-secondary"
          >
            <Edit className="h-4 w-4 mr-2" />
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
          {isEditing && (
            <button onClick={handleSaveSession} className="btn-primary">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </button>
          )}
          {selectedSession?.status === 'In Progress' && (
            <button onClick={handleCompleteSession} className="btn-success">
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Session
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Session List Sidebar */}
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Recent Sessions</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sessions.map((session) => (
                <div
                  key={session._id}
                  onClick={() => setSelectedSession(session)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedSession?._id === session._id
                      ? 'bg-blue-50 border-blue-200 border'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{session.patientId?.fullName}</p>
                      <p className="text-xs text-gray-500">{session.consultationType}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(session.sessionDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs ${
                      session.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      session.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {session.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
          {selectedSession ? (
            <div className="space-y-6">
              {/* Patient Header */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 h-16 w-16 rounded-full flex items-center justify-center">
                      <User className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{selectedSession.patientId?.fullName}</h2>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>Age: {selectedSession.patientId?.age || 'N/A'}</span>
                        <span>Gender: {selectedSession.patientId?.gender}</span>
                        <span>Phone: {selectedSession.patientId?.phone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Session ID</p>
                    <p className="font-mono text-sm">{selectedSession.sessionId}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(selectedSession.sessionDate).toLocaleDateString()} at {selectedSession.sessionTime}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="card">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8">
                    {[
                      { id: 'overview', label: 'Overview', icon: FileText },
                      { id: 'vitals', label: 'Vital Signs', icon: Activity },
                      { id: 'assessment', label: 'Assessment', icon: Heart },
                      { id: 'treatment', label: 'Treatment', icon: Pill },
                    ].map((tab) => {
                      const Icon = tab.icon
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                            activeTab === tab.id
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{tab.label}</span>
                        </button>
                      )
                    })}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold mb-3">Chief Complaint</h4>
                          {isEditing ? (
                            <textarea
                              value={selectedSession.chiefComplaint || ''}
                              onChange={(e) => setSelectedSession({
                                ...selectedSession,
                                chiefComplaint: e.target.value
                              })}
                              className="form-input w-full h-24"
                              placeholder="Enter chief complaint..."
                            />
                          ) : (
                            <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                              {selectedSession.chiefComplaint || 'No chief complaint recorded'}
                            </p>
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold mb-3">History of Present Illness</h4>
                          {isEditing ? (
                            <textarea
                              value={selectedSession.historyOfPresentIllness || ''}
                              onChange={(e) => setSelectedSession({
                                ...selectedSession,
                                historyOfPresentIllness: e.target.value
                              })}
                              className="form-input w-full h-24"
                              placeholder="Enter history of present illness..."
                            />
                          ) : (
                            <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                              {selectedSession.historyOfPresentIllness || 'No history recorded'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'vitals' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Blood Pressure', value: selectedSession.vitalSigns?.bloodPressure ? 
                          `${selectedSession.vitalSigns.bloodPressure.systolic}/${selectedSession.vitalSigns.bloodPressure.diastolic}` : 'N/A', unit: 'mmHg' },
                        { label: 'Heart Rate', value: selectedSession.vitalSigns?.heartRate || 'N/A', unit: 'bpm' },
                        { label: 'Temperature', value: selectedSession.vitalSigns?.temperature?.value || 'N/A', unit: '°F' },
                        { label: 'Respiratory Rate', value: selectedSession.vitalSigns?.respiratoryRate || 'N/A', unit: '/min' },
                        { label: 'Oxygen Saturation', value: selectedSession.vitalSigns?.oxygenSaturation || 'N/A', unit: '%' },
                        { label: 'Weight', value: selectedSession.vitalSigns?.weight?.value || 'N/A', unit: 'lbs' },
                        { label: 'Height', value: selectedSession.vitalSigns?.height?.value || 'N/A', unit: 'in' },
                        { label: 'BMI', value: selectedSession.vitalSigns?.bmi || 'N/A', unit: '' }
                      ].map((vital, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600">{vital.label}</p>
                          <p className="text-2xl font-bold text-gray-900">{vital.value}</p>
                          <p className="text-sm text-gray-500">{vital.unit}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'assessment' && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-3">Primary Diagnosis</h4>
                        {isEditing ? (
                          <input
                            type="text"
                            value={selectedSession.assessment?.primaryDiagnosis || ''}
                            onChange={(e) => setSelectedSession({
                              ...selectedSession,
                              assessment: {
                                ...selectedSession.assessment,
                                primaryDiagnosis: e.target.value
                              }
                            })}
                            className="form-input w-full"
                            placeholder="Enter primary diagnosis..."
                          />
                        ) : (
                          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                            {selectedSession.assessment?.primaryDiagnosis || 'No primary diagnosis recorded'}
                          </p>
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3">Secondary Diagnoses</h4>
                        <div className="space-y-2">
                          {selectedSession.assessment?.secondaryDiagnoses?.map((diagnosis, index) => (
                            <div key={index} className="bg-gray-50 p-3 rounded-lg">
                              {diagnosis}
                            </div>
                          )) || <p className="text-gray-500">No secondary diagnoses recorded</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'treatment' && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-3">Prescribed Medications</h4>
                        <div className="space-y-3">
                          {selectedSession.treatmentPlan?.medications?.map((med, index) => (
                            <div key={index} className="bg-gray-50 p-4 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{med.medicationName}</p>
                                  <p className="text-sm text-gray-600">
                                    {med.dosage} - {med.frequency}
                                  </p>
                                  {med.duration && (
                                    <p className="text-sm text-gray-500">Duration: {med.duration}</p>
                                  )}
                                </div>
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                                  {med.refills || 0} refills
                                </span>
                              </div>
                            </div>
                          )) || <p className="text-gray-500">No medications prescribed</p>}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Session Selected</h3>
              <p className="text-gray-500">Select a consultation session from the sidebar to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConsultantDashboard
