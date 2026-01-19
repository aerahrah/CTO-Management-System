import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUpDown,
} from "lucide-react";
import { StatusBadge } from "../../statusUtils";
import { useAuth } from "../../../store/authStore";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { fetchMyCtoApplicationsApprovals } from "../../../api/cto";

/* ================================
   HOOK: USE DEBOUNCE
================================ */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/* ================================
   CTO APPLICATIONS LIST
================================ */
const CtoApplicationsList = ({ selectedId, onSelect }) => {
  const { admin } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Fetch applications
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["ctoApplications", debouncedSearch, sortOrder, page, limit],
    queryFn: () =>
      fetchMyCtoApplicationsApprovals({
        search: debouncedSearch,
        page,
        limit,
        sortOrder,
      }),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2, // 2 mins cache
  });

  // Auto-select first application
  useEffect(() => {
    if (data?.data?.length > 0 && !selectedId) {
      onSelect(data.data[0]);
    }
  }, [data, selectedId, onSelect]);

  // Reset page on search
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleSortToggle = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  if (isError)
    return (
      <div className="flex items-center justify-center h-full p-4 text-neutral-500 text-sm">
        Failed to load applications
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      {/* --- HEADER --- */}
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-neutral-800">CTO Requests</h1>
          <p className="text-xs text-neutral-500">
            Review and approve time off
          </p>
        </div>
        {/* Optional: Add a refresh button or summary stat here if needed */}
      </div>

      {/* --- CONTROLS --- */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-neutral-100 bg-white">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="text"
              placeholder="Search applicant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 py-2 w-full border border-neutral-200 rounded-lg 
                         bg-white text-sm text-neutral-700 placeholder:text-neutral-400
                         focus:ring-2 focus:ring-blue-100 focus:border-blue-500 
                         outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-neutral-100 text-neutral-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort Button */}
          <button
            onClick={handleSortToggle}
            className="flex items-center justify-center h-10 w-10 border border-neutral-200 rounded-lg 
                       bg-white text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 transition-all"
            title="Sort A-Z / Z-A"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* --- SCROLLABLE LIST --- */}
      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-neutral-200">
        <ul className="flex flex-col gap-1">
          {isLoading ? (
            // Skeleton Loading State
            Array.from({ length: limit }).map((_, i) => (
              <li
                key={i}
                className="flex items-start gap-3 px-3 py-3 rounded-lg bg-white border border-transparent"
              >
                <Skeleton circle height={40} width={40} />
                <div className="flex flex-col flex-1 gap-1">
                  <div className="flex justify-between">
                    <Skeleton width="40%" height={14} />
                    <Skeleton width="20%" height={14} />
                  </div>
                  <Skeleton width="30%" height={12} />
                  <Skeleton width="20%" height={12} />
                </div>
              </li>
            ))
          ) : data?.data?.length > 0 ? (
            // Data List
            data.data.map((app) => {
              const isActive = selectedId === app._id;
              const initials = `${app.employee?.firstName?.[0] || ""}${
                app.employee?.lastName?.[0] || ""
              }`;

              // Determine current status specifically for this approver or overall
              const status =
                app.approvals?.find((step) => step.approver?._id === admin?.id)
                  ?.status || app.overallStatus;

              return (
                <li
                  key={app._id}
                  onClick={() => onSelect(app)}
                  className={`group relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200
                    ${
                      isActive
                        ? "bg-blue-50/60 border-blue-200 shadow-sm ring-1 ring-blue-100"
                        : "bg-white border-transparent hover:bg-neutral-50 hover:border-neutral-200"
                    }`}
                >
                  {/* Avatar */}
                  <div
                    className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full text-sm font-bold shadow-sm transition-colors
                      ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "bg-neutral-100 text-neutral-600 group-hover:bg-neutral-200"
                      }`}
                  >
                    {initials}
                  </div>

                  {/* Content */}
                  <div className="flex flex-col flex-1 min-w-0 ">
                    {/* Top Row: Name and Status */}
                    <div className="flex justify-between items-start">
                      <span
                        className={`text-sm font-semibold truncate pr-2 ${
                          isActive ? "text-blue-900" : "text-neutral-800"
                        }`}
                      >
                        {app.employee?.firstName} {app.employee?.lastName}
                      </span>
                      <div className="transform scale-90 origin-top-right">
                        <StatusBadge status={status} />
                      </div>
                    </div>

                    {/* Middle Row: Position */}
                    <span className="text-xs text-neutral-500 truncate">
                      {app.employee?.position || "No position"}
                    </span>

                    {/* Bottom Row: Metadata (Hours) */}
                    <div className="flex items-center gap-3 mt-1">
                      <div
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border
                        ${
                          isActive
                            ? "bg-blue-100/50 border-blue-200 text-blue-700"
                            : "bg-neutral-50 border-neutral-200 text-neutral-600"
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        <span className="font-medium">
                          {app.requestedHours} hrs
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })
          ) : (
            // Empty State
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
              <div className="bg-neutral-50 p-3 rounded-full mb-3">
                <Search className="h-6 w-6 text-neutral-300" />
              </div>
              <p className="text-sm font-medium">No applications found</p>
              <p className="text-xs">Try adjusting your search</p>
            </div>
          )}
        </ul>
      </div>

      {/* --- FOOTER / PAGINATION --- */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-neutral-50/50 text-xs">
        {/* Limit Selector */}
        <div className="flex items-center gap-2 text-neutral-500">
          <span>Show</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="bg-white border border-neutral-200 rounded px-1 py-1 text-neutral-700 focus:ring-1 focus:ring-blue-400 outline-none cursor-pointer"
          >
            {[10, 20, 50, 100].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Pagination Controls */}
        {data?.totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((prev) => prev - 1)}
              className="p-1 rounded-md border border-transparent hover:bg-white hover:border-neutral-200 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent transition-all"
            >
              <ChevronLeft className="h-4 w-4 text-neutral-600" />
            </button>

            <span className="px-2 font-medium text-neutral-600">
              {page} <span className="text-neutral-400 font-normal">/</span>{" "}
              {data.totalPages}
            </span>

            <button
              disabled={page === data.totalPages}
              onClick={() => setPage((prev) => prev + 1)}
              className="p-1 rounded-md border border-transparent hover:bg-white hover:border-neutral-200 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent transition-all"
            >
              <ChevronRight className="h-4 w-4 text-neutral-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CtoApplicationsList;
