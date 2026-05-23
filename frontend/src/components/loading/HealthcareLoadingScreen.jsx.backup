import React, { useEffect, useState } from 'react';
import { Heart, Activity, Shield, Stethoscope, Users, Calendar } from 'lucide-react';

const HealthcareLoadingScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { icon: Shield, text: "Initializing Security", color: "text-blue-500" },
    { icon: Heart, text: "Loading Medical Records", color: "text-red-500" },
    { icon: Stethoscope, text: "Connecting to Healthcare Network", color: "text-green-500" },
    { icon: Users, text: "Synchronizing Patient Data", color: "text-purple-500" },
    { icon: Calendar, text: "Preparing Dashboard", color: "text-orange-500" },
    { icon: Activity, text: "System Ready", color: "text-emerald-500" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => onComplete(), 500);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= steps.length - 1) {
          clearInterval(stepInterval);
          return steps.length - 1;
        }
        return prev + 1;
      });
    }, 300);

    return () => {
      clearInterval(interval);
      clearInterval(stepInterval);
    };
  }, [onComplete, steps.length]);

  const CurrentIcon = steps[currentStep]?.icon || Heart;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-200 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-100 rounded-full opacity-10 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 text-center max-w-md mx-auto px-6">
         {/* Logo and Brand */}
         <div className="mb-8">
           <div className="relative mx-auto w-20 h-20 mb-4">
             <div className="absolute inset-0 bg-transparent rounded-2xl flex items-center justify-center animate-heartbeat">
               <Heart className="w-10 h-10 text-blue-500" />
             </div>
             <div className="absolute inset-0 bg-blue-200 rounded-2xl opacity-30 animate-ping"></div>
           </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 animate-fadeIn">
            SMAART HEALTHCARE
          </h1>
          <p className="text-gray-600 animate-fadeIn" style={{ animationDelay: '0.5s' }}>
            Electronic Medical Records System
          </p>
        </div>

        {/* Current Step */}
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <CurrentIcon className={`w-12 h-12 ${steps[currentStep]?.color || 'text-blue-500'} animate-bounce`} />
              <div className="absolute inset-0 bg-current opacity-20 rounded-full animate-ping"></div>
            </div>
          </div>
          <p className="text-lg font-medium text-gray-700 animate-fadeIn">
            {steps[currentStep]?.text || "Loading..."}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">{progress}% Complete</p>
        </div>

        {/* Loading Dots */}
        <div className="flex justify-center space-x-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            ></div>
          ))}
        </div>

        {/* Healthcare Icons Animation */}
        <div className="mt-8 flex justify-center space-x-4">
          {[Shield, Heart, Stethoscope, Activity].map((Icon, index) => (
            <div
              key={index}
              className="w-8 h-8 text-gray-300 animate-pulse"
              style={{ animationDelay: `${index * 0.3}s` }}
            >
              <Icon className="w-full h-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HealthcareLoadingScreen;
