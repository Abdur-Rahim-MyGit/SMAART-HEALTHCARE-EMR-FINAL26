import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: `${API_BASE_URL}/consultant-dashboard`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const consultantDashboardAPI = {
  // Create new consultant session
  create: (sessionData) => api.post('/', sessionData),

  // Get all consultant sessions with filtering
  getAll: (params = {}) => api.get('/', { params }),

  // Get single consultant session by ID
  getById: (id) => api.get(`/${id}`),

  // Update consultant session
  update: (id, sessionData) => api.put(`/${id}`, sessionData),

  // Complete consultant session
  complete: (id) => api.patch(`/${id}/complete`),

  // Sign consultant session
  sign: (id, signatureData) => api.patch(`/${id}/sign`, { signatureData }),

  // Add medication to treatment plan
  addMedication: (id, medication) => api.post(`/${id}/medications`, medication),


  // Add referral
  addReferral: (id, referral) => api.post(`/${id}/referrals`, referral),

  // Get analytics summary
  getAnalytics: (params = {}) => api.get('/analytics/summary', { params }),

  // Delete consultant session
  delete: (id) => api.delete(`/${id}`),
};
