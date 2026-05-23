import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Mail, Shield, Building2 } from "lucide-react";
import { authAPI } from "../../services/api";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  // Get type from URL params - default to 'user' if not specified
  const queryParams = new URLSearchParams(location.search);
  const type = queryParams.get("type") || "user";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      // Include type in the request
      const res = await authAPI.requestPasswordReset({
        email: data.email,
        type: type,
      });
      if (res.data.success) {
        toast.success(
          `OTP sent to your ${
            type === "clinic" ? "clinic admin" : "user"
          } email`
        );
        navigate("/reset-password", {
          state: {
            email: data.email,
            type: type,
          },
        });
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {type === "clinic" ? (
              <Building2 className="h-12 w-12 text-blue-600" />
            ) : (
              <Shield className="h-12 w-12 text-blue-600" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {type === "clinic"
              ? "Clinic Password Reset"
              : "Super Admin Password Reset"}
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            Enter your {type === "clinic" ? "clinic admin" : "super admin"}{" "}
            email to receive an OTP
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="form-label">
              <Mail className="inline w-4 h-4 mr-2" />
              {type === "clinic" ? "Clinic Admin Email" : "Super Admin Email"}
            </label>
            <input
              type="email"
              className="form-input"
              placeholder={
                type === "clinic"
                  ? "clinic-admin@example.com"
                  : "admin@example.com"
              }
              {...register("email", { required: "Email is required" })}
            />
            {errors.email && (
              <p className="text-sm text-red-600 mt-1">
                {errors.email.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary"
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </form>

        <div className="text-center">
          <Link to="/login" className="text-sm text-primary-600">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
