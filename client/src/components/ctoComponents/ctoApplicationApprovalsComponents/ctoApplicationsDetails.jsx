import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  FileText,
  BadgeCheck,
  Calendar,
  Check,
  BookOpen,
  User,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  AlertCircle,
  Info,
  CalendarDays,
  XCircle,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { getStatusStyles, StatusIcon, StatusBadge } from "../../statusUtils";
import { useAuth } from "../../../store/authStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Modal from "../../modal";
import {
  approveApplicationRequest,
  rejectApplicationRequest,
} from "../../../api/cto";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";

// Improved Skeleton for better layout matching
const CtoApplicationDetailsSkeleton = () => (
  <div className="max-w-5xl mx-auto p-6 space-y-6">
    <div className="flex justify-between items-center">
      <div className="flex gap-4">
        <Skeleton circle width={56} height={56} />
        <div>
          <Skeleton width={150} height={20} />
          <Skeleton width={100} />
        </div>
      </div>
      <Skeleton width={200} height={45} borderRadius={12} />
    </div>
    <Skeleton height={120} borderRadius={16} />
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2">
        <Skeleton height={300} borderRadius={16} />
      </div>
      <Skeleton height={300} borderRadius={16} />
    </div>
  </div>
);

const CtoApplicationDetails = ({
  application: appProp,
  isLoading,
  onSelect,
}) => {
  const { admin } = useAuth();
  const queryClient = useQueryClient();

  const [application, setApplication] = useState(null);
  const [isProcessed, setIsProcessed] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  useEffect(() => {
    if (appProp?._id !== application?._id) {
      setApplication(appProp);
      setIsProcessed(false);
      setRemarks("");
    }
  }, [appProp, application?._id]);

  const approveMutation = useMutation({
    mutationFn: (applicationId) => approveApplicationRequest(applicationId),
    onSuccess: (updatedApp) => {
      setApplication(updatedApp);
      onSelect(updatedApp);
      setIsProcessed(true);
      setIsModalOpen(false);
      toast.success("Application approved successfully.");
      queryClient.invalidateQueries(["ctoApplicationsApprovals"]);
    },
    onError: (err) => toast.error(err.message || "Failed to approve."),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ applicationId, remarks }) =>
      rejectApplicationRequest(applicationId, remarks),
    onSuccess: (updatedApp) => {
      setApplication(updatedApp);
      onSelect(updatedApp);
      setRemarks("");
      setIsProcessed(true);
      setIsModalOpen(false);
      toast.success("Application rejected.");
      queryClient.invalidateQueries(["ctoApplicationsApprovals"]);
    },
    onError: (err) => toast.error(err.message || "Failed to reject."),
  });

  const handleAction = () => {
    if (modalType === "approve") approveMutation.mutate(application._id);
    else {
      if (!remarks.trim()) return toast.error("Please provide a reason.");
      rejectMutation.mutate({ applicationId: application._id, remarks });
    }
  };

  if (isLoading) return <CtoApplicationDetailsSkeleton />;

  if (!application)
    return (
      <div className="flex flex-col items-center justify-center py-40 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200 m-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm mb-4">
          <FileText className="h-10 w-10 text-gray-300" />
        </div>
        <h3 className="text-gray-900 font-semibold">No Application Selected</h3>
        <p className="text-gray-500 text-sm mt-1">
          Select a request from the list to view details.
        </p>
      </div>
    );

  const initials = `${application.employee?.firstName?.[0] || ""}${
    application.employee?.lastName?.[0] || ""
  }`;
  const currentStep = application.approvals?.find(
    (step) => step.approver?._id === admin?.id
  );
  const canApproveOrReject = currentStep?.status === "PENDING" && !isProcessed;

  return (
    <div className="flex-1 h-full flex flex-col gap-4 max-w-6xl mx-auto">
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white pb-2 border-b-1 border-gray-300 sticky backdrop-blur-lg px-1 top-2 bg-white/90">
        <div className="flex items-center gap-4 py-2">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br bg-blue-600 text-blue-50 flex items-center justify-center text-white font-bold text-lg">
            {initials}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">
              {application.employee?.firstName} {application.employee?.lastName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
              <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                ID: {application.employee?.employeeId || "N/A"}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />{" "}
                {new Date(application.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2 bg-gray-50 md:bg-transparent rounded-xl">
          {canApproveOrReject ? (
            <>
              <button
                onClick={() => {
                  setModalType("reject");
                  setIsModalOpen(true);
                }}
                className="flex-1 md:flex-none px-4 bg-gray-200 py-2 rounded-lg text-gray-600 hover:bg-gray-300 font-semibold transition-colors transition-all active:scale-95 "
              >
                Reject
              </button>
              <button
                onClick={() => {
                  setModalType("approve");
                  setIsModalOpen(true);
                }}
                disabled={approveMutation.isPending}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition shadow-sm font-medium w-full md:w-auto flex items-center   transition-all active:scale-95  gap-2"
              >
                {approveMutation.isPending
                  ? "Processing..."
                  : "Approve Request"}
              </button>
            </>
          ) : (
            <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 text-sm font-bold border border-emerald-100">
              <BadgeCheck size={18} /> Action Completed
            </div>
          )}
        </div>
      </header>

      {/* QUICK STATS BANNER */}
      <div className="flex h-full flex-1 overflow-y-auto flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white flex  justify-between items-center relative overflow-hidden shadow-sm shadow-blue-100">
            <CalendarDays className="absolute right-[-20px] top-[-20px] h-40 w-40 text-white/10 rotate-12" />
            <div>
              <p className="text-blue-50 text-xs font-bold uppercase tracking-widest mb-1">
                Requested Dates
              </p>
              <h3 className="text-2xl md:text-3xl font-bold">
                {application.inclusiveDates?.length > 0
                  ? application.inclusiveDates
                      .map((d) =>
                        new Date(d).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      )
                      .join(", ")
                  : "No dates set"}
              </h3>
            </div>
            <div className=" flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl">
                <p className="text-[10px] text-blue-100 uppercase font-bold">
                  Total Duration
                </p>
                <p className="text-lg font-bold">
                  {application.requestedHours} Hours
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between  items-center text-center gap-4">
            <div
              className={`p-4 rounded-2xl ${
                application.overallStatus === "APPROVED"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              <StatusIcon
                status={application.overallStatus}
                size={32}
                className="h-6 w-6"
              />
            </div>
            <div className="text-start">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Global Status
              </p>
              <p className="text-xl font-black text-gray-900">
                {application.overallStatus}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAIN CONTENT */}
          <div className="lg:col-span-2 space-y-4">
            {/* REASON CARD */}
            <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <MessageCircle size={20} />
                </div>
                <h3 className="font-bold text-gray-900">Purpose of Leave</h3>
              </div>
              <p className="text-gray-700 leading-relaxed italic bg-gray-50 p-4 rounded-2xl border border-gray-100">
                "
                {application.reason ||
                  "No specific reason provided by the applicant."}
                "
              </p>
            </section>

            {/* TIMELINE SECTION */}
            <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="font-bold text-gray-900">Approval Progress</h3>
              </div>

              <div className="relative space-y-8 left-2">
                <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-100" />
                {application.approvals?.map((step, idx) => (
                  <div
                    key={idx}
                    className="relative flex gap-6 items-start group"
                  >
                    <div
                      className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 border-white shadow-md transition-transform group-hover:scale-110
                    ${
                      step.status === "APPROVED"
                        ? "bg-emerald-500"
                        : step.status === "REJECTED"
                        ? "bg-red-500"
                        : "bg-gray-200"
                    }`}
                    >
                      {step.status === "APPROVED" ? (
                        <Check size={16} className="text-white" />
                      ) : (
                        <User size={16} className="text-white" />
                      )}
                    </div>
                    <div className="flex-1 bg-white border border-gray-100 p-5 rounded-2xl group-hover:border-blue-200 transition-all shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-black text-gray-900">
                            Level {step.level}: {step.approver?.firstName}{" "}
                            {step.approver?.lastName}
                          </p>
                          <p className="text-xs text-gray-500 font-medium">
                            {step.approver?.position}
                          </p>
                        </div>
                        <StatusBadge status={step.status} size="sm" />
                      </div>
                      {step.remarks && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 flex items-start gap-2">
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <p>
                            <strong>Note:</strong> {step.remarks}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* SIDEBAR */}
          <aside className="space-y-6">
            {/* DOCUMENTS */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                Supporting Memos
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {application.memo?.length || 0}
                </span>
              </h4>
              <div className="space-y-3">
                {application.memo?.length > 0 ? (
                  application.memo.slice(0, 3).map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center text-red-500 shadow-sm">
                          <FileText size={16} />
                        </div>
                        <p className="text-xs font-bold truncate w-24">
                          Memo {m.memoId?.memoNo}
                        </p>
                      </div>
                      <a
                        href={`http://localhost:3000${m.uploadedMemo}`}
                        target="_blank"
                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4 italic">
                    No documents attached
                  </p>
                )}
                <button
                  onClick={() =>
                    setMemoModal({
                      isOpen: true,
                      memos: application.memo || [],
                    })
                  }
                  className="w-full mt-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-xs font-bold text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-all"
                >
                  View All Documents
                </button>
              </div>
            </div>

            {/* SYSTEM ADVISORY */}
            <div className="bg-gray-900 rounded-xl p-6 text-white shadow-2xl shadow-blue-200/20 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-blue-400 mb-3">
                  <Info size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Admin Advisory
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-gray-300">
                  By approving, you confirm this employee has{" "}
                  <span className="text-white font-bold underline decoration-blue-500 text-underline-offset-4">
                    sufficient credits
                  </span>{" "}
                  to cover {application.requestedHours} hours.
                </p>
              </div>
              <div className="absolute -bottom-4 -right-4 h-24 w-24 bg-blue-500/10 rounded-full blur-2xl"></div>
            </div>
          </aside>
        </div>

        {/* MODALS RENDERED HERE... (Logic remains similar to your original but with styled components) */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            modalType === "approve" ? "Confirm Approval" : "Rejection Reason"
          }
          action={{
            show: true,
            label:
              modalType === "approve"
                ? "Confirm & Approve"
                : "Reject Application",
            variant: modalType === "approve" ? "save" : "cancel",
            onClick: handleAction,
          }}
        >
          <div className="p-4">
            {modalType === "approve" ? (
              <div className="text-center space-y-4">
                <div className="mx-auto h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                  <Check size={32} />
                </div>
                <p className="text-gray-600 font-medium">
                  You are about to approve this request for{" "}
                  <span className="text-gray-900 font-bold">
                    {application.employee?.firstName}
                  </span>
                  . The employee will be notified immediately.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Why is this being rejected?
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Insufficient credits, incorrect dates provided..."
                  className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-red-200 focus:ring-0 outline-none min-h-[120px] text-gray-700 transition-all"
                />
              </div>
            )}
          </div>
        </Modal>

        {/* DOCUMENT MODAL */}
        <Modal
          isOpen={memoModal.isOpen}
          onClose={() => setMemoModal({ isOpen: false, memos: [] })}
          title="Verification Documents"
        >
          <div className="grid gap-4 p-2 max-h-[60vh] overflow-y-auto">
            {memoModal.memos.map((memo, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl hover:shadow-lg hover:shadow-gray-100 transition-all group"
              >
                <div className="h-12 w-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">
                    Memo #{memo.memoId?.memoNo}
                  </p>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    {memo.memoId?.totalHours} Credits Attached
                  </p>
                </div>
                <a
                  href={`http://localhost:3000${memo.uploadedMemo}`}
                  target="_blank"
                  className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
                >
                  Open <ExternalLink size={14} />
                </a>
              </div>
            ))}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default CtoApplicationDetails;
