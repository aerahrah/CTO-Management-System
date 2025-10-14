import React from "react";
import { Clock, FileText, User, BadgeCheck, Calendar } from "lucide-react";
import { getStatusStyles, StatusIcon, StatusBadge } from "../../statusUtils";

const CtoApplicationDetails = ({ application }) => {
  if (!application) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic border rounded-xl bg-gray-50 shadow-inner h-[80vh]">
        Select an application to view details
      </div>
    );
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

  return (
    <div className="border-gray-200 ">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 pb-3 border-b border-gray-100 gap-2">
        <div>
          <h2 className="text-xl font-semibold text-gray-700">
            CTO Application Details
          </h2>
          <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
            <Calendar className="h-4 w-4" />
            <span>Submitted at: {formattedDate}</span>
          </div>
        </div>

        <span
          className={`px-3 py-1 text-sm font-medium rounded-full border self-start md:self-auto ${getStatusStyles(
            application.overallStatus
          )}`}
        >
          {application.overallStatus}
        </span>
      </div>

      <div className="h-136 pr-2 overflow-y-auto">
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

        {/* Quick Summary */}
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
              Application Status
            </div>
            <p
              className={`text-base font-semibold ${
                {
                  APPROVED: "text-green-700",
                  REJECTED: "text-red-700",
                }[application.overallStatus] || "text-yellow-700"
              }`}
            >
              {application.overallStatus}
            </p>
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
    </div>
  );
};

export default CtoApplicationDetails;
