import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProvincialOffices } from "../../api/cto";

const ProvincialOfficesList = ({
  selectedOffice,
  setSelectedOffice,
  maxHeightClass,
}) => {
  const {
    data: offices = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["provincialOffices"],
    queryFn: fetchProvincialOffices,
  });

  if (isLoading)
    return (
      <div className="p-4 bg-white rounded-lg shadow-sm text-center text-gray-500">
        Loading provincial offices...
      </div>
    );

  if (isError)
    return (
      <div className="p-4 bg-white rounded-lg shadow-sm text-center text-red-500">
        Failed to load provincial offices.
      </div>
    );

  return (
    <div className="flex flex-col">
      <h2 className="text-lg font-semibold mb-3 text-gray-700 border-b pb-2">
        Provincial Offices
      </h2>

      <ul className={`flex flex-col gap-3`}>
        {offices.length > 0 ? (
          offices.map((office) => (
            <li
              key={office._id}
              onClick={() => setSelectedOffice(office)}
              className={`flex items-center gap-3 p-3 py-4 rounded-lg border cursor-pointer shadow-sm
                transition-colors hover:bg-neutral-50
                ${
                  selectedOffice?._id === office._id
                    ? "bg-blue-50 border-neutral-400 font-medium"
                    : "bg-white border-neutral-200/80"
                }`}
            >
              <span className="text-sm text-neutral-800">{office.name}</span>
            </li>
          ))
        ) : (
          <li className="text-gray-500 italic text-center py-4 text-sm">
            No provincial offices found
          </li>
        )}
      </ul>
    </div>
  );
};

export default ProvincialOfficesList;
