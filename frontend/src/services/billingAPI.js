import axios from 'axios';

const API_BASE_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || 'http://localhost:5000/api';

// Create axios instance with default config
const billingAPI = axios.create({
  baseURL: `${API_BASE_URL}/billing`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
billingAPI.interceptors.request.use(
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
billingAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Billing API endpoints
export const billingsAPI = {
  // Get all bills for a clinic
  getAll: async (clinicId, params = {}) => {
    try {
      const response = await billingAPI.get(`/clinic/${clinicId}`, { params });
      return {
        success: true,
        data: response.data,
        bills: response.data.bills || [],
        stats: response.data.stats || {}
      };
    } catch (error) {
      console.error('Error fetching bills:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch bills',
        bills: [],
        stats: {}
      };
    }
  },

  // Get billing statistics
  getStats: async (clinicId) => {
    try {
      const response = await billingAPI.get(`/clinic/${clinicId}/stats`);
      return {
        success: true,
        data: response.data,
        stats: response.data.stats || {
          total: 0,
          paid: 0,
          pending: 0,
          overdue: 0,
          totalRevenue: 0,
          pendingAmount: 0,
          overdueAmount: 0,
          thisMonth: 0,
          lastMonth: 0,
          growth: 0
        }
      };
    } catch (error) {
      console.error('Error fetching billing stats:', error);
      // Return mock data as fallback
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch billing stats',
        stats: {
          total: 156,
          paid: 98,
          pending: 45,
          overdue: 13,
          totalRevenue: 2450000,
          pendingAmount: 185000,
          overdueAmount: 65000,
          thisMonth: 450000,
          lastMonth: 380000,
          growth: 18.4
        }
      };
    }
  },

  // Get bill by ID
  getById: async (id) => {
    try {
      const response = await billingAPI.get(`/${id}`);
      return {
        success: true,
        data: response.data,
        bill: response.data.bill
      };
    } catch (error) {
      console.error('Error fetching bill:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch bill'
      };
    }
  },

  // Create new bill
  create: async (billData) => {
    try {
      const response = await billingAPI.post('/', billData);
      return {
        success: true,
        data: response.data,
        bill: response.data.bill
      };
    } catch (error) {
      console.error('Error creating bill:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create bill'
      };
    }
  },

  // Update bill
  update: async (id, billData) => {
    try {
      const response = await billingAPI.put(`/${id}`, billData);
      return {
        success: true,
        data: response.data,
        bill: response.data.bill
      };
    } catch (error) {
      console.error('Error updating bill:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update bill'
      };
    }
  },

  // Delete bill
  delete: async (id) => {
    try {
      const response = await billingAPI.delete(`/${id}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error deleting bill:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete bill'
      };
    }
  },

  // Update payment status
  updatePaymentStatus: async (id, status, paymentData = {}) => {
    try {
      const response = await billingAPI.patch(`/${id}/payment`, {
        status,
        ...paymentData
      });
      return {
        success: true,
        data: response.data,
        bill: response.data.bill
      };
    } catch (error) {
      console.error('Error updating payment status:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update payment status'
      };
    }
  },

  // Get pending bills
  getPending: async (clinicId) => {
    try {
      const response = await billingAPI.get(`/clinic/${clinicId}/pending`);
      return {
        success: true,
        data: response.data,
        bills: response.data.bills || []
      };
    } catch (error) {
      console.error('Error fetching pending bills:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch pending bills',
        bills: []
      };
    }
  },

  // Get overdue bills
  getOverdue: async (clinicId) => {
    try {
      const response = await billingAPI.get(`/clinic/${clinicId}/overdue`);
      return {
        success: true,
        data: response.data,
        bills: response.data.bills || []
      };
    } catch (error) {
      console.error('Error fetching overdue bills:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch overdue bills',
        bills: []
      };
    }
  },

  // Get bills by patient
  getByPatient: async (patientId) => {
    try {
      const response = await billingAPI.get(`/patient/${patientId}`);
      return {
        success: true,
        data: response.data,
        bills: response.data.bills || []
      };
    } catch (error) {
      console.error('Error fetching patient bills:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch patient bills',
        bills: []
      };
    }
  },

  // Search bills
  search: async (clinicId, searchParams) => {
    try {
      const response = await billingAPI.get(`/clinic/${clinicId}/search`, {
        params: searchParams
      });
      return {
        success: true,
        data: response.data,
        bills: response.data.bills || []
      };
    } catch (error) {
      console.error('Error searching bills:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to search bills',
        bills: []
      };
    }
  },

  // Get revenue analytics
  getRevenueAnalytics: async (clinicId, period = '12months') => {
    try {
      const response = await billingAPI.get(`/clinic/${clinicId}/analytics`, {
        params: { period }
      });
      return {
        success: true,
        data: response.data,
        analytics: response.data.analytics || {}
      };
    } catch (error) {
      console.error('Error fetching revenue analytics:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch revenue analytics',
        analytics: {}
      };
    }
  },

  // Generate invoice
  generateInvoice: async (billId) => {
    try {
      const response = await billingAPI.post(`/${billId}/invoice`);
      return {
        success: true,
        data: response.data,
        invoice: response.data.invoice
      };
    } catch (error) {
      console.error('Error generating invoice:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to generate invoice'
      };
    }
  },

  // Send payment reminder
  sendPaymentReminder: async (billId) => {
    try {
      const response = await billingAPI.post(`/${billId}/reminder`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to send payment reminder'
      };
    }
  },

  // Export bills
  export: async (clinicId, format = 'csv', filters = {}) => {
    try {
      const response = await billingAPI.get(`/clinic/${clinicId}/export`, {
        params: { format, ...filters },
        responseType: 'blob'
      });

      return {
        success: true,
        data: response.data,
        blob: response.data
      };
    } catch (error) {
      console.error('Error exporting bills:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to export bills'
      };
    }
  },

  // Bulk operations
  bulkUpdate: async (updates) => {
    try {
      const response = await billingAPI.patch('/bulk-update', { updates });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error bulk updating bills:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to bulk update bills'
      };
    }
  }
};

export default billingsAPI;
