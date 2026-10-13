// wellnessApplicationDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Clock,
  FileText,
  BadgeCheck,
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
  FileBadge,
  PenTool,
  Paperclip,
  Hourglass,
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
import { getMyProfile } from "../../../api/employee";
import { buildApiUrl } from "../../../config/env";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

// PDF Modals
import WellnessApplicationPdfModal from "../wellnessApplicationComponents/wellnessApplicationModal";
import OrganicWellnessApplicationPdfModal from "../wellnessApplicationComponents/organicWellnessApplicationPDFModal";

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
   Small helpers
========================= */
const upper = (v) => String(v || "").toUpperCase();
const idOf = (v) => String(v?._id || v || "");
const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;

/* =========================
   Theme-aware icon chip styles
========================= */
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
  const s = upper(overallStatus);
  if (s === "APPROVED") return "green";
  if (s === "REJECTED") return "red";
  if (s === "CANCELLED") return "slate";
  return "amber";
}

/* =========================
   Section title (shared)
========================= */
const SectionTitle = ({
  icon: Icon,
  kind = "accent",
  title,
  subtitle,
  right,
  borderColor,
  titleColor,
  subtitleColor,
}) => {
  const chip = getIconChipStyle(kind, borderColor);
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border"
          style={{
            backgroundColor: chip.bg,
            color: chip.fg,
            borderColor: chip.br,
          }}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h3
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: titleColor || "var(--app-muted)" }}
          >
            {title}
          </h3>
          {subtitle ? (
            <p
              className="text-xs font-medium mt-0.5"
              style={{ color: subtitleColor || "var(--app-muted)" }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {right ? <div className="flex-none">{right}</div> : null}
    </div>
  );
};

/* =========================
   LOADING SKELETON
========================= */
const WellnessApplicationDetailsSkeleton = ({ borderColor, resolvedTheme }) => {
  const skeletonBase =
    resolvedTheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
  const skeletonHighlight =
    resolvedTheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)";

  const baseColor = `var(--skeleton-base, ${skeletonBase})`;
  const highlightColor = `var(--skeleton-highlight, ${skeletonHighlight})`;

  const border = borderColor || "var(--app-border, rgba(15,23,42,0.10))";
  const cardStyle = {
    backgroundColor: "var(--app-surface, rgba(255,255,255,0.9))",
    borderColor: border,
  };

  return (
    <div
      className="flex-1 h-full rounded-xl shadow-md w-full flex flex-col min-w-0 border overflow-hidden"
      aria-busy="true"
      aria-label="Loading application details"
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--app-text, #0f172a)",
        borderColor: border,
      }}
    >
      <SkeletonTheme baseColor={baseColor} highlightColor={highlightColor}>
        <header
          className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b px-3 py-3"
          style={cardStyle}
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <Skeleton height={48} width={48} borderRadius={12} />
            <div className="min-w-0 flex-1">
              <Skeleton height={18} width={"55%"} />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Skeleton height={18} width={110} borderRadius={999} />
                <Skeleton height={18} width={80} borderRadius={999} />
                <Skeleton height={18} width={120} borderRadius={999} />
                <Skeleton height={18} width={90} borderRadius={999} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            <Skeleton height={40} width={110} borderRadius={10} />
            <Skeleton height={40} width={160} borderRadius={10} />
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar flex flex-col gap-4 px-2 sm:px-3 py-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
            <div
              className="md:col-span-2 rounded-xl p-4 sm:p-6 relative overflow-hidden shadow-sm min-w-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent, #2563eb) 0%, rgba(255,255,255,0.16) 140%)",
              }}
            >
              <div className="relative z-10 flex gap-3 justify-between items-center min-w-0">
                <div className="min-w-0 flex-1">
                  <Skeleton height={12} width={140} borderRadius={8} />
                  <div className="mt-2">
                    <Skeleton height={26} width={"75%"} borderRadius={10} />
                  </div>
                </div>
                <div
                  className="backdrop-blur-md px-4 py-2 rounded-xl flex-none"
                  style={{ backgroundColor: "rgba(255,255,255,0.20)" }}
                >
                  <Skeleton height={10} width={90} borderRadius={8} />
                  <div className="mt-2">
                    <Skeleton height={22} width={70} borderRadius={10} />
                  </div>
                </div>
              </div>
            </div>

            <div
              className="border rounded-xl p-4 flex justify-between items-center gap-4 min-w-0"
              style={cardStyle}
            >
              <Skeleton height={56} width={56} borderRadius={16} />
              <div className="min-w-0 flex-1 text-end">
                <Skeleton height={12} width={120} borderRadius={8} />
                <div className="mt-2">
                  <Skeleton height={22} width={110} borderRadius={10} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
            <div className="lg:col-span-2 flex flex-col gap-4 min-w-0">
              <section
                className="border rounded-xl p-4 sm:p-5 shadow-sm"
                style={cardStyle}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton height={40} width={40} borderRadius={12} />
                  <Skeleton height={12} width={170} borderRadius={8} />
                </div>
                <Skeleton height={80} borderRadius={16} />
              </section>

              <section
                className="border rounded-xl p-4 sm:p-5 shadow-sm"
                style={cardStyle}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton height={40} width={40} borderRadius={12} />
                  <div className="flex-1">
                    <Skeleton height={12} width={170} borderRadius={8} />
                    <div className="mt-2">
                      <Skeleton height={10} width={120} borderRadius={8} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="flex gap-3 sm:gap-4 items-start">
                      <Skeleton circle height={40} width={40} />
                      <div className="flex-1">
                        <Skeleton height={76} borderRadius={12} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="flex flex-col gap-4 min-w-0">
              <div
                className="border rounded-xl p-4 shadow-sm"
                style={cardStyle}
              >
                <Skeleton height={12} width={120} borderRadius={8} />
                <div className="mt-3 flex flex-col gap-2">
                  <Skeleton height={48} borderRadius={12} />
                  <Skeleton height={48} borderRadius={12} />
                </div>
              </div>

              <div
                className="border rounded-xl p-4 shadow-sm"
                style={cardStyle}
              >
                <div className="flex items-center justify-between">
                  <Skeleton height={12} width={120} borderRadius={8} />
                  <Skeleton height={28} width={90} borderRadius={10} />
                </div>
                <div className="mt-4 grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} height={34} borderRadius={10} />
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </SkeletonTheme>
    </div>
  );
};

/* =========================
   Status helpers
========================= */
const STATUS_META = {
  APPROVED: { label: "APPROVED", tone: "green" },
  REJECTED: { label: "REJECTED", tone: "red" },
  PENDING: { label: "PENDING", tone: "amber" },
  CANCELLED: { label: "CANCELLED", tone: "slate" },
};

const getTonePillStyle = (tone, borderColor) => {
  const t = getIconChipStyle(tone, borderColor);
  return {
    backgroundColor: t.bg,
    color: t.fg,
    borderColor: t.br,
  };
};

/* =========================
   Processing workflow step
========================= */
const STEP_DOT = {
  APPROVED: { bg: "#10b981", icon: CheckCircle2 },
  REJECTED: { bg: "#ef4444", icon: XCircle },
  CANCELLED: { bg: "#94a3b8", icon: Ban },
};

const TimelineStep = ({
  approval,
  index,
  isLast,
  isMine,
  isActive, // pending and it's this approver's turn
  isQueued, // pending but the approver before hasn't acted yet
  borderColor,
}) => {
  const status = upper(approval?.status);
  const isRejected = status === "REJECTED";
  const isCancelled = status === "CANCELLED";

  const dot = STEP_DOT[status];
  const DotIcon = dot?.icon || (isActive ? Hourglass : Users);
  const dotBg = dot?.bg || (isActive ? "#f59e0b" : "var(--app-surface-2)");
  const dotFg = dot || isActive ? "#fff" : "var(--app-muted)";

  // Prefer the historical snapshot, fall back to the live approver
  const snap = approval?.approverSnapshot || {};
  const live = approval?.approver || {};
  const name =
    [snap.firstName || live.firstName, snap.lastName || live.lastName]
      .filter(Boolean)
      .join(" ") || "Unassigned approver";
  const position = snap.position || live.position || "Approver";
  const signedAt = snap.signedAt || approval?.approverSignature?.signedAt;
  const remarks = String(approval?.remarks || "").trim();

  const note = isRejected
    ? getIconChipStyle("red", borderColor)
    : isCancelled
      ? getIconChipStyle("slate", borderColor)
      : getIconChipStyle("neutral", borderColor);
  const amber = getIconChipStyle("amber", borderColor);

  return (
    <li className="relative flex gap-3 sm:gap-4 min-w-0">
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute left-[19px] top-11 -bottom-3 w-0.5"
          style={{ backgroundColor: "var(--app-border)" }}
        />
      )}

      <div
        className="relative z-10 h-10 w-10 rounded-full flex items-center justify-center flex-none border-4 shadow-sm"
        style={{
          backgroundColor: dotBg,
          color: dotFg,
          borderColor: "var(--app-surface)",
        }}
        title={isQueued ? "UPCOMING" : status}
      >
        <DotIcon size={16} />
      </div>

      <div
        className="flex-1 min-w-0 rounded-xl border p-3 sm:p-4"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: isActive ? "rgba(245,158,11,0.45)" : borderColor,
          borderStyle: isQueued ? "dashed" : "solid",
          opacity: isQueued ? 0.85 : 1,
        }}
      >
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "var(--app-muted)" }}
              >
                Approver {index + 1}
              </span>
              {isMine && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded border"
                  style={{
                    backgroundColor: "var(--accent-soft)",
                    color: "var(--accent)",
                    borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
                  }}
                >
                  You
                </span>
              )}
              {isActive && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                  style={{
                    backgroundColor: amber.bg,
                    color: amber.fg,
                    borderColor: amber.br,
                  }}
                >
                  Awaiting action
                </span>
              )}
            </div>

            <p
              className="text-sm font-semibold break-words mt-1"
              style={{ color: "var(--app-text)" }}
            >
              {name}
            </p>
            <p
              className="text-xs font-medium break-words"
              style={{ color: "var(--accent)" }}
            >
              {position}
            </p>
          </div>

          <div className="flex-none">
            {isQueued ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  color: "var(--app-muted)",
                  borderColor,
                }}
              >
                <Hourglass size={11} />
                Upcoming
              </span>
            ) : (
              <StatusBadge status={status} size="sm" />
            )}
          </div>
        </div>

        {/* Each queued step waits for the approver right before it */}
        {isQueued && index > 0 ? (
          <p className="mt-2 text-[11px]" style={{ color: "var(--app-muted)" }}>
            Waits for Approver {index} to act first
          </p>
        ) : null}

        {signedAt && status !== "PENDING" ? (
          <p className="mt-2 text-[11px]" style={{ color: "var(--app-muted)" }}>
            Signed on {new Date(signedAt).toLocaleString()}
          </p>
        ) : null}

        {isCancelled && !remarks ? (
          <div
            className="mt-3 rounded-lg text-xs flex items-start gap-2 border p-2.5"
            style={{
              backgroundColor: "rgba(148,163,184,0.14)",
              borderColor: "rgba(148,163,184,0.22)",
              color: "var(--app-text)",
            }}
          >
            <Ban size={14} className="shrink-0 mt-0.5" />
            <p className="break-words">
              <strong>Auto-cancelled:</strong> A previous approver rejected this
              request.
            </p>
          </div>
        ) : null}

        {remarks ? (
          <div
            className="mt-3 rounded-lg p-2.5 text-xs leading-relaxed border flex items-start gap-2"
            style={{
              backgroundColor: note.bg,
              borderColor: note.br,
              color: isRejected ? "#ef4444" : "var(--app-text)",
            }}
          >
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p className="break-words whitespace-pre-wrap">
              <strong>Note:</strong> {remarks}
            </p>
          </div>
        ) : null}
      </div>
    </li>
  );
};

/* =========================
   Calendar helpers
========================= */
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

  const monthLabel = useMemo(() => {
    return viewMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [viewMonth]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const grid = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const last = endOfMonth(viewMonth);
    const today = new Date();
    const cells = [];

    for (let i = 0; i < first.getDay(); i++) {
      cells.push({ type: "blank", key: `b-${i}` });
    }

    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      const key = toDateKeyLocal(d);
      cells.push({
        type: "day",
        key,
        day,
        date: d,
        isRequested: key ? requestedKeys.has(key) : false,
        isToday: isSameDay(d, today),
      });
    }

    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        cells.push({ type: "blank", key: `t-${i}` });
      }
    }

    return cells;
  }, [viewMonth, requestedKeys]);

  const requestedCountThisMonth = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    let count = 0;
    requestedKeys.forEach((k) => {
      const [yy, mm] = k.split("-").map((x) => Number(x));
      if (!yy || !mm) return;
      if (yy === y && mm - 1 === m) count += 1;
    });
    return count;
  }, [requestedKeys, viewMonth]);

  const hasAnyDates = requestedKeys.size > 0;

  const navBtn =
    "h-9 w-9 rounded-xl border flex items-center justify-center transition " +
    "bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)] " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]";

  return (
    <div
      className="border rounded-xl p-4 shadow-sm min-w-0"
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
            className="text-[11px] font-medium mt-0.5"
            style={{ color: "var(--app-muted)" }}
          >
            Requested dates highlighted
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-none">
          <button
            type="button"
            onClick={() => setViewMonth((d) => addMonths(d, -1))}
            className={navBtn}
            style={{ borderColor: "var(--app-border)" }}
            title="Previous month"
          >
            <ChevronLeft size={16} style={{ color: "var(--app-text)" }} />
          </button>

          <button
            type="button"
            onClick={() => setViewMonth((d) => addMonths(d, 1))}
            className={navBtn}
            style={{ borderColor: "var(--app-border)" }}
            title="Next month"
          >
            <ChevronRight size={16} style={{ color: "var(--app-text)" }} />
          </button>

          <button
            type="button"
            disabled={!earliestRequested}
            onClick={() =>
              earliestRequested && setViewMonth(startOfMonth(earliestRequested))
            }
            className={`${navBtn} w-auto px-2.5 gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed`}
            style={{
              borderColor: "var(--app-border)",
              color: earliestRequested ? "var(--app-text)" : "var(--app-muted)",
            }}
            title="Jump to requested month"
          >
            <RotateCcw size={14} />
            <span className="text-[11px] font-bold">Reset</span>
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 min-w-0">
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
          <div className="min-w-0">
            <p
              className="text-sm font-bold truncate"
              style={{ color: "var(--app-text)" }}
            >
              {monthLabel}
            </p>
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--app-muted)" }}
            >
              {hasAnyDates
                ? `${plural(requestedCountThisMonth, "requested day")} this month`
                : "No requested dates"}
            </p>
          </div>
        </div>

        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg border flex-none"
          style={{
            color: "var(--app-muted)",
            backgroundColor: "var(--app-surface-2)",
            borderColor: "var(--app-border)",
          }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "var(--accent)" }}
          />
          Requested
        </span>
      </div>

      <div className="mt-4">
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
          {grid.map((cell, idx) => {
            if (cell.type === "blank") {
              return <div key={cell.key || `blank-${idx}`} className="h-9" />;
            }

            return (
              <div
                key={cell.key || `d-${idx}`}
                className={`h-9 rounded-xl border text-sm font-semibold flex items-center justify-center transition select-none ${
                  cell.isRequested ? "shadow-sm" : ""
                }`}
                style={{
                  backgroundColor: cell.isRequested
                    ? "var(--accent)"
                    : "var(--app-surface)",
                  color: cell.isRequested ? "#fff" : "var(--app-text)",
                  borderColor: cell.isRequested
                    ? "var(--accent)"
                    : "var(--app-border)",
                  boxShadow: cell.isToday
                    ? "0 0 0 2px var(--app-surface), 0 0 0 4px var(--accent-soft2, rgba(37,99,235,0.35))"
                    : undefined,
                }}
                title={
                  cell.isRequested
                    ? "Requested date"
                    : cell.isToday
                      ? "Today"
                      : ""
                }
              >
                <span className="relative">
                  {cell.day}
                  {cell.isRequested ? (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-white/90" />
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>

        {!hasAnyDates ? (
          <div
            className="mt-3 rounded-xl border border-dashed px-3 py-3 text-center"
            style={{
              borderColor: "var(--app-border)",
              backgroundColor: "var(--app-surface-2)",
            }}
          >
            <p
              className="text-xs font-medium"
              style={{ color: "var(--app-muted)" }}
            >
              No dates to highlight
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/* =========================
   Document button style
========================= */
const DOC_BTN =
  "w-full inline-flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition " +
  "bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)] " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]";

/* =========================
   WELLNESS APPLICATION DETAILS
========================= */
const WellnessApplicationDetails = () => {
  const { admin } = useAuth();
  const adminId = admin?.id || admin?._id;
  const navigate = useNavigate();

  const { can } = usePermissions();
  const canManageApplication = can("wellness.manage_application");
  const { id } = useParams();
  const queryClient = useQueryClient();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const [isProcessed, setIsProcessed] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [isCsc6PdfOpen, setIsCsc6PdfOpen] = useState(false);

  // Current user's profile, to check for a signature
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ["myProfile"],
    queryFn: getMyProfile,
    staleTime: 1000 * 60 * 5,
  });

  const hasSignature = Boolean(profileData?.signature || admin?.signature);

  const {
    data: rawData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["wellnessApplication", adminId, id],
    queryFn: () => getWellnessApplicationById(id),
    enabled: !!adminId && !!id,
  });

  const application = rawData?.data || rawData;

  const requestedDatesLabel = useMemo(() => {
    const dates = application?.inclusiveDates || [];
    if (!dates.length) return "No dates set";
    return [...dates]
      .map((d) => new Date(d))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b)
      .map((d) =>
        d.toLocaleDateString("en-US", {
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

  const invalidateApprovalQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["wellnessApplication"] });
    queryClient.invalidateQueries({
      queryKey: ["wellnessApplicationsApprovals"],
    });
    queryClient.invalidateQueries({ queryKey: ["wellnessPendingCount"] });
  };

  const approveMutation = useMutation({
    mutationFn: (applicationId) =>
      approveWellnessApplicationRequest(applicationId),
    onSuccess: () => {
      setIsProcessed(true);
      setIsModalOpen(false);
      toast.success("Wellness Leave approved successfully.");
      invalidateApprovalQueries();
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
      invalidateApprovalQueries();
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
      rejectMutation.mutate({
        applicationId: application._id,
        remarks: remarks.trim(),
      });
    }
  };

  // Reset when switching to a different application
  useEffect(() => {
    setRemarks("");
    setIsPdfOpen(false);
    setIsCsc6PdfOpen(false);
  }, [id]);

  // Fresh server data replaces the local "processed" flag
  useEffect(() => {
    setIsProcessed(false);
  }, [application]);

  if (isLoading)
    return (
      <WellnessApplicationDetailsSkeleton
        borderColor={borderColor}
        resolvedTheme={resolvedTheme}
      />
    );

  if (isError)
    return (
      <p className="p-4" style={{ color: "var(--app-muted)" }}>
        Error: {error?.message}
      </p>
    );

  if (!application || !application._id)
    return (
      <div
        className="flex flex-col items-center justify-center py-40 rounded-xl border-2 border-dashed m-2 sm:m-3"
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor: "var(--app-border)",
          color: "var(--app-text)",
        }}
      >
        <FileText className="h-10 w-10" style={{ color: "var(--app-muted)" }} />
        <h3 className="font-semibold mt-2" style={{ color: "var(--app-text)" }}>
          No Application Found
        </h3>
      </div>
    );

  const initials = `${application.employee?.firstName?.[0] || ""}${
    application.employee?.lastName?.[0] || ""
  }`;

  const overall = upper(application.overallStatus);

  // Workflow position
  const myIndex = sortedApprovals.findIndex(
    (step) => idOf(step?.approver) === String(adminId),
  );
  const currentStep = myIndex >= 0 ? sortedApprovals[myIndex] : null;
  const myStatus = upper(currentStep?.status);

  // The step whose turn it is = first PENDING step while the request is pending
  const activeIndex =
    overall === "PENDING"
      ? sortedApprovals.findIndex((s) => upper(s?.status) === "PENDING")
      : -1;
  const waitingForLevel = activeIndex >= 0 ? activeIndex + 1 : null;

  const isMyTurn = myIndex >= 0 && myIndex === activeIndex;
  const isWaitingMyTurn =
    myStatus === "PENDING" &&
    overall === "PENDING" &&
    activeIndex >= 0 &&
    myIndex > activeIndex;

  const canApproveOrReject =
    myStatus === "PENDING" && overall === "PENDING" && isMyTurn && !isProcessed;

  const overallMeta = STATUS_META[overall] || STATUS_META.PENDING;
  const overallPillStyle = getTonePillStyle(overallMeta.tone, borderColor);
  const overallIconChip = getIconChipStyle(
    getOverallIconChipKind(application.overallStatus),
    borderColor,
  );

  const isOrganicApp =
    application.employeeType === "Organic" ||
    application.category === "Organic" ||
    application.employee?.employeeType === "Organic";

  const durationLabel = plural(application.totalDays ?? 0, "Day");

  return (
    <div
      className="flex-1 h-full rounded-xl shadow-md w-full flex flex-col min-w-0 border overflow-hidden"
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--app-text)",
        borderColor: borderColor,
      }}
    >
      {/* HEADER */}
      <header
        className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b backdrop-blur px-3 py-3 z-10"
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
            {initials || "?"}
          </div>

          <div className="min-w-0">
            <h2
              className="text-lg font-bold leading-tight truncate"
              style={{ color: "var(--app-text)" }}
            >
              {application.employee?.firstName} {application.employee?.lastName}
            </h2>

            <div
              className="flex flex-wrap items-center gap-2 text-xs font-medium mt-1"
              style={{ color: "var(--app-muted)" }}
            >
              <span
                className="px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent)",
                  borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
                }}
              >
                ID: {application.employee?.employeeId || "N/A"}
              </span>

              <span
                className="px-1.5 py-0.5 rounded border uppercase"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  color: "var(--app-text)",
                  borderColor: "var(--app-border)",
                }}
              >
                {application.employeeType || "Organic"}
              </span>

              <span className="flex items-center gap-1">
                <Clock size={12} />
                {new Date(application.createdAt).toLocaleDateString()}
              </span>

              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold"
                style={overallPillStyle}
                title="Overall Status"
              >
                {overall === "CANCELLED" ? <Ban size={12} /> : null}
                {application.overallStatus}
              </span>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
          {canApproveOrReject ? (
            canManageApplication &&
            (isProfileLoading ? (
              <span
                className="text-sm font-medium px-4 py-2"
                style={{ color: "var(--app-muted)" }}
              >
                Checking status...
              </span>
            ) : !hasSignature ? (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border"
                style={{
                  backgroundColor: "rgba(239,68,68,0.1)",
                  borderColor: "rgba(239,68,68,0.2)",
                  color: "#ef4444",
                }}
              >
                <AlertCircle size={14} /> Signature Required
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setModalType("reject");
                    setIsModalOpen(true);
                  }}
                  disabled={isMutating}
                  className="flex-1 md:flex-none px-4 py-2 rounded-lg font-semibold transition hover:brightness-95 disabled:opacity-60"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    color: "var(--app-text)",
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  Reject
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalType("approve");
                    setIsModalOpen(true);
                  }}
                  disabled={isMutating}
                  className="flex-1 md:flex-none rounded-lg px-4 py-2 transition shadow-sm font-medium flex items-center justify-center gap-2 hover:brightness-95 disabled:opacity-80"
                  style={{
                    backgroundColor: "var(--accent)",
                    border: "1px solid var(--accent)",
                    color: "#fff",
                  }}
                >
                  {approveMutation.isPending
                    ? "Processing..."
                    : "Approve Leave"}
                </button>
              </>
            ))
          ) : isWaitingMyTurn ? (
            <div
              className="px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold border w-full md:w-auto"
              style={{
                backgroundColor: "var(--app-surface-2)",
                color: "var(--app-muted)",
                borderColor: borderColor,
              }}
              title="You can act once the earlier approver has approved"
            >
              <Hourglass size={16} /> Waiting for Approver {waitingForLevel}
            </div>
          ) : (
            <div
              className="px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold border w-full md:w-auto"
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

      {/* CONTENT */}
      <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar flex flex-col gap-4 px-2 sm:px-3 py-3">
        {/* Missing Signature Banner */}
        {canApproveOrReject && !isProfileLoading && !hasSignature && (
          <div
            className="p-4 border border-l-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
            style={{
              backgroundColor: "rgba(249,115,22,0.08)",
              borderColor: "rgba(249,115,22,0.30)",
              borderLeftColor: "#f97316",
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className="w-5 h-5 shrink-0 mt-0.5"
                style={{ color: "#f97316" }}
              />
              <div>
                <h4
                  className="font-bold text-sm"
                  style={{ color: "var(--app-text)" }}
                >
                  E-Signature Required
                </h4>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--app-muted)" }}
                >
                  You do not currently have a digital signature configured. A
                  signature is required to process leave applications.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/app/my-profile")}
              className="flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow transition-colors"
            >
              <PenTool size={14} /> Upload Signature
            </button>
          </div>
        )}

        {/* QUICK STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
          <div
            className="md:col-span-2 rounded-xl p-4 sm:p-6 text-white flex gap-4 justify-between items-center relative overflow-hidden min-w-0"
            style={{
              background:
                "linear-gradient(135deg, var(--accent) 80%, rgba(255,255,255,0.16) 140%)",
            }}
          >
            <CalendarDays className="absolute right-[-20px] top-[-20px] h-40 w-40 text-white/10 rotate-12" />
            <div className="min-w-0 relative">
              <p className="text-white/90 text-xs font-bold uppercase tracking-widest mb-1">
                Requested Dates
              </p>
              <h3 className="text-xl md:text-2xl font-bold break-words">
                {requestedDatesLabel}
              </h3>
            </div>

            <div className="flex items-center flex-none relative">
              <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl">
                <p className="text-[10px] text-white/90 uppercase font-bold">
                  Total Duration
                </p>
                <p className="text-xl font-bold">{durationLabel}</p>
              </div>
            </div>
          </div>

          <div
            className="border rounded-xl p-4 flex justify-between items-center gap-4 min-w-0"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
            }}
          >
            <div
              className="p-4 rounded-2xl border flex-none"
              style={{
                backgroundColor: overallIconChip.bg,
                borderColor: overallIconChip.br,
                color: overallIconChip.fg,
              }}
            >
              {overall === "CANCELLED" ? (
                <Ban size={28} className="h-6 w-6" />
              ) : (
                <StatusIcon
                  status={application.overallStatus}
                  size={32}
                  className="h-6 w-6"
                />
              )}
            </div>

            <div className="text-end min-w-0">
              <p
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--app-muted)" }}
              >
                Global Status
              </p>
              <p
                className="text-xl font-black break-words mt-0.5"
                style={{ color: "var(--app-text)" }}
              >
                {application.overallStatus}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
          {/* MAIN */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-w-0">
            {/* Purpose */}
            <section
              className="border rounded-xl p-4 sm:p-5 shadow-sm min-w-0"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <SectionTitle
                icon={MessageCircle}
                kind="accent"
                title="Purpose of Leave"
                borderColor={borderColor}
              />

              <p
                className="leading-relaxed italic p-4 rounded-2xl border break-words"
                style={{
                  color: "var(--app-text)",
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                }}
              >
                "
                {application.reason ||
                  "No specific reason provided by the applicant."}
                "
              </p>

              {isOrganicApp && (
                <div className="mt-4 px-1">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Commutation Status
                  </p>
                  <p
                    className="font-semibold text-sm"
                    style={{ color: "var(--app-text)" }}
                  >
                    {application.commutation || "Not Requested"}
                  </p>
                </div>
              )}
            </section>

            {/* Late filing justification */}
            {application.lateFiling?.isLateFiling && (
              <section
                className="border rounded-xl p-4 sm:p-5 shadow-sm min-w-0"
                style={{
                  backgroundColor: "rgba(245,158,11,0.05)",
                  borderColor: "rgba(245,158,11,0.30)",
                }}
              >
                <SectionTitle
                  icon={Clock}
                  kind="amber"
                  title="Late Filing Justification"
                  subtitle="Filed with insufficient lead time notice."
                  titleColor="#d97706"
                  subtitleColor="#b45309"
                  borderColor={borderColor}
                />
                <p
                  className="leading-relaxed italic p-4 rounded-2xl border break-words"
                  style={{
                    color: "var(--app-text)",
                    backgroundColor: "var(--app-surface)",
                    borderColor: borderColor,
                  }}
                >
                  "
                  {application.lateFiling.justification ||
                    "No justification provided."}
                  "
                </p>
              </section>
            )}

            {/* Processing workflow */}
            <section
              className="border rounded-xl p-4 sm:p-5 shadow-sm min-w-0"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <SectionTitle
                icon={History}
                kind="green"
                title="Processing Timeline"
                subtitle="Step-by-step approval progress"
                borderColor={borderColor}
              />

              {sortedApprovals.length > 0 ? (
                <ol className="flex flex-col gap-3">
                  {sortedApprovals.map((approval, idx) => {
                    const stepStatus = upper(approval?.status);
                    const isQueued =
                      overall === "PENDING" &&
                      stepStatus === "PENDING" &&
                      activeIndex >= 0 &&
                      idx > activeIndex;

                    return (
                      <TimelineStep
                        key={approval?._id || idx}
                        approval={approval}
                        index={idx}
                        isLast={
                          idx === sortedApprovals.length - 1 &&
                          overall !== "APPROVED"
                        }
                        isMine={idx === myIndex}
                        isActive={idx === activeIndex}
                        isQueued={isQueued}
                        borderColor={borderColor}
                      />
                    );
                  })}

                  {overall === "APPROVED" && (
                    <li className="relative flex gap-3 sm:gap-4 items-start">
                      <div
                        className="relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 shadow-sm flex-none"
                        style={{
                          backgroundColor: "#10b981",
                          borderColor: "var(--app-surface)",
                        }}
                      >
                        <BadgeCheck size={18} className="text-white" />
                      </div>
                      <div
                        className="flex-1 rounded-xl p-3 sm:p-4 border"
                        style={{
                          backgroundColor: "rgba(34,197,94,0.14)",
                          borderColor: "rgba(34,197,94,0.22)",
                        }}
                      >
                        <p
                          className="font-bold text-sm"
                          style={{ color: "#16a34a" }}
                        >
                          Application Fully Approved
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--app-muted)" }}
                        >
                          The Wellness Leave request has been finalized.
                        </p>
                      </div>
                    </li>
                  )}
                </ol>
              ) : (
                <div
                  className="flex flex-col items-center justify-center p-10 border border-dashed rounded-xl text-center"
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
                  <p
                    style={{ color: "var(--app-muted)" }}
                    className="text-sm mt-0.5"
                  >
                    No approvers have acted on this request yet.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* SIDEBAR */}
          <aside className="flex flex-col gap-4 min-w-0">
            <div
              className="border rounded-xl p-4 shadow-sm min-w-0"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <h4
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--app-muted)" }}
              >
                Documents
              </h4>

              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setIsPdfOpen(true)}
                  className={DOC_BTN}
                  style={{ borderColor, color: "var(--app-text)" }}
                  title="View General PDF"
                >
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-8 w-8 rounded-lg flex items-center justify-center flex-none border"
                      style={{
                        backgroundColor: "rgba(239,68,68,0.12)",
                        color: "#ef4444",
                        borderColor: "rgba(239,68,68,0.20)",
                      }}
                    >
                      <FileText size={16} />
                    </span>
                    <span className="truncate">General Form</span>
                  </span>
                  <span
                    className="text-[9px] font-bold px-2 py-1 rounded-lg flex-none border"
                    style={{
                      color: "var(--app-muted)",
                      borderColor: "var(--app-border)",
                      backgroundColor: "var(--app-surface-2)",
                    }}
                  >
                    PDF
                  </span>
                </button>

                {isOrganicApp && (
                  <button
                    type="button"
                    onClick={() => setIsCsc6PdfOpen(true)}
                    className={DOC_BTN}
                    style={{ borderColor, color: "var(--app-text)" }}
                    title="View CSC Form 6"
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-8 w-8 rounded-lg flex items-center justify-center flex-none border"
                        style={{
                          backgroundColor: "rgba(59,130,246,0.12)",
                          color: "#3b82f6",
                          borderColor: "rgba(59,130,246,0.20)",
                        }}
                      >
                        <FileBadge size={16} />
                      </span>
                      <span className="truncate">CSC Form 6</span>
                    </span>
                    <span
                      className="text-[9px] font-bold px-2 py-1 rounded-lg flex-none border"
                      style={{
                        color: "var(--app-muted)",
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-surface-2)",
                      }}
                    >
                      PDF
                    </span>
                  </button>
                )}

                {application.lateFiling?.isLateFiling &&
                  application.lateFiling?.attachment?.fileUrl && (
                    <a
                      href={buildApiUrl(
                        application.lateFiling.attachment.fileUrl,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                      style={{
                        borderColor: "rgba(245,158,11,0.3)",
                        backgroundColor: "rgba(245,158,11,0.05)",
                        color: "var(--app-text)",
                      }}
                      title="View Late Filing Attachment"
                    >
                      <span className="inline-flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-8 w-8 rounded-lg flex items-center justify-center flex-none border"
                          style={{
                            backgroundColor: "rgba(245,158,11,0.15)",
                            color: "#d97706",
                            borderColor: "rgba(245,158,11,0.25)",
                          }}
                        >
                          <Paperclip size={16} />
                        </span>
                        <span className="truncate">Late Filing Doc</span>
                      </span>
                      <span
                        className="text-[9px] font-bold px-2 py-1 rounded-lg flex-none border"
                        style={{
                          color: "#d97706",
                          borderColor: "rgba(245,158,11,0.3)",
                          backgroundColor: "rgba(245,158,11,0.1)",
                        }}
                      >
                        PDF
                      </span>
                    </a>
                  )}
              </div>
            </div>

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
          <div className="p-2 transition-colors duration-300 ease-out">
            <div
              className="mb-6 flex items-start gap-3 p-3 rounded-xl border transition-colors duration-300 ease-out"
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
                  Reviewing Request For
                </p>
                <p
                  className="text-sm font-bold break-words"
                  style={{ color: "var(--app-text)" }}
                >
                  {application.employee?.firstName}{" "}
                  {application.employee?.lastName}
                </p>
              </div>
            </div>

            {modalType === "approve" ? (
              <div className="text-center py-4 max-w-sm mx-auto">
                <div
                  className="mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-4 border-4 shadow-inner"
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    color: "#10b981",
                    borderColor: "rgba(16, 185, 129, 0.2)",
                  }}
                >
                  <Check size={40} strokeWidth={3} />
                </div>
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--app-text)" }}
                >
                  Are you sure you want to approve this Wellness Leave?
                </h2>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  className="flex items-center gap-2"
                  style={{ color: "#ef4444" }}
                >
                  <AlertCircle size={18} />
                  <h3 className="font-bold text-sm">Reason for Rejection</h3>
                </div>

                <div className="relative">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Please explain why this request is being declined..."
                    className="w-full p-4 pb-8 border-2 rounded-2xl outline-none min-h-[140px] text-sm transition-all duration-300 ease-out"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      color: "var(--app-text)",
                      borderColor: remarks.trim()
                        ? borderColor
                        : "rgba(239, 68, 68, 0.4)",
                    }}
                  />
                  <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={{
                        color: remarks.trim() ? "var(--app-muted)" : "#ef4444",
                      }}
                    >
                      {remarks.length > 0
                        ? `${remarks.length} chars`
                        : "Required"}
                    </span>
                  </div>
                </div>

                <p
                  className="text-[11px] p-2.5 rounded-lg border italic"
                  style={{
                    color: "var(--app-muted)",
                    backgroundColor: "var(--app-surface-2)",
                    borderColor: borderColor,
                  }}
                >
                  Tip: Providing a clear reason helps employees correct future
                  applications.
                </p>
              </div>
            )}
          </div>
        </Modal>
      </div>

      {/* General Form PDF Modal */}
      <WellnessApplicationPdfModal
        app={application}
        isOpen={isPdfOpen}
        onClose={() => setIsPdfOpen(false)}
      />

      {/* CSC Form 6 PDF Modal */}
      <OrganicWellnessApplicationPdfModal
        app={application}
        isOpen={isCsc6PdfOpen}
        onClose={() => setIsCsc6PdfOpen(false)}
      />
    </div>
  );
};

export default WellnessApplicationDetails;
