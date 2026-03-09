import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import { fetchAllCreditRequests, rollbackCreditCto } from "../../../api/cto";
import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import { toast } from "react-toastify";
import Breadcrumbs from "../../breadCrumbs";

import FilterSelect from "../../filterSelect";
import AddCtoCreditForm from "./forms/addCtoCreditForm";
import CtoCreditDetails from "./ctoCreditFullDetails";
import { buildApiUrl } from "../../../config/env";
import { useAuth } from "../../../store/authStore";

import {
  Clipboard,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Inbox,
  Layers,
  CheckCircle2,
  MoreVertical,
  Eye,
  Users,
  Calendar,
  Clock,
  FileText,
  ArrowUp,
} from "lucide-react";

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

const getStatusTabs = (counts = {}) => [
  {
    id: "",
    label: "All Credits",
    icon: Layers,
    count: counts.total || 0,
    activeStyle: {
      backgroundColor: "var(--accent-soft)",
      color: "var(--accent)",
      borderColor: "var(--accent-soft2)",
    },
  },
  {
    id: "CREDITED",
    label: "Credited",
    icon: CheckCircle2,
    count: counts.credited || 0,
    activeStyle: {
      backgroundColor: "rgba(34,197,94,0.14)",
      color: "#16a34a",
      borderColor: "rgba(34,197,94,0.25)",
    },
  },
  {
    id: "ROLLEDBACK",
    label: "Rolled Back",
    icon: RotateCcw,
    count: counts.rolledBack || 0,
    activeStyle: {
      backgroundColor: "rgba(239,68,68,0.14)",
      color: "#ef4444",
      borderColor: "rgba(239,68,68,0.25)",
    },
  },
];

/* ------------------ Action menu (themed) ------------------ */
const ActionMenu = ({
  credit,
  onViewMemo,
  onViewDetails,
  onRollback,
  isRollbackPending,
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

  return (
    <div className="relative inline-flex justify-center" ref={menuRef}>
      <button
        type="button"
        disabled={isRollbackPending}
        onClick={(e) => {
          e.stopPropagation();
          if (isRollbackPending) return;
          setIsOpen((o) => !o);
        }}
        className="p-2 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
        style={{ color: "var(--app-muted)" }}
        onMouseEnter={(e) => {
          if (isRollbackPending) return;
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
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-44 rounded-lg shadow-lg z-30 py-1 border transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor,
          }}
        >
          <button
            type="button"
            disabled={isRollbackPending}
            onClick={() => handle(onViewMemo)}
            className="w-full px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
            style={{ color: "var(--app-text)" }}
            onMouseEnter={(e) => {
              if (isRollbackPending) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Eye size={14} /> View Memo
          </button>

          <button
            type="button"
            disabled={isRollbackPending}
            onClick={() => handle(onViewDetails)}
            className="w-full px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
            style={{ color: "var(--app-text)" }}
            onMouseEnter={(e) => {
              if (isRollbackPending) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Clipboard size={14} /> View Details
          </button>

          <div
            className="h-px my-1"
            style={{ backgroundColor: "var(--app-border)" }}
          />

          <button
            type="button"
            disabled={credit.status !== "CREDITED" || isRollbackPending}
            onClick={() => handle(onRollback)}
            className="w-full px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
            style={{ color: "#ef4444" }}
            onMouseEnter={(e) => {
              if (credit.status !== "CREDITED" || isRollbackPending) return;
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.10)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <RotateCcw size={14} />{" "}
            {isRollbackPending ? "Rolling back..." : "Rollback"}
          </button>
        </div>
      )}
    </div>
  );
};

/* ------------------ Mobile/Tablet Card ------------------ */
const CreditCard = ({
  credit,
  isRollbackPending,
  onViewMemo,
  onViewDetails,
  onRollback,
  formatDuration,
  formatDate,
  leftStripClassName,
  borderColor,
}) => {
  const employeesLabel = useMemo(() => {
    const names =
      credit?.employees?.map((e) =>
        `${e.employee?.firstName || ""} ${e.employee?.lastName || ""}`.trim(),
      ) || [];
    return names.filter(Boolean).join(", ") || "-";
  }, [credit]);

  const shortId = credit?._id ? credit._id.slice(-6).toUpperCase() : "-";

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
                {credit.memoNo || "-"}
              </span>
              <span
                className="text-[10px] font-mono transition-colors duration-300 ease-out"
                style={{ color: "var(--app-muted)" }}
              >
                #{shortId}
              </span>
            </div>

            <div className="mt-2 flex items-start gap-2">
              <Users
                className="w-4 h-4 mt-[2px] flex-none"
                style={{ color: "var(--app-muted)" }}
              />
              <div
                className="text-xs leading-snug line-clamp-2 transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                {employeesLabel}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 flex-none">
            <StatusBadge status={credit.status} />
            <ActionMenu
              credit={credit}
              borderColor={borderColor}
              isRollbackPending={isRollbackPending}
              onViewMemo={onViewMemo}
              onViewDetails={onViewDetails}
              onRollback={onRollback}
            />
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
              <Clock className="w-3.5 h-3.5" /> Duration
            </div>
            <div
              className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {formatDuration(credit.duration)}
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
              <Calendar className="w-3.5 h-3.5" /> Approved
            </div>
            <div
              className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {formatDate(credit.dateApproved)}
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isRollbackPending}
            onClick={onViewMemo}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
              color: "var(--accent)",
            }}
            onMouseEnter={(e) => {
              if (isRollbackPending) return;
              e.currentTarget.style.backgroundColor = "var(--accent-soft)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
          >
            <FileText className="w-4 h-4" />
            Memo
          </button>

          <button
            type="button"
            disabled={isRollbackPending}
            onClick={onViewDetails}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
              color: "var(--accent)",
            }}
            onMouseEnter={(e) => {
              if (isRollbackPending) return;
              e.currentTarget.style.backgroundColor = "var(--accent-soft)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
          >
            <Clipboard className="w-4 h-4" />
            Details
          </button>

          <button
            type="button"
            disabled={credit.status !== "CREDITED" || isRollbackPending}
            onClick={onRollback}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
            style={{
              borderColor: "rgba(239,68,68,0.25)",
              backgroundColor: "rgba(239,68,68,0.10)",
              color: "#ef4444",
            }}
            onMouseEnter={(e) => {
              if (credit.status !== "CREDITED" || isRollbackPending) return;
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.16)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.10)";
            }}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">
              {isRollbackPending ? "Rolling..." : "Rollback"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------ Compact Pagination ------------------ */
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
  return (
    <div
      className="px-4 md:px-6 py-3 border-t transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      {/* Mobile/tablet */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            borderColor: borderColor,
            backgroundColor: "var(--app-surface)",
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
            {page} / {totalPages}
          </div>
          <div
            className="text-[11px] truncate transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {total === 0 ? "0 results" : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            borderColor: borderColor,
            backgroundColor: "var(--app-surface)",
            color: "var(--app-text)",
          }}
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
            onMouseEnter={(e) => {
              if (page === 1 || total === 0) return;
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
            type="button"
            onClick={onNext}
            disabled={page >= totalPages || total === 0}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              if (page >= totalPages || total === 0) return;
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

const CtoCreditHistory = () => {
  const queryClient = useQueryClient();

  // ✅ resolve theme just like your reference page
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  // ✅ borders less “white” on dark
  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  // ✅ skeleton theme (fix white loading on dark)
  const skeletonColors = useMemo(() => {
    if (resolvedTheme === "dark") {
      return {
        baseColor: "rgba(255,255,255,0.06)",
        highlightColor: "rgba(255,255,255,0.10)",
      };
    }
    return {
      baseColor: "rgba(15,23,42,0.06)",
      highlightColor: "rgba(15,23,42,0.10)",
    };
  }, [resolvedTheme]);

  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });
  const [isAddCtoOpen, setIsAddCtoOpen] = useState(false);
  const [isAddBusy, setIsAddBusy] = useState(false);

  const [isConfirmRollback, setIsConfirmRollback] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState(null);

  const [detailsModal, setDetailsModal] = useState({
    isOpen: false,
    credit: null,
  });

  const rollbackInFlightRef = useRef(false);
  const rollbackSuccessLatchRef = useRef(false);
  const [rollbackLockUI, setRollbackLockUI] = useState(false);
  const [rollbackSuccessLatchUI, setRollbackSuccessLatchUI] = useState(false);

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

  const getStatusStripClass = useCallback((status) => {
    switch (status) {
      case "CREDITED":
        return "border-l-4 border-l-emerald-500";
      case "ROLLEDBACK":
        return "border-l-4 border-l-rose-500";
      default:
        return "border-l-4 border-l-slate-300";
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchFilter(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["allCredits", page, limit, statusFilter, searchFilter],
    queryFn: () =>
      fetchAllCreditRequests({
        page,
        limit,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const credits = useMemo(() => data?.credits || [], [data]);

  const pagination = useMemo(
    () => ({
      page: data?.page || 1,
      totalPages: Math.max(Math.ceil((data?.total || 0) / limit), 1),
      total: data?.total || 0,
    }),
    [data, limit],
  );

  useEffect(() => {
    setPage((p) => {
      if (p > pagination.totalPages) return pagination.totalPages;
      if (p < 1) return 1;
      return p;
    });
  }, [pagination.totalPages]);

  const rollbackMutation = useMutation({
    mutationFn: rollbackCreditCto,
    retry: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allCredits"] });

      rollbackSuccessLatchRef.current = true;
      setRollbackSuccessLatchUI(true);

      toast.success("CTO credit successfully rolled back!");

      setIsConfirmRollback(false);
      setSelectedCreditId(null);

      setTimeout(() => {
        rollbackInFlightRef.current = false;
        rollbackSuccessLatchRef.current = false;
        setRollbackLockUI(false);
        setRollbackSuccessLatchUI(false);
      }, 0);
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message || error?.message || "Rollback failed.",
      );

      rollbackInFlightRef.current = false;
      rollbackSuccessLatchRef.current = false;
      setRollbackLockUI(false);
      setRollbackSuccessLatchUI(false);
      setIsConfirmRollback(false);
    },
  });

  const isRollbackPending =
    rollbackMutation.isPending || rollbackLockUI || rollbackSuccessLatchUI;

  const formatDuration = useCallback(
    (d) => (d ? `${d.hours || 0}h ${d.minutes || 0}m` : "-"),
    [],
  );

  const formatDate = useCallback(
    (iso) =>
      iso
        ? new Date(iso).toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "-",
    [],
  );

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const isFiltered = statusFilter !== "" || searchFilter !== "";

  const startItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * limit + 1;
  const endItem =
    pagination.total === 0
      ? 0
      : Math.min(pagination.page * limit, pagination.total);

  const grandTotals = useMemo(() => {
    const credited = data?.grandTotals?.credited || 0;
    const rolledBack = data?.grandTotals?.rolledBack || 0;
    return { credited, rolledBack, total: credited + rolledBack };
  }, [data]);

  const memoPdfUrl = useMemo(() => {
    const p = memoModal?.memo?.uploadedMemo;
    if (!p) return "";
    return buildApiUrl(String(p).replace(/\\/g, "/"));
  }, [memoModal?.memo?.uploadedMemo]);

  const startRollback = useCallback(
    (creditId) => {
      if (!creditId) return;
      if (rollbackSuccessLatchRef.current) return;
      if (rollbackInFlightRef.current) return;
      if (rollbackMutation.isPending) return;

      rollbackInFlightRef.current = true;
      setRollbackLockUI(true);

      rollbackMutation.mutate(creditId);
    },
    [rollbackMutation],
  );

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
          <div className="pt-2 pb-3 md:pb-6 px-1">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <Breadcrumbs rootLabel="home" rootTo="/app" />
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-sans">
                  CTO Credit History
                </h1>
                <p
                  className="text-sm mt-1 max-w-2xl transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Manage and monitor CTO credits issued to employees
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  queryClient.invalidateQueries({
                    queryKey: ["ctoCreditEmployees"],
                  });
                  setIsAddCtoOpen(true);
                }}
                className="group relative inline-flex items-center gap-2 justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ease-out hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto"
                style={{ backgroundColor: "var(--accent, #2563EB)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.filter = "brightness(0.95)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                Credit CTO
              </button>
            </div>
          </div>

          <div
            className="flex flex-col rounded-xl shadow-sm overflow-visible md:flex-1 md:min-h-0 md:overflow-hidden transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              border: `1px solid ${borderColor}`,
            }}
          >
            <div
              className="p-4 border-b space-y-4 sticky top-0 z-[1] backdrop-blur md:static md:z-auto transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface-2)",
                borderColor: borderColor,
              }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {getStatusTabs(grandTotals).map((tab) => {
                    const isActive = statusFilter === tab.id;
                    const Icon = tab.icon;

                    return (
                      <button
                        type="button"
                        key={tab.id}
                        onClick={() => {
                          setStatusFilter(tab.id);
                          setPage(1);
                        }}
                        className="px-4 py-1.5 text-xs font-bold rounded-full border transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-2"
                        style={
                          isActive
                            ? tab.activeStyle
                            : {
                                backgroundColor: "var(--app-surface)",
                                color: "var(--app-muted)",
                                borderColor: borderColor,
                              }
                        }
                        aria-pressed={isActive}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                        <span
                          className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ease-out"
                          style={{
                            backgroundColor: isActive
                              ? "rgba(255,255,255,0.65)"
                              : "var(--app-surface-2)",
                            color: isActive ? "#0f172a" : "var(--app-muted)",
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
                          borderColor: "var(--accent-soft2)",
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
                          borderColor: "var(--accent-soft2)",
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

            <div
              className="min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-y-auto transition-colors duration-300 ease-out cto-scrollbar"
              style={{ backgroundColor: "var(--app-bg)" }}
            >
              {!isLoading && credits.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                  <div
                    className="p-6 rounded-full mb-4 ring-1 transition-colors duration-300 ease-out"
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
                    No Credit History Found
                  </h3>
                  {isFiltered && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="mt-6 text-sm font-bold underline"
                      style={{ color: "var(--accent)" }}
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Mobile/Tablet cards */}
                  <div className="block lg:hidden p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(isLoading || isRollbackPending
                        ? [...Array(Math.min(limit, 6))]
                        : credits
                      ).map((credit, idx) => {
                        if (isLoading || isRollbackPending) {
                          return (
                            <div
                              key={`sk-${idx}`}
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
                              <div className="mt-4 flex gap-2">
                                <Skeleton height={40} width={"100%"} />
                              </div>
                            </div>
                          );
                        }

                        return (
                          <CreditCard
                            key={credit._id}
                            credit={credit}
                            isRollbackPending={isRollbackPending}
                            formatDuration={formatDuration}
                            formatDate={formatDate}
                            leftStripClassName={getStatusStripClass(
                              credit.status,
                            )}
                            borderColor={borderColor}
                            onViewMemo={() =>
                              setMemoModal({ isOpen: true, memo: credit })
                            }
                            onViewDetails={() =>
                              setDetailsModal({ isOpen: true, credit })
                            }
                            onRollback={() => {
                              if (isRollbackPending) return;
                              setSelectedCreditId(credit._id);
                              setIsConfirmRollback(true);
                            }}
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
                          <th className="px-6 py-4 font-bold">Employees</th>
                          <th className="px-6 py-4 font-bold">
                            REFERENCE / Memo
                          </th>
                          <th className="px-6 py-4 text-center">Duration</th>
                          <th className="px-6 py-4 text-center">
                            Date Approved
                          </th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {isLoading
                          ? [...Array(limit)].map((_, i) => (
                              <tr key={i}>
                                {[...Array(6)].map((__, j) => (
                                  <td key={j} className="px-6 py-4">
                                    <Skeleton />
                                  </td>
                                ))}
                              </tr>
                            ))
                          : credits.map((credit, i) => {
                              const bg =
                                i % 2 === 0
                                  ? "var(--app-surface)"
                                  : "var(--app-surface-2)";

                              return (
                                <tr
                                  key={credit._id}
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
                                    <span
                                      className="font-semibold text-sm"
                                      style={{ color: "var(--app-text)" }}
                                    >
                                      {credit.employees
                                        .map((e) =>
                                          `${e.employee?.firstName || ""} ${e.employee?.lastName || ""}`.trim(),
                                        )
                                        .filter(Boolean)
                                        .join(", ")}
                                    </span>
                                  </td>

                                  <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                      <span
                                        className="font-medium"
                                        style={{ color: "var(--app-text)" }}
                                      >
                                        {credit.memoNo}
                                      </span>
                                      <span
                                        className="text-[10px] font-mono mt-0.5"
                                        style={{ color: "var(--app-muted)" }}
                                      >
                                        ID:{" "}
                                        {credit._id
                                          ? credit._id.slice(-6).toUpperCase()
                                          : "-"}
                                      </span>
                                    </div>
                                  </td>

                                  <td
                                    className="px-6 py-4 text-center"
                                    style={{ color: "var(--app-muted)" }}
                                  >
                                    {formatDuration(credit.duration)}
                                  </td>

                                  <td
                                    className="px-6 py-4 text-center"
                                    style={{ color: "var(--app-muted)" }}
                                  >
                                    {formatDate(credit.dateApproved)}
                                  </td>

                                  <td className="px-6 py-4 text-center">
                                    <StatusBadge status={credit.status} />
                                  </td>

                                  <td className="px-6 py-4 text-right">
                                    <ActionMenu
                                      credit={credit}
                                      borderColor={borderColor}
                                      isRollbackPending={isRollbackPending}
                                      onViewMemo={() =>
                                        setMemoModal({
                                          isOpen: true,
                                          memo: credit,
                                        })
                                      }
                                      onViewDetails={() =>
                                        setDetailsModal({
                                          isOpen: true,
                                          credit,
                                        })
                                      }
                                      onRollback={() => {
                                        if (isRollbackPending) return;
                                        setSelectedCreditId(credit._id);
                                        setIsConfirmRollback(true);
                                      }}
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
              onPrev={() => setPage((p) => Math.max(p - 1, 1))}
              onNext={() =>
                setPage((p) => Math.min(p + 1, pagination.totalPages))
              }
              borderColor={borderColor}
            />
          </div>
        </div>

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

        <Modal
          isOpen={isConfirmRollback}
          onClose={() => {
            if (isRollbackPending) return;
            setIsConfirmRollback(false);
          }}
          title="Rollback CTO Credit"
          maxWidth="max-w-lg"
          preventCloseWhenBusy={true}
          isBusy={isRollbackPending}
          action={{
            show: true,
            variant: "delete",
            label: isRollbackPending ? "Rolling back..." : "Yes, Rollback",
            onClick: async () => {
              if (!selectedCreditId) return;

              const credit = credits.find((c) => c._id === selectedCreditId);
              const status = String(credit?.status || "").toUpperCase();
              if (status !== "CREDITED") {
                toast.error("Only CREDITED entries can be rolled back.");
                setIsConfirmRollback(false);
                return;
              }

              await startRollback(selectedCreditId);
            },
            disabled: isRollbackPending || !selectedCreditId,
          }}
        >
          <div className="p-2">
            <div
              className="mb-5 flex items-start gap-3 p-3 rounded-xl border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface-2)",
                borderColor: borderColor,
              }}
            >
              <div
                className="mt-0.5 p-1.5 rounded-lg border shadow-sm transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: borderColor,
                  color: "var(--app-muted)",
                }}
              >
                <Clipboard size={16} />
              </div>

              <div className="min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--app-muted)" }}
                >
                  You are about to rollback this CTO credit
                </p>

                <p
                  className="text-sm font-bold break-words"
                  style={{ color: "var(--app-text)" }}
                >
                  Ref:{" "}
                  {selectedCreditId
                    ? `#${selectedCreditId.slice(-6).toUpperCase()}`
                    : "-"}
                </p>

                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--app-muted)" }}
                >
                  Memo:{" "}
                  <span
                    className="font-semibold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {credits.find((c) => c._id === selectedCreditId)?.memoNo ||
                      "-"}
                  </span>
                </p>
              </div>
            </div>

            <div className="text-center py-2">
              <div
                className="mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-4 border-4 shadow-inner"
                style={{
                  backgroundColor: "rgba(239,68,68,0.10)",
                  borderColor: "rgba(239,68,68,0.18)",
                  color: "#ef4444",
                }}
              >
                <RotateCcw size={40} strokeWidth={3} />
              </div>

              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--app-text)" }}
              >
                Are you sure you want to rollback this CTO credit?
              </h2>

              <p className="text-sm mt-2" style={{ color: "var(--app-muted)" }}>
                This will deduct the credited hours from the employees&apos;
                balances and mark this credit as{" "}
                <span className="font-semibold">ROLLEDBACK</span>.
              </p>
            </div>

            <div
              className="mt-4 rounded-xl border p-3 transition-colors duration-300 ease-out"
              style={{
                borderColor: "rgba(245,158,11,0.35)",
                backgroundColor: "rgba(245,158,11,0.10)",
                color: "rgba(245,158,11,0.95)",
              }}
            >
              <p className="text-xs leading-relaxed">
                <span className="font-bold">Note:</span> Rollback will fail if
                any employee has already used or reserved hours from this
                credit.
              </p>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isAddCtoOpen}
          onClose={() => setIsAddCtoOpen(false)}
          showFooter={false}
          isBusy={isAddBusy}
          preventCloseWhenBusy={true}
          maxWidth="max-w-lg"
        >
          <AddCtoCreditForm
            onClose={() => setIsAddCtoOpen(false)}
            onPendingChange={(v) => setIsAddBusy(!!v)}
          />
        </Modal>

        <Modal
          isOpen={detailsModal.isOpen}
          onClose={() => setDetailsModal((p) => ({ ...p, isOpen: false }))}
          title="CTO Credit Details"
          maxWidth="max-w-4xl"
        >
          <CtoCreditDetails credit={detailsModal.credit} />
        </Modal>

        <Modal
          isOpen={memoModal.isOpen}
          onClose={() => setMemoModal({ isOpen: false, memo: null })}
          title="CTO Credit Memo"
          maxWidth="max-w-4xl"
        >
          <div className="w-full h-[70vh] flex flex-col">
            <iframe
              title="CTO Credit Memo PDF"
              src={
                memoPdfUrl
                  ? `${memoPdfUrl}#toolbar=1&navpanes=1&scrollbar=1`
                  : ""
              }
              className="w-full flex-1 rounded-md border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
              allow="fullscreen"
            />
          </div>
        </Modal>
      </SkeletonTheme>
    </div>
  );
};

export default CtoCreditHistory;
