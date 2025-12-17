import Modal from "../../../modal";
import { Eye, AlertTriangle } from "lucide-react";

const SelectCtoMemoModal = ({
  isOpen,
  onClose,
  memos = [],
  onSelect,
  selectedMemos = [],
}) => {
  if (!memos) memos = [];

  // Sort memos by dateApproved ascending (oldest first)
  const sortedMemos = [...memos].sort(
    (a, b) => new Date(a.dateApproved) - new Date(b.dateApproved)
  );

  // Determine which memo is selectable next
  const nextSelectableIndex = selectedMemos.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select CTO Memo"
      closeLabel="Cancel"
    >
      <div className="max-h-[500px] overflow-y-auto relative">
        {/* Description */}
        <p className="text-md text-gray-600 mb-3 flex items-center gap-1 bg-neutral-50 p-2 rounded-sm border border-dashed border-neutral-400">
          <AlertTriangle size={20} className="text-yellow-500" />
          Select memos in order, starting from the oldest approved memo. Others
          are reference only.
        </p>

        {sortedMemos.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">
            No CTO memos available
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-neutral-100 rounded-md">
            {sortedMemos.map((memo, index) => {
              const remainingHours = memo.totalHours - (memo.appliedHours || 0);
              const isLocked = remainingHours <= 0;
              const isSelectable = index === nextSelectableIndex && !isLocked;

              return (
                <div
                  key={memo.id}
                  className={`bg-white border border-gray-300 rounded-md shadow-sm hover:shadow-lg transition-shadow duration-100 flex flex-col ${
                    !isSelectable || isLocked ? "opacity-50" : ""
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
                        Applied Hours: {memo.appliedHours || 0}
                      </p>
                      {memo.dateApproved && (
                        <p className="text-gray-500 text-xs md:text-sm">
                          Date Approved:{" "}
                          {new Date(memo.dateApproved).toLocaleDateString()}
                        </p>
                      )}
                      {isLocked && (
                        <p className="text-red-500 text-xs md:text-sm mt-1">
                          No remaining hours
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between gap-2 mt-auto">
                      <a
                        href={`http://localhost:3000${memo.uploadedMemo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-full flex items-center gap-1 px-3 py-1 text-xs md:text-sm font-medium border border-gray-400 rounded transition-colors ${
                          !isSelectable || isLocked
                            ? "cursor-not-allowed pointer-events-none opacity-50"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <Eye size={20} />
                        View
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          if (isSelectable) {
                            console.log(memo);
                            onSelect(memo); // parent updates selected memos
                          } else {
                            window.alert(
                              isLocked
                                ? "This memo has no remaining hours!"
                                : "You must select the oldest memo first!"
                            );
                          }
                        }}
                        className={`px-3 py-1 max-w-[100%] w-full text-xs md:text-sm font-medium bg-neutral-900 cursor-pointer text-white rounded transition-colors ${
                          !isSelectable || isLocked
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-neutral-900/90"
                        }`}
                      >
                        Select
                      </button>
                    </div>
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
