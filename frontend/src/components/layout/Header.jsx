import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useSearch } from "../../contexts/SearchContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  Bell,
  Settings,
  LogOut,
  Search,
  Command,
  X,
  Menu,
  Sun,
  Moon,
} from "lucide-react";
import { notificationsAPI } from "../../services/api";

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { setIsSearchOpen, searchQuery, handleSearch } = useSearch();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [showAllNotificationsModal, setShowAllNotificationsModal] =
    useState(false);

  const handleLogout = () => {
    logout();
  };

  const openSearch = () => {
    setIsSearchOpen(true);
  };

  const handleNotifications = async () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && notifications.length === 0) {
      await fetchNotifications();
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    console.log("🔔 Fetching notifications...");
    setLoadingNotifications(true);
    try {
      const response = await notificationsAPI.getRecent(10);
      console.log("🔔 Notifications response:", response);
      if (response.success) {
        setNotifications(response.data);
        console.log("✅ Notifications set:", response.data.length);
      } else {
        console.log("⚠️ No success in response");
      }
    } catch (error) {
      console.error("❌ Error fetching notifications:", error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Fetch notifications on mount and refresh every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get time ago string
  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  // Get notification color class
  const getColorClass = (color) => {
    const colors = {
      blue: "bg-blue-500",
      green: "bg-green-500",
      purple: "bg-purple-500",
      orange: "bg-orange-500",
      teal: "bg-teal-500",
      red: "bg-red-500",
      yellow: "bg-yellow-500",
    };
    return colors[color] || "bg-gray-500";
  };

  const handleSettings = () => {
    navigate("/settings");
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (user?.role === "clinic_admin") {
      return user?.adminName || user?.name || "Clinic Admin";
    }
    return user?.firstName || "User";
  };

  // Handle view all notifications
  const handleViewAllNotifications = () => {
    setShowNotifications(false);
    setShowAllNotificationsModal(true);
  };

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/70 dark:bg-gray-950/70 backdrop-blur border-b border-gray-100 dark:border dark:border-gray-800">
        <div className="px-3 sm:px-4 md:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Mobile Menu Button */}
              <button
                onClick={onMenuClick}
                className="lg:hidden p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-all duration-200 flex-shrink-0"
              >
                <Menu className="h-5 w-5" />
              </button>

              <h1 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                <span className="hidden sm:inline">Welcome back, </span>
                {getUserDisplayName()}
              </h1>
              <span className="hidden md:inline text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>

            {/* Search Bar */}
            <div
              className="hidden lg:flex items-center gap-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 shadow-soft w-56 xl:w-72 cursor-pointer hover:border-primary-300 transition-all duration-200"
              onClick={openSearch}
            >
              <Search className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <input
                className="outline-none w-full text-sm placeholder-gray-400 dark:placeholder-gray-500 cursor-pointer bg-transparent dark:text-white"
                placeholder="Search appointments, patients..."
                readOnly
              />
              <div className="hidden xl:flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-900 rounded px-2 py-1 flex-shrink-0">
                <Command className="h-3 w-3" />
                <span>K</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-all duration-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-900"
                aria-label="Toggle theme"
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>

              {/* Mobile Search Button */}
              <button
                onClick={openSearch}
                className="lg:hidden p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-all duration-200"
              >
                <Search className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={handleNotifications}
                  className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-all duration-200 relative"
                >
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                  {/* Notification badge */}
                  {notifications.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-3.5 w-3.5 sm:h-4 sm:w-4 bg-red-500 text-white text-[10px] sm:text-xs rounded-full flex items-center justify-center">
                      {notifications.length > 9 ? "9+" : notifications.length}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white dark:bg-gray-950 rounded-xl shadow-lg dark:shadow-gray-900 border border-gray-200 dark:border dark:border-gray-800 z-30">
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          Notifications
                        </h3>
                        <button
                          onClick={() => setShowNotifications(false)}
                          className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors"
                        >
                          <X className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400" />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {/* Real notifications */}
                      {loadingNotifications ? (
                        <div className="p-8 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            Loading notifications...
                          </p>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            No notifications
                          </p>
                        </div>
                      ) : (
                        notifications.map((notification, index) => (
                          <div
                            key={notification.id}
                            className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-900 ${
                              index < notifications.length - 1
                                ? "border-b border-gray-100 dark:border-gray-800"
                                : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-2 h-2 ${getColorClass(
                                  notification.color
                                )} rounded-full mt-2 flex-shrink-0`}
                              ></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {notification.title}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                  {getTimeAgo(notification.time)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-3 border-t border-gray-100">
                      <button
                        onClick={handleViewAllNotifications}
                        className="w-full text-center text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                      >
                        View all notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Settings */}
              <button
                onClick={handleSettings}
                className="hidden sm:flex p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-all duration-200"
              >
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="p-1.5 sm:p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Click outside to close notifications */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowNotifications(false)}
        />
      )}

      {/* All Notifications Modal */}
      {showAllNotificationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-950 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] sm:max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  All Notifications
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {notifications.length} notification
                  {notifications.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => setShowAllNotificationsModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingNotifications ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                  <p className="text-gray-500 dark:text-gray-400">
                    Loading notifications...
                  </p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Bell className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No notifications
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    You're all caught up!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {/* Color Indicator */}
                        <div
                          className={`w-3 h-3 ${getColorClass(
                            notification.color
                          )} rounded-full mt-1.5 flex-shrink-0`}
                        ></div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                {notification.title}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Bell className="h-3 w-3" />
                                  {notification.type}
                                </span>
                                <span>•</span>
                                <span>{getTimeAgo(notification.time)}</span>
                              </div>
                            </div>

                            {/* Type Badge */}
                            <span
                              className={`px-3 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                                notification.color === "blue"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                  : notification.color === "green"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                  : notification.color === "purple"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                                  : notification.color === "orange"
                                  ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                                  : notification.color === "teal"
                                  ? "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300"
                                  : "bg-gray-100 text-gray-800 dark:bg-black/30 dark:text-gray-300"
                              }`}
                            >
                              {notification.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setShowAllNotificationsModal(false)}
                className="w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
