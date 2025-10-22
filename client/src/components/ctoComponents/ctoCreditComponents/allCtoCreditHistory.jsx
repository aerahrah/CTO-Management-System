import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllCreditRequests, rollbackCreditCto } from "../../../api/cto";
import { useState } from "react";
import Modal from "../../modal";
import { CustomButton, TableActionButton } from "../../customButton";

const AllCtoCreditHistory = () => {
  const queryClient = useQueryClient();
  const [isConfirmRollback, setIsConfirmRollback] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState(null);

  const {
    data: credits = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["allCredits"],
    queryFn: fetchAllCreditRequests,
  });

  const { mutate: rollbackRequest, isLoading: isProcessing } = useMutation({
    mutationFn: rollbackCreditCto,
    onSuccess: () => {
      queryClient.invalidateQueries(["allCredits"]);
      queryClient.invalidateQueries(["recentCredits"]);
    },
  });

  const handleRollback = (id) => {
    setSelectedCreditId(id);
    setIsConfirmRollback(true);
  };

  const confirmRollback = () => {
    if (selectedCreditId) {
      rollbackRequest(selectedCreditId);
    }
    setIsConfirmRollback(false);
  };

  const formatDate = (date) =>
    date ? new Date(date).toLocaleDateString("en-PH") : "-";

  const formatDuration = (duration) => {
    if (!duration) return "-";
    const h = duration.hours || 0;
    const m = duration.minutes || 0;
    return `${h}h ${m}m`;
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white p-6">
        <p className="text-red-500">Error fetching credit requests</p>
      </div>
    );
  }

  return (
    <div className="bg-white h-128 overflow-y-auto">
      <div className="overflow-x-auto">
        <table className="w-full text-sm rounded-lg shadow-sm">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-left sticky top-0 z-10">
            <tr>
              <th className="p-3 border-b border-r border-gray-200">
                Employees
              </th>
              <th className="p-3 border-b border-r border-gray-200">
                Credited By
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
              <th className="p-3 text-center border-b border-r border-gray-200">
                Date Approved
              </th>
              <th className="p-3 text-center border-b border-r border-gray-200">
                Date Credited
              </th>
              <th className="p-3 text-center border-b border-r border-gray-200">
                Rolledback At
              </th>
              <th className="p-3 text-center border-b border-r border-gray-200">
                Rolledback By
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
                  <td className="p-3 border-b border-gray-200 border-r">
                    {credit.creditedBy
                      ? `${credit.creditedBy.firstName} ${credit.creditedBy.lastName}`
                      : "-"}
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

                  <td className="p-3 text-center border-b border-gray-200 border-r">
                    {formatDate(credit.dateApproved)}
                  </td>
                  <td className="p-3 text-center border-b border-gray-200 border-r">
                    {formatDate(credit.dateCredited)}
                  </td>
                  <td className="p-3 text-center border-b border-gray-200 border-r">
                    {formatDate(credit.dateRolledBack)}
                  </td>
                  <td className="p-3 border-b border-gray-200 border-r">
                    {credit.rolledBackBy
                      ? `${credit.rolledBackBy.firstName} ${credit.rolledBackBy.lastName}`
                      : "-"}
                  </td>
                  <td className="p-3 text-center border-b border-gray-200">
                    <TableActionButton
                      label={isProcessing ? "Processing..." : "Rollback"}
                      onClick={() => handleRollback(credit._id)}
                      variant="neutral"
                      disabled={credit.status !== "CREDITED" || isProcessing}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="11" className="p-3 text-center text-gray-500">
                  No credit requests found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isConfirmRollback}
        onClose={() => setIsConfirmRollback(false)}
        title="Confirm Rollback"
        action={{
          label: "Confirm Rollback",
          onClick: confirmRollback,
          show: true,
          variant: "delete",
        }}
      >
        <div className="w-100">
          <p className="text-l py-2">
            Are you sure you want to rollback this credited CTO? This will
            remove the credits from the employee balances.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default AllCtoCreditHistory;
