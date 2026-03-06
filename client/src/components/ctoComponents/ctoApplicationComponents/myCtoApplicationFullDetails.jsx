import React, { useState, useMemo, useEffect } from "react";
import {
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  XCircle,
  StickyNote,
  History,
  FileX,
  Ban,
  Users,
  FileText,
  FileStack,
} from "lucide-react";
import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import MemoList from "../ctoMemoModal";
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
  return <Users size={16} className="text-white" />;
};

const StepDotBg = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "#10b981"; // emerald-500
  if (s === "REJECTED") return "#ef4444"; // red-500
  if (s === "CANCELLED") return "#94a3b8"; // slate-400
  return "rgba(148,163,184,0.35)"; // soft slate
};

// --- Helper: Timeline Card (theme-aware) ---
const TimelineCard = ({ approval, index, isLast, borderColor }) => {
  const status = String(approval?.status || "").toUpperCase();
  const isDenied = status === "REJECTED";
  const isPending = status === "PENDING";
  const isCancelled = status === "CANCELLED";

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

            <p className="text-xs font-medium break-words text-blue-700">
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
      </div>
    </div>
  );
};

const CtoApplicationDetails = ({ app }) => {
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

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

  const hasDocuments = Array.isArray(app.memo) && app.memo.length > 0;
  const isFullyApproved =
    String(app?.overallStatus || "").toUpperCase() === "APPROVED";

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
            <p
              className="text-xs font-bold uppercase tracking-wider mb-1"
              style={{ color: "var(--app-muted)" }}
            >
              Current Status
            </p>
            <StatusBadge
              status={app.overallStatus}
              className="text-lg px-4 py-1.5"
              showIcon
            />
          </div>

          <div
            className="flex gap-6"
            style={{ borderLeft: "0px solid transparent" }}
          >
            <div
              className="px-4 text-center"
              style={{ borderRight: `1px solid ${borderColor}` }}
            >
              <p
                className="text-[10px] font-bold uppercase"
                style={{ color: "var(--app-muted)" }}
              >
                Requested
              </p>
              <p
                className="text-xl font-extrabold"
                style={{ color: "var(--app-text)" }}
              >
                {app.requestedHours}{" "}
                <span
                  className="text-xs font-normal"
                  style={{ color: "var(--app-muted)" }}
                >
                  hrs
                </span>
              </p>
            </div>

            <div className="px-4 text-center">
              <p
                className="text-[10px] font-bold uppercase"
                style={{ color: "var(--app-muted)" }}
              >
                Date Filed
              </p>
              <p
                className="text-sm font-bold mt-1"
                style={{ color: "var(--app-text)" }}
              >
                {new Date(app.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-1 space-y-4">
            {/* Reason Card */}
            <div
              className="rounded-xl p-5 shadow-sm border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <h4
                className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
                style={{ color: "var(--app-muted)" }}
              >
                <FileText size={14} style={{ color: "var(--app-muted)" }} />{" "}
                Purpose
              </h4>

              <p
                className="text-sm leading-relaxed font-medium break-words"
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
                Dates Included
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

            {/* Documents Button */}
            <div
              className="rounded-xl p-1 shadow-sm border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
              }}
            >
              <button
                onClick={() =>
                  hasDocuments &&
                  setMemoModal({ isOpen: true, memos: app.memo })
                }
                disabled={!hasDocuments}
                className="w-full flex items-center justify-between p-4 rounded-lg transition-colors duration-200 ease-out"
                type="button"
                style={{
                  backgroundColor: "transparent",
                  opacity: hasDocuments ? 1 : 0.6,
                  cursor: hasDocuments ? "pointer" : "not-allowed",
                }}
                onMouseEnter={(e) => {
                  if (!hasDocuments) return;
                  e.currentTarget.style.backgroundColor =
                    "var(--app-surface-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg border transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: hasDocuments
                        ? "var(--accent-soft)"
                        : "var(--app-surface-2)",
                      borderColor: hasDocuments
                        ? "var(--accent-soft2, rgba(37,99,235,0.18))"
                        : borderColor,
                      color: hasDocuments
                        ? "var(--accent)"
                        : "var(--app-muted)",
                    }}
                  >
                    {hasDocuments ? (
                      <FileStack size={18} />
                    ) : (
                      <FileX size={18} />
                    )}
                  </div>

                  <div className="text-left">
                    <span
                      className="block text-sm font-bold"
                      style={{ color: "var(--app-text)" }}
                    >
                      Attachments
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {hasDocuments
                        ? `${app.memo.length} documents available`
                        : "No files attached"}
                    </span>
                  </div>
                </div>

                {hasDocuments && (
                  <ArrowRight size={16} style={{ color: "var(--app-muted)" }} />
                )}
              </button>
            </div>
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
                    backgroundColor: "rgba(34,197,94,0.14)",
                    borderColor: "rgba(34,197,94,0.22)",
                    color: "#16a34a",
                  }}
                >
                  <History size={18} />
                </div>

                <div className="min-w-0">
                  <h3
                    className="text-sm font-bold tracking-wide uppercase"
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
                <div className="relative space-y-6 sm:space-y-8 t-1">
                  {/* background spine */}
                  <div
                    className="absolute left-5 top-2 bottom-2 w-0.5"
                    style={{ backgroundColor: "var(--app-border)" }}
                  />

                  {sortedApprovals.map((approval, idx) => (
                    <TimelineCard
                      key={approval._id || idx}
                      approval={approval}
                      index={idx}
                      isLast={idx === sortedApprovals.length - 1}
                      borderColor={borderColor}
                    />
                  ))}

                  {/* Success State End of Timeline */}
                  {isFullyApproved && (
                    <div className="relative flex gap-2 sm:gap-4 items-start">
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
                          The CTO request has been finalized.
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

      {/* Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memos: [] })}
        title="Attached Reference Documents"
        closeLabel="Close"
        maxWidth="max-w-4xl"
      >
        <MemoList
          memos={memoModal.memos}
          description="Documents attached by the applicant for reference."
        />
      </Modal>
    </div>
  );
};

export default CtoApplicationDetails;
