import React, { useState } from "react";
import { Clock, FileText, BadgeCheck, Calendar, Check } from "lucide-react";
import { getStatusStyles, StatusIcon, StatusBadge } from "../../statusUtils";
import { useAuth } from "../../../store/authStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Modal from "../../modal";
import {
  approveApplicationRequest,
  rejectApplicationRequest,
} from "../../../api/cto";
import { CustomButton } from "../../customButton";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

// Skeleton Component
const CtoApplicationDetailsSkeleton = () => {
  return (
    <div className="border-gray-200 p-4 space-y-4">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:justify-between gap-2 mb-4">
        <div className="space-y-2">
          <Skeleton width={240} height={24} />
          <Skeleton width={180} height={16} />
        </div>
        <div className="flex gap-2">
          <Skeleton width={100} height={36} />
          <Skeleton width={100} height={36} />
        </div>
      </div>

      <div className="h-136 pr-2 overflow-y-auto">
        <div className="flex items-center gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
          <Skeleton circle width={48} height={48} />
          <div className="flex-1 space-y-1">
            <Skeleton width={120} height={14} />
            <Skeleton width={80} height={12} />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <Skeleton width={100} height={14} />
            <Skeleton width={60} height={18} className="mt-2" />
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <Skeleton width={140} height={14} />
            <Skeleton width={60} height={18} className="mt-2" />
          </div>
        </div>

        {/* Reason */}
        <div className="bg-gray-50 p-3 rounded-lg mb-6">
          <Skeleton width={80} height={14} />
          <Skeleton width="100%" height={60} className="mt-2" />
        </div>

        {/* Approval Steps */}
        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white p-3 rounded-lg"
            >
              <Skeleton circle width={32} height={32} />
              <div className="flex-1 space-y-1">
                <Skeleton width={120} height={12} />
                <Skeleton width={80} height={10} />
              </div>
              <Skeleton width={60} height={20} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main Component
const CtoApplicationDetails = ({ application, isLoading, onSelect }) => {
  const { admin } = useAuth();
  const queryClient = useQueryClient();
  const [isProcessed, setIsProcessed] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: (applicationId) => approveApplicationRequest(applicationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries(["ctoApplicationsApprovals"]);
      setIsProcessed(true);
      setIsModalOpen(false);
      alert("Application approved successfully.");
    },
    onError: (error) =>
      alert(error.message || "Failed to approve application."),
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: ({ applicationId, remarks }) =>
      rejectApplicationRequest(applicationId, remarks),
    onSuccess: async () => {
      await queryClient.invalidateQueries(["ctoApplicationsApprovals"]);
      setRemarks("");
      setIsProcessed(true);
      setIsModalOpen(false);
      alert("Application rejected successfully.");
    },
    onError: (error) => alert(error.message || "Failed to reject application."),
  });

  // Show skeleton when loading or no application
  if (isLoading || !application) {
    return <CtoApplicationDetailsSkeleton />;
  }

  const initials = `${application.employee?.firstName?.[0] || ""}${
    application.employee?.lastName?.[0] || ""
  }`;
  const formattedDate = application.createdAt
    ? new Date(application.createdAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Unknown date";

  const currentStep = application.approvals?.find(
    (step) => step.approver?._id === admin?.id
  );

  const canApproveOrReject = currentStep?.status === "PENDING" && !isProcessed;

  return (
    <div className="border-gray-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 pb-3 border-b border-gray-100 gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            CTO Application Details
          </h2>
          <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
            <Calendar className="h-4 w-4" />
            <span>Submitted at: {formattedDate}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canApproveOrReject ? (
            <>
              <CustomButton
                label={approveMutation.isPending ? "Approving..." : "Approve"}
                onClick={() => {
                  setModalType("approve");
                  setIsModalOpen(true);
                }}
                className="w-32"
                disabled={approveMutation.isPending}
                variant="success"
              />
              <CustomButton
                label={rejectMutation.isPending ? "Rejecting..." : "Reject"}
                onClick={() => {
                  setModalType("reject");
                  setIsModalOpen(true);
                }}
                className="w-32"
                disabled={rejectMutation.isPending}
                variant="danger"
              />
            </>
          ) : (
            <CustomButton
              label="Already Processed"
              disabled
              icon={<Check className="h-4 w-4" />}
              variant="disabled"
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="h-136 pr-2 overflow-y-auto">
        {/* Applicant Info */}
        <div className="flex items-center gap-4 mb-6 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-700 font-semibold text-lg">
            {initials || "?"}
          </div>
          <div>
            <h3 className="text-gray-800 font-semibold text-base">
              {application.employee?.firstName} {application.employee?.lastName}
            </h3>
            <p className="text-sm text-gray-500">
              {application.employee?.position || "No position listed"}
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
              <Clock className="h-4 w-4 text-gray-500" />
              Requested Hours
            </div>
            <p className="text-gray-800 font-semibold text-lg">
              {application.requestedHours} hrs
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
              <BadgeCheck className="h-4 w-4 text-gray-500" />
              Overall Application Status
            </div>
            <StatusBadge status={application.overallStatus} size="md" />
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-2 bg-gray-50 p-3 rounded-lg mb-6">
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <FileText className="h-4 w-4 text-gray-500" />
            Reason
          </div>
          <p className="text-gray-700 text-sm leading-relaxed bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            {application.reason || "No reason provided."}
          </p>
        </div>

        {/* Approval Steps */}
        <div className="space-y-3 bg-gray-50 rounded-lg p-3">
          <h3 className="text-gray-700 font-medium mb-2">Approval Progress</h3>
          <div className="flex flex-col gap-3">
            {application.approvals?.length > 0 ? (
              application.approvals.map((step, index) => (
                <div
                  key={step._id || index}
                  className="border border-gray-200 bg-white rounded-lg p-3 flex justify-between items-center hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 flex items-center justify-center rounded-full border ${getStatusStyles(
                        step.status
                      )}`}
                    >
                      <StatusIcon status={step.status} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        Level {step.level}: {step.approver?.firstName}{" "}
                        {step.approver?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {step.approver?.position || "No position"}
                      </p>
                    </div>
                  </div>
                  <StatusBadge showIcon={false} status={step.status} />
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm italic">
                No approval steps available.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal for Approve/Reject */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === "approve"
            ? "Confirm Approval"
            : "Reject Application Confirmation"
        }
        closeLabel="Cancel"
        action={{
          show: true,
          label: modalType === "approve" ? "Approve" : "Reject",
          variant: modalType === "approve" ? "success" : "cancel",
          onClick: () => {
            if (modalType === "approve") {
              approveMutation.mutate(application._id);
            } else {
              if (!remarks.trim()) {
                alert("Please enter remarks before rejecting.");
                return;
              }
              rejectMutation.mutate({
                applicationId: application._id,
                remarks,
              });
            }
          },
        }}
      >
        {modalType === "approve" ? (
          <p className="text-gray-600">
            Are you sure you want to <b>approve</b> this application?
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-gray-600">
              Please provide your remarks for rejecting this application:
            </p>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter remarks..."
              className="w-full p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
              rows={4}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CtoApplicationDetails;
