import { useState, useEffect } from "react";
import Modal from "../../modal";
import { TableActionButton } from "../../customButton";
import { StatusBadge } from "../../statusUtils"; // <-- import StatusBadge

const ApplicationCtoTable = ({ applications }) => {
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  useEffect(() => {
    console.log("Applications received in ApplicationCtoTable:", applications);
  }, [applications]);

  //   const formatDuration = (duration) => {
  //     if (!duration) return "-";
  //     const { hours = 0, minutes = 0 } = duration;
  //     return `${hours}h ${minutes}m`;
  //   };

  const formatDuration = (duration) => {
    if (!duration) return "-";

    return `${duration} hours`;
  };

  const openMemoModal = (memos) => {
    setMemoModal({ isOpen: true, memos });
  };

  return (
    <div className="overflow-x-auto">
      <div className="max-h-96 overflow-y-auto rounded-lg shadow-sm">
        <table className="w-full table-fixed text-sm rounded-lg shadow-sm">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-left sticky top-0 z-10">
            <tr>
              <th className="p-3 w-36 border-b border-r border-gray-200">
                Memo No.
              </th>
              <th className="p-3 border-b border-r border-gray-200">
                Request Date
              </th>
              <th className="p-3 border-b border-r border-gray-200">Status</th>
              <th className="p-3 text-center border-b border-r border-gray-200">
                Requested Duration
              </th>
              <th className="p-3 text-center border-b border-r border-gray-200">
                Memo File
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.length > 0 ? (
              applications.map((app, index) => (
                <tr
                  key={app._id}
                  className={`transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100`}
                >
                  <td className="p-3 border-b border-r border-gray-200 font-medium text-gray-800">
                    {app.memo?.length > 0
                      ? app.memo.map((m) => m.memoId?.memoNo).join(", ")
                      : "-"}
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-gray-700">
                    {app.createdAt
                      ? new Date(app.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "-"}
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-center font-semibold">
                    <StatusBadge status={app.overallStatus} />
                  </td>
                  <td className="p-3 text-center border-b border-r border-gray-200 font-semibold text-blue-700">
                    {formatDuration(app.requestedHours)}
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-center">
                    {app.memo?.length > 0 ? (
                      <TableActionButton
                        label={`View Memos (${app.memo.length})`}
                        onClick={() => openMemoModal(app.memo)}
                        variant="secondary"
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">No memos</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="5"
                  className="p-3 text-center text-gray-500 border-b border-gray-200"
                >
                  No CTO applications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Memo Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memos: [] })}
        title="Memos Used in CTO Application"
        closeLabel="Close"
      >
        <div className="max-h-[500px] overflow-y-auto relative">
          {memoModal.memos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">
              No memos available
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-neutral-100 rounded-md">
              {memoModal.memos.map((memo, i) => (
                <div
                  key={i}
                  className="bg-white border border-gray-300 rounded-md shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  {memo.uploadedMemo?.endsWith(".pdf") ? (
                    <iframe
                      src={`http://localhost:3000${memo.uploadedMemo}`}
                      title={memo.memoId?.memoNo || `Memo ${i}`}
                      className="w-full h-40 border-b border-gray-200 rounded-t-md"
                    />
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center bg-gray-50 border-b border-gray-200 rounded-t-md">
                      <p className="text-gray-400 text-sm">
                        No Preview Available
                      </p>
                    </div>
                  )}

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="mb-3">
                      <div className="flex gap-1 font-semibold">
                        <p>Memo: </p>
                        <p className="text-gray-900 text-sm md:text-base">
                          {memo.memoId?.memoNo || "—"}
                        </p>
                      </div>
                      <p className="text-gray-500 text-xs md:text-sm">
                        Hours: {memo.memoId?.totalHours || "—"}
                      </p>
                    </div>

                    <div className="flex justify-between gap-2 mt-auto">
                      <a
                        href={`http://localhost:3000${memo?.uploadedMemo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-1 px-3 py-1 text-xs md:text-sm font-medium border border-gray-400 rounded hover:bg-gray-100 transition-colors"
                      >
                        View
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ApplicationCtoTable;
