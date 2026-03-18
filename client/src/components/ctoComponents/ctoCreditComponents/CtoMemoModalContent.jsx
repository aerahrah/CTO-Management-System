// CtoMemoModalContent.jsx
import React, { memo, useMemo } from "react";
import { FileText, Clipboard, Calendar, ExternalLink } from "lucide-react";
import { API_BASE_URL } from "../../../config/env";

/**
 * CTO Memo Modal Content
 * Dark mode aligned with app theme vars
 * - no hardcoded white/gray surfaces
 * - soft borders via --app-border
 * - semantic colors only for states / usage
 * - iframe remains scrollable
 */
const ui = {
  bg: "var(--app-bg, #f8fafc)",
  surface: "var(--app-surface, #ffffff)",
  surface2: "var(--app-surface-2, #f8fafc)",
  text: "var(--app-text, #0f172a)",
  muted: "var(--app-muted, #64748b)",
  border: "var(--app-border, rgba(15,23,42,0.10))",
  borderSoft: "rgba(15,23,42,0.06)",
  accent: "var(--accent, #2563eb)",
  accentSoft: "var(--accent-soft, rgba(37,99,235,0.10))",
  accentSoft2: "var(--accent-soft2, rgba(37,99,235,0.18))",
};

const tone = {
  green: {
    bg: "rgba(34,197,94,0.14)",
    text: "#16a34a",
    border: "rgba(34,197,94,0.20)",
  },
  red: {
    bg: "rgba(239,68,68,0.14)",
    text: "#dc2626",
    border: "rgba(239,68,68,0.20)",
  },
  amber: {
    bg: "rgba(245,158,11,0.16)",
    text: "#d97706",
    border: "rgba(245,158,11,0.22)",
  },
  orange: {
    bg: "rgba(249,115,22,0.16)",
    text: "#ea580c",
    border: "rgba(249,115,22,0.22)",
  },
  blue: {
    bg: "rgba(37,99,235,0.12)",
    text: "var(--accent, #2563eb)",
    border: "var(--accent-soft2, rgba(37,99,235,0.18))",
  },
  neutral: {
    bg: "var(--app-surface-2, #f8fafc)",
    text: "var(--app-muted, #64748b)",
    border: "var(--app-border, rgba(15,23,42,0.10))",
  },
};

const CtoMemoModalContent = memo(function CtoMemoModalContent({
  memo,
  baseUrl = API_BASE_URL,
  emptyState = "No memo selected",
  bannerText = "Read-only view. Status updates automatically based on usage.",
  showBottomViewPdf = false,
}) {
  const normalizeBase = useMemo(
    () => String(baseUrl || "").replace(/\/$/, ""),
    [baseUrl],
  );

  const statusMeta = useMemo(() => {
    if (!memo) return { label: "", styles: tone.neutral };

    const exhausted = (memo.remainingHours ?? 0) <= 0;
    const used = (memo.usedHours ?? 0) > 0;
    const reserved = (memo.reservedHours ?? 0) > 0;
    const fullyUsed =
      used && Number(memo.usedHours) === Number(memo.creditedHours);

    if (exhausted) {
      return { label: "Exhausted", styles: tone.red };
    }
    if (used) {
      if (fullyUsed) {
        return { label: "Used in this request", styles: tone.amber };
      }
      return { label: "Partially used", styles: tone.orange };
    }
    if (reserved) {
      return { label: "Used in Application", styles: tone.blue };
    }
    return { label: "Active", styles: tone.green };
  }, [memo]);

  const pdf = useMemo(() => {
    if (!memo?.uploadedMemo) return { isPdf: false, src: null, href: null };

    const raw = String(memo.uploadedMemo);
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    const href = `${normalizeBase}${path}`;
    const isPdf = raw.toLowerCase().endsWith(".pdf");

    const src = isPdf
      ? `${href}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`
      : null;

    return { isPdf, src, href };
  }, [memo?.uploadedMemo, normalizeBase]);

  if (!memo) {
    return (
      <div
        className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-sm transition-colors duration-300 ease-out"
        style={{
          backgroundColor: ui.surface2,
          borderColor: ui.border,
          color: ui.muted,
        }}
      >
        <FileText size={28} className="mb-2 opacity-40" />
        {emptyState}
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-2">
      {/* Compact Description Banner */}
      <div
        className="mb-4 flex items-center gap-3 rounded-md border p-3 text-sm transition-colors duration-300 ease-out"
        style={{
          backgroundColor: ui.surface2,
          borderColor: ui.border,
          color: ui.muted,
        }}
      >
        <Clipboard size={16} style={{ color: ui.muted }} />
        <span>{bannerText}</span>
      </div>

      {/* Memo Card */}
      <div
        className="overflow-hidden rounded-lg border shadow-sm transition-colors duration-300 ease-out"
        style={{
          backgroundColor: ui.surface,
          borderColor: ui.border,
        }}
      >
        {/* Header */}
        <div className="p-3 pb-2">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div
                className="flex items-center gap-1.5 text-sm font-semibold transition-colors duration-300 ease-out"
                style={{ color: ui.text }}
              >
                <FileText size={14} style={{ color: ui.muted }} />
                {memo.memoNo || "-"}
              </div>

              <div
                className="ml-0.5 mt-0.5 flex items-center gap-1 text-xs transition-colors duration-300 ease-out"
                style={{ color: ui.muted }}
              >
                <Calendar size={10} />
                {memo.dateApproved
                  ? new Date(memo.dateApproved).toLocaleDateString()
                  : "-"}
              </div>
            </div>

            {/* Status + View PDF */}
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: statusMeta.styles.bg,
                  color: statusMeta.styles.text,
                  borderColor: statusMeta.styles.border,
                }}
              >
                {statusMeta.label}
              </span>

              {pdf.isPdf && pdf.href && (
                <a
                  href={pdf.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition-colors duration-200 ease-out"
                  style={{
                    borderColor: ui.border,
                    backgroundColor: ui.surface,
                    color: ui.muted,
                  }}
                  title="Open PDF in a new tab"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = ui.surface2;
                    e.currentTarget.style.color = ui.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = ui.surface;
                    e.currentTarget.style.color = ui.muted;
                  }}
                >
                  <ExternalLink size={12} />
                  View PDF
                </a>
              )}
            </div>
          </div>

          {/* Hours Grid */}
          <div
            className="mt-2 flex items-stretch rounded border transition-colors duration-300 ease-out"
            style={{
              backgroundColor: ui.surface2,
              borderColor: ui.borderSoft,
            }}
          >
            <div
              className="flex-1 border-r px-2 py-1.5 text-center transition-colors duration-300 ease-out"
              style={{ borderColor: ui.borderSoft }}
            >
              <span
                className="block text-[10px] uppercase transition-colors duration-300 ease-out"
                style={{ color: ui.muted }}
              >
                Credited
              </span>
              <span
                className="text-sm font-medium transition-colors duration-300 ease-out"
                style={{ color: ui.text }}
              >
                {memo.creditedHours || 0}h
              </span>
            </div>

            <div
              className="flex-1 border-r px-2 py-1.5 text-center transition-colors duration-300 ease-out"
              style={{
                borderColor: ui.borderSoft,
                backgroundColor: ui.surface,
              }}
            >
              <span
                className="block text-[10px] uppercase transition-colors duration-300 ease-out"
                style={{ color: ui.muted }}
              >
                Used
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: "#d97706" }}
              >
                {memo.usedHours || 0}h
              </span>
            </div>

            <div
              className="flex-1 px-2 py-1.5 text-center transition-colors duration-300 ease-out"
              style={{ backgroundColor: ui.surface }}
            >
              <span
                className="block text-[10px] uppercase transition-colors duration-300 ease-out"
                style={{ color: ui.muted }}
              >
                Remaining
              </span>
              <span
                className="text-sm font-bold transition-colors duration-300 ease-out"
                style={{
                  color: (memo.remainingHours || 0) > 0 ? "#16a34a" : ui.muted,
                }}
              >
                {memo.remainingHours || 0}h
              </span>
            </div>
          </div>
        </div>

        {/* PDF Preview */}
        <div
          className="relative border-y transition-colors duration-300 ease-out"
          style={{
            backgroundColor: ui.surface2,
            borderColor: ui.borderSoft,
          }}
        >
          {pdf.isPdf && pdf.src ? (
            <div className="relative h-64 w-full md:h-80">
              <iframe
                src={pdf.src}
                className="h-full w-full"
                title={memo.memoNo || "Memo PDF"}
                loading="lazy"
                style={{ backgroundColor: ui.surface }}
              />
            </div>
          ) : (
            <div
              className="flex h-36 flex-col items-center justify-center transition-colors duration-300 ease-out"
              style={{ color: ui.muted }}
            >
              <span className="text-xs">No Preview</span>
            </div>
          )}
        </div>

        {/* Footer notices + optional bottom button */}
        <div style={{ backgroundColor: ui.surface }}>
          {(memo.usedHours || 0) > 0 || (memo.reservedHours || 0) > 0 ? (
            <div
              className="border-t px-3 py-2 transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "rgba(245,158,11,0.10)",
                borderColor: "rgba(245,158,11,0.16)",
              }}
            >
              {(memo.usedHours || 0) > 0 && (
                <div
                  className="flex justify-between text-xs"
                  style={{ color: "#92400e" }}
                >
                  <span>Used in request:</span>
                  <span className="font-bold">{memo.usedHours} hrs</span>
                </div>
              )}

              {(memo.reservedHours || 0) > 0 && (memo.usedHours || 0) === 0 && (
                <div
                  className="flex justify-between text-xs"
                  style={{ color: ui.accent }}
                >
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
                className="inline-flex w-full items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-semibold transition-colors duration-200 ease-out"
                style={{
                  borderColor: ui.border,
                  backgroundColor: ui.surface,
                  color: ui.muted,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = ui.surface2;
                  e.currentTarget.style.color = ui.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ui.surface;
                  e.currentTarget.style.color = ui.muted;
                }}
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
