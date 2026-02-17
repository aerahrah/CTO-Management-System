// ctoApplicationsList.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LayoutGrid,
  Ban,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { fetchMyCtoApplicationsApprovals } from "../../../api/cto";
import { useAuth } from "../../../store/authStore";
import { StatusBadge } from "../../statusUtils";

/* ================================
   HOOK: DEBOUNCE
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
   HOOK: MEDIA QUERY (xl and up)
================================ */
function useIsXlUp() {
  const [isXlUp, setIsXlUp] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1280px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = (e) => setIsXlUp(e.matches);

    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return isXlUp;
}

/* ================================
   PAGINATION
================================ */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  label = "items",
}) => {
  const hasTotal = typeof total === "number";

  return (
    <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/50">
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={page === 1 || totalPages <= 1}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-neutral-200 bg-white text-sm font-bold text-neutral-700 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="text-center min-w-0">
          <div className="text-xs font-mono font-semibold text-neutral-700">
            {page} / {Math.max(totalPages, 1)}
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
          disabled={page >= totalPages || totalPages <= 1}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-neutral-200 bg-white text-sm font-bold text-neutral-700 disabled:opacity-30"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

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
                {Math.max(totalPages, 1)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-neutral-200">
          <button
            onClick={onPrev}
            disabled={page === 1 || totalPages <= 1}
            className="p-1.5 rounded-md hover:bg-neutral-50 hover:shadow-sm disabled:opacity-30 transition-all text-neutral-600"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono font-semibold px-3 text-neutral-700">
            {page} / {Math.max(totalPages, 1)}
          </span>

          <button
            onClick={onNext}
            disabled={page >= totalPages || totalPages <= 1}
            className="p-1.5 rounded-md hover:bg-neutral-50 hover:shadow-sm disabled:opacity-30 transition-all text-neutral-600"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const LIMIT_OPTIONS = [10, 20, 50];

const CtoApplicationsList = () => {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const { id: selectedId } = useParams();

  const isXlUp = useIsXlUp();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const debouncedSearch = useDebounce(searchTerm, 450);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "ctoApplicationsApprovals",
      String(admin?.id || ""),
      debouncedSearch,
      page,
      limit,
      statusFilter,
    ],
    queryFn: () =>
      fetchMyCtoApplicationsApprovals({
        search: debouncedSearch,
        page,
        limit,
        status: statusFilter || undefined,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  });

  const statusCounts = data?.statusCounts || {};

  const computedTotalCount = useMemo(() => {
    if (typeof statusCounts?.total === "number") return statusCounts.total;
    return ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].reduce(
      (sum, k) => sum + (Number(statusCounts?.[k]) || 0),
      0,
    );
  }, [statusCounts]);

  const getCountForTab = (id) => {
    if (id === "") return computedTotalCount;
    return Number(statusCounts?.[id]) || 0;
  };

  const hasNavigatedRef = useRef(false);
  useEffect(() => {
    if (!isXlUp) return;
    if (!hasNavigatedRef.current && data?.data?.length > 0 && !selectedId) {
      navigate(`/app/cto-approvals/${data.data[0]._id}`, { replace: true });
      hasNavigatedRef.current = true;
    }
  }, [data, selectedId, navigate, isXlUp]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, limit]);

  const apps = data?.data || [];
  const totalPages = Math.max(
    data?.totalPages || data?.pagination?.totalPages || 1,
    1,
  );

  const total =
    typeof data?.total === "number"
      ? data.total
      : typeof data?.pagination?.total === "number"
        ? data.pagination.total
        : typeof computedTotalCount === "number"
          ? computedTotalCount
          : undefined;

  const startItem =
    typeof total === "number"
      ? total === 0
        ? 0
        : (page - 1) * limit + 1
      : null;

  const endItem =
    typeof total === "number"
      ? total === 0
        ? 0
        : Math.min(page * limit, total)
      : null;

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
    {
      id: "CANCELLED",
      label: "Cancelled",
      icon: Ban,
      activeColor: "bg-neutral-200 text-neutral-800 border-neutral-300",
    },
  ];

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-neutral-500 text-sm">
        Failed to load applications
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden min-w-0">
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-neutral-800">CTO Requests</h1>
            <p className="text-xs text-neutral-500">
              Review and approve time off
            </p>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Total
            </div>
            <div className="text-sm font-extrabold text-neutral-800">
              {isLoading ? <Skeleton width={40} /> : computedTotalCount}
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pt-2 bg-white">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
          {tabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            const Icon = tab.icon;
            const count = getCountForTab(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1 p-1.5 rounded-lg border transition-all duration-200 whitespace-nowrap
                  ${
                    isActive
                      ? `${tab.activeColor} shadow-sm ring-1 ring-inset ring-black/5`
                      : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50"
                  }`}
              >
                {/* <Icon className="w-3.5 h-3.5" /> */}
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {tab.label}
                </span>
                <span
                  className={`px-1 py-0.5 rounded text-[9px] font-black leading-none 
                    ${
                      isActive
                        ? "bg-white/50"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 px-3 py-2 border-b border-neutral-100 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
          <div className="relative flex-1 group min-w-0">
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
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 sm:pl-2 sm:border-l sm:border-neutral-200">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Show
            </span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-neutral-200 rounded-lg px-2 py-2 text-xs font-semibold text-neutral-700 outline-none cursor-pointer hover:bg-neutral-50"
            >
              {LIMIT_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-1">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="p-3">
                <Skeleton height={60} borderRadius={12} />
              </li>
            ))
          ) : apps?.length > 0 ? (
            apps.map((app) => {
              const isActive = selectedId === app._id;
              const initials = `${app.employee?.firstName?.[0] || ""}${app.employee?.lastName?.[0] || ""}`;

              const myStep = app.approvals?.find(
                (step) =>
                  String(step?.approver?._id || "") === String(admin?.id || ""),
              );

              const status = myStep?.status || app.overallStatus;

              return (
                <li
                  key={app._id}
                  onClick={() => navigate(`/app/cto-approvals/${app._id}`)}
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
                    {initials || "?"}
                  </div>

                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span
                        className={`text-sm font-semibold truncate ${
                          isActive ? "text-blue-900" : "text-neutral-800"
                        }`}
                      >
                        {app.employee?.firstName} {app.employee?.lastName}
                      </span>

                      <div className="transform scale-[0.85] origin-top-right flex-none">
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

      <CompactPagination
        page={page}
        totalPages={totalPages}
        total={total}
        startItem={startItem}
        endItem={endItem}
        label="requests"
        onPrev={() => setPage((p) => Math.max(p - 1, 1))}
        onNext={() => setPage((p) => Math.min(p + 1, totalPages))}
      />
    </div>
  );
};

export default CtoApplicationsList;
