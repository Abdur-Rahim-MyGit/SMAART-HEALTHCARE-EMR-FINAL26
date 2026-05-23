import React, { useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { Lock, KeyRound, Shield, Building2, Eye, EyeOff } from "lucide-react";
import { authAPI } from "../../services/api";

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || "";
  const type = location.state?.type || "user"; // Get type from state
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ defaultValues: { email } });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      // verify OTP first with type
      const verify = await authAPI.verifyResetOTP({
        email: data.email,
        otp: data.otp,
        type: type,
      });
      if (!verify.data.success) throw new Error("Invalid OTP");

      // Reset password with type
      const res = await authAPI.resetPassword({
        email: data.email,
        password: data.password,
        type: type,
      });
      if (res.data.success) {
        toast.success(
          "Password updated successfully! Please login with your new credentials."
        );
        // Redirect to login with type parameter to maintain context
        navigate(`/login?fromReset=true&type=${type}`);
      }
    } catch (e) {
      toast.error(
        e.response?.data?.message || e.message || "Failed to reset password"
      );
    } finally {
      setLoading(false);
    }
  };

  const isClinic = type === "clinic";
  const IconComponent = isClinic ? Building2 : Shield;

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div
            className={`mx-auto h-12 w-12 flex items-center justify-center rounded-full ${
              isClinic ? "bg-green-100" : "bg-blue-100"
            }`}
          >
            <IconComponent
              className={`h-6 w-6 ${
                isClinic ? "text-green-600" : "text-blue-600"
              }`}
            />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Reset {isClinic ? "Clinic" : "Super Admin"} Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter the OTP sent to your {isClinic ? "clinic " : ""}email and
            create a new password
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="form-label">
              {isClinic ? "Clinic Email" : "Super Admin Email"}
            </label>
            <input
              type="email"
              className="form-input"
              readOnly
              value={email}
              {...register("email")}
            />
          </div>
          <div>
            <label className="form-label">
              <KeyRound className="inline w-4 h-4 mr-2" />
              Verification Code (OTP)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter the 6-digit OTP"
              {...register("otp", {
                required: "OTP is required",
                minLength: { value: 6, message: "OTP must be 6 digits" },
              })}
            />
            {errors.otp && (
              <p className="text-sm text-red-600 mt-1">{errors.otp.message}</p>
            )}
          </div>
          <div>
            <label className="form-label">
              <Lock className="inline w-4 h-4 mr-2" />
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="form-input pr-10"
                placeholder="Enter new password"
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-600 mt-1">
                {errors.password.message}
              </p>
            )}
          </div>
          <div>
            <label className="form-label">
              <Lock className="inline w-4 h-4 mr-2" />
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                className="form-input pr-10"
                placeholder="Confirm new password"
                {...register("confirm", {
                  required: "Please confirm your password",
                  validate: (v) =>
                    v === watch("password") || "Passwords do not match",
                })}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirm && (
              <p className="text-sm text-red-600 mt-1">
                {errors.confirm.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full ${
              isClinic
                ? "bg-green-600 hover:bg-green-700"
                : "bg-blue-600 hover:bg-blue-700"
            } text-white py-2 px-4 rounded-md font-medium disabled:opacity-50 transition-colors`}
          >
            {loading
              ? "Updating..."
              : `Update ${isClinic ? "Clinic" : "Admin"} Password`}
          </button>
        </form>
        <div className="text-center">
          <Link
            to={`/login${isClinic ? "?type=clinic" : ""}`}
            className={`text-sm ${
              isClinic
                ? "text-green-600 hover:text-green-500"
                : "text-blue-600 hover:text-blue-500"
            }`}
          >
            Back to {isClinic ? "Clinic" : "Super Admin"} Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
