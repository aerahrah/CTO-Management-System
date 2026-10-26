// allWellnessApplicationsHistory.jsx
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
import { StatusBadge } from "../../statusUtils";
import {
  fetchAllWellnessApplications,
  fetchWellnessApplicationById,
} from "../../../api/wellnessApplication";
import Modal from "../../modal";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Breadcrumbs from "../../breadCrumbs";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CalendarDays,
  Calendar,
  Inbox,
  LayoutGrid,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowUp,
  HeartPulse,
  FileDown,
  FileBadge,
  ChevronDown,
  Loader2,
} from "lucide-react";
import WellnessApplicationDetails from "./myWellnessApplicationFullDetails";
import FullHeightCardContainer from "../../pageContainer";
import { useAuth } from "../../../store/authStore";
import StatusTabs from "../../statusTabs";

// PDF Modals
import WellnessLeavePdfModal from "./wellnessApplicationModal";
import OrganicWellnessLeavePdfModal from "./organicWellnessApplicationPDFModal";

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
   Interaction tints
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

/* =========================
   Row / card click helpers
========================= */
// A click on a control inside a row or card must not also open the details
// modal. This includes the action menu: it is portaled to <body>, but React
// still bubbles its events up to the row.
const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, label, [role='menu'], [role='menuitem'], [data-no-row-click]";

const shouldOpenFromClick = (e) => {
  if (e.defaultPrevented) return false;
  const target = e.target;
  if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) {
    return false;
  }
  // Let people highlight/copy text (e.g. a name or ID) without opening the modal
  const selection =
    typeof window !== "undefined" ? window.getSelection?.() : null;
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    return false;
  }
  return true;
};

const isActivationKey = (e) => e.key === "Enter" || e.key === " ";

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

const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;

const fullNameOf = (emp) =>
  `${emp?.firstName || ""} ${emp?.lastName || ""}`.replace(/\s+/g, " ").trim();

const employeeTypeOf = (app) => app?.category || app?.employeeType || "Unknown";

const isOrganicApp = (app) =>
  app?.employeeType === "Organic" || app?.category === "Organic";

const shortIdOf = (app) => (app?._id ? app._id.slice(-6).toUpperCase() : "-");

// Copies before sorting so the query data is never mutated
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
        style={{ backgroundColor: t.chipBg, borderColor, color: t.chipText }}
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

/* ---- Dates: weekday + date pills; "+N" expands the rest inline ---- */
const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const SHOW_ALL_UP_TO = 2;

const DatePill = ({ date, strong = false }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border whitespace-nowrap tabular-nums leading-5 ${
      strong ? "text-[13px]" : "text-xs"
    }`}
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: "var(--app-border, rgba(15,23,42,0.10))",
      color: "var(--app-text)",
    }}
  >
    <span
      className="text-[10px] font-bold uppercase tracking-wider"
      style={{ color: "var(--accent)" }}
    >
      {WEEKDAY_FMT.format(date)}
    </span>
    <span className="font-semibold">{DATE_FMT.format(date)}</span>
  </span>
);

const DatesCell = ({ dates, maxVisible = 1, strong = false }) => {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortedDatesOf(dates);

  if (!sorted.length) {
    return (
      <span className="text-sm" style={{ color: "var(--app-muted)" }}>
        -
      </span>
    );
  }

  // Up to two dates are always shown in full; "+N" only appears for 3 or more
  const visibleCount =
    sorted.length <= SHOW_ALL_UP_TO ? sorted.length : maxVisible;
  const hiddenCount = Math.max(sorted.length - visibleCount, 0);
  const shown = expanded ? sorted : sorted.slice(0, visibleCount);

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      {shown.map((d, i) => (
        <DatePill key={`${d.getTime()}-${i}`} date={d} strong={strong} />
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          title={
            expanded
              ? "Show fewer dates"
              : `Show ${hiddenCount} more date${hiddenCount === 1 ? "" : "s"}`
          }
          onClick={(e) => {
            e.stopPropagation(); // expand the dates, not open the row's details
            setExpanded((v) => !v);
          }}
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold leading-5 whitespace-nowrap cursor-pointer select-none transition-all duration-150 ease-out hover:brightness-90 hover:shadow-sm active:scale-95 ${FOCUS_RING}`}
          style={{
            backgroundColor: "var(--accent-soft)",
            borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
            color: "var(--accent)",
          }}
        >
          {expanded ? "Show less" : `+${hiddenCount}`}
        </button>
      )}
    </div>
  );
};

/* =========================
   Per-row action menu (portal, so the table can't clip it)
========================= */
const MENU_WIDTH = 200;

// "Actions" trigger: solid accent like the File Leave / apply buttons so it's
// easy to spot in every row; darker on hover, darker still while its menu is open.
const ACTIONS_BTN =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none shadow-sm " +
  "bg-[color:var(--accent)] text-white border-[color:var(--accent)] " +
  "transition-all duration-150 ease-out hover:shadow-md active:scale-95 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface)] " +
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:shadow-sm";

const ACTIONS_BTN_IDLE =
  "hover:brightness-90 active:brightness-[0.82] disabled:hover:brightness-100";

const ACTIONS_BTN_OPEN = "brightness-[0.85]";

// Shared menu-item styles: pointer cursor, darker hover, darker still on press
const MENU_ITEM_NEUTRAL =
  "w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 text-left cursor-pointer " +
  "transition-colors duration-150 ease-out focus-visible:outline-none " +
  "text-[color:var(--app-text)] hover:bg-[color:var(--wl-hover)] hover:text-[color:var(--accent)] " +
  "active:bg-[color:var(--wl-press)] focus-visible:bg-[color:var(--wl-hover)] " +
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[color:var(--app-text)]";

const ApplicationActionMenu = ({
  onViewDetails,
  onViewPdf,
  onViewCscForm6,
  isOrganic,
  borderColor,
  interactionVars,
  isPdfLoading,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, visible: false });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    // Global theme CSS may put a `transition` on every element. Without this
    // the menu visibly slides in from the top-left corner when top/left are set.
    menuRef.current?.style.setProperty("transition", "none", "important");
    const btn = btnRef.current?.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 130;
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

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation(); // don't open the row's details
          setPos((p) => ({ ...p, visible: false }));
          setIsOpen((o) => !o);
        }}
        className={`${ACTIONS_BTN} ${
          isOpen ? ACTIONS_BTN_OPEN : ACTIONS_BTN_IDLE
        }`}
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
            aria-label="Application actions"
            // Portaled, but React still bubbles clicks to the row: stop them here
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg py-1 overflow-hidden"
            style={{
              ...interactionVars,
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              zIndex: 1000,
              visibility: pos.visible ? "visible" : "hidden",
              backgroundColor: "var(--app-surface)",
              border: `1px solid ${borderColor}`,
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onViewDetails)}
              className={MENU_ITEM_NEUTRAL}
            >
              <Eye size={14} /> View Details
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={isPdfLoading}
              onClick={() => run(onViewPdf)}
              className={MENU_ITEM_NEUTRAL}
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
                className={MENU_ITEM_NEUTRAL}
              >
                <FileBadge size={14} /> View CSC Form 6
              </button>
            )}
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
  isOrganic,
  borderColor,
  isPdfLoading,
}) => {
  const btn = `flex-1 min-w-[80px] inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border cursor-pointer transition-colors duration-150 ease-out active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${FOCUS_RING}`;
  const neutralBtn = `${btn} bg-[color:var(--app-surface)] hover:bg-[color:var(--wl-hover)] active:bg-[color:var(--wl-press)] disabled:hover:bg-[color:var(--app-surface)]`;

  return (
    <div
      tabIndex={0}
      // Tapping anywhere on the card (except its buttons) opens the details
      onClick={(e) => {
        if (shouldOpenFromClick(e)) onViewDetails();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || !isActivationKey(e)) return;
        e.preventDefault();
        onViewDetails();
      }}
      className={`rounded-xl shadow-sm overflow-hidden cursor-pointer transition-[box-shadow,background-color] duration-200 ease-out hover:shadow-md ${FOCUS_RING}`}
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

        {/* Request label + ID */}
        <div className="mt-3 flex items-center gap-2 min-w-0 text-xs">
          <HeartPulse
            size={14}
            className="flex-none"
            style={{ color: "var(--accent)" }}
          />
          <span className="font-semibold" style={{ color: "var(--app-text)" }}>
            Wellness Request
          </span>
          <span
            className="ml-auto flex-none text-[10px] font-mono"
            style={{ color: "var(--app-muted)" }}
          >
            #{shortIdOf(app)}
          </span>
        </div>

        {/* Days + submitted */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div
            className="rounded-lg border p-2"
            style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--app-muted)" }}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Total Days
            </div>
            <div
              className="mt-1 text-sm font-semibold"
              style={{ color: "var(--app-text)" }}
            >
              {plural(Number(app?.totalDays || 0), "Day")}
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
        <div className="mt-3 min-w-0">
          <DatesCell dates={app?.inclusiveDates} maxVisible={2} />
        </div>
      </div>

      {/* Button bar: taps in the gaps between buttons don't open details */}
      <div
        data-no-row-click
        className="border-t p-3 cursor-default"
        style={{ borderColor }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onViewDetails}
            className={neutralBtn}
            style={{ borderColor, color: "var(--accent)" }}
          >
            <Eye className="w-4 h-4" />
            Details
          </button>

          <button
            type="button"
            disabled={isPdfLoading}
            onClick={onViewPdf}
            className={neutralBtn}
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
              className={neutralBtn}
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
  const prevDisabled = page === 1 || total === 0;
  const nextDisabled = page >= safeTotalPages || total === 0;

  const mobileBtn = `inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold cursor-pointer transition-colors duration-150 ease-out bg-[color:var(--app-surface)] enabled:hover:bg-[color:var(--wl-hover)] enabled:active:bg-[color:var(--wl-press)] disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS_RING}`;
  const iconBtn = `p-1.5 rounded-md cursor-pointer transition-colors duration-150 ease-out enabled:hover:bg-[color:var(--wl-hover)] enabled:active:bg-[color:var(--wl-press)] disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS_RING}`;

  return (
    <div
      className="px-4 md:px-6 py-3 border-t transition-colors duration-300 ease-out"
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={prevDisabled}
          className={mobileBtn}
          style={{ borderColor, color: "var(--app-text)" }}
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
          disabled={nextDisabled}
          className={mobileBtn}
          style={{ borderColor, color: "var(--app-text)" }}
          aria-label="Next page"
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
            disabled={prevDisabled}
            className={iconBtn}
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
            disabled={nextDisabled}
            className={iconBtn}
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
const AllWellnessApplicationsHistory = () => {
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  // CSS vars for hover / pressed shades (also passed to the portaled menu)
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

  // Selected app
  const [selectedApp, setSelectedApp] = useState(null);

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
      "wellnessAllApplications",
      page,
      limit,
      statusFilter,
      debouncedSearch,
      employeeTypeFilter,
    ],
    queryFn: () =>
      fetchAllWellnessApplications({
        page,
        limit,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        employeeType: employeeTypeFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const applications = useMemo(
    () => data?.applications || data?.data || [],
    [data],
  );

  const pagination = useMemo(
    () => ({
      page: data?.page || data?.pagination?.page || 1,
      totalPages: Math.max(
        data?.totalPages || data?.pagination?.totalPages || 1,
        1,
      ),
      total: data?.total || data?.pagination?.total || 0,
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
      const fullAppDetails = await fetchWellnessApplicationById(app._id);
      setPdfApp(fullAppDetails);
    } catch (error) {
      console.error("Failed to fetch full application details for PDF:", error);
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
        <Skeleton height={12} width="40%" />
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
          ...interactionVars,
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
                    All Wellness Applications
                  </h1>
                  <p
                    className="text-sm mt-1 max-w-2xl"
                    style={{ color: "var(--app-muted)" }}
                  >
                    View and manage all employee wellness leave applications
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
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
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
                        placeholder="Search employee..."
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
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full cursor-pointer transition hover:bg-[color:var(--wl-hover)] hover:text-[color:var(--app-text)] ${FOCUS_RING}`}
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
                      className={`flex-none flex items-center gap-1 text-[10px] font-bold uppercase rounded cursor-pointer hover:underline hover:brightness-90 ${FOCUS_RING}`}
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
                        className={`mt-6 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold border rounded-lg cursor-pointer transition-colors duration-200 ease-out bg-[color:var(--app-surface)] hover:bg-[color:var(--wl-hover)] active:bg-[color:var(--wl-press)] ${FOCUS_RING}`}
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
                          <col style={{ width: "26%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "9%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "12%" }} />
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
                            <th className="px-3 py-4">Request ID</th>
                            <th className="px-2 py-4 text-center">
                              Total Days
                            </th>
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
                                const handlers = rowHandlers(app);

                                return (
                                  <tr
                                    key={app._id}
                                    tabIndex={0}
                                    // Clicking anywhere on the row (except its buttons) opens the details
                                    onClick={(e) => {
                                      if (shouldOpenFromClick(e))
                                        handlers.onViewDetails();
                                    }}
                                    onKeyDown={(e) => {
                                      if (
                                        e.target !== e.currentTarget ||
                                        !isActivationKey(e)
                                      )
                                        return;
                                      e.preventDefault();
                                      handlers.onViewDetails();
                                    }}
                                    className="border-b cursor-pointer transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)]"
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

                                    <td
                                      className="px-3 py-3.5 align-middle whitespace-nowrap text-xs font-mono"
                                      style={{ color: "var(--app-muted)" }}
                                    >
                                      #{shortIdOf(app)}
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
                                        {plural(
                                          Number(app?.totalDays || 0),
                                          "Day",
                                        )}
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

                                    {/* Clicks around the Actions button shouldn't open details */}
                                    <td
                                      data-no-row-click
                                      className="px-5 py-3.5 text-right align-middle whitespace-nowrap cursor-default"
                                    >
                                      <ApplicationActionMenu
                                        borderColor={borderColor}
                                        interactionVars={interactionVars}
                                        isOrganic={isOrganicApp(app)}
                                        isPdfLoading={pdfLoadingId === app._id}
                                        {...handlers}
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
              className={`md:hidden fixed bottom-5 right-5 z-[1] h-10 w-10 rounded-full shadow-lg cursor-pointer hover:brightness-90 active:scale-95 transition flex items-center justify-center ${FOCUS_RING}`}
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
          <WellnessLeavePdfModal
            app={pdfApp}
            isOpen={!!pdfApp}
            onClose={() => setPdfApp(null)}
          />

          {/* Organic PDF Modal */}
          <OrganicWellnessLeavePdfModal
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
              title="Wellness Application Details"
            >
              <WellnessApplicationDetails app={selectedApp} />
            </Modal>
          )}
        </SkeletonTheme>
      </div>
    </FullHeightCardContainer>
  );
};

export default AllWellnessApplicationsHistory;
