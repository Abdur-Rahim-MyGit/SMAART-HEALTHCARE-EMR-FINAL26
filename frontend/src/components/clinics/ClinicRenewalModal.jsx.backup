import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import clinicValidityAPI from '../../services/clinicValidityAPI';

const ClinicRenewalModal = ({ isOpen, onClose, clinic, onRenewalSuccess }) => {
  const [renewalData, setRenewalData] = useState({
    durationMonths: '12',
    newEndDate: '',
    renewalReason: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (clinic && clinic.validityPeriod) {
      // Calculate new end date based on current end date + 12 months
      const currentEndDate = new Date(clinic.validityPeriod.endDate);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + 12);
      
      setRenewalData({
        durationMonths: '12',
        newEndDate: newEndDate.toISOString().split('T')[0],
        renewalReason: ''
      });
    }
  }, [clinic]);

  const handleDurationChange = (duration) => {
    if (clinic && clinic.validityPeriod) {
      const currentEndDate = new Date(clinic.validityPeriod.endDate);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + parseInt(duration));
      
      setRenewalData(prev => ({
        ...prev,
        durationMonths: duration,
        newEndDate: newEndDate.toISOString().split('T')[0]
      }));
    }
  };

  const validateRenewal = () => {
    const newErrors = {};

    if (!renewalData.newEndDate) {
      newErrors.newEndDate = 'New end date is required';
    }

    if (!renewalData.durationMonths) {
      newErrors.durationMonths = 'Duration is required';
    }

    if (clinic && clinic.validityPeriod && renewalData.newEndDate) {
      const currentEndDate = new Date(clinic.validityPeriod.endDate);
      const newEndDate = new Date(renewalData.newEndDate);
      const minExtension = new Date(currentEndDate);
      minExtension.setMonth(minExtension.getMonth() + 12);

      if (newEndDate < minExtension) {
        newErrors.newEndDate = 'Renewal must extend validity by at least 12 months';
      }

      if (newEndDate <= currentEndDate) {
        newErrors.newEndDate = 'New end date must be after current end date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRenewal = async () => {
    if (!validateRenewal()) return;

    setLoading(true);
    try {
      const response = await clinicValidityAPI.renewClinic(clinic._id, renewalData);
      
      if (response.success) {
        toast.success('Clinic validity renewed successfully');
        onRenewalSuccess && onRenewalSuccess(response.clinic);
        onClose();
      } else {
        toast.error(response.message || 'Failed to renew clinic validity');
      }
    } catch (error) {
      console.error('Renewal error:', error);
      toast.error('Failed to renew clinic validity');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !clinic) return null;

  const validityStatus = clinic.validityPeriod ? clinicValidityAPI.getValidityStatus(clinic) : null;
  const renewalOptions = clinicValidityAPI.getRenewalOptions();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Renew Clinic Validity</h2>
            <p className="text-sm text-gray-600 mt-1">{clinic.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Current Validity Status */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Current Validity Status</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Current End Date</label>
                  <p className="font-medium">
                    {clinic.validityPeriod ? 
                      new Date(clinic.validityPeriod.endDate).toLocaleDateString() : 
                      'Not set'
                    }
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <div className="flex items-center gap-2">
                    {validityStatus && (
                      <>
                        {validityStatus.status === 'expired' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        {validityStatus.status === 'expiring' && <Clock className="h-4 w-4 text-yellow-500" />}
                        {validityStatus.status === 'active' && <Calendar className="h-4 w-4 text-green-500" />}
                        <span className={`text-sm font-medium ${
                          validityStatus.status === 'expired' ? 'text-red-600' :
                          validityStatus.status === 'expiring' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {validityStatus.message}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Renewal Form */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Renewal Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extension Duration <span className="text-red-500">*</span>
                </label>
                <select
                  value={renewalData.durationMonths}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    errors.durationMonths ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  {renewalOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.durationMonths && (
                  <p className="text-red-500 text-xs mt-1">{errors.durationMonths}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={renewalData.newEndDate}
                  onChange={(e) => setRenewalData(prev => ({ ...prev, newEndDate: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    errors.newEndDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.newEndDate && (
                  <p className="text-red-500 text-xs mt-1">{errors.newEndDate}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Renewal Reason
              </label>
              <textarea
                value={renewalData.renewalReason}
                onChange={(e) => setRenewalData(prev => ({ ...prev, renewalReason: e.target.value }))}
                placeholder="Enter reason for renewal (optional)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Renewal Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">i</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Renewal Information</h4>
                  <p className="text-sm text-blue-700">
                    The renewal will extend the clinic's validity period from the current end date. 
                    Minimum extension is 12 months. The renewal history will be tracked for audit purposes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRenewal}
            disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Renewing...' : 'Renew Validity'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicRenewalModal;
