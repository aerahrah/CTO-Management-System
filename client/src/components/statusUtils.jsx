import React from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  ArrowUpCircle,
  UserCheck,
  UserX,
  UserMinus,
  UserCircle,
} from "lucide-react";

/**
 * Returns Tailwind CSS classes based on the current status.
 */
export const getStatusStyles = (status) => {
  switch (status?.toUpperCase()) {
    case "APPROVED":
    case "CREDITED":
    case "ACTIVE":
      return "text-green-700 bg-green-50 border-green-200";

    case "REJECTED":
    case "TERMINATED":
      return "text-red-700 bg-red-50 border-red-200";

    case "ROLLEDBACK":
      return "text-rose-700 bg-rose-50 border-rose-200";

    case "RESIGNED":
      return "text-orange-700 bg-orange-50 border-orange-200";

    case "INACTIVE":
      return "text-gray-700 bg-gray-100 border-gray-300";

    default:
      return "text-yellow-700 bg-yellow-50 border-yellow-200";
  }
};

/**
 * Returns a corresponding icon based on status.
 */
export const StatusIcon = ({ status, className = "h-4 w-4" }) => {
  const s = status?.toUpperCase();
  if (s === "APPROVED" || s === "CREDITED" || s === "ACTIVE")
    return <CheckCircle className={`${className} text-green-600`} />;
  if (s === "REJECTED" || s === "TERMINATED")
    return <XCircle className={`${className} text-red-600`} />;
  if (s === "ROLLEDBACK")
    return <RotateCcw className={`${className} text-rose-600`} />;
  if (s === "RESIGNED")
    return <UserMinus className={`${className} text-orange-600`} />;
  if (s === "INACTIVE")
    return <UserX className={`${className} text-gray-500`} />;
  return <AlertCircle className={`${className} text-yellow-600`} />;
};

/**
 * Renders a reusable status badge with icon + label.
 */
export const StatusBadge = ({
  showIcon = true,
  status,
  size = "sm",
  className = "",
}) => {
  const sizes = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${getStatusStyles(
        status
      )} ${sizes[size]} ${className}`}
    >
      {showIcon && <StatusIcon status={status} className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
};
