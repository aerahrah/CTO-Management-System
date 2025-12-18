import { useState, useEffect } from "react";
import Modal from "../../modal";
import { TableActionButton } from "../../customButton";

const CreditCtoTable = ({ credits }) => {
  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });

  // Filter only credited records
  const creditedRecords = credits.filter((c) => c.status === "CREDITED");

  // Log the credits whenever they change
  useEffect(() => {
    console.log("Credits received in CreditCtoTable:", credits);
    console.log("Filtered credited records:", creditedRecords);
  }, [credits, creditedRecords]);

  const formatDuration = (duration) => {
    if (!duration) return "-";
    const { hours = 0, minutes = 0 } = duration;
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="max-h-96 overflow-y-auto rounded-lg shadow-sm">
        <table className="w-full text-sm items-center">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 sticky top-0 z-10">
            <tr>
              <th className="p-3 border-b border-r border-gray-200">
                Memo No.
              </th>
              <th className="p-3 border-b border-r border-gray-200">
                Date Approved
              </th>
              <th className="p-3 border-b border-r border-gray-200">
                Credited By
              </th>
              <th className="p-3 text-center border-b border-r border-gray-200">
                Duration
              </th>
              <th className="p-3 text-center border-b border-r border-gray-200">
                Memo File
              </th>
            </tr>
          </thead>
          <tbody>
            {creditedRecords.length > 0 ? (
              creditedRecords.map((c, index) => (
                <tr
                  key={c._id}
                  className={`transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100`}
                >
                  <td className="p-3 border-b border-r border-gray-200 font-medium text-gray-700">
                    {c.memoNo || "-"}
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-gray-700">
                    {c.dateApproved
                      ? new Date(c.dateApproved).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "-"}
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-gray-800">
                    {c.creditedBy
                      ? `${c.creditedBy.firstName} ${c.creditedBy.lastName}`
                      : "-"}
                  </td>
                  <td className="p-3 text-center border-b border-r border-gray-200 font-semibold text-blue-700">
                    {formatDuration(c.duration)}
                  </td>
                  <td className="p-3 border-b text-center border-r border-gray-200 text-gray-700">
                    <TableActionButton
                      label="View Memo"
                      variant="default"
                      size="sm"
                      onClick={() => setMemoModal({ isOpen: true, memo: c })}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="5"
                  className="p-3 text-center text-gray-500 border-b border-gray-200"
                >
                  No credited records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Memo Preview Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memo: null })}
        title={`Memo: ${memoModal.memo?.memoNo || ""}`}
        action={{
          label: "Open in new Tab",
          variant: "save",
          show: !!memoModal.memo?.uploadedMemo,
          onClick: () => {
            if (memoModal.memo?.uploadedMemo) {
              const url = `http://localhost:3000/${memoModal.memo.uploadedMemo.replace(
                /\\/g,
                "/"
              )}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }
          },
        }}
        closeLabel="Close"
      >
        {memoModal.memo?.uploadedMemo ? (
          memoModal.memo.uploadedMemo.endsWith(".pdf") ? (
            <div className="flex flex-col gap-2 w-full">
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
    </div>
  );
};

export default CreditCtoTable;
