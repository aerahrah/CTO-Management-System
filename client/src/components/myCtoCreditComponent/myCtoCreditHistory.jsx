import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import { fetchMyCreditRequests } from "../../api/cto";
import { StatusBadge } from "../statusUtils";
import Modal from "../modal";
import CtoMemoModalContent from "../ctoComponents/ctoCreditComponents/CtoMemoModalContent";
import Breadcrumbs from "../breadCrumbs";
import ThemeSync from "../themeSync";
import ScrollbarsSync from "../../components/scrollbarSync";
import FilterSelect from "../filterSelect";
import { API_BASE_URL } from "../../config/env";
import { useAuth } from "../../store/authStore";

import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  Inbox,
  FileText,
  Calendar,
  CheckCircle2,
  Archive,
  Layers,
  Clock as ClockIcon,
  Eye,
  ArrowUp,
} from "lucide-react";

const pageSizeOptions = [20, 50, 100];

/* ------------------ Small hook: debounce ------------------ */
const useDebouncedValue = (value, delay = 500) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

/* ------------------ Resolve theme (no tailwind dark class dependency) ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ------------------ StatCard (Improved) ------------------ */
const StatCard = ({
  title,
  value,
  icon: Icon,
  hint,
  tone = "neutral",
  borderColor,
}) => {
  const toneMeta = {
    blue: {
      chipBg: "var(--accent-soft)",
      chipText: "var(--accent)",
    },
    green: { chipBg: "rgba(34,197,94,0.14)", chipText: "#16a34a" },
    red: { chipBg: "rgba(239,68,68,0.14)", chipText: "#ef4444" },
    amber: { chipBg: "rgba(245,158,11,0.16)", chipText: "#d97706" },
    neutral: {
      chipBg: "var(--app-surface-2)",
      chipText: "var(--app-muted)",
    },
  };

  const t = toneMeta[tone] || toneMeta.neutral;

  return (
    <div
      className="w-full flex-shrink-0 rounded-xl shadow-sm p-3.5 flex items-start gap-3 h-full
                 transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        border: `1px solid ${borderColor}`,
      }}
      role="status"
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border
                   transition-colors duration-300 ease-out"
        style={{
          backgroundColor: t.chipBg,
          borderColor: borderColor,
          color: t.chipText,
        }}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] uppercase font-bold tracking-wide truncate transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          {title}
        </div>
        <div
          className="mt-0.5 text-lg font-black truncate transition-colors duration-300 ease-out"
          style={{ color: "var(--app-text)" }}
        >
          {value}
        </div>
        {hint && (
          <div
            className="text-[11px] truncate transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {hint}
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------ Mobile/Tablet Card Row ------------------ */
const CreditCard = ({
  credit,
  onViewMemo,
  formatDuration,
  leftStripClassName,
  borderColor,
}) => {
  const dateLabel = credit?.dateApproved
    ? new Date(credit.dateApproved).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

  return (
    <div
      className={`rounded-xl shadow-sm overflow-hidden border-y border-r transition-colors duration-300 ease-out
      ${leftStripClassName}`}
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      <div className="p-4 transition-colors duration-300 ease-out">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-bold truncate transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                {credit?.memoNo || "-"}
              </span>
            </div>

            <div
              className="mt-2 flex items-center gap-2 text-xs transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <Calendar
                className="w-4 h-4"
                style={{ color: "var(--app-muted)" }}
              />
              <span className="truncate">{dateLabel}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 flex-none">
            <StatusBadge status={credit?.employeeStatus} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div
            className="rounded-lg border p-2 transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor: borderColor,
            }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <ClockIcon className="w-3.5 h-3.5" /> Duration
            </div>
            <div
              className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {formatDuration(credit?.duration)}
            </div>
          </div>

          <div
            className="rounded-lg border p-2 transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor: borderColor,
            }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <Layers className="w-3.5 h-3.5" /> Remaining
            </div>
            <div
              className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {typeof credit?.remainingHours === "number"
                ? `${credit.remainingHours}h`
                : `${credit?.remainingHours || 0}h`}
            </div>
          </div>
        </div>
      </div>

      <div
        className="border-t p-3 transition-colors duration-300 ease-out"
        style={{
          borderColor: borderColor,
          backgroundColor: "var(--app-surface)",
        }}
      >
        <button
          onClick={onViewMemo}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border
                   transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
            color: "var(--accent)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent-soft)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--app-surface)";
          }}
          type="button"
        >
          <Eye className="w-4 h-4" />
          View Memo
        </button>
      </div>
    </div>
  );
};

/* ------------------ Compact Pagination ------------------ */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  borderColor,
}) => {
  return (
    <div
      className="px-4 md:px-6 py-3 border-t transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      {/* Mobile/tablet */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30
                     transition-colors duration-200 ease-out"
          style={{
            borderColor: borderColor,
            backgroundColor: "var(--app-surface)",
            color: "var(--app-text)",
          }}
          type="button"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="text-center min-w-0">
          <div
            className="text-xs font-mono font-semibold transition-colors duration-300 ease-out"
            style={{ color: "var(--app-text)" }}
          >
            {page} / {totalPages}
          </div>
          <div
            className="text-[11px] truncate transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {total === 0 ? "0 results" : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30
                     transition-colors duration-200 ease-out"
          style={{
            borderColor: borderColor,
            backgroundColor: "var(--app-surface)",
            color: "var(--app-text)",
          }}
          type="button"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex flex-col md:flex-row items-center justify-between gap-4">
        <div
          className="text-xs font-medium"
          style={{ color: "var(--app-muted)" }}
        >
          Showing{" "}
          <span className="font-bold" style={{ color: "var(--app-text)" }}>
            {total === 0 ? 0 : `${startItem}-${endItem}`}
          </span>{" "}
          of{" "}
          <span className="font-bold" style={{ color: "var(--app-text)" }}>
            {total}
          </span>{" "}
          credits
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
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            type="button"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span
            className="text-xs font-mono font-medium px-3"
            style={{ color: "var(--app-muted)" }}
          >
            {page} / {totalPages}
          </span>

          <button
            onClick={onNext}
            disabled={page >= totalPages || total === 0}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            type="button"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const MyCtoCreditHistory = () => {
  // ✅ apply theme vars on this page too
  // (if Dashboard already mounts ThemeSync, this is harmless)
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  // ✅ Make borders less “white” on dark mode
  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  // ✅ Skeleton theme (fix: no more white loading in dark mode)
  const skeletonColors = useMemo(() => {
    if (resolvedTheme === "dark") {
      return {
        baseColor: "rgba(255,255,255,0.06)",
        highlightColor: "rgba(255,255,255,0.10)",
      };
    }
    return {
      baseColor: "rgba(15,23,42,0.06)",
      highlightColor: "rgba(15,23,42,0.10)",
    };
  }, [resolvedTheme]);

  // filters / pagination / modal state
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 500);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });

  // ✅ Mobile scroll container + "back to top"
  const scrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => setShowScrollTop(el.scrollTop > 240);

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  const statusCounts = data?.statusCounts || {
    ACTIVE: 0,
    EXHAUSTED: 0,
    ROLLEDBACK: 0,
  };

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

  const getLeftStripClass = useCallback((employeeStatus) => {
    switch (employeeStatus) {
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

  const getStatusTabs = (counts = {}) => [
    {
      id: "",
      label: "All Credits",
      icon: Layers,
      count:
        (counts.ACTIVE || 0) +
        (counts.EXHAUSTED || 0) +
        (counts.ROLLEDBACK || 0),
      activeClass:
        "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:var(--accent-soft2)]",
    },
    {
      id: "ACTIVE",
      label: "Active",
      icon: CheckCircle2,
      count: counts.ACTIVE || 0,
      activeClass: "bg-green-100 text-green-700 border-green-200",
    },
    {
      id: "EXHAUSTED",
      label: "Exhausted",
      icon: AlertCircle,
      count: counts.EXHAUSTED || 0,
      activeClass: "bg-red-100 text-red-700 border-red-200",
    },
    {
      id: "ROLLEDBACK",
      label: "Rolled Back",
      icon: RotateCcw,
      count: counts.ROLLEDBACK || 0,
      activeClass: "bg-amber-100 text-amber-700 border-amber-200",
    },
  ];

  return (
    <div
      className="w-full h-full min-h-0 flex flex-col md:p-0 transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <ThemeSync />
      <ScrollbarsSync className="cto-scrollbar" applyToDocument={true} />

      <SkeletonTheme
        baseColor={skeletonColors.baseColor}
        highlightColor={skeletonColors.highlightColor}
      >
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain md:contents cto-scrollbar"
        >
          {/* HEADER */}
          <div className="pt-2 pb-3 md:pb-6 px-1">
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div>
                  <Breadcrumbs rootLabel="home" rootTo="/app" />
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-sans">
                    My CTO Credit History
                  </h1>
                  <p
                    className="text-sm mt-1 max-w-2xl"
                    style={{ color: "var(--app-muted)" }}
                  >
                    View your credited and rolled back CTO hours
                  </p>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="w-full md:w-auto flex-1 lg:flex-none flex flex-col gap-3 md:ml-4">
                <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
                  <StatCard
                    title="Total Credited"
                    value={`${fmtHours(summary.totalCredited)}h`}
                    icon={CheckCircle2}
                    hint={`${totalMemosOverall} memos`}
                    tone="green"
                    borderColor={borderColor}
                  />
                  <StatCard
                    title="Used Hours"
                    value={`${fmtHours(summary.usedHours)}h`}
                    icon={ClockIcon}
                    hint="Total used"
                    tone="red"
                    borderColor={borderColor}
                  />
                  <StatCard
                    title="Reserved"
                    value={`${fmtHours(summary.reservedHours)}h`}
                    icon={Archive}
                    hint="Reserved in apps"
                    tone="amber"
                    borderColor={borderColor}
                  />
                  <StatCard
                    title="Balance"
                    value={`${fmtHours(summary.remainingHours)}h`}
                    icon={Layers}
                    hint="Remaining hours"
                    tone="blue"
                    borderColor={borderColor}
                  />
                </div>

                {/* Mobile summary */}
                <div className="flex lg:hidden flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        label: "Balance",
                        value: `${fmtHours(summary.remainingHours)}h`,
                      },
                      {
                        label: "Used",
                        value: `${fmtHours(summary.usedHours)}h`,
                      },
                      {
                        label: "Reserved",
                        value: `${fmtHours(summary.reservedHours)}h`,
                      },
                      {
                        label: "Credited",
                        value: `${fmtHours(summary.totalCredited)}h`,
                      },
                    ].map((it) => (
                      <div
                        key={it.label}
                        className="border rounded-lg p-2 flex justify-between items-center transition-colors duration-300 ease-out"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor: borderColor,
                        }}
                      >
                        <div
                          className="text-[10px] uppercase font-bold"
                          style={{ color: "var(--app-muted)" }}
                        >
                          {it.label}
                        </div>
                        <div
                          className="text-sm font-bold"
                          style={{ color: "var(--app-text)" }}
                        >
                          {it.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CARD */}
          <div
            className="flex flex-col rounded-xl shadow-sm overflow-visible md:flex-1 md:min-h-0 md:overflow-hidden transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              border: `1px solid ${borderColor}`,
            }}
          >
            {/* Toolbar */}
            <div
              className="p-4 border-b space-y-4 sticky top-0 z-[1] backdrop-blur md:static md:z-auto transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface-2)",
                borderColor: borderColor,
              }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {getStatusTabs(statusCounts).map((tab) => {
                    const isActive = statusFilter === tab.id;
                    const Icon = tab.icon;

                    return (
                      <button
                        type="button"
                        key={tab.id}
                        onClick={() => {
                          setStatusFilter(tab.id);
                          setPage(1);
                        }}
                        className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-2
                          ${
                            isActive
                              ? tab.activeClass
                              : "bg-[color:var(--app-surface)] text-[color:var(--app-muted)] border-[color:var(--app-border)] hover:bg-[color:var(--app-surface-2)]"
                          }`}
                        aria-pressed={isActive}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                        <span
                          className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ease-out
                            ${
                              isActive
                                ? "bg-[color:var(--app-surface)] text-[color:var(--app-text)]"
                                : "bg-[color:var(--app-surface-2)] text-[color:var(--app-muted)]"
                            }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-64">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: "var(--app-muted)" }}
                    />
                    <input
                      type="text"
                      placeholder="Search memo..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-lg text-sm outline-none transition-colors duration-200 ease-out border"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor: borderColor,
                        color: "var(--app-text)",
                      }}
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={() => setSearchInput("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors duration-200 ease-out"
                        style={{ color: "var(--app-muted)" }}
                        aria-label="Clear search"
                        title="Clear"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>

                  <div
                    className="hidden lg:flex items-center gap-2 pl-3 border-l"
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
                      className="border text-xs rounded-lg block p-1.5 font-medium outline-none cursor-pointer transition-colors duration-200 ease-out"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor: borderColor,
                        color: "var(--app-text)",
                      }}
                    >
                      {pageSizeOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    className="lg:hidden flex items-center gap-1.5 px-2 border-l ml-1"
                    style={{ borderColor: borderColor }}
                  >
                    <span
                      className="text-xs font-medium uppercase tracking-wider"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Shows
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
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Active:
                    </span>
                    {debouncedSearch && (
                      <span
                        className="px-2 py-0.5 rounded border text-[10px] font-medium"
                        style={{
                          backgroundColor: "var(--accent-soft)",
                          color: "var(--accent)",
                          borderColor: "var(--accent-soft2)",
                        }}
                      >
                        "{debouncedSearch}"
                      </span>
                    )}
                    {statusFilter && (
                      <span
                        className="px-2 py-0.5 rounded border text-[10px] font-medium"
                        style={{
                          backgroundColor: "var(--accent-soft)",
                          color: "var(--accent)",
                          borderColor: "var(--accent-soft2)",
                        }}
                      >
                        {statusFilter}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase"
                    style={{ color: "var(--accent)" }}
                  >
                    <RotateCcw size={10} /> Reset
                  </button>
                </div>
              )}
            </div>

            {/* Data region */}
            <div
              className="min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-y-auto transition-colors duration-300 ease-out cto-scrollbar"
              style={{ backgroundColor: "var(--app-bg)" }}
            >
              {isError ? (
                <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
                  <div
                    className="p-6 rounded-full mb-4 ring-1"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      borderColor: borderColor,
                    }}
                  >
                    <AlertCircle className="w-10 h-10 text-red-400" />
                  </div>
                  <h3
                    className="text-lg font-bold"
                    style={{ color: "var(--app-text)" }}
                  >
                    Couldn’t load your credit history
                  </h3>
                  <p
                    className="text-sm mt-1 max-w-md"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {error?.message || "Please try again."}
                  </p>
                  <button
                    onClick={() => refetch()}
                    className="mt-6 inline-flex items-center gap-2 rounded-md px-4 py-2 border text-sm font-bold transition-colors duration-200 ease-out"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      borderColor: borderColor,
                      color: "var(--accent)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "var(--accent-soft)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "var(--app-surface)")
                    }
                    type="button"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              ) : !isLoading && credits.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                  <div
                    className="p-6 rounded-full mb-4 ring-1"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      borderColor: borderColor,
                    }}
                  >
                    <Inbox
                      className="w-10 h-10"
                      style={{ color: "var(--app-muted)" }}
                    />
                  </div>
                  <h3
                    className="text-lg font-bold"
                    style={{ color: "var(--app-text)" }}
                  >
                    No Credit History Found
                  </h3>
                  {isFiltered && (
                    <button
                      onClick={handleResetFilters}
                      className="mt-6 text-sm font-bold underline"
                      style={{ color: "var(--accent)" }}
                      type="button"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="block md:hidden p-4">
                    <div className="space-y-3">
                      {isLoading
                        ? [...Array(Math.min(limit, 6))].map((_, i) => (
                            <div
                              key={i}
                              className="rounded-xl shadow-sm p-4 border transition-colors duration-300 ease-out"
                              style={{
                                backgroundColor: "var(--app-surface)",
                                borderColor: borderColor,
                              }}
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
                              formatDuration={(d) => formatDuration(d)}
                              leftStripClassName={getLeftStripClass(
                                credit?.employeeStatus,
                              )}
                              onViewMemo={() => openMemo(credit)}
                              borderColor={borderColor}
                            />
                          ))}
                    </div>
                  </div>

                  {/* Tablet cards */}
                  <div className="hidden md:block lg:hidden p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {isLoading
                        ? [...Array(Math.min(limit, 6))].map((_, i) => (
                            <div
                              key={i}
                              className="rounded-xl shadow-sm p-4 border transition-colors duration-300 ease-out"
                              style={{
                                backgroundColor: "var(--app-surface)",
                                borderColor: borderColor,
                              }}
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
                              formatDuration={(d) => formatDuration(d)}
                              leftStripClassName={getLeftStripClass(
                                credit?.employeeStatus,
                              )}
                              onViewMemo={() => openMemo(credit)}
                              borderColor={borderColor}
                            />
                          ))}
                    </div>
                  </div>

                  {/* Desktop table */}
                  <div className="hidden lg:block w-full align-middle">
                    <table className="w-full text-left">
                      <thead
                        className="sticky top-0 z-10 border-b transition-colors duration-300 ease-out"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor: borderColor,
                        }}
                      >
                        <tr
                          className="text-[10px] uppercase tracking-[0.12em] font-bold"
                          style={{ color: "var(--app-muted)" }}
                        >
                          <th className="px-6 py-4 font-bold">
                            REFERENCE / MEMO
                          </th>
                          <th className="px-6 py-4 font-bold">Date Credited</th>
                          <th className="px-6 py-4 text-center">Duration</th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4 text-right">Memo</th>
                        </tr>
                      </thead>

                      <tbody>
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
                          : credits.map((credit, i) => {
                              const bg =
                                i % 2 === 0
                                  ? "var(--app-surface)"
                                  : "var(--app-surface-2)";
                              return (
                                <tr
                                  key={credit._id || `${credit.memoNo}-${i}`}
                                  className="transition-colors duration-200 ease-out"
                                  style={{ backgroundColor: bg }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "var(--accent-soft)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = bg;
                                  }}
                                >
                                  <td
                                    className="px-6 py-4 font-medium"
                                    style={{ color: "var(--app-text)" }}
                                  >
                                    <div className="flex flex-col">
                                      {credit.memoNo}
                                      <span
                                        className="text-[10px] font-mono mt-0.5"
                                        style={{ color: "var(--app-muted)" }}
                                      >
                                        ID:{" "}
                                        {credit._id
                                          ? credit._id.slice(-6).toUpperCase()
                                          : "-"}
                                      </span>
                                    </div>
                                  </td>

                                  <td
                                    className="px-6 py-4"
                                    style={{ color: "var(--app-muted)" }}
                                  >
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

                                  <td
                                    className="px-6 py-4 text-center"
                                    style={{ color: "var(--app-muted)" }}
                                  >
                                    {formatDuration(credit.duration)}
                                  </td>

                                  <td className="px-6 py-4 text-center">
                                    <StatusBadge
                                      status={credit.employeeStatus}
                                    />
                                  </td>

                                  <td className="px-6 py-4 text-right">
                                    <button
                                      onClick={() => openMemo(credit)}
                                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 border text-sm font-bold transition-colors duration-200 ease-out"
                                      style={{
                                        backgroundColor: "var(--app-surface)",
                                        borderColor: borderColor,
                                        color: "var(--accent)",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor =
                                          "var(--accent-soft)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor =
                                          "var(--app-surface)";
                                      }}
                                      type="button"
                                    >
                                      <FileText className="w-4 h-4" />
                                      View Memo
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Pagination */}
            <CompactPagination
              page={page}
              totalPages={totalPages}
              total={total}
              startItem={startItem}
              endItem={endItem}
              onPrev={() => setPage((p) => Math.max(p - 1, 1))}
              onNext={() => setPage((p) => Math.min(p + 1, totalPages))}
              borderColor={borderColor}
            />
          </div>
        </div>

        {/* Back-to-top */}
        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            className="md:hidden fixed bottom-5 z-[1] h-10 w-10 rounded-full shadow-lg active:scale-95 transition-colors duration-200 ease-out flex items-center justify-center"
            style={{
              backgroundColor: "var(--accent, #2563EB)",
              color: "#fff",
            }}
            aria-label="Scroll to top"
            title="Back to top"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}

        {/* Memo Modal */}
        <Modal
          isOpen={memoModal.isOpen}
          onClose={() => setMemoModal({ isOpen: false, memo: null })}
          title="CTO Memo"
          closeLabel="Close"
          maxWidth="max-w-xl"
        >
          <CtoMemoModalContent memo={memoModal.memo} baseUrl={API_BASE_URL} />
        </Modal>
      </SkeletonTheme>
    </div>
  );
};

export default MyCtoCreditHistory;
