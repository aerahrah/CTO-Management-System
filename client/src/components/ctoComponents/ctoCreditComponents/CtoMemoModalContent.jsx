import React, { memo, useMemo, useState } from "react";
import {
  FileText,
  Calendar,
  CalendarCheck,
  ExternalLink,
  Info,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { API_BASE_URL } from "../../../config/env";

/**
 * CTO Memo Modal Content
 * - theme aware via CSS vars
 * - compact single-title header
 * - fixed height: header/hours stay put, only the PDF scrolls (inside the iframe)
 * - PDF + image preview
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

/* =========================
   HELPERS
========================= */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// 4.666666 -> "4.67", 8 -> "8"
const fmtHours = (v) => `${Number(toNum(v).toFixed(2))}`;

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

const formatOvertimeDates = (start, end) => {
  if (!start && !end) return "-";
  const s = formatDate(start);
  const e = formatDate(end || start);
  return s === e ? s : `${s} – ${e}`;
};

const getFileKind = (path = "") => {
  const p = String(path).toLowerCase();
  if (p.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|gif|webp)$/.test(p)) return "image";
  return "other";
};

/* =========================
   SMALL UI
========================= */
const MetaChip = ({ icon: Icon, label, children }) => (
  <span
    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] whitespace-nowrap"
    style={{
      backgroundColor: ui.surface2,
      borderColor: ui.border,
      color: ui.muted,
    }}
  >
    <Icon size={11} className="shrink-0" />
    {label && <span>{label}</span>}
    <span className="font-semibold" style={{ color: ui.text }}>
      {children}
    </span>
  </span>
);

const HourCell = ({ label, value, color, highlight, first, title }) => (
  <div
    className="min-w-0 flex-1 px-2 py-1.5 text-center"
    style={{
      borderLeft: first ? undefined : `1px solid ${ui.borderSoft}`,
      backgroundColor: highlight || "transparent",
    }}
    title={title}
  >
    <span
      className="block truncate text-[10px] font-bold uppercase tracking-wider"
      style={{ color: ui.muted }}
    >
      {label}
    </span>
    <span
      className="text-sm font-extrabold tabular-nums"
      style={{ color: color || ui.text }}
    >
      {fmtHours(value)}h
    </span>
  </div>
);

const UsageBar = ({ used, reserved, total }) => {
  const t = toNum(total);
  const usedPct = t > 0 ? Math.min((toNum(used) / t) * 100, 100) : 0;
  const reservedPct =
    t > 0 ? Math.min((toNum(reserved) / t) * 100, 100 - usedPct) : 0;

  return (
    <div
      className="flex h-1 w-full overflow-hidden"
      style={{ backgroundColor: ui.surface2 }}
      role="img"
      aria-label={`${fmtHours(used)}h used, ${fmtHours(reserved)}h reserved of ${fmtHours(total)}h`}
    >
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${usedPct}%`, backgroundColor: tone.amber.text }}
      />
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${reservedPct}%`, backgroundColor: ui.accent }}
      />
    </div>
  );
};

/* =========================
   MAIN
========================= */
const CtoMemoModalContent = memo(function CtoMemoModalContent({
  memo,
  baseUrl = API_BASE_URL,
  emptyState = "No memo selected",
  bannerText = "Read-only view. Status updates automatically based on usage.",
  showBottomViewPdf = false,
  showTitle = true, // set false if the modal header already shows the memo no.
  height = "min(72vh, 720px)", // total height; the PDF fills what's left
}) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const normalizeBase = useMemo(
    () => String(baseUrl || "").replace(/\/$/, ""),
    [baseUrl],
  );

  const hours = useMemo(
    () => ({
      credited: toNum(memo?.creditedHours),
      used: toNum(memo?.usedHours),
      reserved: toNum(memo?.reservedHours),
      remaining: toNum(memo?.remainingHours),
      forfeited: toNum(memo?.forfeitedHours),
    }),
    [memo],
  );

  const statusMeta = useMemo(() => {
    if (!memo) return { label: "", styles: tone.neutral };

    const exhausted = hours.remaining <= 0;
    const used = hours.used > 0;
    const reserved = hours.reserved > 0;
    const fullyUsed = used && Math.abs(hours.used - hours.credited) < 0.01;

    if (exhausted) return { label: "Exhausted", styles: tone.red };
    if (used) {
      return fullyUsed
        ? { label: "Used in this request", styles: tone.amber }
        : { label: "Partially used", styles: tone.orange };
    }
    if (reserved) return { label: "Used in Application", styles: tone.blue };
    return { label: "Active", styles: tone.green };
  }, [memo, hours]);

  const file = useMemo(() => {
    if (!memo?.uploadedMemo) return { kind: "none", src: null, href: null };

    const raw = String(memo.uploadedMemo).replace(/\\/g, "/");
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    const href = `${normalizeBase}${path}`;
    const kind = getFileKind(raw);

    const src =
      kind === "pdf"
        ? `${href}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`
        : kind === "image"
          ? href
          : null;

    return { kind, src, href };
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

  const hasPreview = file.kind === "pdf" || file.kind === "image";
  const previewOpen = hasPreview && showPreview;
  const fileLabel = file.kind === "image" ? "View Image" : "View PDF";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(memo.memoNo || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const OpenFileLink = ({ full = false }) => (
    <a
      href={file.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border font-semibold transition-colors duration-200 ease-out ${
        full ? "w-full px-3 py-2 text-sm" : "px-2 py-1 text-[11px]"
      }`}
      style={{
        borderColor: ui.border,
        backgroundColor: ui.surface,
        color: ui.muted,
      }}
      title="Open in a new tab"
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = ui.surface2;
        e.currentTarget.style.color = ui.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = ui.surface;
        e.currentTarget.style.color = ui.muted;
      }}
    >
      <ExternalLink size={full ? 14 : 12} />
      {fileLabel}
    </a>
  );

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border shadow-sm transition-colors duration-300 ease-out"
      style={{
        backgroundColor: ui.surface,
        borderColor: ui.border,
        // Fixed height only when the preview is open, so the PDF can fill it
        height: previewOpen ? height : undefined,
      }}
    >
      {/* ================= HEADER (fixed) ================= */}
      <div className="shrink-0 px-3 pt-2.5 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {showTitle && (
              <div className="flex items-center gap-1 min-w-0">
                <h3
                  className="min-w-0 truncate text-sm font-bold leading-tight"
                  style={{ color: ui.text }}
                  title={memo.memoNo}
                >
                  {memo.memoNo || "-"}
                </h3>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 rounded p-0.5 transition-colors"
                  style={{ color: copied ? tone.green.text : ui.muted }}
                  title={copied ? "Copied!" : "Copy memo no."}
                  aria-label="Copy memo no."
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            )}

            <div
              className={`flex flex-wrap items-center gap-1.5 ${
                showTitle ? "mt-1.5" : ""
              }`}
            >
              <MetaChip icon={Calendar} label="Rendered">
                {formatOvertimeDates(
                  memo.inclusiveDates?.startDate,
                  memo.inclusiveDates?.endDate,
                )}
              </MetaChip>
              <MetaChip icon={CalendarCheck} label="Approved">
                {formatDate(memo.dateApproved)}
              </MetaChip>
            </div>
          </div>

          <span
            className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors duration-300 ease-out"
            style={{
              backgroundColor: statusMeta.styles.bg,
              color: statusMeta.styles.text,
              borderColor: statusMeta.styles.border,
            }}
          >
            {statusMeta.label}
          </span>
        </div>

        {/* ================= HOURS ================= */}
        <div
          className="mt-2 overflow-hidden rounded-lg border"
          style={{ borderColor: ui.borderSoft }}
        >
          <div
            className="flex items-stretch"
            style={{ backgroundColor: ui.surface2 }}
          >
            <HourCell first label="Credited" value={hours.credited} />
            <HourCell
              label="Used"
              value={hours.used}
              color={hours.used > 0 ? tone.amber.text : ui.muted}
              highlight={hours.used > 0 ? tone.amber.bg : undefined}
            />
            {hours.reserved > 0 && (
              <HourCell
                label="Reserved"
                value={hours.reserved}
                color={ui.accent}
                highlight={ui.accentSoft}
                title="Reserved in a pending application"
              />
            )}
            <HourCell
              label="Remaining"
              value={hours.remaining}
              color={hours.remaining > 0 ? tone.green.text : ui.muted}
            />
            {hours.forfeited > 0 && (
              <HourCell
                label="Forfeited"
                value={hours.forfeited}
                color={tone.red.text}
                title="Lost due to CSC limits"
              />
            )}
          </div>
          {hours.credited > 0 && (
            <UsageBar
              used={hours.used}
              reserved={hours.reserved}
              total={hours.credited}
            />
          )}
        </div>
      </div>

      {/* ================= PREVIEW (fills remaining height) ================= */}
      <div
        className={`flex flex-col border-t transition-colors duration-300 ease-out ${
          previewOpen ? "flex-1 min-h-0" : "shrink-0"
        }`}
        style={{ backgroundColor: ui.surface2, borderColor: ui.borderSoft }}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
          <span
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: ui.muted }}
          >
            <FileText size={12} />
            Memo File
          </span>
          {file.href && (
            <div className="flex items-center gap-1.5">
              {hasPreview && (
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold"
                  style={{ color: ui.muted }}
                  aria-expanded={showPreview}
                >
                  {showPreview ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                  {showPreview ? "Hide" : "Show"}
                </button>
              )}
              {!showBottomViewPdf && <OpenFileLink />}
            </div>
          )}
        </div>

        {previewOpen && (
          <div className="flex-1 min-h-[220px] px-2 pb-2">
            {file.kind === "pdf" ? (
              // The iframe is the scroll container — scrollbar stays inside the PDF
              <iframe
                src={file.src}
                className="block h-full w-full rounded-md border"
                title={memo.memoNo || "Memo PDF"}
                loading="lazy"
                style={{
                  backgroundColor: ui.surface,
                  borderColor: ui.borderSoft,
                }}
              />
            ) : (
              <div
                className="h-full w-full overflow-auto rounded-md border custom-scrollbar"
                style={{
                  backgroundColor: ui.surface,
                  borderColor: ui.borderSoft,
                }}
              >
                <img
                  src={file.src}
                  alt={memo.memoNo || "Memo"}
                  loading="lazy"
                  className="mx-auto block h-auto max-w-full"
                />
              </div>
            )}
          </div>
        )}

        {!hasPreview && (
          <div
            className="mx-2 mb-2 flex h-20 flex-col items-center justify-center rounded-md border border-dashed"
            style={{ borderColor: ui.border, color: ui.muted }}
          >
            <Info size={16} className="mb-1 opacity-50" />
            <span className="text-xs">
              {file.href
                ? "Preview not available for this file type"
                : "No memo file attached"}
            </span>
          </div>
        )}
      </div>

      {/* ================= FOOTER (fixed) ================= */}
      {(showBottomViewPdf && file.href) || bannerText ? (
        <div
          className="shrink-0 space-y-2 border-t px-3 py-1.5"
          style={{ borderColor: ui.borderSoft, backgroundColor: ui.surface }}
        >
          {showBottomViewPdf && file.href && <OpenFileLink full />}
          {bannerText && (
            <p
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: ui.muted }}
            >
              <Info size={11} className="shrink-0" />
              {bannerText}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
});

export default CtoMemoModalContent;
