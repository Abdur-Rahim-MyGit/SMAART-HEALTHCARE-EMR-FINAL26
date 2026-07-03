import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import {
  Heart,
  Mail,
  Lock,
  Shield,
  ArrowLeft,
  Eye,
  EyeOff,
  Code,
} from "lucide-react";
import { authAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import PostLoginAnimation from "../loading/PostLoginAnimation";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [showPostLoginAnimation, setShowPostLoginAnimation] = useState(false);
  const [loginType, setLoginType] = useState("user"); // 'user' or 'clinic'
  const [useOTP, setUseOTP] = useState(true); // OTP is mandatory for user login
  const [otpStep, setOtpStep] = useState("credentials"); // 'credentials' or 'otp'
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      if (loginType === "clinic") {
        // Clinic login (no OTP for clinics)
        const response = await authAPI.clinicLogin(data);
        if (response.data.success) {
          login(response.data.clinic, response.data.token);
          toast.success("Clinic login successful!");
          setShowPostLoginAnimation(true);
        }
      } else if (loginType === "user" && otpStep === "credentials") {
        // Request OTP for user login
        const response = await authAPI.requestLoginOTP(data);
        if (response.data.success) {
          setUserId(response.data.userId);
          setUserEmail(data.email);
          setOtpStep("otp");
          
          // Show OTP in toast if available (development mode / email failed)
          if (response.data.otp) {
            if (response.data.emailFailed) {
              toast.success(`⚠️ Email failed — Dev OTP: ${response.data.otp}`, { duration: 10000 });
            } else {
              toast.success(`OTP sent to your email! Dev OTP: ${response.data.otp}`, { duration: 10000 });
            }
          } else {
            toast.success("OTP sent to your email! Please check your inbox.");
          }
        }
      } else if (loginType === "user" && otpStep === "otp") {
        // Verify OTP and complete login
        const response = await authAPI.verifyLoginOTP({
          userId: userId,
          otp: data.otp,
        });
        if (response.data.success) {
          console.log('OTP Verification Response:', response.data); // Debug log
          console.log('User data:', response.data.user); // Debug log
          console.log('User role:', response.data.user.role); // Debug log
          login(response.data.user, response.data.token);
          toast.success("Login successful with OTP verification!");
          setShowPostLoginAnimation(true);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setOtpStep("credentials");
    setUserId(null);
    setUserEmail("");
  };

  // Developer login bypass (for development only)
  const handleDeveloperLogin = async () => {
    // Get form values
    const emailInput = document.querySelector('input[type="email"]')?.value;
    const passwordInput = document.querySelector('input[type="password"]')?.value;
    
    if (!emailInput || !passwordInput) {
      toast.error("Please enter email and password first");
      return;
    }
    
    setLoading(true);
    try {
      const formData = {
        email: emailInput,
        password: passwordInput,
      };
      
      // Direct login without OTP
      const response = await authAPI.login(formData);
      if (response.data.success) {
        console.log('Developer Login Response:', response.data);
        login(response.data.user, response.data.token);
        toast.success("🔓 Developer login successful (OTP bypassed)!");
        setShowPostLoginAnimation(true);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Developer login failed");
    } finally {
      setLoading(false);
    }
  };

  // Show post-login animation
  if (showPostLoginAnimation) {
    return <PostLoginAnimation onComplete={() => navigate("/dashboard")} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <Heart className="h-12 w-12 text-primary-500" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Access your EMR healthcare dashboard
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {/* Login Type Selector */}
          <div className="flex justify-center space-x-4 mb-6">
            <button
              type="button"
              onClick={() => {
                setLoginType("user");
                setUseOTP(true);
                setOtpStep("credentials");
                setUserId(null);
                setUserEmail("");
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                loginType === "user"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-200 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              Super Master Admin Login
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginType("clinic");
                setUseOTP(false);
                setOtpStep("credentials");
                setUserId(null);
                setUserEmail("");
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                loginType === "clinic"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-200 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              Clinic Login
            </button>
          </div>

          {/* OTP Security Notice for User Login */}
          {loginType === "user" && (
            <div className="flex justify-center mb-6">
              <div className="flex items-center px-4 py-2 rounded-md text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700">
                <Shield className="w-4 h-4 mr-2" />
                Secure Login with OTP Verification
              </div>
            </div>
          )}

          {/* Show OTP step indicator for user login */}
          {loginType === "user" && (
            <div className="mb-6">
              <div className="flex items-center justify-center space-x-4">
                <div
                  className={`flex items-center ${
                    otpStep === "credentials"
                      ? "text-primary-600"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      otpStep === "credentials"
                        ? "bg-primary-100 text-primary-600"
                        : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                    }`}
                  >
                    1
                  </div>
                  <span className="ml-2 text-sm font-medium">Credentials</span>
                </div>
                <div
                  className={`w-8 h-0.5 ${
                    otpStep === "otp" ? "bg-green-300" : "bg-gray-300"
                  }`}
                ></div>
                <div
                  className={`flex items-center ${
                    otpStep === "otp" ? "text-primary-600" : "text-gray-400"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      otpStep === "otp"
                        ? "bg-primary-100 text-primary-600"
                        : "bg-gray-100 dark:bg-gray-950 text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    2
                  </div>
                  <span className="ml-2 text-sm font-medium">
                    OTP Verification
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Credentials Step */}
            {(loginType === "clinic" || otpStep === "credentials") && (
              <>
                <div>
                  <label className="form-label">
                    <Mail className="inline w-4 h-4 mr-2" />
                    Email Address
                  </label>
                  <input
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address",
                      },
                    })}
                    type="email"
                    className="form-input"
                    placeholder={
                      loginType === "clinic"
                        ? "Enter clinic admin email"
                        : "Enter your email"
                    }
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="form-label">
                    <Lock className="inline w-4 h-4 mr-2" />
                    Password
                  </label>
                  <div className="relative">
                    <input
                      {...register("password", {
                        required: "Password is required",
                        minLength: {
                          value: 6,
                          message: "Password must be at least 6 characters",
                        },
                      })}
                      type={showPassword ? "text" : "password"}
                      className="form-input pr-10"
                      placeholder={
                        loginType === "clinic"
                          ? "Enter clinic admin password"
                          : "Enter your password"
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* OTP Step */}
            {loginType === "user" && otpStep === "otp" && (
              <>
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    We've sent a 4-digit OTP to <strong>{userEmail}</strong>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    The OTP will expire in 5 minutes
                  </p>
                </div>

                <div>
                  <label className="form-label">
                    <Shield className="inline w-4 h-4 mr-2" />
                    Enter OTP Code
                  </label>
                  <input
                    {...register("otp", {
                      required: "OTP is required",
                      pattern: {
                        value: /^[0-9]{4}$/,
                        message: "OTP must be 4 digits",
                      },
                    })}
                    type="text"
                    className="form-input text-center text-lg tracking-widest"
                    placeholder="0000"
                    maxLength={4}
                  />
                  {errors.otp && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.otp.message}
                    </p>
                  )}
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleBackToCredentials}
                    className="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 flex items-center justify-center mx-auto"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to credentials
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex justify-center items-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  {loginType === "user" && otpStep === "credentials" && (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Send OTP
                    </>
                  )}
                  {loginType === "user" && otpStep === "otp" && (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Verify OTP & Sign In
                    </>
                  )}
                  {loginType === "clinic" && "Sign In"}
                </>
              )}
            </button>

            {/* Developer Login Button - Only for User Login at Credentials Step */}
            {loginType === "user" && otpStep === "credentials" && (
              <button
                type="button"
                onClick={handleDeveloperLogin}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900 shadow-soft flex justify-center items-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Code className="w-4 h-4 mr-2" />
                    Developer Login (Bypass OTP)
                  </>
                )}
              </button>
            )}
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {/* Don't have an account?{' '} */}
              <Link
                to="/register"
                className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
              >
                {/* Register here */}
              </Link>
              {/* <span className="mx-2 text-gray-300">|</span> */}
              <Link
                to={`/forgot-password?type=${loginType}`}
                className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Forgot {loginType === "clinic" ? "clinic" : "admin"} password?
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
