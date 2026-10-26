// ctoEmployeeApplicationTable.jsx
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import MemoList from "../ctoMemoModal";
import CtoApplicationDetails from "../ctoApplicationComponents/myCtoApplicationFullDetails";
import { useAuth } from "../../../store/authStore";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  FileText,
  Eye,
  Calendar,
  Filter,
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
const MENU_WIDTH = 176; // w-44

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

/* =========================
   ROW / CARD CLICK HELPERS
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
  // Let people highlight/copy text (e.g. a memo number) without opening the modal
  const selection =
    typeof window !== "undefined" ? window.getSelection?.() : null;
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    return false;
  }
  return true;
};

const isActivationKey = (e) => e.key === "Enter" || e.key === " ";

/* =========================
   HELPERS
========================= */
const Chip = ({ children }) => (
  <span
    className="px-2 py-0.5 rounded border text-[10px] font-medium"
    style={{
      backgroundColor: "var(--accent-soft)",
      color: "var(--accent)",
      borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
    }}
  >
    {children}
  </span>
);

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const fmtDate = (d) => DATE_FMT.format(new Date(d));

const formatSubmitted = (iso) => (iso ? fmtDate(iso) : "-");

const sortedDates = (dates = []) =>
  [...(dates || [])]
    .filter((d) => d && !isNaN(new Date(d).getTime()))
    .sort((a, b) => new Date(a) - new Date(b));

const memoNumbersOf = (app) =>
  Array.isArray(app?.memo)
    ? app.memo.map((m) => m?.memoId?.memoNo).filter(Boolean)
    : [];

const memoLabelFromApp = (app) => {
  const labels = memoNumbersOf(app);
  return labels.length ? labels.join(", ") : "No Memo Attached";
};

const hasMemos = (app) => Array.isArray(app?.memo) && app.memo.length > 0;

const shortIdOf = (app) => (app?._id ? app._id.slice(-6).toUpperCase() : "-");

const getStatusColor = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "APPROVED":
      return "border-l-4 border-l-emerald-500";
    case "REJECTED":
      return "border-l-4 border-l-rose-500";
    case "PENDING":
      return "border-l-4 border-l-amber-500";
    case "CANCELLED":
      return "border-l-4 border-l-slate-400";
    case "REVOCATION_REQUESTED":
      return "border-l-4 border-l-purple-500";
    case "REVOKED":
      return "border-l-4 border-l-slate-500";
    default:
      return "border-l-4 border-l-slate-300";
  }
};

/* =========================
   STATUS TABS (theme-aware)
========================= */
const tabTone = {
  all: {
    bg: "var(--accent-soft)",
    text: "var(--accent)",
    br: "var(--accent-soft2, rgba(37,99,235,0.18))",
  },
  pending: {
    bg: "rgba(245,158,11,0.16)",
    text: "#d97706",
    br: "rgba(245,158,11,0.26)",
  },
  approved: {
    bg: "rgba(34,197,94,0.14)",
    text: "#16a34a",
    br: "rgba(34,197,94,0.22)",
  },
  rejected: {
    bg: "rgba(239,68,68,0.14)",
    text: "#ef4444",
    br: "rgba(239,68,68,0.22)",
  },
  purple: {
    bg: "rgba(168,85,247,0.16)",
    text: "#9333ea",
    br: "rgba(168,85,247,0.26)",
  },
  slate: {
    bg: "rgba(148,163,184,0.18)",
    text: "var(--app-text)",
    br: "rgba(148,163,184,0.24)",
  },
};

const getStatusTabs = (statusCounts = {}) => [
  {
    id: "",
    label: "All",
    count:
      typeof statusCounts.total === "number"
        ? statusCounts.total
        : (statusCounts.PENDING || 0) +
          (statusCounts.APPROVED || 0) +
          (statusCounts.REJECTED || 0) +
          (statusCounts.CANCELLED || 0) +
          (statusCounts.REVOCATION_REQUESTED || 0) +
          (statusCounts.REVOKED || 0),
    tone: "all",
  },
  {
    id: "PENDING",
    label: "Pending",
    count: statusCounts.PENDING || 0,
    tone: "pending",
  },
  {
    id: "APPROVED",
    label: "Approved",
    count: statusCounts.APPROVED || 0,
    tone: "approved",
  },
  {
    id: "REJECTED",
    label: "Rejected",
    count: statusCounts.REJECTED || 0,
    tone: "rejected",
  },
  {
    id: "CANCELLED",
    label: "Cancelled",
    count: statusCounts.CANCELLED || 0,
    tone: "slate",
  },
  {
    id: "REVOCATION_REQUESTED",
    label: "Revoke Req.",
    count: statusCounts.REVOCATION_REQUESTED || 0,
    tone: "purple",
  },
  {
    id: "REVOKED",
    label: "Revoked",
    count: statusCounts.REVOKED || 0,
    tone: "slate",
  },
];

/* =========================
   SMALL UI
========================= */
const MiniStat = ({ label, value, borderColor, first, color }) => (
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
      title={typeof value === "string" ? value : undefined}
    >
      {value}
    </div>
  </div>
);

// Memo numbers as chips. When there are more than `maxVisible`, a
// "View more" chip opens the Attached Memos modal directly.
const MemoChips = ({
  app,
  borderColor,
  onViewMemos,
  maxVisible = 1,
  showId = true,
}) => {
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

  const visible = memos.slice(0, maxVisible);
  const hiddenMemos = memos.slice(maxVisible);

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

        {hiddenMemos.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation(); // open the memos, not the row's details
              onViewMemos?.();
            }}
            title={`Also attached: ${hiddenMemos.join(", ")}`}
            aria-label={`View all ${memos.length} attached memos`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold whitespace-nowrap cursor-pointer transition-all duration-150 ease-out hover:brightness-90 hover:shadow-sm active:scale-95 ${FOCUS_RING}`}
            style={{
              backgroundColor: "var(--accent-soft)",
              borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
              color: "var(--accent)",
            }}
          >
            <Eye size={11} className="flex-none" />
            View more
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

/* ---- Dates: weekday + date pills; "+N" expands the rest inline ---- */
const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const SHOW_ALL_UP_TO = 2;

const DatePill = ({ date, borderColor }) => (
  <span
    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border whitespace-nowrap tabular-nums leading-5 text-xs"
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: borderColor || "var(--app-border, rgba(15,23,42,0.10))",
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

const DatesCell = ({ dates, borderColor, maxVisible = 1 }) => {
  const [expanded, setExpanded] = useState(false);
  const list = sortedDates(dates).map((d) => new Date(d));

  if (list.length === 0) {
    return (
      <span className="text-xs" style={{ color: "var(--app-muted)" }}>
        -
      </span>
    );
  }

  // Up to two dates are always shown in full; "+N" only appears for 3 or more
  const visibleCount = list.length <= SHOW_ALL_UP_TO ? list.length : maxVisible;
  const hiddenCount = Math.max(list.length - visibleCount, 0);
  const shown = expanded ? list : list.slice(0, visibleCount);

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      {shown.map((d, i) => (
        <DatePill
          key={`${d.getTime()}-${i}`}
          date={d}
          borderColor={borderColor}
        />
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
   ACTION MENU (portal, never clipped)
========================= */
// "Actions" trigger: solid accent like the apply buttons so it's easy to spot
// in every row; darker on hover, darker still while its menu is open.
const ACTIONS_BTN =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none shadow-sm " +
  "bg-[color:var(--accent)] text-white border-[color:var(--accent)] " +
  "transition-all duration-150 ease-out hover:shadow-md active:scale-95 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface)]";

const ACTIONS_BTN_IDLE = "hover:brightness-90 active:brightness-[0.82]";

const ACTIONS_BTN_OPEN = "brightness-[0.85]";

// Shared menu-item styles: pointer cursor, darker hover, darker still on press
const MENU_ITEM_NEUTRAL =
  "w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 text-left cursor-pointer " +
  "transition-colors duration-150 ease-out focus-visible:outline-none " +
  "text-[color:var(--app-text)] hover:bg-[color:var(--wl-hover)] hover:text-[color:var(--accent)] " +
  "active:bg-[color:var(--wl-press)] focus-visible:bg-[color:var(--wl-hover)] " +
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[color:var(--app-text)]";

const ApplicationActionMenu = ({
  app,
  onViewDetails,
  onViewMemos,
  borderColor,
  interactionVars,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, visible: false });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const memosAvailable = hasMemos(app);

  useLayoutEffect(() => {
    if (!isOpen) return;
    // Global theme CSS may put a `transition` on every element. Without this
    // the menu visibly slides in from the top-left corner when top/left are set.
    menuRef.current?.style.setProperty("transition", "none", "important");
    const btn = btnRef.current?.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 96;
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
    // Close on any scroll (capture catches the table's own scroll container)
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
              disabled={!memosAvailable}
              onClick={() => run(onViewMemos)}
              className={MENU_ITEM_NEUTRAL}
              title={memosAvailable ? "View memos" : "No memos attached"}
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
   APPLICATION CARD (compact)
========================= */
const ApplicationCard = ({
  app,
  leftStripClassName,
  onViewDetails,
  onViewMemos,
  borderColor,
}) => {
  const dates = sortedDates(app?.inclusiveDates);
  const coveredLabel = dates.length
    ? dates.length === 1
      ? fmtDate(dates[0])
      : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`
    : "-";

  const btn = `h-8 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all duration-150 ease-out bg-[color:var(--app-surface)] hover:bg-[color:var(--wl-hover)] hover:shadow-sm active:bg-[color:var(--wl-press)] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[color:var(--app-surface)] disabled:hover:shadow-none disabled:active:scale-100 ${FOCUS_RING}`;

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
      className={`rounded-xl shadow-sm overflow-hidden border-y border-r cursor-pointer transition-[box-shadow,background-color] duration-200 ease-out hover:shadow-md ${FOCUS_RING} ${leftStripClassName}`}
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <MemoChips
              app={app}
              borderColor={borderColor}
              onViewMemos={onViewMemos}
              showId={false}
            />
            <div
              className="mt-1 flex items-center gap-1.5 text-[11px] min-w-0"
              style={{ color: "var(--app-muted)" }}
            >
              <Calendar className="w-3.5 h-3.5 flex-none" />
              <span className="truncate" title={dates.map(fmtDate).join(", ")}>
                {coveredLabel}
              </span>
            </div>
          </div>
          <div className="flex-none">
            <StatusBadge status={app?.overallStatus} />
          </div>
        </div>

        <div
          className="mt-2.5 grid grid-cols-3 rounded-lg border"
          style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
        >
          <MiniStat
            first
            label="Hours"
            value={`${Number(app?.requestedHours || 0)}h`}
            color="var(--accent)"
            borderColor={borderColor}
          />
          <MiniStat
            label="Days"
            value={String(dates.length)}
            borderColor={borderColor}
          />
          <MiniStat
            label="Submitted"
            value={formatSubmitted(app?.createdAt)}
            borderColor={borderColor}
          />
        </div>

        {/* Button bar: taps in the gap between buttons don't open details */}
        <div
          data-no-row-click
          className="mt-2.5 grid grid-cols-2 gap-2 cursor-default"
        >
          <button
            onClick={onViewMemos}
            disabled={!hasMemos(app)}
            className={btn}
            type="button"
            style={{ borderColor, color: "var(--app-text)" }}
          >
            <FileText className="w-3.5 h-3.5" />
            Memos
          </button>
          <button
            onClick={onViewDetails}
            className={btn}
            type="button"
            style={{ borderColor, color: "var(--accent)" }}
          >
            <Eye className="w-3.5 h-3.5" />
            Details
          </button>
        </div>
      </div>
    </div>
  );
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
  label = "items",
  disabled = false,
  borderColor,
}) => {
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
          {total === 0 ? (
            `0 ${label}`
          ) : (
            <>
              <span className="font-bold" style={{ color: "var(--app-text)" }}>
                {startItem}-{endItem}
              </span>{" "}
              of{" "}
              <span className="font-bold" style={{ color: "var(--app-text)" }}>
                {total}
              </span>{" "}
              <span className="hidden sm:inline">{label}</span>
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-none">
        {navBtn(
          onPrev,
          disabled || page <= 1 || total === 0,
          <ChevronLeft className="w-4 h-4" />,
          "Previous page",
        )}
        <span
          className="text-xs font-mono font-semibold px-1.5"
          style={{ color: "var(--app-muted)" }}
        >
          {page} / {totalPages}
        </span>
        {navBtn(
          onNext,
          disabled || page >= totalPages || total === 0,
          <ChevronRight className="w-4 h-4" />,
          "Next page",
        )}
      </div>
    </div>
  );
};

/* =========================
   MAIN COMPONENT
========================= */
const ApplicationCtoTable = ({
  applications = [],
  status = "",
  onStatusChange,
  search = "",
  onSearchChange,
  page = 1,
  limit = 20,
  onLimitChange,
  onNextPage,
  onPrevPage,
  totalPages = 1,
  total,
  statusCounts,
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

  const [selectedApp, setSelectedApp] = useState(null);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  const openMemoModal = (memos) => setMemoModal({ isOpen: true, memos });
  const closeMemoModal = () => setMemoModal({ isOpen: false, memos: [] });

  const handleResetFilters = useCallback(() => {
    onSearchChange?.("");
    onStatusChange?.("");
  }, [onSearchChange, onStatusChange]);

  const isFiltered = status !== "" || search !== "";

  // Safe local filter (API usually already filters)
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchesStatus = !status ? true : app?.overallStatus === status;
      const matchesSearch = !search
        ? true
        : String(memoLabelFromApp(app) || "")
            .toLowerCase()
            .includes(String(search || "").toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [applications, status, search]);

  const computedCounts = useMemo(() => {
    if (statusCounts) return statusCounts;
    const c = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      CANCELLED: 0,
      REVOCATION_REQUESTED: 0,
      REVOKED: 0,
    };
    for (const app of applications) {
      const s = String(app?.overallStatus || "").toUpperCase();
      if (s in c) c[s] += 1;
    }
    c.total =
      typeof total === "number"
        ? total
        : Object.values(c).reduce((a, b) => a + b, 0);
    return c;
  }, [statusCounts, applications, total]);

  // Hide empty tabs (except "All" and the one currently selected)
  const tabs = useMemo(
    () =>
      getStatusTabs(computedCounts).filter(
        (t) => t.id === "" || t.count > 0 || t.id === status,
      ),
    [computedCounts, status],
  );

  const safeTotal = typeof total === "number" ? total : 0;
  const safeTotalPages = Math.max(totalPages || 1, 1);
  const startItem = safeTotal === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = safeTotal === 0 ? 0 : Math.min(page * limit, safeTotal);
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
                const t = tabTone[tab.tone] || tabTone.all;
                return (
                  <button
                    key={tab.id || "all"}
                    onClick={() => onStatusChange?.(tab.id)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-full border transition-colors duration-150 ease-out whitespace-nowrap flex items-center gap-1.5 ${FOCUS_RING} ${
                      isActive
                        ? "cursor-default"
                        : "cursor-pointer bg-[color:var(--app-surface)] text-[color:var(--app-muted)] hover:bg-[color:var(--wl-hover)] hover:text-[color:var(--app-text)] active:bg-[color:var(--wl-press)]"
                    }`}
                    aria-pressed={isActive}
                    type="button"
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
                className="w-full h-9 pl-9 pr-8 rounded-lg text-sm outline-none border transition-colors duration-200 ease-out"
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
                {search && <Chip>"{search}"</Chip>}
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
          {!isLoading && filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
              <div
                className="p-4 rounded-full mb-3 ring-1"
                style={{ backgroundColor: "var(--app-surface)", borderColor }}
              >
                <Filter
                  className="w-8 h-8"
                  style={{ color: "var(--app-muted)", opacity: 0.6 }}
                />
              </div>
              <h3
                className="text-base font-bold"
                style={{ color: "var(--app-text)" }}
              >
                No Results Found
              </h3>
              <p
                className="text-sm max-w-xs mt-1"
                style={{ color: "var(--app-muted)" }}
              >
                {isFiltered
                  ? "Try adjusting your search or filters."
                  : "This employee has no CTO applications yet."}
              </p>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className={`mt-4 flex items-center gap-2 px-3 h-8 text-xs font-bold border rounded-lg cursor-pointer transition-colors duration-150 ease-out bg-[color:var(--app-surface)] text-[color:var(--app-text)] hover:bg-[color:var(--wl-hover)] active:bg-[color:var(--wl-press)] ${FOCUS_RING}`}
                  type="button"
                  style={{ borderColor }}
                >
                  <RotateCcw size={12} /> Clear Filters
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
                        <Skeleton height={10} width="45%" />
                        <div className="mt-2.5">
                          <Skeleton height={46} />
                        </div>
                        <div className="mt-2.5">
                          <Skeleton height={32} />
                        </div>
                      </div>
                    ))
                  : filteredApps.map((app) => (
                      <ApplicationCard
                        key={app._id}
                        app={app}
                        borderColor={borderColor}
                        leftStripClassName={getStatusColor(app?.overallStatus)}
                        onViewDetails={() => setSelectedApp(app)}
                        onViewMemos={() => openMemoModal(app?.memo || [])}
                      />
                    ))}
              </div>

              {/* Desktop: table */}
              <table className={`${L.table} w-full text-left table-fixed`}>
                <colgroup>
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "14%" }} />
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
                    <th className="px-4 py-2.5">Reference / Memo</th>
                    <th className="px-4 py-2.5">Dates Covered</th>
                    <th className="px-4 py-2.5 text-center">Hours</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-center">Submitted</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
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
                    : filteredApps.map((app, i) => {
                        const bg =
                          i % 2 === 0
                            ? "var(--app-surface)"
                            : "var(--app-surface-2)";
                        const openDetails = () => setSelectedApp(app);
                        const openMemos = () => openMemoModal(app?.memo || []);

                        return (
                          <tr
                            key={app._id || i}
                            tabIndex={0}
                            // Clicking anywhere on the row (except its buttons) opens the details
                            onClick={(e) => {
                              if (shouldOpenFromClick(e)) openDetails();
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.target !== e.currentTarget ||
                                !isActivationKey(e)
                              )
                                return;
                              e.preventDefault();
                              openDetails();
                            }}
                            className="cursor-pointer transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)]"
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
                              <MemoChips
                                app={app}
                                borderColor={borderColor}
                                onViewMemos={openMemos}
                              />
                            </td>

                            <td className="px-4 py-2.5">
                              <DatesCell
                                dates={app?.inclusiveDates}
                                borderColor={borderColor}
                                maxVisible={1}
                              />
                            </td>

                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
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

                            <td className="px-4 py-2.5 text-center">
                              <StatusBadge status={app?.overallStatus} />
                            </td>

                            <td
                              className="px-4 py-2.5 text-center text-xs whitespace-nowrap"
                              style={{ color: "var(--app-muted)" }}
                            >
                              {formatSubmitted(app?.createdAt)}
                            </td>

                            {/* Clicks around the Actions button shouldn't open details */}
                            <td
                              data-no-row-click
                              className="px-4 py-2.5 text-right whitespace-nowrap cursor-default"
                            >
                              <ApplicationActionMenu
                                app={app}
                                borderColor={borderColor}
                                interactionVars={interactionVars}
                                onViewDetails={openDetails}
                                onViewMemos={openMemos}
                              />
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
          totalPages={safeTotalPages}
          total={safeTotal}
          startItem={startItem}
          endItem={endItem}
          limit={limit}
          onLimitChange={onLimitChange}
          label="applications"
          disabled={isLoading}
          onPrev={onPrevPage}
          onNext={onNextPage}
          borderColor={borderColor}
        />

        {/* DETAILS MODAL */}
        {selectedApp && (
          <Modal
            isOpen={!!selectedApp}
            onClose={() => setSelectedApp(null)}
            title="CTO Application Details"
            maxWidth="max-w-5xl"
          >
            <CtoApplicationDetails app={selectedApp} />
          </Modal>
        )}

        {/* MEMO MODAL */}
        <Modal
          isOpen={memoModal.isOpen}
          onClose={closeMemoModal}
          title="Attached Memos"
          closeLabel="Close"
          maxWidth="max-w-5xl"
        >
          <div className="w-full">
            <MemoList
              memos={memoModal.memos}
              description={"References used for this compensation request."}
            />
          </div>
        </Modal>
      </div>
    </SkeletonTheme>
  );
};

export default ApplicationCtoTable;
