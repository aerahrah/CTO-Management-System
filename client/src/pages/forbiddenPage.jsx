import React from "react";
import { AlertTriangle } from "lucide-react";

const ForbiddenPage = () => {
  return (
    <div className="flex flex-col items-center justify-center w-full border-1 border-neutral-300 max-h-full rounded-lg min-h-140 py-20 bg-gray-50">
      {/* Icon */}
      <div className="bg-red-100 rounded-full p-6 mb-8 shadow-md">
        <AlertTriangle size={78} className="text-red-600" />
      </div>

      {/* Heading */}
      <h1 className="text-7xl font-extrabold text-red-600 mb-4">403</h1>
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">
        Access Forbidden
      </h2>

      {/* Message */}
      <p className="text-lg text-center text-gray-600 max-w-md">
        Sorry, you do not have permission to view this page. Please contact your
        administrator if you believe this is an error.
      </p>
    </div>
  );
};

export default ForbiddenPage;
