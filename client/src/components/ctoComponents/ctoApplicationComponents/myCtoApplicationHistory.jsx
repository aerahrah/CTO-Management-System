import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyCtoApplications } from "../../../api/cto";
import Modal from "../../modal";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";

const MyCtoApplications = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ctoApplications"],
    queryFn: fetchMyCtoApplications,
  });

  const [selectedApp, setSelectedApp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const applications = data?.applications || [];

  if (isLoading)
    return (
      <div className="bg-white p-6 rounded-md shadow-lg">
        <h2 className="text-xl font-semibold mb-6 border-b pb-2">
          📋 My CTO Applications
        </h2>
        <p className="text-gray-500">Loading...</p>
      </div>
    );

  if (isError)
    return (
      <div className="bg-white p-6 rounded-md shadow-lg">
        <h2 className="text-xl font-semibold mb-6 border-b pb-2">
          📋 My CTO Applications
        </h2>
        <p className="text-red-500">
          Error: {error.message || "Failed to load applications."}
        </p>
      </div>
    );

  if (applications.length === 0)
    return (
      <div className="bg-white p-6 rounded-md shadow-lg">
        <h2 className="text-xl font-semibold mb-6 border-b pb-2">
          📋 My CTO Applications
        </h2>
        <p className="text-gray-500">
          You don’t have any CTO applications yet.
        </p>
      </div>
    );

  const openModal = (app) => {
    setSelectedApp(app);
    setIsModalOpen(true);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-2">
        📋 My CTO Applications
      </h2>

      <div className="overflow-x-auto">
        <div className="max-h-128 overflow-y-auto rounded-lg shadow-sm">
          <table className="w-full text-sm rounded-lg shadow-sm">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-left sticky top-0 z-10">
              <tr>
                <th className="p-3 border-b border-r border-gray-200">
                  Requested Hours
                </th>
                <th className="p-3 border-b border-r border-gray-200">
                  Status
                </th>
                <th className="p-3 border-b border-r border-gray-200">
                  Submitted
                </th>
                <th className="p-3 text-center border-b border-gray-200">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app, index) => (
                <tr
                  key={app._id}
                  className={`transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100`}
                >
                  <td className="p-3 border-b border-r border-gray-200 text-gray-800 font-medium">
                    {app.requestedHours}
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-center font-semibold">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        app.overallStatus === "APPROVED"
                          ? "bg-green-100 text-green-700"
                          : app.overallStatus === "DENIED"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {app.overallStatus}
                    </span>
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-sm text-gray-500">
                    {new Date(app.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </td>
                  <td className="p-3 text-center border-b border-gray-200">
                    <button
                      onClick={() => openModal(app)}
                      className="bg-neutral-700 text-white px-3 py-1.5 rounded-sm hover:bg-neutral-800 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedApp && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="CTO Application Details"
        >
          <CtoApplicationDetails app={selectedApp} />
        </Modal>
      )}
    </div>
  );
};

export default MyCtoApplications;
