// components/AuditLogTable.jsx
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "../api/audit";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  XCircle,
} from "lucide-react";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const LIMIT_OPTIONS = [10, 20, 50, 100];

// Helper for Status Badge Colors
const getStatusColor = (code) => {
  if (code >= 200 && code < 300)
    return "bg-green-100 text-green-700 border-green-200";
  if (code >= 300 && code < 400)
    return "bg-blue-100 text-blue-700 border-blue-200";
  if (code >= 400 && code < 500)
    return "bg-orange-100 text-orange-700 border-orange-200";
  if (code >= 500) return "bg-red-100 text-red-700 border-red-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
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
    case "DELETE":
      return "text-red-700 bg-red-50 border-red-200";
    default:
      return "text-gray-700 bg-gray-50 border-gray-200";
  }
};

const AuditLogTable = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Filters
  const [username, setUsername] = useState("");
  const [method, setMethod] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [statusCode, setStatusCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: [
      "auditLogs",
      {
        page,
        limit,
        username,
        method,
        endpoint,
        statusCode,
        startDate,
        endDate,
      },
    ],
    queryFn: () =>
      getAuditLogs({
        page,
        limit,
        username: username || undefined,
        method: method || undefined,
        endpoint: endpoint || undefined,
        statusCode: statusCode || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
  });

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    refetch();
  };

  const clearFilters = () => {
    setUsername("");
    setMethod("");
    setEndpoint("");
    setStatusCode("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    setTimeout(() => refetch(), 0);
  };

  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <div className="p-6 bg-white/70 rounded-xl min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              System Audit Logs
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Track and monitor system activities and security events.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className={`p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors ${
                isFetching ? "animate-spin" : ""
              }`}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">
              Filter Query
            </span>
          </div>

          <form
            onSubmit={handleFilterSubmit}
            className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search username..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            {/* Method */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white"
              >
                <option value="">All Methods</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Endpoint */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Endpoint
              </label>
              <input
                type="text"
                placeholder="/api/v1/..."
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono text-gray-600"
              />
            </div>

            {/* Status Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </label>
              <input
                type="number"
                placeholder="e.g. 200"
                value={statusCode}
                onChange={(e) => setStatusCode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            {/* Date Range */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start Date
                </label>
                <div className="relative">
                  <Calendar
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-gray-600"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  End Date
                </label>
                <div className="relative">
                  <Calendar
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-gray-600"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="lg:col-span-2 flex items-end gap-2 justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-200 flex items-center gap-2"
              >
                <XCircle size={16} />
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/50 sticky top-0 z-10 border-b border-gray-200">
                <tr className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  <th className="px-6 py-4 w-40">Timestamp</th>
                  <th className="px-6 py-4 w-48">User</th>
                  {/* Merged Column Header */}
                  <th className="px-6 py-4">Request Details</th>
                  <th className="px-6 py-4">Summary</th>
                  <th className="px-6 py-4 w-32">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(isPending || isFetching) && !data ? (
                  // Skeleton Loader
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                        <div className="h-3 bg-gray-100 rounded w-16"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-32"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-5 bg-gray-200 rounded w-12"></div>
                          <div className="h-4 bg-gray-200 rounded w-48"></div>
                        </div>
                        <div className="h-3 bg-gray-100 rounded w-24"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-32"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                      </td>
                    </tr>
                  ))
                ) : data?.data?.length > 0 ? (
                  data.data.map((log) => (
                    <tr
                      key={log._id}
                      className="hover:bg-blue-50/30 transition-colors group"
                    >
                      {/* Timestamp */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-col">
                          <span className="text-gray-900 font-medium">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>

                      {/* User */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-bold uppercase">
                            {log.username.charAt(0)}
                          </div>
                          {log.username}
                        </div>
                      </td>

                      {/* Merged Request Details Column */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 ">
                          {/* Top Row: Method & Endpoint */}
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider shadow-sm ${getMethodColor(
                                log.method,
                              )}`}
                            >
                              {log.method}
                            </span>
                            <span
                              className="font-mono text-sm text-gray-700 font-medium"
                              title={log.endpoint}
                            >
                              {log.endpoint}
                            </span>
                          </div>

                          {/* Bottom Row: Status & URL (if different) */}
                          <div className="flex items-center gap-3 pl-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${getStatusColor(
                                log.statusCode,
                              )}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></span>
                              {log.statusCode}
                            </span>

                            {log.url && log.url !== log.endpoint && (
                              <span
                                className="text-xs text-gray-400 font-mono "
                                title={log.url}
                              >
                                {log.url}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Summary */}
                      <td className="px-6 py-4 text-xs min-w-xs text-gray-600">
                        <div className="" title={log?.summary || ""}>
                          {log?.summary || (
                            <span className="text-gray-300 italic">
                              No summary
                            </span>
                          )}
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {log.ip}
                      </td>
                    </tr>
                  ))
                ) : (
                  // Empty State
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-16 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="bg-gray-100 p-4 rounded-full mb-3">
                          <Search size={24} className="text-gray-400" />
                        </div>
                        <p className="text-lg font-medium text-gray-900">
                          No logs found
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Try adjusting your filters or search terms.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value));
                  setPage(1);
                }}
                className="text-sm border-gray-300 rounded-md focus:ring-blue-600 focus:border-blue-600 py-1 pl-2 pr-6 bg-white"
              >
                {LIMIT_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Page <span className="font-medium text-gray-900">{page}</span>{" "}
                of{" "}
                <span className="font-medium text-gray-900">
                  {totalPages || 1}
                </span>
              </span>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogTable;
