// ✅ CustomButtons.jsx
// Contains both: CustomButton (general use) and TableActionButton (for tables)

const mainVariants = {
  primary: "bg-neutral-800 text-white hover:bg-neutral-900",
  secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
  success: "bg-green-600 text-white hover:bg-green-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
  warning: "bg-yellow-500 text-white hover:bg-yellow-600",
  close: "bg-gray-400 text-white hover:bg-gray-500",
  outline:
    "border border-neutral-700 text-neutral-700 hover:bg-neutral-700 hover:text-white",
  disabled: "bg-gray-300 text-gray-500 cursor-not-allowed",
};

/**
 * 🧩 CustomButton
 * For general UI actions (forms, modals, confirmation prompts)
 */
export const CustomButton = ({
  label,
  onClick,
  variant = "primary",
  disabled = false,
  isProcessing = false,
  type = "button",
  className = "",
}) => {
  const baseStyle =
    "px-3 py-2.5 text-sm font-medium rounded-sm transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer";
  const appliedStyle = disabled
    ? mainVariants.disabled
    : mainVariants[variant] || mainVariants.primary;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={!disabled ? onClick : undefined}
      className={`${baseStyle} ${appliedStyle} ${className}`}
    >
      {isProcessing ? "Processing..." : label}
    </button>
  );
};

const tableVariants = {
  view: "bg-neutral-700 text-white hover:bg-neutral-900",
  edit: "bg-blue-600 text-white hover:bg-blue-700",
  approve: "bg-green-600 text-white hover:bg-green-700",
  reject: "bg-red-600 text-white hover:bg-red-700",
  rollback: "bg-neutral-700 text-white hover:bg-neutral-900",
  disabled: "bg-gray-300 text-gray-500 cursor-not-allowed",
};

/**
 * 🧩 TableActionButton
 * Compact buttons for table rows (Approve, Reject, Edit, Rollback, etc.)
 */
export const TableActionButton = ({
  label,
  onClick,
  variant = "view",
  disabled = false,
  isProcessing = false,
}) => {
  const baseStyle =
    "px-3 py-1 text-sm rounded transition cursor-pointer whitespace-nowrap";
  const appliedStyle = disabled
    ? tableVariants.disabled
    : tableVariants[variant] || tableVariants.view;

  return (
    <button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      className={`${baseStyle} ${appliedStyle}`}
    >
      {isProcessing ? "..." : label}
    </button>
  );
};
