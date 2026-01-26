import React from "react";
import { FileText, Calendar, ExternalLink, Info } from "lucide-react";

// Helper to check if a file is PDF
const isPdf = (url) => url?.toLowerCase().endsWith(".pdf");

const MemoList = ({ memos = [], description }) => {
  return (
    <div className="h-[calc(100vh-12rem)] overflow-y-auto  ">
      {/* Info Banner */}
      <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-3 flex items-center gap-3 text-sm text-gray-600">
        <Info size={16} className="text-gray-400" />
        <span>{description}</span>
      </div>

      {memos.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200 ">
          <p className="text-gray-400 text-sm">No documents available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 ">
          {memos.map((memo, i) => {
            const fileUrl = `http://localhost:3000/${memo.uploadedMemo}`;

            return (
              <div
                key={i}
                className="bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
              >
                {/* HEADER */}
                <div className="p-3 pb-2">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-gray-800 font-semibold text-sm">
                        <FileText size={14} className="text-gray-400" />
                        Reference Memo:{memo.memoId?.memoNo}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 ml-0.5">
                        <Calendar size={10} />
                        {memo.memoId?.dateApproved
                          ? new Date(
                              memo.memoId.dateApproved,
                            ).toLocaleDateString()
                          : "-"}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-bold border bg-blue-50 text-blue-700 border-blue-100">
                      Attached
                    </span>
                  </div>

                  {/* HOURS */}
                  <div className="flex items-stretch border border-gray-100 rounded bg-gray-50/50 mt-2">
                    <div className="flex-1 py-1.5 px-2 text-center border-r border-gray-100 bg-gray-50">
                      <span className="block text-[11px] text-gray-500 uppercase">
                        Applied Hours
                      </span>
                      <span className="text-md font-medium text-blue-700">
                        {memo.appliedHours || 0}h
                      </span>
                    </div>
                  </div>
                </div>

                {/* PREVIEW */}
                <div className="relative bg-gray-100 border-y border-gray-100 group">
                  {isPdf(fileUrl) ? (
                    <div className="h-36 w-full relative">
                      <iframe
                        src={`${fileUrl}#toolbar=0&view=FitH`}
                        className="w-full h-full"
                        title={`Memo ${memo.memoId?.memoNo}`}
                        loading="lazy"
                      />
                      {/* Hover Overlay */}
                      <a
                        href={fileUrl}
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
                    <div className="h-36 flex flex-col items-center justify-center text-gray-400 text-xs">
                      No Preview Available
                    </div>
                  )}
                </div>

                {/* FOOTER */}
                <div className="bg-white px-3 py-2 border-t border-gray-100 text-xs text-gray-500 flex justify-between items-center">
                  <span>System Attached</span>
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    View <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MemoList;
