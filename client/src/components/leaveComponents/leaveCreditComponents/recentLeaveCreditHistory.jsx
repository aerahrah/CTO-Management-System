// leaveCreditHistory.jsx
import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import {
  getAllLeaveCreditRequests as fetchAllLeaveCredits,
  rollbackLeaveCreditRequest,
} from "../../../api/leaveCredit";

import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import { toast } from "react-toastify";
import Breadcrumbs from "../../breadCrumbs";
import FilterSelect from "../../filterSelect";
import FullHeightCardContainer from "../../pageContainer";
import { useAuth } from "../../../store/authStore";
import { usePermissions } from "../../../hooks/usePermissions";

import {
  Clipboard,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Inbox,
  Layers,
  CheckCircle2,
  MoreVertical,
  Users,
  Calendar,
  CalendarDays,
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

const STRIP_COLORS = {
  CREDITED: "#10b981",
  ROLLEDBACK: "#f43f5e",
};

const stripColorOf = (status) => STRIP_COLORS[status] || "#cbd5e1";

/* ------------------ UI Components ------------------ */
const LeaveTypeBadge = ({ type }) => {
  const isVL = type === "VL";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider"
      style={{
        backgroundColor: isVL
          ? "rgba(59,130,246,0.10)"
          : "rgba(168,85,247,0.10)",
        borderColor: isVL ? "rgba(59,130,246,0.25)" : "rgba(168,85,247,0.25)",
        color: isVL ? "#3b82f6" : "#a855f7",
      }}
    >
      {isVL ? "VL" : "SL"}
    </span>
  );
};

/* ------------------ Employees cell (desktop table) ------------------ */
const MAX_VISIBLE_EMPLOYEES = 3;

const getInitials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const EmployeesCell = ({ employees = [], borderColor }) => {
  const [expanded, setExpanded] = useState(false);

  const names = useMemo(
    () =>
      (employees || [])
        .map((e) =>
          `${e.employee?.firstName || ""} ${e.employee?.lastName || ""}`.trim(),
        )
        .filter(Boolean),
    [employees],
  );

  if (names.length === 0) {
    return (
      <span className="text-sm" style={{ color: "var(--app-muted)" }}>
        -
      </span>
    );
  }

  const hiddenCount = names.length - MAX_VISIBLE_EMPLOYEES;
  const visibleNames = expanded ? names : names.slice(0, MAX_VISIBLE_EMPLOYEES);

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <Users size={13} style={{ color: "var(--app-muted)" }} />
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "var(--app-muted)" }}
        >
          {names.length} Employee{names.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visibleNames.map((name, idx) => (
          <span
            key={`${name}-${idx}`}
            title={name}
            className="inline-flex items-center gap-1.5 max-w-[190px] pl-0.5 pr-2.5 py-0.5 rounded-full border text-xs font-medium"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
              color: "var(--app-text)",
            }}
          >
            <span
              className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-none"
              style={{
                backgroundColor: "var(--accent-soft)",
                color: "var(--accent)",
              }}
            >
              {getInitials(name)}
            </span>
            <span className="truncate">{name}</span>
          </span>
        ))}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            title={
              expanded
                ? "Show less"
                : names.slice(MAX_VISIBLE_EMPLOYEES).join(", ")
            }
            className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-bold transition hover:brightness-95"
            style={{
              backgroundColor: "var(--accent-soft)",
              borderColor: "var(--accent-soft2)",
              color: "var(--accent)",
            }}
          >
            {expanded ? "Show less" : `+${hiddenCount} more`}
          </button>
        )}
      </div>
    </div>
  );
};

/* ------------------ Action menu (portal, so the table can't clip it) ------------------ */
const MENU_WIDTH = 176;

const ActionMenu = ({
  credit,
  onRollback,
  isRollbackPending,
  borderColor,
  canManageCredits,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, visible: false });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const btn = btnRef.current?.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 48;
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
      if (e.key === "Escape") close();
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

  const handle = (cb) => {
    cb?.();
    setIsOpen(false);
  };

  if (!canManageCredits) return null;

  const rollbackDisabled = credit.status !== "CREDITED" || isRollbackPending;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={isRollbackPending}
        onClick={(e) => {
          e.stopPropagation();
          if (isRollbackPending) return;
          setPos((p) => ({ ...p, visible: false }));
          setIsOpen((o) => !o);
        }}
        className="p-2 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)] hover:text-[color:var(--app-text)]"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Actions"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="rounded-lg shadow-lg py-1 border"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              zIndex: 1000,
              visibility: pos.visible ? "visible" : "hidden",
              backgroundColor: "var(--app-surface)",
              borderColor,
            }}
          >
            <button
              type="button"
              disabled={rollbackDisabled}
              onClick={() => handle(onRollback)}
              className={`w-full px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200 ease-out ${
                rollbackDisabled ? "" : "hover:bg-[rgba(239,68,68,0.10)]"
              }`}
              style={{ color: "#ef4444" }}
            >
              <RotateCcw size={14} />{" "}
              {isRollbackPending ? "Rolling back..." : "Rollback"}
            </button>
          </div>,
          document.body,
        )}
    </>
  );
};

/* ------------------ Mobile/Tablet Card ------------------ */
const CreditCard = ({
  credit,
  isRollbackPending,
  onRollback,
  formatDays,
  formatDate,
  borderColor,
  canManageCredits,
}) => {
  const employeesLabel = useMemo(() => {
    const names =
      credit?.employees?.map((e) =>
        `${e.employee?.firstName || ""} ${e.employee?.lastName || ""}`.trim(),
      ) || [];
    return names.filter(Boolean).join(", ") || "-";
  }, [credit]);

  const shortId = credit?._id ? credit._id.slice(-6).toUpperCase() : "-";
  const rollbackDisabled = credit.status !== "CREDITED" || isRollbackPending;

  return (
    <div
      className="rounded-xl shadow-sm overflow-hidden transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${stripColorOf(credit.status)}`,
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="text-sm font-bold truncate"
                style={{ color: "var(--app-text)" }}
                title={credit.memoNo || "-"}
              >
                {credit.memoNo || "-"}
              </span>
              <div className="flex-none">
                <LeaveTypeBadge type={credit.leaveType} />
              </div>
            </div>

            <div className="mt-1">
              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--app-muted)" }}
              >
                #{shortId}
              </span>
            </div>

            <div className="mt-2 flex items-start gap-2 min-w-0">
              <Users
                className="w-4 h-4 mt-[2px] flex-none"
                style={{ color: "var(--app-muted)" }}
              />
              <div
                className="text-xs leading-snug line-clamp-2"
                style={{ color: "var(--app-text)" }}
                title={employeesLabel}
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
              onRollback={onRollback}
              canManageCredits={canManageCredits}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div
            className="rounded-lg border p-2"
            style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--app-muted)" }}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Days
            </div>
            <div
              className="mt-1 text-sm font-semibold"
              style={{ color: "var(--app-text)" }}
            >
              {formatDays(credit.days)}
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
              <Calendar className="w-3.5 h-3.5" /> Approved
            </div>
            <div
              className="mt-1 text-sm font-semibold"
              style={{ color: "var(--app-text)" }}
            >
              {formatDate(credit.dateApproved)}
            </div>
          </div>
        </div>
      </div>

      {canManageCredits && (
        <div className="border-t p-3" style={{ borderColor }}>
          <button
            type="button"
            disabled={rollbackDisabled}
            onClick={onRollback}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200 ease-out bg-[rgba(239,68,68,0.10)] ${
              rollbackDisabled ? "" : "hover:bg-[rgba(239,68,68,0.16)]"
            }`}
            style={{ borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" }}
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isRollbackPending ? "Rolling..." : "Rollback"}</span>
          </button>
        </div>
      )}
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
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            borderColor,
            backgroundColor: "var(--app-surface)",
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
            {total === 0 ? "0 results" : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            borderColor,
            backgroundColor: "var(--app-surface)",
            color: "var(--app-text)",
          }}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

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
            {page} / {totalPages}
          </span>

          <button
            type="button"
            onClick={onNext}
            disabled={page >= totalPages || total === 0}
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

const LeaveCreditHistory = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { can } = usePermissions();
  // Assume generic leave_credits.manage applies, adjust if it's different in your rules
  const canManageCredits =
    can("leave_credits.manage") || can("wellness.manage");

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

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

  const [isConfirmRollback, setIsConfirmRollback] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState(null);

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

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchFilter(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["allLeaveCredits", page, limit, statusFilter, searchFilter],
    queryFn: () =>
      fetchAllLeaveCredits({
        page,
        limit,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const credits = useMemo(() => data?.data || data?.items || [], [data]);

  const pagination = useMemo(
    () => ({
      page: data?.page || page || 1,
      totalPages: Math.max(Math.ceil((data?.totalCount || 0) / limit), 1),
      total: data?.totalCount || 0,
    }),
    [data, limit, page],
  );

  useEffect(() => {
    setPage((p) => {
      if (p > pagination.totalPages) return pagination.totalPages;
      if (p < 1) return 1;
      return p;
    });
  }, [pagination.totalPages]);

  const rollbackMutation = useMutation({
    mutationFn: rollbackLeaveCreditRequest,
    retry: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allLeaveCredits"] });

      rollbackSuccessLatchRef.current = true;
      setRollbackSuccessLatchUI(true);

      toast.success("Leave credit successfully rolled back!");

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

  const formatDays = useCallback(
    (d) => (typeof d === "number" ? `${d} Day${d !== 1 ? "s" : ""}` : "-"),
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

  const requestRollback = (credit) => {
    if (isRollbackPending) return;
    setSelectedCreditId(credit._id);
    setIsConfirmRollback(true);
  };

  const chipStyle = {
    backgroundColor: "var(--accent-soft)",
    color: "var(--accent)",
    borderColor: "var(--accent-soft2)",
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
            <div className="pt-2 pb-3 md:pb-6 px-1">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <Breadcrumbs rootLabel="home" rootTo="/app" />
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-sans">
                    Leave Credit History
                  </h1>
                  <p
                    className="text-sm mt-1 max-w-2xl"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Manage and monitor Vacation and Sick Leave credits issued to
                    employees
                  </p>
                </div>

                {canManageCredits && (
                  <button
                    type="button"
                    onClick={() => navigate("/app/leave-credit/add")}
                    className="group relative inline-flex items-center gap-2 justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ease-out hover:shadow-lg hover:-translate-y-0.5 hover:brightness-95 active:translate-y-0 w-full md:w-auto"
                    style={{ backgroundColor: "var(--accent, #2563EB)" }}
                  >
                    <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                    Credit Leave
                  </button>
                )}
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
                style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {getStatusTabs(grandTotals).map((tab) => {
                      const isActive = statusFilter === tab.id;
                      const Icon = tab.icon;

                      return (
                        <button
                          type="button"
                          key={tab.id || "all"}
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
                                  borderColor,
                                }
                          }
                          aria-pressed={isActive}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                          <span
                            className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
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

                    <div
                      className="lg:hidden flex items-center gap-1.5 px-2 border-l ml-1"
                      style={{ borderColor }}
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span
                        className="text-[10px] font-bold uppercase"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Active:
                      </span>
                      {searchFilter && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium max-w-[200px] truncate"
                          style={chipStyle}
                          title={searchFilter}
                        >
                          "{searchFilter}"
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

              <div
                className="min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-y-auto transition-colors duration-300 ease-out cto-scrollbar"
                style={{ backgroundColor: "var(--app-bg)" }}
              >
                {!isLoading && credits.length === 0 ? (
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                        {(isLoading || isRollbackPending
                          ? [...Array(Math.min(limit, 6))]
                          : credits
                        ).map((credit, idx) => {
                          if (isLoading || isRollbackPending) {
                            return (
                              <div
                                key={`sk-${idx}`}
                                className="rounded-xl shadow-sm p-4 border"
                                style={{
                                  backgroundColor: "var(--app-surface)",
                                  borderColor,
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
                              formatDays={formatDays}
                              formatDate={formatDate}
                              borderColor={borderColor}
                              canManageCredits={canManageCredits}
                              onRollback={() => requestRollback(credit)}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block w-full align-middle">
                      <table className="w-full text-left table-fixed">
                        <colgroup>
                          <col style={{ width: "32%" }} />
                          <col style={{ width: "18%" }} />
                          <col style={{ width: "8%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "11%" }} />
                          {canManageCredits && <col style={{ width: "8%" }} />}
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
                            <th className="px-6 py-4">Employees</th>
                            <th className="px-4 py-4">Reference / Memo</th>
                            <th className="px-3 py-4">Type</th>
                            <th className="px-3 py-4 text-center">
                              Days Credited
                            </th>
                            <th className="px-3 py-4 text-center">
                              Date Approved
                            </th>
                            <th className="px-3 py-4 text-center">Status</th>
                            {canManageCredits && (
                              <th className="px-6 py-4 text-right">Actions</th>
                            )}
                          </tr>
                        </thead>

                        <tbody>
                          {isLoading
                            ? [...Array(limit)].map((_, i) => (
                                <tr key={i}>
                                  {[...Array(canManageCredits ? 7 : 6)].map(
                                    (__, j) => (
                                      <td key={j} className="px-4 py-4">
                                        <Skeleton />
                                      </td>
                                    ),
                                  )}
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
                                    <td className="px-6 py-4 align-middle">
                                      <EmployeesCell
                                        employees={credit.employees}
                                        borderColor={borderColor}
                                      />
                                    </td>

                                    <td className="px-4 py-4 align-middle">
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
                                          ID:{" "}
                                          {credit._id
                                            ? credit._id.slice(-6).toUpperCase()
                                            : "-"}
                                        </span>
                                      </div>
                                    </td>

                                    <td className="px-3 py-4 align-middle whitespace-nowrap">
                                      <LeaveTypeBadge type={credit.leaveType} />
                                    </td>

                                    <td className="px-3 py-4 text-center align-middle whitespace-nowrap">
                                      <span
                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-xs font-bold"
                                        style={{
                                          backgroundColor: "var(--app-surface)",
                                          borderColor,
                                          color: "var(--app-text)",
                                        }}
                                      >
                                        <CalendarDays
                                          size={12}
                                          style={{ color: "var(--app-muted)" }}
                                        />
                                        {formatDays(credit.days)}
                                      </span>
                                    </td>

                                    <td
                                      className="px-3 py-4 text-center align-middle whitespace-nowrap text-sm"
                                      style={{ color: "var(--app-muted)" }}
                                    >
                                      {formatDate(credit.dateApproved)}
                                    </td>

                                    <td className="px-3 py-4 text-center align-middle whitespace-nowrap">
                                      <StatusBadge status={credit.status} />
                                    </td>

                                    {canManageCredits && (
                                      <td className="px-6 py-4 text-right align-middle whitespace-nowrap">
                                        <ActionMenu
                                          credit={credit}
                                          borderColor={borderColor}
                                          isRollbackPending={isRollbackPending}
                                          canManageCredits={canManageCredits}
                                          onRollback={() =>
                                            requestRollback(credit)
                                          }
                                        />
                                      </td>
                                    )}
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

          <Modal
            isOpen={isConfirmRollback}
            onClose={() => {
              if (isRollbackPending) return;
              setIsConfirmRollback(false);
            }}
            title="Rollback Leave Credit"
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
                className="mb-5 flex items-start gap-3 p-3 rounded-xl border"
                style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
              >
                <div
                  className="mt-0.5 p-1.5 rounded-lg border shadow-sm"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor,
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
                    You are about to rollback this Leave credit
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
                      {credits.find((c) => c._id === selectedCreditId)
                        ?.memoNo || "-"}
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
                  Are you sure you want to rollback this Leave credit?
                </h2>

                <p
                  className="text-sm mt-2"
                  style={{ color: "var(--app-muted)" }}
                >
                  This will deduct the credited days from the employees&apos;
                  balances and mark this credit as{" "}
                  <span className="font-semibold">ROLLEDBACK</span>.
                </p>
              </div>

              <div
                className="mt-4 rounded-xl border p-3"
                style={{
                  borderColor: "rgba(245,158,11,0.35)",
                  backgroundColor: "rgba(245,158,11,0.10)",
                  color: "rgba(245,158,11,0.95)",
                }}
              >
                <p className="text-xs leading-relaxed">
                  <span className="font-bold">Note:</span> Rollback will fail if
                  any employee has already used or reserved days from this
                  credit.
                </p>
              </div>
            </div>
          </Modal>
        </SkeletonTheme>
      </div>
    </FullHeightCardContainer>
  );
};

export default LeaveCreditHistory;
