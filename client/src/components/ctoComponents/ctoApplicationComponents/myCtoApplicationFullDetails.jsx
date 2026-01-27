import React, { useState } from "react";
import {
  Clock,
  Calendar,
  FileText,
  Users,
  FileStack,
  Eye,
  Download,
  CalendarDays,
  ChevronRight,
  Quote,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { StatusBadge, StatusIcon, getStatusStyles } from "../../statusUtils";
import Modal from "../../modal";
import MemoList from "../ctoMemoModal";

const FILE_BASE_URL = "http://localhost:3000";

// --- Helper: Calendar Leaf Component ---
const DateLeaf = ({ dateString }) => {
  const date = new Date(dateString);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.toLocaleDateString("en-US", { day: "numeric" });
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <div className="flex flex-col items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm min-w-[70px] shrink-0">
      <div className="w-full bg-slate-50 border-b border-slate-100 py-1 text-center">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          {month}
        </span>
      </div>
      <div className="px-2 py-1 flex flex-col items-center">
        <span className="text-xl font-bold text-slate-800 tabular-nums leading-none">
          {day}
        </span>
        <span className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
          {weekday}
        </span>
      </div>
    </div>
  );
};

const CtoApplicationDetails = ({ app }) => {
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  if (!app) return null;

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/30">
      <div className="max-h-[80vh] overflow-y-auto px-1 pb-10 custom-scrollbar">
        {/* 1. High-Impact Header Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6 relative overflow-hidden">
          {/* Decorative background circle */}
          <div
            className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 ${getStatusStyles(
              app.overallStatus,
            ).replace("bg-", "bg-")}`}
          />

          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 relative z-10">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Application Status
              </p>
              <div className="flex items-center gap-3">
                <StatusBadge
                  status={app.overallStatus}
                  className="text-lg px-3 py-1"
                  showIcon={true}
                />
              </div>
            </div>

            <div className="flex items-center gap-6 md:gap-12">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Requested
                  </p>
                  <p className="text-xl font-black text-slate-800 tabular-nums leading-none">
                    {app.requestedHours}
                    <span className="text-sm font-medium text-slate-500 ml-1">
                      hrs
                    </span>
                  </p>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Submitted
                  </p>
                  <p className="text-sm font-bold text-slate-700">
                    {new Date(app.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(app.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Details & Reason (8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Reason Section */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                Reason for Request
              </h4>
              <p className="text-slate-700 leading-relaxed text-[15px] whitespace-pre-wrap font-medium">
                {app.reason || (
                  <span className="text-slate-400 italic">
                    No specific reason provided.
                  </span>
                )}
              </p>
            </div>

            {/* Dates Grid */}
            <div>
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 ml-1">
                <CalendarDays size={14} /> Selected Dates (
                {app.inclusiveDates?.length || 0})
              </h4>
              <div className="flex flex-wrap gap-3">
                {app.inclusiveDates?.map((d, i) => (
                  <DateLeaf key={i} dateString={d} />
                )) || (
                  <div className="p-4 w-full bg-slate-100 rounded-lg border border-dashed border-slate-300 text-slate-500 text-sm flex items-center gap-2">
                    <AlertCircle size={16} /> No dates selected
                  </div>
                )}
              </div>
            </div>

            {/* Documents Trigger */}
            <button
              onClick={() => setMemoModal({ isOpen: true, memos: app.memo })}
              className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileStack size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 text-sm">
                    Reference Documents
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {app.memo?.length || 0} attached files available
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 p-2 rounded-full text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                <ArrowRight size={16} />
              </div>
            </button>
          </div>

          {/* Right Column: Workflow Timeline (4 cols) */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-full">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4">
                <Users size={14} /> Approval Timeline
              </h4>

              {app.approvals?.length > 0 ? (
                <div className="relative pl-2">
                  {/* Continuous Vertical Line */}
                  <div className="absolute left-[19px] top-2 bottom-6 w-0.5 bg-slate-100" />

                  <div className="space-y-8">
                    {app.approvals.map((a, idx) => (
                      <div
                        key={a._id}
                        className="relative flex gap-4 items-start group"
                      >
                        {/* Status Icon Node */}
                        <div
                          className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm shrink-0 transition-transform group-hover:scale-105 ${getStatusStyles(
                            a.status,
                          )}`}
                        >
                          <StatusIcon status={a.status} size={16} />
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 pt-1 min-w-0">
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">
                              {idx === 0 ? "First Approval" : "Final Approval"}
                            </span>
                            <span
                              className="text-sm font-bold text-slate-800 truncate"
                              title={`${a.approver?.firstName} ${a.approver?.lastName}`}
                            >
                              {a.approver?.firstName} {a.approver?.lastName}
                            </span>
                            <span className="text-xs text-indigo-600 font-medium truncate">
                              {a.approver?.position || "Approver"}
                            </span>
                          </div>

                          {/* Optional: Add Approval Timestamp if data existed */}
                          {/* <div className="mt-2 text-[10px] text-slate-400 bg-slate-50 inline-block px-2 py-0.5 rounded-full">
                            Jan 12 • 2:30 PM
                          </div> */}
                        </div>
                      </div>
                    ))}

                    {/* Final Success State Node (Visual only) */}
                    {app.overallStatus === "Approved" && (
                      <div className="relative flex gap-4 items-center">
                        <div className="relative z-10 w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border-4 border-white shadow-sm shrink-0">
                          <CheckCircle2 size={20} />
                        </div>
                        <span className="text-sm font-bold text-emerald-700">
                          Request Completed
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 px-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                  <Users className="mx-auto text-slate-300 mb-2" size={24} />
                  <p className="text-xs text-slate-400 font-medium">
                    No approval workflow has been initiated yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Refined Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memos: [] })}
        title="Attached Reference Documents"
        closeLabel="Done"
        maxWidth="max-w-xl"
      >
        <MemoList
          memos={memoModal.memos}
          description={"Read-only view of CTO memos attached to this request."}
        />
      </Modal>
    </div>
  );
};

export default CtoApplicationDetails;
