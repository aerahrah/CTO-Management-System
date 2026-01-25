import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LayoutGrid,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { fetchMyCtoApplicationsApprovals } from "../../../api/cto";
import { useAuth } from "../../../store/authStore";
import { StatusBadge } from "../../statusUtils";

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const CtoApplicationsList = () => {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const { id: selectedId } = useParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const debouncedSearch = useDebounce(searchTerm, 500);

  // --- FETCH LIST ---
  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "ctoApplications",
      debouncedSearch,
      sortOrder,
      page,
      limit,
      statusFilter,
    ],
    queryFn: () =>
      fetchMyCtoApplicationsApprovals({
        search: debouncedSearch,
        page,
        limit,
        sortOrder,
        status: statusFilter,
      }),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  // --- AUTO NAVIGATE TO MOST RECENT ---
  const hasNavigatedRef = useRef(false);
  useEffect(() => {
    if (!hasNavigatedRef.current && data?.data?.length > 0 && !selectedId) {
      navigate(`/dashboard/cto/approvals/${data.data[0]._id}`);
      hasNavigatedRef.current = true;
    }
  }, [data, selectedId, navigate]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const handleSortToggle = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const tabs = [
    {
      id: "",
      label: "All",
      icon: LayoutGrid,
      activeColor: "bg-blue-100 text-blue-700 border-blue-200",
    },
    {
      id: "PENDING",
      label: "Pending",
      icon: AlertCircle,
      activeColor: "bg-amber-100 text-amber-700 border-amber-200",
    },
    {
      id: "APPROVED",
      label: "Approved",
      icon: CheckCircle2,
      activeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    {
      id: "REJECTED",
      label: "Rejected",
      icon: XCircle,
      activeColor: "bg-rose-100 text-rose-700 border-rose-200",
    },
  ];

  if (isError)
    return (
      <div className="flex items-center justify-center h-full p-4 text-neutral-500 text-sm">
        Failed to load applications
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      {/* --- HEADER --- */}
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
        <h1 className="text-lg font-bold text-neutral-800">CTO Requests</h1>
        <p className="text-xs text-neutral-500">Review and approve time off</p>
      </div>

      {/* --- MOBILE FRIENDLY STATUS FILTER PILLS --- */}
      <div className="px-3 pt-2 bg-white">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
          {tabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            const Icon = tab.icon;

            const count =
              tab.id === ""
                ? Object.values(data?.statusCounts || {}).reduce(
                    (a, b) => a + b,
                    0,
                  )
                : data?.statusCounts?.[tab.id] || 0;

            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`
        flex items-center gap-1 p-1.25 rounded-lg border transition-all duration-200 whitespace-nowrap
        ${
          isActive
            ? `${tab.activeColor} shadow-sm ring-1 ring-inset ring-black/5`
            : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50"
        }
      `}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {tab.label}
                </span>

                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black leading-none 
          ${isActive ? "bg-white/50" : "bg-neutral-100 text-neutral-600"}
        `}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- SEARCH & SORT --- */}
      <div className="flex flex-col gap-2 px-3 py-2 border-b border-neutral-100 bg-white">
        <div className="flex items-center gap-2">
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

          <button
            onClick={handleSortToggle}
            className="flex items-center justify-center h-10 w-10 border border-neutral-200 rounded-lg 
                       bg-white text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 transition-all"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* --- SCROLLABLE LIST --- */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-1">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="p-3">
                <Skeleton height={60} borderRadius={12} />
              </li>
            ))
          ) : data?.data?.length > 0 ? (
            data.data.map((app) => {
              const isActive = selectedId === app._id;
              const initials = `${app.employee?.firstName?.[0] || ""}${
                app.employee?.lastName?.[0] || ""
              }`;
              const status =
                app.approvals?.find((step) => step.approver?._id === admin?.id)
                  ?.status || app.overallStatus;

              return (
                <li
                  key={app._id}
                  onClick={() =>
                    navigate(`/dashboard/cto/approvals/${app._id}`)
                  }
                  className={`group flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200
                    ${
                      isActive
                        ? "bg-blue-50/60 border-blue-200 shadow-sm ring-1 ring-blue-100"
                        : "bg-white border-transparent hover:bg-neutral-50 hover:border-neutral-200"
                    }`}
                >
                  <div
                    className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full text-sm font-bold shadow-sm transition-colors
                      ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                  >
                    {initials}
                  </div>

                  <div className="flex flex-col flex-1 min-w-0 ">
                    <div className="flex justify-between items-start">
                      <span
                        className={`text-sm font-semibold truncate pr-2 ${
                          isActive ? "text-blue-900" : "text-neutral-800"
                        }`}
                      >
                        {app.employee?.firstName} {app.employee?.lastName}
                      </span>
                      <div className="transform scale-[0.8] origin-top-right">
                        <StatusBadge status={status} />
                      </div>
                    </div>
                    <span className="text-xs text-neutral-500 truncate">
                      {app.employee?.position || "No position"}
                    </span>
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
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
              <Search className="h-6 w-6 mb-2 opacity-20" />
              <p className="text-xs font-medium uppercase tracking-tighter">
                No results found
              </p>
            </div>
          )}
        </ul>
      </div>

      {/* --- FOOTER --- */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-neutral-50/50 text-[10px] font-bold text-neutral-500 uppercase">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="bg-white border border-neutral-200 rounded p-1 outline-none"
          >
            {[10, 20, 50].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {data?.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((prev) => prev - 1)}
              className="p-1 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              {page} / {data.totalPages}
            </span>
            <button
              disabled={page === data.totalPages}
              onClick={() => setPage((prev) => prev + 1)}
              className="p-1 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CtoApplicationsList;
