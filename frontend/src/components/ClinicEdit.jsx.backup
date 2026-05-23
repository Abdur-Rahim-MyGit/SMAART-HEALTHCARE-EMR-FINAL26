import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { clinicsAPI } from "../../services/api";
import { toast } from "react-hot-toast";
import PasswordInput from "../common/PasswordInput";
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
const servicesList = ["Consultation", "Lab Tests", "Pharmacy", "Surgery"];
const clinicTypes = ["Multi speciality", "Properitor clinic"];

const ClinicEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const clinicId = params.get("id");
  const [clinic, setClinic] = useState(null);
  const [saving, setSaving] = useState(false);
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
    adminContact: "",
    adminEmail: "",
    adminUsername: "",
    adminPassword: "",
    gstNumber: "",
    panNumber: "",
    tanNumber: "",
    bankAccountNumber: "",
    specialties: [],
    services: [],
    validityPeriodMonths: "",
    validityPeriodYears: "",
    validityStartDate: new Date().toISOString().split("T")[0],
    validityEndDate: "",
    validityDuration: "12",
  });
  const [formErrors, setFormErrors] = useState({});
  const [additionalUsers, setAdditionalUsers] = useState([]);

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const response = await clinicsAPI.getById(clinicId);
        if (response.data.success) {
          const clinicData = response.data.clinic;
          setClinic(clinicData);

          // Populate form with clinic data matching backend structure
          setForm({
            name: clinicData.name || "",
            type: clinicData.type || "",
            registrationNumber: clinicData.registrationNumber || "",
            yearOfEstablishment: clinicData.yearOfEstablishment || "",
            address: clinicData.address || "",
            city: clinicData.city || "",
            state: clinicData.state || "",
            country: clinicData.country || "",
            zipCode: clinicData.zipCode || "",
            phone: clinicData.phone || "",
            email: clinicData.email || "",
            website: clinicData.website || "",
            ownerName: clinicData.ownerName || "",
            ownerMedicalId: clinicData.ownerMedicalId || "",
            adminContact: clinicData.adminContact || "",
            adminEmail: clinicData.adminEmail || "",
            adminUsername: clinicData.adminUsername || "",
            adminPassword: clinicData.adminPassword || "",
            gstNumber: clinicData.gstNumber || "",
            panNumber: clinicData.panNumber || "",
            tanNumber: clinicData.tanNumber || "",
            bankAccountNumber: clinicData.bankAccountNumber || "",
            specialties: clinicData.specialties || [],
            services: clinicData.services || [],
            validityStartDate: clinicData.validityPeriod?.startDate
              ? new Date(clinicData.validityPeriod.startDate)
                  .toISOString()
                  .split("T")[0]
              : new Date().toISOString().split("T")[0],
            validityEndDate: clinicData.validityPeriod?.endDate
              ? new Date(clinicData.validityPeriod.endDate)
                  .toISOString()
                  .split("T")[0]
              : "",
            validityDuration:
              clinicData.validityPeriod?.duration?.toString() || "12",
            complianceDocuments: clinicData.complianceDocuments || {},
          });

          // Load existing partners only (don't create empty slots)
          const existingUsers = clinicData.additionalUsers || [];
          setAdditionalUsers(existingUsers);
        } else {
          toast.error("Clinic not found");
          navigate("/clinics");
        }
      } catch (err) {
        console.error("Error fetching clinic:", err);
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
    if (!form.address) errors.address = "Official Address is required";
    if (!form.city) errors.city = "City is required";
    if (!form.state) errors.state = "State is required";
    if (!form.country) errors.country = "Country is required";
    if (!form.zipCode) errors.zipCode = "Zip Code is required";
    if (!form.phone) errors.phone = "Phone Number is required";
    if (!form.email) errors.email = "Email Address is required";
    if (!form.ownerName) errors.ownerName = "Owner/Director Name is required";
    if (!form.adminContact)
      errors.adminContact = "Admin Contact Number is required";
    if (!form.adminEmail) errors.adminEmail = "Admin Email is required";
    if (!form.adminUsername)
      errors.adminUsername = "Admin Username is required";
    if (!form.adminPassword)
      errors.adminPassword = "Admin Password is required";

    // Validate partners for login capability
    additionalUsers.forEach((user, index) => {
      // If partner exists, validate all required fields
      if (!user.name)
        errors[`additionalUser${index}Name`] = `Partner ${
          index + 1
        } Name is required`;
      if (!user.email)
        errors[`additionalUser${index}Email`] = `Partner ${
          index + 1
        } Email is required`;
      if (!user.password)
        errors[`additionalUser${index}Password`] = `Partner ${
          index + 1
        } Password is required`;

      // Validate email format if provided
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (user.email && !emailRegex.test(user.email)) {
        errors[`additionalUser${index}Email`] = `Partner ${
          index + 1
        } Email format is invalid`;
      }

      // Check for duplicate emails
      if (user.email && user.email === form.adminEmail) {
        errors[`additionalUser${index}Email`] = `Partner ${
          index + 1
        } Email cannot be same as main owner email`;
      }

      // Check for duplicate emails among partners
      if (user.email) {
        const duplicateEmail = additionalUsers.find(
          (otherUser, otherIndex) =>
            otherIndex !== index && otherUser.email === user.email
        );
        if (duplicateEmail) {
          errors[`additionalUser${index}Email`] = `Partner ${
            index + 1
          } Email must be unique`;
        }
      }
    });

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      // Prepare validity period data
      const startDate = form.validityStartDate
        ? new Date(form.validityStartDate)
        : new Date();
      let endDate;

      if (form.validityEndDate) {
        endDate = new Date(form.validityEndDate);
      } else if (form.validityDuration) {
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + parseInt(form.validityDuration));
      } else {
        endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Create clean form data matching backend structure
      const formDataWithUsers = {
        // Basic Information
        name: form.name,
        type: form.type,
        registrationNumber: form.registrationNumber,
        yearOfEstablishment: form.yearOfEstablishment
          ? parseInt(form.yearOfEstablishment)
          : undefined,

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
        gstNumber: form.gstNumber,
        panNumber: form.panNumber,
        tanNumber: form.tanNumber,
        bankAccountNumber: form.bankAccountNumber,
        complianceDocuments: form.complianceDocuments,

        // Services & Specialties
        specialties: form.specialties,

        // Validity Period (matching backend structure)
        validityPeriod: {
          startDate: startDate,
          endDate: endDate,
          duration: Math.ceil(
            (endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44)
          ),
        },

        // Additional Users (clean up invalid IDs)
        additionalUsers: additionalUsers
          .map((user) => {
            const cleanUser = { ...user };
            // Remove _id if it's not a valid MongoDB ObjectId
            if (
              cleanUser._id &&
              (typeof cleanUser._id === "number" ||
                !/^[0-9a-fA-F]{24}$/.test(cleanUser._id))
            ) {
              delete cleanUser._id;
            }
            return cleanUser;
          })
          .filter((user) => user.name && user.email), // Only include valid users
      };

      const response = await clinicsAPI.update(clinicId, formDataWithUsers);
      if (response.data.success) {
        toast.success("Clinic updated successfully");
        navigate("/clinics");
      } else {
        toast.error(response.data.message || "Failed to update clinic");
      }
    } catch (err) {
      console.error("Clinic update error:", err);
      const errorMessage =
        err.response?.data?.message || err.message || "Failed to update clinic";
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
                <PasswordInput
                  className={`form-input w-full ${
                    formErrors.adminPassword ? "border-red-500" : ""
                  }`}
                  name="adminPassword"
                  required
                  value={form.adminPassword || ""}
                  onChange={handleChange}
                />
                {formErrors.adminPassword && (
                  <div className="text-red-500 text-xs mt-1">
                    {formErrors.adminPassword}
                  </div>
                )}
              </div>
            </div>

            {/* Ownership Structure Section */}
            <div className="mt-6">
              <div className="mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-md font-medium text-gray-900">
                      Ownership Structure
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      The main owner is set above. Add up to 2 partners who will
                      have full admin access to the clinic system.
                    </p>
                  </div>
                  {additionalUsers.length < 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdditionalUsers([
                          ...additionalUsers,
                          {
                            name: "",
                            phone: "",
                            email: "",
                            password: "",
                          },
                        ]);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors border border-green-200"
                    >
                      <span className="text-lg">+</span>
                      Add Partner
                    </button>
                  )}
                </div>
              </div>

              {/* Main Owner Display */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="text-sm font-medium text-blue-800 mb-2">
                  👑 Main Owner
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
                  <div>
                    <strong>Name:</strong> {form.ownerName || "Not specified"}
                  </div>
                  <div>
                    <strong>Email:</strong> {form.adminEmail || "Not specified"}
                  </div>
                  <div>
                    <strong>Username:</strong>{" "}
                    {form.adminUsername || "Not specified"}
                  </div>
                  <div>
                    <strong>Contact:</strong>{" "}
                    {form.adminContact || "Not specified"}
                  </div>
                </div>
              </div>

              {additionalUsers.map((user, index) => (
                <div
                  key={user._id || user.email || index}
                  className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200"
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🤝</span>
                      <h5 className="text-sm font-medium text-green-800">
                        Partner {index + 1}
                      </h5>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Remove the partner completely
                        setAdditionalUsers(
                          additionalUsers.filter((_, i) => i !== index)
                        );
                      }}
                      className="text-red-500 hover:text-red-700 transition-colors"
                      title="Remove partner"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Partner Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className={`form-input w-full ${
                          formErrors[`additionalUser${index}Name`]
                            ? "border-red-500"
                            : ""
                        }`}
                        value={user.name}
                        onChange={(e) => {
                          const updated = [...additionalUsers];
                          updated[index] = {
                            ...updated[index],
                            name: e.target.value,
                          };
                          setAdditionalUsers(updated);
                        }}
                        placeholder="Enter partner name"
                      />
                      {formErrors[`additionalUser${index}Name`] && (
                        <div className="text-red-500 text-xs mt-1">
                          {formErrors[`additionalUser${index}Name`]}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Phone Number
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
                        placeholder="Enter partner phone number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Login Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        className={`form-input w-full ${
                          formErrors[`additionalUser${index}Email`]
                            ? "border-red-500"
                            : ""
                        }`}
                        value={user.email}
                        onChange={(e) => {
                          const updated = [...additionalUsers];
                          updated[index] = {
                            ...updated[index],
                            email: e.target.value,
                          };
                          setAdditionalUsers(updated);
                        }}
                        placeholder="Enter partner login email"
                      />
                      {formErrors[`additionalUser${index}Email`] && (
                        <div className="text-red-500 text-xs mt-1">
                          {formErrors[`additionalUser${index}Email`]}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Login Password <span className="text-red-500">*</span>
                      </label>
                      <PasswordInput
                        className={`form-input w-full ${
                          formErrors[`additionalUser${index}Password`]
                            ? "border-red-500"
                            : ""
                        }`}
                        value={user.password}
                        onChange={(e) => {
                          const updated = [...additionalUsers];
                          updated[index] = {
                            ...updated[index],
                            password: e.target.value,
                          };
                          setAdditionalUsers(updated);
                        }}
                        placeholder="Enter partner login password"
                      />
                      {formErrors[`additionalUser${index}Password`] && (
                        <div className="text-red-500 text-xs mt-1">
                          {formErrors[`additionalUser${index}Password`]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {additionalUsers.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🤝</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        No partners added yet
                      </p>
                      <p className="text-xs mt-1">
                        Click "Add Partner" to add clinic partners with admin
                        access.
                      </p>
                    </div>
                  </div>
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
              <label className="block text-sm font-medium mb-3">
                Compliance Documents
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-2">
                    Trade License
                  </label>
                  <input
                    type="file"
                    className="form-input w-full p-2 text-sm"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleDocumentUpload("tradeLicense", e.target.files[0]);
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-2">
                    Medical Registration
                  </label>
                  <input
                    type="file"
                    className="form-input w-full p-2 text-sm"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleDocumentUpload(
                          "medicalRegistration",
                          e.target.files[0]
                        );
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-2">
                    Insurance Certificate
                  </label>
                  <input
                    type="file"
                    className="form-input w-full p-2 text-sm"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleDocumentUpload(
                          "insuranceCertificate",
                          e.target.files[0]
                        );
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-2">
                    Other Documents
                  </label>
                  <input
                    type="file"
                    className="form-input w-full p-2 text-sm"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleDocumentUpload(
                          "otherDocuments",
                          e.target.files[0]
                        );
                      }
                    }}
                  />
                </div>
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
            <div className="mb-4">
              <label className="block text-sm font-medium">Services</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {servicesList.map((serv) => (
                  <label key={serv} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={form.services?.includes(serv) || false}
                      onChange={() => handleArrayChange("services", serv)}
                    />
                    <span>{serv}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Validity Period */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Validity Period
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="form-input w-full"
                    name="validityStartDate"
                    value={form.validityStartDate || ""}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    className="form-input w-full"
                    name="validityEndDate"
                    value={form.validityEndDate || ""}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    className="form-input w-full"
                    name="validityDuration"
                    value={form.validityDuration || ""}
                    onChange={handleChange}
                    placeholder="12"
                    min="12"
                  />
                </div>
              </div>
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                <strong>Note:</strong> Minimum validity is 12 months. End date
                will be calculated from start date + duration if not specified.
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
