// ctoEmployeeCreditTable.jsx
import React, { useMemo, useState, useCallback, useEffect } from "react";
import Modal from "../../modal";
import { StatusBadge } from "../../statusUtils";
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
  Calendar,
} from "lucide-react";

/* =========================
   CONSTANTS
========================= */
const pageSizeOptions = [20, 50, 100];

/* =========================
   LAYOUT BY PANEL WIDTH
   `size` comes from the parent panel's measured width ("sm" | "md" | "lg"),
   so the table adapts when it only gets half the screen. Without it, fall
   back to the viewport breakpoints so the table still works full-width.
========================= */
const layoutClassesFor = (size) => {
  if (size === "lg")
    return {
      cards: "hidden",
      table: "table",
      toolbar: "flex-row items-center",
      search: "w-60",
    };
  if (size === "md")
    return {
      cards: "grid grid-cols-2",
      table: "hidden",
      toolbar: "flex-row items-center",
      search: "w-56",
    };
  if (size === "sm")
    return {
      cards: "grid grid-cols-1",
      table: "hidden",
      toolbar: "flex-col",
      search: "w-full",
    };
  return {
    cards: "lg:hidden grid grid-cols-1 md:grid-cols-2",
    table: "hidden lg:table",
    toolbar: "flex-col md:flex-row md:items-center",
    search: "w-full md:w-60",
  };
};
const BASE_URL = API_BASE_URL;

/* =========================
   INTERACTION TINTS
========================= */
// Solid hover / pressed shades derived from the surface color. They darken in
// light mode and lighten in dark mode (darkening an already-dark surface is
// almost invisible), so the "this is clickable" cue shows in both themes.
const interactionVarsFor = (theme) => {
  const isDark = theme === "dark";
  const ink = isDark ? "#ffffff" : "#0f172a";
  return {
    "--wl-hover": `color-mix(in srgb, var(--app-surface) ${isDark ? 88 : 91}%, ${ink})`,
    "--wl-press": `color-mix(in srgb, var(--app-surface) ${isDark ? 80 : 84}%, ${ink})`,
  };
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]";

// Outlined accent button (View Memo): pointer, darker on hover, darker still on press
const BTN_SECONDARY = `inline-flex items-center justify-center gap-1.5 rounded-md border text-xs font-bold whitespace-nowrap cursor-pointer transition-all duration-150 ease-out bg-[color:var(--app-surface)] text-[color:var(--accent)] hover:bg-[color:var(--wl-hover)] hover:shadow-sm active:bg-[color:var(--wl-press)] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[color:var(--app-surface)] disabled:hover:shadow-none disabled:active:scale-100 ${FOCUS_RING}`;

/* =========================
   ROW / CARD CLICK HELPERS
========================= */
// A click on a control inside a row or card must not also trigger the row.
const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, label, [data-no-row-click]";

const shouldOpenFromClick = (e) => {
  if (e.defaultPrevented) return false;
  const target = e.target;
  if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) {
    return false;
  }
  // Let people highlight/copy text (e.g. a memo number) without opening the memo
  const selection =
    typeof window !== "undefined" ? window.getSelection?.() : null;
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    return false;
  }
  return true;
};

const isActivationKey = (e) => e.key === "Enter" || e.key === " ";

/* =========================
   HOURS HELPERS
   The table shows the EMPLOYEE's own hours, not the memo's duration
   (memo duration = longest overtime rendered by anyone on that memo).
========================= */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmtHours = (h) => {
  const n = toNum(h);
  if (n === null) return "-";
  return `${Number(n.toFixed(2))}h`;
};

const durationToHours = (duration) => {
  if (!duration) return null;
  const hours = toNum(duration.hours) || 0;
  const minutes = toNum(duration.minutes) || 0;
  return hours + minutes / 60;
};

const getUsedHours = (c) => toNum(c?.usedHours) ?? 0;
const getReservedHours = (c) => toNum(c?.reservedHours) ?? 0;
const getRemainingHours = (c) => toNum(c?.remainingHours) ?? 0;

const getCreditedHours = (c) => {
  const direct =
    toNum(c?.creditedHours) ??
    toNum(c?.employeeCreditedHours) ??
    toNum(c?.employee?.creditedHours);
  if (direct !== null) return direct;

  // Fallback: rebuild from the employee's own used/reserved/remaining
  const rebuilt = getUsedHours(c) + getReservedHours(c) + getRemainingHours(c);
  if (rebuilt > 0) return rebuilt;

  // Last resort: memo duration
  return durationToHours(c?.duration) ?? 0;
};

const sameHours = (a, b) =>
  a !== null && b !== null && Math.abs(Number(a) - Number(b)) < 0.01;

const formatDuration = (duration) => {
  if (!duration) return "-";
  const { hours = 0, minutes = 0 } = duration;
  return `${hours}h ${minutes}m`;
};

const formatDate = (iso, month = "short") =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month,
        day: "numeric",
      })
    : "-";

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

const MiniStat = ({ label, value, sub, color, borderColor, first }) => (
  <div
    className="px-2 py-1.5 min-w-0 text-center"
    style={first ? undefined : { borderLeft: `1px solid ${borderColor}` }}
  >
    <div
      className="text-[9px] font-bold uppercase tracking-wider"
      style={{ color: "var(--app-muted)" }}
    >
      {label}
    </div>
    <div
      className="text-sm font-bold truncate"
      style={{ color: color || "var(--app-text)" }}
    >
      {value}
    </div>
    {sub && (
      <div
        className="text-[9px] truncate"
        style={{ color: "var(--app-muted)" }}
        title={sub}
      >
        {sub}
      </div>
    )}
  </div>
);

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

/* =========================
   PAGINATION (compact footer, includes rows selector)
========================= */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  limit,
  onLimitChange,
  label = "credits",
  disabled = false,
  borderColor,
}) => {
  const safeTotalPages = Math.max(totalPages || 1, 1);
  const hasTotal = typeof total === "number";
  const noResults = hasTotal ? total === 0 : false;

  const navBtn = (onClick, isDisabled, icon, aria) => (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-label={aria}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-md border cursor-pointer transition-colors duration-150 ease-out bg-[color:var(--app-surface)] text-[color:var(--app-text)] enabled:hover:bg-[color:var(--wl-hover)] enabled:active:bg-[color:var(--wl-press)] disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS_RING}`}
      style={{ borderColor }}
    >
      {icon}
    </button>
  );

  return (
    <div
      className="flex-none flex items-center justify-between gap-3 px-1 py-2 border-t transition-colors duration-300 ease-out"
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <label
          className="flex items-center gap-1.5 text-[11px] font-semibold flex-none"
          style={{ color: "var(--app-muted)" }}
        >
          <span className="hidden sm:inline">Rows</span>
          <select
            value={limit}
            disabled={disabled}
            onChange={(e) => onLimitChange?.(Number(e.target.value))}
            className={`h-8 border text-xs rounded-md px-1.5 font-semibold outline-none cursor-pointer transition-colors duration-150 ease-out bg-[color:var(--app-surface)] text-[color:var(--app-text)] enabled:hover:bg-[color:var(--wl-hover)] disabled:cursor-not-allowed ${FOCUS_RING}`}
            style={{ borderColor }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <span
          className="text-[11px] truncate"
          style={{ color: "var(--app-muted)" }}
        >
          {hasTotal ? (
            total === 0 ? (
              `0 ${label}`
            ) : (
              <>
                <span
                  className="font-bold"
                  style={{ color: "var(--app-text)" }}
                >
                  {startItem}-{endItem}
                </span>{" "}
                of{" "}
                <span
                  className="font-bold"
                  style={{ color: "var(--app-text)" }}
                >
                  {total}
                </span>{" "}
                <span className="hidden sm:inline">{label}</span>
              </>
            )
          ) : (
            `Page ${page} of ${safeTotalPages}`
          )}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-none">
        {navBtn(
          onPrev,
          disabled || page <= 1 || noResults,
          <ChevronLeft className="w-4 h-4" />,
          "Previous page",
        )}
        <span
          className="text-xs font-mono font-semibold px-1.5"
          style={{ color: "var(--app-muted)" }}
        >
          {page} / {safeTotalPages}
        </span>
        {navBtn(
          onNext,
          disabled || page >= safeTotalPages || noResults,
          <ChevronRight className="w-4 h-4" />,
          "Next page",
        )}
      </div>
    </div>
  );
};

/* =========================
   CARD (Mobile/Tablet) — compact
========================= */
const CreditCard = ({
  credit,
  onViewMemo,
  leftStripClassName,
  borderColor,
}) => {
  const hasMemo = Boolean(credit?.uploadedMemo);

  const creditedHours = getCreditedHours(credit);
  const usedHours = getUsedHours(credit);
  const reservedHours = getReservedHours(credit);
  const remainingHours = getRemainingHours(credit);
  const memoHours = durationToHours(credit?.duration);
  const showMemoDuration =
    memoHours !== null && !sameHours(memoHours, creditedHours);

  return (
    <div
      // Tapping the card opens its memo (only when there is one)
      tabIndex={hasMemo ? 0 : undefined}
      title={hasMemo ? "View memo" : undefined}
      onClick={(e) => {
        if (hasMemo && shouldOpenFromClick(e)) onViewMemo();
      }}
      onKeyDown={(e) => {
        if (!hasMemo || e.target !== e.currentTarget || !isActivationKey(e))
          return;
        e.preventDefault();
        onViewMemo();
      }}
      className={`rounded-xl shadow-sm overflow-hidden border-y border-r transition-[box-shadow,background-color] duration-200 ease-out ${FOCUS_RING} ${
        hasMemo ? "cursor-pointer hover:shadow-md" : ""
      } ${leftStripClassName}`}
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className="text-sm font-bold truncate"
              style={{ color: "var(--app-text)" }}
              title={credit?.memoNo || "-"}
            >
              {credit?.memoNo || "-"}
            </div>
            <div
              className="mt-0.5 flex items-center gap-1.5 text-[11px]"
              style={{ color: "var(--app-muted)" }}
            >
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(credit?.dateApproved)}
            </div>
          </div>
          <div className="flex-none">
            <StatusBadge status={credit?.employeeStatus} />
          </div>
        </div>

        <div
          className="mt-2.5 grid grid-cols-3 rounded-lg border"
          style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
        >
          <MiniStat
            first
            label="Credited"
            value={fmtHours(creditedHours)}
            sub={
              showMemoDuration
                ? `Memo ${formatDuration(credit?.duration)}`
                : null
            }
            borderColor={borderColor}
          />
          <MiniStat
            label="Used"
            value={fmtHours(usedHours)}
            sub={reservedHours > 0 ? `+${fmtHours(reservedHours)} rsv` : null}
            color={usedHours > 0 ? "#ef4444" : "var(--app-muted)"}
            borderColor={borderColor}
          />
          <MiniStat
            label="Balance"
            value={fmtHours(remainingHours)}
            color="var(--accent)"
            borderColor={borderColor}
          />
        </div>

        <button
          onClick={onViewMemo}
          disabled={!hasMemo}
          className={`${BTN_SECONDARY} mt-2.5 w-full h-8 rounded-lg`}
          style={{ borderColor }}
          type="button"
        >
          <FileText className="w-3.5 h-3.5" />
          {hasMemo ? "View Memo" : "No memo"}
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
  statusCounts,
  onSearchChange,
  onStatusChange,
  page = 1,
  limit = 20,
  onLimitChange,
  totalPages = 1,
  total,
  onNextPage,
  onPrevPage,
  isLoading,
  size,
}) => {
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);
  const L = layoutClassesFor(size);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  // CSS vars for hover / pressed shades
  const interactionVars = useMemo(
    () => interactionVarsFor(resolvedTheme),
    [resolvedTheme],
  );

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

  const tabs = useMemo(() => {
    const c = normalizedCounts;
    const allCount = (c.ACTIVE || 0) + (c.EXHAUSTED || 0) + (c.ROLLEDBACK || 0);
    return [
      { id: "", label: "All", count: allCount, tone: "all" },
      { id: "ACTIVE", label: "Active", count: c.ACTIVE || 0, tone: "green" },
      {
        id: "EXHAUSTED",
        label: "Exhausted",
        count: c.EXHAUSTED || 0,
        tone: "red",
      },
      {
        id: "ROLLEDBACK",
        label: "Rolled Back",
        count: c.ROLLEDBACK || 0,
        tone: "amber",
      },
      // Hide empty tabs (except "All" and the one currently selected)
    ].filter((t) => t.id === "" || t.count > 0 || t.id === status);
  }, [normalizedCounts, status]);

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

  const skeletonRows = Math.min(limit, 8);

  return (
    <SkeletonTheme
      baseColor={skeletonColors.baseColor}
      highlightColor={skeletonColors.highlightColor}
    >
      <div
        className="w-full h-full flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden transition-colors duration-300 ease-out"
        style={{
          ...interactionVars,
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text)",
        }}
      >
        {/* TOOLBAR (single compact row) */}
        <div
          className="flex-none border-b px-1 py-2 space-y-2 transition-colors duration-300 ease-out"
          style={{ backgroundColor: "var(--app-surface)", borderColor }}
        >
          <div className={`flex ${L.toolbar} gap-2`}>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
              {tabs.map((tab) => {
                const isActive = status === tab.id;
                const t = toneMap[tab.tone] || toneMap.all;
                return (
                  <button
                    key={tab.id || "all"}
                    onClick={() => onStatusChange?.(tab.id)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-full border transition-colors duration-150 ease-out whitespace-nowrap flex items-center gap-1.5 ${FOCUS_RING} ${
                      isActive
                        ? "cursor-default"
                        : "cursor-pointer bg-[color:var(--app-surface)] text-[color:var(--app-muted)] hover:bg-[color:var(--wl-hover)] hover:text-[color:var(--app-text)] active:bg-[color:var(--wl-press)]"
                    }`}
                    type="button"
                    aria-pressed={isActive}
                    style={
                      isActive
                        ? {
                            backgroundColor: t.bg,
                            color: t.text,
                            borderColor: t.br,
                          }
                        : { borderColor }
                    }
                  >
                    {tab.label}
                    <span
                      className="px-1.5 rounded-full text-[10px] font-bold"
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

            <div className={`relative ${L.search} flex-none`}>
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "var(--app-muted)" }}
              />
              <input
                type="text"
                placeholder="Search memo..."
                value={search}
                maxLength={100}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-full h-9 pl-9 pr-9 rounded-lg text-sm outline-none border transition-colors duration-200 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor,
                  color: "var(--app-text)",
                }}
              />
              {search && (
                <button
                  onClick={() => onSearchChange?.("")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md cursor-pointer transition-colors duration-150 ease-out hover:bg-[color:var(--wl-hover)] hover:text-[color:var(--app-text)] ${FOCUS_RING}`}
                  style={{ color: "var(--app-muted)" }}
                  aria-label="Clear search"
                  title="Clear"
                  type="button"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>

          {isFiltered && (
            <div className="flex items-center justify-between gap-3">
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
                className={`flex items-center gap-1 text-[10px] font-bold uppercase rounded cursor-pointer hover:underline hover:brightness-90 ${FOCUS_RING}`}
                style={{ color: "var(--accent)" }}
                type="button"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          )}
        </div>

        {/* CONTENT — the ONLY scroll area, fills all remaining height */}
        <div
          className="flex-1 min-h-0 overflow-auto cto-scrollbar"
          style={{ backgroundColor: "var(--app-bg)" }}
        >
          {!isLoading && credits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
              <div
                className="p-4 rounded-full mb-3 ring-1"
                style={{ backgroundColor: "var(--app-surface)", borderColor }}
              >
                <Inbox
                  className="w-8 h-8"
                  style={{ color: "var(--app-muted)", opacity: 0.6 }}
                />
              </div>
              <h3
                className="text-base font-bold"
                style={{ color: "var(--app-text)" }}
              >
                No CTO credits found
              </h3>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className={`mt-3 text-sm font-bold underline rounded cursor-pointer hover:brightness-90 ${FOCUS_RING}`}
                  style={{ color: "var(--accent)" }}
                  type="button"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile + Tablet: cards */}
              <div className={`${L.cards} p-3 gap-2.5`}>
                {isLoading
                  ? [...Array(Math.min(limit, 6))].map((_, i) => (
                      <div
                        key={`sk-c-${i}`}
                        className="rounded-xl p-3 border"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                        }}
                      >
                        <Skeleton height={16} />
                        <Skeleton height={10} width="40%" />
                        <div className="mt-2.5">
                          <Skeleton height={46} />
                        </div>
                        <div className="mt-2.5">
                          <Skeleton height={32} />
                        </div>
                      </div>
                    ))
                  : credits.map((c, i) => (
                      <CreditCard
                        key={c._id || `${c.memoNo}-${i}`}
                        credit={c}
                        leftStripClassName={getLeftStripClass(
                          c?.employeeStatus,
                        )}
                        onViewMemo={() => openMemoModal(c)}
                        borderColor={borderColor}
                      />
                    ))}
              </div>

              {/* Desktop: table */}
              <table className={`${L.table} w-full text-left table-fixed`}>
                <colgroup>
                  <col style={{ width: "40%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                </colgroup>
                <thead
                  className="sticky top-0 z-10"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    boxShadow: `inset 0 -1px 0 ${borderColor}`,
                  }}
                >
                  <tr
                    className="text-[10px] uppercase tracking-[0.12em] font-bold"
                    style={{ color: "var(--app-muted)" }}
                  >
                    <th className="px-4 py-2.5">Memo / Date Credited</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-center">Credited</th>
                    <th className="px-4 py-2.5 text-center">Used</th>
                    <th className="px-4 py-2.5 text-center">Balance</th>
                    <th className="px-4 py-2.5 text-right">Memo</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading
                    ? [...Array(skeletonRows)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(6)].map((__, j) => (
                            <td key={j} className="px-4 py-3">
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

                        const hasMemo = Boolean(c.uploadedMemo);
                        const creditedHours = getCreditedHours(c);
                        const usedHours = getUsedHours(c);
                        const reservedHours = getReservedHours(c);
                        const remainingHours = getRemainingHours(c);
                        const memoHours = durationToHours(c?.duration);
                        const showMemoDuration =
                          memoHours !== null &&
                          !sameHours(memoHours, creditedHours);

                        return (
                          <tr
                            key={c._id || `${c.memoNo}-${i}`}
                            // Clicking the row opens its memo (only when there is one)
                            tabIndex={hasMemo ? 0 : undefined}
                            title={hasMemo ? "View memo" : undefined}
                            onClick={(e) => {
                              if (hasMemo && shouldOpenFromClick(e))
                                openMemoModal(c);
                            }}
                            onKeyDown={(e) => {
                              if (
                                !hasMemo ||
                                e.target !== e.currentTarget ||
                                !isActivationKey(e)
                              )
                                return;
                              e.preventDefault();
                              openMemoModal(c);
                            }}
                            className={`transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)] ${
                              hasMemo ? "cursor-pointer" : ""
                            }`}
                            style={{
                              backgroundColor: bg,
                              boxShadow: `inset 0 -1px 0 ${borderColor}`,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--accent-soft)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = bg;
                            }}
                          >
                            <td className="px-4 py-2.5">
                              <div
                                className="text-sm font-semibold truncate"
                                style={{ color: "var(--app-text)" }}
                                title={c.memoNo || "-"}
                              >
                                {c.memoNo || "-"}
                              </div>
                              <div
                                className="mt-0.5 flex items-center gap-1 text-[11px]"
                                style={{ color: "var(--app-muted)" }}
                              >
                                <Calendar size={12} />
                                {formatDate(c.dateApproved, "long")}
                              </div>
                            </td>

                            <td className="px-4 py-2.5 text-center">
                              <StatusBadge status={c.employeeStatus} />
                            </td>

                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                              <div
                                className="text-sm font-semibold"
                                style={{ color: "var(--app-text)" }}
                              >
                                {fmtHours(creditedHours)}
                              </div>
                              {showMemoDuration && (
                                <div
                                  className="text-[10px]"
                                  style={{ color: "var(--app-muted)" }}
                                  title="Longest overtime rendered on this memo"
                                >
                                  Memo {formatDuration(c.duration)}
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                              <div
                                className="text-sm font-semibold"
                                style={{
                                  color:
                                    usedHours > 0
                                      ? "#ef4444"
                                      : "var(--app-muted)",
                                }}
                              >
                                {fmtHours(usedHours)}
                              </div>
                              {reservedHours > 0 && (
                                <div
                                  className="text-[10px]"
                                  style={{ color: "#d97706" }}
                                >
                                  +{fmtHours(reservedHours)} reserved
                                </div>
                              )}
                            </td>

                            <td
                              className="px-4 py-2.5 text-center text-sm font-bold whitespace-nowrap"
                              style={{ color: "var(--accent)" }}
                            >
                              {fmtHours(remainingHours)}
                            </td>

                            {/* Clicks around the button shouldn't double-trigger */}
                            <td
                              data-no-row-click
                              className="px-4 py-2.5 text-right cursor-default"
                            >
                              {hasMemo ? (
                                <button
                                  className={`${BTN_SECONDARY} h-8 px-2.5`}
                                  style={{ borderColor }}
                                  onClick={() => openMemoModal(c)}
                                  type="button"
                                  title="View memo"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  View
                                </button>
                              ) : (
                                <span
                                  className="text-xs"
                                  style={{ color: "var(--app-muted)" }}
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
          limit={limit}
          onLimitChange={onLimitChange}
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
