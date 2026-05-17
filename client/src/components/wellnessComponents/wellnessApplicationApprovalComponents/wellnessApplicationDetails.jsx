import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  MessageCircle,
  XCircle,
  AlertCircle,
  Info,
  Ban,
  CheckCircle2,
  Users,
  History,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  BadgeCheck,
} from "lucide-react";
import { StatusIcon, StatusBadge } from "../../statusUtils";
import { useAuth } from "../../../store/authStore";
import { usePermissions } from "../../../hooks/usePermissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Modal from "../../modal";
import {
  approveWellnessApplicationRequest,
  rejectWellnessApplicationRequest,
  getWellnessApplicationById,
} from "../../../api/wellnessApplication";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";

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

function getIconChipStyle(kind, borderColor) {
  const map = {
    accent: {
      bg: "var(--accent-soft)",
      fg: "var(--accent)",
      br: "var(--accent-soft2, rgba(37,99,235,0.18))",
    },
    green: {
      bg: "rgba(34,197,94,0.14)",
      fg: "#16a34a",
      br: "rgba(34,197,94,0.22)",
    },
    red: {
      bg: "rgba(239,68,68,0.14)",
      fg: "#ef4444",
      br: "rgba(239,68,68,0.22)",
    },
    amber: {
      bg: "rgba(245,158,11,0.16)",
      fg: "#d97706",
      br: "rgba(245,158,11,0.26)",
    },
    slate: {
      bg: "rgba(148,163,184,0.18)",
      fg: "var(--app-text)",
      br: "rgba(148,163,184,0.24)",
    },
    neutral: {
      bg: "var(--app-surface-2)",
      fg: "var(--app-muted)",
      br: borderColor || "var(--app-border)",
    },
  };

  return map[kind] || map.neutral;
}

function getOverallIconChipKind(overallStatus) {
  const s = String(overallStatus || "").toUpperCase();
  if (s === "APPROVED") return "green";
  if (s === "REJECTED") return "red";
  if (s === "CANCELLED") return "slate";
  return "amber";
}

const WellnessApplicationDetailsSkeleton = ({ borderColor, resolvedTheme }) => {
  const skeletonBase =
    resolvedTheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
  const skeletonHighlight =
    resolvedTheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)";

  const baseColor = `var(--skeleton-base, ${skeletonBase})`;
  const highlightColor = `var(--skeleton-highlight, ${skeletonHighlight})`;
  const bgFallback =
    resolvedTheme === "dark" ? "rgba(2,6,23,0.96)" : "rgba(245,245,245,0.80)";

  return (
    <div
      className="flex-1 h-full rounded-xl shadow-md w-full flex flex-col gap-2 max-w-6xl mx-auto min-w-0 border"
      style={{
        backgroundColor: `var(--app-bg, ${bgFallback})`,
        borderColor: borderColor || "var(--app-border)",
      }}
    >
      <SkeletonTheme baseColor={baseColor} highlightColor={highlightColor}>
        <header
          className="flex md:rounded-t-xl flex-col md:flex-row md:items-center justify-between gap-3 border-b px-3 sm:px-4 py-2 z-10"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
          }}
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Skeleton height={48} width={48} borderRadius={12} />
            <div className="min-w-0 flex-1">
              <Skeleton height={18} width={"55%"} />
              <div className="mt-2 flex gap-2">
                <Skeleton height={18} width={110} borderRadius={999} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton height={40} width={110} borderRadius={12} />
            <Skeleton height={40} width={160} borderRadius={12} />
          </div>
        </header>

        <div
          className="flex h-full flex-1 min-h-0 overflow-y-auto app-scrollbar flex-col gap-4 px-3 sm:px-4 py-2"
          style={{ backgroundColor: "transparent" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="md:col-span-2 rounded-xl p-4 sm:p-6"
              style={{ background: "var(--app-surface-2)" }}
            >
              <Skeleton height={26} width={"85%"} />
            </div>
            <div
              className="border rounded-xl p-4 flex justify-between items-center"
              style={{ backgroundColor: "var(--app-surface)", borderColor }}
            >
              <Skeleton height={56} width={56} borderRadius={18} />
              <Skeleton height={22} width={140} borderRadius={10} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div
                className="border rounded-xl p-3"
                style={{ backgroundColor: "var(--app-surface)", borderColor }}
              >
                <Skeleton height={100} />
              </div>
              <div
                className="border rounded-xl p-3"
                style={{ backgroundColor: "var(--app-surface)", borderColor }}
              >
                <Skeleton height={200} />
              </div>
            </div>
            <aside className="space-y-4">
              <div
                className="border rounded-xl p-3"
                style={{ backgroundColor: "var(--app-surface)", borderColor }}
              >
                <Skeleton height={250} />
              </div>
            </aside>
          </div>
        </div>
      </SkeletonTheme>
    </div>
  );
};

const getTonePillStyle = (tone, borderColor) => {
  const t = getIconChipStyle(tone, borderColor);
  return {
    backgroundColor: t.bg,
    color: t.fg,
    borderColor: t.br,
  };
};

const StepDotIcon = ({ status }) => {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED")
    return <CheckCircle2 size={16} className="text-white" />;
  if (s === "REJECTED") return <XCircle size={16} className="text-white" />;
  if (s === "CANCELLED") return <Ban size={16} className="text-white" />;
  return <Users size={16} className="text-white" />;
};

const StepDotClass = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "bg-emerald-500";
  if (s === "REJECTED") return "bg-red-500";
  if (s === "CANCELLED") return "bg-slate-400";
  return "bg-[color:var(--app-border)]";
};

const TimelineCard = ({ approval, index, isLast }) => {
  const status = String(approval?.status || "").toUpperCase();
  const isDenied = status === "REJECTED";
  const isPending = status === "PENDING";
  const isCancelled = status === "CANCELLED";

  const noteStyle = isDenied
    ? { bg: "rgba(239,68,68,0.10)", br: "rgba(239,68,68,0.20)", fg: "#ef4444" }
    : isCancelled
      ? {
          bg: "rgba(148,163,184,0.14)",
          br: "rgba(148,163,184,0.22)",
          fg: "var(--app-text)",
        }
      : {
          bg: "var(--app-surface-2)",
          br: "var(--app-border)",
          fg: "var(--app-text)",
        };

  return (
    <div className="relative flex gap-2 sm:gap-4 items-start min-w-0">
      {!isLast && (
        <div
          className="absolute left-5 top-10 bottom-0 w-0.5"
          style={{ backgroundColor: "var(--app-border)" }}
        />
      )}
      <div
        className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 shadow-md flex-none ${StepDotClass(status)}`}
        style={{ borderColor: "var(--app-surface)" }}
      >
        <StepDotIcon status={status} />
      </div>
      <div
        className={`flex-1 border rounded-2xl p-4 sm:p-5 shadow-xs min-w-0 ${isPending ? "opacity-90" : ""}`}
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: "var(--app-border)",
        }}
      >
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--app-muted)" }}
            >
              Approver {index + 1}
            </span>
            <p
              className="text-sm font-semibold break-words mt-1"
              style={{ color: "var(--app-text)" }}
            >
              {approval.approver?.firstName} {approval.approver?.lastName}
            </p>
            <p
              className="text-xs font-medium break-words"
              style={{ color: "var(--accent)" }}
            >
              {approval.approver?.position || "Approver"}
            </p>
          </div>
          <div className="flex-none">
            <StatusBadge status={status} size="sm" />
          </div>
        </div>
        {isCancelled && !approval?.remarks ? (
          <div
            className="mt-4 rounded-xl text-xs flex items-start gap-2 border p-3"
            style={{
              backgroundColor: "rgba(148,163,184,0.14)",
              borderColor: "rgba(148,163,184,0.22)",
              color: "var(--app-text)",
            }}
          >
            <Ban size={14} className="shrink-0 mt-0.5" />
            <p>
              <strong>Auto-cancelled:</strong> A previous approver rejected this
              request.
            </p>
          </div>
        ) : null}
        {approval?.remarks && String(approval.remarks).trim() !== "" && (
          <div
            className="mt-4 rounded-xl p-3 text-xs leading-relaxed border flex items-start gap-2"
            style={{
              backgroundColor: noteStyle.bg,
              borderColor: noteStyle.br,
              color: noteStyle.fg,
            }}
          >
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>
              <strong>Note:</strong> {approval.remarks}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const pad2 = (n) => String(n).padStart(2, "0");
const toDateKeyLocal = (dateLike) => {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const RequestedDatesCalendar = ({ dates = [] }) => {
  const requestedKeys = useMemo(() => {
    const set = new Set();
    (Array.isArray(dates) ? dates : []).forEach((x) => {
      const key = toDateKeyLocal(x);
      if (key) set.add(key);
    });
    return set;
  }, [dates]);

  const earliestRequested = useMemo(() => {
    const arr = (Array.isArray(dates) ? dates : [])
      .map((x) => new Date(x))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return arr[0] || null;
  }, [dates]);

  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(earliestRequested || new Date()),
  );

  useEffect(() => {
    if (earliestRequested) setViewMonth(startOfMonth(earliestRequested));
  }, [earliestRequested]);

  const monthLabel = useMemo(
    () =>
      viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    [viewMonth],
  );
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const grid = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const last = endOfMonth(viewMonth);
    const leadingBlanks = first.getDay();
    const daysInMonth = last.getDate();
    const cells = [];

    for (let i = 0; i < leadingBlanks; i++)
      cells.push({ type: "blank", key: `b-${i}` });
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      const key = toDateKeyLocal(d);
      cells.push({
        type: "day",
        key,
        day,
        date: d,
        isRequested: key ? requestedKeys.has(key) : false,
        isToday: isSameDay(d, new Date()),
      });
    }
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++)
        cells.push({ type: "blank", key: `t-${i}` });
    }
    return cells;
  }, [viewMonth, requestedKeys]);

  return (
    <div
      className="border rounded-xl p-2 sm:p-3 shadow-sm min-w-0"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: "var(--app-border)",
        color: "var(--app-text)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h4
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--app-muted)" }}
          >
            Calendar
          </h4>
          <p
            className="text-[11px] font-medium"
            style={{ color: "var(--app-muted)" }}
          >
            Requested dates highlighted
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-none">
          <button
            onClick={() => setViewMonth((d) => addMonths(d, -1))}
            className="h-9 w-9 rounded-xl border bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)] flex items-center justify-center"
            style={{ borderColor: "var(--app-border)" }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setViewMonth((d) => addMonths(d, 1))}
            className="h-9 w-9 rounded-xl border bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)] flex items-center justify-center"
            style={{ borderColor: "var(--app-border)" }}
          >
            <ChevronRight size={16} />
          </button>
          <button
            disabled={!earliestRequested}
            onClick={() =>
              earliestRequested && setViewMonth(startOfMonth(earliestRequested))
            }
            className={`h-9 px-2.5 rounded-xl border inline-flex items-center gap-1.5 ${earliestRequested ? "bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)]" : "bg-[color:var(--app-surface-2)] opacity-60"}`}
            style={{
              borderColor: "var(--app-border)",
              color: earliestRequested ? "var(--app-text)" : "var(--app-muted)",
            }}
          >
            <RotateCcw size={14} />
            <span className="text-[11px] font-bold">Reset</span>
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 min-w-0">
        <span
          className="h-9 w-9 rounded-xl flex items-center justify-center border flex-none"
          style={{
            backgroundColor: "var(--accent-soft)",
            color: "var(--accent)",
            borderColor: "var(--accent-soft2)",
          }}
        >
          <CalendarDays size={16} />
        </span>
        <p
          className="text-sm font-bold truncate"
          style={{ color: "var(--app-text)" }}
        >
          {monthLabel}
        </p>
      </div>
      <div className="mt-3">
        <div className="grid grid-cols-7 gap-1.5">
          {dayNames.map((dn) => (
            <div
              key={dn}
              className="text-[10px] font-bold uppercase tracking-wider text-center py-1"
              style={{ color: "var(--app-muted)" }}
            >
              {dn}
            </div>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {grid.map((cell, idx) =>
            cell.type === "blank" ? (
              <div
                key={`blank-${idx}`}
                className="h-9 rounded-xl bg-transparent"
              />
            ) : (
              <div
                key={`d-${idx}`}
                className={`h-9 rounded-xl border text-sm font-semibold flex items-center justify-center transition select-none ${cell.isRequested ? "shadow-sm" : ""} ${cell.isToday ? "ring-2 ring-blue-200 ring-offset-2" : ""}`}
                style={{
                  backgroundColor: cell.isRequested
                    ? "var(--accent)"
                    : "var(--app-surface)",
                  color: cell.isRequested ? "#fff" : "var(--app-text)",
                  borderColor: cell.isRequested
                    ? "var(--accent)"
                    : "var(--app-border)",
                }}
              >
                <span className="relative">{cell.day}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
};

const WellnessApplicationDetails = () => {
  const { admin } = useAuth();

  // ✅ Extract admin ID safely
  const adminId = admin?.id || admin?._id;

  const { can } = usePermissions();
  const canManageApplication = can("wellness.manage_application");
  const { id } = useParams();
  const queryClient = useQueryClient();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);
  const borderColor = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.07)"
        : "rgba(15,23,42,0.10)",
    [resolvedTheme],
  );

  const [isProcessed, setIsProcessed] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch the data
  const {
    data: rawData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["wellnessApplication", adminId, id],
    queryFn: () => getWellnessApplicationById(id),
    // ✅ Ensure query only runs if both adminId and application id exist
    enabled: !!adminId && !!id,
  });

  // ✅ Safely unwrap nested `data` object from API response
  const application = rawData?.data || rawData;

  const requestedDatesLabel = useMemo(() => {
    const dates = application?.inclusiveDates || [];
    if (!dates.length) return "No dates set";
    return dates
      .map((d) =>
        new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      )
      .join(", ");
  }, [application?.inclusiveDates]);

  const sortedApprovals = useMemo(() => {
    if (!Array.isArray(application?.approvals)) return [];
    return [...application.approvals].sort(
      (a, b) => (a.level || 0) - (b.level || 0),
    );
  }, [application?.approvals]);

  const approveMutation = useMutation({
    mutationFn: (applicationId) =>
      approveWellnessApplicationRequest(applicationId),
    onSuccess: () => {
      setIsProcessed(true);
      setIsModalOpen(false);
      toast.success("Wellness Leave approved successfully.");
      queryClient.invalidateQueries(["wellnessApplication", id]);
      queryClient.invalidateQueries(["wellnessApplicationsApprovals"]);
      queryClient.invalidateQueries(["wellnessPendingCount"]);
    },
    onError: (err) => toast.error(err.message || "Failed to approve."),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ applicationId, remarks }) =>
      rejectWellnessApplicationRequest(applicationId, remarks),
    onSuccess: () => {
      setRemarks("");
      setIsProcessed(true);
      setIsModalOpen(false);
      toast.success("Wellness Leave rejected.");
      queryClient.invalidateQueries(["wellnessApplication", id]);
      queryClient.invalidateQueries(["wellnessApplicationsApprovals"]);
      queryClient.invalidateQueries(["wellnessPendingCount"]);
    },
    onError: (err) => toast.error(err.message || "Failed to reject."),
  });

  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  const handleAction = () => {
    if (!application || isMutating) return;
    if (modalType === "approve") {
      approveMutation.mutate(application._id);
    } else {
      if (!remarks.trim()) return toast.error("Please provide a reason.");
      rejectMutation.mutate({ applicationId: application._id, remarks });
    }
  };

  useEffect(() => {
    setIsProcessed(false);
    setRemarks("");
  }, [application]);

  if (isLoading)
    return (
      <WellnessApplicationDetailsSkeleton
        borderColor={borderColor}
        resolvedTheme={resolvedTheme}
      />
    );
  if (isError)
    return <p style={{ color: "var(--app-muted)" }}>Error: {error?.message}</p>;
  if (!application || !application._id)
    return (
      <div
        className="flex flex-col items-center justify-center py-40 rounded-xl border-2 border-dashed m-4"
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor: "var(--app-border)",
        }}
      >
        <h3 className="font-semibold" style={{ color: "var(--app-text)" }}>
          No Application Found
        </h3>
      </div>
    );

  const initials = `${application.employee?.firstName?.[0] || ""}${application.employee?.lastName?.[0] || ""}`;

  // ✅ Match approver against properly checked adminId
  const currentStep = application.approvals?.find(
    (step) => String(step.approver?._id || step.approver) === String(adminId),
  );

  const canApproveOrReject =
    currentStep?.status === "PENDING" &&
    application.overallStatus === "PENDING" &&
    !isProcessed;

  const overallPillStyle = getTonePillStyle(
    (
      STATUS_META[String(application.overallStatus).toUpperCase()] ||
      STATUS_META.PENDING
    ).tone,
    borderColor,
  );

  const overallIconChip = getIconChipStyle(
    getOverallIconChipKind(application.overallStatus),
    borderColor,
  );

  return (
    <div
      className="flex-1 h-full rounded-xl shadow-md w-full flex flex-col gap-2 max-w-6xl mx-auto min-w-0 border"
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--app-text)",
        borderColor: borderColor,
      }}
    >
      <header
        className="flex md:rounded-t-xl flex-col md:flex-row md:items-center justify-between gap-3 border-b px-3 sm:px-4 py-2 z-10"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: borderColor,
        }}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div
            className="h-12 w-12 rounded-xl text-white flex items-center justify-center font-bold text-lg flex-none"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h2
              className="text-lg font-bold leading-tight truncate"
              style={{ color: "var(--app-text)" }}
            >
              {application.employee?.firstName} {application.employee?.lastName}
            </h2>
            <div
              className="flex flex-wrap items-center gap-2 text-xs font-medium mt-0.5"
              style={{ color: "var(--app-muted)" }}
            >
              <span
                className="px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent)",
                  borderColor: "var(--accent-soft2)",
                }}
              >
                ID: {application.employee?.employeeId || "N/A"}
              </span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold"
                style={overallPillStyle}
              >
                {application.overallStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-row items-center gap-2 sm:gap-3 w-full md:w-auto">
          {canApproveOrReject ? (
            canManageApplication && (
              <>
                <button
                  onClick={() => {
                    setModalType("reject");
                    setIsModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg font-semibold border"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    color: "var(--app-text)",
                    borderColor,
                  }}
                >
                  Reject
                </button>
                <button
                  onClick={() => {
                    setModalType("approve");
                    setIsModalOpen(true);
                  }}
                  disabled={approveMutation.isPending}
                  className="w-full sm:w-auto rounded-lg px-4 py-2 font-medium"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "#fff",
                    opacity: approveMutation.isPending ? 0.8 : 1,
                  }}
                >
                  {approveMutation.isPending
                    ? "Processing..."
                    : "Approve Leave"}
                </button>
              </>
            )
          ) : (
            <div
              className="px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold border"
              style={{
                backgroundColor: "rgba(34,197,94,0.14)",
                color: "#16a34a",
                borderColor: "rgba(34,197,94,0.22)",
              }}
            >
              <BadgeCheck size={18} /> Action Completed
            </div>
          )}
        </div>
      </header>

      <div className="flex h-full flex-1 min-h-0 overflow-y-auto app-scrollbar flex-col gap-4 px-3 sm:px-4 py-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
          <div
            className="md:col-span-2 rounded-xl p-4 sm:p-6 text-white flex gap-3 justify-between items-center relative overflow-hidden min-w-0"
            style={{
              background:
                "linear-gradient(135deg, var(--accent) 80%, rgba(255,255,255,0.16) 140%)",
            }}
          >
            <CalendarDays className="absolute right-[-20px] top-[-20px] h-40 w-40 text-white/10 rotate-12" />
            <div className="min-w-0">
              <p className="text-white/90 text-xs font-bold uppercase tracking-widest mb-1">
                Requested Dates
              </p>
              <h3 className="text-xl md:text-2xl font-bold break-words">
                {requestedDatesLabel}
              </h3>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl flex-none">
              <p className="text-[10px] text-white/90 uppercase font-bold">
                Total Duration
              </p>
              <p className="text-xl font-bold">{application.totalDays} Days</p>
            </div>
          </div>

          <div
            className="border rounded-xl p-4 flex justify-between items-center text-center gap-4 min-w-0"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
            }}
          >
            <div
              className="p-4 rounded-2xl border"
              style={{
                backgroundColor: overallIconChip.bg,
                borderColor: overallIconChip.br,
                color: overallIconChip.fg,
              }}
            >
              <StatusIcon
                status={application.overallStatus}
                size={32}
                className="h-6 w-6"
              />
            </div>
            <div className="text-start min-w-0">
              <p
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--app-muted)" }}
              >
                Global Status
              </p>
              <p
                className="text-xl font-black break-words"
                style={{ color: "var(--app-text)" }}
              >
                {application.overallStatus}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <section
              className="border rounded-xl p-3 shadow-sm min-w-0"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span
                  className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border"
                  style={getIconChipStyle("accent", borderColor)}
                >
                  <MessageCircle size={20} />
                </span>
                <h3
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--app-muted)" }}
                >
                  Purpose of Leave
                </h3>
              </div>
              <p
                className="leading-relaxed italic p-4 rounded-2xl border break-words"
                style={{
                  color: "var(--app-text)",
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                }}
              >
                "{application.reason || "No specific reason provided."}"
              </p>
            </section>

            <section
              className="border rounded-xl p-3 shadow-sm min-w-0"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span
                  className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border"
                  style={getIconChipStyle("green", borderColor)}
                >
                  <History size={18} />
                </span>
                <div className="min-w-0">
                  <h3
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Processing Timeline
                  </h3>
                  <p
                    className="text-xs font-medium"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Step-by-step approval progress
                  </p>
                </div>
              </div>
              {sortedApprovals.length > 0 ? (
                <div className="relative space-y-6 sm:space-y-8 t-1 min-w-0">
                  <div
                    className="absolute left-5 top-2 bottom-2 w-0.5"
                    style={{ backgroundColor: "var(--app-border)" }}
                  />
                  {sortedApprovals.map((approval, idx) => (
                    <TimelineCard
                      key={approval?._id || idx}
                      approval={approval}
                      index={idx}
                      isLast={idx === sortedApprovals.length - 1}
                    />
                  ))}
                  {String(application.overallStatus || "").toUpperCase() ===
                    "APPROVED" && (
                    <div className="relative flex gap-2 sm:gap-4 items-start">
                      <div className="relative z-10 h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center border-4 border-white shadow-md flex-none">
                        <CheckCircle2 size={18} className="text-white" />
                      </div>
                      <div
                        className="flex-1 rounded-2xl p-4 shadow-sm border"
                        style={{
                          backgroundColor: "rgba(34,197,94,0.14)",
                          borderColor: "rgba(34,197,94,0.22)",
                        }}
                      >
                        <p
                          className="font-bold text-sm"
                          style={{ color: "#16a34a" }}
                        >
                          Leave Fully Approved
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl text-center"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: "var(--app-border)",
                  }}
                >
                  <Users
                    size={32}
                    style={{ color: "var(--app-muted)" }}
                    className="mb-3"
                  />
                  <p
                    style={{ color: "var(--app-text)" }}
                    className="font-medium"
                  >
                    Waiting for workflow initiation
                  </p>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4 min-w-0">
            <RequestedDatesCalendar dates={application?.inclusiveDates || []} />
          </aside>
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            modalType === "approve" ? "Confirm Approval" : "Decline Request"
          }
          maxWidth="max-w-lg"
          action={{
            show: true,
            label:
              modalType === "approve"
                ? approveMutation.isPending
                  ? "Approving..."
                  : "Approve"
                : rejectMutation.isPending
                  ? "Rejecting..."
                  : "Reject",
            variant: modalType === "approve" ? "save" : "delete",
            onClick: handleAction,
            disabled: isMutating || (modalType === "reject" && !remarks.trim()),
          }}
        >
          <div className="p-2">
            <div className="mb-6 flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="mt-0.5 p-1.5 bg-white rounded-lg border border-slate-200 shadow-sm text-slate-400">
                <Info size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Reviewing Request For
                </p>
                <p className="text-sm font-bold text-slate-900 break-words">
                  {application.employee?.firstName}{" "}
                  {application.employee?.lastName}
                </p>
              </div>
            </div>
            {modalType === "approve" ? (
              <div className="text-center py-4 max-w-sm mx-auto">
                <div className="mx-auto h-20 w-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border-4 border-emerald-100/50 shadow-inner">
                  <Check size={40} strokeWidth={3} />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Are you sure you want to approve this Wellness Leave?
                </h2>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-rose-600">
                  <AlertCircle size={18} />
                  <h3 className="font-bold text-sm">Reason for Rejection</h3>
                </div>
                <div className="relative">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Please explain why this request is being declined..."
                    className={`w-full p-4 bg-white border-2 rounded-2xl outline-none min-h-[140px] text-sm text-slate-700 transition-all ${remarks.trim() ? "border-slate-200 focus:border-blue-500" : "border-rose-100 focus:border-rose-300 placeholder:text-rose-300"}`}
                  />
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

const STATUS_META = {
  APPROVED: { label: "APPROVED", tone: "green" },
  REJECTED: { label: "REJECTED", tone: "red" },
  PENDING: { label: "PENDING", tone: "amber" },
  CANCELLED: { label: "CANCELLED", tone: "slate" },
};

export default WellnessApplicationDetails;
