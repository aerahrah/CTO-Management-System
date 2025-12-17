import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRecentCreditRequest, rollbackCreditCto } from "../../../api/cto";
import { useState, useEffect } from "react";
import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import AllCtoCreditHistory from "./allCtoCreditHistory";
import { CustomButton, TableActionButton } from "../../customButton";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Clipboard, Eye } from "lucide-react";

const CtoCreditHistory = () => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmRollback, setIsConfirmRollback] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState(null);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });

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

  useEffect(() => {
    if (credits.length > 0) {
      console.log("Fetched credits:", credits);
    }
  }, [credits]);

  return (
    <>
      <h2 className="flex items-center gap-3 mb-4 border-b pb-2">
        <span className="flex items-center justify-center w-8 h-8 bg-violet-600 rounded-full">
          <Clipboard className="w-5 h-5 text-white" />
        </span>
        <span className="text-xl font-bold text-gray-800">
          Recent Credit History
        </span>
      </h2>
      <div className="overflow-x-auto">
        <div className="max-h-104 overflow-y-auto">
          <table className="w-full table-fixed text-sm rounded-lg shadow-sm">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-left sticky top-0 z-10">
              <tr>
                <th className="p-3 w-36 border-b border-r border-gray-200">
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
              {isLoading || isProcessing ? (
                [...Array(8)].map((_, i) => (
                  <tr
                    key={i}
                    className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  >
                    <td className="p-3 w-36 border-b border-r border-gray-200">
                      <Skeleton width={80} height={20} />
                    </td>
                    <td className="p-3 text-center border-b border-r border-gray-200">
                      <Skeleton width={80} height={20} />
                    </td>
                    <td className="p-3 border-b border-r border-gray-200">
                      <Skeleton width={40} height={20} />
                    </td>
                    <td className="p-3 text-center border-b border-r border-gray-200">
                      <Skeleton width={90} height={20} />
                    </td>
                    <td className="p-3 text-center border-b border-gray-200">
                      <Skeleton width={80} height={24} />
                    </td>
                  </tr>
                ))
              ) : credits.length > 0 ? (
                credits.map((credit, index) => (
                  <tr
                    key={credit._id}
                    className={`transition-colors ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-gray-100`}
                  >
                    <td className="p-3 font-medium text-gray-800 border-b border-gray-200 border-r">
                      {credit.employees
                        .map(
                          (e) =>
                            `${e.employee?.firstName} ${e.employee?.lastName}`
                        )
                        .join(", ")}
                    </td>
                    <td className="p-3 text-center border-b border-gray-200 border-r">
                      {formatDuration(credit.duration)}
                    </td>

                    {/* Memo Button */}
                    <td className="p-3 border-b border-gray-200 border-r text-center">
                      <TableActionButton
                        label="View Memo"
                        onClick={() =>
                          setMemoModal({ isOpen: true, memo: credit })
                        }
                        variant="neutral"
                      />
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
        <p className="text-l py-2">
          Are you sure you want to rollback this credited CTO? This will remove
          the credits from the employee balances.
        </p>
      </Modal>

      {/* Memo Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memo: null })}
        title={`Memo: ${memoModal.memo?.memoNo || ""}`}
        action={{
          label: "Open in new Tab",
          variant: "save",
          show: true,
          onClick: () => {
            if (memoModal.memo?.uploadedMemo) {
              const url = `http://localhost:3000/${memoModal.memo.uploadedMemo.replace(
                /\\/g,
                "/"
              )}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }
          }, // <-- call form submit here
        }}
        closeLabel="Close"
      >
        {memoModal.memo?.uploadedMemo ? (
          memoModal.memo.uploadedMemo.endsWith(".pdf") ? (
            <div className="flex flex-col gap-2 w-100">
              <iframe
                src={`http://localhost:3000/${memoModal.memo.uploadedMemo.replace(
                  /\\/g,
                  "/"
                )}`}
                title={memoModal.memo.memoNo}
                className="w-full h-96 border"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-gray-100 border">
              <p>No preview available</p>
            </div>
          )
        ) : (
          <p className="text-gray-500">No uploaded memo found.</p>
        )}
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
