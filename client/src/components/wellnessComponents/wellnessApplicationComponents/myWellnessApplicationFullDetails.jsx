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
  Clock,
  Clock4, // ✅ Imported for Late Filing indicator
  Download,
  Paperclip,
  FileX,
} from "lucide-react";
import { StatusBadge } from "../../statusUtils";
import { useAuth } from "../../../store/authStore";

function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ✅ Reactive resolved theme for system mode (prevents “stuck in light”) */
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
   Timeline helpers (theme-aware)
========================= */
const StepDotIcon = ({ status }) => {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED")
    return <CheckCircle2 size={16} className="text-white" />;
  if (s === "REJECTED") return <XCircle size={16} className="text-white" />;
  if (s === "CANCELLED") return <Ban size={16} className="text-white" />;
  if (s === "REVOCATION_REQUESTED")
    return <Undo size={16} className="text-white" />;
  if (s === "REVOKED") return <RotateCcw size={16} className="text-white" />;
  return <Users size={16} className="text-white" />;
};

const StepDotBg = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "#10b981"; // emerald-500
  if (s === "REJECTED") return "#ef4444"; // red-500
  if (s === "CANCELLED") return "#94a3b8"; // slate-400
  if (s === "REVOCATION_REQUESTED") return "#9333ea"; // purple-600
  if (s === "REVOKED") return "#64748b"; // slate-500
  return "rgba(148,163,184,0.35)"; // soft slate
};

// --- Helper: Timeline Card (theme-aware) ---
const TimelineCard = ({ approval, index, isLast, borderColor }) => {
  const status = String(approval?.status || "").toUpperCase();
  const isDenied = status === "REJECTED";
  const isPending = status === "PENDING";
  const isCancelled = status === "CANCELLED";

  // ✅ Extract Signed At Timestamp
  const signedAt =
    approval.approverSnapshot?.signedAt ||
    approval.approverSignature?.signedAt ||
    approval.reviewedAt;

  return (
    <div className="relative flex gap-2 sm:gap-4 items-start min-w-0">
      {/* Connector Line */}
      {!isLast && (
        <div
          className="absolute left-5 top-10 bottom-0 w-0.5"
          style={{ backgroundColor: "var(--app-border)" }}
        />
      )}

      {/* Status Dot */}
      <div
        className="relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 shadow-md transition-transform hover:scale-110 flex-none"
        title={status}
        style={{
          backgroundColor: StepDotBg(status),
          borderColor: "var(--app-surface)",
        }}
      >
        <StepDotIcon status={status} />
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-2xl p-4 sm:p-5 shadow-xs min-w-0 transition-all border"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: isPending ? "var(--app-border)" : borderColor,
          opacity: isPending ? 0.92 : 1,
        }}
      >
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--app-muted)" }}
              >
                Approver {index + 1}
              </span>
            </div>

            <p
              className="text-sm font-semibold break-words mt-1"
              style={{ color: "var(--app-text)" }}
            >
              {approval.approver?.firstName} {approval.approver?.lastName}
            </p>

            <p className="text-xs font-medium break-words text-emerald-600">
              {approval.approver?.position || "Approver"}
            </p>
          </div>

          <div className="flex-none">
            <StatusBadge status={status} size="sm" />
          </div>
        </div>

        {/* CANCELLED contextual note (if no remarks) */}
        {isCancelled && !approval?.remarks ? (
          <div
            className="mt-4 rounded-xl text-xs flex items-start gap-2 min-w-0 border p-3"
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

        {/* Remarks */}
        {approval?.remarks && String(approval.remarks).trim() !== "" && (
          <div
            className="mt-4 rounded-xl p-3 text-xs leading-relaxed border flex items-start gap-2 min-w-0"
            style={{
              backgroundColor: isDenied
                ? "rgba(239,68,68,0.10)"
                : isCancelled
                  ? "rgba(148,163,184,0.14)"
                  : "var(--app-surface-2)",
              borderColor: isDenied
                ? "rgba(239,68,68,0.18)"
                : isCancelled
                  ? "rgba(148,163,184,0.24)"
                  : borderColor,
              color: isDenied ? "#ef4444" : "var(--app-text)",
            }}
          >
            <AlertCircle
              size={14}
              className="shrink-0 mt-0.5"
              style={{ color: isDenied ? "#ef4444" : "var(--app-muted)" }}
            />
            <p className="break-words">
              <strong>Note:</strong>{" "}
              <span style={{ color: "var(--app-text)" }}>
                {approval.remarks}
              </span>
            </p>
          </div>
        )}

        {/* ✅ Timestamp Output */}
        {signedAt && (
          <div
            className="mt-4 pt-3 border-t border-dashed"
            style={{ borderColor: "var(--app-border)" }}
          >
            <p
              className="text-[10px] font-mono"
              style={{ color: "var(--app-muted)" }}
            >
              Signed on: {new Date(signedAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const WellnessApplicationDetails = ({ app }) => {
  // ✅ theme + borders
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  if (!app) return null;

  const sortedApprovals = useMemo(() => {
    if (!Array.isArray(app.approvals)) return [];
    return [...app.approvals].sort((a, b) => (a.level || 0) - (b.level || 0));
  }, [app.approvals]);

  // ✅ Status check variables
  const status = String(app?.overallStatus || "").toUpperCase();
  const isFullyApproved =
    status === "APPROVED" ||
    status === "REVOCATION_REQUESTED" ||
    status === "REVOKED";
  const isRevoked = status === "REVOKED";

  // ✅ Late Filing Data
  const isLateFiling = app.lateFiling?.isLateFiling === true;
  const lateJustification = app.lateFiling?.justification;
  const lateAttachment = app.lateFiling?.attachment;

  // ✅ Revocation specific data
  const revocationReq = app.revocationRequest || {};
  const hasActiveRevocationReq =
    !!revocationReq.requestedAt ||
    status === "REVOCATION_REQUESTED" ||
    isRevoked;
  const hasRevocationAttachment = !!revocationReq.attachment?.fileUrl;

  // ✅ History of past (rejected or cancelled) revocations
  const revocationHistory = Array.isArray(app.revocationHistory)
    ? app.revocationHistory
    : [];
  const hasRevocationHistory = revocationHistory.length > 0;

  const handleDownloadAttachment = (attachmentObj) => {
    if (!attachmentObj?.fileUrl) return;
    const url = attachmentObj.fileUrl.replace(/\\/g, "/");
    const fullUrl = url.startsWith("http")
      ? url
      : `${process.env.REACT_APP_API_URL || ""}/${url}`;
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
                {hasActiveRevocationReq ? "Revoked Days" : "Total Leave"}
              </p>
              <p
                className="text-xl font-extrabold"
                style={{ color: "var(--app-text)" }}
              >
                {app.totalDays}{" "}
                <span
                  className="text-xs font-normal"
                  style={{ color: "var(--app-muted)" }}
                >
                  Days
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
                {hasActiveRevocationReq || hasRevocationHistory
                  ? "Original Date Filed"
                  : "Date Filed"}
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

            {/* ✅ LATE FILING JUSTIFICATION CARD */}
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
                  hasActiveRevocationReq || hasRevocationHistory || isLateFiling
                    ? "text-[10px]"
                    : "text-xs"
                }`}
                style={{ color: "var(--app-muted)" }}
              >
                <FileText
                  size={
                    hasActiveRevocationReq ||
                    hasRevocationHistory ||
                    isLateFiling
                      ? 12
                      : 14
                  }
                  style={{ color: "var(--app-muted)" }}
                />{" "}
                {hasActiveRevocationReq || hasRevocationHistory || isLateFiling
                  ? "Original Purpose"
                  : "Purpose"}
              </h4>

              <p
                className={`text-sm leading-relaxed break-words ${hasActiveRevocationReq || hasRevocationHistory || isLateFiling ? "font-medium opacity-80" : "font-medium"}`}
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
                {hasActiveRevocationReq || hasRevocationHistory
                  ? "Dates to Restore"
                  : "Dates Included"}
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

            {/* ✅ UNIFIED DOCUMENTS SECTION */}
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
              className="rounded-xl p-3 shadow-sm border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor:
                      hasActiveRevocationReq || hasRevocationHistory
                        ? "var(--app-surface-2)"
                        : "rgba(34,197,94,0.14)",
                    borderColor:
                      hasActiveRevocationReq || hasRevocationHistory
                        ? borderColor
                        : "rgba(34,197,94,0.22)",
                    color:
                      hasActiveRevocationReq || hasRevocationHistory
                        ? "var(--app-muted)"
                        : "#16a34a",
                  }}
                >
                  <History size={18} />
                </div>

                <div className="min-w-0">
                  <h3
                    className={`font-bold tracking-wide uppercase ${hasActiveRevocationReq || hasRevocationHistory ? "text-xs" : "text-sm"}`}
                    style={{ color: "var(--app-muted)" }}
                  >
                    Processing Timeline
                  </h3>
                  <p
                    className="text-xs font-medium"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {hasActiveRevocationReq || hasRevocationHistory
                      ? "Original workflow & revocation history"
                      : "Step-by-step approval progress"}
                  </p>
                </div>
              </div>

              {sortedApprovals.length > 0 ? (
                <div className="relative space-y-6 sm:space-y-8 t-1 min-w-0">
                  {/* background spine */}
                  <div
                    className="absolute left-5 top-2 bottom-2 w-0.5"
                    style={{ backgroundColor: "var(--app-border)" }}
                  />

                  {/* 1. ORIGINAL APPROVALS */}
                  {sortedApprovals.map((approval, idx) => (
                    <TimelineCard
                      key={approval._id || idx}
                      approval={approval}
                      index={idx}
                      isLast={
                        !hasActiveRevocationReq &&
                        !hasRevocationHistory &&
                        idx === sortedApprovals.length - 1 &&
                        !isFullyApproved
                      }
                      borderColor={borderColor}
                    />
                  ))}

                  {/* 2. REGULAR SUCCESS STATE (Only if reached full approval) */}
                  {isFullyApproved && (
                    <div className="relative flex gap-2 sm:gap-4 items-start">
                      {!hasActiveRevocationReq &&
                      !hasRevocationHistory ? null : (
                        <div
                          className="absolute left-5 top-10 bottom-0 w-0.5"
                          style={{ backgroundColor: "var(--app-border)" }}
                        />
                      )}
                      <div
                        className="relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 shadow-md flex-none"
                        style={{
                          backgroundColor: "#10b981",
                          borderColor: "var(--app-surface)",
                        }}
                      >
                        <CheckCircle2 size={18} className="text-white" />
                      </div>

                      <div
                        className="flex-1 rounded-2xl p-4 shadow-sm border"
                        style={{
                          backgroundColor: "rgba(34,197,94,0.12)",
                          borderColor: "rgba(34,197,94,0.20)",
                        }}
                      >
                        <p
                          className="font-bold text-sm"
                          style={{ color: "var(--app-text)" }}
                        >
                          Application Fully Approved
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--app-muted)" }}
                        >
                          The original Wellness Leave request was finalized.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 3. HISTORY OF REJECTED/CANCELLED REVOCATIONS */}
                  {hasRevocationHistory &&
                    revocationHistory.map((hist, hIdx) => {
                      const isHistCancelled = hist.status === "CANCELLED";

                      return (
                        <React.Fragment key={`hist-${hIdx}`}>
                          {/* Node A: Past Request */}
                          <div className="relative flex gap-2 sm:gap-4 items-start min-w-0">
                            <div
                              className="absolute left-5 top-10 bottom-0 w-0.5"
                              style={{ backgroundColor: "var(--app-border)" }}
                            />
                            <div
                              className="relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 shadow-md flex-none"
                              style={{
                                backgroundColor: "#94a3b8",
                                borderColor: "var(--app-surface)",
                              }}
                            >
                              <Undo size={16} className="text-white" />
                            </div>
                            <div
                              className="flex-1 border rounded-2xl p-4 sm:p-5 shadow-xs min-w-0 transition-all opacity-80"
                              style={{
                                backgroundColor: "var(--app-surface-2)",
                                borderColor: "var(--app-border)",
                              }}
                            >
                              <div className="flex items-start justify-between gap-3 min-w-0">
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Past Attempt #{hIdx + 1}
                                  </span>
                                  <p
                                    className="text-sm font-semibold break-words mt-1"
                                    style={{ color: "var(--app-text)" }}
                                  >
                                    Revocation Requested
                                  </p>
                                  <p
                                    className="text-xs mt-0.5 break-words"
                                    style={{ color: "var(--app-muted)" }}
                                  >
                                    Reason: {hist.reason || "None provided."}
                                  </p>
                                </div>
                              </div>

                              {hist.attachment?.fileUrl && (
                                <button
                                  onClick={() =>
                                    handleDownloadAttachment(hist.attachment)
                                  }
                                  className="mt-3 text-xs flex items-center gap-1 font-medium transition-colors hover:underline"
                                  style={{ color: "var(--accent)" }}
                                >
                                  <Download size={12} /> View Attachment
                                </button>
                              )}

                              {hist.requestedAt && (
                                <div
                                  className="mt-4 pt-3 border-t border-dashed"
                                  style={{ borderColor: "var(--app-border)" }}
                                >
                                  <p
                                    className="text-[10px] font-mono"
                                    style={{ color: "var(--app-muted)" }}
                                  >
                                    Requested on:{" "}
                                    {new Date(
                                      hist.requestedAt,
                                    ).toLocaleString()}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Node B: Past Outcome (Rejected or Cancelled) */}
                          <div className="relative flex gap-2 sm:gap-4 items-start min-w-0">
                            {/* Only draw connector if there is more history or an active revocation request following this */}
                            {(hIdx < revocationHistory.length - 1 ||
                              hasActiveRevocationReq) && (
                              <div
                                className="absolute left-5 top-10 bottom-0 w-0.5"
                                style={{ backgroundColor: "var(--app-border)" }}
                              />
                            )}
                            <div
                              className="relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 shadow-md flex-none"
                              style={{
                                backgroundColor: isHistCancelled
                                  ? "#94a3b8"
                                  : "#ef4444",
                                borderColor: "var(--app-surface)",
                              }}
                            >
                              {isHistCancelled ? (
                                <Ban size={16} className="text-white" />
                              ) : (
                                <XCircle size={16} className="text-white" />
                              )}
                            </div>
                            <div
                              className="flex-1 border rounded-2xl p-4 sm:p-5 shadow-xs min-w-0 transition-all"
                              style={{
                                backgroundColor: isHistCancelled
                                  ? "rgba(148, 163, 184, 0.05)"
                                  : "rgba(239, 68, 68, 0.05)",
                                borderColor: isHistCancelled
                                  ? "rgba(148, 163, 184, 0.2)"
                                  : "rgba(239, 68, 68, 0.2)",
                              }}
                            >
                              <div className="flex items-start justify-between gap-3 min-w-0">
                                <div className="min-w-0">
                                  <span
                                    className={`text-xs font-bold uppercase tracking-wider ${
                                      isHistCancelled
                                        ? "text-slate-500"
                                        : "text-red-500"
                                    }`}
                                  >
                                    {isHistCancelled
                                      ? "Employee Action"
                                      : "HR Final Step"}
                                  </span>
                                  <p
                                    className="text-sm font-semibold break-words mt-1"
                                    style={{ color: "var(--app-text)" }}
                                  >
                                    {isHistCancelled
                                      ? "Withdrawn by Employee"
                                      : "Rejected by HR"}
                                  </p>
                                </div>
                                <div className="flex-none">
                                  <StatusBadge
                                    status={hist.status || "REJECTED"}
                                    size="sm"
                                  />
                                </div>
                              </div>

                              {hist.remarks && (
                                <div
                                  className="mt-4 rounded-xl p-3 text-xs leading-relaxed border flex items-start gap-2 min-w-0"
                                  style={{
                                    backgroundColor: "var(--app-surface-2)",
                                    borderColor: borderColor,
                                    color: "var(--app-text)",
                                  }}
                                >
                                  <AlertCircle
                                    size={14}
                                    className="shrink-0 mt-0.5"
                                    style={{ color: "var(--app-muted)" }}
                                  />
                                  <p className="break-words">
                                    <strong>
                                      {isHistCancelled
                                        ? "System Note:"
                                        : "HR Note:"}
                                    </strong>{" "}
                                    {hist.remarks}
                                  </p>
                                </div>
                              )}

                              {hist.processedAt && (
                                <div
                                  className="mt-4 pt-3 border-t border-dashed"
                                  style={{
                                    borderColor: isHistCancelled
                                      ? "rgba(148, 163, 184, 0.2)"
                                      : "rgba(239, 68, 68, 0.2)",
                                  }}
                                >
                                  <p
                                    className={`text-[10px] font-mono ${
                                      isHistCancelled
                                        ? "text-slate-500"
                                        : "text-red-400"
                                    }`}
                                  >
                                    Processed on:{" "}
                                    {new Date(
                                      hist.processedAt,
                                    ).toLocaleString()}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}

                  {/* 4. ACTIVE REVOCATION REQUESTED STEP */}
                  {hasActiveRevocationReq && (
                    <div className="relative flex gap-2 sm:gap-4 items-start min-w-0">
                      <div
                        className="absolute left-5 top-10 bottom-0 w-0.5"
                        style={{ backgroundColor: "var(--app-border)" }}
                      />
                      <div
                        className="relative z-10 h-10 w-10 rounded-full bg-purple-600 flex items-center justify-center border-4 shadow-md flex-none"
                        style={{ borderColor: "var(--app-surface)" }}
                      >
                        <Undo size={16} className="text-white" />
                      </div>
                      <div
                        className="flex-1 border rounded-2xl p-4 sm:p-5 shadow-xs min-w-0 transition-all"
                        style={{
                          backgroundColor: "rgba(147, 51, 234, 0.04)",
                          borderColor: "rgba(147, 51, 234, 0.2)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <div className="min-w-0">
                            <span
                              className="text-xs font-bold uppercase tracking-wider"
                              style={{ color: "#9333ea" }}
                            >
                              Active Revocation Stage
                            </span>
                            <p
                              className="text-sm font-semibold break-words mt-1"
                              style={{ color: "var(--app-text)" }}
                            >
                              Revocation Requested
                            </p>
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: "var(--app-muted)" }}
                            >
                              Employee submitted a request to cancel this
                              approved leave.
                            </p>
                          </div>
                          <div className="flex-none">
                            <StatusBadge
                              status="REVOCATION_REQUESTED"
                              size="sm"
                            />
                          </div>
                        </div>
                        {revocationReq.requestedAt && (
                          <div
                            className="mt-4 pt-3 border-t border-dashed"
                            style={{ borderColor: "var(--app-border)" }}
                          >
                            <p
                              className="text-[10px] font-mono"
                              style={{ color: "var(--app-muted)" }}
                            >
                              Requested on:{" "}
                              {new Date(
                                revocationReq.requestedAt,
                              ).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 5. HR PROCESSING STATUS */}
                  {hasActiveRevocationReq && (
                    <div className="relative flex gap-2 sm:gap-4 items-start min-w-0">
                      <div
                        className="relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 shadow-md flex-none"
                        style={{
                          backgroundColor: isRevoked
                            ? "#64748b"
                            : "var(--app-muted)",
                          borderColor: "var(--app-surface)",
                        }}
                      >
                        {isRevoked ? (
                          <RotateCcw size={16} className="text-white" />
                        ) : (
                          <Clock size={16} className="text-white" />
                        )}
                      </div>
                      <div
                        className="flex-1 border rounded-2xl p-4 sm:p-5 shadow-xs min-w-0 transition-all"
                        style={{
                          backgroundColor: isRevoked
                            ? "rgba(100, 116, 139, 0.08)"
                            : "var(--app-surface)",
                          borderColor: isRevoked
                            ? "rgba(100, 116, 139, 0.2)"
                            : "var(--app-border)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <div className="min-w-0">
                            <span
                              className="text-xs font-bold uppercase tracking-wider"
                              style={{ color: "var(--app-muted)" }}
                            >
                              HR Final Step
                            </span>
                            <p
                              className="text-sm font-semibold break-words mt-1"
                              style={{ color: "var(--app-text)" }}
                            >
                              {isRevoked
                                ? "Revoked by HR"
                                : "Pending HR Approval"}
                            </p>
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: "var(--app-muted)" }}
                            >
                              {isRevoked
                                ? "HR has processed this request and restored the balances."
                                : "Awaiting Human Resources to review and restore the balances."}
                            </p>
                          </div>
                          <div className="flex-none">
                            <StatusBadge
                              status={isRevoked ? "REVOKED" : "PENDING"}
                              size="sm"
                            />
                          </div>
                        </div>

                        {isRevoked && app.revokeReason && (
                          <div
                            className="mt-4 rounded-xl p-3 text-xs leading-relaxed border flex items-start gap-2 min-w-0"
                            style={{
                              backgroundColor: "var(--app-surface-2)",
                              borderColor: borderColor,
                              color: "var(--app-text)",
                            }}
                          >
                            <AlertCircle
                              size={14}
                              className="shrink-0 mt-0.5"
                              style={{ color: "var(--app-muted)" }}
                            />
                            <p className="break-words">
                              <strong>HR Note:</strong> {app.revokeReason}
                            </p>
                          </div>
                        )}

                        {app.revokedAt && (
                          <div
                            className="mt-4 pt-3 border-t border-dashed"
                            style={{ borderColor: "var(--app-border)" }}
                          >
                            <p
                              className="text-[10px] font-mono"
                              style={{ color: "var(--app-muted)" }}
                            >
                              Processed on:{" "}
                              {new Date(app.revokedAt).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl text-center"
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
                  <p style={{ color: "var(--app-muted)" }} className="text-sm">
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
