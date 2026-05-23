import api from './api';

class ClinicValidityAPI {
  // Get clinics expiring within specified days (default 30)
  async getExpiringSoon(days = 30) {
    try {
      const response = await api.get(`/clinics/expiring/${days}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching expiring clinics:', error);
      throw error;
    }
  }

  // Get all expired clinics
  async getExpired() {
    try {
      const response = await api.get('/clinics/expired/list');
      return response.data;
    } catch (error) {
      console.error('Error fetching expired clinics:', error);
      throw error;
    }
  }

  // Renew clinic validity
  async renewClinic(clinicId, renewalData) {
    try {
      const response = await api.put(`/clinics/${clinicId}/renew`, renewalData);
      return response.data;
    } catch (error) {
      console.error('Error renewing clinic:', error);
      throw error;
    }
  }

  // Get clinic validity status
  async getValidityStatus(clinicId) {
    try {
      const response = await api.get(`/clinics/${clinicId}/validity`);
      return response.data;
    } catch (error) {
      console.error('Error fetching clinic validity:', error);
      throw error;
    }
  }

  // Utility functions for validity calculations
  calculateEndDate(startDate, durationMonths) {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + parseInt(durationMonths));
    return end.toISOString().split('T')[0];
  }

  calculateDaysUntilExpiry(endDate) {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isExpired(endDate) {
    return new Date() > new Date(endDate);
  }

  isExpiringSoon(endDate, days = 30) {
    const daysUntilExpiry = this.calculateDaysUntilExpiry(endDate);
    return daysUntilExpiry <= days && daysUntilExpiry > 0;
  }

  getValidityStatus(clinic) {
    if (!clinic.validityPeriod) {
      return {
        status: 'unknown',
        message: 'Validity period not set',
        color: 'gray'
      };
    }

    const { endDate } = clinic.validityPeriod;
    const daysUntilExpiry = this.calculateDaysUntilExpiry(endDate);

    if (this.isExpired(endDate)) {
      return {
        status: 'expired',
        message: `Expired ${Math.abs(daysUntilExpiry)} days ago`,
        color: 'red',
        daysUntilExpiry
      };
    } else if (this.isExpiringSoon(endDate, 30)) {
      return {
        status: 'expiring',
        message: `Expires in ${daysUntilExpiry} days`,
        color: 'yellow',
        daysUntilExpiry
      };
    } else if (this.isExpiringSoon(endDate, 90)) {
      return {
        status: 'warning',
        message: `Expires in ${daysUntilExpiry} days`,
        color: 'orange',
        daysUntilExpiry
      };
    } else {
      return {
        status: 'active',
        message: `Valid for ${daysUntilExpiry} days`,
        color: 'green',
        daysUntilExpiry
      };
    }
  }

  formatValidityPeriod(clinic) {
    if (!clinic.validityPeriod) return 'Not set';
    
    const { startDate, endDate, duration } = clinic.validityPeriod;
    const start = new Date(startDate).toLocaleDateString();
    const end = new Date(endDate).toLocaleDateString();
    
    return `${start} - ${end} (${duration} months)`;
  }

  // Get renewal options
  getRenewalOptions() {
    return [
      { value: 12, label: '12 Months (1 Year)' },
      { value: 24, label: '24 Months (2 Years)' },
      { value: 36, label: '36 Months (3 Years)' },
      { value: 48, label: '48 Months (4 Years)' },
      { value: 60, label: '60 Months (5 Years)' }
    ];
  }

  // Validate validity period data
  validateValidityPeriod(startDate, endDate, duration) {
    const errors = {};

    if (!startDate) {
      errors.startDate = 'Start date is required';
    }

    if (!endDate) {
      errors.endDate = 'End date is required';
    }

    if (!duration) {
      errors.duration = 'Duration is required';
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end <= start) {
        errors.endDate = 'End date must be after start date';
      }

      // Check minimum 1 year duration
      const oneYearFromStart = new Date(start);
      oneYearFromStart.setFullYear(oneYearFromStart.getFullYear() + 1);
      
      if (end < oneYearFromStart) {
        errors.endDate = 'End date must be at least 1 year from start date';
      }
    }

    if (duration && parseInt(duration) < 12) {
      errors.duration = 'Minimum duration is 12 months';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Generate validity period summary for dashboard
  generateValiditySummary(clinics) {
    const summary = {
      total: clinics.length,
      active: 0,
      expiring: 0,
      expired: 0,
      warning: 0
    };

    clinics.forEach(clinic => {
      const status = this.getValidityStatus(clinic);
      summary[status.status]++;
    });

    return summary;
  }
}

export default new ClinicValidityAPI();
