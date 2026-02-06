import React from "react";

export const CardFull = ({ height = "120", children, className = "" }) => {
  return (
    <div className={`${height}  rounded-xl w-full ${className}`}>
      {children || <p className="text-gray-400 text-center">Card Full</p>}
    </div>
  );
};

export const CardLg = ({ height = "142", children, className = "" }) => {
  return (
    <div className={`bg-white ${height} p-4 rounded-md  w-180 ${className}`}>
      {children || <p className="text-gray-400 text-center">Card Medium</p>}
    </div>
  );
};

export const CardMd = ({ height = "142", children, className = "" }) => {
  return (
    <div className={` ${height} min-w-92 ${className}`}>
      {children || <p className="text-gray-400 text-center">Card Medium</p>}
    </div>
  );
};

export const CardSm = ({ height = "142", children, className = "" }) => {
  return (
    <div className={`bg-white ${height} p-4  rounded-md w-96 ${className}`}>
      {children || <p className="text-gray-400 text-center">Card Small</p>}
    </div>
  );
};
