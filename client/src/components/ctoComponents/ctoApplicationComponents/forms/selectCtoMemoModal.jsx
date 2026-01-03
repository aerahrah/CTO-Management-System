import Modal from "../../../modal";
import { Eye, AlertTriangle } from "lucide-react";

const SelectCtoMemoModal = ({
  isOpen,
  onClose,
  memos = [],
  selectedMemos = [], // memos applied in current request
  requestedHours = 0, // total requested hours in the form
}) => {
  if (!memos) memos = [];

  // Sort memos by dateApproved ascending
  const sortedMemos = [...memos].sort(
    (a, b) => new Date(a.dateApproved) - new Date(b.dateApproved)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="View CTO Memos"
      closeLabel="Close"
    >
      <div className="max-h-[500px] overflow-y-auto relative">
        {/* Description */}
        <p className="text-md text-gray-600 mb-3 flex items-center gap-1 bg-neutral-50 p-2 rounded-sm border border-dashed border-neutral-400">
          <AlertTriangle size={20} className="text-yellow-500" />
          This is a read-only view of your CTO memos. Status indicates usage.
        </p>

        {sortedMemos.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">
            No CTO memos available
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-neutral-100 rounded-md">
            {sortedMemos.map((memo) => {
              const usedInRequest =
                selectedMemos.find((m) => m.memoId === memo.id)?.appliedHours ||
                0;

              let status = memo.status === "ACTIVE" ? "Active" : "Exhausted";

              if (usedInRequest > 0) {
                if (requestedHours >= usedInRequest) {
                  status = "Used in this request";
                } else {
                  status = "Partially used";
                }
              }

              return (
                <div
                  key={memo.id}
                  className={`bg-white border border-gray-300 rounded-md shadow-sm flex flex-col ${
                    status === "Exhausted" ? "opacity-50" : ""
                  }`}
                >
                  {/* PDF Preview */}
                  {memo.uploadedMemo.endsWith(".pdf") ? (
                    <iframe
                      src={`http://localhost:3000${memo.uploadedMemo}`}
                      title={memo.memoNo}
                      className="w-full h-40 border-b border-gray-200 rounded-t-lg"
                    />
                  ) : (
                    <div className="w-full h-40 flex items-center justify-center bg-gray-50 border-b border-gray-200 rounded-t-lg">
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
                        <p className="font-semibold text-gray-900 text-sm md:text-base">
                          {memo.memoNo}
                        </p>
                      </div>
                      <p className="text-gray-500 text-xs md:text-sm">
                        Total Hours: {memo.totalHours}
                      </p>
                      <p className="text-gray-500 text-xs md:text-sm">
                        Remaining Hours: {memo.remainingHours}
                      </p>
                      {memo.dateApproved && (
                        <p className="text-gray-500 text-xs md:text-sm">
                          Date Approved:{" "}
                          {new Date(memo.dateApproved).toLocaleDateString()}
                        </p>
                      )}
                      <p
                        className={`mt-1 text-xs md:text-sm font-semibold ${
                          status === "Exhausted"
                            ? "text-red-500"
                            : status === "Used in this request"
                            ? "text-yellow-600"
                            : status === "Partially used"
                            ? "text-orange-600"
                            : "text-green-600"
                        }`}
                      >
                        Status: {status}
                      </p>
                    </div>

                    {/* View PDF Button */}
                    <a
                      href={`http://localhost:3000${memo.uploadedMemo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-1 px-3 py-1 text-xs md:text-sm font-medium border border-gray-400 rounded text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Eye size={20} />
                      View
                    </a>
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
