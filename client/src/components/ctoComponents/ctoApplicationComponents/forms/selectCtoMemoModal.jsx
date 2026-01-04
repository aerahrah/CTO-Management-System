import Modal from "../../../modal";
import { Eye, AlertTriangle } from "lucide-react";

const SelectCtoMemoModal = ({
  isOpen,
  onClose,
  memos = [],
  selectedMemos = [], // memos applied in current request
}) => {
  if (!memos) memos = [];

  // Sort memos by dateApproved ascending (oldest first)
  const sortedMemos = [...memos].sort(
    (a, b) => new Date(a.dateApproved) - new Date(b.dateApproved)
  );

  // Function to determine badge class based on status
  const getStatusBadge = (status) => {
    const base = "px-2 py-0.5 rounded-full text-xs font-semibold";
    switch (status) {
      case "Exhausted":
        return `${base} bg-red-100 text-red-600`;
      case "Used in this request":
        return `${base} bg-yellow-100 text-yellow-800`;
      case "Partially used":
        return `${base} bg-orange-100 text-orange-700`;
      case "Used in Application":
        return `${base} bg-blue-100 text-blue-700`;
      case "Active":
      default:
        return `${base} bg-green-100 text-green-700`;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="View CTO Memos"
      closeLabel="Close"
    >
      <div className="max-h-[500px] overflow-y-auto relative">
        {/* Description */}
        <p className="text-sm text-gray-600 mb-4 flex items-center gap-2 bg-yellow-50 p-3 rounded border border-dashed border-yellow-300">
          <AlertTriangle size={20} className="text-yellow-500" />
          Read-only view of your CTO memos. Status shows usage.
        </p>

        {sortedMemos.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">
            No CTO memos available
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedMemos.map((memo) => {
              const appliedInRequest =
                selectedMemos.find((m) => m.memoId === memo.id)?.appliedHours ||
                0;

              // Use backend-provided remainingHours and reservedHours
              const effectiveRemaining = memo.remainingHours;

              // Determine status
              let status = "Active"; // default
              if (memo.reservedHours > 0 && appliedInRequest === 0) {
                status = "Used in Application"; // already reserved elsewhere
              } else if (effectiveRemaining <= 0) {
                status = "Exhausted"; // no remaining hours
              } else if (appliedInRequest > 0) {
                if (appliedInRequest === memo.creditedHours)
                  status = "Used in this request";
                // fully applied in this request
                else status = "Partially used"; // partially applied
              }

              return (
                <div
                  key={memo.id}
                  className="bg-white border border-gray-200 rounded-xl shadow hover:shadow-md transition p-4 flex flex-col"
                >
                  {/* PDF Preview */}
                  <div className="w-full h-40 rounded-lg overflow-hidden mb-3 bg-gray-50 border border-gray-200 flex items-center justify-center">
                    {memo.uploadedMemo?.endsWith(".pdf") ? (
                      <iframe
                        src={`http://localhost:3000${memo.uploadedMemo}`}
                        title={memo.memoNo}
                        className="w-full h-full"
                      />
                    ) : (
                      <p className="text-gray-400 text-sm">
                        No Preview Available
                      </p>
                    )}
                  </div>

                  {/* Memo Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">
                          {memo.memoNo}
                        </p>
                        <span className={getStatusBadge(status)}>{status}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Credited Hours: {memo.creditedHours}
                      </p>
                      <p className="text-xs text-gray-500">
                        Remaining Hours: {effectiveRemaining}
                      </p>
                      {memo.reservedHours > 0 && (
                        <p className="text-xs text-gray-500">
                          Reserved Hours: {memo.reservedHours}
                        </p>
                      )}
                      {memo.dateApproved && (
                        <p className="text-xs text-gray-500">
                          Approved:{" "}
                          {new Date(memo.dateApproved).toLocaleDateString()}
                        </p>
                      )}
                      {appliedInRequest > 0 && (
                        <p className="text-xs text-gray-700 font-medium">
                          Applied in current request: {appliedInRequest}h
                        </p>
                      )}
                    </div>

                    {/* View PDF Button */}
                    {memo.uploadedMemo && (
                      <a
                        href={`http://localhost:3000${memo.uploadedMemo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition"
                      >
                        <Eye size={16} />
                        View PDF
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SelectCtoMemoModal;
