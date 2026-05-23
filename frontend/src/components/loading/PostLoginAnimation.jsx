import React, { useEffect, useState } from 'react';
import { Heart, CheckCircle, Shield, Sparkles } from 'lucide-react';

const PostLoginAnimation = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage(1), 500);
    const timer2 = setTimeout(() => setStage(2), 1000);
    const timer3 = setTimeout(() => setShowSuccess(true), 1500);
    const timer4 = setTimeout(() => onComplete(), 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center z-50">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-green-200 rounded-full opacity-30 animate-ping"></div>
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-blue-200 rounded-full opacity-30 animate-ping" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-emerald-200 rounded-full opacity-30 animate-ping" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 text-center">
        {/* Main Animation Container */}
        <div className="relative mb-8">
           {/* Heart Animation */}
           <div className="relative mx-auto w-32 h-32 mb-6">
             <div className={`absolute inset-0 bg-transparent rounded-full flex items-center justify-center transition-all duration-1000 ${
               stage >= 1 ? 'scale-110 animate-heartbeat' : 'scale-100'
             }`}>
               <Heart className="w-16 h-16 text-blue-500" />
             </div>
            
            {/* Success Ring */}
            {stage >= 2 && (
              <div className="absolute inset-0 border-4 border-green-400 rounded-full animate-ping"></div>
            )}
            
            {/* Sparkles */}
            {showSuccess && (
              <>
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-bounce" />
                <Sparkles className="absolute -bottom-2 -left-2 w-5 h-5 text-yellow-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
                <Sparkles className="absolute top-2 -left-4 w-4 h-4 text-yellow-400 animate-bounce" style={{ animationDelay: '0.6s' }} />
                <Sparkles className="absolute -top-4 left-2 w-5 h-5 text-yellow-400 animate-bounce" style={{ animationDelay: '0.9s' }} />
              </>
            )}
          </div>

          {/* Success Checkmark */}
          {showSuccess && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <CheckCircle className="w-20 h-20 text-green-500 animate-scale-in" />
            </div>
          )}
        </div>

        {/* Status Messages */}
        <div className="space-y-4">
          <h2 className={`text-2xl font-bold text-gray-900 transition-all duration-500 ${
            stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            Welcome Back!
          </h2>
          
          <p className={`text-lg text-gray-600 transition-all duration-500 ${
            stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            SMAART Is loading...
          </p>
          
          {showSuccess && (
            <div className="flex items-center justify-center space-x-2 text-green-600 animate-fadeIn">
              <Shield className="w-5 h-5" />
              <span className="font-medium">Secure Access Granted</span>
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
                  stage >= i + 1 ? 'bg-green-500' : 'bg-gray-300'
                }`}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostLoginAnimation;
