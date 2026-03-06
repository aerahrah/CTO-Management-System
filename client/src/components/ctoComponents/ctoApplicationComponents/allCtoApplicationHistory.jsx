import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "../../statusUtils";
import { fetchAllCtoApplications } from "../../../api/cto";
import Modal from "../../modal";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Breadcrumbs from "../../breadCrumbs";
import MemoList from "../ctoMemoModal";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Calendar,
  FileText,
  Inbox,
  MoreVertical,
  LayoutGrid,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Layers,
  User,
  FileDown,
  ArrowUp,
} from "lucide-react";
import FilterSelect from "../../filterSelect";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";

// ✅ PDF Modal
import CtoApplicationPdfModal from "./ctoApplicationPDFModal";

import { useAuth } from "../../../store/authStore";

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

/* ✅ Reactive resolved theme for system mode (prevents skeleton flashing light) */
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
   StatCard (dark-mode ready)
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
        className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border transition-colors duration-300 ease-out"
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

/* =========================
   Per-row action menu (table) - dark-mode ready
========================= */
const ApplicationActionMenu = ({
  app,
  onViewDetails,
  onViewPdf,
  onViewMemos,
  borderColor,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
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
        aria-haspopup="true"
        aria-expanded={isOpen}
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
        title="Actions"
        type="button"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-xl z-30 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: "var(--app-surface)",
            border: `1px solid ${borderColor}`,
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
          }}
        >
          <button
            type="button"
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
          >
            <Eye size={14} /> View Details
          </button>

          <button
            type="button"
            onClick={() => handle(onViewPdf)}
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
          >
            <FileDown size={14} /> View PDF
          </button>

          <button
            type="button"
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
          >
            <FileText size={14} /> View Memos
          </button>
        </div>
      )}
    </div>
  );
};

/* =========================
   Cards (dark-mode ready)
========================= */
const ApplicationCard = ({
  app,
  leftStripClassName,
  onViewDetails,
  onViewPdf,
  onViewMemos,
  borderColor,
}) => {
  const memoLabel =
    Array.isArray(app?.memo) && app.memo.length
      ? app.memo
          .map((m) => m?.memoId?.memoNo)
          .filter(Boolean)
          .join(", ")
      : "No Memo Reference";

  const shortId = app?._id ? app._id.slice(-6).toUpperCase() : "-";

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

  const requestorName = `${app?.employee?.firstName || ""} ${
    app?.employee?.lastName || ""
  }`.trim();

  const requestorRole = app?.employee?.position || "-";

  const hasMemos = Array.isArray(app?.memo) && app.memo.length > 0;

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
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="text-sm font-bold truncate transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                {memoLabel}
              </span>
              <span
                className="text-[10px] font-mono flex-none transition-colors duration-300 ease-out"
                style={{ color: "var(--app-muted)" }}
              >
                #{shortId}
              </span>
            </div>

            <div className="mt-2 flex items-start gap-2">
              <User
                className="w-4 h-4 mt-[2px] flex-none"
                style={{ color: "var(--app-muted)" }}
              />
              <div className="min-w-0">
                <div
                  className="text-xs font-semibold truncate transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-text)" }}
                >
                  {requestorName || "-"}
                </div>
                <div
                  className="text-[11px] truncate transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  {requestorRole}
                </div>
              </div>
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
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <Clock className="w-3.5 h-3.5" /> Hours
            </div>
            <div
              className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {Number(app?.requestedHours || 0)}h
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
              <Calendar className="w-3.5 h-3.5" /> Submitted
            </div>
            <div
              className="mt-1 text-sm font-semibold truncate transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {submittedLabel}
            </div>
          </div>
        </div>

        <div
          className="mt-3 flex items-center gap-2 text-xs transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          <Layers className="w-4 h-4" style={{ color: "var(--app-muted)" }} />
          <span className="truncate">{coveredCount} day(s) covered</span>
        </div>
      </div>

      <div
        className="border-t p-3 transition-colors duration-300 ease-out"
        style={{
          borderColor: borderColor,
          backgroundColor: "var(--app-surface)",
        }}
      >
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onViewMemos}
            disabled={!hasMemos}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor: borderColor,
              color: "var(--app-text)",
            }}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.filter = "brightness(0.98)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
            }}
          >
            <FileText className="w-4 h-4" />
            Memos
          </button>

          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border transition-colors duration-200 ease-out"
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
          >
            <Eye className="w-4 h-4" />
            Details
          </button>

          <button
            type="button"
            onClick={onViewPdf}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border transition-colors duration-200 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
              color: "var(--app-text)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   Status tabs factory
========================= */
const statusTabs = (statusCounts = {}, totalFallback = 0) => {
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
   Compact Pagination (dark-mode ready)
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
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
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
            className="text-xs font-mono font-semibold transition-colors duration-300 ease-out"
            style={{ color: "var(--app-text)" }}
          >
            {page} / {safeTotalPages}
          </div>
          <div
            className="text-[11px] truncate transition-colors duration-300 ease-out"
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
            type="button"
            onClick={onPrev}
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
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
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const AllCtoApplicationsHistory = () => {
  // ✅ Theme vars + skeleton colors
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

  // ---- Selected app / memos ----
  const [selectedApp, setSelectedApp] = useState(null);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  // ✅ PDF modal state
  const [pdfApp, setPdfApp] = useState(null);

  // ---- Filters / pagination ----
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 500);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // ✅ Scroll container (mobile) + scroll-to-top
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

  // ---- Data fetching ----
  const { data, isLoading } = useQuery({
    queryKey: [
      "ctoAllApplications",
      page,
      limit,
      statusFilter,
      debouncedSearch,
    ],
    queryFn: () =>
      fetchAllCtoApplications({
        page,
        limit,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
      }),
    keepPreviousData: true,
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

  // keep page within range if totalPages changes
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
    setPage(1);
  }, []);

  const isFiltered = statusFilter !== "" || debouncedSearch !== "";

  // ✅ left strip class
  const getStatusStripClass = useCallback((status) => {
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
  }, []);

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

  return (
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
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
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
              </div>

              {/* Stat cards */}
              <div className="w-full md:w-auto flex-1 lg:flex-none flex flex-col gap-3 md:ml-4">
                <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
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
                    value={String(statPending || 0)}
                    icon={AlertCircle}
                    hint="Awaiting action"
                    tone="amber"
                    borderColor={borderColor}
                  />
                  <StatCard
                    title="Total Approved"
                    value={String(statApproved || 0)}
                    icon={CheckCircle2}
                    hint="Approved requests"
                    tone="green"
                    borderColor={borderColor}
                  />
                  <StatCard
                    title="Total Rejected"
                    value={String(statRejected || 0)}
                    icon={XCircle}
                    hint="Rejected requests"
                    tone="red"
                    borderColor={borderColor}
                  />
                </div>

                {/* Mobile compact */}
                <div className="flex lg:hidden flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Total", value: totalRequests || 0 },
                      { label: "Pending", value: statPending || 0 },
                      { label: "Approved", value: statApproved || 0 },
                      { label: "Rejected", value: statRejected || 0 },
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
              {/* end stats */}
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
              style={{
                backgroundColor: "var(--app-surface-2)",
                borderColor: borderColor,
              }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {statusTabs(statusCounts, pagination.total).map((tab) => {
                    const isActive = statusFilter === tab.id;
                    const Icon = tab.icon;

                    return (
                      <button
                        key={tab.id || "all-status"}
                        onClick={() => {
                          setStatusFilter(tab.id);
                          setPage(1);
                        }}
                        className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-2
                          ${
                            isActive
                              ? tab.activeColor
                              : "bg-[color:var(--app-surface)] text-[color:var(--app-muted)] border-[color:var(--app-border)] hover:bg-[color:var(--app-surface-2)]"
                          }`}
                        aria-pressed={isActive}
                        type="button"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                        <span
                          className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ease-out"
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

                {/* Search + limit */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
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
                        onClick={() => setSearchInput("")}
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
                    className="md:hidden flex items-center gap-1.5 px-2 border-l ml-1"
                    style={{ borderColor: borderColor }}
                  >
                    <span
                      className="text-xs font-medium uppercase tracking-wider"
                      style={{ color: "var(--app-muted)" }}
                    >
                      shows
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

              {/* Active chips + reset */}
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
                          borderColor:
                            "var(--accent-soft2, rgba(37,99,235,0.18))",
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
                          borderColor:
                            "var(--accent-soft2, rgba(37,99,235,0.18))",
                        }}
                      >
                        {statusFilter}
                      </span>
                    )}
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

            {/* Data region */}
            <div
              className="min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-y-auto transition-colors duration-300 ease-out cto-scrollbar"
              style={{ backgroundColor: "var(--app-bg)" }}
            >
              {!isLoading && applications.length === 0 ? (
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
                      className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold border rounded-lg transition-colors duration-200 ease-out"
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
                  {/* Mobile: cards */}
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
                        : applications.map((app) => (
                            <ApplicationCard
                              key={app._id}
                              app={app}
                              borderColor={borderColor}
                              leftStripClassName={getStatusStripClass(
                                app.overallStatus,
                              )}
                              onViewDetails={() => setSelectedApp(app)}
                              onViewPdf={() => setPdfApp(app)}
                              onViewMemos={() => openMemoModal(app.memo)}
                            />
                          ))}
                    </div>
                  </div>

                  {/* Tablet: 2 cards */}
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
                        : applications.map((app) => (
                            <ApplicationCard
                              key={app._id}
                              app={app}
                              borderColor={borderColor}
                              leftStripClassName={getStatusStripClass(
                                app.overallStatus,
                              )}
                              onViewDetails={() => setSelectedApp(app)}
                              onViewPdf={() => setPdfApp(app)}
                              onViewMemos={() => openMemoModal(app.memo)}
                            />
                          ))}
                    </div>
                  </div>

                  {/* Desktop: table */}
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
                          <th className="px-6 py-4 font-bold">Requestor</th>
                          <th className="px-6 py-4 font-bold">
                            Reference / Memo
                          </th>
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
                                {[...Array(7)].map((__, j) => (
                                  <td key={j} className="px-6 py-4">
                                    <Skeleton />
                                  </td>
                                ))}
                              </tr>
                            ))
                          : applications.map((app, i) => {
                              const memoLabel =
                                Array.isArray(app.memo) && app.memo.length
                                  ? app.memo
                                      .map((m) => m?.memoId?.memoNo)
                                      .filter(Boolean)
                                      .join(", ")
                                  : "No Memo Attached";

                              const bg =
                                i % 2 === 0
                                  ? "var(--app-surface)"
                                  : "var(--app-surface-2)";

                              return (
                                <tr
                                  key={app._id}
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
                                        {app?.employee?.firstName || ""}{" "}
                                        {app?.employee?.lastName || ""}
                                      </span>
                                      <span
                                        className="text-[10px] font-mono mt-0.5"
                                        style={{ color: "var(--app-muted)" }}
                                      >
                                        {app?.employee?.position || "-"}
                                      </span>
                                    </div>
                                  </td>

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
                                        {app._id
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
                                      {Number(app?.requestedHours || 0)}h
                                    </span>
                                  </td>

                                  <td className="px-6 py-4 text-center">
                                    <StatusBadge status={app.overallStatus} />
                                  </td>

                                  <td
                                    className="px-6 py-4 text-center text-sm"
                                    style={{ color: "var(--app-muted)" }}
                                  >
                                    {formatSubmitted(app.createdAt)}
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
                                        {formatCoveredDates(app.inclusiveDates)}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="px-6 py-4 text-right">
                                    <ApplicationActionMenu
                                      app={app}
                                      borderColor={borderColor}
                                      onViewDetails={() => setSelectedApp(app)}
                                      onViewPdf={() => setPdfApp(app)}
                                      onViewMemos={() =>
                                        openMemoModal(app.memo)
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

        {/* PDF Modal */}
        <CtoApplicationPdfModal
          app={pdfApp}
          isOpen={!!pdfApp}
          onClose={() => setPdfApp(null)}
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
            description={
              "Read-only view of CTO memos attached to this request."
            }
          />
        </Modal>
      </SkeletonTheme>
    </div>
  );
};

export default AllCtoApplicationsHistory;
