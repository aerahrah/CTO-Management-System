// ctoEmployeeCreditTable.jsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import Modal from "../../modal";
import { StatusBadge } from "../../statusUtils";
import FilterSelect from "../../filterSelect";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import CtoMemoModalContent from "../ctoCreditComponents/CtoMemoModalContent";
import { API_BASE_URL } from "../../../config/env";
import { useAuth } from "../../../store/authStore";
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

/* ------------------ Resolve theme (no tailwind dark class dependency) ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ✅ Reactive resolved theme for system mode (prevents skeleton flashes) */
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

/* =========================
   SMALL UI
========================= */
const Chip = ({ children }) => (
  <span
    className="px-2 py-0.5 rounded border text-[10px] font-semibold"
    style={{
      backgroundColor: "var(--accent-soft)",
      color: "var(--accent)",
      borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
    }}
  >
    {children}
  </span>
);

/* =========================
   COMPACT PAGINATION (theme-aware)
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
  borderColor,
}) => {
  const safeTotalPages = Math.max(totalPages || 1, 1);
  const hasTotal = typeof total === "number";
  const noResults = hasTotal ? total === 0 : safeTotalPages <= 1;

  return (
    <div
      className="px-4 md:px-6 pt-3 border-t transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      {/* Mobile/tablet */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={disabled || page === 1 || noResults}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
            color: "var(--app-text)",
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
          disabled={disabled || page >= safeTotalPages || noResults}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
            color: "var(--app-text)",
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
            disabled={disabled || page === 1 || noResults}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            aria-label="Previous page"
            type="button"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
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
            disabled={disabled || page >= safeTotalPages || noResults}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            aria-label="Next page"
            type="button"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   CARD (Mobile/Tablet) — theme-aware
========================= */
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

  const hasMemo = Boolean(credit?.uploadedMemo);

  return (
    <div
      className={`rounded-xl shadow-sm overflow-hidden border-y border-r transition-colors duration-300 ease-out ${leftStripClassName}`}
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
          disabled={!hasMemo}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
            color: "var(--accent)",
          }}
          onMouseEnter={(e) => {
            if (e.currentTarget.disabled) return;
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
  // ✅ Theme-aware primitives
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColors = useMemo(() => {
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

  const toneMap = {
    all: {
      bg: "var(--accent-soft)",
      text: "var(--accent)",
      br: "var(--accent-soft2, rgba(37,99,235,0.18))",
    },
    green: {
      bg: "rgba(34,197,94,0.14)",
      text: "#16a34a",
      br: "rgba(34,197,94,0.22)",
    },
    red: {
      bg: "rgba(239,68,68,0.14)",
      text: "#ef4444",
      br: "rgba(239,68,68,0.22)",
    },
    amber: {
      bg: "rgba(245,158,11,0.16)",
      text: "#d97706",
      br: "rgba(245,158,11,0.26)",
    },
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
        tone: "all",
      },
      {
        id: "ACTIVE",
        label: "Active",
        icon: CheckCircle2,
        count: counts.ACTIVE || 0,
        tone: "green",
      },
      {
        id: "EXHAUSTED",
        label: "Exhausted",
        icon: AlertCircle,
        count: counts.EXHAUSTED || 0,
        tone: "red",
      },
      {
        id: "ROLLEDBACK",
        label: "Rolled Back",
        icon: RotateCcw,
        count: counts.ROLLEDBACK || 0,
        tone: "amber",
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
    <SkeletonTheme
      baseColor={skeletonColors.baseColor}
      highlightColor={skeletonColors.highlightColor}
    >
      <div
        className="w-full h-full flex flex-col min-h-0 min-w-0 overflow-hidden transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text)",
        }}
      >
        {/* Toolbar */}
        <div
          className="border-b space-y-3 py-2 transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* ✅ Status tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1">
              {tabs.map((tab) => {
                const isActive = status === tab.id;
                const t = toneMap[tab.tone] || toneMap.all;

                return (
                  <button
                    key={tab.id || "all"}
                    onClick={() => onStatusChange?.(tab.id)}
                    className="px-3 py-1.5 text-xs font-bold rounded-full border transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-2"
                    type="button"
                    aria-pressed={isActive}
                    style={{
                      backgroundColor: isActive ? t.bg : "var(--app-surface)",
                      color: isActive ? t.text : "var(--app-muted)",
                      borderColor: isActive ? t.br : borderColor,
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
                  >
                    <span>{tab.label}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ease-out"
                      style={{
                        backgroundColor: isActive
                          ? "var(--app-surface)"
                          : "var(--app-surface-2)",
                        color: isActive
                          ? "var(--app-text)"
                          : "var(--app-muted)",
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search + rows */}
            <div className="flex items-center gap-3 w-full lg:w-auto min-w-0 px-1">
              <div className="relative flex-1 lg:w-56 min-w-0">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--app-muted)" }}
                />
                <input
                  type="text"
                  placeholder="Search memo..."
                  value={search}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="w-full py-2 pl-9 pr-9 rounded-lg text-sm outline-none border transition-colors duration-200 ease-out"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: borderColor,
                    color: "var(--app-text)",
                  }}
                />
                {search && (
                  <button
                    onClick={() => onSearchChange?.("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors duration-200 ease-out"
                    style={{ color: "var(--app-muted)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--app-surface-2)";
                      e.currentTarget.style.color = "var(--app-text)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--app-muted)";
                    }}
                    aria-label="Clear search"
                    title="Clear"
                    type="button"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>

              {/* Rows (desktop) */}
              <div
                className="hidden md:flex items-center gap-2 pl-3 border-l"
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
                  onChange={(e) => onLimitChange?.(Number(e.target.value))}
                  className="border text-xs rounded-lg block p-1.5 font-semibold outline-none cursor-pointer transition-colors duration-200 ease-out"
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

              {/* Rows (mobile) */}
              <div
                className="md:hidden flex items-center gap-1.5 px-2 border-l ml-1"
                style={{ borderColor: borderColor }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--app-muted)" }}
                >
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
            <div className="flex px-2 items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span
                  className="text-[10px] font-bold uppercase"
                  style={{ color: "var(--app-muted)" }}
                >
                  Active:
                </span>
                {search && <Chip>“{search}”</Chip>}
                {status && <Chip>{status}</Chip>}
              </div>
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-[10px] font-bold uppercase transition-colors duration-200 ease-out"
                style={{ color: "var(--accent)" }}
                type="button"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div
          className="flex-1 min-h-0"
          style={{ backgroundColor: "var(--app-bg)" }}
        >
          {/* Empty */}
          {!isLoading && credits.length === 0 ? (
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
                  style={{ color: "var(--app-muted)", opacity: 0.6 }}
                />
              </div>
              <h3
                className="text-lg font-bold"
                style={{ color: "var(--app-text)" }}
              >
                No CTO credits found
              </h3>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="mt-6 text-sm font-bold underline transition-colors duration-200 ease-out"
                  style={{ color: "var(--accent)" }}
                  type="button"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* ✅ Mobile: cards */}
              <div className="block md:hidden p-4">
                <div className="space-y-3">
                  {isLoading
                    ? [...Array(Math.min(limit, 6))].map((_, i) => (
                        <div
                          key={`sk-m-${i}`}
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
                    : credits.map((c, i) => (
                        <CreditCard
                          key={c._id || `${c.memoNo}-${i}`}
                          credit={c}
                          formatDuration={formatDuration}
                          leftStripClassName={getLeftStripClass(
                            c?.employeeStatus,
                          )}
                          onViewMemo={() => openMemoModal(c)}
                          borderColor={borderColor}
                        />
                      ))}
                </div>
              </div>

              {/* ✅ Tablet: 2 cards per row */}
              <div className="hidden md:block lg:hidden p-4">
                <div className="grid grid-cols-2 gap-3">
                  {isLoading
                    ? [...Array(Math.min(limit, 6))].map((_, i) => (
                        <div
                          key={`sk-t-${i}`}
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
                    : credits.map((c, i) => (
                        <CreditCard
                          key={c._id || `${c.memoNo}-${i}`}
                          credit={c}
                          formatDuration={formatDuration}
                          leftStripClassName={getLeftStripClass(
                            c?.employeeStatus,
                          )}
                          onViewMemo={() => openMemoModal(c)}
                          borderColor={borderColor}
                        />
                      ))}
                </div>
              </div>

              {/* ✅ Desktop: table */}
              <div className="hidden lg:block h-full overflow-auto cto-scrollbar">
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
                      <th className="px-4 md:px-6 py-4">Memo No.</th>
                      <th className="px-4 md:px-6 py-4">Date Credited</th>
                      <th className="px-4 md:px-6 py-4 text-center">Status</th>
                      <th className="px-4 md:px-6 py-4 text-center">
                        Duration
                      </th>
                      <th className="px-4 md:px-6 py-4 text-right">
                        Memo File
                      </th>
                    </tr>
                  </thead>

                  <tbody>
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
                      : credits.map((c, i) => {
                          const bg =
                            i % 2 === 0
                              ? "var(--app-surface)"
                              : "var(--app-surface-2)";
                          return (
                            <tr
                              key={c._id || `${c.memoNo}-${i}`}
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
                                className="px-4 md:px-6 py-4 font-semibold"
                                style={{ color: "var(--app-text)" }}
                              >
                                {c.memoNo || "-"}
                              </td>

                              <td
                                className="px-4 md:px-6 py-4"
                                style={{ color: "var(--app-muted)" }}
                              >
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

                              <td
                                className="px-4 md:px-6 py-4 text-center font-semibold"
                                style={{ color: "var(--app-text)" }}
                              >
                                {formatDuration(c.duration)}
                              </td>

                              <td className="px-4 md:px-6 py-4 text-right">
                                {c.uploadedMemo ? (
                                  <button
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
                                    onClick={() => openMemoModal(c)}
                                    type="button"
                                  >
                                    <FileText className="w-4 h-4" />
                                    View Memo
                                  </button>
                                ) : (
                                  <span
                                    style={{ color: "var(--app-muted)" }}
                                    className="text-sm"
                                  >
                                    No memo
                                  </span>
                                )}
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
          borderColor={borderColor}
        />

        {/* Memo Modal */}
        <Modal
          isOpen={memoModal.isOpen}
          onClose={closeMemoModal}
          title="Memo Details"
          closeLabel="Close"
        >
          <div className="max-h-[520px] overflow-y-auto cto-scrollbar">
            {memoModal.memos.length === 0 ? (
              <p
                className="text-sm text-center py-10"
                style={{ color: "var(--app-muted)" }}
              >
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
    </SkeletonTheme>
  );
};

export default CreditCtoTable;
