import React from "react";

const buttonStyles = {
  base: "px-3 py-1 text-sm font-medium rounded transition cursor-pointer focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
  variants: {
    neutral: "bg-neutral-700 text-white hover:bg-neutral-900",
    confirm: "bg-green-600 text-white hover:bg-green-700",
    reject: "bg-red-600 text-white hover:bg-red-700",
    close: "bg-gray-300 text-gray-700 hover:bg-gray-400",
    cancel: "bg-gray-300 text-gray-700 hover:bg-gray-400",
    tabActive: "bg-neutral-800 text-white rounded-t-lg",
    tabInactive: "bg-neutral-100 text-neutral-500 rounded-t-lg",
  },
};

const CustomButton = ({
  label,
  onClick,
  variant = "neutral",
  isActive = false,
  disabled = false,
}) => {
  let style = buttonStyles.base;

  if (variant === "tab") {
    style += ` ${
      isActive
        ? buttonStyles.variants.tabActive
        : buttonStyles.variants.tabInactive
    }`;
  } else {
    style += ` ${
      buttonStyles.variants[variant] || buttonStyles.variants.neutral
    }`;
  }

  return (
    <button onClick={onClick} disabled={disabled} className={style}>
      {label}
    </button>
  );
};

export default CustomButton;
