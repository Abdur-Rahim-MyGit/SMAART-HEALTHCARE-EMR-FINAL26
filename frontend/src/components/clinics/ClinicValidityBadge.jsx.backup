import React from 'react';
import { Calendar, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import clinicValidityAPI from '../../services/clinicValidityAPI';

const ClinicValidityBadge = ({ clinic, showDetails = false }) => {
  if (!clinic.validityPeriod) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <Calendar className="w-3 h-3 mr-1" />
        Not Set
      </span>
    );
  }

  const validityStatus = clinicValidityAPI.getValidityStatus(clinic);
  
  const getStatusConfig = () => {
    switch (validityStatus.status) {
      case 'expired':
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-200',
          icon: XCircle
        };
      case 'expiring':
        return {
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-200',
          icon: AlertTriangle
        };
      case 'warning':
        return {
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-800',
          borderColor: 'border-orange-200',
          icon: Clock
        };
      case 'active':
        return {
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200',
          icon: CheckCircle
        };
      default:
        return {
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-200',
          icon: Calendar
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  if (showDetails) {
    return (
      <div className={`inline-flex flex-col items-start p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}>
        <div className="flex items-center mb-1">
          <Icon className={`w-4 h-4 mr-2 ${config.textColor}`} />
          <span className={`text-sm font-medium ${config.textColor} capitalize`}>
            {validityStatus.status}
          </span>
        </div>
        <div className={`text-xs ${config.textColor}`}>
          {validityStatus.message}
        </div>
        <div className="text-xs text-gray-600 mt-1">
          {clinicValidityAPI.formatValidityPeriod(clinic)}
        </div>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
      <Icon className="w-3 h-3 mr-1" />
      {validityStatus.message}
    </span>
  );
};

export default ClinicValidityBadge;
