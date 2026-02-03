import React, { useMemo, useState } from "react";
import Modal from "../../modal";
import { TableActionButton } from "../../customButton";
import { StatusBadge } from "../../statusUtils";
import FilterSelect from "../../filterSelect";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Inbox,
  FileText,
} from "lucide-react";
import MemoList from "../ctoMemoModal";
/* =========================
   CONSTANTS
========================= */
const statusOptions = ["PENDING", "APPROVED", "REJECTED"];
const pageSizeOptions = [20, 50, 100];

const BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_BASE_URL) ||
  "http://localhost:3000";

/* =========================
   SMALL UI
========================= */
const Chip = ({ children }) => (
  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-semibold">
    {children}
  </span>
);

const ApplicationCtoTable = ({
  applications = [],
  status = "",
  onStatusChange,
  search = "",
  onSearchChange,
  page = 1,
  limit = 20,
  onLimitChange,
  onNextPage,
  onPrevPage,
  totalPages = 1,
  total, // optional if backend provides
  isLoading,
}) => {
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  const openMemoModal = (memos) => setMemoModal({ isOpen: true, memos });
  const closeMemoModal = () => setMemoModal({ isOpen: false, memos: [] });

  const handleResetFilters = () => {
    onSearchChange?.("");
    onStatusChange?.("");
  };

  const isFiltered = Boolean(status) || Boolean(search);

  // If backend already filters, this will still work fine.
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchesStatus = !status ? true : app.overallStatus === status;

      const matchesSearch = !search
        ? true
        : Array.isArray(app.memo) &&
          app.memo.some((m) =>
            String(m?.memoId?.memoNo || "")
              .toLowerCase()
              .includes(search.toLowerCase()),
          );

      return matchesStatus && matchesSearch;
    });
  }, [applications, status, search]);

  const startItem =
    total != null ? (filteredApps.length ? (page - 1) * limit + 1 : 0) : null;
  const endItem =
    total != null
      ? filteredApps.length
        ? Math.min(page * limit, total)
        : 0
      : null;

  const showingLabel = useMemo(() => {
    if (total != null) {
      return `Showing ${startItem}-${endItem} of ${total} applications`;
    }
    return `Page ${page} of ${totalPages}`;
  }, [total, startItem, endItem, page, totalPages]);

  return (
    <div className="w-full h-full flex flex-col min-h-0 min-w-0 bg-white  overflow-hidden">
      {/* Toolbar */}
      <div className=" border-b border-neutral-100 bg-white space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Status pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => onStatusChange?.("")}
              className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all whitespace-nowrap
                ${
                  !status
                    ? "bg-neutral-900 text-white border-neutral-900 shadow-sm"
                    : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                }`}
            >
              All Status
            </button>

            {statusOptions.map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange?.(s)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all whitespace-nowrap
                  ${
                    status === s
                      ? "bg-neutral-900 text-white border-neutral-900 shadow-sm"
                      : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                  }`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search + rows */}
          <div className="flex items-center gap-3 w-full lg:w-auto min-w-0">
            <div className="relative flex-1 lg:w-72 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search memo no…"
                className="w-full h-10 pl-9 pr-9 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none
                           focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              {search && (
                <button
                  onClick={() => onSearchChange?.("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
                  aria-label="Clear search"
                  title="Clear"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>

            {/* Rows (desktop) */}
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-neutral-200">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                Show
              </span>
              <select
                value={limit}
                onChange={(e) => onLimitChange?.(Number(e.target.value))}
                className="bg-neutral-50 border border-neutral-200 text-neutral-800 text-xs rounded-lg
                           focus:ring-blue-500 focus:border-blue-500 block p-1.5 font-semibold outline-none cursor-pointer"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Rows (mobile) */}
            <div className="md:hidden flex items-center gap-1.5 px-2 border-l border-neutral-200 ml-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                Rows
              </span>
              <FilterSelect
                label=""
                value={limit}
                onChange={(v) => onLimitChange?.(Number(v))}
                options={pageSizeOptions}
                className="!mb-0 w-20 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Active filters row */}
        {isFiltered && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">
                Active:
              </span>
              {search && <Chip>“{search}”</Chip>}
              {status && <Chip>{status}</Chip>}
            </div>
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase hover:text-blue-700"
            >
              <RotateCcw size={10} /> Reset
            </button>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="flex-1 min-h-0 bg-white">
        {!isLoading && filteredApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
            <div className="bg-neutral-50 p-6 rounded-full mb-4 ring-1 ring-neutral-100">
              <Inbox className="w-10 h-10 text-neutral-300" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">
              No CTO applications found
            </h3>
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-700 underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* TABLE (sm+) */}
            <div className="hidden sm:block h-full overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0 z-10 border-b border-neutral-100">
                  <tr className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 font-bold">
                    <th className="px-4 md:px-6 py-4">Memo No.</th>
                    <th className="px-4 md:px-6 py-4">Request Date</th>
                    <th className="px-4 md:px-6 py-4 text-center">Status</th>
                    <th className="px-4 md:px-6 py-4 text-center">
                      Requested Duration
                    </th>
                    <th className="px-4 md:px-6 py-4 text-right">Memo File</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-50">
                  {isLoading
                    ? [...Array(6)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(5)].map((__, j) => (
                            <td key={j} className="px-4 md:px-6 py-4">
                              <Skeleton />
                            </td>
                          ))}
                        </tr>
                      ))
                    : filteredApps.map((app, index) => (
                        <tr
                          key={app._id}
                          className={`transition-colors hover:bg-blue-50/30 ${
                            index % 2 === 0 ? "bg-white" : "bg-neutral-50/40"
                          }`}
                        >
                          <td className="px-4 md:px-6 py-4 font-semibold text-neutral-900">
                            {Array.isArray(app.memo) && app.memo.length > 0
                              ? app.memo
                                  .map((m) => m?.memoId?.memoNo)
                                  .join(", ")
                              : "-"}
                          </td>

                          <td className="px-4 md:px-6 py-4 text-neutral-600">
                            {app.createdAt
                              ? new Date(app.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  },
                                )
                              : "-"}
                          </td>

                          <td className="px-4 md:px-6 py-4 text-center">
                            <StatusBadge status={app.overallStatus} />
                          </td>

                          <td className="px-4 md:px-6 py-4 text-center font-semibold text-blue-700">
                            {app.requestedHours
                              ? `${app.requestedHours} hours`
                              : "-"}
                          </td>

                          <td className="px-4 md:px-6 py-4 text-right">
                            {Array.isArray(app.memo) && app.memo.length > 0 ? (
                              <TableActionButton
                                label={`View (${app.memo.length})`}
                                variant="secondary"
                                onClick={() => openMemoModal(app.memo)}
                              />
                            ) : (
                              <span className="text-neutral-400 text-sm">
                                No memos
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE LIST */}
            <div className="sm:hidden h-full overflow-y-auto p-3 space-y-2">
              {isLoading
                ? [...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="border border-neutral-200 rounded-xl p-3 bg-white"
                    >
                      <Skeleton height={14} width="60%" />
                      <div className="mt-2">
                        <Skeleton height={12} width="40%" />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Skeleton height={20} width={70} />
                        <Skeleton height={20} width={70} />
                      </div>
                    </div>
                  ))
                : filteredApps.map((app) => (
                    <div
                      key={app._id}
                      className="border border-neutral-200 rounded-xl p-3 bg-white shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-neutral-900 truncate">
                            {Array.isArray(app.memo) && app.memo.length > 0
                              ? app.memo
                                  .map((m) => m?.memoId?.memoNo)
                                  .join(", ")
                              : "No memo"}
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5">
                            {app.createdAt
                              ? new Date(app.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )
                              : "-"}
                          </div>
                        </div>
                        <div className="flex-none">
                          <StatusBadge status={app.overallStatus} />
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-neutral-600">
                        <span className="font-semibold text-neutral-800">
                          Requested:
                        </span>{" "}
                        {app.requestedHours
                          ? `${app.requestedHours} hours`
                          : "-"}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2 text-xs text-neutral-500">
                          <FileText className="w-4 h-4 text-neutral-400" />
                          <span className="truncate">
                            {Array.isArray(app.memo) && app.memo.length > 0
                              ? `${app.memo.length} memo(s)`
                              : "No memos"}
                          </span>
                        </div>

                        {Array.isArray(app.memo) && app.memo.length > 0 && (
                          <TableActionButton
                            label="View"
                            variant="secondary"
                            onClick={() => openMemoModal(app.memo)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
            </div>
          </>
        )}
      </div>

      {/* Footer / Pagination */}
      <div className="px-4 md:px-6 pt-3 border-t border-neutral-100 bg-white flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="text-xs text-neutral-500 font-medium">
          {showingLabel}
        </div>

        <div className="flex items-center gap-1 bg-neutral-50 p-1 rounded-lg border border-neutral-100">
          <button
            onClick={onPrevPage}
            disabled={page <= 1 || isLoading}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-neutral-700"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-semibold px-3 text-neutral-700">
            {page} / {totalPages}
          </span>
          <button
            onClick={onNextPage}
            disabled={page >= totalPages || isLoading}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-neutral-700"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Memo Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={closeMemoModal}
        title="Memos Used in CTO Application"
        closeLabel="Close"
      >
        <MemoList
          memos={memoModal.memos}
          description={"References used for this compensation request."}
        />
      </Modal>
    </div>
  );
};

export default ApplicationCtoTable;
