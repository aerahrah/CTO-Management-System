import React from "react";
import { FileText, ExternalLink, Info, Clock } from "lucide-react";
import { buildApiUrl } from "../../config/env";

/* =========================
   Helpers
========================= */
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Returns "" when there is no valid date, so the date line can be hidden
const fmtDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : DATE_FMT.format(d);
};

const fmtHours = (h) => {
  const n = Number(h ?? 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

// Ignore query strings / hashes when checking the file type
const extOf = (url) =>
  String(url || "")
    .split(/[?#]/)[0]
    .toLowerCase();

const isPdf = (url) => extOf(url).endsWith(".pdf");
const isImage = (url) => /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(extOf(url));

const BORDER = "var(--app-border, rgba(15,23,42,0.10))";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]";

/* =========================
   Layout by count
========================= */
// 1 memo  -> one wide card: details on the left, a large preview on the right
// 2+      -> two columns at most (2 x 2, 2 x 3, ...); one column on phones
const layoutFor = (count) => (count <= 1 ? "single" : "pair");

const GRID_CLASS = {
  single: "grid grid-cols-1",
  pair: "grid grid-cols-1 sm:grid-cols-2 gap-4",
};

const PREVIEW_HEIGHT = {
  single: "h-64 sm:h-80 md:h-full md:min-h-[22rem]",
  pair: "h-52",
};

/* =========================
   Preview (PDF / image / other)
========================= */
const MemoPreview = ({ fileUrl, memoNo, heightClass }) => {
  const base = `relative w-full ${heightClass}`;

  if (!fileUrl) {
    return (
      <div
        className={`${base} flex flex-col items-center justify-center gap-1 text-xs`}
        style={{ color: "var(--app-muted)" }}
      >
        <FileText size={20} />
        No file attached
      </div>
    );
  }

  if (isPdf(fileUrl)) {
    return (
      <div className={`${base} group`}>
        <iframe
          src={`${fileUrl}#toolbar=0&view=FitH`}
          className="w-full h-full block"
          title={`Memo ${memoNo}`}
          loading="lazy"
        />
        {/* Clicking anywhere on the preview opens the full PDF */}
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open memo ${memoNo} in a new tab`}
          className={`absolute inset-0 flex items-center justify-center cursor-pointer transition-colors duration-150 bg-transparent group-hover:bg-[color:color-mix(in_srgb,var(--app-surface)_55%,transparent)] ${FOCUS_RING}`}
        >
          <span
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border shadow-sm opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: BORDER,
              color: "var(--app-text)",
            }}
          >
            <ExternalLink size={12} /> Open PDF
          </span>
        </a>
      </div>
    );
  }

  if (isImage(fileUrl)) {
    return (
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open memo ${memoNo} in a new tab`}
        className={`${base} block cursor-zoom-in ${FOCUS_RING}`}
      >
        <img
          src={fileUrl}
          alt={`Memo ${memoNo}`}
          loading="lazy"
          className="w-full h-full object-contain"
        />
      </a>
    );
  }

  return (
    <div
      className={`${base} flex flex-col items-center justify-center gap-2 text-xs`}
      style={{ color: "var(--app-muted)" }}
    >
      <FileText size={20} />
      No preview available
    </div>
  );
};

/* =========================
   Memo card
========================= */
const MemoCard = ({ memo, layout }) => {
  const memoNo = memo?.memoId?.memoNo || "—";
  const approved = fmtDate(memo?.memoId?.dateApproved);
  const fileUrl = memo?.uploadedMemo ? buildApiUrl(memo.uploadedMemo) : "";
  const isSingle = layout === "single";

  return (
    <article
      className={`rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col ${
        // Single memo: details column on the left, preview fills the right
        isSingle
          ? "md:grid md:grid-cols-[18rem_minmax(0,1fr)] md:grid-rows-[1fr_auto]"
          : ""
      }`}
      style={{ backgroundColor: "var(--app-surface)", borderColor: BORDER }}
    >
      {/* DETAILS */}
      <div
        className={`p-4 min-w-0 ${isSingle ? "md:border-r" : ""}`}
        style={{ borderColor: BORDER }}
      >
        <div className="flex items-start justify-between gap-3">
          {/* min-w-0 lets long memo numbers wrap instead of pushing the badge */}
          <div className="min-w-0 flex-1">
            <div
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--app-muted)" }}
            >
              Reference Memo
            </div>
            <div
              className="mt-0.5 flex items-start gap-1.5 text-sm font-semibold leading-snug"
              style={{ color: "var(--app-text)" }}
            >
              <FileText
                size={14}
                className="flex-none mt-[3px]"
                style={{ color: "var(--accent)" }}
              />
              <span
                className="min-w-0 [overflow-wrap:anywhere] line-clamp-2"
                title={memoNo}
              >
                {memoNo}
              </span>
            </div>
            {approved && (
              <div
                className="mt-1 text-xs truncate"
                style={{ color: "var(--app-muted)" }}
              >
                {approved}
              </div>
            )}
          </div>

          <span
            className="flex-none px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide font-bold border"
            style={{
              backgroundColor: "var(--accent-soft)",
              color: "var(--accent)",
              borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
            }}
          >
            Attached
          </span>
        </div>

        {/* HOURS */}
        <div
          className="mt-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          style={{
            backgroundColor: "var(--app-surface-2)",
            borderColor: BORDER,
          }}
        >
          <span
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: "var(--app-muted)" }}
          >
            <Clock size={12} className="flex-none" />
            Applied Hours
          </span>
          <span
            className="text-base font-bold tabular-nums"
            style={{ color: "var(--accent)" }}
          >
            {fmtHours(memo?.appliedHours)}h
          </span>
        </div>
      </div>

      {/* PREVIEW */}
      <div
        className={`border-y ${
          isSingle
            ? "md:border-y-0 md:col-start-2 md:row-start-1 md:row-span-2"
            : ""
        }`}
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor: BORDER,
        }}
      >
        <MemoPreview
          fileUrl={fileUrl}
          memoNo={memoNo}
          heightClass={PREVIEW_HEIGHT[layout]}
        />
      </div>

      {/* FOOTER */}
      <div
        className={`mt-auto px-4 py-2.5 flex items-center justify-between gap-3 text-xs ${
          isSingle
            ? "md:mt-0 md:col-start-1 md:row-start-2 md:border-r md:border-t"
            : ""
        }`}
        style={{ color: "var(--app-muted)", borderColor: BORDER }}
      >
        <span className="truncate">System Attached</span>
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-none inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-all duration-150 text-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] hover:brightness-90 active:scale-95 ${FOCUS_RING}`}
          >
            View <ExternalLink size={12} />
          </a>
        )}
      </div>
    </article>
  );
};

/* =========================
   List
========================= */
const MemoList = ({ memos = [], description }) => {
  const list = Array.isArray(memos) ? memos : [];
  const layout = layoutFor(list.length);
  const totalHours = list.reduce(
    (sum, m) => sum + (Number(m?.appliedHours) || 0),
    0,
  );

  return (
    // max-h (not a fixed h) so the modal shrinks to fit when there are few memos
    <div className="max-h-[calc(100vh-12rem)] overflow-y-auto cto-scrollbar pr-1">
      {/* Info Banner */}
      <div
        className="mb-4 rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor: BORDER,
          color: "var(--app-muted)",
        }}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <Info size={16} className="flex-none mt-0.5" />
          <span className="min-w-0">{description}</span>
        </div>

        {list.length > 0 && (
          <span
            className="flex-none self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: BORDER,
              color: "var(--app-text)",
            }}
          >
            {list.length} memo{list.length === 1 ? "" : "s"}
            <span style={{ color: "var(--app-muted)" }}>·</span>
            <span style={{ color: "var(--accent)" }}>
              {fmtHours(totalHours)}h applied
            </span>
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <div
          className="text-center py-12 rounded-lg border border-dashed"
          style={{
            backgroundColor: "var(--app-surface-2)",
            borderColor: BORDER,
          }}
        >
          <FileText
            size={24}
            className="mx-auto mb-2"
            style={{ color: "var(--app-muted)" }}
          />
          <p className="text-sm" style={{ color: "var(--app-muted)" }}>
            No documents available
          </p>
        </div>
      ) : (
        <div className={GRID_CLASS[layout]}>
          {list.map((memo, i) => (
            <MemoCard
              key={memo?._id || memo?.memoId?._id || i}
              memo={memo}
              layout={layout}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MemoList;
