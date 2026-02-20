import React, { useState, useMemo } from "react";
import {
  Clock,
  Calendar,
  FileText,
  Users,
  FileStack,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  XCircle,
  CornerDownRight,
  StickyNote,
  History,
  FileX,
  Ban, // ✅ added for CANCELLED icon (timeline only)
} from "lucide-react";
import { StatusBadge, StatusIcon, getStatusStyles } from "../../statusUtils";
import Modal from "../../modal";
import MemoList from "../ctoMemoModal";

// --- Helper: Date Leaf (Compact) ---
const DateLeaf = ({ dateString }) => {
  const date = new Date(dateString);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.toLocaleDateString("en-US", { day: "numeric" });

  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
      <div className="bg-slate-100 rounded md:w-10 md:h-10 w-8 h-8 flex flex-col items-center justify-center shrink-0">
        <span className="text-[8px] font-bold text-slate-500 uppercase leading-none">
          {month}
        </span>
        <span className="text-sm font-bold text-slate-800 leading-none">
          {day}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-medium text-slate-600">
          {date.toLocaleDateString("en-US", { weekday: "long" })}
        </span>
        <span className="text-[10px] text-slate-400">{date.getFullYear()}</span>
      </div>
    </div>
  );
};

/* =========================
   Timeline helpers (DESIGN ONLY)
========================= */
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
  return "bg-gray-200";
};

// --- Helper: Timeline Card (Updated design only) ---
const TimelineCard = ({ approval, index, isLast }) => {
  const status = String(approval?.status || "").toUpperCase();
  const isDenied = status === "REJECTED";
  const isPending = status === "PENDING";
  const isCancelled = status === "CANCELLED";

  return (
    <div className="relative flex gap-2 sm:gap-4 items-start min-w-0">
      {/* Connector Line */}
      {!isLast && (
        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-100" />
      )}

      {/* Status Dot */}
      <div
        className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 border-white shadow-md transition-transform hover:scale-110 flex-none ${StepDotClass(
          status,
        )}`}
        title={status}
      >
        <StepDotIcon status={status} />
      </div>

      {/* Card */}
      <div
        className={`flex-1 bg-white border rounded-2xl p-4 sm:p-5 shadow-xs min-w-0 transition-all ${
          isPending ? "border-gray-100 opacity-90" : "border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Approver {index + 1}
              </span>

              {/* {approval?.updatedAt && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {new Date(approval.updatedAt).toLocaleString()}
                </span>
              )} */}
            </div>

            <p className="text-sm font-semibold text-gray-900 break-words mt-1">
              {approval.approver?.firstName} {approval.approver?.lastName}
            </p>

            <p className="text-xs text-blue-700 font-medium break-words">
              {approval.approver?.position || "Approver"}
            </p>
          </div>

          <div className="flex-none">
            <StatusBadge status={status} size="sm" />
          </div>
        </div>

        {/* CANCELLED contextual note (if no remarks) */}
        {isCancelled && !approval?.remarks ? (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start gap-2 min-w-0">
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
            className={`mt-4 rounded-xl p-3 text-xs leading-relaxed border flex items-start gap-2 min-w-0 ${
              isDenied
                ? "bg-red-50 border-red-100 text-red-700"
                : isCancelled
                  ? "bg-slate-50 border-slate-200 text-slate-700"
                  : "bg-gray-50 border-gray-200 text-gray-700"
            }`}
          >
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p className="break-words">
              <strong>Note:</strong> {approval.remarks}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const CtoApplicationDetails = ({ app }) => {
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  if (!app) return null;

  const sortedApprovals = useMemo(() => {
    if (!Array.isArray(app.approvals)) return [];
    return [...app.approvals].sort((a, b) => a.level - b.level);
  }, [app.approvals]);

  const hasDocuments = app.memo && app.memo.length > 0;

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <div className="max-h-[75vh] overflow-y-auto custom-scrollbar p-2 md:p-6">
        {/* 1. Top Header: High-Level Stats */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
              Current Status
            </p>
            <StatusBadge
              status={app.overallStatus}
              className="text-lg px-4 py-1.5"
              showIcon
            />
          </div>

          <div className="flex gap-6 divide-x divide-slate-100">
            <div className="px-4 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase">
                Requested
              </p>
              <p className="text-xl font-bold text-slate-700">
                {app.requestedHours}{" "}
                <span className="text-xs font-normal text-slate-400">hrs</span>
              </p>
            </div>
            <div className="px-4 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase">
                Date Filed
              </p>
              <p className="text-sm font-bold text-slate-700 mt-1">
                {new Date(app.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN: Context (Dates, Docs, Reason) - Takes 1/3 width */}
          <div className="lg:col-span-1 space-y-4">
            {/* Reason Card (Moved to side for context) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <FileText size={14} /> Purpose
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {app.reason || (
                  <span className="italic text-slate-400">
                    No reason provided.
                  </span>
                )}
              </p>
            </div>

            {/* Selected Dates */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <CalendarDays size={14} /> Dates Included
              </h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {app.inclusiveDates?.length > 0 ? (
                  app.inclusiveDates.map((d, i) => (
                    <DateLeaf key={i} dateString={d} />
                  ))
                ) : (
                  <div className="text-center py-4 text-slate-400 text-sm border border-dashed rounded-lg">
                    No dates selected
                  </div>
                )}
              </div>
            </div>

            {/* Documents Button */}
            <div className="bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              <button
                onClick={() =>
                  hasDocuments &&
                  setMemoModal({ isOpen: true, memos: app.memo })
                }
                disabled={!hasDocuments}
                className={`w-full flex items-center justify-between p-4 rounded-lg transition-all ${
                  hasDocuments
                    ? "hover:bg-indigo-50 group cursor-pointer"
                    : "opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${hasDocuments ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}
                  >
                    {hasDocuments ? (
                      <FileStack size={18} />
                    ) : (
                      <FileX size={18} />
                    )}
                  </div>
                  <div className="text-left">
                    <span className="block text-sm font-bold text-slate-700">
                      Attachments
                    </span>
                    <span className="text-xs text-slate-500">
                      {hasDocuments
                        ? `${app.memo.length} documents available`
                        : "No files attached"}
                    </span>
                  </div>
                </div>
                {hasDocuments && (
                  <ArrowRight
                    size={16}
                    className="text-slate-300 group-hover:text-indigo-600"
                  />
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: The Narrative (Timeline) - Takes 2/3 width */}
          <div className="lg:col-span-2">
            {/* ✅ ONLY THIS SECTION WAS RESTYLED */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 flex-none">
                  <History size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900">
                    Processing Timeline
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Step-by-step approval progress
                  </p>
                </div>
              </div>

              {sortedApprovals.length > 0 ? (
                <div className="relative space-y-6 sm:space-y-8 t-1">
                  {/* background spine */}
                  <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-100" />

                  {sortedApprovals.map((approval, idx) => (
                    <TimelineCard
                      key={approval._id}
                      approval={approval}
                      index={idx}
                      isLast={idx === sortedApprovals.length - 1}
                    />
                  ))}

                  {/* Success State End of Timeline */}
                  {app.overallStatus === "Approved" && (
                    <div className="relative flex gap-2 sm:gap-4 items-start">
                      <div className="relative z-10 h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center border-4 border-white shadow-md flex-none">
                        <CheckCircle2 size={18} className="text-white" />
                      </div>
                      <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-emerald-800 font-bold text-sm">
                          Application Fully Approved
                        </p>
                        <p className="text-emerald-600 text-xs mt-0.5">
                          The CTO request has been finalized.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-white border border-dashed border-slate-300 rounded-xl text-center">
                  <Users size={32} className="text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">
                    Waiting for workflow initiation
                  </p>
                  <p className="text-slate-400 text-sm">
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
