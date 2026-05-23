import React from 'react';
import { Heart, Activity, Shield, Stethoscope } from 'lucide-react';

// Healthcare-themed loading spinner
export const HealthcareSpinner = ({ size = 'md', color = 'primary' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const colorClasses = {
    primary: 'text-blue-500',
    green: 'text-green-500',
    red: 'text-red-500',
    purple: 'text-purple-500'
  };

  return (
    <div className={`${sizeClasses[size]} ${colorClasses[color]} animate-spin`}>
      <Heart className="w-full h-full" />
    </div>
  );
};

// Pulse animation for medical data
export const PulseLoader = ({ text = "Loading..." }) => {
  return (
    <div className="flex items-center justify-center space-x-3">
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          ></div>
        ))}
      </div>
      <span className="text-gray-600 text-sm">{text}</span>
    </div>
  );
};

// Heartbeat animation for vital signs
export const HeartbeatLoader = ({ text = "Processing..." }) => {
  return (
    <div className="flex items-center justify-center space-x-3">
      <div className="relative">
        <Heart className="w-6 h-6 text-red-500 animate-heartbeat" />
        <div className="absolute inset-0 bg-red-500 rounded-full opacity-30 animate-ping"></div>
      </div>
      <span className="text-gray-600 text-sm">{text}</span>
    </div>
  );
};

// Medical data sync animation
export const DataSyncLoader = ({ text = "Synchronizing data..." }) => {
  return (
    <div className="flex items-center justify-center space-x-3">
      <div className="relative">
        <Activity className="w-6 h-6 text-green-500 animate-pulse" />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
      </div>
      <span className="text-gray-600 text-sm">{text}</span>
    </div>
  );
};

// Security verification loader
export const SecurityLoader = ({ text = "Verifying security..." }) => {
  return (
    <div className="flex items-center justify-center space-x-3">
      <div className="relative">
        <Shield className="w-6 h-6 text-blue-500 animate-pulse" />
        <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
      </div>
      <span className="text-gray-600 text-sm">{text}</span>
    </div>
  );
};

// Medical equipment loader
export const MedicalLoader = ({ text = "Initializing..." }) => {
  return (
    <div className="flex items-center justify-center space-x-3">
      <div className="relative">
        <Stethoscope className="w-6 h-6 text-purple-500 animate-bounce" />
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
      </div>
      <span className="text-gray-600 text-sm">{text}</span>
    </div>
  );
};

// Progress bar with healthcare theme
export const HealthcareProgressBar = ({ progress = 0, text = "Loading..." }) => {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-600">{text}</span>
        <span className="text-sm text-gray-600">{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        >
          <div className="h-full bg-white opacity-30 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

// Card loading skeleton
export const HealthcareCardSkeleton = () => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 animate-pulse">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        <div className="h-3 bg-gray-200 rounded w-4/6"></div>
      </div>
    </div>
  );
};

// Table loading skeleton
export const HealthcareTableSkeleton = ({ rows = 5 }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="h-6 bg-gray-200 rounded w-1/4 animate-pulse"></div>
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center space-x-4">
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4 animate-pulse"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
          </div>
        ))}
      </div>
    </div>
  );
};
