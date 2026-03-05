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
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { fetchMyCtoApplicationsApprovals } from "../../../api/cto";
import { useAuth } from "../../../store/authStore";
import { StatusBadge } from "../../statusUtils";

// ✅ Theme + scrollbar sync (same concept as MyCtoCreditHistory)
import ThemeSync from "../../themeSync";
import ScrollbarsSync from "../../../components/scrollbarSync";

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

/* ------------------ Resolve theme (no tailwind dark class dependency) ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ✅ Reactive resolved theme (fixes "system" switching + skeleton mismatch) */
function useResolvedTheme(prefTheme) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined")
      return prefTheme === "dark" ? "dark" : "light";
    return resolveTheme(prefTheme);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (prefTheme !== "system") {
      setTheme(prefTheme === "dark" ? "dark" : "light");
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(mq.matches ? "dark" : "light");
    update();

    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, [prefTheme]);

  return theme;
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
   Compact Pagination (dark-mode ready)
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
  borderColor,
}) => {
  const hasTotal = typeof total === "number";
  const safeTotalPages = Math.max(totalPages || 1, 1);

  return (
    <div
      className="px-4 py-3 border-t transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      {/* Mobile */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={page === 1 || safeTotalPages <= 1}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
            color: "var(--app-text)",
          }}
          onMouseEnter={(e) => {
            if (e.currentTarget.disabled) return;
            e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--app-surface)";
          }}
          type="button"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="text-center min-w-0">
          <div
            className="text-xs font-mono font-semibold"
            style={{ color: "var(--app-text)" }}
          >
            {page} / {safeTotalPages}
          </div>
          <div
            className="text-[11px] truncate"
            style={{ color: "var(--app-muted)" }}
          >
            {hasTotal
              ? total === 0
                ? `0 ${label}`
                : `${startItem}-${endItem} of ${total}`
              : " "}
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={page >= safeTotalPages || safeTotalPages <= 1}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
            color: "var(--app-text)",
          }}
          onMouseEnter={(e) => {
            if (e.currentTarget.disabled) return;
            e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--app-surface)";
          }}
          type="button"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div
          className="text-xs font-medium"
          style={{ color: "var(--app-muted)" }}
        >
          {hasTotal ? (
            <>
              Showing{" "}
              <span className="font-bold" style={{ color: "var(--app-text)" }}>
                {total === 0 ? 0 : `${startItem}-${endItem}`}
              </span>{" "}
              of{" "}
              <span className="font-bold" style={{ color: "var(--app-text)" }}>
                {total}
              </span>{" "}
              {label}
            </>
          ) : (
            <>
              Page{" "}
              <span className="font-bold" style={{ color: "var(--app-text)" }}>
                {page}
              </span>{" "}
              of{" "}
              <span className="font-bold" style={{ color: "var(--app-text)" }}>
                {safeTotalPages}
              </span>
            </>
          )}
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-lg border transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface-2)",
            borderColor: borderColor,
          }}
        >
          <button
            onClick={onPrev}
            disabled={page === 1 || safeTotalPages <= 1}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            aria-label="Previous page"
            type="button"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span
            className="text-xs font-mono font-semibold px-3"
            style={{ color: "var(--app-muted)" }}
          >
            {page} / {safeTotalPages}
          </span>

          <button
            onClick={onNext}
            disabled={page >= safeTotalPages || safeTotalPages <= 1}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
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

const LIMIT_OPTIONS = [10, 20, 50];

const tabTone = {
  accent: {
    bg: "var(--accent-soft)",
    text: "var(--accent)",
    br: "var(--accent-soft2, rgba(37,99,235,0.18))",
  },
  amber: {
    bg: "rgba(245,158,11,0.16)",
    text: "#d97706",
    br: "rgba(245,158,11,0.26)",
  },
  green: {
    bg: "rgba(34,197,94,0.14)",
    text: "#16a34a",
    br: "rgba(34,197,94,0.24)",
  },
  red: {
    bg: "rgba(239,68,68,0.14)",
    text: "#ef4444",
    br: "rgba(239,68,68,0.24)",
  },
  slate: {
    bg: "var(--app-surface-2)",
    text: "var(--app-text)",
    br: "var(--app-border)",
  },
};

const CtoApplicationsList = () => {
  const { admin } = useAuth();
  const navigate = useNavigate();
  const { id: selectedId } = useParams();
  const isXlUp = useIsXlUp();

  // ✅ Theme vars (same concept as MyCtoCreditHistory)
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColors = useMemo(() => {
    // ✅ uses var fallbacks so skeleton never flashes white
    const base =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(15,23,42,0.06)";
    const highlight =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(15,23,42,0.10)";

    return {
      baseColor: `var(--skeleton-base, ${base})`,
      highlightColor: `var(--skeleton-highlight, ${highlight})`,
    };
  }, [resolvedTheme]);

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
    { id: "", label: "All", icon: LayoutGrid, tone: "accent" },
    { id: "PENDING", label: "Pending", icon: AlertCircle, tone: "amber" },
    { id: "APPROVED", label: "Approved", icon: CheckCircle2, tone: "green" },
    { id: "REJECTED", label: "Rejected", icon: XCircle, tone: "red" },
    { id: "CANCELLED", label: "Cancelled", icon: Ban, tone: "slate" },
  ];

  if (isError) {
    return (
      <div
        className="flex items-center justify-center h-full p-4 text-sm"
        style={{ color: "var(--app-muted)" }}
      >
        Failed to load applications
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full min-h-0 rounded-xl shadow-sm overflow-hidden min-w-0 border transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
        color: "var(--app-text)",
      }}
    >
      <ThemeSync />
      <ScrollbarsSync />

      <SkeletonTheme
        baseColor={skeletonColors.baseColor}
        highlightColor={skeletonColors.highlightColor}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface-2)",
            borderColor: borderColor,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1
                className="text-lg font-bold"
                style={{ color: "var(--app-text)" }}
              >
                CTO Requests
              </h1>
              <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                Review and approve time off
              </p>
            </div>

            <div className="text-right">
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--app-muted)" }}
              >
                Total
              </div>
              <div
                className="text-sm font-extrabold"
                style={{ color: "var(--app-text)" }}
              >
                {isLoading ? <Skeleton width={40} /> : computedTotalCount}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="px-3 pt-2"
          style={{ backgroundColor: "var(--app-surface)" }}
        >
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
            {tabs.map((tab) => {
              const isActive = statusFilter === tab.id;
              const count = getCountForTab(tab.id);
              const t = tabTone[tab.tone] || tabTone.accent;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className="flex items-center gap-1 p-1.5 rounded-lg border transition-colors duration-200 whitespace-nowrap"
                  style={{
                    backgroundColor: isActive ? t.bg : "var(--app-surface)",
                    borderColor: isActive ? t.br : borderColor,
                    color: isActive ? t.text : "var(--app-muted)",
                  }}
                  onMouseEnter={(e) => {
                    if (isActive) return;
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (isActive) return;
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface)";
                  }}
                  aria-pressed={isActive}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {tab.label}
                  </span>
                  <span
                    className="px-1 py-0.5 rounded text-[9px] font-black leading-none"
                    style={{
                      backgroundColor: isActive
                        ? "rgba(255,255,255,0.35)"
                        : "var(--app-surface-2)",
                      color: isActive ? "var(--app-text)" : "var(--app-muted)",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + Limit */}
        <div
          className="flex flex-col gap-2 px-3 py-2 border-b transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
            <div className="relative flex-1 group min-w-0">
              <Search
                className="absolute left-3 top-2.5 h-4 w-4 transition-colors"
                style={{ color: "var(--app-muted)" }}
              />
              <input
                type="text"
                placeholder="Search applicant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 py-2 w-full rounded-lg text-sm outline-none border transition-colors duration-200 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: borderColor,
                  color: "var(--app-text)",
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 p-0.5 rounded-full transition-colors duration-200 ease-out"
                  style={{ color: "var(--app-muted)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                  aria-label="Clear search"
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div
              className="flex items-center justify-between sm:justify-end gap-2 sm:pl-2 sm:border-l"
              style={{ borderColor: borderColor }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--app-muted)" }}
              >
                Show
              </span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="border rounded-lg px-2 py-2 text-xs font-semibold outline-none cursor-pointer transition-colors duration-200 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: borderColor,
                  color: "var(--app-text)",
                }}
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

        {/* List */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-2 py-2"
          style={{ backgroundColor: "var(--app-surface)" }}
        >
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
                const initials = `${app.employee?.firstName?.[0] || ""}${
                  app.employee?.lastName?.[0] || ""
                }`;

                const myStep = app.approvals?.find(
                  (step) =>
                    String(step?.approver?._id || "") ===
                    String(admin?.id || ""),
                );

                const status = myStep?.status || app.overallStatus;

                return (
                  <li
                    key={app._id}
                    onClick={() => navigate(`/app/cto-approvals/${app._id}`)}
                    className="group flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors duration-200"
                    style={{
                      backgroundColor: isActive
                        ? "var(--accent-soft)"
                        : "var(--app-surface)",
                      borderColor: isActive
                        ? "var(--accent-soft2, rgba(37,99,235,0.18))"
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (isActive) return;
                      e.currentTarget.style.backgroundColor =
                        "var(--app-surface-2)";
                      e.currentTarget.style.borderColor = borderColor;
                    }}
                    onMouseLeave={(e) => {
                      if (isActive) return;
                      e.currentTarget.style.backgroundColor =
                        "var(--app-surface)";
                      e.currentTarget.style.borderColor = "transparent";
                    }}
                  >
                    <div
                      className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full text-sm font-bold shadow-sm transition-colors"
                      style={{
                        backgroundColor: isActive
                          ? "var(--accent)"
                          : "var(--app-surface-2)",
                        color: isActive ? "#fff" : "var(--app-muted)",
                      }}
                    >
                      {initials || "?"}
                    </div>

                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <span
                          className="text-sm font-semibold truncate"
                          style={{
                            color: isActive
                              ? "var(--app-text)"
                              : "var(--app-text)",
                          }}
                        >
                          {app.employee?.firstName} {app.employee?.lastName}
                        </span>

                        <div className="transform scale-[0.85] origin-top-right flex-none">
                          <StatusBadge status={status} />
                        </div>
                      </div>

                      <span
                        className="text-xs truncate"
                        style={{ color: "var(--app-muted)" }}
                      >
                        {app.employee?.position || "No position"}
                      </span>

                      <div className="flex items-center gap-3 mt-1">
                        <div
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border"
                          style={{
                            backgroundColor: isActive
                              ? "rgba(37,99,235,0.10)"
                              : "var(--app-surface-2)",
                            borderColor: isActive
                              ? "var(--accent-soft2, rgba(37,99,235,0.18))"
                              : borderColor,
                            color: isActive
                              ? "var(--accent)"
                              : "var(--app-muted)",
                          }}
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
              <div
                className="flex flex-col items-center justify-center py-12"
                style={{ color: "var(--app-muted)" }}
              >
                <Search className="h-6 w-6 mb-2" style={{ opacity: 0.25 }} />
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
          borderColor={borderColor}
        />
      </SkeletonTheme>
    </div>
  );
};

export default CtoApplicationsList;
