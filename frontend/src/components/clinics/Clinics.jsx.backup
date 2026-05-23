import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Eye,
  EyeOff,
  X,
  Building2,
  Filter,
  Hash,
  Building,
  Globe,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { clinicsAPI } from "../../services/api";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import "./Clinics.css";

const Clinics = () => {
  const navigate = useNavigate();
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [editClinic, setEditClinic] = useState(null);

  // Individual search filters
  const [filters, setFilters] = useState({
    registrationNumber: "",
    name: "",
    type: "",
    country: "",
    status: "all", // all, active, inactive
  });

  // Advanced filters visibility
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "",
    registrationNumber: "",
    yearOfEstablishment: "",
    address: "",
    city: "",
    state: "",
    country: "",
    zipCode: "",
    phone: "",
    email: "",
    website: "",
    ownerName: "",
    ownerMedicalId: "",
    adminName: "",
    adminContact: "",
    adminEmail: "",
    // New Legal & Compliance Fields
    gstNumber: "",
    panNumber: "",
    tanNumber: "",
    bankAccountNumber: "",
    // Document files
    complianceDocuments: null,
    specialties: [],
    services: [],
    operatingHours: "",
    staffCount: "",
    beds: "",
    pharmacyAvailable: false,
    laboratoryAvailable: false,
    paymentMethods: [],
    bankInfo: "",
    adminUsername: "",
    adminPassword: "",
    // Super Admin credentials
    superAdminFirstName: "",
    superAdminLastName: "",
    superAdminEmail: "",
    superAdminPhone: "",
    superAdminPassword: "",
    // Additional fields
    insurancePanel: "", // Insurance panel name or code
    upiId: "", // UPI ID for payments
    holidayOperatingHours: "", // Operating hours for holidays
    masterAdminName: "", // Master admin name
    masterAdminContact: "", // Master admin contact
    masterAdminEmail: "", // Master admin email
    masterAdminUsername: "", // Master admin username
    masterAdminPassword: "", // Master admin password
    additionalCertifications: "", // Other certifications
    additionalNotes: "", // Any extra notes
    faxNumber: "", // Fax number
    emergencyContact: "", // Emergency contact number
    logoUrl: "", // Clinic logo URL
    branchCode: "", // Branch code if multi-branch
    parentOrganization: "", // Parent org if applicable
    registrationExpiry: "", // Registration expiry date
    licenseExpiry: "", // License expiry date
    gstCertificate: "", // GST certificate number
    vatCertificate: "", // VAT certificate number
    insuranceAccepted: [], // List of accepted insurance providers
    telemedicineAvailable: false, // Telemedicine availability
    ambulanceAvailable: false, // Ambulance availability
    parkingAvailable: false, // Parking availability
    wheelchairAccess: false, // Wheelchair accessibility
    fireSafetyCert: "", // Fire safety certificate
    cctvAvailable: false, // CCTV availability
    websiteStatus: "", // Website status (active/inactive)
    facebookPage: "", // Facebook page link
    twitterHandle: "", // Twitter handle
    instagramHandle: "", // Instagram handle
    linkedInPage: "", // LinkedIn page link
    googleMapsLink: "", // Google Maps location
    isoCertification: "", // ISO certification
    jciCertification: "", // JCI certification
    nabhCertification: "", // NABH certification
    otherAccreditations: "", // Other accreditations
    // Validity Period Fields
    validityStartDate: new Date().toISOString().split("T")[0], // Default to today
    validityEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Default to one year from today
    validityDuration: "12", // Default to 12 months (1 year)
  });
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [additionalUsers, setAdditionalUsers] = useState([]);

  // Password visibility states
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showSuperAdminPassword, setShowSuperAdminPassword] = useState(false);
  const [showMasterAdminPassword, setShowMasterAdminPassword] = useState(false);
  const [showAdditionalUserPasswords, setShowAdditionalUserPasswords] =
    useState({});

  useEffect(() => {
    fetchClinics();
  }, []);
  // Toggle handler for pharmacyAvailable
  const handleTogglePharmacy = () => {
    setForm((prevForm) => ({
      ...prevForm,
      pharmacyAvailable: !prevForm.pharmacyAvailable,
    }));
  };

  const fetchClinics = async () => {
    try {
      const response = await clinicsAPI.getAll();
      if (response.data.success) {
        setClinics(response.data.clinics);
      }
    } catch (error) {
      toast.error("Failed to fetch clinics");
    } finally {
      setLoading(false);
    }
  };

  const filteredClinics = clinics.filter((clinic) => {
    // General search term (searches across all fields)
    const matchesSearchTerm =
      !searchTerm ||
      clinic.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.registrationNumber
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      clinic.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.state?.toLowerCase().includes(searchTerm.toLowerCase());

    // Individual field filters
    const matchesRegistrationNumber =
      !filters.registrationNumber ||
      clinic.registrationNumber
        ?.toLowerCase()
        .includes(filters.registrationNumber.toLowerCase());

    const matchesName =
      !filters.name ||
      clinic.name?.toLowerCase().includes(filters.name.toLowerCase());

    const matchesType =
      !filters.type ||
      clinic.type?.toLowerCase().includes(filters.type.toLowerCase());

    const matchesCountry =
      !filters.country ||
      clinic.country?.toLowerCase().includes(filters.country.toLowerCase());

    const matchesStatus =
      filters.status === "all" ||
      (filters.status === "active" && clinic.isActive) ||
      (filters.status === "inactive" && !clinic.isActive);

    return (
      matchesSearchTerm &&
      matchesRegistrationNumber &&
      matchesName &&
      matchesType &&
      matchesCountry &&
      matchesStatus
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Clinics Management
            </h1>
            <p className="text-gray-600">
              Manage healthcare facilities and clinic information
            </p>
          </div>
          <button
            className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-3 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            onClick={() => setShowModal(true)}
          >
            <Plus className="h-5 w-5" />
            <span className="font-semibold">Add New Clinic</span>
          </button>
        </div>
      </div>

      {/* Modal for Add Clinic */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 relative overflow-hidden max-h-[90vh] border border-gray-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6 relative">
              <button
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
                onClick={() => setShowModal(false)}
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-100 rounded-xl">
                  <Plus className="h-8 w-8 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Add New Clinic
                  </h2>
                  <p className="text-gray-600">
                    Register a new clinic in the system
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  // Validation
                  const errors = {};
                  if (!form.name) errors.name = "Clinic Name is required";
                  if (!form.type) errors.type = "Type of Clinic is required";
                  if (!form.registrationNumber)
                    errors.registrationNumber =
                      "Registration Number is required";
                  else if (form.registrationNumber.length > 20)
                    errors.registrationNumber =
                      "Registration Number must not exceed 20 characters";
                  if (!form.address)
                    errors.address = "Official Address is required";
                  if (!form.city) errors.city = "City is required";
                  if (!form.state) errors.state = "State is required";
                  if (!form.country) errors.country = "Country is required";
                  if (!form.zipCode) errors.zipCode = "Zip Code is required";
                  else if (!/^\d{6}$/.test(form.zipCode))
                    errors.zipCode = "Zip Code must be exactly 6 digits";
                  if (!form.phone) errors.phone = "Phone Number is required";
                  else if (!/^\d{10}$/.test(form.phone))
                    errors.phone = "Phone Number must be exactly 10 digits";
                  if (!form.email) errors.email = "Email Address is required";
                  else if (!/^\S+@\S+\.\S+$/.test(form.email))
                    errors.email = "Invalid Email Address";
                  if (!form.ownerName)
                    errors.ownerName = "Owner/Director Name is required";
                  if (!form.adminContact)
                    errors.adminContact = "Admin Contact Number is required";
                  else if (!/^\d{10}$/.test(form.adminContact))
                    errors.adminContact = "Admin Contact Number must be exactly 10 digits";
                  if (!form.adminEmail)
                    errors.adminEmail = "Admin Email is required";
                  else if (!/^\S+@\S+\.\S+$/.test(form.adminEmail))
                    errors.adminEmail = "Invalid Admin Email";
                  if (!form.adminUsername)
                    errors.adminUsername = "Admin Username is required";
                  if (!form.adminPassword)
                    errors.adminPassword = "Admin Password is required";
                  else if (form.adminPassword.length < 6)
                    errors.adminPassword =
                      "Password must be at least 6 characters";

                  // Legal & Compliance validation
                  if (form.gstNumber && form.gstNumber.length !== 15)
                    errors.gstNumber = "GST Number must be exactly 15 characters";
                  if (form.panNumber && form.panNumber.length !== 10)
                    errors.panNumber = "PAN Number must be exactly 10 characters";
                  if (form.tanNumber && form.tanNumber.length !== 10)
                    errors.tanNumber = "TAN Number must be exactly 10 characters";
                  if (form.bankAccountNumber && form.bankAccountNumber.length > 20)
                    errors.bankAccountNumber = "Bank Account Number must not exceed 20 characters";

                  // Validity period validation
                  if (!form.validityStartDate)
                    errors.validityStartDate = "Start Date is required";
                  if (!form.validityDuration)
                    errors.validityDuration = "Duration is required";

                  // Validate minimum 1 year duration
                  if (form.validityStartDate && form.validityEndDate) {
                    const startDate = new Date(form.validityStartDate);
                    const endDate = new Date(form.validityEndDate);
                    const oneYearFromStart = new Date(startDate);
                    oneYearFromStart.setFullYear(
                      oneYearFromStart.getFullYear() + 1
                    );

                    if (endDate < oneYearFromStart) {
                      errors.validityEndDate =
                        "End date must be at least 1 year from start date";
                    }

                    if (endDate <= startDate) {
                      errors.validityEndDate =
                        "End date must be after start date";
                    }
                  }

                  setFormErrors(errors);
                  if (Object.keys(errors).length > 0) {
                    console.error("Form validation errors:", errors);
                    toast.error("Please fill all required fields correctly");
                    return;
                  }

                  setSaving(true);
                  const clinicId =
                    "UKGW" + Math.floor(100 + Math.random() * 900);

                  // Format the payload to match backend expectations
                  const payload = {
                    // Basic clinic info
                    name: form.name,
                    type: form.type,
                    registrationNumber: form.registrationNumber,
                    yearOfEstablishment:
                      parseInt(form.yearOfEstablishment) ||
                      new Date().getFullYear(),
                    address: form.address,
                    city: form.city,
                    state: form.state,
                    country: form.country,
                    zipCode: form.zipCode,
                    phone: form.phone,
                    email: form.email,
                    website: form.website || "",
                    ownerName: form.ownerName,
                    ownerMedicalId: form.ownerMedicalId || "",

                    // Admin info
                    adminName: form.adminName || "",
                    adminContact: form.adminContact,
                    adminEmail: form.adminEmail,
                    adminUsername: form.adminUsername,
                    adminPassword: form.adminPassword,

                    // Legal & compliance
                    gstNumber: form.gstNumber || "",
                    panNumber: form.panNumber || "",
                    tanNumber: form.tanNumber || "",
                    bankAccountNumber: form.bankAccountNumber || "",

                    // Services & specialties
                    specialties: form.specialties || [],
                    services: form.services || [],
                    operatingHours: form.operatingHours || "",

                    // Infrastructure (convert to numbers)
                    staffCount: form.staffCount
                      ? parseInt(form.staffCount)
                      : undefined,
                    beds: form.beds ? parseInt(form.beds) : undefined,
                    pharmacyAvailable: form.pharmacyAvailable || false,
                    laboratoryAvailable: form.laboratoryAvailable || false,

                    // Payment
                    paymentMethods: form.paymentMethods || [],
                    bankInfo: form.bankInfo || "",

                    // Validity period (structured to match backend model)
                    validityPeriod: {
                      startDate: form.validityStartDate,
                      endDate: form.validityEndDate,
                      duration: parseInt(form.validityDuration) || 12,
                    },

                    // Clinic ID
                    clinicId: clinicId,

                    // Additional Users
                    additionalUsers: additionalUsers.map((user) => ({
                      name: user.name,
                      phone: user.phone,
                      email: user.email,
                      password: user.password,
                    })),

                    // All other additional fields
                    ...Object.keys(form).reduce((acc, key) => {
                      if (
                        ![
                          "name",
                          "type",
                          "registrationNumber",
                          "yearOfEstablishment",
                          "address",
                          "city",
                          "state",
                          "country",
                          "zipCode",
                          "phone",
                          "email",
                          "website",
                          "ownerName",
                          "ownerMedicalId",
                          "adminName",
                          "adminContact",
                          "adminEmail",
                          "adminUsername",
                          "adminPassword",
                          "gstNumber",
                          "panNumber",
                          "tanNumber",
                          "bankAccountNumber",
                          "complianceDocuments",
                          "specialties",
                          "services",
                          "operatingHours",
                          "staffCount",
                          "beds",
                          "pharmacyAvailable",
                          "laboratoryAvailable",
                          "paymentMethods",
                          "bankInfo",
                          "validityStartDate",
                          "validityEndDate",
                          "validityDuration",
                          "clinicId",
                        ].includes(key)
                      ) {
                        acc[key] = form[key];
                      }
                      return acc;
                    }, {}),
                  };

                  console.log("Sending clinic creation payload:", payload);

                  try {
                    const response = await clinicsAPI.create(payload);
                    console.log("Server response:", response.data);

                    if (response.data.success) {
                      toast.success("Clinic added successfully");
                      setShowModal(false);
                      setForm({
                        name: "",
                        type: "",
                        registrationNumber: "",
                        yearOfEstablishment: "",
                        address: "",
                        city: "",
                        state: "",
                        country: "",
                        zipCode: "",
                        phone: "",
                        email: "",
                        website: "",
                        ownerName: "",
                        ownerMedicalId: "",
                        adminName: "",
                        adminContact: "",
                        adminEmail: "",
                        tradeLicense: "",
                        medicalCouncilCert: "",
                        taxId: "",
                        accreditation: "",
                        specialties: [],
                        services: [],
                        operatingHours: "",
                        staffCount: "",
                        beds: "",
                        pharmacyAvailable: false,
                        laboratoryAvailable: false,
                        paymentMethods: [],
                        bankInfo: "",
                        adminUsername: "",
                        adminPassword: "",
                        // Super Admin credentials
                        superAdminFirstName: "",
                        superAdminLastName: "",
                        superAdminEmail: "",
                        superAdminPhone: "",
                        superAdminPassword: "",
                        // Additional fields
                        insurancePanel: "", // Insurance panel name or code
                        upiId: "", // UPI ID for payments
                        holidayOperatingHours: "", // Operating hours for holidays
                        masterAdminName: "", // Master admin name
                        masterAdminContact: "", // Master admin contact
                        masterAdminEmail: "", // Master admin email
                        masterAdminUsername: "", // Master admin username
                        masterAdminPassword: "", // Master admin password
                        additionalCertifications: "", // Other certifications
                        additionalNotes: "", // Any extra notes
                        faxNumber: "", // Fax number
                        emergencyContact: "", // Emergency contact number
                        logoUrl: "", // Clinic logo URL
                        branchCode: "", // Branch code if multi-branch
                        parentOrganization: "", // Parent org if applicable
                        registrationExpiry: "", // Registration expiry date
                        licenseExpiry: "", // License expiry date
                        gstCertificate: "", // GST certificate number
                        vatCertificate: "", // VAT certificate number
                        insuranceAccepted: [], // List of accepted insurance providers
                        telemedicineAvailable: false, // Telemedicine availability
                        ambulanceAvailable: false, // Ambulance availability
                        parkingAvailable: false, // Parking availability
                        wheelchairAccess: false, // Wheelchair accessibility
                        fireSafetyCert: "", // Fire safety certificate
                        cctvAvailable: false, // CCTV availability
                        websiteStatus: "", // Website status (active/inactive)
                        facebookPage: "", // Facebook page link
                        twitterHandle: "", // Twitter handle
                        instagramHandle: "", // Instagram handle
                        linkedInPage: "", // LinkedIn page link
                        googleMapsLink: "", // Google Maps location
                        isoCertification: "", // ISO certification
                        jciCertification: "", // JCI certification
                        nabhCertification: "", // NABH certification
                        otherAccreditations: "", // Other accreditations
                        // Validity Period Fields
                        validityStartDate: new Date()
                          .toISOString()
                          .split("T")[0], // Default to today
                        validityEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Default to one year from today
                        validityDuration: "12", // Default to 12 months (1 year)
                      });
                      setAdditionalUsers([]);
                      setFormErrors({});
                      fetchClinics();
                    } else {
                      console.error("Failed to add clinic:", response.data);
                      toast.error(
                        response.data.message || "Failed to add clinic"
                      );
                    }
                  } catch (err) {
                    console.error("Clinic creation error:", err);
                    const errorMessage =
                      err.response?.data?.message ||
                      err.response?.data?.error ||
                      err.message ||
                      "Failed to add clinic";
                    toast.error(errorMessage);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                  Basic Information
                </h3>
                {/* Clinic Identity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium">
                      Clinic Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.name ? "border-red-500" : ""
                      }`}
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                    {formErrors.name && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.name}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Type of Clinic <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={`form-select w-full ${
                        formErrors.type ? "border-red-500" : ""
                      }`}
                      required
                      value={form.type}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, type: e.target.value }))
                      }
                    >
                      <option value="">Select type</option>
                      <option value="Multi speciality">Multi speciality</option>
                      <option value="Proprietor clinic">
                        Proprietor clinic
                      </option>
                    </select>
                    {formErrors.type && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.type}
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 mt-8">
                  <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                  Contact & Location
                </h3>
                {/* Contact & Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium">
                      Official Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.address ? "border-red-500" : ""
                      }`}
                      required
                      value={form.address}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, address: e.target.value }))
                      }
                    />
                    {formErrors.address && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.address}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.city ? "border-red-500" : ""
                      }`}
                      required
                      value={form.city}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, city: e.target.value }))
                      }
                    />
                    {formErrors.city && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.city}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.state ? "border-red-500" : ""
                      }`}
                      required
                      value={form.state}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, state: e.target.value }))
                      }
                    />
                    {formErrors.state && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.state}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Country <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.country ? "border-red-500" : ""
                      }`}
                      required
                      value={form.country}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, country: e.target.value }))
                      }
                    />
                    {formErrors.country && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.country}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Zip Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.zipCode ? "border-red-500" : ""
                      }`}
                      required
                      value={form.zipCode}
                      onChange={(e) => {
                        if (e.target.value.length <= 6) {
                          setForm((f) => ({ ...f, zipCode: e.target.value }));
                        }
                      }}
                      placeholder="Enter 6-digit zip code"
                      maxLength="6"
                    />
                    {formErrors.zipCode && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.zipCode}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.phone ? "border-red-500" : ""
                      }`}
                      required
                      value={form.phone}
                      onChange={(e) => {
                        if (e.target.value.length <= 10) {
                          setForm((f) => ({ ...f, phone: e.target.value }));
                        }
                      }}
                      placeholder="Enter 10-digit phone number"
                      maxLength="10"
                    />
                    {formErrors.phone && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.phone}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.email ? "border-red-500" : ""
                      }`}
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                    />
                    {formErrors.email && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.email}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Website (optional)
                    </label>
                    <input
                      className="form-input w-full"
                      value={form.website}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, website: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 mt-8">
                  <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                  Ownership & Administration
                </h3>
                {/* Ownership & Administration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium">
                      Owner/Director Name{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.ownerName ? "border-red-500" : ""
                      }`}
                      required
                      value={form.ownerName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, ownerName: e.target.value }))
                      }
                    />
                    {formErrors.ownerName && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.ownerName}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Admin Contact Number{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.adminContact ? "border-red-500" : ""
                      }`}
                      required
                      value={form.adminContact}
                      onChange={(e) => {
                        if (e.target.value.length <= 10) {
                          setForm((f) => ({ ...f, adminContact: e.target.value }));
                        }
                      }}
                      placeholder="Enter 10-digit admin contact"
                      maxLength="10"
                    />
                    {formErrors.adminContact && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.adminContact}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Admin Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.adminEmail ? "border-red-500" : ""
                      }`}
                      required
                      type="email"
                      value={form.adminEmail}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, adminEmail: e.target.value }))
                      }
                    />
                    {formErrors.adminEmail && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.adminEmail}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Admin Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`form-input w-full ${
                        formErrors.adminUsername ? "border-red-500" : ""
                      }`}
                      required
                      value={form.adminUsername}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          adminUsername: e.target.value,
                        }))
                      }
                    />
                    {formErrors.adminUsername && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.adminUsername}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Admin Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        className={`form-input w-full pr-10 ${
                          formErrors.adminPassword ? "border-red-500" : ""
                        }`}
                        required
                        type={showAdminPassword ? "text" : "password"}
                        value={form.adminPassword}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            adminPassword: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                      >
                        {showAdminPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </div>
                    {formErrors.adminPassword && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.adminPassword}
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Users Section */}
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-medium text-gray-900">
                      Additional Users
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setAdditionalUsers([
                          ...additionalUsers,
                          {
                            id: Date.now(),
                            name: "",
                            phone: "",
                            email: "",
                            password: "",
                          },
                        ]);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add Additional User
                    </button>
                  </div>

                  {additionalUsers.map((user, index) => (
                    <div
                      key={user.id}
                      className="mb-4 p-4 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h5 className="text-sm font-medium text-gray-700">
                          User {index + 1}
                        </h5>
                        <button
                          type="button"
                          onClick={() => {
                            setAdditionalUsers(
                              additionalUsers.filter((u) => u.id !== user.id)
                            );
                          }}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Name
                          </label>
                          <input
                            type="text"
                            className="form-input w-full"
                            value={user.name}
                            onChange={(e) => {
                              const updated = additionalUsers.map((u) =>
                                u.id === user.id
                                  ? { ...u, name: e.target.value }
                                  : u
                              );
                              setAdditionalUsers(updated);
                            }}
                            placeholder="Enter user name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Phone
                          </label>
                          <input
                            type="text"
                            className="form-input w-full"
                            value={user.phone}
                            onChange={(e) => {
                              const updated = additionalUsers.map((u) =>
                                u.id === user.id
                                  ? { ...u, phone: e.target.value }
                                  : u
                              );
                              setAdditionalUsers(updated);
                            }}
                            placeholder="Enter phone number"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            className="form-input w-full"
                            value={user.email}
                            onChange={(e) => {
                              const updated = additionalUsers.map((u) =>
                                u.id === user.id
                                  ? { ...u, email: e.target.value }
                                  : u
                              );
                              setAdditionalUsers(updated);
                            }}
                            placeholder="Enter email address"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-1">
                            Password
                          </label>
                          <div className="relative">
                            <input
                              type={
                                showAdditionalUserPasswords[user.id]
                                  ? "text"
                                  : "password"
                              }
                              className="form-input w-full pr-10"
                              value={user.password}
                              onChange={(e) => {
                                const updated = additionalUsers.map((u) =>
                                  u.id === user.id
                                    ? { ...u, password: e.target.value }
                                    : u
                                );
                                setAdditionalUsers(updated);
                              }}
                              placeholder="Enter password"
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                              onClick={() =>
                                setShowAdditionalUserPasswords((prev) => ({
                                  ...prev,
                                  [user.id]: !prev[user.id],
                                }))
                              }
                            >
                              {showAdditionalUserPasswords[user.id] ? (
                                <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {additionalUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No additional users added yet.</p>
                      <p className="text-xs">
                        Click "Add Additional User" to add more users.
                      </p>
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 mt-8">
                  <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                  Legal & Compliance
                </h3>
                {/* Legal & Compliance */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Registration Number */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Registration Number *
                    </label>
                    <input
                      type="text"
                      className={`form-input w-full ${
                        formErrors.registrationNumber ? "border-red-500" : ""
                      }`}
                      value={form.registrationNumber || ""}
                      onChange={(e) => {
                        if (e.target.value.length <= 20) {
                          setForm((f) => ({
                            ...f,
                            registrationNumber: e.target.value,
                          }));
                        }
                      }}
                      placeholder="Enter clinic registration number"
                      maxLength="20"
                    />
                    {formErrors.registrationNumber && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.registrationNumber}
                      </div>
                    )}
                  </div>

                  {/* GST Number */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      GST Number *
                    </label>
                    <input
                      type="text"
                      className={`form-input w-full ${
                        formErrors.gstNumber ? "border-red-500" : ""
                      }`}
                      value={form.gstNumber}
                      onChange={(e) => {
                        if (e.target.value.length <= 15) {
                          setForm((f) => ({ ...f, gstNumber: e.target.value }));
                        }
                      }}
                      placeholder="Enter GST number (15 digits)"
                      maxLength="15"
                    />
                    {formErrors.gstNumber && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.gstNumber}
                      </div>
                    )}
                  </div>

                  {/* PAN Number */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      PAN Number *
                    </label>
                    <input
                      type="text"
                      className={`form-input w-full ${
                        formErrors.panNumber ? "border-red-500" : ""
                      }`}
                      value={form.panNumber}
                      onChange={(e) => {
                        if (e.target.value.length <= 10) {
                          setForm((f) => ({ ...f, panNumber: e.target.value }));
                        }
                      }}
                      placeholder="Enter PAN number (10 characters)"
                      maxLength="10"
                    />
                    {formErrors.panNumber && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.panNumber}
                      </div>
                    )}
                  </div>

                  {/* TAN Number */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      TAN Number *
                    </label>
                    <input
                      type="text"
                      className={`form-input w-full ${
                        formErrors.tanNumber ? "border-red-500" : ""
                      }`}
                      value={form.tanNumber}
                      onChange={(e) => {
                        if (e.target.value.length <= 10) {
                          setForm((f) => ({ ...f, tanNumber: e.target.value }));
                        }
                      }}
                      placeholder="Enter TAN number (10 characters)"
                      maxLength="10"
                    />
                    {formErrors.tanNumber && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.tanNumber}
                      </div>
                    )}
                  </div>

                  {/* Bank Account Number */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Bank Account Number *
                    </label>
                    <input
                      type="text"
                      className={`form-input w-full ${
                        formErrors.bankAccountNumber ? "border-red-500" : ""
                      }`}
                      value={form.bankAccountNumber}
                      onChange={(e) => {
                        if (e.target.value.length <= 20) {
                          setForm((f) => ({
                            ...f,
                            bankAccountNumber: e.target.value,
                          }));
                        }
                      }}
                      placeholder="Enter bank account number"
                      maxLength="20"
                    />
                    {formErrors.bankAccountNumber && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.bankAccountNumber}
                      </div>
                    )}
                  </div>
                </div>

                {/* Single File Upload Section */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium mb-2">
                    Upload Compliance Documents
                  </label>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        complianceDocuments: e.target.files,
                      }))
                    }
                  />
                  <div className="text-sm text-gray-600 mt-2">
                    <strong>Note:</strong> Upload all compliance documents
                    (Registration Certificate, GST Certificate, PAN Card, TAN
                    Certificate, Bank Statement) in PDF or image format. Maximum
                    file size: 5MB per document.
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 mt-8">
                  <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                  Services & Specialties
                </h3>
                {/* Facilities & Operations */}
                <div className="mb-4">
                  <label className="block text-sm font-medium">
                    Services & Specialties Offered
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {[
                      "Physio",
                      "Minds",
                      "Balance",
                      "Eyes",
                      "ReproX",
                      "Nutrition",
                      "Blood parameters",
                      "Pharmacy",
                    ].map((service) => (
                      <label key={service} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={form.specialties.includes(service)}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              specialties: e.target.checked
                                ? [...f.specialties, service]
                                : f.specialties.filter((s) => s !== service),
                            }))
                          }
                        />
                        <span>{service}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 mt-8">
                  <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                  Clinic Validity Period
                </h3>
                {/* Validity Period */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className={`form-input w-full ${
                        formErrors.validityStartDate ? "border-red-500" : ""
                      }`}
                      required
                      value={form.validityStartDate}
                      onChange={(e) => {
                        const startDate = e.target.value;
                        setForm((f) => {
                          // Auto-calculate end date if duration is set
                          let endDate = f.validityEndDate;
                          if (f.validityDuration && startDate) {
                            const start = new Date(startDate);
                            const end = new Date(start);
                            end.setMonth(
                              end.getMonth() + parseInt(f.validityDuration)
                            );
                            endDate = end.toISOString().split("T")[0];
                          }
                          return {
                            ...f,
                            validityStartDate: startDate,
                            validityEndDate: endDate,
                          };
                        });
                      }}
                    />
                    {formErrors.validityStartDate && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.validityStartDate}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Duration (Months) <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={`form-select w-full ${
                        formErrors.validityDuration ? "border-red-500" : ""
                      }`}
                      required
                      value={form.validityDuration}
                      onChange={(e) => {
                        const duration = e.target.value;
                        setForm((f) => {
                          // Auto-calculate end date
                          let endDate = f.validityEndDate;
                          if (f.validityStartDate && duration) {
                            const start = new Date(f.validityStartDate);
                            const end = new Date(start);
                            end.setMonth(end.getMonth() + parseInt(duration));
                            endDate = end.toISOString().split("T")[0];
                          }
                          return {
                            ...f,
                            validityDuration: duration,
                            validityEndDate: endDate,
                          };
                        });
                      }}
                    >
                      <option value="12">12 Months (1 Year)</option>
                      <option value="24">24 Months (2 Years)</option>
                      <option value="36">36 Months (3 Years)</option>
                      <option value="48">48 Months (4 Years)</option>
                      <option value="60">60 Months (5 Years)</option>
                    </select>
                    {formErrors.validityDuration && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.validityDuration}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Minimum: 12 months (1 year)
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className={`form-input w-full ${
                        formErrors.validityEndDate ? "border-red-500" : ""
                      }`}
                      required
                      value={form.validityEndDate}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          validityEndDate: e.target.value,
                        }));
                      }}
                    />
                    {formErrors.validityEndDate && (
                      <div className="text-red-500 text-xs mt-1">
                        {formErrors.validityEndDate}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Auto-calculated based on start date and duration
                    </div>
                  </div>
                </div>

                {/* Validity Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">i</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 mb-1">
                        Clinic Validity Period
                      </h4>
                      <p className="text-sm text-blue-700">
                        This defines the operational validity period for the
                        clinic registration. The clinic must renew its validity
                        before the end date to continue operations. Minimum
                        validity period is 1 year from the start date.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg w-full mt-6 transition-colors"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Clinic"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Clinics List Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        {/* Search and Filter Section */}
        <div className="mb-6 space-y-4">
          {/* General Search Bar */}
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Quick search across all fields..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Toggle Advanced Filters */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`ml-4 px-4 py-2 text-sm font-medium rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center gap-2 ${
                filters.registrationNumber ||
                filters.name ||
                filters.type ||
                filters.country ||
                filters.status !== "all"
                  ? "text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100"
                  : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              Advanced Filters
              {(filters.registrationNumber ||
                filters.name ||
                filters.type ||
                filters.country ||
                filters.status !== "all") && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                  {
                    [
                      filters.registrationNumber,
                      filters.name,
                      filters.type,
                      filters.country,
                      filters.status !== "all" ? "status" : "",
                    ].filter(Boolean).length
                  }
                </span>
              )}
              {showAdvancedFilters ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Individual Search Fields */}
          {showAdvancedFilters && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Search by Individual Fields
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {/* Registration Number Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    Registration Number
                  </label>
                  <input
                    type="text"
                    placeholder="Search by reg. number..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filters.registrationNumber}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        registrationNumber: e.target.value,
                      })
                    }
                  />
                </div>

                {/* Clinic Name Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Clinic Name
                  </label>
                  <input
                    type="text"
                    placeholder="Search by name..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filters.name}
                    onChange={(e) =>
                      setFilters({ ...filters, name: e.target.value })
                    }
                  />
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    <Building className="h-3 w-3" />
                    Clinic Type
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filters.type}
                    onChange={(e) =>
                      setFilters({ ...filters, type: e.target.value })
                    }
                  >
                    <option value="">All Types</option>
                    <option value="Multi speciality">Multi speciality</option>
                    <option value="Properitor clinic">Proprietor clinic</option>
                    <option value="Dental">Dental</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="General / Family Medicine">
                      General / Family Medicine
                    </option>
                  </select>
                </div>

                {/* Country Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Country
                  </label>
                  <input
                    type="text"
                    placeholder="Search by country..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filters.country}
                    onChange={(e) =>
                      setFilters({ ...filters, country: e.target.value })
                    }
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Status
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filters.status}
                    onChange={(e) =>
                      setFilters({ ...filters, status: e.target.value })
                    }
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Clear Filters Button */}
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilters({
                      registrationNumber: "",
                      name: "",
                      type: "",
                      country: "",
                      status: "all",
                    });
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Clear All Filters
                </button>

                <div className="text-sm text-gray-600">
                  Showing {filteredClinics.length} of {clinics.length} clinics
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registration Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clinic Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Country
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Validity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  End Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClinics.map((clinic) => (
                <tr 
                  key={clinic._id} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedClinic(clinic)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    {clinic.registrationNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{clinic.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{clinic.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {clinic.country}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const duration = clinic.validityPeriod?.duration;
                      if (!duration) {
                        return (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                            No Duration Set
                          </span>
                        );
                      }

                      const years = Math.floor(duration / 12);
                      const months = duration % 12;
                      
                      if (years > 0 && months > 0) {
                        return (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {years} year{years > 1 ? 's' : ''} {months} month{months > 1 ? 's' : ''}
                          </span>
                        );
                      } else if (years > 0) {
                        return (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {years} year{years > 1 ? 's' : ''}
                          </span>
                        );
                      } else {
                        return (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {months} month{months > 1 ? 's' : ''}
                          </span>
                        );
                      }
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const validityEndDate = clinic.validityPeriod?.endDate
                        ? new Date(clinic.validityPeriod.endDate)
                        : clinic.validityEndDate
                        ? new Date(clinic.validityEndDate)
                        : null;

                      if (!validityEndDate) {
                        return (
                          <span className="text-gray-500 text-sm">
                            No End Date
                          </span>
                        );
                      }

                      const today = new Date();
                      const isExpired = validityEndDate < today;
                      const daysUntilExpiry = Math.ceil(
                        (validityEndDate - today) / (1000 * 60 * 60 * 24)
                      );

                      const formattedDate = validityEndDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });

                      if (isExpired) {
                        return (
                          <div className="flex flex-col">
                            <span className="text-red-600 text-sm font-medium">
                              {formattedDate}
                            </span>
                            <span className="text-red-500 text-xs">
                              Expired
                            </span>
                          </div>
                        );
                      } else if (daysUntilExpiry <= 30) {
                        return (
                          <div className="flex flex-col">
                            <span className="text-yellow-600 text-sm font-medium">
                              {formattedDate}
                            </span>
                            <span className="text-yellow-500 text-xs">
                              {daysUntilExpiry} days left
                            </span>
                          </div>
                        );
                      } else {
                        return (
                          <div className="flex flex-col">
                            <span className="text-green-600 text-sm font-medium">
                              {formattedDate}
                            </span>
                            <span className="text-green-500 text-xs">
                              Active
                            </span>
                          </div>
                        );
                      }
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                    <button
                      className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/clinic-edit?id=${clinic._id}`);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <button
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${
                          clinic.isActive ? "bg-gray-600" : "bg-gray-200"
                        }`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const response = await clinicsAPI.update(
                              clinic._id,
                              {
                                isActive: !clinic.isActive,
                              }
                            );
                            if (response.data.success) {
                              toast.success(
                                `Clinic marked as ${
                                  !clinic.isActive ? "Active" : "Inactive"
                                }`
                              );
                              fetchClinics();
                            } else {
                              toast.error(
                                response.data.message ||
                                  "Failed to update status"
                              );
                            }
                          } catch (err) {
                            toast.error("Failed to update status");
                          }
                        }}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            clinic.isActive ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span
                        className={`ml-3 text-sm font-medium ${
                          clinic.isActive ? "text-gray-700" : "text-gray-500"
                        }`}
                      >
                        {clinic.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredClinics.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No clinics found
            </h3>
            <p className="text-gray-500">
              Get started by adding your first clinic.
            </p>
          </div>
        )}
      </div>

      {/* Clinic Details Modal */}
      {selectedClinic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 relative overflow-hidden max-h-[90vh] border border-gray-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-6 relative">
              <button
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
                onClick={() => setSelectedClinic(null)}
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-100 rounded-xl">
                  <Building2 className="h-8 w-8 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedClinic.name}
                  </h2>
                  <p className="text-gray-600">{selectedClinic.type}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Status Badge */}
              <div className="mb-6">
                <span
                  className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
                    selectedClinic.isActive
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-gray-100 text-gray-600 border border-gray-200"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full mr-2 ${
                      selectedClinic.isActive ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></div>
                  {selectedClinic.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Basic Information */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                      Basic Information
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <label className="text-sm font-medium text-gray-500">
                          Clinic ID
                        </label>
                        <p className="text-gray-900 font-semibold">
                          {selectedClinic.clinicId || 'N/A'}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <label className="text-sm font-medium text-gray-500">
                          Registration Number
                        </label>
                        <p className="text-gray-900 font-semibold">
                          {selectedClinic.registrationNumber || 'N/A'}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <label className="text-sm font-medium text-gray-500">
                          Year Established
                        </label>
                        <p className="text-gray-900 font-semibold">
                          {selectedClinic.yearOfEstablishment || 'N/A'}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <label className="text-sm font-medium text-gray-500">
                          Website
                        </label>
                        <p className="text-gray-900 font-semibold">
                          {selectedClinic.website || 'Not provided'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                      Contact Information
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <label className="text-sm font-medium text-gray-500">
                          Address
                        </label>
                        <p className="text-gray-900 font-semibold">
                          {selectedClinic.address || 'N/A'}
                        </p>
                        <p className="text-gray-600 text-sm">
                          {selectedClinic.city || 'N/A'}, {selectedClinic.state || 'N/A'}, {selectedClinic.country || 'N/A'} - {selectedClinic.zipCode || 'N/A'}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl">
                          <label className="text-sm font-medium text-gray-500">
                            Phone
                          </label>
                          <p className="text-gray-900 font-semibold">
                            {selectedClinic.phone || 'N/A'}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl">
                          <label className="text-sm font-medium text-gray-500">
                            Email
                          </label>
                          <p className="text-gray-900 font-semibold">
                            {selectedClinic.email || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Administration & Services */}
                <div className="space-y-6">
                  {/* Administration */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                      Administration
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <label className="text-sm font-medium text-gray-500">
                          Owner Name
                        </label>
                        <p className="text-gray-900 font-semibold">
                          {selectedClinic.ownerName || 'N/A'}
                        </p>
                        {selectedClinic.ownerMedicalId && (
                          <p className="text-gray-600 text-sm">
                            Medical ID: {selectedClinic.ownerMedicalId}
                          </p>
                        )}
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <label className="text-sm font-medium text-gray-500">
                          Admin Contact
                        </label>
                        <p className="text-gray-900 font-semibold">
                          {selectedClinic.adminContact || 'N/A'}
                        </p>
                        <p className="text-gray-600 text-sm">
                          {selectedClinic.adminEmail || 'N/A'}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <label className="text-sm font-medium text-gray-500">
                          Admin Username
                        </label>
                        <p className="text-gray-900 font-semibold">
                          {selectedClinic.adminUsername || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Services & Specialties */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                      Services & Specialties
                    </h3>
                    <div className="space-y-4">
                      {selectedClinic.specialties && selectedClinic.specialties.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-xl">
                          <label className="text-sm font-medium text-gray-500 mb-2 block">
                            Specialties
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {selectedClinic.specialties.map((specialty, index) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full border border-gray-200"
                              >
                                {specialty}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedClinic.services && selectedClinic.services.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-xl">
                          <label className="text-sm font-medium text-gray-500 mb-2 block">
                            Services
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {selectedClinic.services.map((service, index) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full border border-gray-200"
                              >
                                {service}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedClinic.operatingHours && (
                        <div className="bg-gray-50 p-4 rounded-xl">
                          <label className="text-sm font-medium text-gray-500">
                            Operating Hours
                          </label>
                          <p className="text-gray-900 font-semibold">
                            {selectedClinic.operatingHours}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Information */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                  Financial Information
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <label className="text-sm font-medium text-gray-500">
                        GST Number
                      </label>
                      <p className="text-gray-900 font-semibold">
                        {selectedClinic.gstNumber || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <label className="text-sm font-medium text-gray-500">
                        PAN Number
                      </label>
                      <p className="text-gray-900 font-semibold">
                        {selectedClinic.panNumber || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <label className="text-sm font-medium text-gray-500">
                        TAN Number
                      </label>
                      <p className="text-gray-900 font-semibold">
                        {selectedClinic.tanNumber || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <label className="text-sm font-medium text-gray-500">
                        Bank Account Number
                      </label>
                      <p className="text-gray-900 font-semibold">
                        {selectedClinic.bankAccountNumber || 'N/A'}
                      </p>
                    </div>
                    {selectedClinic.bankInfo && (
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <label className="text-sm font-medium text-gray-500">
                          Bank Information
                        </label>
                        <p className="text-gray-900 font-semibold">
                          {selectedClinic.bankInfo}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Validity Information */}
              {selectedClinic.validityPeriod && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                    Validity Information
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <label className="text-sm font-medium text-gray-500">
                        Start Date
                      </label>
                      <p className="text-gray-900 font-semibold">
                        {selectedClinic.validityPeriod.startDate ? new Date(selectedClinic.validityPeriod.startDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <label className="text-sm font-medium text-gray-500">
                        End Date
                      </label>
                      <p className="text-gray-900 font-semibold">
                        {selectedClinic.validityPeriod.endDate ? new Date(selectedClinic.validityPeriod.endDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <label className="text-sm font-medium text-gray-500">
                        Duration (Months)
                      </label>
                      <p className="text-gray-900 font-semibold">
                        {selectedClinic.validityPeriod.duration || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <span
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
                        selectedClinic.validityPeriod.isExpired
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-green-50 text-green-700 border border-green-200"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mr-2 ${
                          selectedClinic.validityPeriod.isExpired ? "bg-red-500" : "bg-green-500"
                        }`}
                      ></div>
                      {selectedClinic.validityPeriod.isExpired ? "Expired" : "Active"}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              {selectedClinic.paymentMethods && selectedClinic.paymentMethods.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                    Payment Methods
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <label className="text-sm font-medium text-gray-500 mb-2 block">
                      Accepted Payment Methods
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedClinic.paymentMethods.map((method, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full border border-gray-200"
                        >
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Users */}
              {selectedClinic.additionalUsers && selectedClinic.additionalUsers.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                    Additional Users
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="space-y-2">
                      {selectedClinic.additionalUsers.map((user, index) => (
                        <div key={index} className="text-sm text-gray-700">
                          {user}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Compliance Documents */}
              {selectedClinic.complianceDocuments && selectedClinic.complianceDocuments.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-gray-400 rounded-full"></div>
                    Compliance Documents
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <div className="space-y-2">
                      {selectedClinic.complianceDocuments.map((doc, index) => (
                        <div key={index} className="text-sm text-gray-700">
                          {doc}
                        </div>
                      ))}
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

export default Clinics;
