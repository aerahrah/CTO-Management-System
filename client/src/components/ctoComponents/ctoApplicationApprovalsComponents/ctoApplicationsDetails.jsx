import React, { useEffect, useMemo, useState } from "react";
import {
  Clock,
  FileText,
  BadgeCheck,
  CalendarDays,
  Check,
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
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import MemoList from "../ctoMemoModal";

/* =========================
   LOADING SKELETON (FULL SCREEN INSIDE CARD)
========================= */
const CtoApplicationDetailsSkeleton = () => (
  <div className="flex-1 h-full bg-white rounded-xl shadow-md w-full flex flex-col gap-4 max-w-6xl mx-auto min-w-0">
    {/* header */}
    <div className="px-3 sm:px-4 py-2 border-b border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Skeleton height={48} width={48} borderRadius={12} />
          <div className="min-w-0 flex-1">
            <Skeleton height={18} width={"60%"} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Skeleton height={18} width={120} borderRadius={6} />
              <Skeleton height={18} width={140} borderRadius={6} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton height={40} width={110} borderRadius={10} />
          <Skeleton height={40} width={160} borderRadius={10} />
        </div>
      </div>
    </div>

    {/* body */}
    <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton height={140} borderRadius={16} className="md:col-span-2" />
        <Skeleton height={140} borderRadius={16} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton height={190} borderRadius={16} />
          <Skeleton height={360} borderRadius={16} />
        </div>
        <aside className="space-y-6">
          <Skeleton height={280} borderRadius={16} />
        </aside>
      </div>
    </div>
  </div>
);

/* =========================
   MEDIA HOOK
========================= */
function useIsXlUp() {
  const [isXlUp, setIsXlUp] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1280px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = (e) => setIsXlUp(e.matches);

    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return isXlUp;
}

const CtoApplicationDetails = () => {
  const { admin } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isXlUp = useIsXlUp();

  const [isProcessed, setIsProcessed] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  const {
    data: application,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: ["ctoApplication", admin?.id, id],
    queryFn: () => getCtoApplicationById(id),
    enabled: !!admin?.id && !!id,
  });

  // ✅ IMPORTANT: keep hooks above any early return
  const requestedDatesLabel = useMemo(() => {
    const dates = application?.inclusiveDates || [];
    if (!dates.length) return "No dates set";
    return dates
      .map((d) =>
        new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      )
      .join(", ");
  }, [application?.inclusiveDates]);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (applicationId) => approveApplicationRequest(applicationId),
    onSuccess: () => {
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

  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  const handleAction = () => {
    if (!application) return;
    if (isMutating) return;

    if (modalType === "approve") {
      approveMutation.mutate(application._id);
    } else {
      if (!remarks.trim()) return toast.error("Please provide a reason.");
      rejectMutation.mutate({
        applicationId: application._id,
        remarks,
      });
    }
  };

  useEffect(() => {
    setIsProcessed(false);
    setRemarks("");
  }, [application]);

  // --------- EARLY RETURNS (safe now) ----------
  if (isLoading) return <CtoApplicationDetailsSkeleton />;
  if (isError) return <p>Error: {error?.message}</p>;

  if (!application)
    return (
      <div className="flex flex-col items-center justify-center py-40 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200 m-4 sm:m-6">
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
    <div className="flex-1 h-full border border-gray-200  bg-white rounded-xl shadow-md w-full flex flex-col gap-2 max-w-6xl mx-auto min-w-0 border-b-26 border-neutral-50/50">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-300 sticky top-2 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 px-3 sm:px-4 py-2 z-10">
        {/* Mobile/Tablet back */}
        {!isXlUp && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/app/cto/approvals")}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 underline"
            >
              Back to list
            </button>

            {isFetching && (
              <span className="text-[11px] text-gray-400 font-medium">
                Updating…
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg flex-none">
              {initials}
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">
                {application.employee?.firstName}{" "}
                {application.employee?.lastName}
              </h2>

              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 font-medium mt-0.5">
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
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2 bg-gray-50 md:bg-transparent rounded-xl w-full md:w-auto">
          {canApproveOrReject ? (
            <>
              <button
                onClick={() => {
                  setModalType("reject");
                  setIsModalOpen(true);
                }}
                className="w-full sm:w-auto flex-1 md:flex-none px-4 bg-gray-200 py-2 rounded-lg text-gray-600 hover:bg-gray-300 font-semibold"
              >
                Reject
              </button>

              <button
                onClick={() => {
                  setModalType("approve");
                  setIsModalOpen(true);
                }}
                disabled={approveMutation.isPending}
                className="w-full sm:w-auto bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition shadow-sm font-medium flex items-center justify-center gap-2"
              >
                {approveMutation.isPending
                  ? "Processing..."
                  : "Approve Request"}
              </button>
            </>
          ) : (
            <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center gap-2 text-sm font-bold border border-emerald-100 w-full sm:w-auto">
              <BadgeCheck size={18} /> Action Completed
            </div>
          )}
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex h-full flex-1 min-h-0 overflow-y-auto flex-col gap-4 px-3 sm:px-4 py-2">
        {/* QUICK STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
          <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 sm:p-6 text-white flex justify-between items-center relative overflow-hidden shadow-sm shadow-blue-100 min-w-0">
            <CalendarDays className="absolute right-[-20px] top-[-20px] h-40 w-40 text-white/10 rotate-12" />
            <div className="min-w-0">
              <p className="text-blue-50 text-xs font-bold uppercase tracking-widest mb-1">
                Requested Dates
              </p>
              <h3 className="text-xl md:text-2xl font-bold break-words">
                {requestedDatesLabel}
              </h3>
            </div>

            <div className="flex items-center gap-4 flex-none">
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

          <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center text-center gap-4 min-w-0">
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

            <div className="text-start min-w-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Global Status
              </p>
              <p className="text-xl font-black text-gray-900 break-words">
                {application.overallStatus}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
          {/* MAIN */}
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-0">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 flex-none">
                  <MessageCircle size={20} />
                </div>
                <h3 className="font-bold text-gray-900">Purpose of Leave</h3>
              </div>

              <p className="text-gray-700 leading-relaxed italic bg-gray-50 p-4 rounded-2xl border border-gray-100 break-words">
                "
                {application.reason ||
                  "No specific reason provided by the applicant."}
                "
              </p>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-0">
              <div className="flex items-center gap-3 mb-8">
                <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 flex-none">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="font-bold text-gray-900">Approval Progress</h3>
              </div>

              <div className="relative space-y-6 sm:space-y-8 left-1 sm:left-2 min-w-0">
                <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-100" />

                {application.approvals?.map((step, idx) => (
                  <div
                    key={idx}
                    className="relative flex gap-4 sm:gap-6 items-start group min-w-0"
                  >
                    <div
                      className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-4 border-white shadow-md transition-transform group-hover:scale-110 flex-none
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

                    <div className="flex-1 bg-white border border-gray-100 p-4 sm:p-5 rounded-2xl group-hover:border-blue-200 transition-all shadow-sm min-w-0">
                      <div className="flex items-start justify-between gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900 break-words">
                            Level {step.level}: {step.approver?.firstName}{" "}
                            {step.approver?.lastName}
                          </p>
                          <p className="text-xs text-gray-500 font-medium break-words">
                            {step.approver?.position}
                          </p>
                        </div>

                        <div className="flex-none">
                          <StatusBadge status={step.status} size="sm" />
                        </div>
                      </div>

                      {step.remarks && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 flex items-start gap-2 min-w-0">
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <p className="break-words">
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
          <aside className="space-y-6 min-w-0">
            <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm min-w-0">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center justify-between gap-2 min-w-0">
                <span className="truncate">Supporting Memos</span>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-none">
                  {application.memo?.length || 0}
                </span>
              </h4>

              <div className="space-y-3">
                {application.memo?.length > 0 ? (
                  application.memo.slice(0, 3).map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white transition-all min-w-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center text-red-500 shadow-sm flex-none">
                          <FileText size={16} />
                        </div>
                        <p className="text-xs font-bold truncate min-w-0">
                          Memo {m.memoId?.memoNo}
                        </p>
                      </div>

                      <a
                        href={`http://localhost:3000${m.uploadedMemo}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors flex-none"
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
          </aside>
        </div>

        {/* MODALS */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            modalType === "approve" ? "Confirm Approval" : "Decline Request"
          }
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
          <div className="p-2">
            <div className="mb-6 flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="mt-0.5 p-1.5 bg-white rounded-lg border border-slate-200 shadow-sm text-slate-400">
                <Info size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Reviewing Request For
                </p>
                <p className="text-sm font-bold text-slate-900 break-words">
                  {application.employee?.firstName}{" "}
                  {application.employee?.lastName}
                </p>
              </div>
            </div>

            {modalType === "approve" ? (
              <div className="text-center py-4 max-w-sm mx-auto">
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
                      w-full p-4 bg-white border-2 rounded-2xl outline-none min-h-[140px]
                      text-sm text-slate-700 transition-all
                      ${
                        remarks.trim()
                          ? "border-slate-200 focus:border-blue-500"
                          : "border-rose-100 focus:border-rose-300 placeholder:text-rose-300"
                      }
                    `}
                  />
                  <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        remarks.trim() ? "text-slate-400" : "text-rose-400"
                      }`}
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
