import api from './api';

class SearchAPI {
  // Transform backend data to frontend search result format
  transformPatients(patients) {
    return patients.map(patient => ({
      id: `patient-${patient._id}`,
      type: 'patient',
      title: `${patient.firstName} ${patient.lastName}`,
      description: `Patient ID: ${patient.patientId} • ${patient.age} years • ${patient.gender}`,
      path: `/patients/${patient._id}`,
      category: 'Patients',
      data: patient,
      keywords: [
        patient.firstName?.toLowerCase(),
        patient.lastName?.toLowerCase(),
        patient.patientId?.toLowerCase(),
        patient.email?.toLowerCase(),
        patient.phone?.toLowerCase(),
        patient.bloodGroup?.toLowerCase(),
        'patient'
      ].filter(Boolean)
    }));
  }

  transformAppointments(appointments) {
    return appointments.map(appointment => ({
      id: `appointment-${appointment._id}`,
      type: 'appointment',
      title: `Appointment with ${appointment.patientId?.firstName} ${appointment.patientId?.lastName}`,
      description: `${appointment.type} • ${new Date(appointment.date).toLocaleDateString()} • ${appointment.status}`,
      path: `/appointments`,
      category: 'Appointments',
      data: appointment,
      keywords: [
        appointment.patientId?.firstName?.toLowerCase(),
        appointment.patientId?.lastName?.toLowerCase(),
        appointment.doctorId?.firstName?.toLowerCase(),
        appointment.doctorId?.lastName?.toLowerCase(),
        appointment.type?.toLowerCase(),
        appointment.status?.toLowerCase(),
        appointment.reason?.toLowerCase(),
        'appointment'
      ].filter(Boolean)
    }));
  }

  transformDoctors(doctors) {
    return doctors.map(doctor => ({
      id: `doctor-${doctor._id}`,
      type: 'doctor',
      title: `Dr. ${doctor.firstName} ${doctor.lastName}`,
      description: `${doctor.specialization} • ${doctor.email} • ${doctor.phone}`,
      path: `/doctors`,
      category: 'Doctors',
      data: doctor,
      keywords: [
        doctor.firstName?.toLowerCase(),
        doctor.lastName?.toLowerCase(),
        doctor.specialization?.toLowerCase(),
        doctor.email?.toLowerCase(),
        doctor.phone?.toLowerCase(),
        'doctor',
        'physician'
      ].filter(Boolean)
    }));
  }

  transformClinics(clinics) {
    return clinics.map(clinic => ({
      id: `clinic-${clinic._id}`,
      type: 'clinic',
      title: clinic.name,
      description: `${clinic.type} • ${clinic.city}, ${clinic.state} • ${clinic.phone}`,
      path: `/clinics`,
      category: 'Clinics',
      data: clinic,
      keywords: [
        clinic.name?.toLowerCase(),
        clinic.type?.toLowerCase(),
        clinic.city?.toLowerCase(),
        clinic.state?.toLowerCase(),
        clinic.ownerName?.toLowerCase(),
        'clinic',
        'hospital'
      ].filter(Boolean)
    }));
  }
  // Search across all data types using backend endpoint
  async globalSearch(query, filters = {}) {
    try {
      const response = await api.get('/search/global', {
        params: {
          q: query,
          ...filters
        }
      });

      const data = response.data;
      
      // Transform backend data to frontend format
      const searchResults = {
        patients: this.transformPatients(data.patients || []),
        appointments: this.transformAppointments(data.appointments || []),
        doctors: this.transformDoctors(data.doctors || []),
        clinics: this.transformClinics(data.clinics || [])
      };

      return searchResults;
    } catch (error) {
      console.error('Global search error:', error);
      // Fallback to individual searches if backend fails
      return this.fallbackGlobalSearch(query, filters);
    }
  }

  // Fallback method for when backend search fails
  async fallbackGlobalSearch(query, filters = {}) {
    try {
      const results = await Promise.allSettled([
        this.searchPatients(query, filters),
        this.searchAppointments(query, filters),
        this.searchDoctors(query, filters),
        this.searchClinics(query, filters)
      ]);

      return {
        patients: results[0].status === 'fulfilled' ? results[0].value : [],
        appointments: results[1].status === 'fulfilled' ? results[1].value : [],
        doctors: results[2].status === 'fulfilled' ? results[2].value : [],
        clinics: results[3].status === 'fulfilled' ? results[3].value : []
      };
    } catch (error) {
      console.error('Fallback search error:', error);
      return {
        patients: [],
        appointments: [],
        doctors: [],
        clinics: []
      };
    }
  }

  // Search patients
  async searchPatients(query, filters = {}) {
    try {
      const response = await api.get('/patients', {
        params: {
          search: query,
          ...filters
        }
      });
      
      return response.data.patients?.map(patient => ({
        id: `patient-${patient._id}`,
        type: 'patient',
        title: `${patient.firstName} ${patient.lastName}`,
        description: `Patient ID: ${patient.patientId} • ${patient.age} years • ${patient.gender}`,
        path: `/patients/${patient._id}`,
        category: 'Patients',
        data: patient,
        keywords: [
          patient.firstName?.toLowerCase(),
          patient.lastName?.toLowerCase(),
          patient.patientId?.toLowerCase(),
          patient.email?.toLowerCase(),
          patient.phone?.toLowerCase(),
          patient.bloodGroup?.toLowerCase(),
          'patient'
        ].filter(Boolean)
      })) || [];
    } catch (error) {
      console.error('Patient search error:', error);
      return [];
    }
  }

  // Search appointments
  async searchAppointments(query, filters = {}) {
    try {
      const response = await api.get('/appointments', {
        params: {
          search: query,
          ...filters
        }
      });
      
      return response.data.appointments?.map(appointment => ({
        id: `appointment-${appointment._id}`,
        type: 'appointment',
        title: `Appointment with ${appointment.patientId?.firstName} ${appointment.patientId?.lastName}`,
        description: `${appointment.type} • ${new Date(appointment.date).toLocaleDateString()} • ${appointment.status}`,
        path: `/appointments`,
        category: 'Appointments',
        data: appointment,
        keywords: [
          appointment.patientId?.firstName?.toLowerCase(),
          appointment.patientId?.lastName?.toLowerCase(),
          appointment.doctorId?.firstName?.toLowerCase(),
          appointment.doctorId?.lastName?.toLowerCase(),
          appointment.type?.toLowerCase(),
          appointment.status?.toLowerCase(),
          appointment.reason?.toLowerCase(),
          'appointment'
        ].filter(Boolean)
      })) || [];
    } catch (error) {
      console.error('Appointment search error:', error);
      return [];
    }
  }

  // Search doctors
  async searchDoctors(query, filters = {}) {
    try {
      const response = await api.get('/users', {
        params: {
          role: 'doctor',
          search: query,
          ...filters
        }
      });
      
      return response.data.users?.map(doctor => ({
        id: `doctor-${doctor._id}`,
        type: 'doctor',
        title: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        description: `${doctor.specialization} • ${doctor.email} • ${doctor.phone}`,
        path: `/doctors`,
        category: 'Doctors',
        data: doctor,
        keywords: [
          doctor.firstName?.toLowerCase(),
          doctor.lastName?.toLowerCase(),
          doctor.specialization?.toLowerCase(),
          doctor.email?.toLowerCase(),
          doctor.phone?.toLowerCase(),
          'doctor',
          'physician'
        ].filter(Boolean)
      })) || [];
    } catch (error) {
      console.error('Doctor search error:', error);
      return [];
    }
  }

  // Search clinics
  async searchClinics(query, filters = {}) {
    try {
      const response = await api.get('/clinics', {
        params: {
          search: query,
          ...filters
        }
      });
      
      return response.data.clinics?.map(clinic => ({
        id: `clinic-${clinic._id}`,
        type: 'clinic',
        title: clinic.name,
        description: `${clinic.type} • ${clinic.city}, ${clinic.state} • ${clinic.phone}`,
        path: `/clinics`,
        category: 'Clinics',
        data: clinic,
        keywords: [
          clinic.name?.toLowerCase(),
          clinic.type?.toLowerCase(),
          clinic.city?.toLowerCase(),
          clinic.state?.toLowerCase(),
          clinic.ownerName?.toLowerCase(),
          'clinic',
          'hospital'
        ].filter(Boolean)
      })) || [];
    } catch (error) {
      console.error('Clinic search error:', error);
      return [];
    }
  }

  // Quick search suggestions
  async getSearchSuggestions(query) {
    if (!query || query.length < 2) return [];

    try {
      const results = await this.globalSearch(query);
      const suggestions = [];

      // Add top 3 results from each category
      Object.entries(results).forEach(([category, items]) => {
        items.slice(0, 3).forEach(item => {
          suggestions.push({
            ...item,
            suggestion: true
          });
        });
      });

      return suggestions.slice(0, 10); // Limit to 10 suggestions
    } catch (error) {
      console.error('Search suggestions error:', error);
      return [];
    }
  }

  // Search within specific page data
  async searchPageData(page, query, filters = {}) {
    switch (page) {
      case 'patients':
        return this.searchPatients(query, filters);
      case 'appointments':
        return this.searchAppointments(query, filters);
      case 'doctors':
        return this.searchDoctors(query, filters);
      case 'clinics':
        return this.searchClinics(query, filters);
      default:
        return [];
    }
  }

  // Get recent searches (from localStorage)
  getRecentSearches() {
    try {
      const recent = localStorage.getItem('recentSearches');
      return recent ? JSON.parse(recent) : [];
    } catch (error) {
      return [];
    }
  }

  // Save search to recent searches
  saveRecentSearch(query) {
    try {
      const recent = this.getRecentSearches();
      const updated = [query, ...recent.filter(q => q !== query)].slice(0, 10);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  }

  // Clear recent searches
  clearRecentSearches() {
    try {
      localStorage.removeItem('recentSearches');
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  }
}

export default new SearchAPI();
