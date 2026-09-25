import axios from "axios";

// Same-origin by default (Vite dev proxy / nginx). Override with VITE_API_URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // refresh token travels in an httpOnly cookie
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401 try one silent refresh (rotating httpOnly cookie), then retry.
let refreshPromise = null;
const AUTH_PATHS = ["/auth/login", "/auth/clinic-login", "/auth/refresh", "/auth/request-login-otp", "/auth/verify-login-otp", "/auth/logout"];
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const isAuthCall = AUTH_PATHS.some((p) => (original.url || "").includes(p));
    if (status === 401 && !original._retried && !isAuthCall && localStorage.getItem("token")) {
      original._retried = true;
      try {
        refreshPromise = refreshPromise || axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true }).finally(() => { refreshPromise = null; });
        const { data } = await refreshPromise;
        if (data?.token) {
          localStorage.setItem("token", data.token);
          original.headers = { ...(original.headers || {}), Authorization: `Bearer ${data.token}` };
          return api(original);
        }
      } catch (_) {
        // fall through to logout
      }
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  clinicLogin: (data) => api.post("/auth/clinic-login", data),
  requestLoginOTP: (data) => api.post("/auth/request-login-otp", data),
  verifyLoginOTP: (data) => api.post("/auth/verify-login-otp", data),
  verifyOTP: (data) => api.post("/auth/verify-otp", data),
  requestPasswordReset: (data) => api.post("/auth/forgot-password", data),
  verifyResetOTP: (data) => api.post("/auth/verify-reset-otp", data),
  resetPassword: (data) => api.post("/auth/reset-password", data),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
  refresh: () => api.post("/auth/refresh"),
};

// Users API
export const usersAPI = {
  getAll: (params) => api.get("/users", { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Clinics API
export const clinicsAPI = {
  getAll: () => api.get("/clinics"),
  getById: (id) => api.get(`/clinics/${id}`),
  create: (data) => api.post("/clinics", data),
  update: (id, data) => api.put(`/clinics/${id}`, data),
  delete: (id) => api.delete(`/clinics/${id}`),
  getDashboardData: (id) => api.get(`/clinics/${id}/dashboard-data`),

  // Validity management
  getValidity: (id) => api.get(`/clinics/${id}/validity`),
  renewValidity: (id, data) => api.put(`/clinics/${id}/renew`, data),
  getExpiringSoon: (days = 30) => api.get(`/clinics/expiring/${days}`),
  getExpired: () => api.get("/clinics/expired/list"),

};

// Medical Images API
export const medicalImagesAPI = {
  getAll: (params) => api.get("/medical-images", { params }),
  getById: (id) => api.get(`/medical-images/${id}`),
  getByPatient: (patientId, params) => api.get(`/medical-images/patient/${patientId}`, { params }),
  create: (data) => api.post("/medical-images", data),
  update: (id, data) => api.put(`/medical-images/${id}`, data),
  delete: (id) => api.delete(`/medical-images/${id}`),
};

// Dashboard API
export const dashboardAPI = {
  getSuperMasterStats: () => api.get("/dashboard/super-master-stats"),
  getOverview: () => api.get("/dashboard/overview"),
  getAnalytics: (period = "30d") =>
    api.get(`/dashboard/analytics?period=${period}`),
  getSystemHealth: () => api.get("/dashboard/system-health"),
  getAlerts: () => api.get("/dashboard/alerts"),
};

// Patients API
export const patientsAPI = {
  getAll: (params) => api.get("/patients", { params }),
  getById: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post("/patients", data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),
  getCaseLogs: (patientId) => api.get(`/patients/${patientId}/case-logs`),
};

// Appointments API
export const appointmentsAPI = {
  getAll: (params) => api.get("/appointments", { params }),
  create: (data) => api.post("/appointments", data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
};

// Billing API
export const billingAPI = {
  getAll: (params) => api.get("/billing", { params }),
  create: (data) => api.post("/billing", data),
  update: (id, data) => api.put(`/billing/${id}`, data),
  getById: (id) => api.get(`/billing/${id}`),
};

// Invoices API
export const invoicesAPI = {
  getAll: (params) => api.get("/invoices", { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  getByPatient: (patientId) => api.get(`/invoices/patient/${patientId}`),
  create: (data) => api.post("/invoices", data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  getStats: () => api.get("/invoices/stats"),
};

// Doctors API
export const doctorsAPI = {
  getAll: (params) => api.get("/doctors", { params }),
  getById: (id) => api.get(`/doctors/${id}`),
  create: (data) => api.post("/doctors", data),
  update: (id, data) => api.put(`/doctors/${id}`, data),
  delete: (id) => api.delete(`/doctors/${id}`),
  getStats: () => api.get("/doctors/stats/overview"),
};

// Referrals API
export const referralsAPI = {
  getAll: (params) => api.get("/referrals", { params }),
  getById: (id) => api.get(`/referrals/${id}`),
  create: (data) => api.post("/referrals", data),
  update: (id, data) => api.put(`/referrals/${id}`, data),
  delete: (id) => api.delete(`/referrals/${id}`),
};

// Nurses API
export const nursesAPI = {
  getAll: (params) => api.get("/nurses", { params }),
  getById: (id) => api.get(`/nurses/${id}`),
  create: (data) => api.post("/nurses", data),
  update: (id, data) => api.put(`/nurses/${id}`, data),
  delete: (id) => api.delete(`/nurses/${id}`),
};

// Prescriptions API
export const prescriptionsAPI = {
  getAll: (params) => api.get("/prescriptions", { params }),
  getById: (id) => api.get(`/prescriptions/${id}`),
  create: (data) => api.post("/prescriptions", data),
  update: (id, data) => api.put(`/prescriptions/${id}`, data),
  delete: (id) => api.delete(`/prescriptions/${id}`),
  getByPatient: (patientId) => api.get(`/prescriptions/patient/${patientId}`),
  getByDoctor: (doctorId) => api.get(`/prescriptions/doctor/${doctorId}`),
  getStats: () => api.get("/prescriptions/stats"),
};

// Teleconsultations API
export const teleconsultationsAPI = {
  getAll: (params) => api.get("/teleconsultations", { params }),
  getById: (id) => api.get(`/teleconsultations/${id}`),
  create: (data) => api.post("/teleconsultations", data),
  update: (id, data) => api.put(`/teleconsultations/${id}`, data),
  delete: (id) => api.delete(`/teleconsultations/${id}`),
  getByPatient: (patientId) =>
    api.get(`/teleconsultations/patient/${patientId}`),
  getByDoctor: (doctorId) => api.get(`/teleconsultations/doctor/${doctorId}`),
  schedule: (data) => api.post("/teleconsultations/schedule", data),
  join: (id) => api.post(`/teleconsultations/${id}/join`),
  end: (id) => api.post(`/teleconsultations/${id}/end`),
  getStats: () => api.get("/teleconsultations/stats"),
};

// Consultations API
export const consultationsAPI = {
  getAll: (params) => api.get("/consultations", { params }),
  getById: (id) => api.get(`/consultations/${id}`),
  create: (data) => api.post("/consultations", data),
  update: (id, data) => api.put(`/consultations/${id}`, data),
  delete: (id) => api.delete(`/consultations/${id}`),
  getByPatient: (patientId) => api.get(`/consultations/patient/${patientId}`),
  getDiagnosesByPatient: (patientId) => api.get(`/consultations/patient/${patientId}/diagnoses`),
};

// Case Log API
export const caseLogAPI = {
  // System-wide activity log
  getSystemActivity: (params) =>
    api.get("/patientCaseLogs/system-activity", { params }),
  getLoginHistory: (params) =>
    api.get("/patientCaseLogs/login-history", { params }),
  getLiveActivity: () => api.get("/patientCaseLogs/live-activity"),

  // Patient-specific case logs
  getByPatient: (patientId) => api.get(`/patientCaseLogs/${patientId}`),
  getLoginHistoryByPatient: (patientId, params) =>
    api.get(`/patientCaseLogs/login-history/${patientId}`, { params }),
  getActivityByPatient: (patientId, params) =>
    api.get(`/patientCaseLogs/activity/${patientId}`, { params }),
  addActivity: (patientId, data) =>
    api.post(`/patientCaseLogs/activity/${patientId}`, data),

  // System monitoring
  getSystemHealth: () => api.get("/patientCaseLogs/system-health"),
  getActiveSessions: () => api.get("/patientCaseLogs/active-sessions"),
};

// Vitals API
export const vitalsAPI = {
  getAll: (params) => api.get("/vitals", { params }),
  getById: (id) => api.get(`/vitals/${id}`),
  create: (data) => api.post("/vitals", data),
  update: (id, data) => api.put(`/vitals/${id}`, data),
  delete: (id) => api.delete(`/vitals/${id}`),
  getByPatient: (patientId) => api.get(`/vitals/patient/${patientId}`),
};

// Lab Reports API
export const labReportsAPI = {
  getAll: (params) => api.get("/lab-reports", { params }),
  getById: (id) => api.get(`/lab-reports/${id}`),
  create: (data) => api.post("/lab-reports", data),
  update: (id, data) => api.put(`/lab-reports/${id}`, data),
  delete: (id) => api.delete(`/lab-reports/${id}`),
  getByPatient: (patientId, options) => api.get(`/lab-reports/patient/${patientId}`, { params: options }),
  getByClinic: (clinicId, options) => api.get(`/lab-reports/clinic/${clinicId}`, { params: options }),
  download: (id) => api.get(`/lab-reports/${id}/download`, { responseType: 'blob' }),
};

// Notifications API - Aggregates recent activity from all modules
export const notificationsAPI = {
  getRecent: async (limit = 10) => {
    try {
      // Fetch recent data from all modules in parallel
      const [appointments, patients, referrals, billing, consultations] = await Promise.allSettled([
        api.get('/appointments'),
        api.get('/patients'),
        api.get('/referrals'),
        api.get('/billing'),
        api.get('/consultations'),
      ]);

      const notifications = [];

      // Process appointments
      if (appointments.status === 'fulfilled' && appointments.value?.data?.appointments) {
        appointments.value.data.appointments.forEach(apt => {
          notifications.push({
            id: `apt-${apt._id}`,
            type: 'appointment',
            title: 'New Appointment',
            message: `${apt.patientId?.fullName || 'Patient'} - ${apt.appointmentType}`,
            time: apt.createdAt,
            color: 'blue',
            data: apt
          });
        });
      }

      // Process patients
      if (patients.status === 'fulfilled' && patients.value?.data?.patients) {
        patients.value.data.patients.forEach(patient => {
          notifications.push({
            id: `patient-${patient._id}`,
            type: 'patient',
            title: 'New Patient Registered',
            message: `${patient.fullName} added to system`,
            time: patient.createdAt,
            color: 'green',
            data: patient
          });
        });
      }

      // Process referrals
      if (referrals.status === 'fulfilled' && referrals.value?.data?.data) {
        referrals.value.data.data.forEach(referral => {
          notifications.push({
            id: `ref-${referral._id}`,
            type: 'referral',
            title: 'New Referral',
            message: `${referral.patientName} referred to ${referral.specialistName}`,
            time: referral.createdAt,
            color: 'purple',
            data: referral
          });
        });
      }

      // Process billing
      if (billing.status === 'fulfilled' && billing.value?.data?.billingRecords) {
        billing.value.data.billingRecords.forEach(bill => {
          notifications.push({
            id: `bill-${bill._id}`,
            type: 'billing',
            title: 'New Billing Record',
            message: `₹${bill.amount} - ${bill.description || 'Medical Service'}`,
            time: bill.createdAt,
            color: 'orange',
            data: bill
          });
        });
      }

      // Process consultations
      if (consultations.status === 'fulfilled' && consultations.value?.data?.consultations) {
        consultations.value.data.consultations.forEach(consult => {
          notifications.push({
            id: `consult-${consult._id}`,
            type: 'consultation',
            title: 'New Consultation',
            message: `${consult.patientId?.fullName || 'Patient'} consultation completed`,
            time: consult.createdAt,
            color: 'teal',
            data: consult
          });
        });
      }

      // Sort by time (most recent first) and limit
      notifications.sort((a, b) => new Date(b.time) - new Date(a.time));
      
      console.log('📬 Notifications fetched:', notifications.length);
      console.log('📬 Sample notification:', notifications[0]);
      
      return { success: true, data: notifications.slice(0, limit) };
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      return { success: false, data: [], error: error.message };
    }
  }
};

// Posts API
export const postAPI = {
  getAll: async (page = 1, limit = 20, filters = {}) => {
    const params = { page, limit, ...filters };
    const response = await api.get("/posts", { params });
    return response.data;
  },
  getStats: async () => {
    const response = await api.get("/posts/stats");
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/posts/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post("/posts", data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/posts/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/posts/${id}`);
    return response.data;
  },
  like: async (id) => {
    const response = await api.post(`/posts/${id}/like`);
    return response.data;
  },
  unlike: async (id) => {
    const response = await api.post(`/posts/${id}/unlike`);
    return response.data;
  },
  addComment: async (id, content) => {
    const response = await api.post(`/posts/${id}/comments`, { content });
    return response.data;
  }
};

export default api;
