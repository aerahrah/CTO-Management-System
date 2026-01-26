import Modal from "../../../modal";
import {
  Eye,
  AlertTriangle,
  Calendar,
  Clock,
  FileText,
  ExternalLink,
} from "lucide-react";

const SelectCtoMemoModal = ({
  isOpen,
  onClose,
  memos = [],
  selectedMemos = [], // memos applied in current request
}) => {
  if (!memos) memos = [];

  // Sort memos by dateApproved ascending (oldest first)
  const sortedMemos = [...memos].sort(
    (a, b) => new Date(a.dateApproved) - new Date(b.dateApproved),
  );

  // Function to determine badge class based on status
  const getStatusBadge = (status) => {
    const base =
      "px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-bold border";
    switch (status) {
      case "Exhausted":
        return `${base} bg-red-50 text-red-600 border-red-100`;
      case "Used in this request":
        return `${base} bg-yellow-50 text-yellow-700 border-yellow-100`;
      case "Partially used":
        return `${base} bg-orange-50 text-orange-700 border-orange-100`;
      case "Used in Application":
        return `${base} bg-blue-50 text-blue-700 border-blue-100`;
      case "Active":
      default:
        return `${base} bg-green-50 text-green-700 border-green-100`;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="View CTO Memos"
      closeLabel="Close"
      // Keeping width standard/similar to original
    >
      <div className="h-[calc(100vh-12rem)] overflow-y-auto p-1">
        {/* Compact Description Banner */}
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-3 flex items-center gap-3 text-sm text-gray-600">
          <AlertTriangle size={16} className="text-gray-400" />
          <span>
            Read-only view. Status updates automatically based on usage.
          </span>
        </div>

        {sortedMemos.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-gray-400 text-sm">No CTO memos available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedMemos.map((memo) => {
              console.log(selectedMemos);
              const appliedInRequest =
                selectedMemos.find((m) => {
                  return m.id === memo.id;
                })?.appliedHours || 0;

              const effectiveRemaining = memo.remainingHours;

              // Determine status
              let status = "Active";
              if (memo.reservedHours > 0 && appliedInRequest === 0) {
                status = "Used in Application";
              } else if (effectiveRemaining <= 0) {
                status = "Exhausted";
              } else if (appliedInRequest > 0) {
                if (appliedInRequest === memo.creditedHours)
                  status = "Used in this request";
                else status = "Partially used";
              }

              return (
                <div
                  key={memo.id}
                  className="bg-white border border-gray-300 rounded-lg shadow-md hover:shadow-md transition-shadow flex flex-col overflow-hidden"
                >
                  {/* Card Header: Details */}
                  <div className="p-3 pb-2">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-gray-800 font-semibold text-sm">
                          <FileText size={14} className="text-gray-400" />
                          {memo.memoNo}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 ml-0.5">
                          <Calendar size={10} />
                          {memo.dateApproved
                            ? new Date(memo.dateApproved).toLocaleDateString()
                            : "-"}
                        </div>
                      </div>
                      <span className={getStatusBadge(status)}>{status}</span>
                    </div>

                    {/* Data Grid: Credited vs Remaining */}
                    <div className="flex items-stretch border border-gray-100 rounded bg-gray-50/50 mt-2">
                      <div className="flex-1 py-1.5 px-2 text-center border-r border-gray-100">
                        <span className="block text-[10px] text-gray-500 uppercase">
                          Credited
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {memo.creditedHours}h
                        </span>
                      </div>
                      <div className="flex-1 py-1.5 px-2 text-center border-r border-gray-100 bg-gray-50">
                        <span className="block text-[10px] text-gray-500 uppercase">
                          Used
                        </span>
                        <span
                          className={`text-sm font-bold ${memo.usedHours > 0 ? "text-amber-600" : "text-gray-400"}`}
                        >
                          {memo.usedHours}h
                        </span>
                      </div>
                      <div className="flex-1 py-1.5 px-2 text-center bg-white">
                        <span className="block text-[10px] text-gray-500 uppercase">
                          Remaining
                        </span>
                        <span
                          className={`text-sm font-bold ${effectiveRemaining > 0 ? "text-green-600" : "text-gray-400"}`}
                        >
                          {effectiveRemaining}h
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PDF Preview Area */}
                  <div className="relative bg-gray-100 border-y border-gray-100 group">
                    {memo.uploadedMemo?.endsWith(".pdf") ? (
                      <div className="h-36 w-full relative">
                        <iframe
                          src={`http://localhost:3000${memo.uploadedMemo}#toolbar=0&view=FitH`}
                          className="w-full h-full"
                          title={memo.memoNo}
                          loading="lazy"
                        />
                        {/* Hover overlay to open PDF */}
                        <a
                          href={`http://localhost:3000${memo.uploadedMemo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 bg-white/0 group-hover:bg-white/60 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                        >
                          <span className="flex items-center gap-1 text-xs font-semibold bg-white border border-gray-300 px-2 py-1 rounded shadow-sm text-gray-700">
                            <ExternalLink size={12} /> Open PDF
                          </span>
                        </a>
                      </div>
                    ) : (
                      <div className="h-36 flex flex-col items-center justify-center text-gray-400">
                        <span className="text-xs">No Preview</span>
                      </div>
                    )}
                  </div>

                  {/* Footer Context (Warnings/Usage) */}
                  {appliedInRequest > 0 || memo.reservedHours > 0 ? (
                    <div className="bg-yellow-50 px-3 py-2 border-t border-yellow-100">
                      {appliedInRequest > 0 && (
                        <div className="flex justify-between text-xs text-yellow-800">
                          <span>Applied in request:</span>
                          <span className="font-bold">
                            {appliedInRequest} hrs
                          </span>
                        </div>
                      )}
                      {memo.reservedHours > 0 && appliedInRequest === 0 && (
                        <div className="flex justify-between text-xs text-blue-700">
                          <span>Reserved elsewhere:</span>
                          <span className="font-medium">
                            {memo.reservedHours} hrs
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Empty spacer if no warnings to keep card heights somewhat consistent
                    <div className="h-2 bg-white"></div>
                  )}
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
