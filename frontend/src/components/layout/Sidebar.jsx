import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Heart,
  LayoutDashboard,
  Building2,
  Users,
  UserPlus,
  Calendar,
  CreditCard,
  Pill,
  FileText,
  Settings,
  Stethoscope,
  ArrowRightLeft,
  BarChart3,
  Shield,
  HelpCircle,
  Activity,
  UserCheck,
  X,
  Video,
  Receipt,
  MessageCircle,
  Share2,
} from "lucide-react";

const Sidebar = ({ onClose }) => {
  const { user } = useAuth();
  const location = useLocation();

  const getMenuItems = (role) => {
    const baseItems = [
      { path: "/", label: "Dashboard", icon: LayoutDashboard },
    ];

    switch (role) {
      case "super_master_admin":
        return [
          ...baseItems,
          { path: "/clinics", label: "Clinic Management", icon: Building2 },
          { path: "/patients", label: "Patient List", icon: UserPlus },
          { path: "/appointments", label: "Appointments", icon: Calendar },
          { path: "/doctors", label: "Doctors Management", icon: Stethoscope },
          { path: "/nurses", label: "Nurses Management", icon: UserCheck },
          { path: "/referrals", label: "Referrals", icon: ArrowRightLeft },
          {
            path: "/billing-insurance",
            label: "Billing & Insurance",
            icon: CreditCard,
          },
          {
            path: "/reports-analytics",
            label: "Reports & Analytics",
            icon: BarChart3,
          },
          { path: "/pharmacy", label: "Pharmacy Management", icon: Pill },
          { path: "/support", label: "Customer Support", icon: HelpCircle },
          { path: "/settings", label: "Settings", icon: Settings },
        ];

      case "super_admin":
        return [
          ...baseItems,
          { path: "/users", label: "Staff", icon: Users },
          { path: "/patients", label: "Patients", icon: UserPlus },
          { path: "/appointments", label: "Appointments", icon: Calendar },
          { path: "/billing", label: "Billing", icon: CreditCard },
        ];

      case "clinic_admin":
        return [
          ...baseItems,
          { path: "/patients", label: "Patients", icon: UserPlus },
          { path: "/appointments", label: "Appointments", icon: Calendar },
          { path: "/doctors", label: "Doctors", icon: Stethoscope },
          { path: "/nurses", label: "Nurse", icon: UserCheck },
          { path: "/prescriptions", label: "Prescription", icon: Pill },
          { path: "/teleconsultation", label: "Teleconsultation", icon: Video },
          { path: "/invoices", label: "Invoice", icon: Receipt },
          { path: "/community", label: "Community Hub", icon: MessageCircle },
          { path: "/referrals", label: "Referral System", icon: Share2 },
          { path: "/settings", label: "Settings", icon: Settings },
        ];

      case "doctor":
        return [
          ...baseItems,
          { path: "/appointments", label: "Appointments", icon: Calendar },
          { path: "/patients", label: "Patients", icon: UserPlus },
        ];

      case "nurse":
        return [
          ...baseItems,
          { path: "/appointments", label: "Appointments", icon: Calendar },
          { path: "/patients", label: "Patients", icon: UserPlus },
        ];

      case "billing_staff":
        return [
          ...baseItems,
          { path: "/billing", label: "Billing", icon: CreditCard },
        ];

      case "pharmacy_staff":
        return [
          ...baseItems,
          { path: "/pharmacy", label: "Pharmacy", icon: Pill },
        ];

      case "patient":
        return [
          ...baseItems,
          { path: "/appointments", label: "My Appointments", icon: Calendar },
          { path: "/reports", label: "Medical Reports", icon: FileText },
        ];

      default:
        return baseItems;
    }
  };

  const menuItems = getMenuItems(user?.role);

  return (
    <div className="relative w-full sm:w-64 border-r border-gray-100 bg-white/70 dark:border dark:border-gray-800 dark:bg-gray-950/70 dark:backdrop-blur supports-[backdrop-filter]:bg-white dark:bg-gray-950/60 h-full flex flex-col mobile-sidebar">
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              <div className="bg-primary-600 h-8 w-8 sm:h-9 sm:w-9 grid place-content-center rounded-xl sm:rounded-2xl text-white dark:text-gray-100 shadow-soft touch-target">
                <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="absolute -right-0.5 -bottom-0.5 sm:-right-1 sm:-bottom-1 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-primary-400 animate-pulseRing"></span>
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <svg
                className="h-4 sm:h-5 w-auto mb-0.5"
                viewBox="0 0 857.53 99.01"
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
              >
                <defs>
                  <style>{`.cls-1{fill:url(#linear-gradient);}.cls-2{fill:#004d99;}`}</style>
                  <linearGradient id="linear-gradient" x1="73.08" y1="172.09" x2="318.24" y2="-73.08" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#004d99"/>
                    <stop offset="1" stopColor="#42a89b"/>
                  </linearGradient>
                </defs>
                <title>SH - A</title>
                <g id="Layer_2" data-name="Layer 2">
                  <g id="Layer_1-2" data-name="Layer 1">
                    <path className="cls-1" d="M305.6,39.21a7.42,7.42,0,0,1-1.92,5.35,6.74,6.74,0,0,1-5.11,2H286.88V31.77h11.69a6.7,6.7,0,0,1,5.11,2A7.56,7.56,0,0,1,305.6,39.21ZM229.09,54.74h15.29L236.86,35ZM391.32,0V99H0V0ZM65.61,62q0-6.54-4.17-10.38T49.18,45.09l-7.93-2.61a13.66,13.66,0,0,1-4.9-2.54,4.92,4.92,0,0,1-1.64-3.84A5,5,0,0,1,37,31.69a12,12,0,0,1,6.67-1.56,31.23,31.23,0,0,1,15.36,4.09L63.57,25a42.82,42.82,0,0,0-20.35-5q-9.81,0-15.58,4.49a14.73,14.73,0,0,0-5.76,12.27,13.44,13.44,0,0,0,3.8,9.72q3.81,3.93,12.14,6.7l7.93,2.54q6.95,2.2,7,6.78a5.36,5.36,0,0,1-2.54,4.66,12.37,12.37,0,0,1-7,1.72q-9.06,0-18-6.13L20,72.39Q29.48,79,43.13,79q10.47,0,16.48-4.5A14.75,14.75,0,0,0,65.61,62Zm76.68,16.11L137,20.9H124.22l-16.1,38.82L91.93,20.9H79.26L74,78.12H86.7l3-34.91,14,34.25h8.75l14.06-34.25,2.94,34.91Zm63.43,0L183.07,20.9H171L148.66,78.12H161.9l5-13.24h20.27l5.07,13.24Zm59.75,0L242.82,20.9H230.73L208.41,78.12h13.24l5-13.24h20.27L252,78.12Zm53.45-1.23L305.19,55.15l.9-.25a15.06,15.06,0,0,0,9.07-5.64,16.36,16.36,0,0,0,3.27-10.13q0-8.18-5.19-13.21t-13.61-5H274.05V78.12h12.83V55.64h5.72l13.33,22.48h13Zm52.4-56h-47V31.77H341.4V78.12H354V31.77h17.33Zm-202,33.84h15.29L177.1,35Z"/>
                    <path className="cls-2" d="M458.73,78.12H446V56H424.07V78.12H411.32V20.9h12.75V45.58H446V20.9h12.75Z"/>
                    <path className="cls-2" d="M506.26,40.8q5.85,5.69,5.85,14.92a14.49,14.49,0,0,1-.33,3.76h-30.9a9,9,0,0,0,3.56,7.15q3.39,2.66,9,2.66,6.7,0,10.54-2.54l4.5,7.69Q501.88,79,492.24,79q-10.55,0-16.88-6T469,56.86q0-9.64,6.05-15.69t15.85-6.05Q500.42,35.12,506.26,40.8Zm-22.07,5.72A9.93,9.93,0,0,0,481,52.86h19.54a8.61,8.61,0,0,0-2.86-6.34,9.84,9.84,0,0,0-6.79-2.41A9.68,9.68,0,0,0,484.19,46.52Z"/>
                    <path className="cls-2" d="M554.69,40.19q5.47,5.07,5.48,13.49V78.12H547.66V72.23a14.43,14.43,0,0,1-6,4.9A18.46,18.46,0,0,1,533.68,79q-7,0-11.36-3.76a12.47,12.47,0,0,1-4.33-9.9,11.38,11.38,0,0,1,4.78-9.56q4.79-3.6,12.71-3.6a24.3,24.3,0,0,1,12.34,3.35V53.18a8,8,0,0,0-2.57-6.25q-2.58-2.32-7.23-2.33a24.67,24.67,0,0,0-6.83,1.11,21.76,21.76,0,0,0-6.09,2.65l-3.92-7.68a23.32,23.32,0,0,1,8.13-4,36.26,36.26,0,0,1,10.5-1.59Q549.22,35.12,554.69,40.19ZM532.87,60.83A4.93,4.93,0,0,0,530.66,65a4.53,4.53,0,0,0,2,3.84,9.06,9.06,0,0,0,5.4,1.47A12.15,12.15,0,0,0,543.58,69,12.7,12.7,0,0,0,548,65.45V61.77a17.6,17.6,0,0,0-9.32-2.54A9.62,9.62,0,0,0,532.87,60.83Z"/>
                    <path className="cls-2" d="M584.28,78.12H571.77V19h12.51Z"/>
                    <path className="cls-2" d="M611.42,36h11.93v9.24H611.42V63.73a5.19,5.19,0,0,0,1.39,3.84A5.06,5.06,0,0,0,616.57,69a11.32,11.32,0,0,0,6-1.47l2.94,8.09Q620.73,79,613.38,79a14.58,14.58,0,0,1-10.3-3.64,12.38,12.38,0,0,1-3.92-9.53V45.26h-6.3V36h7.36l2.12-11.28h9.08Z"/>
                    <path className="cls-2" d="M645.5,42.72a12.16,12.16,0,0,1,5.15-5.52,15.24,15.24,0,0,1,7.77-2.08,13.86,13.86,0,0,1,11.2,5.11q4.25,5.1,4.25,13.53V78.12H661.36V54.41a10.52,10.52,0,0,0-2-6.7,6.4,6.4,0,0,0-5.27-2.54A7.66,7.66,0,0,0,647.83,48a11.93,11.93,0,0,0-2.33,7.76V78.12H633V19h12.5Z"/>
                    <path className="cls-2" d="M716.13,36.76A23.15,23.15,0,0,1,724.05,41l-5.72,7.77a16.49,16.49,0,0,0-10.79-3.68A11.55,11.55,0,0,0,699,48.4a11.86,11.86,0,0,0-3.27,8.71A11.23,11.23,0,0,0,707.54,69a16.44,16.44,0,0,0,10.79-3.68l5.72,7.77a23.16,23.16,0,0,1-7.92,4.25A31.12,31.12,0,0,1,706.24,79q-10.4-.09-16.72-6.09t-6.34-15.82q0-9.81,6.34-15.86t16.72-6.13A31.12,31.12,0,0,1,716.13,36.76Z"/>
                    <path className="cls-2" d="M766.23,40.19q5.47,5.07,5.48,13.49V78.12H759.2V72.23a14.43,14.43,0,0,1-6.05,4.9A18.46,18.46,0,0,1,745.22,79q-7,0-11.36-3.76a12.47,12.47,0,0,1-4.33-9.9,11.38,11.38,0,0,1,4.78-9.56q4.79-3.6,12.71-3.6a24.3,24.3,0,0,1,12.34,3.35V53.18a8,8,0,0,0-2.57-6.25q-2.58-2.32-7.23-2.33a24.62,24.62,0,0,0-6.83,1.11,21.76,21.76,0,0,0-6.09,2.65l-3.92-7.68a23.32,23.32,0,0,1,8.13-4,36.26,36.26,0,0,1,10.5-1.59Q760.76,35.12,766.23,40.19ZM744.41,60.83A4.93,4.93,0,0,0,742.2,65a4.53,4.53,0,0,0,2,3.84,9.06,9.06,0,0,0,5.4,1.47A12.15,12.15,0,0,0,755.12,69a12.79,12.79,0,0,0,4.41-3.55V61.77a17.6,17.6,0,0,0-9.32-2.54A9.62,9.62,0,0,0,744.41,60.83Z"/>
                    <path className="cls-2" d="M809.55,35.28v12.1a20.58,20.58,0,0,0-4-.33,8.31,8.31,0,0,0-7,3.72q-2.7,3.72-2.7,9.94V78.12H783.31V36h12.1V47.3a15.81,15.81,0,0,1,4.21-8.83,10.73,10.73,0,0,1,7.89-3.35Z"/>
                    <path className="cls-2" d="M851.69,40.8q5.85,5.69,5.84,14.92a14.61,14.61,0,0,1-.32,3.76h-30.9a9.05,9.05,0,0,0,3.55,7.15,14.3,14.3,0,0,0,9,2.66q6.71,0,10.54-2.54l4.5,7.69Q847.31,79,837.67,79q-10.54,0-16.88-6t-6.33-16.11q0-9.64,6-15.69t15.86-6.05Q845.84,35.12,851.69,40.8Zm-22.07,5.72a9.93,9.93,0,0,0-3.15,6.34H846a8.64,8.64,0,0,0-2.86-6.34,9.84,9.84,0,0,0-6.79-2.41A9.68,9.68,0,0,0,829.62,46.52Z"/>
                  </g>
                </g>
              </svg>
              <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 capitalize truncate">
                {user?.role === "clinic_admin"
                  ? "Clinic Admin"
                  : user?.role?.replace("_", " ") || "User"}
              </p>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-all duration-200 flex-shrink-0 touch-target"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="mt-3 sm:mt-4 px-2 sm:px-3 flex-1 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`group relative flex items-center px-3 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-[13px] font-medium rounded-lg sm:rounded-xl transition-all duration-200 mobile-menu-item ${
                  isActive
                    ? "bg-primary-600 text-white shadow-card"
                    : "text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-300 hover:shadow-soft dark:hover:shadow-gray-900/50"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 sm:h-5 w-1 rounded-r bg-mint-400"></span>
                )}
                <Icon
                  className={`h-4 w-4 sm:h-[18px] sm:w-[18px] mr-2 sm:mr-3 flex-shrink-0 transition-colors duration-200 ${
                    isActive
                      ? "text-white"
                      : "text-gray-500 dark:text-gray-400 group-hover:text-primary-600"
                  }`}
                />
                <span className="font-medium truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="w-full p-3 sm:p-4 border-t border-gray-100 dark:border dark:border-gray-800 bg-white/70 dark:bg-gray-950/70 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-primary-600 h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shadow-soft flex-shrink-0">
            <span className="text-white dark:text-gray-100 font-bold text-xs">
              {user?.role === "clinic_admin"
                ? user?.adminName?.[0] || user?.name?.[0] || "C"
                : `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {user?.role === "clinic_admin"
                ? user?.adminName || user?.name || "Clinic Admin"
                : `${user?.firstName || ""} ${user?.lastName || ""}`}
            </p>
            <p className="inline-flex items-center text-[10px] sm:text-[11px] text-primary-700 dark:text-primary-300 font-medium capitalize bg-primary-50 dark:bg-gray-900 px-1.5 sm:px-2 py-0.5 rounded-full truncate max-w-full">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
