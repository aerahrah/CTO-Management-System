import React, { useMemo, useState } from "react";
import Modal from "../../modal";
import { TableActionButton } from "../../customButton";
import { StatusBadge } from "../../statusUtils";
import FilterSelect from "../../filterSelect";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import CtoMemoModalContent from "../ctoCreditComponents/CtoMemoModalContent";
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Inbox,
  FileText,
} from "lucide-react";

/* =========================
   CONSTANTS
========================= */
const statusOptions = ["ACTIVE", "EXHAUSTED", "ROLLEDBACK"];
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

/* =========================
   COMPACT PAGINATION (mobile like your MyCtoCreditHistory)
========================= */
const CompactPagination = ({
  page,
  totalPages,
  total, // can be undefined
  startItem, // can be null
  endItem, // can be null
  onPrev,
  onNext,
  label = "credits",
  disabled = false,
}) => {
  const safeTotalPages = Math.max(totalPages || 1, 1);
  const hasTotal = typeof total === "number";
  const noResults = hasTotal ? total === 0 : safeTotalPages <= 1;

  return (
    <div className="px-4 md:px-6 pt-3 border-t border-neutral-100 bg-white">
      {/* Mobile/tablet */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={disabled || page === 1 || noResults}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-neutral-200 bg-white text-sm font-bold text-neutral-700 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="text-center min-w-0">
          <div className="text-xs font-mono font-semibold text-neutral-700">
            {page} / {safeTotalPages}
          </div>
          <div className="text-[11px] text-neutral-500 truncate">
            {hasTotal
              ? total === 0
                ? `0 ${label}`
                : `${startItem}-${endItem} of ${total}`
              : " "}
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={disabled || page >= safeTotalPages || noResults}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-neutral-200 bg-white text-sm font-bold text-neutral-700 disabled:opacity-30"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div className="text-xs text-neutral-500 font-medium">
          {hasTotal ? (
            <>
              Showing{" "}
              <span className="font-bold text-neutral-900">
                {total === 0 ? 0 : `${startItem}-${endItem}`}
              </span>{" "}
              of <span className="font-bold text-neutral-900">{total}</span>{" "}
              {label}
            </>
          ) : (
            <>
              Page <span className="font-bold text-neutral-900">{page}</span> of{" "}
              <span className="font-bold text-neutral-900">
                {safeTotalPages}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 bg-neutral-50 p-1 rounded-lg border border-neutral-100">
          <button
            onClick={onPrev}
            disabled={disabled || page === 1 || noResults}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-neutral-600"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono font-semibold px-3 text-neutral-700">
            {page} / {safeTotalPages}
          </span>

          <button
            onClick={onNext}
            disabled={disabled || page >= safeTotalPages || noResults}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-neutral-600"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   COMPONENT
========================= */
const CreditCtoTable = ({
  credits = [],
  search = "",
  status = "",
  onSearchChange,
  onStatusChange,
  page = 1,
  limit = 20,
  onLimitChange,
  totalPages = 1,
  total, // optional if backend provides
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

  const handleResetFilters = () => {
    onSearchChange?.("");
    onStatusChange?.("");
  };

  const isFiltered = Boolean(status) || Boolean(search);

  const startItem =
    total != null ? (credits.length ? (page - 1) * limit + 1 : 0) : null;
  const endItem =
    total != null ? (credits.length ? Math.min(page * limit, total) : 0) : null;

  // If backend doesn't give totals, fallback to "page-based"
  const showingLabel = useMemo(() => {
    if (total != null) {
      return `Showing ${startItem}-${endItem} of ${total} credits`;
    }
    return `Page ${page} of ${totalPages}`;
  }, [total, startItem, endItem, page, totalPages]);

  return (
    <div className="w-full h-full flex flex-col min-h-0 min-w-0 bg-white overflow-hidden">
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
                placeholder="Search memo no…"
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
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
        {/* Empty */}
        {!isLoading && credits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
            <div className="bg-neutral-50 p-6 rounded-full mb-4 ring-1 ring-neutral-100">
              <Inbox className="w-10 h-10 text-neutral-300" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">
              No CTO credits found
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
            {/* TABLE (md+) */}
            <div className="hidden sm:block h-full overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0 z-10 border-b border-neutral-100">
                  <tr className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 font-bold">
                    <th className="px-4 md:px-6 py-4">Memo No.</th>
                    <th className="px-4 md:px-6 py-4">Date Credited</th>
                    <th className="px-4 md:px-6 py-4 text-center">Status</th>
                    <th className="px-4 md:px-6 py-4 text-center">Duration</th>
                    <th className="px-4 md:px-6 py-4 text-right">Memo File</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-50">
                  {isLoading
                    ? [...Array(Math.min(limit, 10) || 6)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(5)].map((__, j) => (
                            <td key={j} className="px-4 md:px-6 py-4">
                              <Skeleton />
                            </td>
                          ))}
                        </tr>
                      ))
                    : credits.map((c, i) => (
                        <tr
                          key={c._id || `${c.memoNo}-${i}`}
                          className={`group hover:bg-blue-50/30 transition-colors ${
                            i % 2 === 0 ? "bg-white" : "bg-neutral-50/40"
                          }`}
                        >
                          <td className="px-4 md:px-6 py-4 font-semibold text-neutral-900">
                            {c.memoNo || "-"}
                          </td>

                          <td className="px-4 md:px-6 py-4 text-neutral-600">
                            {c.dateApproved
                              ? new Date(c.dateApproved).toLocaleDateString(
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
                            <StatusBadge status={c.employeeStatus} />
                          </td>

                          <td className="px-4 md:px-6 py-4 text-center text-neutral-700 font-semibold">
                            {formatDuration(c.duration)}
                          </td>

                          <td className="px-4 md:px-6 py-4 text-right">
                            {c.uploadedMemo ? (
                              <TableActionButton
                                label="View Memo"
                                variant="secondary"
                                onClick={() => openMemoModal(c)}
                              />
                            ) : (
                              <span className="text-neutral-400 text-sm">
                                No memo
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
                : credits.map((c, i) => (
                    <div
                      key={c._id || `${c.memoNo}-${i}`}
                      className="border border-neutral-200 rounded-xl p-3 bg-white shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-neutral-900 truncate">
                            Memo {c.memoNo || "-"}
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5">
                            {c.dateApproved
                              ? new Date(c.dateApproved).toLocaleDateString(
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
                          <StatusBadge status={c.employeeStatus} />
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-neutral-600">
                        <span className="font-semibold text-neutral-800">
                          Duration:
                        </span>{" "}
                        {formatDuration(c.duration)}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2 text-xs text-neutral-500">
                          <FileText className="w-4 h-4 text-neutral-400" />
                          <span className="truncate">
                            {c.uploadedMemo ? "Memo attached" : "No memo"}
                          </span>
                        </div>
                        {c.uploadedMemo && (
                          <TableActionButton
                            label="View"
                            variant="secondary"
                            onClick={() => openMemoModal(c)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
            </div>
          </>
        )}
      </div>

      {/* PAGINATION (mobile matches CompactPagination style) */}
      <CompactPagination
        page={page}
        totalPages={totalPages}
        total={total}
        startItem={startItem}
        endItem={endItem}
        label="credits"
        disabled={isLoading}
        onPrev={onPrevPage}
        onNext={onNextPage}
      />

      {/* Memo Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={closeMemoModal}
        title="Memo Details"
        closeLabel="Close"
      >
        <div className="max-h-[520px] overflow-y-auto">
          {memoModal.memos.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-10">
              No memo available
            </p>
          ) : (
            <div>
              {memoModal.memos.map((memo, i) => (
                <div key={memo._id || i} className="min-w-0">
                  <CtoMemoModalContent
                    memo={memo}
                    baseUrl={
                      (typeof import.meta !== "undefined" &&
                        import.meta.env?.VITE_API_BASE_URL) ||
                      (typeof process !== "undefined" &&
                        process.env?.REACT_APP_API_BASE_URL) ||
                      "http://localhost:3000"
                    }
                  />
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
