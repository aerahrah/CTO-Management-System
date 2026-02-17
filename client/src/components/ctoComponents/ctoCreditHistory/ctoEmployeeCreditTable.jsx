// ctoEmployeeCreditTable.jsx
import React, { useMemo, useState, useCallback } from "react";
import Modal from "../../modal";
import { StatusBadge } from "../../statusUtils";
import FilterSelect from "../../filterSelect";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import CtoMemoModalContent from "../ctoCreditComponents/CtoMemoModalContent";
import { API_BASE_URL } from "../../../config/env";
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Inbox,
  FileText,
  AlertCircle,
  CheckCircle2,
  Layers,
  Calendar,
  Clock as ClockIcon,
  Eye,
} from "lucide-react";

/* =========================
   CONSTANTS
========================= */
const pageSizeOptions = [20, 50, 100];
const BASE_URL = API_BASE_URL;

/* =========================
   SMALL UI
========================= */
const Chip = ({ children }) => (
  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-semibold">
    {children}
  </span>
);

/* =========================
   COMPACT PAGINATION (mobile like MyCtoCreditHistory)
========================= */
const CompactPagination = ({
  page,
  totalPages,
  total, // optional
  startItem, // optional
  endItem, // optional
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
          type="button"
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
          type="button"
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
            type="button"
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
            type="button"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   CARD (Mobile/Tablet) — copied design from MyCtoCreditHistory
========================= */
const CreditCard = ({
  credit,
  onViewMemo,
  formatDuration,
  leftStripClassName,
}) => {
  const dateLabel = credit?.dateApproved
    ? new Date(credit.dateApproved).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

  const hasMemo = Boolean(credit?.uploadedMemo);

  return (
    <div
      className={`bg-white rounded-xl shadow-sm overflow-hidden border-y border-r border-gray-200 ${leftStripClassName}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900 truncate">
                {credit?.memoNo || "-"}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="truncate">{dateLabel}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 flex-none">
            <StatusBadge status={credit?.employeeStatus} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              <ClockIcon className="w-3.5 h-3.5" /> Duration
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {formatDuration(credit?.duration)}
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              <Layers className="w-3.5 h-3.5" /> Remaining
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {typeof credit?.remainingHours === "number"
                ? `${credit.remainingHours}h`
                : `${credit?.remainingHours || 0}h`}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 bg-white p-3">
        <button
          onClick={onViewMemo}
          disabled={!hasMemo}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border border-gray-200 bg-white hover:bg-gray-50 text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
          type="button"
        >
          <Eye className="w-4 h-4" />
          View Memo
        </button>
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
  statusCounts, // ✅ pass from API if available
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

  const normalizedCounts = statusCounts || {
    ACTIVE: 0,
    EXHAUSTED: 0,
    ROLLEDBACK: 0,
  };

  const getStatusTabs = useCallback((counts = {}) => {
    const allCount =
      (counts.ACTIVE || 0) + (counts.EXHAUSTED || 0) + (counts.ROLLEDBACK || 0);

    return [
      {
        id: "",
        label: "All Credits",
        icon: Layers,
        count: allCount,
        activeColor: "bg-blue-100 text-blue-700 border-blue-200",
      },
      {
        id: "ACTIVE",
        label: "Active",
        icon: CheckCircle2,
        count: counts.ACTIVE || 0,
        activeColor: "bg-green-100 text-green-700 border-green-200",
      },
      {
        id: "EXHAUSTED",
        label: "Exhausted",
        icon: AlertCircle,
        count: counts.EXHAUSTED || 0,
        activeColor: "bg-red-100 text-red-700 border-red-200",
      },
      {
        id: "ROLLEDBACK",
        label: "Rolled Back",
        icon: RotateCcw,
        count: counts.ROLLEDBACK || 0,
        activeColor: "bg-amber-100 text-amber-700 border-amber-200",
      },
    ];
  }, []);

  const tabs = useMemo(
    () => getStatusTabs(normalizedCounts),
    [getStatusTabs, normalizedCounts],
  );

  // ✅ left strip class like MyCtoCreditHistory
  const getLeftStripClass = useCallback((employeeStatus) => {
    switch (String(employeeStatus || "").toUpperCase()) {
      case "ACTIVE":
        return "border-l-4 border-l-emerald-500";
      case "EXHAUSTED":
        return "border-l-4 border-l-rose-500";
      case "ROLLEDBACK":
        return "border-l-4 border-l-amber-500";
      default:
        return "border-l-4 border-l-slate-300";
    }
  }, []);

  return (
    <div className="w-full h-full flex flex-col min-h-0 min-w-0 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-neutral-100 bg-white space-y-3 py-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* ✅ Status tabs (colored like MyCtoCreditHistory) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const isActive = status === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => onStatusChange?.(tab.id)}
                  className={`px-2 py-1.5 text-xs font-bold rounded-full border transition-all whitespace-nowrap flex items-center gap-2
                    ${
                      isActive
                        ? tab.activeColor
                        : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                    }`}
                  type="button"
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1 py-0.5 rounded-full text-[10px] font-bold
                      ${
                        isActive
                          ? "bg-white/80 text-neutral-900"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search + rows */}
          <div className="flex items-center gap-3 w-full lg:w-auto min-w-0">
            <div className="relative flex-1 lg:w-56 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search memo..."
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-full py-2 pl-9 pr-9 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none
                           focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              {search && (
                <button
                  onClick={() => onSearchChange?.("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
                  aria-label="Clear search"
                  title="Clear"
                  type="button"
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
          <div className="flex px-1.5 items-center justify-between gap-3">
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
              type="button"
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
                type="button"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ✅ Mobile: cards (1 per row) */}
            <div className="block md:hidden p-4">
              <div className="space-y-3">
                {isLoading
                  ? [...Array(Math.min(limit, 6))].map((_, i) => (
                      <div
                        key={`sk-m-${i}`}
                        className="bg-white border border-gray-200 rounded-xl shadow-sm p-4"
                      >
                        <Skeleton height={18} />
                        <div className="mt-3">
                          <Skeleton height={12} count={2} />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Skeleton height={52} />
                          <Skeleton height={52} />
                        </div>
                        <div className="mt-4">
                          <Skeleton height={40} />
                        </div>
                      </div>
                    ))
                  : credits.map((c, i) => (
                      <CreditCard
                        key={c._id || `${c.memoNo}-${i}`}
                        credit={c}
                        formatDuration={formatDuration}
                        leftStripClassName={getLeftStripClass(
                          c?.employeeStatus,
                        )}
                        onViewMemo={() => openMemoModal(c)}
                      />
                    ))}
              </div>
            </div>

            {/* ✅ Tablet: 2 cards per row (md) */}
            <div className="hidden md:block lg:hidden p-4">
              <div className="grid grid-cols-2 gap-3">
                {isLoading
                  ? [...Array(Math.min(limit, 6))].map((_, i) => (
                      <div
                        key={`sk-t-${i}`}
                        className="bg-white border border-gray-200 rounded-xl shadow-sm p-4"
                      >
                        <Skeleton height={18} />
                        <div className="mt-3">
                          <Skeleton height={12} count={2} />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Skeleton height={52} />
                          <Skeleton height={52} />
                        </div>
                        <div className="mt-4">
                          <Skeleton height={40} />
                        </div>
                      </div>
                    ))
                  : credits.map((c, i) => (
                      <CreditCard
                        key={c._id || `${c.memoNo}-${i}`}
                        credit={c}
                        formatDuration={formatDuration}
                        leftStripClassName={getLeftStripClass(
                          c?.employeeStatus,
                        )}
                        onViewMemo={() => openMemoModal(c)}
                      />
                    ))}
              </div>
            </div>

            {/* ✅ Desktop: table ONLY at lg+ (rows/columns unchanged) */}
            <div className="hidden lg:block h-full overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0 z-10 border-b border-gray-100">
                  <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-400 font-bold">
                    <th className="px-4 md:px-6 py-4">Memo No.</th>
                    <th className="px-4 md:px-6 py-4">Date Credited</th>
                    <th className="px-4 md:px-6 py-4 text-center">Status</th>
                    <th className="px-4 md:px-6 py-4 text-center">Duration</th>
                    <th className="px-4 md:px-6 py-4 text-right">Memo File</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
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
                          className={`group hover:bg-gray-50/80 transition-colors ${
                            i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="px-4 md:px-6 py-4 font-semibold text-gray-900">
                            {c.memoNo || "-"}
                          </td>

                          <td className="px-4 md:px-6 py-4 text-gray-600">
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

                          <td className="px-4 md:px-6 py-4 text-center text-gray-700 font-semibold">
                            {formatDuration(c.duration)}
                          </td>

                          <td className="px-4 md:px-6 py-4 text-right">
                            {c.uploadedMemo ? (
                              <button
                                className="group inline-flex items-center gap-2 rounded-md px-3 py-1.5 bg-white border border-gray-200 text-sm font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition cursor-pointer"
                                onClick={() => openMemoModal(c)}
                                type="button"
                              >
                                <FileText className="w-4 h-4" />
                                View Memo
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">
                                No memo
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* PAGINATION */}
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
                  <CtoMemoModalContent memo={memo} baseUrl={BASE_URL} />
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
