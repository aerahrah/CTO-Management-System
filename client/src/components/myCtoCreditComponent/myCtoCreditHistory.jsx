import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyCreditRequests } from "../../api/cto";
import { StatusBadge } from "../statusUtils";
import Modal from "../modal";
import CtoMemoModalContent from "../ctoComponents/ctoCreditComponents/CtoMemoModalContent";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Clipboard,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  Inbox,
  FileText,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Archive,
  Layers,
  Clock as ClockIcon,
  Eye,
} from "lucide-react";
import FilterSelect from "../filterSelect";

const pageSizeOptions = [20, 50, 100];

/* ------------------ Small Breadcrumbs-like header ------------------ */
const Breadcrumbs = () => (
  <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold tracking-[0.12em] text-gray-400 uppercase mb-2 font-sans">
    <span className="hover:text-blue-600 cursor-pointer transition-colors">
      Dashboard
    </span>
    <span className="text-gray-300">/</span>
    <span className="hover:text-blue-600 cursor-pointer transition-colors">
      HR
    </span>
    <span className="text-gray-300">/</span>
    <span className="text-blue-600">My CTO Credits</span>
  </div>
);

/* ------------------ Small hook: debounce ------------------ */
const useDebouncedValue = (value, delay = 500) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

/**
 * StatCard
 * - responsive: full width on mobile, min width on md
 * - uses h-full so all cards align to same height in the grid
 */
const StatCard = ({ title, value, icon: Icon, hint, colorClass = "" }) => (
  <div
    className={`w-full flex-shrink-0 bg-white border border-gray-100 rounded-lg shadow-sm p-3 flex items-start gap-3 h-full ${colorClass}`}
    role="status"
  >
    <div className="p-2 rounded-md bg-gray-50 flex items-center justify-center flex-none">
      <Icon className="w-5 h-5 text-gray-600" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wide truncate">
        {title}
      </div>
      <div className="mt-0.5 text-lg font-bold text-gray-900 truncate">
        {value}
      </div>
      {hint && <div className="text-[11px] text-gray-500 truncate">{hint}</div>}
    </div>
  </div>
);

/* ------------------ Mobile/Tablet Card Row ------------------ */
const CreditCard = ({ credit, onViewMemo, formatDuration }) => {
  const dateLabel = credit?.dateApproved
    ? new Date(credit.dateApproved).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
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
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border border-gray-200 bg-white hover:bg-gray-50 text-blue-600"
        >
          <Eye className="w-4 h-4" />
          View Memo
        </button>
      </div>
    </div>
  );
};

/* ------------------ Compact Pagination (better on mobile/tablet) ------------------ */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
}) => {
  return (
    <div className="px-4 md:px-6 py-3 border-t border-gray-100 bg-white">
      {/* Mobile/tablet: compact */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="text-center min-w-0">
          <div className="text-xs font-mono font-semibold text-gray-700">
            {page} / {totalPages}
          </div>
          <div className="text-[11px] text-gray-500 truncate">
            {total === 0 ? "0 results" : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-30"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop: keep original layout style */}
      <div className="hidden md:flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-xs text-gray-500 font-medium">
          Showing{" "}
          <span className="font-bold text-gray-900">
            {total === 0 ? 0 : `${startItem}-${endItem}`}
          </span>{" "}
          of <span className="font-bold text-gray-900">{total}</span> credits
        </div>

        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
          <button
            onClick={onPrev}
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-gray-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-medium px-3 text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={onNext}
            disabled={page >= totalPages || total === 0}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-gray-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MyCtoCreditHistory = () => {
  // filters / pagination / modal state
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 500);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });

  // reset to page 1 when filters change
  useEffect(() => setPage(1), [debouncedSearch, statusFilter, limit]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["myCredits", page, limit, statusFilter, debouncedSearch],
    queryFn: () =>
      fetchMyCreditRequests({
        page,
        limit,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
      }),
    keepPreviousData: true,
  });

  // derived data
  const credits = useMemo(() => data?.credits || [], [data]);
  const total = data?.total || 0;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(page * limit, total);

  // Ensure current page is always within valid range when totalPages changes
  useEffect(() => {
    setPage((current) => {
      if (current > totalPages) return totalPages;
      if (current < 1) return 1;
      return current;
    });
  }, [totalPages]);

  const formatDuration = useCallback(
    (d) => (d ? `${d.hours || 0}h ${d.minutes || 0}m` : "-"),
    [],
  );

  const handleResetFilters = useCallback(() => {
    setSearchInput("");
    setStatusFilter("");
    setPage(1);
  }, []);

  const isFiltered = statusFilter !== "" || debouncedSearch !== "";

  const getStatusTabs = (statusCounts = {}) => [
    {
      id: "",
      label: "All Credits",
      icon: Layers,
      count:
        (statusCounts.ACTIVE || 0) +
        (statusCounts.EXHAUSTED || 0) +
        (statusCounts.ROLLEDBACK || 0),
      activeColor: "bg-blue-100 text-blue-700 border-blue-200",
    },
    {
      id: "ACTIVE",
      label: "Active",
      icon: CheckCircle2,
      count: statusCounts.ACTIVE || 0,
      activeColor: "bg-green-100 text-green-700 border-green-200",
    },
    {
      id: "EXHAUSTED",
      label: "Exhausted",
      icon: AlertCircle,
      count: statusCounts.EXHAUSTED || 0,
      activeColor: "bg-red-100 text-red-700 border-red-200",
    },
    {
      id: "ROLLEDBACK",
      label: "Rolled Back",
      icon: RotateCcw,
      count: statusCounts.ROLLEDBACK || 0,
      activeColor: "bg-amber-100 text-amber-700 border-amber-200",
    },
  ];

  const statusCounts = data?.statusCounts || {
    ACTIVE: 0,
    EXHAUSTED: 0,
    ROLLEDBACK: 0,
  };

  // totals from backend (NOT affected by search/filters)
  const totals = data?.totals || {
    totalUsedHours: 0,
    totalReservedHours: 0,
    totalRemainingHours: 0,
    totalCreditedHours: 0,
  };

  const totalMemosOverall = useMemo(() => {
    return (
      (statusCounts.ACTIVE || 0) +
      (statusCounts.EXHAUSTED || 0) +
      (statusCounts.ROLLEDBACK || 0)
    );
  }, [statusCounts]);

  const fmtHours = useCallback((h) => {
    const n = Number(h || 0);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }, []);

  // summary now uses backend totals (independent of filters/search)
  const summary = useMemo(() => {
    return {
      remainingHours: Number(totals.totalRemainingHours || 0),
      usedHours: Number(totals.totalUsedHours || 0),
      reservedHours: Number(totals.totalReservedHours || 0),
      totalCredited: Number(totals.totalCreditedHours || 0),
    };
  }, [totals]);

  const openMemo = useCallback((credit) => {
    setMemoModal({ isOpen: true, memo: credit });
  }, []);

  return (
    <div className="w-full flex-1 flex h-full flex-col md:p-0 bg-gray-50/50">
      {/* HEADER */}
      <div className="pt-2 pb-6 px-1">
        {/* <Breadcrumbs /> */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight font-sans">
                My CTO Credit History
              </h1>
              <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                View your credited and rolled back CTO hours
              </p>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="w-full md:w-auto flex flex-col gap-3 md:ml-4">
            <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
              <StatCard
                title="Balance"
                value={`${fmtHours(summary.remainingHours)}h`}
                icon={Layers}
                hint="Remaining hours"
              />
              <StatCard
                title="Used Hours"
                value={`${fmtHours(summary.usedHours)}h`}
                icon={ClockIcon}
                hint="Total used"
              />
              <StatCard
                title="Reserved"
                value={`${fmtHours(summary.reservedHours)}h`}
                icon={Archive}
                hint="Reserved in apps"
              />
              <StatCard
                title="Total Credited"
                value={`${fmtHours(summary.totalCredited)}h`}
                icon={CheckCircle2}
                hint={`${totalMemosOverall} memos`}
              />
            </div>

            <div className="flex md:hidden flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-gray-100 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">
                    Balance
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {fmtHours(summary.remainingHours)}h
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">
                    Used
                  </div>
                  <div className="text-sm font-bold text-amber-600">
                    {fmtHours(summary.usedHours)}h
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">
                    Reserved
                  </div>
                  <div className="text-sm font-bold text-gray-700">
                    {fmtHours(summary.reservedHours)}h
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">
                    Credited
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {fmtHours(summary.totalCredited)}h
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CARD */}
      <div className="flex flex-col flex-1 min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* TOOLBAR */}
        <div className="p-4 border-b border-gray-100 bg-white space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              {getStatusTabs(statusCounts).map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setStatusFilter(tab.id);
                      setPage(1);
                    }}
                    className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all whitespace-nowrap flex items-center gap-2
                      ${
                        isActive
                          ? tab.activeColor
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span
                      className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                        ${
                          isActive
                            ? "bg-white/80 text-gray-900"
                            : "bg-gray-100 text-gray-600"
                        }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search memo..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>

              <div className="hidden md:flex items-center gap-2 pl-3 border-l border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Show
                </span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 font-medium outline-none cursor-pointer"
                >
                  {pageSizeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:hidden flex items-center gap-1.5 px-2 border-l border-gray-200 ml-1">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Rows
                </span>
                <FilterSelect
                  label=""
                  value={limit}
                  onChange={(v) => {
                    setLimit(v);
                    setPage(1);
                  }}
                  options={pageSizeOptions}
                  className="!mb-0 w-20 text-xs"
                />
              </div>
            </div>
          </div>

          {isFiltered && (
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  Active:
                </span>
                {debouncedSearch && (
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-medium">
                    "{debouncedSearch}"
                  </span>
                )}
                {statusFilter && (
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-medium">
                    {statusFilter}
                  </span>
                )}
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

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto bg-white min-h-[300px]">
          {isError ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
              <div className="bg-red-50 p-6 rounded-full mb-4 ring-1 ring-red-100">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Couldn’t load your credit history
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                {error?.message || "Please try again."}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-6 inline-flex items-center gap-2 rounded-md px-4 py-2 bg-white border border-gray-200 text-sm font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
            </div>
          ) : !isLoading && credits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
              <div className="bg-gray-50 p-6 rounded-full mb-4 ring-1 ring-gray-100">
                <Inbox className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                No Credit History Found
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
              {/* Mobile + Tablet (cards) */}
              <div className="block md:hidden p-4">
                <div className="space-y-3">
                  {isLoading
                    ? [...Array(Math.min(limit, 6))].map((_, i) => (
                        <div
                          key={i}
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
                    : credits.map((credit, i) => (
                        <CreditCard
                          key={credit._id || `${credit.memoNo}-${i}`}
                          credit={credit}
                          formatDuration={formatDuration}
                          onViewMemo={() => openMemo(credit)}
                        />
                      ))}
                </div>
              </div>

              {/* Tablet (md) use cards too, Desktop (lg+) use table */}
              <div className="hidden md:block lg:hidden p-4">
                <div className="grid grid-cols-2 gap-3">
                  {isLoading
                    ? [...Array(Math.min(limit, 6))].map((_, i) => (
                        <div
                          key={i}
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
                    : credits.map((credit, i) => (
                        <CreditCard
                          key={credit._id || `${credit.memoNo}-${i}`}
                          credit={credit}
                          formatDuration={formatDuration}
                          onViewMemo={() => openMemo(credit)}
                        />
                      ))}
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-white sticky top-0 z-10 border-b border-gray-100">
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-400 font-bold">
                      <th className="px-6 py-4 font-bold">Memo No.</th>
                      <th className="px-6 py-4 font-bold">Date Credited</th>
                      <th className="px-6 py-4 text-center">Duration</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Memo</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-50">
                    {isLoading
                      ? [...Array(limit)].map((_, i) => (
                          <tr key={i}>
                            {[...Array(5)].map((__, j) => (
                              <td key={j} className="px-6 py-4">
                                <Skeleton />
                              </td>
                            ))}
                          </tr>
                        ))
                      : credits.map((credit, i) => (
                          <tr
                            key={credit._id || `${credit.memoNo}-${i}`}
                            className={`group hover:bg-gray-50/80 transition-colors ${
                              i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                            }`}
                          >
                            <td className="px-6 py-4 font-medium text-gray-900">
                              {credit.memoNo}
                            </td>
                            <td className="px-6 py-4 text-gray-600">
                              {credit.dateApproved
                                ? new Date(
                                    credit.dateApproved,
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })
                                : "-"}
                            </td>
                            <td className="px-6 py-4 text-center text-gray-600">
                              {formatDuration(credit.duration)}
                            </td>

                            <td className="px-6 py-4 text-center">
                              <StatusBadge status={credit.employeeStatus} />
                            </td>

                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => openMemo(credit)}
                                className="group inline-flex items-center gap-2 rounded-md px-3 py-1.5 bg-white border border-gray-200 text-sm font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition"
                              >
                                <FileText className="w-4 h-4" />
                                View Memo
                              </button>
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
          onPrev={() => setPage((p) => Math.max(p - 1, 1))}
          onNext={() => setPage((p) => Math.min(p + 1, totalPages))}
        />
      </div>

      {/* MEMO MODAL (design MUST NOT be changed — content preserved) */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memo: null })}
        title="CTO Memo"
        closeLabel="Close"
      >
        <CtoMemoModalContent
          memo={memoModal.memo}
          baseUrl={
            (typeof import.meta !== "undefined" &&
              import.meta.env?.VITE_API_BASE_URL) ||
            (typeof process !== "undefined" &&
              process.env?.REACT_APP_API_BASE_URL) ||
            "http://localhost:3000"
          }
        />
      </Modal>
    </div>
  );
};

export default MyCtoCreditHistory;
