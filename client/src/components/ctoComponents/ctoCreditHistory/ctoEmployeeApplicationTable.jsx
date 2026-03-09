// ctoEmployeeApplicationTable.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { StatusBadge } from "../../statusUtils";
import FilterSelect from "../../filterSelect";
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
  MoreVertical,
  Eye,
  Calendar,
  Clock,
  LayoutGrid,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  Layers,
} from "lucide-react";

/* =========================
   CONSTANTS
========================= */
const pageSizeOptions = [20, 50, 100];

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

const formatSubmitted = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "-";

const formatCoveredDates = (dates = []) =>
  (dates || [])
    .map((d) =>
      new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    )
    .join(", ");

const memoLabelFromApp = (app) => {
  if (!Array.isArray(app?.memo) || app.memo.length === 0)
    return "No Memo Attached";
  const labels = app.memo.map((m) => m?.memoId?.memoNo).filter(Boolean);
  return labels.length ? labels.join(", ") : "No Memo Attached";
};

// ✅ Left status strip for cards (MyCtoApplications basis)
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
};

const getStatusTabs = (statusCounts = {}) => [
  {
    id: "",
    label: "All Status",
    icon: LayoutGrid,
    count:
      typeof statusCounts.total === "number"
        ? statusCounts.total
        : (statusCounts.PENDING || 0) +
          (statusCounts.APPROVED || 0) +
          (statusCounts.REJECTED || 0) +
          (statusCounts.CANCELLED || 0),
    tone: "all",
  },
  {
    id: "PENDING",
    label: "Pending",
    icon: AlertCircle,
    count: statusCounts.PENDING || 0,
    tone: "pending",
  },
  {
    id: "APPROVED",
    label: "Approved",
    icon: CheckCircle2,
    count: statusCounts.APPROVED || 0,
    tone: "approved",
  },
  {
    id: "REJECTED",
    label: "Rejected",
    icon: XCircle,
    count: statusCounts.REJECTED || 0,
    tone: "rejected",
  },
];

/* =========================
   ACTION MENU (theme-aware)
========================= */
const ApplicationActionMenu = ({
  app,
  onViewDetails,
  onViewMemos,
  borderColor,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setIsOpen(false);
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handle = (cb) => {
    cb?.();
    setIsOpen(false);
  };

  const hasMemos = Array.isArray(app?.memo) && app.memo.length > 0;

  return (
    <div className="relative inline-flex justify-end" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((o) => !o);
        }}
        className="p-1.5 rounded-md transition-colors duration-200 ease-out"
        style={{ color: "var(--app-muted)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
          e.currentTarget.style.color = "var(--app-text)";
        }}
        onMouseLeave={(e) => {
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
          className="absolute right-0 top-full mt-1 w-44 rounded-lg z-30 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: "var(--app-surface)",
            border: `1px solid ${borderColor}`,
            boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
          }}
        >
          <button
            onClick={() => handle(onViewDetails)}
            className="w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition-colors text-left"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--app-muted)";
            }}
            type="button"
          >
            <Eye size={14} /> View Details
          </button>

          <button
            disabled={!hasMemos}
            onClick={() => handle(onViewMemos)}
            className="w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--app-muted)";
            }}
            type="button"
          >
            <FileText size={14} /> View Memos
          </button>
        </div>
      )}
    </div>
  );
};

/* =========================
   APPLICATION CARD (theme-aware)
========================= */
const ApplicationCard = ({
  app,
  leftStripClassName,
  onViewDetails,
  onViewMemos,
  borderColor,
}) => {
  const memoLabel = memoLabelFromApp(app);

  const submittedLabel = app?.createdAt
    ? new Date(app.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

  const coveredCount = Array.isArray(app?.inclusiveDates)
    ? app.inclusiveDates.length
    : 0;

  return (
    <div
      className={`rounded-xl shadow-sm overflow-hidden border-y border-r transition-colors duration-300 ease-out ${leftStripClassName}`}
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-bold truncate"
                style={{ color: "var(--app-text)" }}
              >
                {memoLabel || "No Memo Reference"}
              </span>
            </div>

            <div
              className="mt-2 flex items-center gap-2 text-xs"
              style={{ color: "var(--app-muted)" }}
            >
              <Calendar
                className="w-4 h-4"
                style={{ color: "var(--app-muted)" }}
              />
              <span className="truncate">{submittedLabel}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 flex-none">
            <StatusBadge status={app?.overallStatus} />
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
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--app-muted)" }}
            >
              <Clock className="w-3.5 h-3.5" /> Hours
            </div>
            <div
              className="mt-1 text-sm font-semibold"
              style={{ color: "var(--app-text)" }}
            >
              {typeof app?.requestedHours === "number"
                ? `${app.requestedHours}h`
                : `${Number(app?.requestedHours || 0)}h`}
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
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--app-muted)" }}
            >
              <Layers className="w-3.5 h-3.5" /> Covered
            </div>
            <div
              className="mt-1 text-sm font-semibold"
              style={{ color: "var(--app-text)" }}
            >
              {coveredCount} day(s)
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
        <div className="grid gap-2 grid-cols-2">
          <button
            onClick={onViewMemos}
            disabled={!app?.memo || app.memo.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
            type="button"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor: borderColor,
              color: "var(--app-text)",
            }}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.filter = "brightness(0.98)";
            }}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
          >
            <FileText className="w-4 h-4" />
            Memos
          </button>

          <button
            onClick={onViewDetails}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border transition-colors duration-200 ease-out"
            type="button"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
              color: "var(--accent)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--accent-soft)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--app-surface)")
            }
          >
            <Eye className="w-4 h-4" />
            Details
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   PAGINATION (theme-aware)
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
  disabled = false,
  borderColor,
}) => (
  <div
    className="px-4 md:px-6 py-3 border-t transition-colors duration-300 ease-out"
    style={{ backgroundColor: "var(--app-surface)", borderColor: borderColor }}
  >
    <div className="flex md:hidden items-center justify-between gap-3">
      <button
        onClick={onPrev}
        disabled={disabled || page === 1 || total === 0}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
        type="button"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: borderColor,
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
          {page} / {totalPages}
        </div>
        <div
          className="text-[11px] truncate"
          style={{ color: "var(--app-muted)" }}
        >
          {total === 0 ? `0 ${label}` : `${startItem}-${endItem} of ${total}`}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={disabled || page >= totalPages || total === 0}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
        type="button"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: borderColor,
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
        className="flex items-center gap-1 p-1 rounded-lg border transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor: borderColor,
        }}
      >
        <button
          onClick={onPrev}
          disabled={disabled || page === 1 || total === 0}
          className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
          type="button"
          style={{ color: "var(--app-muted)" }}
          onMouseEnter={(e) => {
            if (e.currentTarget.disabled) return;
            e.currentTarget.style.backgroundColor = "var(--app-surface)";
          }}
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
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
          disabled={disabled || page >= totalPages || total === 0}
          className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
          type="button"
          style={{ color: "var(--app-muted)" }}
          onMouseEnter={(e) => {
            if (e.currentTarget.disabled) return;
            e.currentTarget.style.backgroundColor = "var(--app-surface)";
          }}
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

/* =========================
   MAIN COMPONENT (theme-aware)
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
  total, // from API
  statusCounts, // optional from API
  isLoading,
}) => {
  // ✅ Theme-aware primitives (ThemeSync is mounted in App.jsx; we only need these for skeleton + borders)
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
    const c = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
    for (const app of applications) {
      const s = String(app?.overallStatus || "").toUpperCase();
      if (s in c) c[s] += 1;
    }
    c.total =
      typeof total === "number"
        ? total
        : c.PENDING + c.APPROVED + c.REJECTED + c.CANCELLED;
    return c;
  }, [statusCounts, applications, total]);

  const tabs = useMemo(() => getStatusTabs(computedCounts), [computedCounts]);

  const safeTotal = typeof total === "number" ? total : 0;
  const safeTotalPages = Math.max(totalPages || 1, 1);
  const startItem = safeTotal === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = safeTotal === 0 ? 0 : Math.min(page * limit, safeTotal);

  return (
    <SkeletonTheme
      baseColor={skeletonColors.baseColor}
      highlightColor={skeletonColors.highlightColor}
    >
      <div
        className="w-full flex-1 flex h-full flex-col overflow-hidden transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text)",
        }}
      >
        {/* TOOLBAR */}
        <div
          className="py-2 border-b space-y-4 transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-1">
            {/* Status Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => {
                const isActive = status === tab.id;
                const t =
                  tabTone[
                    tab.tone === "pending"
                      ? "pending"
                      : tab.tone === "approved"
                        ? "approved"
                        : tab.tone === "rejected"
                          ? "rejected"
                          : "all"
                  ] || tabTone.all;

                return (
                  <button
                    key={tab.id || "all"}
                    onClick={() => onStatusChange?.(tab.id)}
                    className="px-3 py-1.5 text-xs font-bold rounded-full border transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-2"
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
                    <span>{tab.label}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ease-out"
                      style={{
                        backgroundColor: isActive
                          ? "rgba(255,255,255,0.35)"
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

            {/* Search + Rows */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-56">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--app-muted)" }}
                />
                <input
                  type="text"
                  placeholder="Search memo..."
                  value={search}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-lg text-sm outline-none border transition-colors duration-200 ease-out"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: borderColor,
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--app-text)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--app-muted)";
                    }}
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>

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
                  className="border text-xs rounded-lg focus:ring-0 block p-1.5 font-medium outline-none cursor-pointer transition-colors duration-200 ease-out"
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
                className="md:hidden flex items-center gap-1.5 px-2 border-l ml-1"
                style={{ borderColor: borderColor }}
              >
                <span
                  className="text-xs font-medium uppercase tracking-wider"
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

          {/* Active Filters */}
          {isFiltered && (
            <div className="flex items-center justify-between px-2">
              <div className="flex flex-wrap items-center gap-2">
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
                className="flex items-center gap-1 text-[10px] font-bold uppercase transition-colors duration-200 ease-out"
                style={{ color: "var(--accent)" }}
                type="button"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          )}
        </div>

        {/* DATA */}
        <div
          className="flex-1 overflow-y-auto min-h-[300px] cto-scrollbar transition-colors duration-300 ease-out"
          style={{ backgroundColor: "var(--app-bg)" }}
        >
          {!isLoading && filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
              <div
                className="p-6 rounded-full mb-4 ring-1"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: borderColor,
                }}
              >
                <Filter
                  className="w-10 h-10"
                  style={{ color: "var(--app-muted)", opacity: 0.6 }}
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
                Try adjusting your search or filters to find what you're looking
                for.
              </p>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="mt-6 flex items-center gap-2 px-4 py-2 text-xs font-bold border rounded-lg transition-colors duration-200 ease-out"
                  type="button"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: borderColor,
                    color: "var(--app-text)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--app-surface-2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--app-surface)")
                  }
                >
                  <RotateCcw size={12} /> Clear Filters
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
                    : filteredApps.map((app) => (
                        <ApplicationCard
                          key={app._id}
                          app={app}
                          borderColor={borderColor}
                          leftStripClassName={getStatusColor(
                            app?.overallStatus,
                          )}
                          onViewDetails={() => setSelectedApp(app)}
                          onViewMemos={() => openMemoModal(app?.memo || [])}
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
                    : filteredApps.map((app) => (
                        <ApplicationCard
                          key={app._id}
                          app={app}
                          borderColor={borderColor}
                          leftStripClassName={getStatusColor(
                            app?.overallStatus,
                          )}
                          onViewDetails={() => setSelectedApp(app)}
                          onViewMemos={() => openMemoModal(app?.memo || [])}
                        />
                      ))}
                </div>
              </div>

              {/* ✅ Desktop: table ONLY at lg+ */}
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
                      <th className="px-6 py-4 font-bold">Reference / Memo</th>
                      <th className="px-6 py-4 text-center">Hours</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Submitted</th>
                      <th className="px-6 py-4">Dates Covered</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {isLoading
                      ? [...Array(8)].map((_, i) => (
                          <tr key={i}>
                            {[...Array(6)].map((__, j) => (
                              <td key={j} className="px-6 py-4">
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
                              style={{ backgroundColor: bg }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "var(--accent-soft)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = bg;
                              }}
                            >
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span
                                    className="font-semibold text-sm"
                                    style={{ color: "var(--app-text)" }}
                                  >
                                    {memoLabel}
                                  </span>
                                  <span
                                    className="text-[10px] font-mono mt-0.5"
                                    style={{ color: "var(--app-muted)" }}
                                  >
                                    ID:{" "}
                                    {app?._id
                                      ? app._id.slice(-6).toUpperCase()
                                      : "-"}
                                  </span>
                                </div>
                              </td>

                              <td className="px-6 py-4 text-center">
                                <span
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-bold"
                                  style={{
                                    backgroundColor: "var(--app-surface)",
                                    borderColor: borderColor,
                                    color: "var(--app-text)",
                                  }}
                                >
                                  {app?.requestedHours ?? 0}h
                                </span>
                              </td>

                              <td className="px-6 py-4 text-center">
                                <StatusBadge status={app?.overallStatus} />
                              </td>

                              <td
                                className="px-6 py-4 text-center text-sm"
                                style={{ color: "var(--app-muted)" }}
                              >
                                {formatSubmitted(app?.createdAt)}
                              </td>

                              <td
                                className="px-6 py-4 text-sm"
                                style={{ color: "var(--app-muted)" }}
                              >
                                <div className="flex items-center gap-2">
                                  <Calendar
                                    size={14}
                                    style={{ color: "var(--app-muted)" }}
                                  />
                                  <span className="truncate">
                                    {formatCoveredDates(
                                      app?.inclusiveDates || [],
                                    )}
                                  </span>
                                </div>
                              </td>

                              <td className="px-6 py-4 text-right">
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
              </div>
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
