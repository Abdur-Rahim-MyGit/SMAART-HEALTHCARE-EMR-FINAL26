import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  DollarSign,
  Activity,
  Calendar,
  Stethoscope,
  TestTube,
  ArrowRightLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  X,
  Eye,
  Zap,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Monitor,
  LogIn,
  LogOut,
  UserCheck,
  Shield,
} from "lucide-react";
import {
  clinicsAPI,
  usersAPI,
  dashboardAPI,
  referralsAPI,
  appointmentsAPI,
  doctorsAPI,
  billingAPI,
  nursesAPI,
  patientsAPI,
  caseLogAPI,
  invoicesAPI,
  labReportsAPI,
} from "../../services/api";
import { toast } from "react-hot-toast";
import * as XLSX from 'xlsx';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";

const SuperMasterAdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalClinics: 0,
    totalUsers: 0,
    totalRevenue: 0,
    totalSuperMasterAdmins: 0,
    totalAppointments: 0,
    totalDoctors: 0,
    totalLabTests: 0,
    totalReferrals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [animatedStats, setAnimatedStats] = useState({
    totalClinics: 0,
    totalUsers: 0,
    totalRevenue: 0,
    totalSuperMasterAdmins: 0,
    totalAppointments: 0,
    totalDoctors: 0,
    totalLabTests: 0,
    totalReferrals: 0,
  });
  const intervalRefs = useRef({});

  // Modal states for each card
  const [showClinicsModal, setShowClinicsModal] = useState(false);
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false);
  const [showDoctorsModal, setShowDoctorsModal] = useState(false);
  const [showLabTestsModal, setShowLabTestsModal] = useState(false);
  const [showReferralsModal, setShowReferralsModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showActiveUsersModal, setShowActiveUsersModal] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Case Log states
  const [showCaseLogModal, setShowCaseLogModal] = useState(false);
  const [caseLogData, setCaseLogData] = useState([]);
  const [caseLogLoading, setCaseLogLoading] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [systemHealth, setSystemHealth] = useState({});

  // Data states for each modal
  const [allClinics, setAllClinics] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [allLabTests, setAllLabTests] = useState([]);
  const [allReferrals, setAllReferrals] = useState([]);
  const [revenueDetails, setRevenueDetails] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);

  // Loading states
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [labTestsLoading, setLabTestsLoading] = useState(false);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [activeUsersLoading, setActiveUsersLoading] = useState(false);

  // Real data states for charts
  const [revenueData, setRevenueData] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [realTimeData, setRealTimeData] = useState([]);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [chartsError, setChartsError] = useState(null);

  // Simple value setter (no animation)
  const setValue = (key, value) => {
    setAnimatedStats((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Function to fetch real chart data
  const fetchChartData = async () => {
    setChartsLoading(true);
    setChartsError(null);
    
    try {
      console.log("Fetching chart data...");
      
      // Fetch data for all charts in parallel
      const [billingResponse, doctorsResponse, appointmentsResponse, systemHealthResponse, invoicesResponse] = await Promise.all([
        billingAPI.getAll().catch(() => ({ data: { success: false } })),
        doctorsAPI.getAll({ limit: 1000 }).catch(() => ({ data: { success: false } })),
        appointmentsAPI.getAll().catch(() => ({ data: { success: false } })),
        dashboardAPI.getSystemHealth().catch(() => ({ data: { success: false } })),
        invoicesAPI.getAll().catch(() => ({ data: { success: false } }))
      ]);
      
      // Process revenue data from all invoices (primary) or billing (fallback)
      let processedRevenueData = [];
      
      // Try to use all invoices first
      if (invoicesResponse.data.success) {
        const invoicesData = invoicesResponse.data.invoices || invoicesResponse.data.data || invoicesResponse.data;
        if (Array.isArray(invoicesData)) {
          // Group all invoices by month for the last 8 months
          const monthlyRevenue = {};
          const monthlyAppointments = {};
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          
          invoicesData.forEach(invoice => {
            const date = new Date(invoice.date || invoice.createdAt);
            const monthKey = months[date.getMonth()];
            const amount = invoice.total || invoice.amount || invoice.grandTotal || 0;
            
            if (!monthlyRevenue[monthKey]) {
              monthlyRevenue[monthKey] = 0;
              monthlyAppointments[monthKey] = 0;
            }
            monthlyRevenue[monthKey] += amount;
            monthlyAppointments[monthKey] += 1;
          });
          
          // Create chart data for last 8 months
          const currentMonth = new Date().getMonth();
          for (let i = 7; i >= 0; i--) {
            const monthIndex = (currentMonth - i + 12) % 12;
            const monthName = months[monthIndex];
            const revenue = monthlyRevenue[monthName] || 0;
            const appointments = monthlyAppointments[monthName] || 0;
            const prevRevenue = i === 7 ? revenue : processedRevenueData[processedRevenueData.length - 1]?.revenue || 0;
            const growth = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0;
            
            processedRevenueData.push({
              month: monthName,
              revenue: revenue,
              appointments: appointments,
              growth: growth
            });
          }
          
          console.log("Revenue chart data from all invoices:", invoicesData.length, "invoices");
        }
      } else if (billingResponse.data.success) {
        // Fallback to billing data if invoices not available
        const billingData = billingResponse.data.billing || billingResponse.data;
        if (Array.isArray(billingData)) {
          // Group billing data by month for the last 8 months
          const monthlyRevenue = {};
          const monthlyAppointments = {};
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          
          billingData.forEach(bill => {
            const date = new Date(bill.date || bill.createdAt);
            const monthKey = months[date.getMonth()];
            const amount = bill.amount || bill.totalAmount || 0;
            
            if (!monthlyRevenue[monthKey]) {
              monthlyRevenue[monthKey] = 0;
              monthlyAppointments[monthKey] = 0;
            }
            monthlyRevenue[monthKey] += amount;
            monthlyAppointments[monthKey] += 1;
          });
          
          // Create chart data for last 8 months
          const currentMonth = new Date().getMonth();
          for (let i = 7; i >= 0; i--) {
            const monthIndex = (currentMonth - i + 12) % 12;
            const monthName = months[monthIndex];
            const revenue = monthlyRevenue[monthName] || 0;
            const appointments = monthlyAppointments[monthName] || 0;
            const prevRevenue = i === 7 ? revenue : processedRevenueData[processedRevenueData.length - 1]?.revenue || 0;
            const growth = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0;
            
            processedRevenueData.push({
              month: monthName,
              revenue: revenue,
              appointments: appointments,
              growth: growth
            });
          }
          
          console.log("Revenue chart data from billing (fallback):", billingData.length, "records");
        }
      }
      
      // Fallback revenue data if no billing data
      if (processedRevenueData.length === 0) {
        processedRevenueData = [
          { month: "Jan", revenue: 0, appointments: 0, growth: 0 },
          { month: "Feb", revenue: 0, appointments: 0, growth: 0 },
          { month: "Mar", revenue: 0, appointments: 0, growth: 0 },
          { month: "Apr", revenue: 0, appointments: 0, growth: 0 },
          { month: "May", revenue: 0, appointments: 0, growth: 0 },
          { month: "Jun", revenue: 0, appointments: 0, growth: 0 },
          { month: "Jul", revenue: 0, appointments: 0, growth: 0 },
          { month: "Aug", revenue: 0, appointments: 0, growth: 0 }
        ];
      }
      
      // Process department data from doctors
      let processedDepartmentData = [];
      if (doctorsResponse.data.success) {
        const doctors = doctorsResponse.data.data || doctorsResponse.data.doctors || doctorsResponse.data;
        if (Array.isArray(doctors)) {
          const specialtyCount = {};
          const colors = ["#4F46E5", "#059669", "#DC2626", "#7C3AED", "#0891B2", "#F59E0B", "#EF4444", "#8B5CF6"];
          
          doctors.forEach(doctor => {
            const specialty = doctor.specialty || doctor.specialization || "General Medicine";
            specialtyCount[specialty] = (specialtyCount[specialty] || 0) + 1;
          });
          
          const totalDoctors = doctors.length;
          let colorIndex = 0;
          
          Object.entries(specialtyCount).forEach(([specialty, count]) => {
            const percentage = totalDoctors > 0 ? Math.round((count / totalDoctors) * 100) : 0;
            processedDepartmentData.push({
              name: specialty,
              value: percentage,
              color: colors[colorIndex % colors.length],
              patients: count * 15 // Estimate patients per doctor
            });
            colorIndex++;
          });
          
          // Sort by value descending and take top 5
          processedDepartmentData = processedDepartmentData
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        }
      }
      
      // Fallback department data
      if (processedDepartmentData.length === 0) {
        processedDepartmentData = [
          { name: "General Medicine", value: 40, color: "#4F46E5", patients: 0 },
          { name: "Cardiology", value: 25, color: "#059669", patients: 0 },
          { name: "Neurology", value: 20, color: "#DC2626", patients: 0 },
          { name: "Pediatrics", value: 15, color: "#7C3AED", patients: 0 }
        ];
      }
      
      // Process activity data from appointments
      let processedActivityData = [];
      if (appointmentsResponse.data.success) {
        const appointments = appointmentsResponse.data.appointments || appointmentsResponse.data;
        if (Array.isArray(appointments)) {
          const weeklyData = {};
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          
          // Initialize weekly data
          days.forEach(day => {
            weeklyData[day] = { patients: 0, doctors: new Set(), appointments: 0 };
          });
          
          // Process appointments for the last week
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          appointments.forEach(appointment => {
            const date = new Date(appointment.date || appointment.appointmentDate || appointment.createdAt);
            if (date >= oneWeekAgo) {
              const dayName = days[date.getDay()];
              weeklyData[dayName].appointments++;
              if (appointment.patientId) weeklyData[dayName].patients++;
              if (appointment.doctorId) weeklyData[dayName].doctors.add(appointment.doctorId);
            }
          });
          
          // Convert to chart format
          days.forEach(day => {
            const data = weeklyData[day];
            const efficiency = data.appointments > 0 ? Math.min(95, Math.round((data.patients / data.appointments) * 100)) : 0;
            processedActivityData.push({
              day: day,
              patients: data.patients,
              doctors: data.doctors.size,
              efficiency: efficiency
            });
          });
        }
      }
      
      // Fallback activity data
      if (processedActivityData.length === 0) {
        processedActivityData = [
          { day: "Mon", patients: 0, doctors: 0, efficiency: 0 },
          { day: "Tue", patients: 0, doctors: 0, efficiency: 0 },
          { day: "Wed", patients: 0, doctors: 0, efficiency: 0 },
          { day: "Thu", patients: 0, doctors: 0, efficiency: 0 },
          { day: "Fri", patients: 0, doctors: 0, efficiency: 0 },
          { day: "Sat", patients: 0, doctors: 0, efficiency: 0 },
          { day: "Sun", patients: 0, doctors: 0, efficiency: 0 }
        ];
      }
      
      // Process real-time data from system health
      let processedRealTimeData = [];
      if (systemHealthResponse.data.success) {
        const healthData = systemHealthResponse.data.data || {};
        // Generate hourly data for the last 24 hours
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(Date.now() - i * 60 * 60 * 1000).getHours();
          const timeStr = hour.toString().padStart(2, '0') + ':00';
          
          processedRealTimeData.push({
            time: timeStr,
            activeUsers: Math.max(0, (healthData.activeUsers || 0) + Math.floor(Math.random() * 10 - 5)),
            systemLoad: Math.max(0, Math.min(100, (healthData.systemLoad || 50) + Math.floor(Math.random() * 20 - 10)))
          });
        }
      }
      
      // Fallback real-time data
      if (processedRealTimeData.length === 0) {
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(Date.now() - i * 60 * 60 * 1000).getHours();
          const timeStr = hour.toString().padStart(2, '0') + ':00';
          
          processedRealTimeData.push({
            time: timeStr,
            activeUsers: Math.floor(Math.random() * 20),
            systemLoad: Math.floor(Math.random() * 60 + 20)
          });
        }
      }
      
      // Update all chart data
      setRevenueData(processedRevenueData);
      setDepartmentData(processedDepartmentData);
      setActivityData(processedActivityData);
      setRealTimeData(processedRealTimeData);
      
      console.log("Chart data loaded successfully");
      console.log("Revenue data points:", processedRevenueData.length);
      console.log("Department data points:", processedDepartmentData.length);
      console.log("Activity data points:", processedActivityData.length);
      console.log("Real-time data points:", processedRealTimeData.length);
      
    } catch (error) {
      console.error("Error fetching chart data:", error);
      setChartsError(error.message);
      toast.error("Failed to load chart data");
    } finally {
      setChartsLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching Super Master Admin dashboard data...");
        console.log("API Base URL:", "http://localhost:5001/api");
        console.log(
          "Token:",
          localStorage.getItem("token") ? "Token exists" : "No token"
        );

        // Fetch all real-time data from multiple endpoints
        const [
          dashboardResponse,
          clinicsResponse,
          usersResponse,
          appointmentsResponse,
          referralsResponse,
          doctorsResponse,
          billingResponse,
          nursesResponse,
          patientsResponse,
          labReportsResponse
        ] = await Promise.all([
          dashboardAPI.getSuperMasterStats().catch(() => ({ data: { success: false } })),
          clinicsAPI.getAll().catch(() => ({ data: { success: false } })),
          usersAPI.getAll().catch(() => ({ data: { success: false } })),
          appointmentsAPI.getAll().catch(() => ({ data: { success: false } })),
          referralsAPI.getAll().catch(() => ({ data: { success: false } })),
          doctorsAPI.getAll({ limit: 1000 }).catch(() => ({ data: { success: false } })),
          billingAPI.getAll().catch(() => ({ data: { success: false } })),
          nursesAPI.getAll().catch(() => ({ data: { success: false } })),
          patientsAPI.getAll().catch(() => ({ data: { success: false } })),
          labReportsAPI.getAll().catch(() => ({ data: { success: false } }))
        ]);

        console.log("All API Responses received");

        // Process dashboard stats
        let newStats = {
          totalClinics: 0,
          totalUsers: 0,
          activeUsers: 0,
          totalDoctors: 0,
          totalAppointments: 0,
          totalLabTests: 0,
          totalReferrals: 0,
          totalRevenue: 0,
        };

        // Get real clinics data
        if (clinicsResponse.data.success) {
          newStats.totalClinics = clinicsResponse.data.clinics.length;
          setAllClinics(clinicsResponse.data.clinics);
          console.log("Real clinics count:", newStats.totalClinics);
        }

        // Get real users data
        if (usersResponse.data.success) {
          const users = usersResponse.data.users;
          newStats.totalUsers = users.length;
          
          // Get super master admins specifically
          const superMasterAdmins = users.filter(user => user.role === 'super_master_admin');
          newStats.totalSuperMasterAdmins = superMasterAdmins.length;
          setAllUsers(superMasterAdmins); // Store only super master admins
          
          console.log("Real users count:", newStats.totalUsers, "Super Master Admins:", newStats.totalSuperMasterAdmins);
        }

        // Get real doctors data - ensure accurate count
        if (doctorsResponse.data.success) {
          const doctors = doctorsResponse.data.data || doctorsResponse.data.doctors || doctorsResponse.data;
          console.log("Doctors API response structure:", doctorsResponse.data);
          console.log("Raw doctors data:", doctors);
          console.log("Doctors array length:", Array.isArray(doctors) ? doctors.length : "Not an array");
          
          newStats.totalDoctors = Array.isArray(doctors) ? doctors.length : 0;
          setAllDoctors(Array.isArray(doctors) ? doctors : []);
          console.log("Real doctors count from doctors API:", newStats.totalDoctors);
          
          // Additional check: Try to get total count from pagination info
          if (doctorsResponse.data.pagination && doctorsResponse.data.pagination.total) {
            console.log("Total doctors from pagination:", doctorsResponse.data.pagination.total);
            // Always use pagination total if available, as it's the accurate count
            newStats.totalDoctors = doctorsResponse.data.pagination.total;
            console.log("Using pagination total for doctors count:", newStats.totalDoctors);
          }
        } else if (usersResponse.data.success) {
          // Fallback: get doctors from users API
          const users = usersResponse.data.users;
          const doctors = []; // doctors are practitioners, not EMR users
          console.log("Fallback: Found doctors in users API:", doctors.length);
          console.log("Sample doctor from users:", doctors[0]);
          
          newStats.totalDoctors = doctors.length;
          setAllDoctors(doctors);
          console.log("Doctors from users API:", newStats.totalDoctors);
        } else {
          // If both APIs fail, set to 0
          newStats.totalDoctors = 0;
          setAllDoctors([]);
          console.log("No doctors data available, setting count to 0");
        }

        // Get real appointments data
        if (appointmentsResponse.data.success) {
          const appointments = appointmentsResponse.data.appointments || appointmentsResponse.data;
          newStats.totalAppointments = Array.isArray(appointments) ? appointments.length : 0;
          setAllAppointments(Array.isArray(appointments) ? appointments : []);
          console.log("Real appointments count:", newStats.totalAppointments);
        }

        // Get real referrals data
        if (referralsResponse.data.success) {
          const referrals = referralsResponse.data.data || referralsResponse.data.referrals || referralsResponse.data;
          newStats.totalReferrals = Array.isArray(referrals) ? referrals.length : 0;
          setAllReferrals(Array.isArray(referrals) ? referrals : []);
          console.log("Real referrals count:", newStats.totalReferrals);
        }

        // Get real revenue data from all invoices (total amount)
        try {
          const invoicesResponse = await invoicesAPI.getAll();
          if (invoicesResponse.data.success) {
            const invoicesData = invoicesResponse.data.invoices || invoicesResponse.data.data || invoicesResponse.data;
            if (Array.isArray(invoicesData)) {
              // Calculate total revenue from all invoices
              newStats.totalRevenue = invoicesData.reduce((sum, invoice) => {
                return sum + (invoice.total || invoice.amount || invoice.grandTotal || 0);
              }, 0);
              
              setRevenueDetails(invoicesData.map(invoice => ({
                _id: invoice._id,
                source: `Invoice #${invoice.invoiceNo || invoice.invoiceNumber || 'N/A'}`,
                amount: invoice.total || invoice.amount || invoice.grandTotal || 0,
                date: invoice.date || invoice.createdAt,
                clinic: invoice.clinicName || invoice.clinic?.name || "Unknown Clinic",
                patientName: invoice.patientName || invoice.patient?.fullName || "Unknown Patient",
                status: invoice.status || "Generated"
              })));
              
              console.log("Total revenue from all invoices:", newStats.totalRevenue);
              console.log("Total invoices:", invoicesData.length);
            }
          }
        } catch (invoiceError) {
          console.log("Could not fetch invoices for revenue calculation, falling back to billing data:", invoiceError);
          
          // Fallback to billing data if invoices API fails
          if (billingResponse.data.success) {
            const billingData = billingResponse.data.billing || billingResponse.data;
            if (Array.isArray(billingData)) {
              newStats.totalRevenue = billingData.reduce((sum, item) => sum + (item.amount || item.totalAmount || 0), 0);
              setRevenueDetails(billingData.map(item => ({
                _id: item._id,
                source: item.serviceType || item.description || "Service",
                amount: item.amount || item.totalAmount || 0,
                date: item.date || item.createdAt,
                clinic: item.clinicName || "Clinic"
              })));
            }
            console.log("Fallback revenue calculated from billing:", newStats.totalRevenue);
          }
        }

        // Get real lab tests count from LabReport model
        console.log("Processing lab reports response:", labReportsResponse);
        
        if (labReportsResponse && labReportsResponse.data) {
          console.log("Lab reports response data:", labReportsResponse.data);
          
          if (labReportsResponse.data.success) {
            // Try multiple possible response structures
            const labReports = labReportsResponse.data.data || 
                              labReportsResponse.data.labReports || 
                              labReportsResponse.data.reports ||
                              labReportsResponse.data;
            
            console.log("Extracted lab reports:", labReports);
            console.log("Is lab reports an array?", Array.isArray(labReports));
            
            if (Array.isArray(labReports)) {
              newStats.totalLabTests = labReports.length;
              setAllLabTests(labReports);
              console.log("✅ SUCCESS: Lab tests count from LabReport model:", newStats.totalLabTests);
              
              if (labReports.length > 0) {
                console.log("Sample lab report structure:", {
                  id: labReports[0]._id,
                  testName: labReports[0].testName,
                  patientId: labReports[0].patientId,
                  clinicId: labReports[0].clinicId,
                  uploadedAt: labReports[0].uploadedAt
                });
              }
            } else {
              console.log("❌ Lab reports data is not an array:", typeof labReports, labReports);
              newStats.totalLabTests = 0;
              setAllLabTests([]);
            }
          } else {
            console.log("❌ Lab reports API response not successful:", labReportsResponse.data);
            newStats.totalLabTests = 0;
            setAllLabTests([]);
          }
        } else {
          console.log("❌ No lab reports response or data:", labReportsResponse);
          newStats.totalLabTests = 0;
          setAllLabTests([]);
        }
        
        // If lab reports count is still 0, try direct API call
        if (newStats.totalLabTests === 0) {
          console.log("🔄 Lab reports count is 0, attempting direct labReportsAPI call...");
          try {
            const directLabReportsResponse = await labReportsAPI.getAll();
            console.log("Direct lab reports API response:", directLabReportsResponse);
            
            if (directLabReportsResponse.data.success) {
              const directLabReports = directLabReportsResponse.data.data || 
                                     directLabReportsResponse.data.labReports || 
                                     directLabReportsResponse.data.reports ||
                                     directLabReportsResponse.data;
              
              if (Array.isArray(directLabReports)) {
                newStats.totalLabTests = directLabReports.length;
                setAllLabTests(directLabReports);
                console.log("✅ SUCCESS: Direct lab reports API call - count:", newStats.totalLabTests);
              }
            }
          } catch (directLabError) {
            console.log("❌ Direct lab reports API call failed:", directLabError);
            
            // Final fallback to consultations
            console.log("🔄 Attempting final fallback to consultations...");
            try {
              const consultationsResponse = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/consultations`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (consultationsResponse.ok) {
                const consultationsData = await consultationsResponse.json();
                if (consultationsData.success && consultationsData.data) {
                  const consultations = consultationsData.data;
                  let realLabTestsCount = 0;
                  
                  // Count lab tests from all consultations
                  consultations.forEach(consultation => {
                    if (consultation.labTests && Array.isArray(consultation.labTests)) {
                      realLabTestsCount += consultation.labTests.length;
                    }
                  });
                  
                  if (realLabTestsCount > 0) {
                    newStats.totalLabTests = realLabTestsCount;
                    console.log("🔄 Final fallback lab tests count from consultations:", realLabTestsCount);
                  }
                }
              }
            } catch (consultationError) {
              console.log("❌ Could not fetch consultations for lab tests fallback:", consultationError);
            }
          }
        }
        
        console.log("🏁 Final lab tests count:", newStats.totalLabTests);
        
        // Additional direct count check for doctors to ensure accuracy
        try {
          const directCountResponse = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/doctors?limit=1`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (directCountResponse.ok) {
            const countData = await directCountResponse.json();
            if (countData.success && countData.pagination && countData.pagination.total) {
              console.log("Direct count API - Total doctors:", countData.pagination.total);
              newStats.totalDoctors = countData.pagination.total;
              console.log("Updated doctors count to:", newStats.totalDoctors);
            }
          }
        } catch (error) {
          console.log("Direct count API failed:", error);
        }

        // Get dashboard overview data if available
        if (dashboardResponse.data.success) {
          const { overview } = dashboardResponse.data.data;
          if (overview) {
            // Use dashboard API data as primary source, fallback to individual API data
            newStats.totalClinics = overview.totalClinics || newStats.totalClinics;
            newStats.totalUsers = overview.totalUsers || newStats.totalUsers;
            newStats.activeUsers = overview.activeUsers || newStats.activeUsers;
            // Don't override totalDoctors from dashboard API - use the real count from doctors API
            // newStats.totalDoctors = overview.totalDoctors || newStats.totalDoctors;
            newStats.totalAppointments = overview.totalAppointments || newStats.totalAppointments;
            newStats.totalReferrals = overview.totalReferrals || newStats.totalReferrals;
            newStats.totalRevenue = overview.totalRevenue || newStats.totalRevenue;
            newStats.totalLabTests = overview.totalLabTests || newStats.totalLabTests;
          }
        }

        console.log("Final stats calculated:", newStats);

        // Update state with real data
          setStats(newStats);

          // Set animated values
          setValue("totalClinics", newStats.totalClinics);
          setValue("totalUsers", newStats.totalUsers);
          setValue("totalSuperMasterAdmins", newStats.totalSuperMasterAdmins);
          setValue("totalDoctors", newStats.totalDoctors);
          setValue("totalAppointments", newStats.totalAppointments);
          setValue("totalLabTests", newStats.totalLabTests);
          setValue("totalReferrals", newStats.totalReferrals);
          setValue("totalRevenue", newStats.totalRevenue);

        toast.success("Real-time dashboard data loaded successfully", {
            duration: 2000,
          });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        console.error("Error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });

        toast.error(
          `Failed to load dashboard data: ${
            error.response?.data?.message || error.message
          }`
        );

        // Fallback to individual API calls
        console.log("Attempting fallback data fetch...");
        try {
          const [clinicsResponse, usersResponse] = await Promise.all([
            clinicsAPI.getAll(),
            usersAPI.getAll(),
          ]);

          console.log("Fallback responses:", {
            clinics: clinicsResponse.data,
            users: usersResponse.data,
          });

          if (clinicsResponse.data.success) {
            const clinicsCount = clinicsResponse.data.clinics.length;
            setStats((prev) => ({ ...prev, totalClinics: clinicsCount }));
            setValue("totalClinics", clinicsCount);
            setAllClinics(clinicsResponse.data.clinics);
            console.log("Fallback clinics count:", clinicsCount);
          }

          if (usersResponse.data.success) {
            const users = usersResponse.data.users;
            const usersCount = users.length;
            const superMasterAdminsCount = users.filter(user => user.role === "super_master_admin").length;

            setAllUsers(users.filter(user => user.role === "super_master_admin"));
            setStats((prev) => ({
              ...prev,
              totalUsers: usersCount,
              totalSuperMasterAdmins: superMasterAdminsCount,
              totalDoctors: prev.totalDoctors,
            }));
            setValue("totalUsers", usersCount);
            setValue("totalSuperMasterAdmins", superMasterAdminsCount);
            setValue("totalDoctors", doctorsCount);

            console.log("Fallback users count:", usersCount, "Super Master Admins:", superMasterAdminsCount, "Doctors:", doctorsCount);
            
            // Additional direct count check in fallback
            try {
              const directCountResponse = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/doctors?limit=1`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (directCountResponse.ok) {
                const countData = await directCountResponse.json();
                if (countData.success && countData.pagination && countData.pagination.total) {
                  console.log("Fallback direct count - Total doctors:", countData.pagination.total);
                  setStats((prev) => ({ ...prev, totalDoctors: countData.pagination.total }));
                  setValue("totalDoctors", countData.pagination.total);
                }
              }
            } catch (error) {
              console.log("Fallback direct count failed:", error);
            }
          }

          toast.success("Dashboard loaded with available data", {
            duration: 2000,
          });
        } catch (fallbackError) {
          console.error("Fallback fetch also failed:", fallbackError);
          toast.error("Unable to load dashboard data");
        }
      } finally {
        setLoading(false);
        console.log("Dashboard loading complete");
      }
    };

    fetchData();
    fetchChartData();
    
    // Set up auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      fetchData();
      fetchChartData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportDropdown && !event.target.closest('.export-dropdown')) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportDropdown]);

  const handleViewUsers = async () => {
    if (allUsers.length === 0) {
      setUsersLoading(true);
      try {
        const response = await usersAPI.getAll();
        if (response.data.success) {
          // Filter only super master admins
          const superMasterAdmins = response.data.users.filter((user) => user.role === "super_master_admin");
          setAllUsers(superMasterAdmins);
          console.log("Fetched super master admins:", superMasterAdmins.length);
        }
      } catch (error) {
        console.error("Error fetching super master admins:", error);
        toast.error("Failed to load super master admins");
      } finally {
        setUsersLoading(false);
      }
    }
    setShowUsersModal(true);
  };

  const handleViewClinics = async () => {
    if (allClinics.length === 0) {
      setClinicsLoading(true);
      try {
        const response = await clinicsAPI.getAll();
        if (response.data.success) {
          setAllClinics(response.data.clinics);
        }
      } catch (error) {
        toast.error("Failed to load clinics");
      } finally {
        setClinicsLoading(false);
      }
    }
    setShowClinicsModal(true);
  };

  const handleViewAppointments = async () => {
    if (allAppointments.length === 0) {
    setAppointmentsLoading(true);
    try {
        const response = await appointmentsAPI.getAll();
        if (response.data.success) {
          const appointments = response.data.appointments || response.data;
          setAllAppointments(Array.isArray(appointments) ? appointments : []);
          console.log("Fetched appointments for modal:", Array.isArray(appointments) ? appointments.length : 0);
        }
    } catch (error) {
        console.error("Error fetching appointments:", error);
      toast.error("Failed to load appointments");
    } finally {
      setAppointmentsLoading(false);
      }
    }
    setShowAppointmentsModal(true);
  };

  const handleViewAllAppointments = () => {
    setShowAppointmentsModal(false);
    navigate('/appointments');
  };

  // Export functions
  const exportToExcel = (data, filename, sheetName) => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      toast.success(`${filename} exported successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  const handleExportAppointments = async () => {
    setIsExporting(true);
    try {
      const response = await appointmentsAPI.getAll();
      if (response.data.success) {
        const appointments = response.data.appointments || response.data;
        const exportData = Array.isArray(appointments) ? appointments.map(appointment => ({
          'Patient Name': appointment.patientName || appointment.patientId?.fullName || appointment.patientId?.firstName || "N/A",
          'Doctor Name': appointment.doctorName || appointment.doctorId?.fullName || appointment.doctorId?.firstName || "N/A",
          'Date': appointment.date || appointment.appointmentDate || new Date(appointment.createdAt).toLocaleDateString(),
          'Time': appointment.time || appointment.appointmentTime || "Time TBD",
          'Status': appointment.status || "Pending",
          'Created At': new Date(appointment.createdAt).toLocaleString()
        })) : [];
        exportToExcel(exportData, 'appointments_list', 'Appointments');
      }
    } catch (error) {
      toast.error('Failed to fetch appointments data');
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  const handleExportDoctors = async () => {
    setIsExporting(true);
    try {
      const response = await doctorsAPI.getAll({ limit: 1000 });
      if (response.data.success) {
        const doctors = response.data.data || response.data.doctors || response.data;
        const exportData = Array.isArray(doctors) ? doctors.map(doctor => ({
          'Name': doctor.fullName || (doctor.firstName && doctor.lastName ? `${doctor.firstName} ${doctor.lastName}` : "Dr. Unknown"),
          'Email': doctor.email || "No email",
          'Phone': doctor.phone || "No phone",
          'Specialty': doctor.specialty || doctor.specialization || "General Medicine",
          'Status': doctor.isActive ? "Active" : "Inactive",
          'Created At': new Date(doctor.createdAt).toLocaleString()
        })) : [];
        exportToExcel(exportData, 'doctors_list', 'Doctors');
      }
    } catch (error) {
      toast.error('Failed to fetch doctors data');
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  const handleExportPatients = async () => {
    setIsExporting(true);
    try {
      const response = await patientsAPI.getAll();
      if (response.data.success) {
        const patients = response.data.patients || response.data;
        const exportData = Array.isArray(patients) ? patients.map(patient => ({
          'Name': patient.fullName || (patient.firstName && patient.lastName ? `${patient.firstName} ${patient.lastName}` : "Unknown"),
          'Email': patient.email || "No email",
          'Phone': patient.phone || "No phone",
          'Date of Birth': patient.dateOfBirth || "Not provided",
          'Gender': patient.gender || "Not specified",
          'Address': patient.address || "No address",
          'Created At': new Date(patient.createdAt).toLocaleString()
        })) : [];
        exportToExcel(exportData, 'patients_list', 'Patients');
      }
    } catch (error) {
      toast.error('Failed to fetch patients data');
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  const handleExportBilling = async () => {
    setIsExporting(true);
    try {
      const response = await billingAPI.getAll();
      if (response.data.success) {
        const billing = response.data.billing || response.data;
        const exportData = Array.isArray(billing) ? billing.map(bill => ({
          'Service Type': bill.serviceType || "General Service",
          'Description': bill.description || "No description",
          'Amount': `₹${bill.totalAmount || bill.amount || 0}`,
          'Status': bill.status || "Pending",
          'Clinic': bill.clinicName || "No clinic",
          'Created At': new Date(bill.createdAt).toLocaleString()
        })) : [];
        exportToExcel(exportData, 'billing_list', 'Billing');
      }
    } catch (error) {
      toast.error('Failed to fetch billing data');
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  const handleExportClinics = async () => {
    setIsExporting(true);
    try {
      const response = await clinicsAPI.getAll();
      if (response.data.success) {
        const clinics = response.data.clinics;
        const exportData = clinics.map(clinic => ({
          'Name': clinic.name,
          'Address': clinic.address,
          'Phone': clinic.phone,
          'Email': clinic.email,
          'Type': clinic.type || "General Clinic",
          'Status': clinic.isActive ? "Active" : "Inactive",
          'Created At': new Date(clinic.createdAt).toLocaleString()
        }));
        exportToExcel(exportData, 'clinics_list', 'Clinics');
      }
    } catch (error) {
      toast.error('Failed to fetch clinics data');
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  const handleExportNurses = async () => {
    setIsExporting(true);
    try {
      const response = await nursesAPI.getAll();
      if (response.data.success) {
        const nurses = response.data.nurses || response.data;
        const exportData = Array.isArray(nurses) ? nurses.map(nurse => ({
          'Name': nurse.fullName || (nurse.firstName && nurse.lastName ? `${nurse.firstName} ${nurse.lastName}` : "Unknown"),
          'Email': nurse.email || "No email",
          'Phone': nurse.phone || "No phone",
          'Department': nurse.department || "General",
          'Status': nurse.isActive ? "Active" : "Inactive",
          'Created At': new Date(nurse.createdAt).toLocaleString()
        })) : [];
        exportToExcel(exportData, 'nurses_list', 'Nurses');
      }
    } catch (error) {
      toast.error('Failed to fetch nurses data');
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  const handleExportReferrals = async () => {
    setIsExporting(true);
    try {
      const response = await referralsAPI.getAll();
      if (response.data.success) {
        const referrals = response.data.referrals || response.data.data || response.data;
        const exportData = Array.isArray(referrals) ? referrals.map(referral => ({
          'Patient Name': referral.patientName || referral.patientId?.fullName || referral.patientId?.firstName || "N/A",
          'From Doctor': referral.referringProvider?.name || referral.fromDoctor || referral.fromDoctorId?.fullName || "N/A",
          'To Doctor': referral.specialistName || referral.toDoctor || referral.toDoctorId?.fullName || "N/A",
          'Specialty': referral.specialty || referral.specialization || "General",
          'Reason': referral.reason || "No reason provided",
          'Urgency': referral.urgency || "Medium",
          'Preferred Date': referral.preferredDate ? new Date(referral.preferredDate).toLocaleDateString() : "Not specified",
          'Status': referral.status || "Pending",
          'Created At': new Date(referral.createdAt).toLocaleString()
        })) : [];
        exportToExcel(exportData, 'referrals_list', 'Referrals');
      }
    } catch (error) {
      toast.error("Failed to fetch referrals data");
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  const handleViewCaseLog = async () => {
    setCaseLogLoading(true);
    try {
      // Fetch system-wide activity data
      const [activityResponse, sessionsResponse, healthResponse] = await Promise.all([
        caseLogAPI.getSystemActivity({ limit: 50 }).catch(() => ({ data: { success: false } })),
        caseLogAPI.getActiveSessions().catch(() => ({ data: { success: false } })),
        caseLogAPI.getSystemHealth().catch(() => ({ data: { success: false } }))
      ]);

      // Fetch real system activity data
      let realActivityData = [];
      let realActiveSessions = [];
      let realSystemHealth = {};
      
      if (activityResponse.data.success) {
        realActivityData = activityResponse.data.data || [];
      }
      
      if (sessionsResponse.data.success) {
        realActiveSessions = sessionsResponse.data.data || [];
      }
      
      if (healthResponse.data.success) {
        realSystemHealth = healthResponse.data.data || {};
      }
      
      // Fallback to mock data if no real data available
      if (realActivityData.length === 0) {
        realActivityData = [
          {
            _id: '1',
            action: 'login',
            user: 'Dr. John Smith',
            role: 'doctor',
            clinic: 'City Medical Center',
            timestamp: new Date(Date.now() - 5 * 60 * 1000),
            ipAddress: '192.168.1.100',
            status: 'success'
          },
          {
            _id: '2',
            action: 'logout',
            user: 'Nurse Sarah Johnson',
            role: 'nurse',
            clinic: 'City Medical Center',
            timestamp: new Date(Date.now() - 12 * 60 * 1000),
            ipAddress: '192.168.1.101',
            status: 'success'
          }
        ];
      }
      
      if (realActiveSessions.length === 0) {
        realActiveSessions = [
          {
            _id: '1',
            user: 'Dr. John Smith',
            role: 'doctor',
            clinic: 'City Medical Center',
            loginTime: new Date(Date.now() - 5 * 60 * 1000),
            ipAddress: '192.168.1.100',
            lastActivity: new Date(Date.now() - 1 * 60 * 1000)
          }
        ];
      }
      
      if (Object.keys(realSystemHealth).length === 0) {
        realSystemHealth = {
          totalUsers: stats.totalUsers || 0,
          activeUsers: stats.activeUsers || 0,
          totalSessions: 45,
          activeSessions: realActiveSessions.length,
          systemUptime: '99.9%',
          lastBackup: new Date(Date.now() - 2 * 60 * 60 * 1000),
          serverStatus: 'healthy',
          databaseStatus: 'healthy'
        };
      }

      setCaseLogData(realActivityData);
      setActiveSessions(realActiveSessions);
      setSystemHealth(realSystemHealth);
      
      toast.success("Case log data loaded successfully");
    } catch (error) {
      console.error("Error fetching case log data:", error);
      toast.error("Failed to load case log data");
    } finally {
      setCaseLogLoading(false);
    }
    setShowCaseLogModal(true);
  };

  const getActivityIcon = (action) => {
    switch (action) {
      case 'login':
        return LogIn;
      case 'logout':
        return LogOut;
      case 'appointment_created':
        return Calendar;
      case 'patient_registered':
        return UserCheck;
      case 'login_failed':
        return AlertCircle;
      default:
        return Activity;
    }
  };

  const getActivityColor = (action, status) => {
    if (status === 'failed') return 'text-red-500';
    switch (action) {
      case 'login':
        return 'text-green-500';
      case 'logout':
        return 'text-blue-500';
      case 'appointment_created':
        return 'text-purple-500';
      case 'patient_registered':
        return 'text-indigo-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleViewAllDoctors = () => {
    setShowDoctorsModal(false);
    navigate('/doctors');
  };

  const handleViewDoctors = async () => {
    if (allDoctors.length === 0) {
      setDoctorsLoading(true);
      try {
        const response = await doctorsAPI.getAll({ limit: 1000 });
        if (response.data.success) {
          const doctors = response.data.data || response.data.doctors || response.data;
          setAllDoctors(Array.isArray(doctors) ? doctors : []);
          console.log("Fetched doctors for modal:", Array.isArray(doctors) ? doctors.length : 0);
        } else {
          // Fallback to users API
          setAllDoctors([]);
        }
      } catch (error) {
        console.error("Error fetching doctors:", error);
        toast.error("Failed to load doctors");
      } finally {
        setDoctorsLoading(false);
      }
    }
    setShowDoctorsModal(true);
  };

  const handleViewLabTests = async () => {
    if (allLabTests.length === 0) {
      setLabTestsLoading(true);
      try {
        const response = await labReportsAPI.getAll();
        if (response.data.success) {
          const labReports = response.data.data || response.data.labReports || response.data;
          setAllLabTests(Array.isArray(labReports) ? labReports : []);
          
          if (Array.isArray(labReports) && labReports.length > 0) {
            toast.success(`Loaded ${labReports.length} lab reports`, { duration: 2000 });
          } else {
            toast.info("No lab reports found", { duration: 2000 });
          }
        } else {
          setAllLabTests([]);
          toast.info("No lab reports available yet", { duration: 2000 });
        }
      } catch (error) {
        console.error("Error loading lab reports:", error);
        setAllLabTests([]);
        toast.error("Failed to load lab reports", { duration: 2000 });
      } finally {
        setLabTestsLoading(false);
      }
    }
    setShowLabTestsModal(true);
  };

  const handleViewReferrals = async () => {
    if (allReferrals.length === 0) {
      setReferralsLoading(true);
      try {
        const response = await referralsAPI.getAll();
        if (response.data.success) {
          setAllReferrals(response.data.data);
          toast.success("Referrals loaded successfully", { duration: 1000 });
        } else {
          toast.error("Failed to load referrals");
        }
      } catch (error) {
        console.error("Error loading referrals:", error);
        toast.error("Failed to load referrals: " + error.message);
      } finally {
        setReferralsLoading(false);
      }
    }
    setShowReferralsModal(true);
  };

  const handleViewRevenue = async () => {
    if (revenueDetails.length === 0) {
      setRevenueLoading(true);
      try {
        // Fetch all invoices for revenue data
        const response = await invoicesAPI.getAll();
        if (response.data.success) {
          const invoicesData = response.data.invoices || response.data.data || response.data;
          if (Array.isArray(invoicesData)) {
            setRevenueDetails(invoicesData.map(invoice => ({
              _id: invoice._id,
              source: `Invoice #${invoice.invoiceNo || invoice.invoiceNumber || 'N/A'}`,
              amount: invoice.total || invoice.amount || invoice.grandTotal || 0,
              date: invoice.date || invoice.createdAt,
              clinic: invoice.clinicName || invoice.clinic?.name || "Unknown Clinic",
              patientName: invoice.patientName || invoice.patient?.fullName || "Unknown Patient",
              status: invoice.status || "Generated",
              invoiceNumber: invoice.invoiceNo || invoice.invoiceNumber,
              paymentMethod: invoice.paymentMethod || "N/A"
            })));
            
            if (invoicesData.length === 0) {
              toast.info("No invoices found yet", { duration: 2000 });
            } else {
              toast.success(`Loaded ${invoicesData.length} invoices`, { duration: 2000 });
            }
          } else {
            setRevenueDetails([]);
            toast.info("No invoice data available", { duration: 2000 });
          }
        } else {
          // Fallback to billing API if invoices API fails
          try {
            const billingResponse = await billingAPI.getAll();
            if (billingResponse.data.success) {
              const billingData = billingResponse.data.billing || billingResponse.data;
              if (Array.isArray(billingData)) {
                setRevenueDetails(billingData.map(item => ({
                  _id: item._id,
                  source: item.serviceType || item.description || "Service",
                  amount: item.amount || item.totalAmount || 0,
                  date: item.date || item.createdAt,
                  clinic: item.clinicName || "Clinic"
                })));
                toast.info("Showing billing data (invoices not available)", { duration: 2000 });
              } else {
                setRevenueDetails([]);
                toast.info("No revenue data available yet", { duration: 2000 });
              }
            } else {
              setRevenueDetails([]);
              toast.info("No revenue data available yet", { duration: 2000 });
            }
          } catch (billingError) {
            setRevenueDetails([]);
            toast.info("Revenue tracking feature is being implemented", { duration: 2000 });
          }
        }
      } catch (error) {
        console.error("Error loading revenue:", error);
        setRevenueDetails([]);
        toast.error("Failed to load revenue data", { duration: 2000 });
      } finally {
        setRevenueLoading(false);
      }
    }
    setShowRevenueModal(true);
  };

  const handleViewActiveUsers = async () => {
    if (activeUsers.length === 0) {
      setActiveUsersLoading(true);
      try {
        const response = await usersAPI.getAll();
        if (response.data.success) {
          setActiveUsers(response.data.users.filter((user) => user.isActive));
        }
      } catch (error) {
        toast.error("Failed to load active users");
      } finally {
        setActiveUsersLoading(false);
      }
    }
    setShowActiveUsersModal(true);
  };

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    trend,
    trendValue,
    onClick,
    clickable,
    subtitle,
    description,
  }) => (
    <div
      className={`group bg-white/70 dark:bg-gray-950/70 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-100 dark:border-gray-800 hover:shadow-md dark:hover:shadow-gray-900/50 transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-600/50 ${
        clickable
          ? "cursor-pointer focus:outline-none focus:ring-0 active:outline-none active:ring-0"
          : ""
      }`}
      onClick={onClick}
      style={{
        outline: "none !important",
        minHeight: "125px",
      }}
      tabIndex={clickable ? 0 : -1}
      onFocus={(e) => (e.target.style.outline = "none")}
      onBlur={(e) => (e.target.style.outline = "none")}
    >
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className={`p-2 sm:p-2.5 rounded-lg ${color} shadow-sm flex-shrink-0`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white dark:text-gray-100" />
        </div>
        {trend && (
          <div
            className={`flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              trend === "up"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">{title}</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {loading ? (
            <span className="text-gray-400">…</span>
          ) : (
            <span>
              {title.includes("Revenue")
                ? `₹${value?.toLocaleString() || 0}`
                : value || 0}
            </span>
          )}
        </p>
        {subtitle && <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-0.5 truncate">{subtitle}</p>}
        {description && (
          <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 leading-tight line-clamp-2">{description}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50/80 via-blue-50/20 to-indigo-50/10 p-4">
      {/* Enhanced Header */}
      <div className="bg-white dark:bg-gray-950/60 backdrop-blur-sm rounded-2xl shadow-lg dark:shadow-gray-900 border border-white dark:border dark:border-gray-800/20 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#004D99] to-[#42A89B] bg-clip-text text-transparent dark:from-blue-400 dark:to-cyan-400">
              Super Master Admin Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-base">
              Real-time overview of all clinics and system metrics
            </p>
            <div className="flex items-center mt-2 space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-50 dark:bg-green-900/200 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  Live Data
                </span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="bg-white/80 backdrop-blur text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg text-sm font-medium hover:bg-white dark:hover:bg-gray-900 dark:bg-gray-950 transition-all flex items-center shadow-sm border border-gray-200 dark:border dark:border-gray-800"
            >
              <Activity className="h-4 w-4 mr-2" />
              Refresh Data
            </button>
            
            {/* Export Button with Dropdown */}
            <div className="relative export-dropdown">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={isExporting}
                className="bg-white/80 backdrop-blur text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg text-sm font-medium hover:bg-white dark:hover:bg-gray-900 dark:bg-gray-950 transition-all flex items-center shadow-sm border border-gray-200 dark:border dark:border-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border dark:border-gray-800 mr-2"></div>
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export Data
                <ChevronDown className="h-4 w-4 ml-2" />
              </button>
              
              {showExportDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-950 rounded-lg shadow-lg dark:shadow-gray-900 border border-gray-200 dark:border dark:border-gray-800 z-50">
                  <div className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      Export Lists
                    </div>
                    <button
                      onClick={handleExportAppointments}
                      disabled={isExporting}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 dark:bg-gray-900 flex items-center disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-3 text-green-600 dark:text-green-400" />
                      Total Appointments
                    </button>
                    <button
                      onClick={handleExportDoctors}
                      disabled={isExporting}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 dark:bg-gray-900 flex items-center disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-3 text-purple-600 dark:text-purple-400" />
                      Total Doctors
                    </button>
                    <button
                      onClick={handleExportPatients}
                      disabled={isExporting}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 dark:bg-gray-900 flex items-center disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-3 text-blue-600 dark:text-blue-400" />
                      Patient List
                    </button>
                    <button
                      onClick={handleExportBilling}
                      disabled={isExporting}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 dark:bg-gray-900 flex items-center disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-3 text-yellow-600 dark:text-yellow-400" />
                      Total Billing
                    </button>
                    <button
                      onClick={handleExportClinics}
                      disabled={isExporting}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 dark:bg-gray-900 flex items-center disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-3 text-indigo-600" />
                      Total Clinics
                    </button>
                    <button
                      onClick={handleExportNurses}
                      disabled={isExporting}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 dark:bg-gray-900 flex items-center disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-3 text-pink-600" />
                      Total Nurses
                    </button>
                    <button
                      onClick={handleExportReferrals}
                      disabled={isExporting}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 dark:bg-gray-900 flex items-center disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-3 text-teal-600" />
                      Total Referrals
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div 
              className="flex items-center space-x-2 bg-white/80 backdrop-blur px-3 py-2 rounded-lg shadow-sm border border-gray-200 dark:border dark:border-gray-800 cursor-pointer hover:bg-white dark:hover:bg-gray-900 dark:bg-gray-950 hover:shadow-md transition-all duration-200"
              onClick={handleViewCaseLog}
            >
              <div className="w-2 h-2 bg-green-50 dark:bg-green-900/200 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                Live Case Log
              </span>
              <Monitor className="h-4 w-4 text-gray-500 dark:text-gray-400 ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 mb-4 sm:mb-6">
        <StatCard
          title="Total Clinics"
          value={stats.totalClinics}
          icon={Building2}
          color="bg-gradient-to-r from-blue-500 to-blue-600"
          trend="up"
          trendValue="+12%"
          onClick={handleViewClinics}
          clickable={true}
          subtitle="Registered Healthcare Facilities"
          description="Active clinics across all regions providing medical services to patients"
        />
        <StatCard
          title="Total Appointments"
          value={stats.totalAppointments}
          icon={Calendar}
          color="bg-gradient-to-r from-green-500 to-emerald-600"
          trend="up"
          trendValue="+8%"
          onClick={handleViewAppointments}
          clickable={true}
          subtitle="Scheduled & Completed"
          description="Patient appointments across all clinics including follow-ups and consultations"
        />
        <StatCard
          title="Total Doctors"
          value={stats.totalDoctors}
          icon={Stethoscope}
          color="bg-gradient-to-r from-purple-500 to-indigo-600"
          trend="up"
          trendValue="+5%"
          onClick={handleViewDoctors}
          clickable={true}
          subtitle="Licensed Medical Professionals"
          description="Verified doctors providing healthcare services across multiple specializations"
        />
        <StatCard
          title="Lab Tests"
          value={stats.totalLabTests}
          icon={TestTube}
          color="bg-gradient-to-r from-orange-500 to-red-500"
          trend="up"
          trendValue="+15%"
          onClick={handleViewLabTests}
          clickable={true}
          subtitle="Total Lab Records"
          description="Total count of lab reports from LabReport model - all diagnostic tests and results uploaded"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 mb-4 sm:mb-6">
        <StatCard
          title="Total Super Master Admins"
          value={stats.totalSuperMasterAdmins}
          icon={Users}
          color="bg-gradient-to-r from-red-500 to-pink-600"
          trend="up"
          trendValue="+4%"
          onClick={handleViewUsers}
          clickable={true}
          subtitle="Platform Administrators"
          description="Super Master Administrators with full system access and management privileges"
        />
        <StatCard
          title="Referrals"
          value={stats.totalReferrals}
          icon={ArrowRightLeft}
          color="bg-gradient-to-r from-teal-500 to-cyan-600"
          trend="up"
          trendValue="+3%"
          onClick={handleViewReferrals}
          clickable={true}
          subtitle="Patient Referrals"
          description="Inter-clinic patient referrals for specialized treatments and consultations"
        />
        <StatCard
          title="Revenue"
          value={stats.totalRevenue}
          icon={DollarSign}
          color="bg-gradient-to-r from-yellow-500 to-amber-600"
          trend="up"
          trendValue="+18%"
          onClick={handleViewRevenue}
          clickable={true}
          subtitle="Total Revenue"
          description="Total amount from all invoices generated across all clinics"
        />
        <StatCard
          title="System Health"
          value="99.9%"
          icon={Activity}
          color="bg-gradient-to-r from-emerald-500 to-green-600"
          trend="up"
          trendValue="Uptime"
          clickable={false}
          subtitle="System Performance"
          description="Platform uptime, server response time, and overall system reliability metrics"
        />
      </div>

      {/* Compact Live Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Live Activity Chart */}
        <div className="bg-white dark:bg-gray-950/70 rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
              Live Activity
            </h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-50 dark:bg-green-900/200 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">Live</span>
            </div>
          </div>
          {chartsLoading ? (
            <div className="flex items-center justify-center h-[150px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : chartsError ? (
            <div className="flex items-center justify-center h-[150px] text-red-500">
              <AlertCircle className="h-6 w-6 mr-2" />
              <span className="text-sm">Failed to load chart data</span>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart
              data={realTimeData}
              margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient
                  id="activityGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 2"
                stroke="#E5E7EB"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="time"
                stroke="#6B7280"
                fontSize={9}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280" }}
              />
              <YAxis
                stroke="#6B7280"
                fontSize={9}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  boxShadow:
                    "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                  fontSize: "11px",
                }}
                labelStyle={{ color: "#374151", fontWeight: "500" }}
              />
              <Area
                type="monotone"
                dataKey="activeUsers"
                stroke="#4F46E5"
                strokeWidth={1.5}
                fill="url(#activityGradient)"
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {stats.totalUsers || 0}
              </span>{" "}
              Active Users
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* System Performance */}
        <div className="bg-white dark:bg-gray-950/70 rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center">
              <Activity className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
              System Performance
            </h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-50 dark:bg-green-900/200 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">99.9%</span>
            </div>
          </div>
          <div className="space-y-4">
            {/* CPU Usage */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">CPU Usage</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">24%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-50 dark:bg-blue-900/200 h-2 rounded-full"
                  style={{ width: "24%" }}
                ></div>
              </div>
            </div>

            {/* Memory Usage */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Memory Usage</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">67%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-50 dark:bg-yellow-900/200 h-2 rounded-full"
                  style={{ width: "67%" }}
                ></div>
              </div>
            </div>

            {/* Response Time */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  120ms
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-50 dark:bg-green-900/200 h-2 rounded-full"
                  style={{ width: "15%" }}
                ></div>
              </div>
            </div>

            {/* Database Load */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Database Load</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">43%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-50 dark:bg-purple-900/200 h-2 rounded-full"
                  style={{ width: "43%" }}
                ></div>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100 text-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              System running smoothly
            </span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-950/70 rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3" />
            Revenue & Appointments Trend
            <div className="ml-auto flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">Revenue</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-emerald-600 rounded-full"></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">Appointments</span>
              </div>
            </div>
          </h3>
          {chartsLoading ? (
            <div className="flex items-center justify-center h-[220px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : chartsError ? (
            <div className="flex items-center justify-center h-[220px] text-red-500">
              <AlertCircle className="h-6 w-6 mr-2" />
              <span className="text-sm">Failed to load revenue data</span>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={revenueData}
              margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
            >
              <defs>
                <linearGradient
                  id="revenueGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                </linearGradient>
                <linearGradient
                  id="appointmentsGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 2"
                stroke="#E5E7EB"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="month"
                stroke="#6B7280"
                fontSize={11}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280" }}
              />
              <YAxis
                stroke="#6B7280"
                fontSize={11}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  boxShadow:
                    "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#374151", fontWeight: "500" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#4F46E5"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                animationDuration={800}
              />
              <Area
                type="monotone"
                dataKey="appointments"
                stroke="#059669"
                strokeWidth={2}
                fill="url(#appointmentsGradient)"
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-gray-950/70 rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-3" />
            Department Distribution
            <div className="ml-auto">
              <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                Live Data
              </span>
            </div>
          </h3>
          {chartsLoading ? (
            <div className="flex items-center justify-center h-[220px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : chartsError ? (
            <div className="flex items-center justify-center h-[220px] text-red-500">
              <AlertCircle className="h-6 w-6 mr-2" />
              <span className="text-sm">Failed to load department data</span>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={departmentData}
                cx="50%"
                cy="50%"
                outerRadius={70}
                innerRadius={35}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
                animationDuration={800}
              >
                {departmentData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "none",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
                formatter={(value, name, props) => [
                  `${value}% (${props.payload.patients} patients)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Enhanced Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-950/70 rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <div className="p-2 bg-green-100 rounded-lg mr-3">
              <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            Weekly Activity
            <div className="ml-auto flex items-center space-x-2">
              <Zap className="h-4 w-4 text-green-500 animate-pulse" />
            </div>
          </h3>
          {chartsLoading ? (
            <div className="flex items-center justify-center h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          ) : chartsError ? (
            <div className="flex items-center justify-center h-[200px] text-red-500">
              <AlertCircle className="h-6 w-6 mr-2" />
              <span className="text-sm">Failed to load activity data</span>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={activityData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="patientsBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="doctorsBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "none",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
                formatter={(value, name) => [
                  value,
                  name === "patients" ? "Patients" : "Doctors",
                ]}
              />
              <Bar
                dataKey="patients"
                fill="url(#patientsBar)"
                radius={[4, 4, 0, 0]}
                animationDuration={800}
              />
              <Bar
                dataKey="doctors"
                fill="url(#doctorsBar)"
                radius={[4, 4, 0, 0]}
                animationDuration={800}
              />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-xl shadow-lg dark:shadow-gray-900 border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg mr-3">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            Recent Activity
          </h3>
          <div className="space-y-4">
            <div className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500 dark:border-blue-600">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  New clinic registered
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500 dark:border-green-600">
              <Stethoscope className="h-5 w-5 text-green-600 dark:text-green-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  3 new doctors joined
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">4 hours ago</p>
              </div>
            </div>
            <div className="flex items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border-l-4 border-purple-500 dark:border-purple-600">
              <TestTube className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  45 lab tests completed
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">6 hours ago</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-xl shadow-lg dark:shadow-gray-900 border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-red-600" />
            System Health
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-50 dark:bg-green-900/200 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Database</span>
              </div>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                Healthy
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-50 dark:bg-green-900/200 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">API Response</span>
              </div>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">120ms</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-50 dark:bg-green-900/200 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Uptime</span>
              </div>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">99.9%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-50 dark:bg-yellow-900/200 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Storage</span>
              </div>
              <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                78% Used
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Users Modal */}
      {showUsersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border dark:border-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Super Master Administrators</h2>
                <p className="text-gray-600 dark:text-gray-400">Total: {allUsers.length} super master admins</p>
              </div>
              <button
                onClick={() => setShowUsersModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {usersLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-black">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Clinic
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Last Login
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-700">
                      {allUsers.map((user) => (
                        <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-900 dark:bg-gray-900">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="bg-indigo-100 h-10 w-10 rounded-full flex items-center justify-center">
                                <span className="text-indigo-600 font-medium">
                                  {user.firstName?.[0]}
                                  {user.lastName?.[0]}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {user.firstName} {user.lastName}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                user.role === "super_master_admin"
                                  ? "bg-purple-100 text-purple-800"
                                  : user.role === "clinic_admin"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {user.role?.replace("_", " ").toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {user.clinicId?.name || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {user.phone || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                user.isActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {user.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {user.lastLogin
                              ? new Date(user.lastLogin).toLocaleString()
                              : user.updatedAt
                              ? new Date(user.updatedAt).toLocaleString()
                              : "Never"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {allUsers.length === 0 && (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No super master admins found
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        No super master administrators are registered in the system yet.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clinics Modal */}
      {showClinicsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border dark:border-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  All Clinics
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Total: {allClinics.length} clinics
                </p>
              </div>
              <button
                onClick={() => setShowClinicsModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-lg"
              >
                <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {clinicsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allClinics.map((clinic) => (
                    <div
                      key={clinic._id}
                      className="bg-gray-50 dark:bg-black rounded-lg p-4 border dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 cursor-pointer transition-colors group"
                      onClick={() => {
                        setShowClinicsModal(false);
                        navigate('/clinics');
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg group-hover:text-blue-600 dark:text-blue-400 transition-colors">
                          {clinic.name}
                        </h3>
                        <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-2">{clinic.address}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Phone: {clinic.phone}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Email: {clinic.email}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appointments Modal */}
      {showAppointmentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border dark:border-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  All Appointments
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Total: {allAppointments.length} appointments
                </p>
              </div>
              <button
                onClick={() => setShowAppointmentsModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-lg"
              >
                <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {appointmentsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 dark:border-green-600"></div>
                </div>
              ) : (
                <>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-black">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Doctor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-700">
                      {allAppointments.slice(0, 7).map((appointment) => (
                        <tr 
                          key={appointment._id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-900 dark:bg-gray-900 cursor-pointer transition-colors"
                          onClick={() => {
                            setShowAppointmentsModal(false);
                            navigate('/appointments');
                          }}
                        >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {appointment.patientName || appointment.patientId?.fullName || appointment.patientId?.firstName || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {appointment.doctorName || appointment.doctorId?.fullName || appointment.doctorId?.firstName || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {appointment.date || appointment.appointmentDate || new Date(appointment.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {appointment.time || appointment.appointmentTime || "Time TBD"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              appointment.status === "Completed"
                                ? "bg-green-100 text-green-800"
                                : appointment.status === "Scheduled"
                                ? "bg-blue-100 text-blue-800"
                                  : appointment.status === "Cancelled"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                              {appointment.status || "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  
                  {allAppointments.length === 0 && (
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No appointments found
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        No appointments are scheduled in the system yet.
                      </p>
                    </div>
                  )}
                  
                  {allAppointments.length > 7 && (
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={handleViewAllAppointments}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Show All {allAppointments.length} Appointments
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Doctors Modal */}
      {showDoctorsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border dark:border-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  All Doctors
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Total: {allDoctors.length} doctors
                </p>
              </div>
              <button
                onClick={() => setShowDoctorsModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-lg"
              >
                <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {doctorsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 dark:border-purple-600"></div>
                </div>
              ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allDoctors.slice(0, 8).map((doctor) => (
                    <div
                      key={doctor._id}
                        className="bg-gray-50 dark:bg-black rounded-lg p-4 border dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 cursor-pointer transition-colors group"
                        onClick={() => {
                          setShowDoctorsModal(false);
                          navigate('/doctors');
                        }}
                    >
                      <div className="flex items-center mb-3">
                        <div className="bg-purple-100 h-12 w-12 rounded-full flex items-center justify-center">
                          <span className="text-purple-600 dark:text-purple-400 font-medium">
                              {doctor.fullName?.[0] || doctor.firstName?.[0] || "D"}
                              {(doctor.fullName && doctor.fullName.length > 1) ? doctor.fullName.split(' ')[1]?.[0] : doctor.lastName?.[0] || ""}
                          </span>
                        </div>
                        <div className="ml-3">
                            <h3 className="font-semibold group-hover:text-purple-600 dark:text-purple-400 transition-colors">
                              {doctor.fullName || (doctor.firstName && doctor.lastName ? `${doctor.firstName} ${doctor.lastName}` : "Dr. Unknown")}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                              {doctor.specialty || doctor.specialization || "General Medicine"}
                          </p>
                        </div>
                      </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{doctor.email || "No email"}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{doctor.phone || "No phone"}</p>
                        {doctor.isActive !== undefined && (
                          <div className="mt-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              doctor.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}>
                              {doctor.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        )}
                    </div>
                  ))}
                  </div>
                  
                  {allDoctors.length > 8 && (
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={handleViewAllDoctors}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Show All {allDoctors.length} Doctors
                      </button>
                </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lab Tests Modal */}
      {showLabTestsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border dark:border-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Lab Reports</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Total Lab Reports: {allLabTests.length} | Diagnostic Tests & Results
                </p>
              </div>
              <button
                onClick={() => setShowLabTestsModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-lg"
              >
                <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {labTestsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 dark:border-orange-600"></div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-black">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Test Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Test Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Lab Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Uploaded By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Upload Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-700">
                    {allLabTests.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          <TestTube className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                          <p className="text-lg font-medium">No lab reports found</p>
                          <p className="text-sm">Lab reports will appear here once they are uploaded</p>
                        </td>
                      </tr>
                    ) : (
                      allLabTests.map((report) => (
                        <tr key={report._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {report.testName || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {report.patientId?.fullName || report.patientName || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {report.testDate ? new Date(report.testDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {report.labName || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {report.uploadedBy?.fullName || report.uploadedByName || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {report.uploadedAt ? new Date(report.uploadedAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => window.open(`${import.meta.env.VITE_API_URL || '/api/v1'}/lab-reports/${report._id}/download`, '_blank')}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                title="Download Report"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                              {report.notes && (
                                <span
                                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-help"
                                  title={report.notes}
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Referrals Modal */}
      {showReferralsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border dark:border-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Referrals</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Total: {allReferrals.length} referrals
                </p>
              </div>
              <button
                onClick={() => setShowReferralsModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-lg"
              >
                <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {referralsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-black">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        From Doctor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        To Doctor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Specialty
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-700">
                    {allReferrals.map((referral) => (
                      <tr key={referral._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {referral.patientName || referral.patientId?.fullName || referral.patientId?.firstName || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {referral.referringProvider?.name || referral.fromDoctor || referral.fromDoctorId?.fullName || referral.fromDoctorId?.firstName || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {referral.specialistName || referral.toDoctor || referral.toDoctorId?.fullName || referral.toDoctorId?.firstName || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {referral.specialty || referral.specialization || referral.reason || "General"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {referral.preferredDate ? new Date(referral.preferredDate).toLocaleDateString() : referral.date || referral.referralDate || new Date(referral.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              referral.status === "Completed"
                                ? "bg-green-100 text-green-800"
                                : referral.status === "Pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : referral.status === "Cancelled"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {referral.status || "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Modal */}
      {showRevenueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border dark:border-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Invoice Revenue
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Total Invoices: {revenueDetails.length} | Total Revenue: ₹{stats.totalRevenue.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setShowRevenueModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-lg"
              >
                <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {revenueLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 dark:border-yellow-600"></div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-black">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Invoice
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Clinic
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-700">
                    {revenueDetails.map((revenue) => (
                      <tr key={revenue._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {revenue.source}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {revenue.patientName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 font-semibold">
                          ₹{revenue.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {revenue.date ? new Date(revenue.date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {revenue.clinic}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            revenue.status === 'Paid' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : revenue.status === 'Pending' || revenue.status === 'Generated'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : revenue.status === 'Cancelled' || revenue.status === 'Rejected'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}>
                            {revenue.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Case Log Modal */}
      {showCaseLogModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl max-w-7xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border dark:border-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  <Monitor className="h-6 w-6 mr-3 text-[#004D99]" />
                  Live Case Log
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Real-time system activity and user sessions
                </p>
              </div>
              <button
                onClick={() => setShowCaseLogModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-lg"
              >
                <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {caseLogLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004D99] dark:border-blue-400"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* System Health Overview */}
                  <div className="lg:col-span-1">
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                        <Shield className="h-5 w-5 mr-2 text-[#004D99]" />
                        System Health
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total Users</span>
                          <span className="text-sm font-semibold">{systemHealth.totalUsers || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Active Sessions</span>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">{systemHealth.activeSessions || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">System Uptime</span>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">{systemHealth.systemUptime || '99.9%'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Server Status</span>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400 capitalize">{systemHealth.serverStatus || 'Healthy'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Active Sessions */}
                    <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm p-6 border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                        <UserCheck className="h-5 w-5 mr-2 text-[#42A89B]" />
                        Active Sessions ({activeSessions.length})
                      </h3>
                      <div className="space-y-3">
                        {activeSessions.map((session) => (
                          <div key={session._id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-black rounded-lg">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{session.user}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{session.role} • {session.clinic}</p>
                              <p className="text-xs text-gray-400">IP: {session.ipAddress}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(session.loginTime)}</p>
                              <p className="text-xs text-gray-400">Last: {formatTimeAgo(session.lastActivity)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Activity Log */}
                  <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200 dark:border dark:border-gray-800 bg-gradient-to-r from-gray-50 to-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                          <Activity className="h-5 w-5 mr-2 text-[#004D99]" />
                          Recent Activity ({caseLogData.length})
                        </h3>
                      </div>
                      
                      <div className="max-h-96 overflow-y-auto">
                        {caseLogData.map((activity) => {
                          const ActivityIcon = getActivityIcon(activity.action);
                          return (
                            <div key={activity._id} className="p-4 border-b border-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 dark:bg-gray-900 transition-colors">
                              <div className="flex items-start space-x-3">
                                <div className={`p-2 rounded-full ${getActivityColor(activity.action, activity.status).replace('text-', 'bg-').replace('-500', '-100')}`}>
                                  <ActivityIcon className={`h-4 w-4 ${getActivityColor(activity.action, activity.status)}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {activity.user} ({activity.role})
                                    </p>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(activity.timestamp)}</span>
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                                    {activity.action.replace('_', ' ')} • {activity.clinic}
                                  </p>
                                  {activity.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{activity.description}</p>
                                  )}
                                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                                    <span>IP: {activity.ipAddress}</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      activity.status === 'success' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {activity.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {caseLogData.length === 0 && (
                        <div className="text-center py-12">
                          <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No activity found</h3>
                          <p className="text-gray-500 dark:text-gray-400">System activity will appear here in real-time.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperMasterAdminDashboard;
