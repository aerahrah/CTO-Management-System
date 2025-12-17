// src/components/cto/CtoApplicationDetails.jsx

import { useState } from "react";
import { StatusBadge, StatusIcon, getStatusStyles } from "../../statusUtils";
import Modal from "../../modal";
const CtoApplicationDetails = ({ app }) => {
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  if (!app) return null;

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const formatInclusiveDates = (dates) =>
    dates?.map((d) => new Date(d).toLocaleDateString("en-US")).join(", ");

  const openMemoModal = (memos) => setMemoModal({ isOpen: true, memos });

  return (
    <div className="space-y-4 max-h-120 rounded-lg overflow-y-auto bg-neutral-100 p-2">
      {/* Application Info */}
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">
          📄 Application Summary
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 text-sm text-gray-700">
          <div className="flex flex-col">
            <label className="text-gray-500 font-medium mb-1">Reason</label>
            <div className="relative">
              <textarea
                readOnly
                value={app.reason || "N/A"}
                className="w-full h-[8rem] p-2 bg-neutral-50/50 rounded-lg border border-gray-300 text-gray-800 font-medium resize-none overflow-y-auto focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          </div>

          <div>
            <p className="text-gray-500 font-medium">Requested Hours</p>
            <p className="font-semibold text-gray-800 mt-0.5">
              {app.requestedHours} hour(s)
            </p>
          </div>

          <div>
            <p className="text-gray-500 font-medium mb-1">Overall Status</p>
            <StatusBadge className="tracking-wide" status={app.overallStatus} />
          </div>

          <div>
            <p className="text-gray-500 font-medium">Date Submitted</p>
            <p className="font-semibold text-gray-800 mt-0.5">
              {formatDate(app.createdAt)}
            </p>
          </div>

          <div>
            <p className="text-gray-500 font-medium">Inclusive Dates</p>
            <p className="font-semibold text-gray-800 mt-0.5">
              {formatInclusiveDates(app.inclusiveDates) || "N/A"}
            </p>
          </div>

          <div>
            <p className="text-gray-500 font-medium">Memos</p>
            {app.memo?.length > 0 ? (
              <button
                className="text-blue-600 underline text-sm mt-1"
                onClick={() => openMemoModal(app.memo)}
              >
                View Memos ({app.memo.length})
              </button>
            ) : (
              <span className="text-gray-400 text-sm mt-1">No memos</span>
            )}
          </div>
        </div>
      </div>

      {/* Approvals Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          👥 Approval Progress
        </h3>

        {app.approvals?.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {app.approvals.map((a) => (
              <li
                key={a._id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 flex items-center justify-center rounded-full border ${getStatusStyles(
                      a.status
                    )}`}
                  >
                    <StatusIcon status={a.status} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {a.approver?.firstName} {a.approver?.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {a.approver?.position || "N/A"}
                    </p>
                  </div>
                </div>
                <span className="mt-2 sm:mt-0 inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wide">
                  <StatusBadge showIcon={false} status={a.status} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm italic">No approvers yet</p>
        )}
      </div>

      {/* Memo Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memos: [] })}
        title="Memos Used in CTO Application"
        closeLabel="Close"
      >
        <div className="max-h-[500px] overflow-y-auto relative">
          {memoModal.memos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">
              No memos available
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-neutral-100 rounded-md">
              {memoModal.memos.map((memo, i) => (
                <div
                  key={i}
                  className="bg-white border border-gray-300 rounded-md shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* PDF Preview */}
                  {memo.uploadedMemo?.endsWith(".pdf") ? (
                    <iframe
                      src={`http://localhost:3000${memo.uploadedMemo}`}
                      title={memo.memoId?.memoNo || `Memo ${i + 1}`}
                      className="w-full h-40 border-b border-gray-200 rounded-t-md"
                    />
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center bg-gray-50 border-b border-gray-200 rounded-t-md">
                      <p className="text-gray-400 text-sm">
                        No Preview Available
                      </p>
                    </div>
                  )}

                  {/* Memo Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="mb-3">
                      <div className="flex gap-1 font-semibold">
                        <p>Memo: </p>
                        <p className="text-gray-900 text-sm md:text-base">
                          {memo.memoId?.memoNo || "—"}
                        </p>
                      </div>
                      <p className="text-gray-500 text-xs md:text-sm">
                        Hours: {memo.memoId?.totalHours || "—"}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between gap-2 mt-auto">
                      <a
                        href={`http://localhost:3000${memo.uploadedMemo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-1 px-3 py-1 text-xs md:text-sm font-medium border border-gray-400 rounded hover:bg-gray-100 transition-colors justify-center"
                      >
                        View
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default CtoApplicationDetails;
