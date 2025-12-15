import React from "react";

const Spinner = ({ size = 40, strokeWidth = 4 }) => {
  const half = size / 2;
  const radius = half - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex justify-center items-center h-full">
      <svg
        className="animate-spin"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="text-gray-200"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          cx={half}
          cy={half}
          r={radius}
        />
        <circle
          className="text-blue-500"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.25}
          fill="transparent"
          cx={half}
          cy={half}
          r={radius}
        />
      </svg>
    </div>
  );
};

export default Spinner;
