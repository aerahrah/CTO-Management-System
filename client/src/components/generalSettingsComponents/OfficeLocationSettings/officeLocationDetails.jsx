import React, { useState } from "react";
import { CustomButton } from "../../customButton";
import Modal from "../../modal";

const OfficeLocationDetails = ({ selectedOffice, onEdit, onDelete }) => {
  return (
    <div className="flex flex-col items-center justify-center h-[80%] bg-gray-50 border border-dashed border-gray-300 rounded-lg  text-center">
      {selectedOffice ? (
        <div className="flex flex-col items-start text-start">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            {selectedOffice.name}
          </h2>
          <div className="mb-6 text-gray-600">
            <p>
              <span className="font-medium">Province:</span>{" "}
              {selectedOffice.province || "N/A"}
            </p>
            <p>
              <span className="font-medium">Address:</span>{" "}
              {selectedOffice.address || "N/A"}
            </p>
            <p>
              <span className="font-medium">Contact:</span>{" "}
              {selectedOffice.contact || "N/A"}
            </p>
          </div>
          <div className="flex gap-3">
            <CustomButton
              label="Edit Details"
              variant="warning"
              className="w-32"
              onClick={() => onEdit()}
            />
            <CustomButton
              label="Remove Office"
              variant="danger"
              className="w-32"
              onClick={() => onDelete()}
            />
          </div>

          {/* Modal for editing */}
        </div>
      ) : (
        <div className="flex flex-col items-center bg-gray-50 text-center">
          <svg
            className="w-12 h-12 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 28 28"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>

          <p className="text-gray-600 text-lg font-medium mb-2">
            No provincial office selected
          </p>
          <p className="text-gray-400 text-md italic mb-4">
            Please select a provincial office from the list to view details
          </p>

          {/* Tutorial / Guide Note */}
          <div className="mt-2 max-w-sm text-sm text-gray-500 bg-white border border-gray-200 rounded-md p-4">
            <p className="font-medium text-gray-600 mb-1">How this works</p>
            <ul className="list-disc list-inside space-y-1 text-left">
              <li>Select an office from the list</li>
              <li>View its details here</li>
              <li>Edit or delete the selected office</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficeLocationDetails;
