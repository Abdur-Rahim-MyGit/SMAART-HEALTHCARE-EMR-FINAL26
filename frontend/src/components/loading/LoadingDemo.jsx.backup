import React from 'react';
import {
  HealthcareSpinner,
  PulseLoader,
  HeartbeatLoader,
  DataSyncLoader,
  SecurityLoader,
  MedicalLoader,
  HealthcareProgressBar,
  HealthcareCardSkeleton,
  HealthcareTableSkeleton
} from './HealthcareLoaders';

const LoadingDemo = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Healthcare Loading Animations Demo
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Spinners */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Healthcare Spinners</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <HealthcareSpinner size="sm" color="primary" />
                <span className="text-sm text-gray-600">Small Primary</span>
              </div>
              <div className="flex items-center space-x-4">
                <HealthcareSpinner size="md" color="green" />
                <span className="text-sm text-gray-600">Medium Green</span>
              </div>
              <div className="flex items-center space-x-4">
                <HealthcareSpinner size="lg" color="red" />
                <span className="text-sm text-gray-600">Large Red</span>
              </div>
            </div>
          </div>

          {/* Pulse Loaders */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pulse Loaders</h3>
            <div className="space-y-4">
              <PulseLoader text="Loading medical data..." />
              <PulseLoader text="Processing records..." />
              <PulseLoader text="Synchronizing..." />
            </div>
          </div>

          {/* Heartbeat Loader */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Heartbeat Loader</h3>
            <div className="space-y-4">
              <HeartbeatLoader text="Monitoring vitals..." />
              <HeartbeatLoader text="Checking heart rate..." />
            </div>
          </div>

          {/* Data Sync Loader */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Sync Loader</h3>
            <div className="space-y-4">
              <DataSyncLoader text="Syncing patient data..." />
              <DataSyncLoader text="Updating records..." />
            </div>
          </div>

          {/* Security Loader */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Loader</h3>
            <div className="space-y-4">
              <SecurityLoader text="Verifying credentials..." />
              <SecurityLoader text="Checking permissions..." />
            </div>
          </div>

          {/* Medical Loader */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical Loader</h3>
            <div className="space-y-4">
              <MedicalLoader text="Initializing equipment..." />
              <MedicalLoader text="Calibrating devices..." />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Bar</h3>
            <div className="space-y-4">
              <HealthcareProgressBar progress={25} text="Loading patient records..." />
              <HealthcareProgressBar progress={60} text="Processing medical data..." />
              <HealthcareProgressBar progress={90} text="Finalizing setup..." />
            </div>
          </div>

          {/* Card Skeleton */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Card Skeleton</h3>
            <HealthcareCardSkeleton />
          </div>

          {/* Table Skeleton */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Table Skeleton</h3>
            <HealthcareTableSkeleton rows={3} />
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Usage Instructions</h3>
          <div className="text-blue-800 space-y-2">
            <p>• <strong>Initial Loading Screen:</strong> Shows automatically when the app first loads</p>
            <p>• <strong>Post-Login Animation:</strong> Displays after successful authentication</p>
            <p>• <strong>Healthcare Loaders:</strong> Use these components throughout the app for loading states</p>
            <p>• <strong>Custom Animations:</strong> All animations are healthcare-themed with medical icons and colors</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingDemo;
