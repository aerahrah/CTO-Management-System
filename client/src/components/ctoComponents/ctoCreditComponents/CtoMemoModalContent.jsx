// CtoMemoModalContent.jsx
import React, { memo, useMemo } from "react";
import { FileText, Clipboard, Calendar, ExternalLink } from "lucide-react";

/**
 * CTO Memo Modal Content
 * Fix: NO overlay on iframe (so PDF is scrollable)
 * UX: "View PDF" button placed beside Status badge (and optional in footer)
 */
const CtoMemoModalContent = memo(function CtoMemoModalContent({
  memo,
  baseUrl = "http://localhost:3000",
  emptyState = "No memo selected",
  bannerText = "Read-only view. Status updates automatically based on usage.",
  // Optional: show a 2nd button at the bottom
  showBottomViewPdf = false,
}) {
  const normalizeBase = useMemo(
    () => String(baseUrl || "").replace(/\/$/, ""),
    [baseUrl],
  );

  const statusMeta = useMemo(() => {
    if (!memo) return { label: "", className: "" };

    const exhausted = (memo.remainingHours ?? 0) <= 0;
    const used = (memo.usedHours ?? 0) > 0;
    const reserved = (memo.reservedHours ?? 0) > 0;
    const fullyUsed =
      used && Number(memo.usedHours) === Number(memo.creditedHours);

    let label = "Active";
    let className = "bg-green-50 text-green-700 border-green-100";

    if (exhausted) {
      label = "Exhausted";
      className = "bg-red-50 text-red-600 border-red-100";
    } else if (used) {
      if (fullyUsed) {
        label = "Used in this request";
        className = "bg-amber-50 text-amber-700 border-amber-100";
      } else {
        label = "Partially used";
        className = "bg-orange-50 text-orange-700 border-orange-100";
      }
    } else if (reserved) {
      label = "Used in Application";
      className = "bg-blue-50 text-blue-700 border-blue-100";
    }

    return { label, className };
  }, [memo]);

  const pdf = useMemo(() => {
    if (!memo?.uploadedMemo) return { isPdf: false, src: null, href: null };

    const raw = String(memo.uploadedMemo);
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    const href = `${normalizeBase}${path}`;
    const isPdf = raw.toLowerCase().endsWith(".pdf");

    // Keep it scrollable; no overlay on top of iframe
    const src = isPdf
      ? `${href}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`
      : null;

    return { isPdf, src, href };
  }, [memo?.uploadedMemo, normalizeBase]);

  if (!memo) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-400 text-sm bg-gray-50 border border-dashed rounded-lg">
        <FileText size={28} className="mb-2 opacity-40" />
        {emptyState}
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-2">
      {/* Compact Description Banner */}
      <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-3 flex items-center gap-3 text-sm text-gray-600">
        <Clipboard size={16} className="text-gray-400" />
        <span>{bannerText}</span>
      </div>

      {/* Memo Card */}
      <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-3 pb-2">
          <div className="flex justify-between items-start mb-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-gray-800 font-semibold text-sm">
                <FileText size={14} className="text-gray-400" />
                {memo.memoNo || "-"}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 ml-0.5">
                <Calendar size={10} />
                {memo.dateApproved
                  ? new Date(memo.dateApproved).toLocaleDateString()
                  : "-"}
              </div>
            </div>

            {/* Status + View PDF button */}
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-bold border ${statusMeta.className}`}
              >
                {statusMeta.label}
              </span>

              {pdf.isPdf && pdf.href && (
                <a
                  href={pdf.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 bg-white text-gray-700
                             text-[11px] font-semibold hover:bg-gray-50"
                  title="Open PDF in a new tab"
                >
                  <ExternalLink size={12} />
                  View PDF
                </a>
              )}
            </div>
          </div>

          {/* Hours Grid */}
          <div className="flex items-stretch border border-gray-100 rounded bg-gray-50/50 mt-2">
            <div className="flex-1 py-1.5 px-2 text-center border-r border-gray-100">
              <span className="block text-[10px] text-gray-500 uppercase">
                Credited
              </span>
              <span className="text-sm font-medium text-gray-700">
                {memo.creditedHours || 0}h
              </span>
            </div>
            <div className="flex-1 py-1.5 px-2 text-center border-r border-gray-100 bg-white">
              <span className="block text-[10px] text-gray-500 uppercase">
                Used
              </span>
              <span className="text-sm font-medium text-amber-600">
                {memo.usedHours || 0}h
              </span>
            </div>
            <div className="flex-1 py-1.5 px-2 text-center bg-white">
              <span className="block text-[10px] text-gray-500 uppercase">
                Remaining
              </span>
              <span
                className={`text-sm font-bold ${
                  (memo.remainingHours || 0) > 0
                    ? "text-green-600"
                    : "text-gray-400"
                }`}
              >
                {memo.remainingHours || 0}h
              </span>
            </div>
          </div>
        </div>

        {/* PDF Preview (scrollable) */}
        <div className="relative bg-gray-100 border-y border-gray-100">
          {pdf.isPdf && pdf.src ? (
            <div className="h-64 md:h-80 w-full relative">
              <iframe
                src={pdf.src}
                className="w-full h-full"
                title={memo.memoNo || "Memo PDF"}
                loading="lazy"
              />
            </div>
          ) : (
            <div className="h-36 flex flex-col items-center justify-center text-gray-400">
              <span className="text-xs">No Preview</span>
            </div>
          )}
        </div>

        {/* Footer Warnings + optional bottom button */}
        <div className="bg-white">
          {(memo.usedHours || 0) > 0 || (memo.reservedHours || 0) > 0 ? (
            <div className="bg-yellow-50 px-3 py-2 border-t border-yellow-100">
              {(memo.usedHours || 0) > 0 && (
                <div className="flex justify-between text-xs text-yellow-800">
                  <span>Used in request:</span>
                  <span className="font-bold">{memo.usedHours} hrs</span>
                </div>
              )}
              {(memo.reservedHours || 0) > 0 && (memo.usedHours || 0) === 0 && (
                <div className="flex justify-between text-xs text-blue-700">
                  <span>Reserved in a pending Application:</span>
                  <span className="font-medium">{memo.reservedHours} hrs</span>
                </div>
              )}
            </div>
          ) : (
            <div className="h-2" />
          )}

          {showBottomViewPdf && pdf.isPdf && pdf.href && (
            <div className="px-3 pb-3">
              <a
                href={pdf.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded border border-gray-300
                           bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                <ExternalLink size={14} />
                View PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CtoMemoModalContent;
