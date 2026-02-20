// components/AuditLogTable.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getAuditLogs } from "../api/audit";
import Breadcrumbs from "../components/breadCrumbs";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  FilterX,
  X,
} from "lucide-react";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const LIMIT_OPTIONS = [10, 20, 50, 100];

// Helper for Status Badge Colors
const getStatusColor = (code) => {
  if (code >= 200 && code < 300)
    return "bg-green-50 text-green-700 border-green-200";
  if (code >= 300 && code < 400)
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (code >= 400 && code < 500)
    return "bg-orange-50 text-orange-700 border-orange-200";
  if (code >= 500) return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

// Helper for Method Badge Colors
const getMethodColor = (method) => {
  switch (method) {
    case "GET":
      return "text-blue-700 bg-blue-50 border-blue-200";
    case "POST":
      return "text-green-700 bg-green-50 border-green-200";
    case "PUT":
      return "text-orange-700 bg-orange-50 border-orange-200";
    case "PATCH":
      return "text-violet-700 bg-violet-50 border-violet-200";
    case "DELETE":
      return "text-red-700 bg-red-50 border-red-200";
    default:
      return "text-gray-700 bg-gray-50 border-gray-200";
  }
};

/* =========================
   ✅ MOBILE CARD LEFT STRIP (by statusCode)
========================= */
const getLeftStripClassByStatus = (code) => {
  const c = Number(code);
  if (Number.isFinite(c)) {
    if (c >= 200 && c < 300) return "border-l-4 border-l-emerald-500";
    if (c >= 300 && c < 400) return "border-l-4 border-l-blue-500";
    if (c >= 400 && c < 500) return "border-l-4 border-l-amber-500";
    if (c >= 500) return "border-l-4 border-l-rose-500";
  }
  return "border-l-4 border-l-slate-300";
};

/* =========================
   HOOK: DEBOUNCE (with flush)
========================= */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  // ✅ allows forcing the debounced value immediately (for Refresh)
  const flush = useCallback(() => {
    setDebouncedValue(value);
  }, [value]);

  return { debouncedValue, flush };
}

/* =========================
   Pagination (compact)
========================= */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  label = "items",
  rightSlot,
}) => {
  return (
    <div className="px-4 md:px-6 py-3 border-t border-gray-100 bg-white">
      {/* Mobile */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-semibold text-gray-700 disabled:opacity-30"
          type="button"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="text-center min-w-0">
          <div className="text-xs font-mono font-semibold text-gray-700">
            {page} / {Math.max(totalPages, 1)}
          </div>
          <div className="text-[11px] text-gray-500">
            {total === 0 ? `0 ${label}` : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-semibold text-gray-700 disabled:opacity-30"
          type="button"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div className="text-xs text-gray-500 font-medium">
          Showing{" "}
          <span className="font-bold text-gray-900">
            {total === 0 ? 0 : `${startItem}-${endItem}`}
          </span>{" "}
          of <span className="font-bold text-gray-900">{total}</span> {label}
        </div>

        <div className="flex items-center gap-3">
          {rightSlot}
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
            <button
              onClick={onPrev}
              disabled={page === 1 || total === 0}
              className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all text-gray-600"
              aria-label="Previous"
              type="button"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-medium px-3 text-gray-600">
              {page} / {Math.max(totalPages, 1)}
            </span>
            <button
              onClick={onNext}
              disabled={page >= totalPages || total === 0}
              className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all text-gray-600"
              aria-label="Next"
              type="button"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FieldLabel = ({ children }) => (
  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em] mb-1">
    {children}
  </label>
);

const inputBase =
  "w-full h-10 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-gray-700";
const iconInputBase =
  "w-full h-10 pl-9 pr-9 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-gray-700";

const Chip = ({ children }) => (
  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-semibold">
    {children}
  </span>
);

const AuditLogTable = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Inputs -> debounce
  const [usernameInput, setUsernameInput] = useState("");
  const [endpointInput, setEndpointInput] = useState("");
  const [statusInput, setStatusInput] = useState("");

  const { debouncedValue: username, flush: flushUsername } = useDebounce(
    usernameInput,
    350,
  );
  const { debouncedValue: endpoint, flush: flushEndpoint } = useDebounce(
    endpointInput,
    350,
  );
  const { debouncedValue: statusCode, flush: flushStatus } = useDebounce(
    statusInput,
    350,
  );

  // Select/date filters
  const [method, setMethod] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      username: username || undefined,
      method: method === "All" ? undefined : method || undefined,
      endpoint: endpoint || undefined,
      statusCode: statusCode || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [page, limit, username, method, endpoint, statusCode, startDate, endDate],
  );

  const { data, isPending, isFetching, refetch, isPlaceholderData } = useQuery({
    queryKey: ["auditLogs", queryParams],
    queryFn: () => getAuditLogs(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  // reset page when filters change
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, username, endpoint, statusCode, method, startDate, endDate]);

  const total = data?.total || 0;
  const totalPages = Math.max(Math.ceil(total / limit) || 1, 1);

  // keep page in range
  useEffect(() => {
    setPage((p) => {
      if (p > totalPages) return totalPages;
      if (p < 1) return 1;
      return p;
    });
  }, [totalPages]);

  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(page * limit, total);

  const hasActiveFilters = Boolean(
    username ||
    endpoint ||
    statusCode ||
    (method && method !== "All") ||
    startDate ||
    endDate,
  );

  const rows = data?.data || [];

  const clearFilters = () => {
    setUsernameInput("");
    setEndpointInput("");
    setStatusInput("");
    setMethod("All");
    setStartDate("");
    setEndDate("");
    setLimit(20);
    setPage(1);
  };

  // ✅ Refresh uses latest typed values immediately (flush debounce) then refetch
  const handleRefresh = useCallback(async () => {
    flushUsername();
    flushEndpoint();
    flushStatus();
    await Promise.resolve();
    refetch({ cancelRefetch: false });
  }, [flushUsername, flushEndpoint, flushStatus, refetch]);

  return (
    <div className="w-full flex-1 flex h-full flex-col">
      {/* HEADER */}
      <div className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0 pt-2 px-1">
            <Breadcrumbs rootLabel="home" rootTo="/app" />
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              System Audit Logs
            </h2>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Track and monitor system activities and security events.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-60 w-full sm:w-auto"
              title="Refresh"
            >
              <RefreshCw
                size={16}
                className={isFetching ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* MAIN SURFACE */}
      <div className="mb-1 flex flex-col flex-1 min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* TOOLBAR */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="grid grid-cols-2 xl:grid-cols-12 gap-3">
            {/* Method */}
            <div className="sm:col-span-1 xl:col-span-2">
              <FieldLabel>Method</FieldLabel>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={`${inputBase} cursor-pointer`}
              >
                <option value="All">All</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Start date */}
            <div className="sm:col-span-1 xl:col-span-2">
              <FieldLabel>Start</FieldLabel>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputBase}
                />
              </div>
            </div>

            {/* End date */}
            <div className="sm:col-span-1 xl:col-span-2">
              <FieldLabel>End</FieldLabel>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputBase}
                />
              </div>
            </div>

            {/* Status */}
            <div className="sm:col-span-1 xl:col-span-2">
              <FieldLabel>Status</FieldLabel>
              <input
                type="number"
                placeholder="e.g. 200"
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value)}
                className={inputBase}
              />
            </div>

            {/* User */}
            <div className="sm:col-span-1 xl:col-span-2">
              <FieldLabel>User</FieldLabel>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search username…"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className={iconInputBase}
                />
                {usernameInput && (
                  <button
                    onClick={() => setUsernameInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Clear user"
                    title="Clear"
                    type="button"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Endpoint */}
            <div className="sm:col-span-2 xl:col-span-2">
              <FieldLabel>Endpoint</FieldLabel>
              <div className="relative">
                <Filter
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="/api/v1/…"
                  value={endpointInput}
                  onChange={(e) => setEndpointInput(e.target.value)}
                  className={`${iconInputBase} font-mono`}
                />
                {endpointInput && (
                  <button
                    onClick={() => setEndpointInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Clear endpoint"
                    title="Clear"
                    type="button"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active filters + actions */}
          <div className="mt-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em]">
                Active
              </span>

              {!hasActiveFilters ? (
                <span className="text-xs text-gray-500">
                  No filters applied
                </span>
              ) : (
                <>
                  {username && <Chip>user: “{username}”</Chip>}
                  {endpoint && <Chip>endpoint: {endpoint}</Chip>}
                  {statusCode && <Chip>status: {statusCode}</Chip>}
                  {method !== "All" && <Chip>method: {method}</Chip>}
                  {startDate && <Chip>start: {startDate}</Chip>}
                  {endDate && <Chip>end: {endDate}</Chip>}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters && limit === 20}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                title="Clear filters"
              >
                <X size={14} className="text-gray-500" />
                Clear
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-700"
                  title="Reset all"
                  type="button"
                >
                  <FilterX size={14} />
                  Reset all
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TABLE (Desktop/Tablet) */}
        <div className="hidden sm:block flex-1 overflow-y-auto bg-white min-h-[320px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white sticky top-0 z-10 border-b border-gray-100">
                <tr className="text-[10px] uppercase tracking-[0.14em] text-gray-400 font-bold">
                  <th className="px-4 md:px-6 py-4 w-44">Timestamp</th>
                  <th className="px-4 md:px-6 py-4 w-56">User</th>
                  <th className="px-4 md:px-6 py-4">Request Details</th>
                  <th className="px-4 md:px-6 py-4 hidden md:table-cell">
                    Summary
                  </th>
                  <th className="px-4 md:px-6 py-4 w-36 hidden lg:table-cell">
                    IP Address
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {(isPending && !data) || (isFetching && !data) ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 md:px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-28 mb-1" />
                        <div className="h-3 bg-gray-100 rounded w-20" />
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-36" />
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-5 bg-gray-200 rounded w-14" />
                          <div className="h-4 bg-gray-200 rounded w-64" />
                        </div>
                        <div className="h-3 bg-gray-100 rounded w-28" />
                      </td>
                      <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                        <div className="h-4 bg-gray-200 rounded w-44" />
                      </td>
                      <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                        <div className="h-4 bg-gray-200 rounded w-24" />
                      </td>
                    </tr>
                  ))
                ) : rows.length > 0 ? (
                  rows.map((log, idx) => (
                    <tr
                      key={log._id}
                      className={`group transition-colors hover:bg-blue-50/40 ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-col">
                          <span className="text-gray-900 font-semibold">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        <span className="block max-w-[220px]">
                          {log.username}
                        </span>
                      </td>

                      <td className="px-4 md:px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${getMethodColor(
                                log.method,
                              )}`}
                            >
                              {log.method}
                            </span>

                            <span
                              className="font-mono text-sm text-gray-800 font-medium max-w-[520px]"
                              title={log.endpoint}
                            >
                              {log.endpoint}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pl-0.5 min-w-0 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${getStatusColor(
                                log.statusCode,
                              )}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                              {log.statusCode}
                            </span>

                            {log.url && log.url !== log.endpoint && (
                              <span
                                className="text-xs text-gray-400 font-mono max-w-[520px]"
                                title={log.url}
                              >
                                {log.url}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 md:px-6 py-4 text-xs text-gray-600 hidden md:table-cell">
                        <div
                          className="max-w-[520px]"
                          title={log?.summary || ""}
                        >
                          {log?.summary || (
                            <span className="text-gray-300 italic">
                              No summary
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono hidden lg:table-cell">
                        {log.ip}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-16 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="bg-gray-50 p-6 rounded-full mb-4 ring-1 ring-gray-100">
                          <Search size={24} className="text-gray-300" />
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                          No logs found
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Try adjusting your filters or search terms.
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={clearFilters}
                            className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-700 underline"
                            type="button"
                          >
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ✅ MOBILE LIST (Improved card width + left strip) */}
        <div className="sm:hidden flex-1 overflow-y-auto bg-white">
          {/* make sure cards have enough usable width and don't feel cramped */}
          <div className="p-3 space-y-2 w-full">
            {(isPending && !data) || (isFetching && !data) ? (
              [...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="w-full min-w-0 border border-gray-200 rounded-xl p-3 animate-pulse"
                >
                  <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-24 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-32" />
                </div>
              ))
            ) : rows.length > 0 ? (
              rows.map((log) => {
                const leftStrip = getLeftStripClassByStatus(log.statusCode);

                return (
                  <div
                    key={log._id}
                    className={`w-full min-w-0 border border-gray-200 rounded-xl p-3 bg-white shadow-sm overflow-hidden ${leftStrip}`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {log.username || "Unknown user"}
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleDateString()} •{" "}
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>

                      <span
                        className={`flex-none inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${getStatusColor(
                          log.statusCode,
                        )}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                        {log.statusCode}
                      </span>
                    </div>

                    {/* Method + endpoint */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap min-w-0">
                      <span
                        className={`flex-none px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${getMethodColor(
                          log.method,
                        )}`}
                      >
                        {log.method}
                      </span>

                      {/* ✅ ensures long endpoints don't shrink the card; wraps safely */}
                      <span
                        className="min-w-0 flex-1 font-mono text-xs text-gray-700 break-words"
                        title={log.endpoint}
                      >
                        {log.endpoint}
                      </span>
                    </div>

                    {/* Summary */}
                    {log?.summary ? (
                      <div className="mt-2 text-xs text-gray-600 break-words">
                        {log.summary}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-gray-300 italic">
                        No summary
                      </div>
                    )}

                    {/* Bottom row */}
                    <div className="mt-2 text-[11px] text-gray-500 flex items-start justify-between gap-2 min-w-0">
                      <span
                        className="min-w-0 flex-1 font-mono break-words"
                        title={
                          log.url && log.url !== log.endpoint ? log.url : ""
                        }
                      >
                        {log.url && log.url !== log.endpoint ? log.url : ""}
                      </span>
                      <span className="flex-none font-mono">{log.ip}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-14 text-center text-gray-500">
                <div className="flex flex-col items-center justify-center">
                  <div className="bg-gray-50 p-6 rounded-full mb-4 ring-1 ring-gray-100">
                    <Search size={24} className="text-gray-300" />
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    No logs found
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Try adjusting your filters or search terms.
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-700 underline"
                      type="button"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PAGINATION */}
        <CompactPagination
          page={page}
          totalPages={totalPages}
          total={total}
          startItem={startItem}
          endItem={endItem}
          label="logs"
          onPrev={() => setPage((p) => Math.max(p - 1, 1))}
          onNext={() => {
            if (!isPlaceholderData && page < totalPages) setPage((p) => p + 1);
          }}
          rightSlot={
            <div className="hidden md:flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Show
              </span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value, 10));
                  setPage(1);
                }}
                className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 font-medium outline-none cursor-pointer"
              >
                {LIMIT_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default AuditLogTable;
