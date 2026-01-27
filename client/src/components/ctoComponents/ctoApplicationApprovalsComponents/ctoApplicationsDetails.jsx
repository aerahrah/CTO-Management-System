import React, { useState, useEffect } from "react";
import {
  Clock,
  FileText,
  BadgeCheck,
  CalendarDays,
  Check,
  Calendar,
  User,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  AlertCircle,
  Info,
} from "lucide-react";
import { StatusIcon, StatusBadge } from "../../statusUtils";
import { useAuth } from "../../../store/authStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Modal from "../../modal";
import {
  approveApplicationRequest,
  rejectApplicationRequest,
  getCtoApplicationById,
} from "../../../api/cto";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import MemoList from "../ctoMemoModal";

const CtoApplicationDetailsSkeleton = () => (
  <div className="max-w-5xl mx-auto p-6 space-y-6">
    <Skeleton height={120} borderRadius={16} />
    <Skeleton height={300} borderRadius={16} />
  </div>
);

const CtoApplicationDetails = () => {
  const { admin } = useAuth();
  const { id } = useParams();
  const queryClient = useQueryClient();

  console.log(id);
  const [isProcessed, setIsProcessed] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  const isEmbeddable = (url) => /\.(pdf|png|jpg|jpeg|webp)$/i.test(url);

  // Fetch the application by ID
  const {
    data: application,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["ctoApplication", id],
    queryFn: () => getCtoApplicationById(id),
    enabled: !!id,
    onSuccess: (data) => {
      console.log("Fetched application data:", data);
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (applicationId) => approveApplicationRequest(applicationId),
    onSuccess: (updatedApp) => {
      setIsProcessed(true);
      setIsModalOpen(false);
      toast.success("Application approved successfully.");
      queryClient.invalidateQueries(["ctoApplication", id]);
      queryClient.invalidateQueries(["ctoApplicationsApprovals"]);
      queryClient.invalidateQueries(["ctoPendingCount"]);
    },
    onError: (err) => toast.error(err.message || "Failed to approve."),
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ applicationId, remarks }) =>
      rejectApplicationRequest(applicationId, remarks),
    onSuccess: () => {
      setRemarks("");
      setIsProcessed(true);
      setIsModalOpen(false);
      toast.success("Application rejected.");
      queryClient.invalidateQueries(["ctoApplication", id]);
      queryClient.invalidateQueries(["ctoApplicationsApprovals"]);
      queryClient.invalidateQueries(["ctoPendingCount"]);
    },
    onError: (err) => toast.error(err.message || "Failed to reject."),
  });
  const isPdf = (url) => /\.pdf$/i.test(url);

  const handleAction = () => {
    if (!application) return;
    if (modalType === "approve") approveMutation.mutate(application._id);
    else {
      if (!remarks.trim()) return toast.error("Please provide a reason.");
      rejectMutation.mutate({ applicationId: application._id, remarks });
    }
  };

  useEffect(() => {
    setIsProcessed(false);
    setRemarks("");
  }, [application]);

  if (isLoading) return <CtoApplicationDetailsSkeleton />;
  if (isError) return <p>Error: {error.message}</p>;
  if (!application)
    return (
      <div className="flex flex-col items-center justify-center py-40 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200 m-6">
        <FileText className="h-10 w-10 text-gray-300" />
        <h3 className="text-gray-900 font-semibold">No Application Found</h3>
      </div>
    );

  const initials = `${application.employee?.firstName?.[0] || ""}${
    application.employee?.lastName?.[0] || ""
  }`;
  const currentStep = application.approvals?.find(
    (step) => step.approver?._id === admin?.id,
  );
  const canApproveOrReject = currentStep?.status === "PENDING" && !isProcessed;

  return (
    <div className="flex-1 h-full w-full flex flex-col gap-4 max-w-6xl mx-auto">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white pb-2 border-b border-gray-300 sticky top-2 bg-white/90">
        <div className="flex items-center gap-4 py-2">
          <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
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

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-3 p-2 bg-gray-50 md:bg-transparent rounded-xl">
          {canApproveOrReject ? (
            <>
              <button
                onClick={() => {
                  setModalType("reject");
                  setIsModalOpen(true);
                }}
                className="flex-1 md:flex-none px-4 bg-gray-200 py-2 rounded-lg text-gray-600 hover:bg-gray-300 font-semibold"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  setModalType("approve");
                  setIsModalOpen(true);
                }}
                disabled={approveMutation.isPending}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition shadow-sm font-medium w-full md:w-auto flex items-center gap-2"
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
                        }),
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
            {/* <div className="bg-gray-900 rounded-xl p-6 text-white shadow-2xl shadow-blue-200/20 relative overflow-hidden">
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
            </div> */}
          </aside>
        </div>

        {/* MODALS RENDERED HERE... (Logic remains similar to your original but with styled components) */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            modalType === "approve" ? "Confirm Approval" : "Decline Request"
          }
          action={{
            show: true,
            label: modalType === "approve" ? "Approve" : "Reject",

            variant: modalType === "approve" ? "save" : "delete",
            onClick: handleAction,

            disabled: modalType === "reject" && !remarks.trim(),
          }}
        >
          <div className="p-2">
            {/* --- Shared Summary Card --- */}
            <div className="mb-6 flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="mt-0.5 p-1.5 bg-white rounded-lg border border-slate-200 shadow-sm text-slate-400">
                <Info size={16} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Reviewing Request For
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {application.employee?.firstName}{" "}
                  {application.employee?.lastName}
                </p>
              </div>
            </div>

            {modalType === "approve" ? (
              <div className="text-center py-4 max-w-sm">
                <div className="mx-auto h-20 w-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border-4 border-emerald-100/50 shadow-inner">
                  <Check size={40} strokeWidth={3} />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Are you sure you want to approve this CTO Request?
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
                    placeholder="Please explain why this request is being declined (e.g., overlapping schedules, insufficient credits)..."
                    className={`
              w-full p-4 bg-white border-2 rounded-2xl outline-none min-h-[140px] text-sm text-slate-700 transition-all
              ${
                remarks.trim()
                  ? "border-slate-200 focus:border-blue-500"
                  : "border-rose-100 focus:border-rose-300 placeholder:text-rose-300"
              }
            `}
                  />
                  <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase ${remarks.trim() ? "text-slate-400" : "text-rose-400"}`}
                    >
                      {remarks.length > 0
                        ? `${remarks.length} chars`
                        : "Required"}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                  Tip: Providing a clear reason helps employees correct future
                  applications.
                </p>
              </div>
            )}
          </div>
        </Modal>
        {/* DOCUMENT MODAL */}
        <Modal
          isOpen={memoModal.isOpen}
          onClose={() => setMemoModal({ isOpen: false, memos: [] })}
          title="Attached Memos"
        >
          <MemoList
            memos={memoModal.memos}
            description={
              "Read-only view of CTO memos attached to this request."
            }
          />
        </Modal>
      </div>
    </div>
  );
};

export default CtoApplicationDetails;
