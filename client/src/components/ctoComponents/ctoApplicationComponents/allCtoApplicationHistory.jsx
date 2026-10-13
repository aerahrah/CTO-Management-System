// allCtoApplicationsHistory.jsx
import {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import FullHeightCardContainer from "../../pageContainer";
import { StatusBadge } from "../../statusUtils";
import {
  fetchAllCtoApplications,
  fetchCtoApplicationById,
} from "../../../api/cto";
import Modal from "../../modal";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Breadcrumbs from "../../breadCrumbs";
import MemoList from "../ctoMemoModal";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Calendar,
  FileText,
  Inbox,
  LayoutGrid,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Layers,
  FileDown,
  ArrowUp,
  FileBadge,
  ChevronDown,
  Loader2,
} from "lucide-react";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";

// PDF Modals
import CtoApplicationPdfModal from "./ctoApplicationPDFModal";
import OrganicApplicationPdfModal from "./organicApplicationPDFModal";

import { useAuth } from "../../../store/authStore";
import StatusTabs from "../../statusTabs";

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

/* ------------------ Resolve theme ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

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
   Data helpers
========================= */
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : DATE_FMT.format(d);
};

const fullNameOf = (emp) =>
  `${emp?.firstName || ""} ${emp?.lastName || ""}`.replace(/\s+/g, " ").trim();

const employeeTypeOf = (app) => app?.category || app?.employeeType || "Unknown";

const isOrganicApp = (app) =>
  app?.employeeType === "Organic" || app?.category === "Organic";

const memoNumbersOf = (app) =>
  Array.isArray(app?.memo)
    ? app.memo.map((m) => m?.memoId?.memoNo).filter(Boolean)
    : [];

const hasMemosOf = (app) => Array.isArray(app?.memo) && app.memo.length > 0;

const shortIdOf = (app) => (app?._id ? app._id.slice(-6).toUpperCase() : "-");

const sortedDatesOf = (dates = []) =>
  (Array.isArray(dates) ? dates : [])
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);

const STRIP_COLORS = {
  APPROVED: "#10b981",
  REJECTED: "#f43f5e",
  PENDING: "#f59e0b",
  CANCELLED: "#94a3b8",
};

const stripColorOf = (status) =>
  STRIP_COLORS[String(status || "").toUpperCase()] || "#cbd5e1";

/* =========================
   StatCard
========================= */
const StatCard = ({
  title,
  value,
  icon: Icon,
  hint,
  tone = "neutral",
  borderColor,
}) => {
  const toneMeta = {
    blue: { chipBg: "var(--accent-soft)", chipText: "var(--accent)" },
    green: { chipBg: "rgba(34,197,94,0.14)", chipText: "#16a34a" },
    red: { chipBg: "rgba(239,68,68,0.14)", chipText: "#ef4444" },
    amber: { chipBg: "rgba(245,158,11,0.16)", chipText: "#d97706" },
    neutral: { chipBg: "var(--app-surface-2)", chipText: "var(--app-muted)" },
  };

  const t = toneMeta[tone] || toneMeta.neutral;

  return (
    <div
      className="w-full flex-shrink-0 rounded-xl shadow-sm p-3.5 flex items-start gap-3 h-full transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        border: `1px solid ${borderColor}`,
      }}
      role="status"
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border"
        style={{
          backgroundColor: t.chipBg,
          borderColor,
          color: t.chipText,
        }}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] uppercase font-bold tracking-wide truncate"
          style={{ color: "var(--app-muted)" }}
        >
          {title}
        </div>
        <div
          className="mt-0.5 text-lg font-black truncate"
          style={{ color: "var(--app-text)" }}
        >
          {value}
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
};

/* =========================
   Cells (shared by table + cards)
========================= */
const RequestorCell = ({ app, borderColor }) => {
  const name = fullNameOf(app?.employee) || "-";
  const position = app?.employee?.position || "-";
  const type = employeeTypeOf(app);

  return (
    <div className="min-w-0 flex-1">
      <p
        className="text-sm font-semibold truncate"
        style={{ color: "var(--app-text)" }}
        title={name}
      >
        {name}
      </p>
      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
        <span
          className="text-[11px] truncate"
          style={{ color: "var(--app-muted)" }}
          title={position}
        >
          {position}
        </span>
        <span
          className="flex-none text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
          style={{
            backgroundColor: "var(--app-surface-2)",
            color: "var(--app-muted)",
            borderColor,
          }}
        >
          {type}
        </span>
      </div>
    </div>
  );
};

// Memo numbers as chips; "+N more" expands the rest (like the credit history names)
const MemoChips = ({ app, borderColor, maxVisible = 1, showId = true }) => {
  const [expanded, setExpanded] = useState(false);
  const memos = memoNumbersOf(app);

  if (memos.length === 0) {
    return (
      <div className="min-w-0">
        <span className="text-sm" style={{ color: "var(--app-muted)" }}>
          No memo attached
        </span>
        {showId && (
          <span
            className="block text-[10px] font-mono mt-0.5"
            style={{ color: "var(--app-muted)" }}
          >
            ID: {shortIdOf(app)}
          </span>
        )}
      </div>
    );
  }

  const hiddenCount = memos.length - maxVisible;
  const visible = expanded ? memos : memos.slice(0, maxVisible);

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        {visible.map((memo, idx) => (
          <span
            key={`${memo}-${idx}`}
            title={memo}
            className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full border text-xs font-semibold"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
              color: "var(--app-text)",
            }}
          >
            <FileText
              size={11}
              className="flex-none"
              style={{ color: "var(--accent)" }}
            />
            <span className="truncate">{memo}</span>
          </span>
        ))}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            title={expanded ? "Show less" : memos.slice(maxVisible).join(", ")}
            className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold whitespace-nowrap transition hover:brightness-95"
            style={{
              backgroundColor: "var(--accent-soft)",
              borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
              color: "var(--accent)",
            }}
          >
            {expanded ? "Show less" : `+${hiddenCount} more`}
          </button>
        )}
      </div>

      {showId && (
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--app-muted)" }}
        >
          ID: {shortIdOf(app)}
        </span>
      )}
    </div>
  );
};

const DatesCell = ({ dates, maxVisible = 1 }) => {
  const sorted = sortedDatesOf(dates);
  if (!sorted.length) {
    return (
      <span className="text-sm" style={{ color: "var(--app-muted)" }}>
        -
      </span>
    );
  }

  const visible = sorted.slice(0, maxVisible).map((d) => DATE_FMT.format(d));
  const rest = sorted.length - visible.length;
  const all = sorted.map((d) => DATE_FMT.format(d)).join(", ");

  return (
    <div className="flex items-center gap-1.5 min-w-0" title={all}>
      <Calendar
        size={14}
        className="flex-none"
        style={{ color: "var(--app-muted)" }}
      />
      <span className="text-sm truncate" style={{ color: "var(--app-muted)" }}>
        {visible.join(", ")}
      </span>
      {rest > 0 && (
        <span
          className="flex-none inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-bold"
          style={{
            backgroundColor: "var(--app-surface-2)",
            borderColor: "var(--app-border)",
            color: "var(--app-muted)",
          }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
};

/* =========================
   Per-row action menu (portal, so the table can't clip it)
========================= */
const MENU_WIDTH = 200;

const ApplicationActionMenu = ({
  app,
  onViewDetails,
  onViewPdf,
  onViewCscForm6,
  onViewMemos,
  isOrganic,
  borderColor,
  isPdfLoading,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, visible: false });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const hasMemos = hasMemosOf(app);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const btn = btnRef.current?.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 160;
    if (!btn) return;

    const gap = 6;
    const spaceBelow = window.innerHeight - btn.bottom;
    const openUp = spaceBelow < menuH + gap + 8 && btn.top > menuH + gap;

    setPos({
      top: openUp ? btn.top - menuH - gap : btn.bottom + gap,
      left: Math.min(
        Math.max(8, btn.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8,
      ),
      visible: true,
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const close = () => setIsOpen(false);
    const onDown = (e) => {
      if (
        btnRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      )
        return;
      close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  const run = (cb) => {
    setIsOpen(false);
    cb?.();
  };

  const itemClass =
    "w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 text-left transition-colors " +
    "text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)] hover:text-[color:var(--accent)] " +
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[color:var(--app-muted)]";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setPos((p) => ({ ...p, visible: false }));
          setIsOpen((o) => !o);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border shadow-sm text-xs font-bold transition-all duration-200 ease-out active:scale-95"
        style={{
          backgroundColor: isOpen
            ? "var(--app-surface-2)"
            : "var(--app-surface)",
          borderColor,
          color: isOpen ? "var(--accent)" : "var(--app-text)",
        }}
        title="Actions"
      >
        {isPdfLoading ? <Loader2 size={14} className="animate-spin" /> : null}
        <span>Actions</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="rounded-lg py-1 overflow-hidden"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              zIndex: 1000,
              visibility: pos.visible ? "visible" : "hidden",
              backgroundColor: "var(--app-surface)",
              border: `1px solid ${borderColor}`,
              boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onViewDetails)}
              className={itemClass}
            >
              <Eye size={14} /> View Details
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={isPdfLoading}
              onClick={() => run(onViewPdf)}
              className={itemClass}
            >
              {isPdfLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileDown size={14} />
              )}
              {isPdfLoading ? "Loading PDF..." : "View General PDF"}
            </button>

            {isOrganic && (
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onViewCscForm6)}
                className={itemClass}
              >
                <FileBadge size={14} /> View CSC Form 6
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              disabled={!hasMemos}
              onClick={() => run(onViewMemos)}
              className={itemClass}
            >
              <FileText size={14} /> View Memos
            </button>
          </div>,
          document.body,
        )}
    </>
  );
};

/* =========================
   Mobile / Tablet Card
========================= */
const ApplicationCard = ({
  app,
  onViewDetails,
  onViewPdf,
  onViewCscForm6,
  onViewMemos,
  isOrganic,
  borderColor,
  isPdfLoading,
}) => {
  const hasMemos = hasMemosOf(app);
  const coveredCount = Array.isArray(app?.inclusiveDates)
    ? app.inclusiveDates.length
    : 0;

  const footerBtn =
    "flex-1 min-w-[80px] inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border transition-colors duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div
      className="rounded-xl shadow-sm overflow-hidden transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${stripColorOf(app?.overallStatus)}`,
      }}
    >
      <div className="p-4">
        {/* Requestor + status */}
        <div className="flex items-start justify-between gap-3">
          <RequestorCell app={app} borderColor={borderColor} />
          <div className="flex-none">
            <StatusBadge status={app?.overallStatus} />
          </div>
        </div>

        {/* Memo reference */}
        <div className="mt-3 flex items-start justify-between gap-2">
          <MemoChips app={app} borderColor={borderColor} showId={false} />
          <span
            className="flex-none text-[10px] font-mono pt-1"
            style={{ color: "var(--app-muted)" }}
          >
            #{shortIdOf(app)}
          </span>
        </div>

        {/* Hours + submitted */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div
            className="rounded-lg border p-2"
            style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--app-muted)" }}
            >
              <Clock className="w-3.5 h-3.5" /> Hours
            </div>
            <div
              className="mt-1 text-sm font-semibold"
              style={{ color: "var(--app-text)" }}
            >
              {Number(app?.requestedHours || 0)}h
            </div>
          </div>

          <div
            className="rounded-lg border p-2"
            style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--app-muted)" }}
            >
              <Calendar className="w-3.5 h-3.5" /> Submitted
            </div>
            <div
              className="mt-1 text-sm font-semibold truncate"
              style={{ color: "var(--app-text)" }}
            >
              {fmtDate(app?.createdAt)}
            </div>
          </div>
        </div>

        {/* Dates covered */}
        <div className="mt-3 flex items-center gap-2 min-w-0">
          <Layers
            className="w-4 h-4 flex-none"
            style={{ color: "var(--app-muted)" }}
          />
          <span
            className="text-xs flex-none"
            style={{ color: "var(--app-muted)" }}
          >
            {coveredCount} day{coveredCount === 1 ? "" : "s"} ·
          </span>
          <div className="min-w-0 flex-1">
            <DatesCell dates={app?.inclusiveDates} maxVisible={1} />
          </div>
        </div>
      </div>

      <div className="border-t p-3" style={{ borderColor }}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onViewMemos}
            disabled={!hasMemos}
            className={`${footerBtn} bg-[color:var(--app-surface-2)] hover:brightness-95`}
            style={{ borderColor, color: "var(--app-text)" }}
          >
            <FileText className="w-4 h-4" />
            Memos
          </button>

          <button
            type="button"
            onClick={onViewDetails}
            className={`${footerBtn} bg-[color:var(--app-surface)] hover:bg-[color:var(--accent-soft)]`}
            style={{ borderColor, color: "var(--accent)" }}
          >
            <Eye className="w-4 h-4" />
            Details
          </button>

          <button
            type="button"
            disabled={isPdfLoading}
            onClick={onViewPdf}
            className={`${footerBtn} bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)]`}
            style={{ borderColor, color: "var(--app-text)" }}
          >
            {isPdfLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {isPdfLoading ? "Loading" : "Gen PDF"}
          </button>

          {isOrganic && (
            <button
              type="button"
              onClick={onViewCscForm6}
              title="View CSC Form 6"
              className={`${footerBtn} bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)]`}
              style={{ borderColor, color: "var(--app-text)" }}
            >
              <FileBadge className="w-4 h-4" />
              Form 6
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* =========================
   Status tabs factory
========================= */
const getTabsConfig = (statusCounts = {}, totalFallback = 0) => {
  const total =
    statusCounts.total ??
    statusCounts.TOTAL ??
    totalFallback ??
    (statusCounts.PENDING || 0) +
      (statusCounts.APPROVED || 0) +
      (statusCounts.REJECTED || 0) +
      (statusCounts.CANCELLED || 0);

  return [
    {
      id: "",
      label: "All Status",
      icon: LayoutGrid,
      count: total || 0,
      activeColor:
        "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:var(--accent-soft2)]",
    },
    {
      id: "PENDING",
      label: "Pending",
      icon: AlertCircle,
      count: statusCounts.PENDING || 0,
      activeColor: "bg-amber-100 text-amber-700 border-amber-200",
    },
    {
      id: "APPROVED",
      label: "Approved",
      icon: CheckCircle2,
      count: statusCounts.APPROVED || 0,
      activeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    {
      id: "REJECTED",
      label: "Rejected",
      icon: XCircle,
      count: statusCounts.REJECTED || 0,
      activeColor: "bg-rose-100 text-rose-700 border-rose-200",
    },
    {
      id: "CANCELLED",
      label: "Cancelled",
      icon: RotateCcw,
      count: statusCounts.CANCELLED || 0,
      activeColor: "bg-slate-100 text-slate-700 border-slate-200",
    },
  ];
};

/* =========================
   Compact Pagination
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
  borderColor,
}) => {
  const safeTotalPages = Math.max(totalPages || 1, 1);

  return (
    <div
      className="px-4 md:px-6 py-3 border-t transition-colors duration-300 ease-out"
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor,
            color: "var(--app-text)",
          }}
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
            {total === 0 ? `0 ${label}` : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={page >= safeTotalPages || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor,
            color: "var(--app-text)",
          }}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

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
          {label}
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-lg border"
          style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
        >
          <button
            type="button"
            onClick={onPrev}
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out hover:bg-[color:var(--app-surface)]"
            style={{ color: "var(--app-muted)" }}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span
            className="text-xs font-mono font-medium px-3"
            style={{ color: "var(--app-muted)" }}
          >
            {page} / {safeTotalPages}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={page >= safeTotalPages || total === 0}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out hover:bg-[color:var(--app-surface)]"
            style={{ color: "var(--app-muted)" }}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   Page
========================= */
const AllCtoApplicationsHistory = () => {
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

  // Selected app / memos
  const [selectedApp, setSelectedApp] = useState(null);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  // PDF modals + loading
  const [pdfApp, setPdfApp] = useState(null);
  const [organicPdfApp, setOrganicPdfApp] = useState(null);
  const [pdfLoadingId, setPdfLoadingId] = useState(null);

  // Filters / pagination
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 500);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Scroll container (mobile) + back-to-top
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

  const scrollToTop = () =>
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  // Back to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, employeeTypeFilter, limit]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "ctoAllApplications",
      page,
      limit,
      statusFilter,
      debouncedSearch,
      employeeTypeFilter,
    ],
    queryFn: () =>
      fetchAllCtoApplications({
        page,
        limit,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        employeeType: employeeTypeFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const applications = useMemo(() => data?.data || [], [data]);

  const pagination = useMemo(
    () => ({
      page: data?.pagination?.page || 1,
      totalPages: Math.max(data?.pagination?.totalPages || 1, 1),
      total: data?.pagination?.total || 0,
    }),
    [data],
  );

  // Keep page in range if totalPages changes
  useEffect(() => {
    setPage((p) => {
      if (p > pagination.totalPages) return pagination.totalPages;
      if (p < 1) return 1;
      return p;
    });
  }, [pagination.totalPages]);

  const startItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * limit + 1;
  const endItem =
    pagination.total === 0
      ? 0
      : Math.min(pagination.page * limit, pagination.total);

  const openMemoModal = (memos) => setMemoModal({ isOpen: true, memos });
  const closeMemoModal = () => setMemoModal({ isOpen: false, memos: [] });

  const handleResetFilters = useCallback(() => {
    setSearchInput("");
    setStatusFilter("");
    setEmployeeTypeFilter("");
    setPage(1);
  }, []);

  const isFiltered =
    statusFilter !== "" || debouncedSearch !== "" || employeeTypeFilter !== "";

  // Fetch the full application (with ledger) before opening the general PDF
  const handleViewPdf = async (app) => {
    try {
      setPdfLoadingId(app._id);
      const response = await fetchCtoApplicationById(app._id);
      const fullApp = response?.application || response;
      setPdfApp(fullApp);
    } catch (error) {
      console.error("Failed to fetch full application for PDF:", error);
      setPdfApp(app); // fall back to the row data
    } finally {
      setPdfLoadingId(null);
    }
  };

  const statusCounts = data?.statusCounts || {};

  const totalRequests =
    statusCounts.total ??
    statusCounts.TOTAL ??
    pagination.total ??
    (statusCounts.PENDING || 0) +
      (statusCounts.APPROVED || 0) +
      (statusCounts.REJECTED || 0) +
      (statusCounts.CANCELLED || 0);

  const statPending = statusCounts.PENDING || 0;
  const statApproved = statusCounts.APPROVED || 0;
  const statRejected = statusCounts.REJECTED || 0;

  const rowHandlers = (app) => ({
    onViewDetails: () => setSelectedApp(app),
    onViewPdf: () => handleViewPdf(app),
    onViewCscForm6: () => setOrganicPdfApp(app),
    onViewMemos: () => openMemoModal(app.memo),
  });

  const cardSkeleton = (key) => (
    <div
      key={key}
      className="rounded-xl shadow-sm p-4 border"
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <Skeleton height={14} width="70%" />
      <Skeleton height={10} width="45%" />
      <div className="mt-3">
        <Skeleton height={20} width="50%" borderRadius={999} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Skeleton height={52} />
        <Skeleton height={52} />
      </div>
      <div className="mt-4">
        <Skeleton height={36} />
      </div>
    </div>
  );

  const chipStyle = {
    backgroundColor: "var(--accent-soft)",
    color: "var(--accent)",
    borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
  };

  return (
    <FullHeightCardContainer>
      <div
        className="w-full h-full min-h-0 flex flex-col md:p-0 transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
          color: "var(--app-text, #0f172a)",
        }}
      >
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
              <div className="flex flex-col 2xl:flex-row 2xl:items-start justify-between gap-4">
                <div className="min-w-0">
                  <Breadcrumbs rootLabel="home" rootTo="/app" />
                  <h1
                    className="text-2xl md:text-3xl font-bold tracking-tight font-sans"
                    style={{ color: "var(--app-text)" }}
                  >
                    All CTO Applications
                  </h1>
                  <p
                    className="text-sm mt-1 max-w-2xl"
                    style={{ color: "var(--app-muted)" }}
                  >
                    View and manage all compensatory time-off applications
                  </p>
                </div>

                <div className="w-full 2xl:w-auto">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-stretch">
                    <StatCard
                      title="Total Requests"
                      value={String(totalRequests || 0)}
                      icon={LayoutGrid}
                      hint="All applications"
                      tone="blue"
                      borderColor={borderColor}
                    />
                    <StatCard
                      title="Total Pending"
                      value={String(statPending)}
                      icon={AlertCircle}
                      hint="Awaiting action"
                      tone="amber"
                      borderColor={borderColor}
                    />
                    <StatCard
                      title="Total Approved"
                      value={String(statApproved)}
                      icon={CheckCircle2}
                      hint="Approved requests"
                      tone="green"
                      borderColor={borderColor}
                    />
                    <StatCard
                      title="Total Rejected"
                      value={String(statRejected)}
                      icon={XCircle}
                      hint="Rejected requests"
                      tone="red"
                      borderColor={borderColor}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN surface */}
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
                style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <StatusTabs
                    tabs={getTabsConfig(statusCounts, pagination.total)}
                    activeStatus={statusFilter}
                    onStatusChange={(id) => {
                      setStatusFilter(id);
                      setPage(1);
                    }}
                  />

                  <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: "var(--app-muted)" }}
                      />
                      <input
                        type="text"
                        placeholder="Search memo..."
                        value={searchInput}
                        maxLength={100}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 rounded-lg text-sm outline-none transition-colors duration-200 ease-out border"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                          color: "var(--app-text)",
                        }}
                      />
                      {searchInput && (
                        <button
                          type="button"
                          onClick={() => setSearchInput("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition hover:bg-[color:var(--app-surface-2)]"
                          style={{ color: "var(--app-muted)" }}
                          aria-label="Clear search"
                          title="Clear"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-2 pl-3 border-l"
                      style={{ borderColor }}
                    >
                      <span
                        className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Type
                      </span>
                      <select
                        value={employeeTypeFilter}
                        onChange={(e) => {
                          setEmployeeTypeFilter(e.target.value);
                          setPage(1);
                        }}
                        className="border text-xs rounded-lg block p-1.5 font-medium outline-none cursor-pointer"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                          color: "var(--app-text)",
                        }}
                      >
                        <option value="">All Types</option>
                        <option value="Organic">Organic</option>
                        <option value="Job Order">Job Order</option>
                      </select>
                    </div>

                    <div
                      className="flex items-center gap-2 pl-3 border-l"
                      style={{ borderColor }}
                    >
                      <span
                        className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider"
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
                        className="border text-xs rounded-lg block p-1.5 font-medium outline-none cursor-pointer"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
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
                  </div>
                </div>

                {/* Active filters + reset */}
                {isFiltered && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span
                        className="text-[10px] font-bold uppercase"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Active:
                      </span>
                      {debouncedSearch && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium max-w-[200px] truncate"
                          style={chipStyle}
                          title={debouncedSearch}
                        >
                          "{debouncedSearch}"
                        </span>
                      )}
                      {statusFilter && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium"
                          style={chipStyle}
                        >
                          {statusFilter}
                        </span>
                      )}
                      {employeeTypeFilter && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium"
                          style={chipStyle}
                        >
                          {employeeTypeFilter}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="flex-none flex items-center gap-1 text-[10px] font-bold uppercase"
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
                {!isLoading && applications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                    <div
                      className="p-6 rounded-full mb-4 border"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor,
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
                      No Results Found
                    </h3>
                    <p
                      className="text-sm max-w-xs mt-1"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Try adjusting your search or filters to find what you're
                      looking for.
                    </p>
                    {isFiltered && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold border rounded-lg transition-colors duration-200 ease-out bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)]"
                        style={{ borderColor, color: "var(--app-text)" }}
                      >
                        <RotateCcw size={12} /> Clear Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Mobile (1 col) / Tablet (2 cols): cards */}
                    <div className="block lg:hidden p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                        {isLoading
                          ? [...Array(Math.min(limit, 6))].map((_, i) =>
                              cardSkeleton(`sk-${i}`),
                            )
                          : applications.map((app) => (
                              <ApplicationCard
                                key={app._id}
                                app={app}
                                borderColor={borderColor}
                                isOrganic={isOrganicApp(app)}
                                isPdfLoading={pdfLoadingId === app._id}
                                {...rowHandlers(app)}
                              />
                            ))}
                      </div>
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden lg:block w-full align-middle">
                      <table className="w-full text-left table-fixed">
                        <colgroup>
                          <col style={{ width: "22%" }} />
                          <col style={{ width: "22%" }} />
                          <col style={{ width: "7%" }} />
                          <col style={{ width: "14%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "14%" }} />
                          <col style={{ width: "10%" }} />
                        </colgroup>

                        <thead
                          className="sticky top-0 z-10 border-b"
                          style={{
                            backgroundColor: "var(--app-surface)",
                            borderColor,
                          }}
                        >
                          <tr
                            className="text-[10px] uppercase tracking-[0.12em] font-bold"
                            style={{ color: "var(--app-muted)" }}
                          >
                            <th className="px-5 py-4">Requestor</th>
                            <th className="px-4 py-4">Reference / Memo</th>
                            <th className="px-2 py-4 text-center">Hours</th>
                            <th className="px-2 py-4 text-center">Status</th>
                            <th className="px-2 py-4 text-center">Submitted</th>
                            <th className="px-4 py-4">Dates Covered</th>
                            <th className="px-5 py-4 text-right">Actions</th>
                          </tr>
                        </thead>

                        <tbody>
                          {isLoading
                            ? [...Array(8)].map((_, i) => (
                                <tr key={i}>
                                  {[...Array(7)].map((__, j) => (
                                    <td key={j} className="px-4 py-4">
                                      <Skeleton />
                                    </td>
                                  ))}
                                </tr>
                              ))
                            : applications.map((app, i) => {
                                const bg =
                                  i % 2 === 0
                                    ? "var(--app-surface)"
                                    : "var(--app-surface-2)";

                                return (
                                  <tr
                                    key={app._id}
                                    className="border-b transition-colors duration-200 ease-out"
                                    style={{ backgroundColor: bg, borderColor }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        "var(--accent-soft)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        bg;
                                    }}
                                  >
                                    <td className="px-5 py-3.5 align-middle">
                                      <RequestorCell
                                        app={app}
                                        borderColor={borderColor}
                                      />
                                    </td>

                                    <td className="px-4 py-3.5 align-middle">
                                      <MemoChips
                                        app={app}
                                        borderColor={borderColor}
                                      />
                                    </td>

                                    <td className="px-2 py-3.5 text-center align-middle whitespace-nowrap">
                                      <span
                                        className="inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold"
                                        style={{
                                          backgroundColor: "var(--app-surface)",
                                          borderColor,
                                          color: "var(--app-text)",
                                        }}
                                      >
                                        {Number(app?.requestedHours || 0)}h
                                      </span>
                                    </td>

                                    <td className="px-2 py-3.5 text-center align-middle whitespace-nowrap">
                                      <StatusBadge status={app.overallStatus} />
                                    </td>

                                    <td
                                      className="px-2 py-3.5 text-center align-middle whitespace-nowrap text-sm"
                                      style={{ color: "var(--app-muted)" }}
                                    >
                                      {fmtDate(app.createdAt)}
                                    </td>

                                    <td className="px-4 py-3.5 align-middle">
                                      <DatesCell
                                        dates={app.inclusiveDates}
                                        maxVisible={1}
                                      />
                                    </td>

                                    <td className="px-5 py-3.5 text-right align-middle whitespace-nowrap">
                                      <ApplicationActionMenu
                                        app={app}
                                        borderColor={borderColor}
                                        isOrganic={isOrganicApp(app)}
                                        isPdfLoading={pdfLoadingId === app._id}
                                        {...rowHandlers(app)}
                                      />
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
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                startItem={startItem}
                endItem={endItem}
                label="applications"
                onPrev={() => setPage((p) => Math.max(p - 1, 1))}
                onNext={() =>
                  setPage((p) => Math.min(p + 1, pagination.totalPages))
                }
                borderColor={borderColor}
              />
            </div>
          </div>

          {/* Back-to-top */}
          {showScrollTop && (
            <button
              type="button"
              onClick={scrollToTop}
              className="md:hidden fixed bottom-5 right-5 z-[1] h-10 w-10 rounded-full shadow-lg active:scale-95 transition flex items-center justify-center"
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

          {/* General PDF Modal */}
          <CtoApplicationPdfModal
            app={pdfApp}
            isOpen={!!pdfApp}
            onClose={() => setPdfApp(null)}
          />

          {/* Organic PDF Modal */}
          <OrganicApplicationPdfModal
            app={organicPdfApp}
            isOpen={!!organicPdfApp}
            onClose={() => setOrganicPdfApp(null)}
          />

          {/* Details modal */}
          {selectedApp && (
            <Modal
              isOpen={!!selectedApp}
              onClose={() => setSelectedApp(null)}
              maxWidth="max-w-5xl"
              title="CTO Application Details"
            >
              <CtoApplicationDetails app={selectedApp} loading={!selectedApp} />
            </Modal>
          )}

          {/* Memos modal */}
          <Modal
            isOpen={memoModal.isOpen}
            onClose={closeMemoModal}
            title="Memos Used"
            closeLabel="Close"
            maxWidth="max-w-5xl"
          >
            <MemoList
              memos={memoModal.memos}
              description="Read-only view of CTO memos attached to this request."
            />
          </Modal>
        </SkeletonTheme>
      </div>
    </FullHeightCardContainer>
  );
};

export default AllCtoApplicationsHistory;
