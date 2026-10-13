// revocationDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Clock,
  FileText,
  BadgeCheck,
  CalendarDays,
  ExternalLink,
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
  Undo,
  Paperclip,
  ShieldX,
  ShieldAlert,
  Download,
  Hourglass,
} from "lucide-react";
import { StatusIcon, StatusBadge } from "../statusUtils";
import { useAuth } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Modal from "../modal";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import MemoList from "../ctoComponents/ctoMemoModal";
import { buildApiUrl } from "../../config/env";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { getMyProfile } from "../../api/employee";

import {
  fetchCtoApplicationById,
  processRevocationRequest as processCtoRevocation,
} from "../../api/cto";
import {
  fetchWellnessApplicationById,
  processRevocationWellnessRequest as processWellnessRevocation,
} from "../../api/wellnessApplication";

import { fetchRevocationSettings } from "../../api/revocationApprover";

import CtoApplicationPdfModal from "../ctoComponents/ctoApplicationComponents/ctoApplicationPDFModal";
import OrganicApplicationPdfModal from "../ctoComponents/ctoApplicationComponents/organicApplicationPDFModal";

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
    purple: {
      bg: "rgba(168,85,247,0.16)",
      fg: "#9333ea",
      br: "rgba(168,85,247,0.26)",
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
  if (s === "REVOCATION_REQUESTED") return "purple";
  if (s === "REVOKED") return "slate";
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
              style={{ color: "var(--app-muted)" }}
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
const RevocationDetailsSkeleton = ({ borderColor, resolvedTheme }) => {
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
      aria-label="Loading revocation details"
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
                <Skeleton height={18} width={70} borderRadius={999} />
                <Skeleton height={18} width={110} borderRadius={999} />
                <Skeleton height={18} width={90} borderRadius={999} />
                <Skeleton height={18} width={130} borderRadius={999} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            <Skeleton height={40} width={150} borderRadius={10} />
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
                  <Skeleton height={12} width={200} borderRadius={8} />
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
                      <Skeleton height={10} width={200} borderRadius={8} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
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
  REVOCATION_REQUESTED: { label: "REVOKE REQ.", tone: "purple" },
  REVOKED: { label: "REVOKED", tone: "slate" },
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
   Timeline building blocks
========================= */
const AMBER = {
  bg: "rgba(245,158,11,0.16)",
  fg: "#d97706",
  br: "rgba(245,158,11,0.26)",
};

// One row of the timeline: dot + connector + card
const TimelineNode = ({
  isLast,
  dotBg,
  dotFg = "#fff",
  icon: Icon,
  title,
  cardStyle,
  children,
}) => (
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
      title={title}
    >
      <Icon size={16} />
    </div>

    <div
      className="flex-1 min-w-0 rounded-xl border p-3 sm:p-4"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: "var(--app-border)",
        ...cardStyle,
      }}
    >
      {children}
    </div>
  </li>
);

const StepHeader = ({
  label,
  labelColor,
  tags,
  title,
  subtitle,
  subtitleColor,
  right,
}) => (
  <div className="flex items-start justify-between gap-3 min-w-0">
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: labelColor || "var(--app-muted)" }}
        >
          {label}
        </span>
        {tags}
      </div>
      <p
        className="text-sm font-semibold break-words mt-1"
        style={{ color: "var(--app-text)" }}
      >
        {title}
      </p>
      {subtitle ? (
        <p
          className="text-xs font-medium mt-0.5 break-words"
          style={{ color: subtitleColor || "var(--app-muted)" }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
    {right ? <div className="flex-none">{right}</div> : null}
  </div>
);

const AwaitingTag = () => (
  <span
    className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
    style={{
      backgroundColor: AMBER.bg,
      color: AMBER.fg,
      borderColor: AMBER.br,
    }}
  >
    Awaiting action
  </span>
);

const UpcomingBadge = ({ borderColor }) => (
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
);

const Stamp = ({ children }) => (
  <p className="mt-2 text-[11px]" style={{ color: "var(--app-muted)" }}>
    {children}
  </p>
);

const Note = ({
  variant = "neutral",
  label = "Note:",
  borderColor,
  children,
}) => {
  const styles = {
    red: {
      bg: "rgba(239,68,68,0.10)",
      br: "rgba(239,68,68,0.20)",
      fg: "#ef4444",
    },
    slate: {
      bg: "rgba(148,163,184,0.14)",
      br: "rgba(148,163,184,0.24)",
      fg: "var(--app-text)",
    },
    neutral: {
      bg: "var(--app-surface-2)",
      br: borderColor || "var(--app-border)",
      fg: "var(--app-text)",
    },
  }[variant];

  return (
    <div
      className="mt-3 rounded-lg p-2.5 text-xs leading-relaxed border flex items-start gap-2"
      style={{
        backgroundColor: styles.bg,
        borderColor: styles.br,
        color: styles.fg,
      }}
    >
      <AlertCircle size={14} className="shrink-0 mt-0.5" />
      <p className="break-words whitespace-pre-wrap">
        <strong>{label}</strong> {children}
      </p>
    </div>
  );
};

/* =========================
   Approver step
========================= */
const STEP_DOT = {
  APPROVED: { bg: "#10b981", icon: CheckCircle2 },
  REJECTED: { bg: "#ef4444", icon: XCircle },
  CANCELLED: { bg: "#94a3b8", icon: Ban },
  REVOCATION_REQUESTED: { bg: "#9333ea", icon: Undo },
  REVOKED: { bg: "#64748b", icon: RotateCcw },
};

const TimelineStep = ({
  approval,
  index,
  isLast,
  isActive,
  isQueued,
  borderColor,
}) => {
  const status = upper(approval?.status);
  const isRejected = status === "REJECTED";
  const isCancelled = status === "CANCELLED";

  const dot = STEP_DOT[status];
  const Icon = dot?.icon || (isActive ? Hourglass : Users);
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
  const signedAt =
    snap.signedAt ||
    approval?.approverSignature?.signedAt ||
    approval?.reviewedAt;
  const remarks = String(approval?.remarks || "").trim();

  return (
    <TimelineNode
      isLast={isLast}
      dotBg={dotBg}
      dotFg={dotFg}
      icon={Icon}
      title={isQueued ? "UPCOMING" : status}
      cardStyle={{
        borderColor: isActive ? "rgba(245,158,11,0.45)" : borderColor,
        borderStyle: isQueued ? "dashed" : "solid",
        opacity: isQueued ? 0.85 : 1,
      }}
    >
      <StepHeader
        label={`Approver ${index + 1}`}
        tags={isActive ? <AwaitingTag /> : null}
        title={name}
        subtitle={position}
        subtitleColor="var(--accent)"
        right={
          isQueued ? (
            <UpcomingBadge borderColor={borderColor} />
          ) : (
            <StatusBadge status={status} size="sm" />
          )
        }
      />

      {isQueued && index > 0 ? (
        <Stamp>Waits for Approver {index} to act first</Stamp>
      ) : null}

      {signedAt && status !== "PENDING" ? (
        <Stamp>Signed on {new Date(signedAt).toLocaleString()}</Stamp>
      ) : null}

      {isCancelled && !remarks ? (
        <div
          className="mt-3 rounded-lg text-xs flex items-start gap-2 border p-2.5"
          style={{
            backgroundColor: "rgba(148,163,184,0.14)",
            borderColor: "rgba(148,163,184,0.24)",
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
        <Note
          variant={isRejected ? "red" : isCancelled ? "slate" : "neutral"}
          borderColor={borderColor}
        >
          {remarks}
        </Note>
      ) : null}
    </TimelineNode>
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
            Dates to be restored highlighted
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
   Access screens
========================= */
const AccessScreen = ({
  icon: Icon,
  iconClass,
  title,
  message,
  borderColor,
  onBack,
}) => (
  <div
    className="flex flex-col h-full min-h-0 items-center justify-center p-6 text-center rounded-xl shadow-sm border transition-colors duration-300 ease-out m-2 sm:m-3"
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: borderColor,
      color: "var(--app-text)",
    }}
  >
    <Icon className={`w-14 h-14 mb-4 opacity-90 ${iconClass}`} />
    <h2 className="text-xl font-bold mb-2">{title}</h2>
    <p className="text-sm max-w-sm" style={{ color: "var(--app-muted)" }}>
      {message}
    </p>
    <button
      type="button"
      onClick={onBack}
      className="mt-6 px-4 py-2 rounded-lg text-sm font-bold border transition hover:brightness-95"
      style={{
        backgroundColor: "var(--app-surface-2)",
        borderColor: borderColor,
        color: "var(--app-text)",
      }}
    >
      Go Back
    </button>
  </div>
);

/* =========================
   REVOCATION DETAILS (UNIFIED)
========================= */
const RevocationDetails = () => {
  const { admin } = useAuth();
  const { can } = usePermissions();
  const canManageApplication = can("revocation.manage_application");

  const { id } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  // Application type comes from the URL (?type=CTO or ?type=WELLNESS)
  const searchParams = new URLSearchParams(location.search);
  const appType = searchParams.get("type");
  const isCtoRoute = appType === "CTO";

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const [isProcessed, setIsProcessed] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [isOrganicPdfOpen, setIsOrganicPdfOpen] = useState(false);

  const currentUserId = admin?.id || admin?._id;

  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ["myProfile"],
    queryFn: getMyProfile,
    staleTime: 1000 * 60 * 5,
  });

  const hasSignature = Boolean(profileData?.signature || admin?.signature);

  // Global revocation settings (is the workflow enabled?)
  const { data: settingsData, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["revocationSettings"],
    queryFn: fetchRevocationSettings,
    staleTime: 1000 * 60 * 5,
  });

  const isRevocationEnabled = settingsData?.isEnabled ?? true;

  const appQueryRoot = isCtoRoute ? "ctoApplication" : "wellnessApplication";

  // Application data (only if authorized and enabled)
  const {
    data: application,
    isPending,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: [appQueryRoot, currentUserId, id],
    queryFn: () =>
      isCtoRoute
        ? fetchCtoApplicationById(id)
        : fetchWellnessApplicationById(id),
    enabled:
      !!currentUserId && !!id && canManageApplication && isRevocationEnabled,
  });

  // Revocation tracking
  const status = upper(application?.overallStatus);
  const isFullyApproved =
    status === "APPROVED" ||
    status === "REVOCATION_REQUESTED" ||
    status === "REVOKED";
  const isRevoked = status === "REVOKED";

  const revocationReq = application?.revocationRequest || {};
  const hasActiveRevocationReq =
    !!revocationReq.requestedAt ||
    status === "REVOCATION_REQUESTED" ||
    isRevoked;

  const revocationHistory = Array.isArray(application?.revocationHistory)
    ? application.revocationHistory
    : [];
  const hasRevocationHistory = revocationHistory.length > 0;
  const hasRevocationContext = hasActiveRevocationReq || hasRevocationHistory;

  const isOrganicApp =
    application?.employeeType === "Organic" ||
    application?.category === "Organic" ||
    !isCtoRoute; // Wellness follows the organic flow by default

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

  const invalidateRevocationQueries = () => {
    queryClient.invalidateQueries({ queryKey: [appQueryRoot] });
    queryClient.invalidateQueries({ queryKey: ["ctoRevocationRequestsList"] });
    queryClient.invalidateQueries({
      queryKey: ["wellnessRevocationRequestsList"],
    });
  };

  const approveRevocationMutation = useMutation({
    mutationFn: (applicationId) =>
      isCtoRoute
        ? processCtoRevocation(applicationId, { action: "APPROVE", remarks })
        : processWellnessRevocation(applicationId, {
            action: "APPROVE",
            remarks,
          }),
    onSuccess: () => {
      setIsProcessed(true);
      setIsModalOpen(false);
      toast.success("Revocation approved successfully. Credits restored.");
      invalidateRevocationQueries();
    },
    onError: (err) =>
      toast.error(err.message || "Failed to approve revocation."),
  });

  const rejectRevocationMutation = useMutation({
    mutationFn: (applicationId) =>
      isCtoRoute
        ? processCtoRevocation(applicationId, {
            action: "REJECT",
            remarks: remarks.trim(),
          })
        : processWellnessRevocation(applicationId, {
            action: "REJECT",
            remarks: remarks.trim(),
          }),
    onSuccess: () => {
      setRemarks("");
      setIsProcessed(true);
      setIsModalOpen(false);
      toast.success("Revocation rejected. Leave remains approved.");
      invalidateRevocationQueries();
    },
    onError: (err) =>
      toast.error(err.message || "Failed to reject revocation."),
  });

  const isMutating =
    approveRevocationMutation.isPending || rejectRevocationMutation.isPending;

  const handleAction = () => {
    if (!application || isMutating) return;

    if (modalType === "approve") {
      approveRevocationMutation.mutate(application._id);
    } else {
      if (!remarks.trim()) return toast.error("Please provide a reason.");
      rejectRevocationMutation.mutate(application._id);
    }
  };

  // Reset when switching to a different request
  useEffect(() => {
    setRemarks("");
    setIsPdfOpen(false);
    setIsOrganicPdfOpen(false);
  }, [id]);

  // Fresh server data replaces the local "processed" flag
  useEffect(() => {
    setIsProcessed(false);
  }, [application]);

  /* ================================
     ACCESS CONTROL
  ================================ */
  if (!canManageApplication) {
    return (
      <AccessScreen
        icon={ShieldX}
        iconClass="text-red-500"
        title="Access Denied"
        message="You do not have the required permissions to manage revocation requests."
        borderColor={borderColor}
        onBack={() => navigate("/app/revocations")}
      />
    );
  }

  if (!isSettingsLoading && !isRevocationEnabled) {
    return (
      <AccessScreen
        icon={ShieldAlert}
        iconClass="text-amber-500"
        title="Feature Disabled"
        message="The revocation workflow is currently disabled in the system settings. Actions cannot be performed at this time."
        borderColor={borderColor}
        onBack={() => navigate("/app/revocations")}
      />
    );
  }

  /* ================================
     LOADING / ERROR / EMPTY
  ================================ */
  if (isPending || (isFetching && !application) || isSettingsLoading)
    return (
      <RevocationDetailsSkeleton
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

  if (!application)
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

  /* ================================
     DERIVED VALUES
  ================================ */
  const initials = `${application.employee?.firstName?.[0] || ""}${
    application.employee?.lastName?.[0] || ""
  }`;

  const canApproveOrReject = status === "REVOCATION_REQUESTED" && !isProcessed;

  const overallMeta = STATUS_META[status] || STATUS_META.PENDING;
  const overallPillStyle = getTonePillStyle(overallMeta.tone, borderColor);
  const overallIconChip = getIconChipStyle(
    getOverallIconChipKind(application.overallStatus),
    borderColor,
  );

  const typeColor = isCtoRoute ? "var(--accent)" : "#16a34a";

  const durationLabel = isCtoRoute
    ? plural(application.requestedHours ?? 0, "Hour")
    : plural(application.totalDays ?? 0, "Day");

  // Original workflow: the step whose turn it is (only while PENDING)
  const activeIndex =
    status === "PENDING"
      ? sortedApprovals.findIndex((s) => upper(s?.status) === "PENDING")
      : -1;

  const hasNodesAfterApprovals =
    isFullyApproved || hasRevocationHistory || hasActiveRevocationReq;

  const memos = Array.isArray(application.memo) ? application.memo : [];
  const memoCount = memos.length;

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
            style={{ backgroundColor: typeColor }}
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
                className="px-1.5 py-0.5 rounded border font-bold"
                style={{
                  backgroundColor: isCtoRoute
                    ? "var(--accent-soft)"
                    : "rgba(34,197,94,0.14)",
                  color: typeColor,
                  borderColor: isCtoRoute
                    ? "var(--accent-soft2, rgba(37,99,235,0.18))"
                    : "rgba(34,197,94,0.22)",
                }}
              >
                {isCtoRoute ? "CTO" : "WELLNESS"}
              </span>

              <span
                className="px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  color: "var(--app-muted)",
                  borderColor: borderColor,
                }}
              >
                ID: {application.employee?.employeeId || "N/A"}
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
                {status === "CANCELLED" ? <Ban size={12} /> : null}
                {status === "REVOCATION_REQUESTED"
                  ? "REVOCATION REQUEST"
                  : application.overallStatus}
              </span>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS (HR only) */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
          {canApproveOrReject ? (
            isProfileLoading ? (
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
                  Reject Revocation
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
                  {approveRevocationMutation.isPending
                    ? "Processing..."
                    : "Approve Revocation"}
                </button>
              </>
            )
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
                  signature is required to process leave actions.
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
              background: `linear-gradient(135deg, ${typeColor} 80%, rgba(255,255,255,0.16) 140%)`,
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
              {status === "CANCELLED" ? (
                <Ban size={28} className="h-6 w-6" />
              ) : status === "REVOCATION_REQUESTED" ? (
                <Undo size={28} className="h-6 w-6" />
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
                {status === "REVOCATION_REQUESTED"
                  ? "REVOKE REQ."
                  : application.overallStatus}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
          {/* MAIN */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-w-0">
            {/* Employee revocation request */}
            {hasActiveRevocationReq && (
              <section
                className="border rounded-xl p-4 sm:p-5 shadow-sm min-w-0"
                style={{
                  backgroundColor: "rgba(168,85,247,0.03)",
                  borderColor: "rgba(168,85,247,0.3)",
                }}
              >
                <SectionTitle
                  icon={Undo}
                  kind="purple"
                  title="Employee Revocation Request"
                  titleColor="#9333ea"
                  subtitle={
                    revocationReq.requestedAt
                      ? `Requested on ${new Date(
                          revocationReq.requestedAt,
                        ).toLocaleDateString()}`
                      : null
                  }
                  borderColor={borderColor}
                />

                <p
                  className="leading-relaxed font-medium p-4 rounded-2xl border break-words whitespace-pre-wrap"
                  style={{
                    color: "var(--app-text)",
                    backgroundColor: "var(--app-surface)",
                    borderColor: borderColor,
                  }}
                >
                  {revocationReq.reason || "No reason provided."}
                </p>

                {revocationReq.attachment?.fileUrl && (
                  <a
                    href={buildApiUrl(revocationReq.attachment.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border transition hover:brightness-95"
                    style={{
                      color: "var(--app-text)",
                      borderColor: borderColor,
                      backgroundColor: "var(--app-surface-2)",
                    }}
                  >
                    <Paperclip size={16} style={{ color: "var(--accent)" }} />
                    View Attached Evidence
                    <ExternalLink
                      size={14}
                      style={{ color: "var(--app-muted)" }}
                    />
                  </a>
                )}
              </section>
            )}

            {/* Original purpose */}
            <section
              className="border rounded-xl p-4 sm:p-5 shadow-sm min-w-0"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <SectionTitle
                icon={MessageCircle}
                kind="slate"
                title={
                  hasRevocationContext
                    ? "Original Purpose of Leave"
                    : "Purpose of Leave"
                }
                borderColor={borderColor}
              />

              <p
                className="leading-relaxed italic p-4 rounded-2xl border break-words text-sm"
                style={{
                  color: "var(--app-muted)",
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                }}
              >
                "{application.reason || "No reason provided."}"
              </p>
            </section>

            {/* Processing timeline */}
            <section
              className="border rounded-xl p-4 sm:p-5 shadow-sm min-w-0"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <SectionTitle
                icon={History}
                kind={hasRevocationContext ? "neutral" : "green"}
                title="Processing Timeline"
                subtitle={
                  hasRevocationContext
                    ? "Original workflow & revocation history"
                    : "Step-by-step approval progress"
                }
                borderColor={borderColor}
              />

              {sortedApprovals.length > 0 ? (
                <ol className="flex flex-col gap-3">
                  {/* 1. ORIGINAL APPROVALS */}
                  {sortedApprovals.map((approval, idx) => {
                    const stepStatus = upper(approval?.status);
                    const isQueued =
                      status === "PENDING" &&
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
                          !hasNodesAfterApprovals
                        }
                        isActive={idx === activeIndex}
                        isQueued={isQueued}
                        borderColor={borderColor}
                      />
                    );
                  })}

                  {/* 2. FULLY APPROVED */}
                  {isFullyApproved && (
                    <TimelineNode
                      isLast={!hasRevocationHistory && !hasActiveRevocationReq}
                      dotBg="#10b981"
                      icon={BadgeCheck}
                      title="APPROVED"
                      cardStyle={{
                        backgroundColor: "rgba(34,197,94,0.12)",
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
                        The original request was finalized.
                      </p>
                    </TimelineNode>
                  )}

                  {/* 3. PAST REVOCATION ATTEMPTS */}
                  {hasRevocationHistory &&
                    revocationHistory.map((hist, hIdx) => {
                      const isHistCancelled =
                        upper(hist.status) === "CANCELLED";
                      const isLastHistory =
                        hIdx === revocationHistory.length - 1 &&
                        !hasActiveRevocationReq;

                      return (
                        <React.Fragment key={`hist-${hIdx}`}>
                          {/* Past request */}
                          <TimelineNode
                            isLast={false}
                            dotBg="#94a3b8"
                            icon={Undo}
                            title="PAST REVOCATION REQUEST"
                            cardStyle={{
                              backgroundColor: "var(--app-surface-2)",
                              opacity: 0.85,
                            }}
                          >
                            <StepHeader
                              label={`Past Attempt #${hIdx + 1}`}
                              title="Revocation Requested"
                              subtitle={`Reason: ${hist.reason || "None provided."}`}
                            />

                            {hist.attachment?.fileUrl && (
                              <a
                                href={buildApiUrl(hist.attachment.fileUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
                                style={{ color: "var(--accent)" }}
                              >
                                <Download size={12} /> View Attachment
                              </a>
                            )}

                            {hist.requestedAt && (
                              <Stamp>
                                Requested on{" "}
                                {new Date(hist.requestedAt).toLocaleString()}
                              </Stamp>
                            )}
                          </TimelineNode>

                          {/* Past outcome */}
                          <TimelineNode
                            isLast={isLastHistory}
                            dotBg={isHistCancelled ? "#94a3b8" : "#ef4444"}
                            icon={isHistCancelled ? Ban : XCircle}
                            title={isHistCancelled ? "WITHDRAWN" : "REJECTED"}
                            cardStyle={{
                              backgroundColor: isHistCancelled
                                ? "rgba(148,163,184,0.05)"
                                : "rgba(239,68,68,0.05)",
                              borderColor: isHistCancelled
                                ? "rgba(148,163,184,0.2)"
                                : "rgba(239,68,68,0.2)",
                            }}
                          >
                            <StepHeader
                              label={
                                isHistCancelled
                                  ? "Employee Action"
                                  : "HR Final Step"
                              }
                              labelColor={
                                isHistCancelled ? "#64748b" : "#ef4444"
                              }
                              title={
                                isHistCancelled
                                  ? "Withdrawn by Employee"
                                  : "Rejected by HR"
                              }
                              right={
                                <StatusBadge
                                  status={hist.status || "REJECTED"}
                                  size="sm"
                                />
                              }
                            />

                            {hist.remarks && (
                              <Note
                                label={
                                  isHistCancelled ? "System Note:" : "HR Note:"
                                }
                                borderColor={borderColor}
                              >
                                {hist.remarks}
                              </Note>
                            )}

                            {hist.processedAt && (
                              <Stamp>
                                Processed on{" "}
                                {new Date(hist.processedAt).toLocaleString()}
                              </Stamp>
                            )}
                          </TimelineNode>
                        </React.Fragment>
                      );
                    })}

                  {/* 4. ACTIVE REVOCATION REQUEST */}
                  {hasActiveRevocationReq && (
                    <TimelineNode
                      isLast={false}
                      dotBg="#9333ea"
                      icon={Undo}
                      title="REVOCATION REQUESTED"
                      cardStyle={{
                        backgroundColor: "rgba(147,51,234,0.04)",
                        borderColor: "rgba(147,51,234,0.2)",
                      }}
                    >
                      <StepHeader
                        label="Active Revocation Stage"
                        labelColor="#9333ea"
                        title="Revocation Requested"
                        subtitle="Employee submitted a request to cancel this approved leave."
                        right={
                          <StatusBadge
                            status="REVOCATION_REQUESTED"
                            size="sm"
                          />
                        }
                      />

                      {revocationReq.requestedAt && (
                        <Stamp>
                          Requested on{" "}
                          {new Date(revocationReq.requestedAt).toLocaleString()}
                        </Stamp>
                      )}
                    </TimelineNode>
                  )}

                  {/* 5. HR FINAL STEP */}
                  {hasActiveRevocationReq && (
                    <TimelineNode
                      isLast
                      dotBg={isRevoked ? "#64748b" : "#f59e0b"}
                      icon={isRevoked ? RotateCcw : Hourglass}
                      title={isRevoked ? "REVOKED" : "PENDING"}
                      cardStyle={{
                        backgroundColor: isRevoked
                          ? "rgba(100,116,139,0.08)"
                          : "var(--app-surface)",
                        borderColor: isRevoked
                          ? "rgba(100,116,139,0.2)"
                          : "rgba(245,158,11,0.45)",
                      }}
                    >
                      <StepHeader
                        label="HR Final Step"
                        tags={!isRevoked ? <AwaitingTag /> : null}
                        title={
                          isRevoked ? "Revoked by HR" : "Pending HR Approval"
                        }
                        subtitle={
                          isRevoked
                            ? "HR has processed this request and restored the balances."
                            : "Awaiting Human Resources to review and restore the balances."
                        }
                        right={
                          <StatusBadge
                            status={isRevoked ? "REVOKED" : "PENDING"}
                            size="sm"
                          />
                        }
                      />

                      {isRevoked && application.revokeReason && (
                        <Note label="HR Note:" borderColor={borderColor}>
                          {application.revokeReason}
                        </Note>
                      )}

                      {application.revokedAt && (
                        <Stamp>
                          Processed on{" "}
                          {new Date(application.revokedAt).toLocaleString()}
                        </Stamp>
                      )}
                    </TimelineNode>
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
            <RequestedDatesCalendar dates={application?.inclusiveDates || []} />

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
                {/* General Form (CTO only: the Wellness general form modal isn't wired into this page) */}
                {isCtoRoute && (
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
                )}

                {/* CSC Form 6 */}
                {isOrganicApp && (
                  <button
                    type="button"
                    onClick={() => setIsOrganicPdfOpen(true)}
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
              </div>

              {/* Supporting memos (CTO only) */}
              {isCtoRoute && (
                <>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <h4
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Supporting Memos
                    </h4>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-bold flex-none border"
                      style={{
                        backgroundColor: "var(--app-surface-2)",
                        color: "var(--app-muted)",
                        borderColor: "var(--app-border)",
                      }}
                    >
                      {memoCount}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-1">
                    {memoCount > 0 ? (
                      memos.slice(0, 3).map((m, i) => (
                        <a
                          key={m._id || i}
                          href={buildApiUrl(m.uploadedMemo)}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-[color:var(--app-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] transition min-w-0"
                          title={`Open Memo ${m.memoId?.memoNo}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="h-8 w-8 rounded-lg flex items-center justify-center flex-none border"
                              style={{
                                backgroundColor: "rgba(239,68,68,0.12)",
                                color: "#ef4444",
                                borderColor: "rgba(239,68,68,0.20)",
                              }}
                            >
                              <FileText size={16} />
                            </div>
                            <div className="min-w-0">
                              <p
                                className="text-sm font-semibold truncate"
                                style={{ color: "var(--app-text)" }}
                              >
                                Memo {m.memoId?.memoNo || "—"}
                              </p>
                              <p
                                className="text-[11px] truncate"
                                style={{ color: "var(--app-muted)" }}
                              >
                                Click to open
                              </p>
                            </div>
                          </div>
                          <ExternalLink
                            size={14}
                            className="transition flex-none"
                            style={{ color: "var(--app-muted)" }}
                          />
                        </a>
                      ))
                    ) : (
                      <div
                        className="rounded-xl border border-dashed px-3 py-4 text-center"
                        style={{
                          borderColor: "var(--app-border)",
                          backgroundColor: "var(--app-surface-2)",
                        }}
                      >
                        <p
                          className="text-xs font-medium"
                          style={{ color: "var(--app-muted)" }}
                        >
                          No memos attached
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setMemoModal({ isOpen: true, memos })}
                    disabled={memoCount === 0}
                    className={`mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-bold border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] ${
                      memoCount === 0
                        ? "cursor-not-allowed opacity-60 bg-[color:var(--app-surface-2)]"
                        : "bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)]"
                    }`}
                    style={{
                      color:
                        memoCount === 0
                          ? "var(--app-muted)"
                          : "var(--app-text)",
                      borderColor: borderColor,
                    }}
                  >
                    {memoCount === 0
                      ? "View all memos"
                      : `View all memos (${memoCount})`}
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>

        {/* HR ACTION MODAL */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            modalType === "approve" ? "Approve Revocation" : "Reject Revocation"
          }
          maxWidth="max-w-lg"
          action={{
            show: true,
            label:
              modalType === "approve"
                ? approveRevocationMutation.isPending
                  ? "Processing..."
                  : "Approve & Refund Credits"
                : rejectRevocationMutation.isPending
                  ? "Rejecting..."
                  : "Reject Request",
            variant: modalType === "approve" ? "primary" : "delete",
            onClick: handleAction,
            disabled: isMutating || (modalType === "reject" && !remarks.trim()),
          }}
        >
          <div className="p-2 transition-colors duration-300 ease-out">
            <div
              className="mb-6 flex items-start gap-3 p-3 rounded-xl border"
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
                    backgroundColor: "rgba(168, 85, 247, 0.1)",
                    color: "#9333ea",
                    borderColor: "rgba(168, 85, 247, 0.2)",
                  }}
                >
                  <Undo size={40} strokeWidth={3} />
                </div>
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--app-text)" }}
                >
                  Refund Employee Credits?
                </h2>
                <p
                  className="text-sm mt-2"
                  style={{ color: "var(--app-muted)" }}
                >
                  This action will change the status to REVOKED and restore the
                  employee's {isCtoRoute ? "CTO Hours" : "Wellness Days"}.
                </p>
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
                    placeholder="Why are you denying this revocation request? (e.g., Leave was already taken, missing proof)..."
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
                  Note: Rejecting this will keep the application marked as
                  APPROVED and the credits will remain deducted.
                </p>
              </div>
            )}
          </div>
        </Modal>

        {isCtoRoute && (
          <Modal
            isOpen={memoModal.isOpen}
            onClose={() => setMemoModal({ isOpen: false, memos: [] })}
            title="Attached Memos"
          >
            <MemoList
              memos={memoModal.memos}
              description="Read-only view of CTO memos attached to this request."
            />
          </Modal>
        )}
      </div>

      {isCtoRoute && (
        <CtoApplicationPdfModal
          app={application}
          isOpen={isPdfOpen}
          onClose={() => setIsPdfOpen(false)}
        />
      )}

      {isOrganicApp && (
        <OrganicApplicationPdfModal
          app={application}
          isOpen={isOrganicPdfOpen}
          onClose={() => setIsOrganicPdfOpen(false)}
        />
      )}
    </div>
  );
};

export default RevocationDetails;
