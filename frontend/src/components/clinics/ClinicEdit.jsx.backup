import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { clinicsAPI } from "../../services/api";
import { toast } from "react-hot-toast";
import "./Clinics.css";

const specialtiesList = [
  "Physio",
  "Minds",
  "Balance",
  "Eyes",
  "Repro X",
  "Nutrition",
  "Blood parameters",
  "Pharmacy",
];
const clinicTypes = ["Multi speciality", "Properitor clinic"];

const ClinicEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const clinicId = params.get("id");
  const [clinic, setClinic] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [additionalUsers, setAdditionalUsers] = useState([]);

  // Password visibility states
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdditionalUserPasswords, setShowAdditionalUserPasswords] =
    useState({});

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const response = await clinicsAPI.getById(clinicId);
        if (response.data.success) {
          const clinicData = response.data.clinic;
          setClinic(clinicData);
          
          // Map validity period data to form fields
          const validityPeriod = clinicData.validityPeriod || {};
          const mappedForm = {
            ...clinicData,
            // Map validity period fields
            validityStartDate: validityPeriod.startDate ? 
              new Date(validityPeriod.startDate).toISOString().split('T')[0] : '',
            validityEndDate: validityPeriod.endDate ? 
              new Date(validityPeriod.endDate).toISOString().split('T')[0] : '',
            validityDurationMonths: validityPeriod.duration ? 
              validityPeriod.duration.toString() : '12'
          };
          
          setForm(mappedForm);
          setAdditionalUsers(clinicData.additionalUsers || []);
        } else {
          toast.error("Clinic not found");
          navigate("/clinics");
        }
      } catch (err) {
        toast.error("Failed to fetch clinic");
        navigate("/clinics");
      }
    };
    if (clinicId) fetchClinic();
  }, [clinicId, navigate]);

  if (!clinic) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setForm((f) => ({ ...f, [name]: checked }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleArrayChange = (field, item) => {
    setForm((f) => ({
      ...f,
      [field]: f[field]?.includes(item)
        ? f[field].filter((i) => i !== item)
        : [...(f[field] || []), item],
    }));
  };

  const handleDocumentUpload = (docType, file) => {
    // For now, store the file object - in a real app, you'd upload to a server
    setForm((prev) => ({
      ...prev,
      complianceDocuments: {
        ...prev.complianceDocuments,
        [docType]: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          // In production, this would be a URL after server upload
          file: file,
        },
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic validation (add more as needed)
    const errors = {};
    if (!form.name) errors.name = "Clinic Name is required";
    if (!form.type) errors.type = "Type of Clinic is required";
    if (!form.registrationNumber)
      errors.registrationNumber = "Registration Number is required";
    else if (form.registrationNumber.length > 20)
      errors.registrationNumber =
        "Registration Number must not exceed 20 characters";
    if (!form.address) errors.address = "Official Address is required";
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
    if (!form.ownerName) errors.ownerName = "Owner/Director Name is required";
    if (!form.adminContact)
      errors.adminContact = "Admin Contact Number is required";
    else if (!/^\d{10}$/.test(form.adminContact))
      errors.adminContact = "Admin Contact Number must be exactly 10 digits";
    if (!form.adminEmail) errors.adminEmail = "Admin Email is required";
    if (!form.adminUsername)
      errors.adminUsername = "Admin Username is required";
    if (!form.adminPassword)
      errors.adminPassword = "Admin Password is required";
    else if (form.adminPassword.length < 6)
      errors.adminPassword = "Password must be at least 6 characters";
    
    // Legal & Compliance validation - only validate if fields are provided
    if (form.gstNumber && form.gstNumber.length > 0 && form.gstNumber.length !== 15)
      errors.gstNumber = "GST Number must be exactly 15 characters";
    if (form.panNumber && form.panNumber.length > 0 && form.panNumber.length !== 10)
      errors.panNumber = "PAN Number must be exactly 10 characters";
    if (form.tanNumber && form.tanNumber.length > 0 && form.tanNumber.length !== 10)
      errors.tanNumber = "TAN Number must be exactly 10 characters";
    if (form.bankAccountNumber && form.bankAccountNumber.length > 0 && form.bankAccountNumber.length > 20)
      errors.bankAccountNumber = "Bank Account Number must not exceed 20 characters";
    
    // Validity period validation - make it more lenient
    if (!form.validityStartDate)
      errors.validityStartDate = "Start Date is required";
    if (!form.validityEndDate)
      errors.validityEndDate = "End Date is required";
    if (!form.validityDurationMonths)
      errors.validityDurationMonths = "Duration is required";
    
    // Validate date range (must be at least 1 year) - but don't fail if dates are missing
    if (form.validityStartDate && form.validityEndDate) {
      const startDate = new Date(form.validityStartDate);
      const endDate = new Date(form.validityEndDate);
      const oneYearFromStart = new Date(startDate);
      oneYearFromStart.setFullYear(oneYearFromStart.getFullYear() + 1);
      
      if (endDate < oneYearFromStart) {
        errors.validityEndDate = "End date must be at least 1 year from start date";
      }
    }
    
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      console.log("Form validation errors:", errors);
      toast.error("Please fix the validation errors before saving");
      return;
    }
    
    console.log("Form validation passed, proceeding with save...");
    setSaving(true);
    try {
      // Create clean form data with only valid backend fields
      const formDataWithUsers = {
        // Basic Information
        name: form.name,
        type: form.type,
        registrationNumber: form.registrationNumber,
        yearOfEstablishment: form.yearOfEstablishment,

        // Contact & Location
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country,
        zipCode: form.zipCode,
        phone: form.phone,
        email: form.email,
        website: form.website,

        // Ownership & Administration
        ownerName: form.ownerName,
        ownerMedicalId: form.ownerMedicalId,
        adminContact: form.adminContact,
        adminEmail: form.adminEmail,
        adminUsername: form.adminUsername,
        adminPassword: form.adminPassword,

        // Legal & Compliance
        gstNumber: form.gstNumber || "",
        panNumber: form.panNumber || "",
        tanNumber: form.tanNumber || "",
        bankAccountNumber: form.bankAccountNumber || "",

        // Services & Specialties
        specialties: form.specialties || [],
        services: form.services || [],
        operatingHours: form.operatingHours || "",
        paymentMethods: form.paymentMethods || [],
        bankInfo: form.bankInfo || "",

        // Additional fields
        isActive: form.isActive !== undefined ? form.isActive : true,

        // Validity Period - ensure proper structure
        validityPeriod: {
          startDate: form.validityStartDate ? new Date(form.validityStartDate) : new Date(),
          endDate: form.validityEndDate ? new Date(form.validityEndDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          duration: parseInt(form.validityDurationMonths) || 12,
          isExpired: form.validityEndDate ? new Date(form.validityEndDate) < new Date() : false
        },

        // Additional Users
        additionalUsers: additionalUsers || [],
      };

      console.log("Sending update data:", formDataWithUsers);
      console.log("Validity period being sent:", formDataWithUsers.validityPeriod);
      console.log("Clinic ID:", clinicId);
      
      const response = await clinicsAPI.update(clinicId, formDataWithUsers);
      console.log("Update response:", response);
      if (response.data.success) {
        toast.success("Clinic updated successfully");
        navigate("/clinics");
      } else {
        console.error("Update failed:", response.data);
        console.error("Full response:", response);
        toast.error(response.data.message || "Failed to update clinic");
      }
    } catch (err) {
      console.error("Clinic update error:", err);
      console.error("Error response:", err.response);
      console.error("Error response data:", err.response?.data);
      console.error("Error status:", err.response?.status);
      
      let errorMessage = "Failed to update clinic";
      
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        // Handle validation errors from backend
        const validationErrors = err.response.data.errors.map(err => 
          `${err.field}: ${err.message}`
        ).join(', ');
        errorMessage = `Validation failed: ${validationErrors}`;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Clinic</h1>
          <p className="text-gray-600">
            Update clinic information and settings
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100">
          <form onSubmit={handleSubmit}>
            {/* Basic Information */}
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium">
                  Clinic Name <span className="text-red-500">*</span>
                </label>
                <input
                  className={`form-input w-full ${
                    formErrors.name ? "border-red-500" : ""
                  }`}
                  name="name"
                  required
                  value={form.name || ""}
                  onChange={handleChange}
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
                  name="type"
                  required
                  value={form.type || ""}
                  onChange={handleChange}
                >
                  <option value="">Select type</option>
                  {clinicTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {formErrors.type && (
                  <div className="text-red-500 text-xs mt-1">
                    {formErrors.type}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Registration Number <span className="text-red-500">*</span>
                </label>
                <input
                  className={`form-input w-full ${
                    formErrors.registrationNumber ? "border-red-500" : ""
                  }`}
                  name="registrationNumber"
                  required
                  value={form.registrationNumber || ""}
                  onChange={handleChange}
                />
                {formErrors.registrationNumber && (
                  <div className="text-red-500 text-xs mt-1">
                    {formErrors.registrationNumber}
                  </div>
                )}
              </div>
            </div>
            {/* Contact & Location */}
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2 mt-6">
              Contact & Location
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium">
                  Official Address <span className="text-red-500">*</span>
                </label>
                <input
                  className={`form-input w-full ${
                    formErrors.address ? "border-red-500" : ""
                  }`}
                  name="address"
                  required
                  value={form.address || ""}
                  onChange={handleChange}
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
                  name="city"
                  required
                  value={form.city || ""}
                  onChange={handleChange}
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
                  name="state"
                  required
                  value={form.state || ""}
                  onChange={handleChange}
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
                  name="country"
                  required
                  value={form.country || ""}
                  onChange={handleChange}
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
                  name="zipCode"
                  required
                  value={form.zipCode || ""}
                  onChange={handleChange}
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
                  name="phone"
                  required
                  value={form.phone || ""}
                  onChange={handleChange}
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
                  name="email"
                  required
                  type="email"
                  value={form.email || ""}
                  onChange={handleChange}
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
                  name="website"
                  value={form.website || ""}
                  onChange={handleChange}
                />
              </div>
            </div>
            {/* Ownership & Administration */}
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2 mt-6">
              Ownership & Administration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium">
                  Owner/Director Name <span className="text-red-500">*</span>
                </label>
                <input
                  className={`form-input w-full ${
                    formErrors.ownerName ? "border-red-500" : ""
                  }`}
                  name="ownerName"
                  required
                  value={form.ownerName || ""}
                  onChange={handleChange}
                />
                {formErrors.ownerName && (
                  <div className="text-red-500 text-xs mt-1">
                    {formErrors.ownerName}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Admin Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  className={`form-input w-full ${
                    formErrors.adminContact ? "border-red-500" : ""
                  }`}
                  name="adminContact"
                  required
                  value={form.adminContact || ""}
                  onChange={handleChange}
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
                  name="adminEmail"
                  required
                  type="email"
                  value={form.adminEmail || ""}
                  onChange={handleChange}
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
                  name="adminUsername"
                  required
                  value={form.adminUsername || ""}
                  onChange={handleChange}
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
                    name="adminPassword"
                    required
                    type={showAdminPassword ? "text" : "password"}
                    value={form.adminPassword || ""}
                    onChange={handleChange}
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
                        _id: Date.now(),
                        name: "",
                        phone: "",
                        email: "",
                        password: "",
                      },
                    ]);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span className="text-lg">+</span>
                  Add Additional User
                </button>
              </div>

              {additionalUsers.map((user, index) => (
                <div
                  key={user._id || index}
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
                          additionalUsers.filter((_, i) => i !== index)
                        );
                      }}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      ✕
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
                          const updated = [...additionalUsers];
                          updated[index] = {
                            ...updated[index],
                            name: e.target.value,
                          };
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
                          const updated = [...additionalUsers];
                          updated[index] = {
                            ...updated[index],
                            phone: e.target.value,
                          };
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
                          const updated = [...additionalUsers];
                          updated[index] = {
                            ...updated[index],
                            email: e.target.value,
                          };
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
                            showAdditionalUserPasswords[user._id || index]
                              ? "text"
                              : "password"
                          }
                          className="form-input w-full pr-10"
                          value={user.password}
                          onChange={(e) => {
                            const updated = [...additionalUsers];
                            updated[index] = {
                              ...updated[index],
                              password: e.target.value,
                            };
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
                              [user._id || index]: !prev[user._id || index],
                            }))
                          }
                        >
                          {showAdditionalUserPasswords[user._id || index] ? (
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
            {/* Legal & Compliance */}
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2 mt-6">
              Legal & Compliance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium">GST Number</label>
                <input
                  className="form-input w-full"
                  name="gstNumber"
                  value={form.gstNumber || ""}
                  onChange={handleChange}
                  placeholder="Enter GST Number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">PAN Number</label>
                <input
                  className="form-input w-full"
                  name="panNumber"
                  value={form.panNumber || ""}
                  onChange={handleChange}
                  placeholder="Enter PAN Number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">TAN Number</label>
                <input
                  className="form-input w-full"
                  name="tanNumber"
                  value={form.tanNumber || ""}
                  onChange={handleChange}
                  placeholder="Enter TAN Number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Bank Account Number
                </label>
                <input
                  className="form-input w-full"
                  name="bankAccountNumber"
                  value={form.bankAccountNumber || ""}
                  onChange={handleChange}
                  placeholder="Enter Bank Account Number"
                />
              </div>
            </div>

            {/* Compliance Documents Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Compliance Documents
              </label>
              <div className="text-xs text-gray-600 mb-2">
                Upload documents (Trade License, Medical Registration, Insurance
                Certificate, Other Documents)
              </div>
              <input
                type="file"
                className="form-input w-full p-2 text-sm"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    // Handle multiple files
                    Array.from(e.target.files).forEach((file, index) => {
                      handleDocumentUpload(`document_${index}`, file);
                    });
                  }
                }}
              />
              <div className="text-xs text-gray-500 mt-1">
                Accepted formats: PDF, JPG, JPEG, PNG, DOC, DOCX. You can select
                multiple files.
              </div>
            </div>
            {/* Services & Specialties */}
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2 mt-6">
              Services & Specialties
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium">
                Specialties Offered
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {specialtiesList.map((spec) => (
                  <label key={spec} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={form.specialties?.includes(spec) || false}
                      onChange={() => handleArrayChange("specialties", spec)}
                    />
                    <span>{spec}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Clinic Validity Period */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="text-md font-semibold text-gray-800 mb-4">
                Clinic Validity Period
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className={`form-input w-full ${
                      formErrors.validityStartDate ? "border-red-500" : ""
                    }`}
                    name="validityStartDate"
                    value={form.validityStartDate || ""}
                    onChange={(e) => {
                      handleChange(e);
                      // Auto-calculate end date when start date or duration changes
                      if (e.target.value && form.validityDurationMonths) {
                        const startDate = new Date(e.target.value);
                        const endDate = new Date(startDate);
                        const monthsToAdd = parseInt(form.validityDurationMonths);
                        
                        // Ensure we add at least 12 months (1 year)
                        const actualMonths = Math.max(monthsToAdd, 12);
                        endDate.setMonth(endDate.getMonth() + actualMonths);
                        
                        setForm((prev) => ({
                          ...prev,
                          validityEndDate: endDate.toISOString().split("T")[0],
                        }));
                      }
                    }}
                  />
                  {formErrors.validityStartDate && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.validityStartDate}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Duration (Months) <span className="text-red-500">*</span>
                  </label>
                  <select
                    className={`form-select w-full ${
                      formErrors.validityDurationMonths ? "border-red-500" : ""
                    }`}
                    name="validityDurationMonths"
                    value={form.validityDurationMonths || "12"}
                    onChange={(e) => {
                      handleChange(e);
                      // Auto-calculate end date when duration changes
                      if (form.validityStartDate && e.target.value) {
                        const startDate = new Date(form.validityStartDate);
                        const endDate = new Date(startDate);
                        const monthsToAdd = parseInt(e.target.value);
                        
                        // Ensure we add at least 12 months (1 year)
                        const actualMonths = Math.max(monthsToAdd, 12);
                        endDate.setMonth(endDate.getMonth() + actualMonths);
                        
                        setForm((prev) => ({
                          ...prev,
                          validityEndDate: endDate.toISOString().split("T")[0],
                        }));
                      }
                    }}
                    onClick={() => {
                      // Auto-fill from today to 1 year after if no start date is set
                      if (!form.validityStartDate) {
                        const today = new Date();
                        const oneYearFromToday = new Date(today);
                        oneYearFromToday.setFullYear(oneYearFromToday.getFullYear() + 1);
                        
                        setForm((prev) => ({
                          ...prev,
                          validityStartDate: today.toISOString().split('T')[0],
                          validityEndDate: oneYearFromToday.toISOString().split('T')[0],
                          validityDurationMonths: '12'
                        }));
                      }
                    }}
                  >
                    <option value="12">12 Months (1 Year)</option>
                    <option value="24">24 Months (2 Years)</option>
                    <option value="36">36 Months (3 Years)</option>
                    <option value="48">48 Months (4 Years)</option>
                    <option value="60">60 Months (5 Years)</option>
                  </select>
                  {formErrors.validityDurationMonths && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.validityDurationMonths}
                    </p>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    Minimum: 12 months (1 year) - Click to auto-fill from today
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className={`form-input w-full bg-gray-100 ${
                      formErrors.validityEndDate ? "border-red-500" : ""
                    }`}
                    name="validityEndDate"
                    value={form.validityEndDate || ""}
                    readOnly
                    placeholder="dd-mm-yyyy"
                  />
                  {formErrors.validityEndDate && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.validityEndDate}
                    </p>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    Auto-calculated based on start date and duration
                  </div>
                </div>
              </div>

              {/* Information Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  i
                </div>
                <div>
                  <h5 className="text-sm font-medium text-blue-800 mb-1">
                    Clinic Validity Period
                  </h5>
                  <p className="text-sm text-blue-700">
                    This defines the operational validity period for the clinic
                    registration. The clinic must renew its validity before the
                    end date to continue operations. Minimum validity period is
                    1 year from the start date.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                type="submit"
                className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-xl transition-colors flex-1"
                disabled={saving}
              >
                {saving ? "Updating..." : "Update Clinic"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/clinics")}
                className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClinicEdit;
