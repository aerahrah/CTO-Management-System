import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import FullHeightCardContainer from "../../pageContainer";
import { fetchMyCreditRequests } from "../../../api/cto";
import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import CtoMemoModalContent from "./CtoMemoModalContent";
import Breadcrumbs from "../../breadCrumbs";
import ThemeSync from "../../themeSync";
import ScrollbarsSync from "../../scrollbarSync";
import FilterSelect from "../../filterSelect";
import { API_BASE_URL } from "../../../config/env";
import { useAuth } from "../../../store/authStore";

import {
  Search,
  X,
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
  Clock,
  ArrowUp,
} from "lucide-react";

const pageSizeOptions = [20, 50, 100];

/* ------------------ Status + tone config ------------------ */
const STATUS_ORDER = ["ACTIVE", "EXHAUSTED", "ROLLEDBACK"];

const STATUS_META = {
  ACTIVE: {
    label: "Active",
    icon: CheckCircle2,
    tone: "success",
    strip: "border-l-emerald-500",
  },
  EXHAUSTED: {
    label: "Exhausted",
    icon: AlertCircle,
    tone: "warning",
    strip: "border-l-amber-500",
  },
  ROLLEDBACK: {
    label: "Rolled Back",
    icon: RotateCcw,
    tone: "danger",
    strip: "border-l-rose-500",
  },
};

const TONE_PALETTE = {
  light: {
    success: {
      fg: "#15803d",
      bg: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.28)",
    },
    danger: {
      fg: "#b91c1c",
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.28)",
    },
    warning: {
      fg: "#b45309",
      bg: "rgba(245,158,11,0.14)",
      border: "rgba(245,158,11,0.32)",
    },
  },
  dark: {
    success: {
      fg: "#4ade80",
      bg: "rgba(34,197,94,0.14)",
      border: "rgba(34,197,94,0.28)",
    },
    danger: {
      fg: "#f87171",
      bg: "rgba(239,68,68,0.14)",
      border: "rgba(239,68,68,0.28)",
    },
    warning: {
      fg: "#fbbf24",
      bg: "rgba(245,158,11,0.14)",
      border: "rgba(245,158,11,0.30)",
    },
  },
};

const buildTones = (theme, borderColor) => ({
  ...TONE_PALETTE[theme],
  accent: {
    fg: "var(--accent)",
    bg: "var(--accent-soft)",
    border: "var(--accent-soft2)",
  },
  neutral: {
    fg: "var(--app-muted)",
    bg: "var(--app-surface-2)",
    border: borderColor,
  },
});

const EMPTY_COUNTS = { ACTIVE: 0, EXHAUSTED: 0, ROLLEDBACK: 0 };
const EMPTY_TOTALS = {
  totalUsedHours: 0,
  totalReservedHours: 0,
  totalRemainingHours: 0,
  totalCreditedHours: 0,
};

/* ------------------ Shared class tokens ------------------ */
// Kills every transition/animation on this page, including ones coming from
// global CSS or child components (FilterSelect, StatusBadge, Breadcrumbs, etc.)
const NO_MOTION =
  "!transition-none !animate-none [&_*]:!transition-none [&_*]:!animate-none";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]";

const BTN_SECONDARY = `inline-flex items-center justify-center gap-2 rounded-lg border font-bold bg-[color:var(--app-surface)] text-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS_RING}`;

/* ------------------ Formatters ------------------ */
const formatDuration = (d) => (d ? `${d.hours || 0}h ${d.minutes || 0}m` : "-");

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

const fmtHours = (h) => {
  const n = Number(h || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const shortId = (id) => (id ? String(id).slice(-6).toUpperCase() : "-");

/* ------------------ Theme (reacts to OS changes in "system" mode) ------------------ */
const getSystemDark = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false);

function useResolvedTheme(prefTheme) {
  const [systemDark, setSystemDark] = useState(getSystemDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  if (prefTheme === "system") return systemDark ? "dark" : "light";
  return prefTheme === "dark" ? "dark" : "light";
}

/* ------------------ Stat card (header) ------------------ */
const StatCard = ({
  title,
  value,
  hint,
  icon: Icon,
  tone,
  borderColor,
  loading,
}) => (
  <div
    className="w-full h-full rounded-xl shadow-sm p-3.5 flex items-start gap-3 border"
    style={{ backgroundColor: "var(--app-surface)", borderColor }}
  >
    <div
      className="h-10 w-10 rounded-lg flex items-center justify-center flex-none border"
      style={{
        backgroundColor: tone.bg,
        borderColor: tone.border,
        color: tone.fg,
      }}
    >
      <Icon className="w-5 h-5" />
    </div>

    <div className="flex-1 min-w-0">
      <div
        className="text-[10px] font-bold uppercase tracking-wider truncate"
        style={{ color: "var(--app-muted)" }}
      >
        {title}
      </div>
      <div
        className="mt-0.5 text-lg font-bold tracking-tight truncate"
        style={{ color: "var(--app-text)" }}
      >
        {loading ? <Skeleton width={56} /> : value}
      </div>
      {hint && (
        <div
          className="text-[11px] truncate"
          style={{ color: "var(--app-muted)" }}
        >
          {hint}
        </div>
      )}
    </div>
  </div>
);

/* ------------------ Small building blocks ------------------ */
const MetricBadge = ({ icon: Icon, children, borderColor }) => (
  <span
    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-xs font-bold"
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor,
      color: "var(--app-text)",
    }}
  >
    <Icon size={12} style={{ color: "var(--app-muted)" }} />
    {children}
  </span>
);

const StatTile = ({ icon: Icon, label, value, borderColor }) => (
  <div
    className="rounded-lg border p-2"
    style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
  >
    <div
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: "var(--app-muted)" }}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </div>
    <div
      className="mt-1 text-sm font-semibold"
      style={{ color: "var(--app-text)" }}
    >
      {value}
    </div>
  </div>
);

const FilterChip = ({ children }) => (
  <span
    className="px-2 py-0.5 rounded-full border text-[10px] font-medium max-w-[200px] truncate"
    style={{
      backgroundColor: "var(--accent-soft)",
      color: "var(--accent)",
      borderColor: "var(--accent-soft2)",
    }}
  >
    {children}
  </span>
);

const CenteredState = ({
  icon: Icon,
  iconColor,
  title,
  description,
  action,
  borderColor,
}) => (
  <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
    <div
      className="p-6 rounded-full mb-4"
      style={{
        backgroundColor: "var(--app-surface)",
        boxShadow: `0 0 0 1px ${borderColor}`,
      }}
    >
      <Icon
        className="w-10 h-10"
        style={{ color: iconColor || "var(--app-muted)" }}
      />
    </div>
    <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
      {title}
    </h3>
    {description && (
      <p
        className="text-sm mt-1 max-w-md"
        style={{ color: "var(--app-muted)" }}
      >
        {description}
      </p>
    )}
    {action}
  </div>
);

/* ------------------ Mobile/Tablet card ------------------ */
const CreditCard = ({ credit, onViewMemo, borderColor }) => {
  const meta = STATUS_META[credit?.employeeStatus];

  return (
    <div
      className={`rounded-xl shadow-sm overflow-hidden border-y border-r border-l-4 ${
        meta?.strip || "border-l-slate-300"
      }`}
      style={{
        backgroundColor: "var(--app-surface)",
        borderTopColor: borderColor,
        borderRightColor: borderColor,
        borderBottomColor: borderColor,
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="text-sm font-bold truncate"
                style={{ color: "var(--app-text)" }}
                title={credit?.memoNo || "-"}
              >
                {credit?.memoNo || "-"}
              </span>
              <span
                className="text-[10px] font-mono flex-none"
                style={{ color: "var(--app-muted)" }}
              >
                #{shortId(credit?._id)}
              </span>
            </div>

            <div
              className="mt-2 flex items-center gap-2 text-xs"
              style={{ color: "var(--app-muted)" }}
            >
              <Calendar className="w-4 h-4 flex-none" />
              <span className="truncate">
                {formatDate(credit?.dateApproved)}
              </span>
            </div>
          </div>

          <div className="flex-none">
            <StatusBadge status={credit?.employeeStatus} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatTile
            icon={Clock}
            label="Duration"
            value={formatDuration(credit?.duration)}
            borderColor={borderColor}
          />
          <StatTile
            icon={Layers}
            label="Remaining"
            value={`${fmtHours(credit?.remainingHours)}h`}
            borderColor={borderColor}
          />
        </div>
      </div>

      <div
        className="border-t p-3"
        style={{ borderColor, backgroundColor: "var(--app-surface)" }}
      >
        <button
          type="button"
          onClick={onViewMemo}
          className={`${BTN_SECONDARY} w-full px-3 py-2 text-sm`}
          style={{ borderColor }}
        >
          <FileText className="w-4 h-4" />
          View Memo
        </button>
      </div>
    </div>
  );
};

const CardSkeleton = ({ borderColor }) => (
  <div
    className="rounded-xl shadow-sm p-4 border"
    style={{ backgroundColor: "var(--app-surface)", borderColor }}
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
);

/* ------------------ Compact pagination ------------------ */
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
  const prevDisabled = page <= 1 || total === 0;
  const nextDisabled = page >= totalPages || total === 0;

  const mobileBtn = `inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold bg-[color:var(--app-surface)] text-[color:var(--app-text)] enabled:hover:bg-[color:var(--app-surface-2)] disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS_RING}`;

  const iconBtn = `p-1.5 rounded-md text-[color:var(--app-muted)] enabled:hover:bg-[color:var(--app-surface)] enabled:hover:text-[color:var(--app-text)] disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS_RING}`;

  return (
    <div
      className="px-4 md:px-6 py-3 border-t"
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      {/* Mobile */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={prevDisabled}
          className={mobileBtn}
          style={{ borderColor }}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="text-center min-w-0">
          <div
            className="text-xs font-mono font-semibold"
            style={{ color: "var(--app-text)" }}
          >
            {page} / {totalPages}
          </div>
          <div
            className="text-[11px] truncate"
            style={{ color: "var(--app-muted)" }}
          >
            {total === 0 ? "0 results" : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className={mobileBtn}
          style={{ borderColor }}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tablet / Desktop */}
      <div className="hidden md:flex items-center justify-between gap-4">
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
          className="flex items-center gap-1 p-1 rounded-lg border"
          style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
        >
          <button
            type="button"
            onClick={onPrev}
            disabled={prevDisabled}
            className={iconBtn}
            aria-label="Previous page"
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
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={iconBtn}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------ Page ------------------ */
const MyCtoCreditHistory = () => {
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);
  const isDark = resolvedTheme === "dark";

  const borderColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.10)";

  const skeletonColors = isDark
    ? {
        baseColor: "rgba(255,255,255,0.06)",
        highlightColor: "rgba(255,255,255,0.10)",
      }
    : {
        baseColor: "rgba(15,23,42,0.06)",
        highlightColor: "rgba(15,23,42,0.10)",
      };

  const tones = useMemo(
    () => buildTones(resolvedTheme, borderColor),
    [resolvedTheme, borderColor],
  );

  /* ---------- filters / pagination / modal state ---------- */
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });

  // Debounce search; reset page only when the applied search actually changes
  useEffect(() => {
    const next = searchInput.trim();
    if (next === searchFilter) return;
    const t = setTimeout(() => {
      setSearchFilter(next);
      setPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput, searchFilter]);

  /* ---------- mobile scroll-to-top ---------- */
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
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  /* ---------- data ---------- */
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["myCredits", page, limit, statusFilter, searchFilter],
    queryFn: () =>
      fetchMyCreditRequests({
        page,
        limit,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const credits = useMemo(() => data?.credits || [], [data]);
  const total = data?.total || 0;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(page * limit, total);

  useEffect(() => {
    setPage((current) => {
      if (current > totalPages) return totalPages;
      if (current < 1) return 1;
      return current;
    });
  }, [totalPages]);

  const statusCounts = useMemo(
    () => data?.statusCounts || EMPTY_COUNTS,
    [data],
  );
  const totals = useMemo(() => data?.totals || EMPTY_TOTALS, [data]);

  const totalMemos = useMemo(
    () => STATUS_ORDER.reduce((sum, key) => sum + (statusCounts[key] || 0), 0),
    [statusCounts],
  );

  const statusTabs = useMemo(
    () => [
      {
        id: "",
        label: "All Credits",
        icon: Layers,
        count: totalMemos,
        tone: tones.accent,
      },
      ...STATUS_ORDER.map((key) => ({
        id: key,
        label: STATUS_META[key].label,
        icon: STATUS_META[key].icon,
        count: statusCounts[key] || 0,
        tone: tones[STATUS_META[key].tone],
      })),
    ],
    [statusCounts, tones, totalMemos],
  );

  /* ---------- handlers ---------- */
  const selectStatus = useCallback((id) => {
    setStatusFilter(id);
    setPage(1);
  }, []);

  const changeLimit = useCallback((value) => {
    setLimit(Number(value));
    setPage(1);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    if (searchFilter) {
      setSearchFilter("");
      setPage(1);
    }
  }, [searchFilter]);

  const handleResetFilters = useCallback(() => {
    setSearchInput("");
    setSearchFilter("");
    setStatusFilter("");
    setPage(1);
  }, []);

  const openMemo = useCallback((credit) => {
    setMemoModal({ isOpen: true, memo: credit });
  }, []);

  const closeMemo = useCallback(() => {
    setMemoModal({ isOpen: false, memo: null });
  }, []);

  const isFiltered = statusFilter !== "" || searchFilter !== "";

  return (
    <FullHeightCardContainer>
      <div
        className={`w-full h-full min-h-0 flex flex-col md:p-0 ${NO_MOTION}`}
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
          enableAnimation={false}
        >
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain md:contents cto-scrollbar"
          >
            {/* ---------- Page header ---------- */}
            <div className="pt-2 pb-3 md:pb-6 px-1">
              <div className="flex flex-col 2xl:flex-row 2xl:items-end justify-between gap-4">
                <div className="min-w-0">
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-stretch w-full 2xl:w-[46rem] 2xl:flex-none">
                  <StatCard
                    title="Total Credited"
                    value={`${fmtHours(totals.totalCreditedHours)}h`}
                    hint={`${totalMemos} memo${totalMemos !== 1 ? "s" : ""}`}
                    icon={CheckCircle2}
                    tone={tones.success}
                    borderColor={borderColor}
                    loading={isLoading}
                  />
                  <StatCard
                    title="Used Hours"
                    value={`${fmtHours(totals.totalUsedHours)}h`}
                    hint="Total used"
                    icon={Clock}
                    tone={tones.danger}
                    borderColor={borderColor}
                    loading={isLoading}
                  />
                  <StatCard
                    title="Reserved"
                    value={`${fmtHours(totals.totalReservedHours)}h`}
                    hint="Reserved in applications"
                    icon={Archive}
                    tone={tones.warning}
                    borderColor={borderColor}
                    loading={isLoading}
                  />
                  <StatCard
                    title="Balance"
                    value={`${fmtHours(totals.totalRemainingHours)}h`}
                    hint="Remaining hours"
                    icon={Layers}
                    tone={tones.accent}
                    borderColor={borderColor}
                    loading={isLoading}
                  />
                </div>
              </div>
            </div>

            {/* ---------- Main panel ---------- */}
            <div
              className="flex flex-col rounded-xl shadow-sm overflow-visible md:flex-1 md:min-h-0 md:overflow-hidden border"
              style={{ backgroundColor: "var(--app-surface)", borderColor }}
            >
              {/* Toolbar */}
              <div
                className="p-4 border-b space-y-4 sticky top-0 z-[1] md:static md:z-auto"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  borderColor,
                }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Status tabs */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar p-0.5 -m-0.5">
                    {statusTabs.map((tab) => {
                      const isActive = statusFilter === tab.id;
                      const Icon = tab.icon;

                      return (
                        <button
                          type="button"
                          key={tab.id || "all"}
                          onClick={() => selectStatus(tab.id)}
                          aria-pressed={isActive}
                          className={`px-4 py-1.5 text-xs font-bold rounded-full border whitespace-nowrap flex items-center gap-2 ${FOCUS_RING} ${
                            isActive
                              ? ""
                              : "bg-[color:var(--app-surface)] text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)] hover:text-[color:var(--app-text)]"
                          }`}
                          style={
                            isActive
                              ? {
                                  backgroundColor: tab.tone.bg,
                                  color: tab.tone.fg,
                                  borderColor: tab.tone.border,
                                }
                              : { borderColor }
                          }
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                          <span
                            className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={
                              isActive
                                ? {
                                    backgroundColor: "var(--app-surface)",
                                    color: "var(--app-text)",
                                  }
                                : {
                                    backgroundColor: "var(--app-surface-2)",
                                    color: "var(--app-muted)",
                                  }
                            }
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search + page size */}
                  <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                        style={{ color: "var(--app-muted)" }}
                      />
                      <input
                        type="text"
                        placeholder="Search memo..."
                        aria-label="Search memo"
                        maxLength={100}
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 rounded-lg text-sm border outline-none bg-[color:var(--app-surface)] text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] focus:ring-2 focus:ring-[color:var(--accent-soft2)]"
                        style={{ borderColor }}
                      />
                      {searchInput && (
                        <button
                          type="button"
                          onClick={clearSearch}
                          aria-label="Clear search"
                          title="Clear"
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[color:var(--app-muted)] hover:text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-2)] ${FOCUS_RING}`}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div
                      className="hidden lg:flex items-center gap-2 pl-3 border-l"
                      style={{ borderColor }}
                    >
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Show
                      </span>
                      <select
                        value={limit}
                        onChange={(e) => changeLimit(e.target.value)}
                        aria-label="Rows per page"
                        className={`border text-xs rounded-lg block p-1.5 font-medium cursor-pointer bg-[color:var(--app-surface)] text-[color:var(--app-text)] ${FOCUS_RING}`}
                        style={{ borderColor }}
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
                      style={{ borderColor }}
                    >
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Show
                      </span>
                      <FilterSelect
                        label=""
                        value={limit}
                        onChange={(v) => changeLimit(v)}
                        options={pageSizeOptions}
                        className="!mb-0 w-20 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Active filters */}
                {isFiltered && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Active:
                      </span>
                      {searchFilter && (
                        <FilterChip>{`"${searchFilter}"`}</FilterChip>
                      )}
                      {statusFilter && (
                        <FilterChip>
                          {STATUS_META[statusFilter]?.label || statusFilter}
                        </FilterChip>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className={`flex items-center gap-1 text-[10px] font-bold uppercase rounded text-[color:var(--accent)] hover:underline ${FOCUS_RING}`}
                    >
                      <RotateCcw size={10} /> Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Content well */}
              <div
                className="min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-y-auto cto-scrollbar"
                style={{ backgroundColor: "var(--app-bg)" }}
                aria-busy={isFetching}
              >
                {isError ? (
                  <CenteredState
                    icon={AlertCircle}
                    iconColor={tones.danger.fg}
                    title="Couldn’t load your credit history"
                    description={
                      error?.response?.data?.message ||
                      error?.message ||
                      "Please try again."
                    }
                    borderColor={borderColor}
                    action={
                      <button
                        type="button"
                        onClick={() => refetch()}
                        className={`${BTN_SECONDARY} mt-6 px-4 py-2 text-sm`}
                        style={{ borderColor }}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Retry
                      </button>
                    }
                  />
                ) : !isLoading && credits.length === 0 ? (
                  <CenteredState
                    icon={Inbox}
                    title="No Credit History Found"
                    description={
                      isFiltered
                        ? "Try a different memo number or status."
                        : "CTO credits issued to you will appear here."
                    }
                    borderColor={borderColor}
                    action={
                      isFiltered && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className={`mt-6 text-sm font-bold underline rounded text-[color:var(--accent)] ${FOCUS_RING}`}
                        >
                          Clear all filters
                        </button>
                      )
                    }
                  />
                ) : (
                  <div>
                    {/* Mobile / Tablet cards */}
                    <div className="block lg:hidden p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {isLoading
                          ? [...Array(Math.min(limit, 6))].map((_, i) => (
                              <CardSkeleton
                                key={`sk-${i}`}
                                borderColor={borderColor}
                              />
                            ))
                          : credits.map((credit, i) => (
                              <CreditCard
                                key={credit._id || `${credit.memoNo}-${i}`}
                                credit={credit}
                                borderColor={borderColor}
                                onViewMemo={() => openMemo(credit)}
                              />
                            ))}
                      </div>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block w-full align-middle">
                      <table className="w-full text-left table-fixed">
                        <colgroup>
                          <col style={{ width: "28%" }} />
                          <col style={{ width: "17%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "16%" }} />
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
                            <th scope="col" className="px-6 py-4 font-bold">
                              Reference / Memo
                            </th>
                            <th scope="col" className="px-4 py-4 font-bold">
                              Date Credited
                            </th>
                            <th scope="col" className="px-4 py-4 text-center">
                              Duration
                            </th>
                            <th scope="col" className="px-4 py-4 text-center">
                              Remaining
                            </th>
                            <th scope="col" className="px-4 py-4 text-center">
                              Status
                            </th>
                            <th scope="col" className="px-6 py-4 text-right">
                              Memo
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {isLoading
                            ? [...Array(Math.min(limit, 10))].map((_, i) => (
                                <tr key={`sk-${i}`}>
                                  {[...Array(6)].map((__, j) => (
                                    <td key={j} className="px-6 py-4">
                                      <Skeleton />
                                    </td>
                                  ))}
                                </tr>
                              ))
                            : credits.map((credit, i) => (
                                <tr
                                  key={credit._id || `${credit.memoNo}-${i}`}
                                  className="border-b bg-[color:var(--app-surface)] even:bg-[color:var(--app-surface-2)] hover:bg-[color:var(--accent-soft)]"
                                  style={{ borderColor }}
                                >
                                  <td className="px-6 py-4 align-middle">
                                    <div className="flex flex-col min-w-0">
                                      <span
                                        className="font-semibold text-sm truncate"
                                        style={{ color: "var(--app-text)" }}
                                        title={credit.memoNo || "-"}
                                      >
                                        {credit.memoNo || "-"}
                                      </span>
                                      <span
                                        className="text-[10px] font-mono mt-0.5"
                                        style={{ color: "var(--app-muted)" }}
                                      >
                                        ID: {shortId(credit._id)}
                                      </span>
                                    </div>
                                  </td>

                                  <td
                                    className="px-4 py-4 align-middle whitespace-nowrap text-sm"
                                    style={{ color: "var(--app-muted)" }}
                                  >
                                    {formatDate(credit.dateApproved)}
                                  </td>

                                  <td className="px-4 py-4 text-center align-middle whitespace-nowrap">
                                    <MetricBadge
                                      icon={Clock}
                                      borderColor={borderColor}
                                    >
                                      {formatDuration(credit.duration)}
                                    </MetricBadge>
                                  </td>

                                  <td className="px-4 py-4 text-center align-middle whitespace-nowrap">
                                    <MetricBadge
                                      icon={Layers}
                                      borderColor={borderColor}
                                    >
                                      {fmtHours(credit.remainingHours)}h
                                    </MetricBadge>
                                  </td>

                                  <td className="px-4 py-4 text-center align-middle whitespace-nowrap">
                                    <StatusBadge
                                      status={credit.employeeStatus}
                                    />
                                  </td>

                                  <td className="px-6 py-4 text-right align-middle whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => openMemo(credit)}
                                      className={`${BTN_SECONDARY} px-3 py-1.5 text-xs shadow-sm`}
                                      style={{ borderColor }}
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      View Memo
                                    </button>
                                  </td>
                                </tr>
                              ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

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

          {/* Back-to-top (mobile) */}
          {showScrollTop && (
            <button
              type="button"
              onClick={scrollToTop}
              className={`md:hidden fixed bottom-5 right-5 z-[1] h-10 w-10 rounded-full shadow-lg flex items-center justify-center ${FOCUS_RING}`}
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

          {/* Memo modal */}
          <Modal
            isOpen={memoModal.isOpen}
            onClose={closeMemo}
            maxWidth="max-w-3xl"
            hideHeader={true}
            hideFooter={true}
          >
            <div className="max-h-[85vh] md:max-h-[80vh] overflow-y-auto cto-scrollbar md:p-2">
              <CtoMemoModalContent
                memo={memoModal.memo}
                baseUrl={API_BASE_URL}
                onClose={closeMemo}
              />
            </div>
          </Modal>
        </SkeletonTheme>
      </div>
    </FullHeightCardContainer>
  );
};

export default MyCtoCreditHistory;
