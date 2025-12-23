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
const statusOptions = ["All", "PENDING", "APPROVED", "REJECTED"];
const pageSizeOptions = [20, 50, 100];

/* =========================
   COMPONENT
========================= */
const ApplicationCtoTable = ({
  applications = [],
  status,
  onStatusChange,
  search,
  onSearchChange,
  page,
  limit,
  onLimitChange,
  onNextPage,
  onPrevPage,
  totalPages,
  isLoading,
}) => {
  const [memoModal, setMemoModal] = useState({
    isOpen: false,
    memos: [],
  });

  const openMemoModal = (memos) => setMemoModal({ isOpen: true, memos });

  const closeMemoModal = () => setMemoModal({ isOpen: false, memos: [] });

  const formatDuration = (hours) => (!hours ? "-" : `${hours} hours`);

  /* =========================
     FILTER LOGIC
  ========================== */
  const filteredApps = applications.filter((app) => {
    const matchesStatus =
      !status || status === "All" ? true : app.overallStatus === status;

    const matchesSearch = !search
      ? true
      : Array.isArray(app.memo) &&
        app.memo.some((m) =>
          m?.memoId?.memoNo?.toLowerCase().includes(search.toLowerCase())
        );

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="overflow-x-auto">
      {/* =========================
          FILTERS
      ========================= */}
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
      ========================= */}
      <div className="max-h-96 overflow-y-auto rounded-sm border border-neutral-300">
        <table className="w-full text-sm table-fixed ">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 sticky top-0 outline-1 outline-neutral-300">
            <tr>
              <th className="p-3 border-r border-b border-neutral-300">
                Memo No.
              </th>
              <th className="p-3 border-r border-b border-neutral-300">
                Request Date
              </th>
              <th className="p-3 border-r border-b border-neutral-300 text-center">
                Status
              </th>
              <th className="p-3 border-r border-b border-neutral-300  text-center">
                Requested Duration
              </th>
              <th className="p-3 border-b border-neutral-300 text-center">
                Memo File
              </th>
            </tr>
          </thead>

          <tbody>
            {/* =========================
                LOADING (TABLE ONLY)
            ========================= */}
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
                  <td className="p-3 border-r border-b border-neutral-300  text-center">
                    <Skeleton width={100} />
                  </td>
                  <td className="p-3 border-b border-neutral-300 text-center">
                    <Skeleton width={90} />
                  </td>
                </tr>
              ))
            ) : filteredApps.length > 0 ? (
              filteredApps.map((app, index) => (
                <tr
                  key={app._id}
                  className={`transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100`}
                >
                  <td className="p-3 border-r border-b border-neutral-300 font-medium text-gray-700">
                    {Array.isArray(app.memo) && app.memo.length > 0
                      ? app.memo.map((m) => m?.memoId?.memoNo).join(", ")
                      : "-"}
                  </td>

                  <td className="p-3 border-r border-b border-neutral-300">
                    {app.createdAt
                      ? new Date(app.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "-"}
                  </td>

                  <td className="p-3 border-r border-b border-neutral-300 text-center">
                    <StatusBadge status={app.overallStatus} />
                  </td>

                  <td className="p-3 border-r border-b border-neutral-300 text-center font-semibold text-blue-700">
                    {formatDuration(app.requestedHours)}
                  </td>

                  <td className="p-3 border-b border-neutral-300 text-center">
                    {Array.isArray(app.memo) && app.memo.length > 0 ? (
                      <TableActionButton
                        label={`View (${app.memo.length})`}
                        variant="secondary"
                        onClick={() => openMemoModal(app.memo)}
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">No memos</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No CTO applications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =========================
          PAGINATION
      ========================= */}
      <div className="flex justify-between items-center mt-3">
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
      ========================= */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={closeMemoModal}
        title="Memos Used in CTO Application"
        closeLabel="Close"
      >
        <div className="max-h-[500px] overflow-y-auto">
          {memoModal.memos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">
              No memos available
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
                      title={memo.memoId?.memoNo || `Memo ${i}`}
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
                      <span className="font-normal">
                        {memo.memoId?.memoNo || "—"}
                      </span>
                    </p>

                    <p className="text-xs text-gray-500">
                      Total Hours: {memo.memoId?.totalHours || "—"}
                    </p>

                    <a
                      href={`http://localhost:3000${memo.uploadedMemo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-center text-sm px-3 py-1 border rounded hover:bg-gray-100"
                    >
                      View Memo
                    </a>
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
