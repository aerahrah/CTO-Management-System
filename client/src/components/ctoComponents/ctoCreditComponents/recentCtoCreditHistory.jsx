import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRecentCreditRequest, rollbackCreditCto } from "../../../api/cto";
import { useState } from "react";
import Modal from "../../modal";
import AllCtoCreditHistory from "./allCtoCreditHistory";

const CtoCreditHistory = () => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmRollback, setIsConfirmRollback] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState(null);

  const {
    data: credits = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["recentCredits"],
    queryFn: fetchRecentCreditRequest,
  });

  const { mutate: rollbackRequest, isLoading: isProcessing } = useMutation({
    mutationFn: rollbackCreditCto,
    onSuccess: () => {
      queryClient.invalidateQueries(["recentCredits"]);
      queryClient.invalidateQueries(["allCredits"]);
    },
  });

  const handleRollback = (id) => {
    setSelectedCreditId(id);
    setIsConfirmRollback(true);
  };

  const confirmRollback = () => {
    if (selectedCreditId) rollbackRequest(selectedCreditId);
    setIsConfirmRollback(false);
  };

  if (isLoading || isProcessing) {
    return (
      <div className="bg-white p-6 rounded-md shadow-lg">
        <h2 className="text-xl font-semibold mb-6 border-b pb-2">
          📜 Recent Credit History
        </h2>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white p-6 rounded-md shadow-lg">
        <h2 className="text-xl font-semibold mb-6 border-b pb-2">
          📜 Recent Credit History
        </h2>
        <p className="text-red-500">Error fetching recent history</p>
      </div>
    );
  }

  const formatDuration = (duration) => {
    if (!duration) return "-";
    const { hours = 0, minutes = 0 } = duration;
    return `${hours}h ${minutes}m`;
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 border-b pb-2">
        📜 Recent Credit History
      </h2>
      <div className="overflow-x-auto">
        <div className="max-h-104 overflow-y-auto">
          <table className="w-full text-sm rounded-lg shadow-sm">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-left sticky top-0 z-10">
              <tr>
                <th className="p-3 border-b border-r border-gray-200">
                  Employees
                </th>
                <th className="p-3 text-center border-b border-r border-gray-200">
                  Duration
                </th>
                <th className="p-3 border-b border-r border-gray-200">
                  Memo No.
                </th>
                <th className="p-3 text-center border-b border-r border-gray-200">
                  Status
                </th>
                <th className="p-3 text-center border-b border-gray-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {credits.length > 0 ? (
                credits.map((credit, index) => (
                  <tr
                    key={credit._id}
                    className={`transition-colors ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-gray-100`}
                  >
                    <td className="p-3 font-medium text-gray-800 border-b border-gray-200 border-r">
                      {credit.employees
                        .map((e) => `${e.firstName} ${e.lastName}`)
                        .join(", ")}
                    </td>
                    <td className="p-3 text-center border-b border-gray-200 border-r">
                      {formatDuration(credit.duration)}
                    </td>
                    <td className="p-3 border-b border-gray-200 border-r">
                      {credit.memoNo}
                    </td>
                    <td
                      className={`p-3 font-semibold text-center border-b border-gray-200 border-r ${
                        credit.status === "CREDITED"
                          ? "text-green-600"
                          : credit.status === "ROLLEDBACK"
                          ? "text-red-600"
                          : "text-gray-500"
                      }`}
                    >
                      {credit.status}
                    </td>
                    <td className="p-3 text-center border-b border-gray-200">
                      <button
                        onClick={() => handleRollback(credit._id)}
                        disabled={credit.status !== "CREDITED"}
                        className={`px-3 py-1 text-sm rounded transition ${
                          credit.status === "CREDITED"
                            ? "bg-neutral-700 text-white hover:bg-neutral-900"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        Rollback
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-3 text-center text-gray-500">
                    No recent credit requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 text-neutral-800 border-1 border-neutral-800 rounded-sm text-sm font-medium hover:bg-neutral-800 hover:text-neutral-100 transition active:scale-96 cursor-pointer"
        >
          View More →
        </button>
      </div>

      {/* Confirm Rollback Modal */}
      <Modal
        isOpen={isConfirmRollback}
        onClose={() => setIsConfirmRollback(false)}
        title="Confirm Rollback"
      >
        <div className="w-100">
          <p className="text-l py-2">
            Are you sure you want to rollback this credited CTO? This will
            remove the credits from the employee balances.
          </p>

          <div className="flex gap-4">
            <button
              onClick={() => setIsConfirmRollback(false)}
              className="px-4 py-2 mt-4 w-full bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={confirmRollback}
              className="px-4 py-2 mt-4 w-full bg-red-600 text-red-50 rounded hover:bg-red-700"
            >
              Confirm Rollback
            </button>
          </div>
        </div>
      </Modal>

      {/* View All History Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="View All Credit Request History"
      >
        <AllCtoCreditHistory />
        <button
          onClick={() => setIsOpen(false)}
          className="px-4 py-2 mt-4 w-36 bg-gray-200 rounded hover:bg-gray-300"
        >
          Close
        </button>
      </Modal>
    </>
  );
};

export default CtoCreditHistory;
