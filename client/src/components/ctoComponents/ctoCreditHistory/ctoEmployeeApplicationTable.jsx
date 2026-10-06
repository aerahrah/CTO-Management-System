// ctoEmployeeApplicationTable.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
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
  RotateCcw,
  FileText,
  Eye,
  Calendar,
  Filter,
  MoreVertical,
} from "lucide-react";

/* =========================
   CONSTANTS
========================= */
const pageSizeOptions = [20, 50, 100];
const MAX_VISIBLE_DATES = 2;
const MENU_WIDTH = 176; // w-44
const MENU_HEIGHT = 96; // 2 items + padding

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

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatSubmitted = (iso) => (iso ? fmtDate(iso) : "-");

const sortedDates = (dates = []) =>
  [...(dates || [])]
    .filter((d) => d && !isNaN(new Date(d).getTime()))
    .sort((a, b) => new Date(a) - new Date(b));

const memoLabelFromApp = (app) => {
  if (!Array.isArray(app?.memo) || app.memo.length === 0)
    return "No Memo Attached";
  const labels = app.memo.map((m) => m?.memoId?.memoNo).filter(Boolean);
  return labels.length ? labels.join(", ") : "No Memo Attached";
};

const hasMemos = (app) => Array.isArray(app?.memo) && app.memo.length > 0;

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

const DatesCell = ({ dates, borderColor }) => {
  const list = sortedDates(dates);
  if (list.length === 0) {
    return (
      <span className="text-xs" style={{ color: "var(--app-muted)" }}>
        -
      </span>
    );
  }

  const visible = list.slice(0, MAX_VISIBLE_DATES);
  const hidden = list.length - visible.length;
  const fullLabel = list.map(fmtDate).join(", ");

  return (
    <div className="flex flex-wrap items-center gap-1" title={fullLabel}>
      {visible.map((d, i) => (
        <span
          key={`${d}-${i}`}
          className="px-1.5 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor,
            color: "var(--app-text)",
          }}
        >
          {fmtDate(d)}
        </span>
      ))}
      {hidden > 0 && (
        <span
          className="px-1.5 py-0.5 rounded-md text-[11px] font-bold"
          style={{
            backgroundColor: "var(--accent-soft)",
            color: "var(--accent)",
          }}
        >
          +{hidden}
        </span>
      )}
    </div>
  );
};

/* =========================
   ACTION MENU (theme-aware)
   Uses fixed positioning so it never gets clipped by the
   scrollable table container, and flips upward near the bottom.
========================= */
const ApplicationActionMenu = ({
  app,
  onViewDetails,
  onViewMemos,
  borderColor,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => setIsOpen(false), []);

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < MENU_HEIGHT + 8
        ? rect.top - MENU_HEIGHT - 4 // open upward
        : rect.bottom + 4; // open downward
    const left = Math.max(8, rect.right - MENU_WIDTH);

    setPos({ top, left });
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        menuRef.current?.contains(e.target) ||
        buttonRef.current?.contains(e.target)
      )
        return;
      close();
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    // Close on any scroll (capture catches the table's own scroll container)
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, close]);

  const handle = (cb) => {
    cb?.();
    close();
  };

  const memosAvailable = hasMemos(app);

  const itemClass =
    "w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left";

  const itemHoverIn = (e) => {
    if (e.currentTarget.disabled) return;
    e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
    e.currentTarget.style.color = "var(--accent)";
  };
  const itemHoverOut = (e) => {
    e.currentTarget.style.backgroundColor = "transparent";
    e.currentTarget.style.color = "var(--app-muted)";
  };

  return (
    <div className="relative inline-flex justify-end">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) close();
          else openMenu();
        }}
        className="p-1.5 rounded-md transition-colors duration-200 ease-out"
        style={{
          color: isOpen ? "var(--accent)" : "var(--app-muted)",
          backgroundColor: isOpen ? "var(--app-surface-2)" : "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
          e.currentTarget.style.color = "var(--app-text)";
        }}
        onMouseLeave={(e) => {
          if (isOpen) return;
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--app-muted)";
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Actions"
        type="button"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed w-44 rounded-lg z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: pos.top,
            left: pos.left,
            backgroundColor: "var(--app-surface)",
            border: `1px solid ${borderColor}`,
            boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
          }}
        >
          <button
            role="menuitem"
            onClick={() => handle(onViewDetails)}
            className={itemClass}
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={itemHoverIn}
            onMouseLeave={itemHoverOut}
            type="button"
          >
            <Eye size={14} /> View Details
          </button>

          <button
            role="menuitem"
            disabled={!memosAvailable}
            onClick={() => handle(onViewMemos)}
            className={itemClass}
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={itemHoverIn}
            onMouseLeave={itemHoverOut}
            type="button"
            title={memosAvailable ? "View memos" : "No memos attached"}
          >
            <FileText size={14} /> View Memos
          </button>
        </div>
      )}
    </div>
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
  const memoLabel = memoLabelFromApp(app);
  const dates = sortedDates(app?.inclusiveDates);
  const coveredLabel = dates.length
    ? dates.length === 1
      ? fmtDate(dates[0])
      : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`
    : "-";

  return (
    <div
      className={`rounded-xl shadow-sm overflow-hidden border-y border-r transition-colors duration-300 ease-out ${leftStripClassName}`}
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className="text-sm font-bold truncate"
              style={{ color: "var(--app-text)" }}
              title={memoLabel}
            >
              {memoLabel}
            </div>
            <div
              className="mt-0.5 flex items-center gap-1.5 text-[11px] min-w-0"
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

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button
            onClick={onViewMemos}
            disabled={!hasMemos(app)}
            className="h-8 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
            type="button"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
              color: "var(--app-text)",
            }}
          >
            <FileText className="w-3.5 h-3.5" />
            Memos
          </button>
          <button
            onClick={onViewDetails}
            className="h-8 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold border transition-colors duration-200 ease-out"
            type="button"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
              color: "var(--accent)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--accent-soft)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--app-surface)")
            }
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
      className="h-8 w-8 inline-flex items-center justify-center rounded-md border disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor,
        color: "var(--app-text)",
      }}
      onMouseEnter={(e) => {
        if (e.currentTarget.disabled) return;
        e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--app-surface)";
      }}
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
            className="h-8 border text-xs rounded-md px-1.5 font-semibold outline-none cursor-pointer transition-colors duration-200 ease-out"
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
}) => {
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
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text)",
        }}
      >
        {/* TOOLBAR (single compact row) */}
        <div
          className="flex-none border-b px-1 py-2 space-y-2 transition-colors duration-300 ease-out"
          style={{ backgroundColor: "var(--app-surface)", borderColor }}
        >
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
              {tabs.map((tab) => {
                const isActive = status === tab.id;
                const t = tabTone[tab.tone] || tabTone.all;
                return (
                  <button
                    key={tab.id || "all"}
                    onClick={() => onStatusChange?.(tab.id)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-full border transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-1.5"
                    aria-pressed={isActive}
                    type="button"
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

            <div className="relative w-full md:w-60 flex-none">
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors duration-200 ease-out"
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
                className="flex items-center gap-1 text-[10px] font-bold uppercase"
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
                  className="mt-4 flex items-center gap-2 px-3 h-8 text-xs font-bold border rounded-lg transition-colors duration-200 ease-out"
                  type="button"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor,
                    color: "var(--app-text)",
                  }}
                >
                  <RotateCcw size={12} /> Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile + Tablet: cards */}
              <div className="lg:hidden p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
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
              <table className="hidden lg:table w-full text-left table-fixed">
                <colgroup>
                  <col style={{ width: "31%" }} />
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "6%" }} />
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
                    <th className="px-4 py-2.5 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
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
                        const memoLabel = memoLabelFromApp(app);
                        const bg =
                          i % 2 === 0
                            ? "var(--app-surface)"
                            : "var(--app-surface-2)";

                        return (
                          <tr
                            key={app._id || i}
                            className="transition-colors duration-200 ease-out"
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
                                title={memoLabel}
                              >
                                {memoLabel}
                              </div>
                              <div
                                className="text-[10px] font-mono mt-0.5"
                                style={{ color: "var(--app-muted)" }}
                              >
                                ID:{" "}
                                {app?._id
                                  ? app._id.slice(-6).toUpperCase()
                                  : "-"}
                              </div>
                            </td>

                            <td className="px-4 py-2.5">
                              <DatesCell
                                dates={app?.inclusiveDates}
                                borderColor={borderColor}
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

                            <td className="px-4 py-2.5 text-right">
                              <ApplicationActionMenu
                                app={app}
                                borderColor={borderColor}
                                onViewDetails={() => setSelectedApp(app)}
                                onViewMemos={() =>
                                  openMemoModal(app?.memo || [])
                                }
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
