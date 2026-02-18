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
  XCircle,
  AlertCircle,
  Info,
  Ban,
  CheckCircle2,
  Users,
  History,
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
import { buildApiUrl } from "../../../config/env";

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

/* =========================
   Status helpers (CANCELLED-aware)
========================= */
const STATUS_META = {
  APPROVED: { label: "APPROVED", tone: "emerald" },
  REJECTED: { label: "REJECTED", tone: "rose" },
  PENDING: { label: "PENDING", tone: "amber" },
  CANCELLED: { label: "CANCELLED", tone: "slate" },
};

const getToneClasses = (tone) => {
  switch (tone) {
    case "emerald":
      return {
        pill: "bg-emerald-50 text-emerald-700 border-emerald-100",
        chip: "bg-emerald-50 text-emerald-700",
        iconWrap: "bg-emerald-50 text-emerald-600",
      };
    case "rose":
      return {
        pill: "bg-rose-50 text-rose-700 border-rose-100",
        chip: "bg-rose-50 text-rose-700",
        iconWrap: "bg-rose-50 text-rose-600",
      };
    case "slate":
      return {
        pill: "bg-slate-50 text-slate-700 border-slate-200",
        chip: "bg-slate-50 text-slate-700",
        iconWrap: "bg-slate-50 text-slate-600",
      };
    case "amber":
    default:
      return {
        pill: "bg-amber-50 text-amber-700 border-amber-100",
        chip: "bg-amber-50 text-amber-700",
        iconWrap: "bg-amber-50 text-amber-600",
      };
  }
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

  const sortedApprovals = useMemo(() => {
    if (!Array.isArray(application?.approvals)) return [];
    return [...application.approvals].sort(
      (a, b) => (a.level || 0) - (b.level || 0),
    );
  }, [application?.approvals]);

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

  // ✅ currentStep find should be robust: id can be string or objectId-like
  const currentStep = application.approvals?.find(
    (step) => String(step.approver?._id) === String(admin?.id),
  );

  // ✅ Only allow action if:
  // - my step is PENDING
  // - app overallStatus is PENDING
  // - not locally processed
  const canApproveOrReject =
    currentStep?.status === "PENDING" &&
    application.overallStatus === "PENDING" &&
    !isProcessed;

  const overallMeta =
    STATUS_META[application.overallStatus] || STATUS_META.PENDING;
  const overallTone = getToneClasses(overallMeta.tone);

  return (
    <div className="flex-1 h-full border border-gray-200 bg-white rounded-xl shadow-md w-full flex flex-col gap-2 max-w-6xl mx-auto min-w-0 border-b-26 border-neutral-50/50">
      {/* HEADER */}
      <header className="flex md:rounded-t-xl flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-300 backdrop-blur supports-[backdrop-filter]:bg-white px-3 sm:px-4 py-2 z-10">
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

                {/* ✅ show overallStatus chip (CANCELLED-aware) */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${overallTone.pill}`}
                  title="Overall Status"
                >
                  {application.overallStatus === "CANCELLED" ? (
                    <Ban size={12} />
                  ) : null}
                  {application.overallStatus}
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
          <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 sm:p-6 text-white flex gap-3 justify-between items-center relative overflow-hidden shadow-sm shadow-blue-100 min-w-0">
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
                <p className="text-xl font-bold">
                  {application.requestedHours} Hours
                </p>
              </div>
            </div>
          </div>

          {/* ✅ Global Status card now supports CANCELLED visuals */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center text-center gap-4 min-w-0">
            <div
              className={`p-4 rounded-2xl ${
                application.overallStatus === "APPROVED"
                  ? "bg-emerald-50 text-emerald-600"
                  : application.overallStatus === "REJECTED"
                    ? "bg-rose-50 text-rose-600"
                    : application.overallStatus === "CANCELLED"
                      ? "bg-slate-50 text-slate-600"
                      : "bg-amber-50 text-amber-600"
              }`}
            >
              {application.overallStatus === "CANCELLED" ? (
                <Ban size={28} className="h-6 w-6" />
              ) : (
                <StatusIcon
                  status={application.overallStatus}
                  size={32}
                  className="h-6 w-6"
                />
              )}
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
                <h3 className="text-sm font-bold text-gray-900">
                  Purpose of Leave
                </h3>
              </div>

              <p className="text-gray-700 leading-relaxed italic bg-gray-50 p-4 rounded-2xl border border-gray-100 break-words">
                "
                {application.reason ||
                  "No specific reason provided by the applicant."}
                "
              </p>
            </section>

            {/* ✅ Processing Timeline copied from the basis */}
            <section className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm min-w-0">
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
                <div className="relative space-y-6 sm:space-y-8 t-1 min-w-0">
                  {/* background spine */}
                  <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-100" />

                  {sortedApprovals.map((approval, idx) => (
                    <TimelineCard
                      key={approval?._id || idx}
                      approval={approval}
                      index={idx}
                      isLast={idx === sortedApprovals.length - 1}
                    />
                  ))}

                  {/* Success State End of Timeline */}
                  {String(application.overallStatus || "").toUpperCase() ===
                    "APPROVED" && (
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
                        href={buildApiUrl(m.uploadedMemo)}
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
          maxWidth="max-w-lg"
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
