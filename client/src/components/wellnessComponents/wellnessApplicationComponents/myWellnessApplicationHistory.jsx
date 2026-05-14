import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  Filter,
  RotateCcw,
  Calendar,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LayoutGrid,
  Ban,
  Info,
  ArrowUp,
  HeartPulse,
} from "lucide-react";

import {
  fetchMyWellnessApplications,
  cancelWellnessApplicationRequest,
} from "../../../api/wellnessApplication";
import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import Breadcrumbs from "../../breadCrumbs";
import FilterSelect from "../../filterSelect";
import AddWellnessApplicationForm from "./forms/addWellnessApplicationForm";
import { useAuth } from "../../../store/authStore";

const pageSizeOptions = [20, 50, 100];

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

/* ------------------ Theme Maps ------------------ */
const tabTone = {
  accent: {
    bg: "var(--accent-soft)",
    text: "var(--accent)",
    br: "var(--accent-soft2, rgba(37,99,235,0.18))",
  },
  amber: {
    bg: "rgba(245,158,11,0.16)",
    text: "#d97706",
    br: "rgba(245,158,11,0.26)",
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
  slate: {
    bg: "rgba(148,163,184,0.18)",
    text: "var(--app-text)",
    br: "rgba(148,163,184,0.24)",
  },
};

/* =========================
   Per-row Action Menu
========================= */
const ApplicationActionMenu = ({
  app,
  onViewDetails,
  onCancel,
  cancelling,
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

  const canCancel =
    String(app?.overallStatus || "").toUpperCase() === "PENDING";

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
          className="absolute right-0 top-full mt-1 w-48 rounded-lg z-30 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
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
            disabled={!canCancel || cancelling}
            onClick={() => handle(onCancel)}
            className="w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
            type="button"
            title={
              !canCancel ? "Only PENDING applications can be cancelled" : ""
            }
            style={{ color: "#ef4444" }}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Ban size={14} /> {cancelling ? "Cancelling..." : "Cancel Request"}
          </button>
        </div>
      )}
    </div>
  );
};

/* =========================
   Mobile/Tablet Card View
========================= */
const ApplicationCard = ({
  app,
  leftStripClassName,
  onViewDetails,
  onCancel,
  cancelling,
  borderColor,
}) => {
  const canCancel =
    String(app?.overallStatus || "").toUpperCase() === "PENDING";

  const formatDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "-";

  const startLabel = formatDate(app?.startDate);
  const endLabel = formatDate(app?.endDate);
  const actionCols = canCancel ? "grid-cols-2" : "grid-cols-1";

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
                className="text-sm font-bold truncate transition-colors duration-300 ease-out flex items-center gap-1.5"
                style={{ color: "var(--app-text)" }}
              >
                <HeartPulse size={16} style={{ color: "var(--accent)" }} />
                Wellness Leave
              </span>
            </div>

            <div
              className="mt-2 flex items-center gap-2 text-xs transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <Calendar className="w-4 h-4" />
              <span className="truncate">
                {startLabel}{" "}
                {app?.endDate && app.startDate !== app.endDate
                  ? `- ${endLabel}`
                  : ""}
              </span>
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
              Total Days
            </div>
            <div
              className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {app?.totalDays || 0} Day(s)
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
              Reason
            </div>
            <div
              className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out truncate"
              style={{ color: "var(--app-text)" }}
              title={app?.reason || "No reason specified"}
            >
              {app?.reason || "N/A"}
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
        <div className={`grid gap-2 ${actionCols}`}>
          <button
            onClick={onViewDetails}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border transition-colors duration-200 ease-out"
            type="button"
            title="View Details"
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

          {canCancel && (
            <button
              onClick={onCancel}
              disabled={cancelling}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
              type="button"
              title="Cancel"
              style={{
                backgroundColor: "rgba(239,68,68,0.12)",
                borderColor: "rgba(239,68,68,0.20)",
                color: "#ef4444",
              }}
            >
              <Ban className="w-4 h-4" />
              {cancelling ? "..." : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
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
}) => (
  <div
    className="px-4 md:px-6 py-3 border-t transition-colors duration-300 ease-out"
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: borderColor,
    }}
  >
    <div className="flex md:hidden items-center justify-between gap-3">
      <button
        onClick={onPrev}
        disabled={page === 1 || total === 0}
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
        disabled={page >= totalPages || total === 0}
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
          disabled={page === 1 || total === 0}
          className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
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
          className="text-xs font-mono font-medium px-3"
          style={{ color: "var(--app-muted)" }}
        >
          {page} / {totalPages}
        </span>

        <button
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
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

/* =========================
   Main Component
========================= */
const MyWellnessApplications = () => {
  const queryClient = useQueryClient();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const user = useAuth((s) => s.user); // Added user to access employeeId
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
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [cancelModal, setCancelModal] = useState({ isOpen: false, app: null });
  const openCancelModal = (app) => setCancelModal({ isOpen: true, app });
  const closeCancelModal = () => setCancelModal({ isOpen: false, app: null });

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

  const getStatusColor = useCallback((status) => {
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

  const searchTimeout = useRef(null);
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchFilter(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(searchTimeout.current);
  }, [searchInput]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      "myWellnessApplications",
      page,
      limit,
      statusFilter,
      searchFilter,
      user?.id || user?._id,
    ],
    queryFn: () =>
      fetchMyWellnessApplications(user?.id || user?._id, {
        page,
        limit,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      }),
    enabled: !!(user?.id || user?._id),
    placeholderData: (prev) => prev,
  });

  const cancelMutation = useMutation({
    mutationFn: (applicationId) =>
      cancelWellnessApplicationRequest(applicationId),
    onSuccess: () => {
      toast.success("Application cancelled successfully.");
      closeCancelModal();
      queryClient.invalidateQueries({ queryKey: ["myWellnessApplications"] });
      queryClient.invalidateQueries({ queryKey: ["ctoDashboard"] }); // Assuming shared dashboards
      refetch();
    },
    onError: (err) => toast.error(err?.message || "Failed to cancel request."),
  });

  const applications = useMemo(
    () => data?.applications || data?.data || [],
    [data],
  );

  const pagination = useMemo(
    () => ({
      page: data?.pagination?.page || page || 1,
      totalPages: Math.max(data?.pagination?.totalPages || 1, 1),
      total: data?.pagination?.total || 0,
    }),
    [data, page],
  );

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

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const isFiltered = statusFilter !== "" || searchFilter !== "";

  const statusCounts = data?.statusCounts || {};
  const totalCount =
    typeof statusCounts.total === "number"
      ? statusCounts.total
      : (statusCounts.PENDING || 0) +
        (statusCounts.APPROVED || 0) +
        (statusCounts.REJECTED || 0) +
        (statusCounts.CANCELLED || 0);

  const tabs = [
    {
      id: "",
      label: "All Status",
      icon: LayoutGrid,
      count: totalCount,
      tone: "accent",
    },
    {
      id: "PENDING",
      label: "Pending",
      icon: AlertCircle,
      count: statusCounts.PENDING || 0,
      tone: "amber",
    },
    {
      id: "APPROVED",
      label: "Approved",
      icon: CheckCircle2,
      count: statusCounts.APPROVED || 0,
      tone: "green",
    },
    {
      id: "REJECTED",
      label: "Rejected",
      icon: XCircle,
      count: statusCounts.REJECTED || 0,
      tone: "red",
    },
    {
      id: "CANCELLED",
      label: "Cancelled",
      icon: Ban,
      count: statusCounts.CANCELLED || 0,
      tone: "slate",
    },
  ];

  const formatDateRange = (start, end) => {
    if (!start) return "-";
    const s = new Date(start).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const e = new Date(end).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return start === end || !end ? s : `${s} - ${e}`;
  };

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
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <Breadcrumbs rootLabel="home" rootTo="/app" />
                <h1
                  className="text-2xl md:text-3xl font-bold tracking-tight font-sans"
                  style={{ color: "var(--app-text)" }}
                >
                  My Wellness Leave
                </h1>
                <p
                  className="block text-sm mt-1 max-w-2xl"
                  style={{ color: "var(--app-muted)" }}
                >
                  Manage your day-based wellness leave applications and track
                  updates.
                </p>
              </div>

              <div className="w-full md:w-auto flex flex-row items-stretch md:items-center gap-3 rounded-xl">
                <button
                  onClick={() => setIsFormModalOpen(true)}
                  className="group relative inline-flex items-center gap-2 justify-center rounded-lg min-w-42 md:py-3.5 px-6 py-3 text-sm font-semibold shadow-md transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 w-full"
                  type="button"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "#fff",
                    border: "1px solid var(--accent)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = "brightness(0.95)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = "none";
                  }}
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                  File Leave
                </button>
              </div>
            </div>
          </div>

          {/* MAIN */}
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
                  {tabs.map((tab) => {
                    const isActive = statusFilter === tab.id;
                    const Icon = tab.icon;
                    const t = tabTone[tab.tone] || tabTone.accent;

                    return (
                      <button
                        type="button"
                        key={tab.id || "all-status"}
                        onClick={() => {
                          setStatusFilter(tab.id);
                          setPage(1);
                        }}
                        className="px-4 py-1.5 text-xs font-bold rounded-full border transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-2"
                        aria-pressed={isActive}
                        style={{
                          backgroundColor: isActive
                            ? t.bg
                            : "var(--app-surface)",
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
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                        <span
                          className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ease-out"
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

                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-64">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: "var(--app-muted)" }}
                    />
                    <input
                      type="text"
                      placeholder="Search reasons..."
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

              {isFiltered && (
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Active:
                    </span>
                    {searchFilter && (
                      <span
                        className="px-2 py-0.5 rounded border text-[10px] font-medium"
                        style={{
                          backgroundColor: "var(--accent-soft)",
                          color: "var(--accent)",
                          borderColor:
                            "var(--accent-soft2, rgba(37,99,235,0.18))",
                        }}
                      >
                        "{searchFilter}"
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
              {!isLoading && applications.length === 0 ? (
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
                    Try adjusting your search or filters to find what you're
                    looking for.
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
                  {/* Mobile & Tablet cards */}
                  <div className="block lg:hidden p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
                        : applications.map((app) => {
                            const cancelling =
                              cancelMutation.isPending &&
                              cancelMutation.variables === app._id;

                            return (
                              <ApplicationCard
                                key={app._id}
                                app={app}
                                borderColor={borderColor}
                                leftStripClassName={getStatusColor(
                                  app.overallStatus,
                                )}
                                cancelling={cancelling}
                                onViewDetails={() => setSelectedApp(app)}
                                onCancel={() => openCancelModal(app)}
                              />
                            );
                          })}
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
                            Dates (Inclusive)
                          </th>
                          <th className="px-6 py-4 text-center">Total Days</th>
                          <th className="px-6 py-4 text-left">Reason</th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {isLoading
                          ? [...Array(8)].map((_, i) => (
                              <tr key={i}>
                                {[...Array(5)].map((__, j) => (
                                  <td key={j} className="px-6 py-4">
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

                              const cancelling =
                                cancelMutation.isPending &&
                                cancelMutation.variables === app._id;

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
                                        className="font-semibold text-sm flex items-center gap-2"
                                        style={{ color: "var(--app-text)" }}
                                      >
                                        <Calendar
                                          size={14}
                                          style={{ color: "var(--app-muted)" }}
                                        />
                                        {formatDateRange(
                                          app.startDate,
                                          app.endDate,
                                        )}
                                      </span>
                                      <span
                                        className="text-[10px] font-mono mt-1"
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
                                      {app.totalDays || 0} Day(s)
                                    </span>
                                  </td>

                                  <td className="px-6 py-4 text-left max-w-xs">
                                    <p
                                      className="text-sm truncate"
                                      style={{ color: "var(--app-text)" }}
                                      title={app.reason}
                                    >
                                      {app.reason || "N/A"}
                                    </p>
                                  </td>

                                  <td className="px-6 py-4 text-center">
                                    <StatusBadge status={app.overallStatus} />
                                  </td>

                                  <td className="px-6 py-4 text-right">
                                    <ApplicationActionMenu
                                      app={app}
                                      borderColor={borderColor}
                                      onViewDetails={() => setSelectedApp(app)}
                                      onCancel={() => openCancelModal(app)}
                                      cancelling={cancelling}
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

        {/* Details Modal */}
        {selectedApp && (
          <Modal
            isOpen={!!selectedApp}
            onClose={() => setSelectedApp(null)}
            title="Wellness Leave Details"
            maxWidth="max-w-3xl"
          >
            {/* Simple read-only detail view fallback since CtoApplicationDetails isn't applicable */}
            <div className="p-4 space-y-4" style={{ color: "var(--app-text)" }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Application ID
                  </p>
                  <p className="font-mono text-sm">{selectedApp._id}</p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Status
                  </p>
                  <StatusBadge status={selectedApp.overallStatus} />
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Date Range
                  </p>
                  <p className="font-medium text-sm">
                    {formatDateRange(
                      selectedApp.startDate,
                      selectedApp.endDate,
                    )}
                  </p>
                </div>
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Total Days
                  </p>
                  <p className="font-medium text-sm">
                    {selectedApp.totalDays} Day(s)
                  </p>
                </div>
              </div>
              <div
                className="pt-4 border-t"
                style={{ borderColor: borderColor }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: "var(--app-muted)" }}
                >
                  Reason
                </p>
                <p
                  className="text-sm bg-opacity-50 p-3 rounded-lg border"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderColor: borderColor,
                  }}
                >
                  {selectedApp.reason || "No reason provided."}
                </p>
              </div>
            </div>
          </Modal>
        )}

        {/* Cancel Confirm Modal */}
        <Modal
          isOpen={cancelModal.isOpen}
          onClose={closeCancelModal}
          title="Cancel Wellness Leave"
          maxWidth="max-w-lg"
          preventCloseWhenBusy={true}
          isBusy={cancelMutation.isPending}
          action={{
            show: true,
            variant: "cancel",
            label: cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel",
            onClick: async () => {
              const app = cancelModal.app;
              if (!app?._id) return;

              const status = String(app?.overallStatus || "").toUpperCase();
              if (status !== "PENDING") {
                toast.error("Only PENDING applications can be cancelled.");
                closeCancelModal();
                return;
              }

              await cancelMutation.mutateAsync(app._id);
            },
            disabled: cancelMutation.isPending,
          }}
        >
          <div className="p-2" style={{ color: "var(--app-text)" }}>
            <div
              className="mb-5 flex items-start gap-3 p-3 rounded-xl border"
              style={{
                backgroundColor: "var(--app-surface-2)",
                borderColor: borderColor,
              }}
            >
              <div
                className="mt-0.5 p-1.5 rounded-lg border shadow-sm"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: borderColor,
                  color: "var(--app-muted)",
                }}
              >
                <Info size={16} />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--app-muted)" }}
                >
                  You are about to cancel this request
                </p>
                <p
                  className="text-sm font-bold break-words"
                  style={{ color: "var(--app-text)" }}
                >
                  Ref:{" "}
                  {cancelModal.app?._id
                    ? `#${cancelModal.app._id.slice(-6).toUpperCase()}`
                    : "-"}
                </p>
              </div>
            </div>

            <div className="text-center py-2">
              <div
                className="mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-4 border-4 shadow-inner"
                style={{
                  backgroundColor: "rgba(239,68,68,0.12)",
                  color: "#ef4444",
                  borderColor: "rgba(239,68,68,0.20)",
                }}
              >
                <Ban size={40} strokeWidth={3} />
              </div>
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--app-text)" }}
              >
                Are you sure you want to cancel this Wellness Leave?
              </h2>
              <p className="text-sm mt-2" style={{ color: "var(--app-muted)" }}>
                This will stop the approval workflow immediately.
              </p>
            </div>
          </div>
        </Modal>

        {/* Form Modal */}
        <Modal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          closeLabel={null}
          maxWidth="max-w-lg"
        >
          <div className="w-full">
            <AddWellnessApplicationForm
              onClose={() => setIsFormModalOpen(false)}
              onSuccess={() => {
                setIsFormModalOpen(false);
                refetch();
              }}
            />
          </div>
        </Modal>
      </SkeletonTheme>
    </div>
  );
};

export default MyWellnessApplications;
