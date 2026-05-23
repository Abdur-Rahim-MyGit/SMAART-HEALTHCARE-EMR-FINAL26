import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
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

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const doctorService = {
  // Get all doctors with pagination and filters
  getDoctors: async (params = {}) => {
    try {
      const response = await api.get('/doctors', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch doctors');
    }
  },

  // Get doctor by ID
  getDoctorById: async (id) => {
    try {
      const response = await api.get(`/doctors/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch doctor');
    }
  },

  // Create new doctor
  createDoctor: async (doctorData) => {
    try {
      const response = await api.post('/doctors', doctorData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to create doctor');
    }
  },

  // Update doctor
  updateDoctor: async (id, doctorData) => {
    try {
      const response = await api.put(`/doctors/${id}`, doctorData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to update doctor');
    }
  },

  // Delete doctor (soft delete)
  deleteDoctor: async (id) => {
    try {
      const response = await api.delete(`/doctors/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to delete doctor');
    }
  },

  // Get doctor statistics
  getDoctorStats: async (params = {}) => {
    try {
      const response = await api.get('/doctors/stats/overview', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to fetch doctor statistics');
    }
  },

  // Search doctors
  searchDoctors: async (query, filters = {}) => {
    try {
      const params = {
        search: query,
        ...filters
      };
      const response = await api.get('/doctors', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to search doctors');
    }
  }
};

export default doctorService;
