import React from "react";
import { HelpCircle, Construction } from "lucide-react";

const CustomerSupport = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <HelpCircle className="h-24 w-24 text-gray-300" />
            <Construction className="h-12 w-12 text-orange-500 absolute -bottom-2 -right-2 bg-white dark:bg-gray-950 rounded-full p-2 shadow-lg dark:shadow-gray-900" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Customer Support
        </h1>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-4">
          <h2 className="text-xl font-semibold text-orange-900 mb-2">
            Work Under Progress
          </h2>
          <p className="text-orange-700">
            This feature is currently being developed and will be available
            soon.
          </p>
        </div>

        <p className="text-gray-600 dark:text-gray-400">
          We're working hard to bring you comprehensive customer support
          tools including:
        </p>

        <ul className="mt-4 text-left text-gray-600 dark:text-gray-400 space-y-2 bg-white dark:bg-gray-950 rounded-lg p-6 shadow-sm">
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>24/7 ticket management system</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Live chat and phone support</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Knowledge base and FAQs</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Priority-based ticket routing</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Support analytics and reporting</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CustomerSupport
