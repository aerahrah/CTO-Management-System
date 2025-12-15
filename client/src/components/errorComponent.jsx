import React from "react";
import { AlertCircle } from "lucide-react";

const ErrorMessage = ({ message = "Something went wrong." }) => {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center p-4 max-w-sm mx-auto mt-10 text-center "
    >
      <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
      <h2 className="text-lg font-semibold text-red-600 mb-1">Oops!</h2>
      <p className="text-red-500">{message}</p>
    </div>
  );
};

export default ErrorMessage;
