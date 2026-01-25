import { useState } from "react";
import Modal from "../../modal";
import { TableActionButton } from "../../customButton";
import { StatusBadge } from "../../statusUtils";
import FilterSelect from "../../filterSelect";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

/* =========================
   CONSTANTS
========================= */
const statusOptions = ["All", "ACTIVE", "EXHAUSTED", "ROLLEDBACK"];
const pageSizeOptions = [20, 50, 100];

/* =========================
   COMPONENT
========================= */
const CreditCtoTable = ({
  credits = [],
  search,
  status,
  onSearchChange,
  onStatusChange,
  page = 1,
  limit = 20,
  onLimitChange,
  totalPages = 1,
  onNextPage,
  onPrevPage,
  isLoading,
}) => {
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  const openMemoModal = (memo) => setMemoModal({ isOpen: true, memos: [memo] });
  const closeMemoModal = () => setMemoModal({ isOpen: false, memos: [] });

  const formatDuration = (duration) => {
    if (!duration) return "-";
    const { hours = 0, minutes = 0 } = duration;
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="overflow-x-auto flex flex-col h-full">
      {/* =========================
          FILTERS
      ========================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 font-medium">Status:</span>
          <FilterSelect
            value={status || "All"}
            options={statusOptions}
            onChange={(val) => onStatusChange(val === "All" ? "" : val)}
            width={36}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 font-medium">
            Search Memo:
          </span>
          <input
            type="text"
            value={search || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Memo No..."
            className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
          />
        </div>
      </div>

      {/* =========================
          TABLE
      ========================== */}
      <div className="overflow-y-auto rounded-sm border border-neutral-300 h-full">
        <table className="w-full h-full text-sm table-fixed">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 sticky top-0 outline-1 outline-neutral-300">
            <tr>
              <th className="p-3 border-r border-b border-neutral-300">
                Memo No.
              </th>
              <th className="p-3 border-r border-b border-neutral-300">
                Date Approved
              </th>
              <th className="p-3 border-r border-b border-neutral-300 text-center">
                Status
              </th>
              <th className="p-3 border-r border-b border-neutral-300 text-center">
                Duration
              </th>
              <th className="p-3 border-b border-neutral-300 text-center">
                Credited By
              </th>
              <th className="p-3 border-b border-neutral-300 text-center">
                Memo File
              </th>
            </tr>
          </thead>

          <tbody className="h-full">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td className="p-3 border-r border-b border-neutral-300">
                    <Skeleton />
                  </td>
                  <td className="p-3 border-r border-b border-neutral-300">
                    <Skeleton />
                  </td>
                  <td className="p-3 border-r border-b border-neutral-300 text-center">
                    <Skeleton width={80} />
                  </td>
                  <td className="p-3 border-r border-b border-neutral-300 text-center">
                    <Skeleton width={100} />
                  </td>
                  <td className="p-3 border-r border-b border-neutral-300 text-center">
                    <Skeleton width={120} />
                  </td>
                  <td className="p-3 border-b border-neutral-300 text-center">
                    <Skeleton width={90} />
                  </td>
                </tr>
              ))
            ) : credits.length > 0 ? (
              credits.map((c, index) => (
                <tr
                  key={c._id}
                  className={`transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100`}
                >
                  <td className="p-3 border-r border-b border-neutral-300 font-medium text-gray-700">
                    {c.memoNo || "-"}
                  </td>
                  <td className="p-3 border-r border-b border-neutral-300">
                    {c.dateApproved
                      ? new Date(c.dateApproved).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "-"}
                  </td>
                  <td className="p-3 border-r border-b border-neutral-300 text-center">
                    <StatusBadge status={c.employeeStatus} />
                  </td>
                  <td className="p-3 border-r border-b border-neutral-300 text-center font-semibold text-blue-700">
                    {formatDuration(c.duration)}
                  </td>
                  <td className="p-3 border-r border-b border-neutral-300 text-center">
                    {c.creditedBy
                      ? `${c.creditedBy.firstName} ${c.creditedBy.lastName}`
                      : "-"}
                  </td>
                  <td className="p-3 border-b border-neutral-300 text-center">
                    {c.uploadedMemo ? (
                      <TableActionButton
                        label="View Memo"
                        variant="secondary"
                        onClick={() => openMemoModal(c)}
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">No memo</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="h-full">
                <td
                  colSpan={6}
                  className="p-4 h-full text-center text-gray-500"
                >
                  No CTO credits found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =========================
          PAGINATION
      ========================== */}
      <div className="flex justify-between items-center mt-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Rows per page:</span>
          <FilterSelect
            value={limit}
            options={pageSizeOptions}
            onChange={(val) => onLimitChange(Number(val))}
            width={20}
            openUp
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrevPage}
            disabled={page <= 1 || isLoading}
            className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
          >
            Prev
          </button>

          <span className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={onNextPage}
            disabled={page >= totalPages || isLoading}
            className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
          >
            Next
          </button>
        </div>
      </div>

      {/* =========================
          MEMO MODAL
      ========================== */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={closeMemoModal}
        title="Memo Details"
        closeLabel="Close"
      >
        <div className="max-h-[500px] overflow-y-auto">
          {memoModal.memos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">
              No memo available
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
              {memoModal.memos.map((memo, i) => (
                <div
                  key={i}
                  className="bg-white border border-gray-300 rounded-md shadow-sm flex flex-col"
                >
                  {memo.uploadedMemo?.endsWith(".pdf") ? (
                    <iframe
                      src={`http://localhost:3000${memo.uploadedMemo}`}
                      title={memo.memoNo || `Memo ${i}`}
                      className="w-full h-40 border-b"
                    />
                  ) : (
                    <div className="h-40 flex items-center justify-center bg-gray-50 border-b">
                      <p className="text-gray-400 text-sm">
                        No Preview Available
                      </p>
                    </div>
                  )}
                  <div className="p-3 flex flex-col gap-2">
                    <p className="font-semibold text-sm">
                      Memo No:{" "}
                      <span className="font-normal">{memo.memoNo || "—"}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Total Hours: {memo.duration?.hours || 0}h{" "}
                      {memo.duration?.minutes || 0}m
                    </p>
                    {memo.uploadedMemo && (
                      <a
                        href={`http://localhost:3000${memo.uploadedMemo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 text-center text-sm px-3 py-1 border rounded hover:bg-gray-100"
                      >
                        View Memo
                      </a>
                    )}
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

export default CreditCtoTable;
