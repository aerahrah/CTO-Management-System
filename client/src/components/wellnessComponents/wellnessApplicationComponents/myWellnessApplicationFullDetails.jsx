// wellnessApplicationDetails.jsx (employee view)
import React, { useState, useMemo, useEffect } from "react";
import {
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Ban,
  Users,
  FileText,
  History,
  Undo,
  RotateCcw,
  Clock4,
  Download,
  Paperclip,
  FileX,
  Hourglass,
  BadgeCheck,
} from "lucide-react";
import { StatusBadge } from "../../statusUtils";
import { useAuth } from "../../../store/authStore";
import { buildApiUrl } from "../../../config/env";

function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* Reactive resolved theme for system mode */
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

const upper = (v) => String(v || "").toUpperCase();
const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;

/* ------------------ Helper: Date Leaf (theme-aware) ------------------ */
const DateLeaf = ({ dateString, borderColor }) => {
  const date = new Date(dateString);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.toLocaleDateString("en-US", { day: "numeric" });

  return (
    <div
      className="flex items-center gap-3 rounded-lg p-2 shadow-sm border transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      <div
        className="rounded md:w-10 md:h-10 w-8 h-8 flex flex-col items-center justify-center shrink-0 border transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor: borderColor,
        }}
      >
        <span
          className="text-[8px] font-bold uppercase leading-none"
          style={{ color: "var(--app-muted)" }}
        >
          {month}
        </span>
        <span
          className="text-sm font-bold leading-none"
          style={{ color: "var(--app-text)" }}
        >
          {day}
        </span>
      </div>

      <div className="flex flex-col min-w-0">
        <span
          className="text-xs font-medium truncate"
          style={{ color: "var(--app-muted)" }}
        >
          {date.toLocaleDateString("en-US", { weekday: "long" })}
        </span>
        <span className="text-[10px]" style={{ color: "var(--app-muted)" }}>
          {date.getFullYear()}
        </span>
      </div>
    </div>
  );
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
  isActive, // pending and it's this approver's turn
  isQueued, // pending but the approver before hasn't acted yet
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

      {/* Each queued step waits for the approver right before it */}
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
   Main Component
========================= */
const WellnessApplicationDetails = ({ app }) => {
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  // Hooks must run before any early return
  const sortedApprovals = useMemo(() => {
    if (!Array.isArray(app?.approvals)) return [];
    return [...app.approvals].sort((a, b) => (a.level || 0) - (b.level || 0));
  }, [app?.approvals]);

  if (!app) return null;

  // Status check variables
  const status = upper(app?.overallStatus);
  const isFullyApproved =
    status === "APPROVED" ||
    status === "REVOCATION_REQUESTED" ||
    status === "REVOKED";
  const isRevoked = status === "REVOKED";

  // Late Filing Data
  const isLateFiling = app.lateFiling?.isLateFiling === true;
  const lateJustification = app.lateFiling?.justification;
  const lateAttachment = app.lateFiling?.attachment;

  // Revocation specific data
  const revocationReq = app.revocationRequest || {};
  const hasActiveRevocationReq =
    !!revocationReq.requestedAt ||
    status === "REVOCATION_REQUESTED" ||
    isRevoked;
  const hasRevocationAttachment = !!revocationReq.attachment?.fileUrl;

  // History of past (rejected or cancelled) revocations
  const revocationHistory = Array.isArray(app.revocationHistory)
    ? app.revocationHistory
    : [];
  const hasRevocationHistory = revocationHistory.length > 0;
  const hasRevocationContext = hasActiveRevocationReq || hasRevocationHistory;

  // Workflow position: the step whose turn it is = first PENDING step
  const activeIndex =
    status === "PENDING"
      ? sortedApprovals.findIndex((s) => upper(s?.status) === "PENDING")
      : -1;

  // Anything drawn after the approver steps?
  const hasNodesAfterApprovals =
    isFullyApproved || hasRevocationHistory || hasActiveRevocationReq;

  const handleDownloadAttachment = (attachmentObj) => {
    if (!attachmentObj?.fileUrl) return;
    const url = attachmentObj.fileUrl.replace(/\\/g, "/");
    const fullUrl = url.startsWith("http") ? url : buildApiUrl(url);
    window.open(fullUrl, "_blank");
  };

  return (
    <div
      className="h-full flex flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="max-h-[75vh] overflow-y-auto cto-scrollbar p-2 md:p-6">
        {/* 1. Top Header: High-Level Stats */}
        <div
          className="rounded-xl p-5 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor: borderColor,
          }}
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--app-muted)" }}
              >
                Current Status
              </p>
              {isLateFiling && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Clock4 size={10} /> Late Filed
                </span>
              )}
            </div>
            <StatusBadge
              status={app.overallStatus}
              className="text-lg px-4 py-1.5"
              showIcon
            />
          </div>

          <div className="flex gap-4 md:gap-6 flex-wrap">
            <div
              className="pr-4 md:px-4 text-left md:text-center"
              style={{ borderRight: `1px solid ${borderColor}` }}
            >
              <p
                className="text-[10px] font-bold uppercase"
                style={{ color: "var(--app-muted)" }}
              >
                {isRevoked ? "Revoked Days" : "Total Leave"}
              </p>
              <p
                className="text-xl font-extrabold"
                style={{ color: "var(--app-text)" }}
              >
                {app.totalDays ?? 0}{" "}
                <span
                  className="text-xs font-normal"
                  style={{ color: "var(--app-muted)" }}
                >
                  {Number(app.totalDays) === 1 ? "Day" : "Days"}
                </span>
              </p>
            </div>

            <div
              className="pr-4 md:px-4 text-left md:text-center"
              style={{
                borderRight: hasActiveRevocationReq
                  ? `1px solid ${borderColor}`
                  : "none",
              }}
            >
              <p
                className="text-[10px] font-bold uppercase"
                style={{ color: "var(--app-muted)" }}
              >
                {hasRevocationContext ? "Original Date Filed" : "Date Filed"}
              </p>
              <p
                className="text-sm font-bold mt-1"
                style={{ color: "var(--app-text)" }}
              >
                {new Date(app.createdAt).toLocaleDateString()}
              </p>
            </div>

            {hasActiveRevocationReq && (
              <div className="text-left md:text-center">
                <p
                  className="text-[10px] font-bold uppercase"
                  style={{ color: "var(--accent)" }}
                >
                  Revocation Requested
                </p>
                <p
                  className="text-sm font-bold mt-1"
                  style={{ color: "var(--app-text)" }}
                >
                  {revocationReq.requestedAt
                    ? new Date(revocationReq.requestedAt).toLocaleDateString()
                    : "-"}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-1 space-y-4">
            {/* Revocation Reason Card (Highlighted) */}
            {hasActiveRevocationReq && (
              <div
                className="rounded-xl p-5 shadow-sm border transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "rgba(147, 51, 234, 0.04)",
                  borderColor: "rgba(147, 51, 234, 0.2)",
                }}
              >
                <h4
                  className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
                  style={{ color: "#9333ea" }}
                >
                  <Undo size={14} /> Revocation Reason
                </h4>
                <p
                  className="text-sm leading-relaxed font-semibold break-words"
                  style={{ color: "var(--app-text)" }}
                >
                  {revocationReq.reason || (
                    <span className="italic opacity-70">
                      No specific reason provided.
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Late Filing Justification Card */}
            {isLateFiling && (
              <div
                className="rounded-xl p-5 shadow-sm border transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "rgba(245,158,11,0.05)",
                  borderColor: "rgba(245,158,11,0.30)",
                }}
              >
                <h4
                  className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
                  style={{ color: "#d97706" }}
                >
                  <Clock4 size={14} /> Late Filing Justification
                </h4>
                <p
                  className="text-sm leading-relaxed font-medium break-words"
                  style={{ color: "var(--app-text)" }}
                >
                  {lateJustification || (
                    <span className="italic opacity-70">
                      No justification provided.
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Original Purpose Card */}
            <div
              className="rounded-xl p-5 shadow-sm border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <h4
                className={`font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${
                  hasRevocationContext || isLateFiling
                    ? "text-[10px]"
                    : "text-xs"
                }`}
                style={{ color: "var(--app-muted)" }}
              >
                <FileText
                  size={hasRevocationContext || isLateFiling ? 12 : 14}
                  style={{ color: "var(--app-muted)" }}
                />{" "}
                {hasRevocationContext || isLateFiling
                  ? "Original Purpose"
                  : "Purpose"}
              </h4>

              <p
                className={`text-sm leading-relaxed break-words ${
                  hasRevocationContext || isLateFiling
                    ? "font-medium opacity-80"
                    : "font-medium"
                }`}
                style={{ color: "var(--app-text)" }}
              >
                {app.reason || (
                  <span
                    className="italic"
                    style={{ color: "var(--app-muted)" }}
                  >
                    No reason provided.
                  </span>
                )}
              </p>
            </div>

            {/* Selected Dates */}
            <div
              className="rounded-xl p-5 shadow-sm border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <h4
                className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
                style={{ color: "var(--app-muted)" }}
              >
                <CalendarDays size={14} style={{ color: "var(--app-muted)" }} />{" "}
                {hasRevocationContext ? "Dates to Restore" : "Dates Included"}
              </h4>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 cto-scrollbar">
                {app.inclusiveDates?.length > 0 ? (
                  app.inclusiveDates.map((d, i) => (
                    <DateLeaf
                      key={i}
                      dateString={d}
                      borderColor={borderColor}
                    />
                  ))
                ) : (
                  <div
                    className="text-center py-4 text-sm border border-dashed rounded-lg"
                    style={{
                      color: "var(--app-muted)",
                      borderColor: borderColor,
                      backgroundColor: "var(--app-surface-2)",
                    }}
                  >
                    No dates selected
                  </div>
                )}
              </div>
            </div>

            {/* Unified Documents Section */}
            {(hasActiveRevocationReq ||
              (isLateFiling && lateAttachment?.fileUrl)) && (
              <div className="space-y-2">
                <h4
                  className="text-[10px] font-bold uppercase tracking-widest px-1 flex items-center gap-2 mt-4"
                  style={{ color: "var(--app-muted)" }}
                >
                  <Paperclip size={12} /> Attachments
                </h4>

                {/* 1. Revocation Attachment */}
                {hasActiveRevocationReq && (
                  <div
                    className="rounded-xl p-1 shadow-sm border transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      borderColor: borderColor,
                    }}
                  >
                    <button
                      onClick={() =>
                        handleDownloadAttachment(revocationReq.attachment)
                      }
                      disabled={!hasRevocationAttachment}
                      className="w-full flex items-center justify-between p-3 rounded-lg transition-colors duration-200 ease-out"
                      type="button"
                      style={{
                        backgroundColor: "transparent",
                        opacity: hasRevocationAttachment ? 1 : 0.6,
                        cursor: hasRevocationAttachment
                          ? "pointer"
                          : "not-allowed",
                      }}
                      onMouseEnter={(e) => {
                        if (!hasRevocationAttachment) return;
                        e.currentTarget.style.backgroundColor =
                          "var(--app-surface-2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="p-2 rounded-lg border flex-none"
                          style={{
                            backgroundColor: hasRevocationAttachment
                              ? "rgba(147, 51, 234, 0.1)"
                              : "var(--app-surface-2)",
                            borderColor: hasRevocationAttachment
                              ? "rgba(147, 51, 234, 0.2)"
                              : borderColor,
                            color: hasRevocationAttachment
                              ? "#9333ea"
                              : "var(--app-muted)",
                          }}
                        >
                          {hasRevocationAttachment ? (
                            <FileText size={16} />
                          ) : (
                            <FileX size={16} />
                          )}
                        </div>

                        <div className="text-left min-w-0 pr-2">
                          <span
                            className="block text-xs font-bold truncate"
                            style={{ color: "var(--app-text)" }}
                          >
                            {hasRevocationAttachment
                              ? revocationReq.attachment.fileName
                              : "No Revocation Document"}
                          </span>
                          <span
                            className="text-[10px] truncate"
                            style={{ color: "var(--app-muted)" }}
                          >
                            {hasRevocationAttachment
                              ? "Revocation Support File"
                              : "Required by HR"}
                          </span>
                        </div>
                      </div>
                      {hasRevocationAttachment && (
                        <Download
                          size={14}
                          style={{ color: "var(--app-muted)" }}
                        />
                      )}
                    </button>
                  </div>
                )}

                {/* 2. Late Filing Attachment */}
                {isLateFiling && lateAttachment?.fileUrl && (
                  <div
                    className="rounded-xl p-1 shadow-sm border transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      borderColor: borderColor,
                    }}
                  >
                    <button
                      onClick={() => handleDownloadAttachment(lateAttachment)}
                      className="w-full flex items-center justify-between p-3 rounded-lg transition-colors duration-200 ease-out"
                      type="button"
                      style={{ backgroundColor: "transparent" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--app-surface-2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="p-2 rounded-lg border flex-none"
                          style={{
                            backgroundColor: "rgba(245,158,11,0.1)",
                            borderColor: "rgba(245,158,11,0.2)",
                            color: "#d97706",
                          }}
                        >
                          <Clock4 size={16} />
                        </div>
                        <div className="text-left min-w-0 pr-2">
                          <span
                            className="block text-xs font-bold truncate"
                            style={{ color: "var(--app-text)" }}
                          >
                            {lateAttachment.fileName || "Late Filing Doc"}
                          </span>
                          <span
                            className="text-[10px] truncate"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Late Filing Support File
                          </span>
                        </div>
                      </div>
                      <Download
                        size={14}
                        style={{ color: "var(--app-muted)" }}
                      />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Timeline */}
          <div className="lg:col-span-2">
            <div
              className="rounded-xl p-4 sm:p-5 shadow-sm border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: hasRevocationContext
                      ? "var(--app-surface-2)"
                      : "rgba(34,197,94,0.14)",
                    borderColor: hasRevocationContext
                      ? borderColor
                      : "rgba(34,197,94,0.22)",
                    color: hasRevocationContext
                      ? "var(--app-muted)"
                      : "#16a34a",
                  }}
                >
                  <History size={18} />
                </div>

                <div className="min-w-0">
                  <h3
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Processing Timeline
                  </h3>
                  <p
                    className="text-xs font-medium mt-0.5"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {hasRevocationContext
                      ? "Original workflow & revocation history"
                      : "Step-by-step approval progress"}
                  </p>
                </div>
              </div>

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

                  {/* 2. FULLY APPROVED (reached full approval at least once) */}
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
                        The original Wellness Leave request was finalized.
                      </p>
                    </TimelineNode>
                  )}

                  {/* 3. PAST REVOCATION ATTEMPTS (rejected or withdrawn) */}
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
                              <button
                                type="button"
                                onClick={() =>
                                  handleDownloadAttachment(hist.attachment)
                                }
                                className="mt-2 text-xs flex items-center gap-1 font-medium transition-colors hover:underline"
                                style={{ color: "var(--accent)" }}
                              >
                                <Download size={12} /> View Attachment
                              </button>
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

                      {isRevoked && app.revokeReason && (
                        <Note label="HR Note:" borderColor={borderColor}>
                          {app.revokeReason}
                        </Note>
                      )}

                      {app.revokedAt && (
                        <Stamp>
                          Processed on{" "}
                          {new Date(app.revokedAt).toLocaleString()}
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
                    borderColor: borderColor,
                  }}
                >
                  <Users
                    size={32}
                    style={{ color: "var(--app-muted)", opacity: 0.6 }}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WellnessApplicationDetails;
