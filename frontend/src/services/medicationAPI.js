import axios from 'axios';

const API_BASE_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || 'http://localhost:5000/api';

// Create axios instance with default config
const medicationAPI = axios.create({
  baseURL: `${API_BASE_URL}/medications`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
medicationAPI.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
medicationAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Medication API endpoints
export const medicationsAPI = {
  // Get all medications for a clinic
  getAll: async (clinicId, params = {}) => {
    try {
      const response = await medicationAPI.get(`/clinic/${clinicId}`, { params });
      return {
        success: true,
        data: response.data,
        medications: response.data.medications || [],
        stats: response.data.stats || {}
      };
    } catch (error) {
      console.error('Error fetching medications:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch medications',
        medications: [],
        stats: {}
      };
    }
  },

  // Get medication by ID
  getById: async (id) => {
    try {
      const response = await medicationAPI.get(`/${id}`);
      return {
        success: true,
        data: response.data,
        medication: response.data.medication
      };
    } catch (error) {
      console.error('Error fetching medication:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch medication'
      };
    }
  },

  // Create new medication
  create: async (medicationData) => {
    try {
      const response = await medicationAPI.post('/', medicationData);
      return {
        success: true,
        data: response.data,
        medication: response.data.medication
      };
    } catch (error) {
      console.error('Error creating medication:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create medication'
      };
    }
  },

  // Update medication
  update: async (id, medicationData) => {
    try {
      const response = await medicationAPI.put(`/${id}`, medicationData);
      return {
        success: true,
        data: response.data,
        medication: response.data.medication
      };
    } catch (error) {
      console.error('Error updating medication:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update medication'
      };
    }
  },

  // Delete medication
  delete: async (id) => {
    try {
      const response = await medicationAPI.delete(`/${id}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error deleting medication:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete medication'
      };
    }
  },

  // Update stock
  updateStock: async (id, stockData) => {
    try {
      const response = await medicationAPI.patch(`/${id}/stock`, stockData);
      return {
        success: true,
        data: response.data,
        medication: response.data.medication
      };
    } catch (error) {
      console.error('Error updating stock:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update stock'
      };
    }
  },

  // Get low stock medications
  getLowStock: async (clinicId) => {
    try {
      const response = await medicationAPI.get(`/clinic/${clinicId}/low-stock`);
      return {
        success: true,
        data: response.data,
        medications: response.data.medications || []
      };
    } catch (error) {
      console.error('Error fetching low stock medications:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch low stock medications',
        medications: []
      };
    }
  },

  // Get expiring medications
  getExpiring: async (clinicId, days = 30) => {
    try {
      const response = await medicationAPI.get(`/clinic/${clinicId}/expiring`, {
        params: { days }
      });
      return {
        success: true,
        data: response.data,
        medications: response.data.medications || []
      };
    } catch (error) {
      console.error('Error fetching expiring medications:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch expiring medications',
        medications: []
      };
    }
  },

  // Get medications by category
  getByCategory: async (clinicId, category) => {
    try {
      const response = await medicationAPI.get(`/clinic/${clinicId}/category/${category}`);
      return {
        success: true,
        data: response.data,
        medications: response.data.medications || []
      };
    } catch (error) {
      console.error('Error fetching medications by category:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch medications by category',
        medications: []
      };
    }
  },

  // Search medications
  search: async (clinicId, searchParams) => {
    try {
      const response = await medicationAPI.get(`/clinic/${clinicId}/search`, {
        params: searchParams
      });
      return {
        success: true,
        data: response.data,
        medications: response.data.medications || []
      };
    } catch (error) {
      console.error('Error searching medications:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to search medications',
        medications: []
      };
    }
  },

  // Get medication statistics
  getStats: async (clinicId) => {
    try {
      const response = await medicationAPI.get(`/clinic/${clinicId}/stats`);
      return {
        success: true,
        data: response.data,
        stats: response.data.stats || {}
      };
    } catch (error) {
      console.error('Error fetching medication stats:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch medication stats',
        stats: {}
      };
    }
  },

  // Bulk operations
  bulkUpdate: async (updates) => {
    try {
      const response = await medicationAPI.patch('/bulk-update', { updates });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error bulk updating medications:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to bulk update medications'
      };
    }
  },

  // Import medications from CSV/Excel
  import: async (file, clinicId) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clinicId', clinicId);

      const response = await medicationAPI.post('/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error importing medications:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to import medications'
      };
    }
  },

  // Export medications to CSV/Excel
  export: async (clinicId, format = 'csv') => {
    try {
      const response = await medicationAPI.get(`/clinic/${clinicId}/export`, {
        params: { format },
        responseType: 'blob'
      });

      return {
        success: true,
        data: response.data,
        blob: response.data
      };
    } catch (error) {
      console.error('Error exporting medications:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to export medications'
      };
    }
  }
};

export default medicationsAPI;
