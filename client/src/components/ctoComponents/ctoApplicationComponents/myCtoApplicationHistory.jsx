import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "../../statusUtils";
import { fetchMyCtoApplications } from "../../../api/cto";
import Modal from "../../modal";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";
import { TableActionButton } from "../../customButton";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Clipboard } from "lucide-react";

const MyCtoApplications = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ctoApplications"],
    queryFn: fetchMyCtoApplications,
  });

  const [selectedApp, setSelectedApp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const applications = data?.applications || [];

  const openModal = (app) => {
    setSelectedApp(app);
    setIsModalOpen(true);
  };

  // --- Loading State: Skeleton Rows ---
  if (isLoading)
    return (
      <div className="h-full">
        <h2 className="flex items-center gap-3 mb-4 border-b pb-2">
          <span className="flex items-center justify-center w-8 h-8  bg-violet-600 rounded-full">
            <Clipboard className="w-5 h-5 text-white" />
          </span>
          <span className="text-xl font-bold text-gray-800">
            My CTO Applications
          </span>
        </h2>
        <div className="overflow-x-auto">
          <div className="max-h-128 overflow-y-auto rounded-lg shadow-sm">
            <table className="w-full table-fixed text-sm rounded-lg shadow-sm">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-left sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-36 border-b border-r border-gray-200">
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
                {[...Array(9)].map((_, i) => (
                  <tr
                    key={i}
                    className={`transition-colors ${
                      i % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <td className="p-3 border-b border-r border-gray-200 text-gray-800 font-medium">
                      <Skeleton width={20} height={20} />
                    </td>
                    <td className="p-3 border-b border-r border-gray-200 text-center font-semibold">
                      <Skeleton width={90} height={20} />
                    </td>
                    <td className="p-3 border-b border-r border-gray-200 text-sm text-gray-500">
                      <Skeleton width={110} height={20} />
                    </td>
                    <td className="p-3 text-center border-b border-gray-200">
                      <Skeleton width={95} height={24} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

  // --- Error State ---
  if (isError)
    return (
      <div className="bg-white p-6 rounded-md shadow-lg">
        <p className="text-red-500">
          Error: {error.message || "Failed to load applications."}
        </p>
      </div>
    );

  // --- Empty State ---
  if (applications.length === 0)
    return (
      <div className="bg-white p-6 rounded-md shadow-lg">
        <p className="text-gray-500">
          You don’t have any CTO applications yet.
        </p>
      </div>
    );

  // --- Main Table Render ---
  return (
    <div>
      <h2 className="flex items-center gap-3 mb-4 border-b pb-2">
        <span className="flex items-center justify-center w-8 h-8  bg-violet-600 rounded-full">
          <Clipboard className="w-5 h-5 text-white" />
        </span>
        <span className="text-xl font-bold text-gray-800">
          My CTO Applications
        </span>
      </h2>

      <div className="overflow-x-auto">
        <div className="max-h-128 overflow-y-auto rounded-lg shadow-sm">
          <table className="w-full table-fixed text-sm rounded-lg shadow-sm">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-left sticky top-0 z-10">
              <tr>
                <th className="p-3 w-36 border-b border-r border-gray-200">
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
                    <StatusBadge status={app.overallStatus} />
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-sm text-gray-500">
                    {new Date(app.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </td>
                  <td className="p-3 text-center border-b border-gray-200">
                    <TableActionButton
                      label="View Details"
                      onClick={() => openModal(app)}
                      variant="neutral"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {selectedApp && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="CTO Application Details"
        >
          <CtoApplicationDetails app={selectedApp} loading={!selectedApp} />
        </Modal>
      )}
    </div>
  );
};

export default MyCtoApplications;
