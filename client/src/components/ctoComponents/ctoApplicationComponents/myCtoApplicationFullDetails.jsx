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
  CornerDownRight,
  StickyNote,
  History,
  FileX,
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

// --- Helper: Timeline Card (Wide Version) ---
const TimelineCard = ({ approval, index, isLast }) => {
  const isDenied = approval.status === "REJECTED";
  const isPending = approval.status === "PENDING";
  const isApproved = approval.status === "APPROVED";

  return (
    <div className="relative pl-8 md:pl-12 pb-8 last:pb-0">
      {/* Connector Line */}
      {!isLast && (
        <div className="absolute left-[15px] md:left-[19px] top-10 bottom-0 w-0.5 bg-slate-200" />
      )}

      {/* Status Node */}
      <div
        className={`absolute left-0 top-0 z-10 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-4  border-slate-50 shadow-sm transition-transform hover:scale-110 ${getStatusStyles(
          approval.status,
        )}`}
      >
        <StatusIcon status={approval.status} size={16} />
      </div>

      {/* Card Body */}
      <div
        className={`bg-slate-50/50 border rounded-xl p-4 md:p-5  transition-all ${isPending ? "border-slate-100 opacity-80" : "border-slate-200"}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Step {index + 1}
              </span>
              {approval.updatedAt && (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {new Date(approval.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
            <h4 className="font-bold text-slate-800 text-sm md:text-base mt-1">
              {approval.approver?.firstName} {approval.approver?.lastName}
            </h4>
            <p className="text-xs text-indigo-600 font-medium">
              {approval.approver?.position || "Approver"}
            </p>
          </div>

          <div className="shrink-0">
            <StatusBadge
              status={approval.status}
              className="text-xs px-2 py-1"
            />
          </div>
        </div>

        {/* Remarks Section - Handles Long Text Gracefully */}
        {approval.remarks && approval.remarks.trim() !== "" && (
          <div
            className={`mt-4 rounded-lg p-4 text-sm leading-relaxed border ${
              isDenied
                ? "bg-rose-50 border-rose-100 text-rose-800"
                : "bg-slate-50 border-slate-100 text-slate-700"
            }`}
          >
            <div className="flex items-start gap-3">
              {isDenied ? (
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
              ) : (
                <StickyNote
                  size={18}
                  className="mt-0.5 shrink-0 text-slate-400"
                />
              )}
              <div className="w-full">
                <p className="font-bold text-xs uppercase opacity-70 mb-1">
                  {isDenied ? "Rejection Reason" : "Approver Remarks"}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {approval.remarks}
                </p>
              </div>
            </div>
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
            <div className="bg-white shadow-sm p-3 rounded-xl">
              <div className="flex items-center gap-2 mb-6 ml-1">
                <History size={18} className="text-slate-400" />
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">
                  Processing Timeline
                </h3>
              </div>

              {sortedApprovals.length > 0 ? (
                <div className="space-y-0">
                  {sortedApprovals.map((approval, idx) => (
                    <TimelineCard
                      key={approval._id}
                      approval={approval}
                      index={idx}
                      isLast={
                        idx === sortedApprovals.length - 1 &&
                        app.overallStatus !== "Approved"
                      }
                    />
                  ))}

                  {/* Success State End of Timeline */}
                  {app.overallStatus === "Approved" && (
                    <div className="relative pl-8 md:pl-12 pt-2">
                      <div className="absolute left-[15px] md:left-[19px] -top-4 h-6 w-0.5 bg-slate-200" />
                      <div className="absolute left-0 top-0 z-10 w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border-4 border-white shadow-sm">
                        <CheckCircle2 size={20} />
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 ml-1">
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
        closeLabel="Close Viewer"
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
