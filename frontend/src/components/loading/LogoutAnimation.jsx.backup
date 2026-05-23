import React, { useEffect, useState } from 'react';
import { Heart, LogOut, Shield, Sparkles } from 'lucide-react';

const LogoutAnimation = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  const [showGoodbye, setShowGoodbye] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage(1), 500);
    const timer2 = setTimeout(() => setStage(2), 1000);
    const timer3 = setTimeout(() => setShowGoodbye(true), 1500);
    const timer4 = setTimeout(() => onComplete(), 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-blue-50 flex items-center justify-center z-50">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gray-200 rounded-full opacity-20 animate-ping"></div>
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-blue-200 rounded-full opacity-20 animate-ping" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-gray-300 rounded-full opacity-20 animate-ping" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 text-center">
        {/* Main Animation Container */}
        <div className="relative mb-8">
          {/* Heart Animation */}
          <div className="relative mx-auto w-32 h-32 mb-6">
            <div className={`absolute inset-0 bg-transparent rounded-full flex items-center justify-center transition-all duration-1000 ${
              stage >= 1 ? 'scale-90 opacity-70' : 'scale-100'
            }`}>
              <Heart className="w-16 h-16 text-gray-400" />
            </div>
            
            {/* Logout Ring */}
            {stage >= 2 && (
              <div className="absolute inset-0 border-4 border-gray-300 rounded-full animate-ping"></div>
            )}
            
            {/* Sparkles */}
            {showGoodbye && (
              <>
                <LogOut className="absolute -top-2 -right-2 w-6 h-6 text-gray-500 animate-bounce" />
                <LogOut className="absolute -bottom-2 -left-2 w-5 h-5 text-gray-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
                <LogOut className="absolute top-2 -left-4 w-4 h-4 text-gray-500 animate-bounce" style={{ animationDelay: '0.6s' }} />
                <LogOut className="absolute -top-4 left-2 w-5 h-5 text-gray-500 animate-bounce" style={{ animationDelay: '0.9s' }} />
              </>
            )}
          </div>

          {/* Logout Icon */}
          {showGoodbye && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <LogOut className="w-20 h-20 text-gray-500 animate-scale-in" />
            </div>
          )}
        </div>

        {/* Status Messages */}
        <div className="space-y-4">
          <h2 className={`text-2xl font-bold text-gray-700 transition-all duration-500 ${
            stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            Goodbye!
          </h2>
          
          <p className={`text-lg text-gray-600 transition-all duration-500 ${
            stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            Logging out securely
          </p>
          
          {showGoodbye && (
            <div className="flex items-center justify-center space-x-2 text-gray-500 animate-fadeIn">
              <Shield className="w-5 h-5" />
              <span className="font-medium">Session ended safely</span>
            </div>
          )}
        </div>

        {/* Loading Indicator */}
        <div className="mt-8 flex justify-center">
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  stage >= i + 1 ? 'bg-gray-500' : 'bg-gray-300'
                }`}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoutAnimation;
