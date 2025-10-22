import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRecentCreditRequest, rollbackCreditCto } from "../../../api/cto";
import { useState } from "react";
import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import AllCtoCreditHistory from "./allCtoCreditHistory";
import { CustomButton, TableActionButton } from "../../customButton";

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

  const formatDuration = (duration) => {
    if (!duration) return "-";
    const { hours = 0, minutes = 0 } = duration;
    return `${hours}h ${minutes}m`;
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
                  Action
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
                    <td className="p-3 font-semibold text-center border-b border-gray-200 border-r">
                      <StatusBadge status={credit.status} />
                    </td>
                    <td className="p-3 text-center border-b border-gray-200">
                      <TableActionButton
                        label={isProcessing ? "Processing..." : "Rollback"}
                        onClick={() => handleRollback(credit._id)}
                        disabled={credit.status !== "CREDITED" || isProcessing}
                        variant="neutral"
                      />
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
        <CustomButton
          label="View More →"
          onClick={() => setIsOpen(true)}
          variant="neutral"
        />
      </div>

      {/* Confirm Rollback Modal */}
      <Modal
        isOpen={isConfirmRollback}
        onClose={() => setIsConfirmRollback(false)}
        action={{
          label: "Confirm Rollback",
          onClick: confirmRollback,
          show: true,
          variant: "delete",
        }}
        closeLabel="Cancel"
        title="Confirm Rollback"
      >
        <div className="w-100">
          <p className="text-l py-2">
            Are you sure you want to rollback this credited CTO? This will
            remove the credits from the employee balances.
          </p>
        </div>
      </Modal>

      {/* View All History Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="View All Credit Request History"
      >
        <AllCtoCreditHistory />
      </Modal>
    </>
  );
};

export default CtoCreditHistory;
