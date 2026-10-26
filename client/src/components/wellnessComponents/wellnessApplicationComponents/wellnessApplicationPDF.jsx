import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Path,
} from "@react-pdf/renderer";

import { buildApiUrl } from "../../../config/env";

/* =========================
   Helpers
========================= */
function fmtDateLong(d) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateShort(d) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toMidnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatInclusiveDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return "";

  const sorted = dates
    .map((x) => toMidnight(x))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (sorted.length === 0) return "";

  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];

  const isNextDay = (a, b) => {
    const dayMs = 24 * 60 * 60 * 1000;
    return toMidnight(b).getTime() - toMidnight(a).getTime() === dayMs;
  };

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    if (isNextDay(end, cur)) {
      end = cur;
    } else {
      ranges.push([start, end]);
      start = cur;
      end = cur;
    }
  }
  ranges.push([start, end]);

  const monthLong = (d) => d.toLocaleDateString("en-US", { month: "long" });
  const monthShort = (d) => d.toLocaleDateString("en-US", { month: "short" });

  const fmtRange = (s, e) => {
    const sameDay = s.getTime() === e.getTime();
    const sameMonth =
      s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    const sameYear = s.getFullYear() === e.getFullYear();

    if (sameDay) {
      return `${monthLong(s)} ${s.getDate()}, ${s.getFullYear()}`;
    }
    if (sameMonth) {
      return `${monthLong(s)} ${s.getDate()}-${e.getDate()}, ${s.getFullYear()}`;
    }
    if (sameYear) {
      return `${monthShort(s)} ${s.getDate()} - ${monthShort(e)} ${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${monthShort(s)} ${s.getDate()}, ${s.getFullYear()} - ${monthShort(e)} ${e.getDate()}, ${e.getFullYear()}`;
  };

  return ranges.map(([s, e]) => fmtRange(s, e)).join(", ");
}

function safeNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function safeImageUrl(url) {
  if (!url) return null;
  return url.startsWith("http") ? url : buildApiUrl(url);
}

// ✅ Helper to construct full names with prefixes, extensions, and postfixes
function getFullApproverName(profile) {
  if (!profile) return "";
  const pre = profile.prefixTitle ? `${profile.prefixTitle} ` : "";
  const f = profile.firstName || "";
  const m = profile.middleName ? ` ${profile.middleName.charAt(0)}.` : "";
  const l = profile.lastName ? ` ${profile.lastName}` : "";
  const ext = profile.nameExtension ? ` ${profile.nameExtension}` : "";
  const post = profile.postfixTitle ? `, ${profile.postfixTitle}` : "";

  return `${pre}${f}${m}${l}${ext}${post}`.toUpperCase();
}

/* =========================
   Text measurement
   Long values are wrapped here, before rendering, so every line is known to
   fit inside its box: text always continues on the next line when it reaches
   the right edge instead of running into the next column, nothing is ever
   cut off, and the layout below can work out how tall the page will be.
========================= */
const LINE_HEIGHT = 1.25; // the page's line height
const lineH = (size) => size * LINE_HEIGHT;
const WRAP_SAFETY = 1.5; // points kept free at the end of each line

// Helvetica / Helvetica-Bold glyph widths (1/1000 em) for ASCII 32–126 (standard AFM metrics).
// prettier-ignore
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
// prettier-ignore
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

function glyphUnits(ch, bold) {
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  let code = ch.charCodeAt(0);
  if (code < 32 || code > 126) {
    // Accented letters (ñ, é…) are as wide as their base letter.
    code = ch.normalize("NFD").charCodeAt(0);
    if (code < 32 || code > 126) return 1000; // unknown glyph: assume the widest
  }
  return table[code - 32];
}

function textWidth(str, size, bold = false) {
  let units = 0;
  for (const ch of String(str)) units += glyphUnits(ch, bold);
  return (units / 1000) * size;
}

const SEPARATORS = ["-", "/", ".", "_", ",", ":"];

// Longest start of `word` that fits in `maxWidth`, cut after a separator if possible.
function fitPrefix(word, size, maxWidth, bold) {
  let n = 1;
  while (
    n < word.length &&
    textWidth(word.slice(0, n + 1), size, bold) <= maxWidth
  ) {
    n += 1;
  }
  const cut = Math.max(...SEPARATORS.map((c) => word.lastIndexOf(c, n - 1)));
  if (cut >= n / 2) n = cut + 1;
  return word.slice(0, n);
}

/**
 * Word-wraps `text` exactly as it will be printed and returns one string per
 * line. Words wider than a whole line (memo numbers, URLs) are broken,
 * preferably right after a "-", "/" or ".".
 */
function wrapLines(text, size, width, bold = false) {
  const value = String(text ?? "").trim();
  if (!value) return [];
  const maxW = width - WRAP_SAFETY;
  const lines = [];

  for (const paragraph of value.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, bold) <= maxW) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      let rest = word;
      while (textWidth(rest, size, bold) > maxW) {
        const piece = fitPrefix(rest, size, maxW, bold);
        lines.push(piece);
        rest = rest.slice(piece.length);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

const FIT_SIZES = [10, 9, 8, 7];

/**
 * Picks the largest size at which `text` fits in `width` × `maxHeight` and
 * returns the wrapped lines. If it doesn't fit even at the smallest size, the
 * full text is still returned at that size and simply takes more room.
 */
function fitLines(text, { width, maxHeight, sizes = FIT_SIZES, bold = false }) {
  for (const size of sizes) {
    const lines = wrapLines(text, size, width, bold);
    if (lines.length * lineH(size) <= maxHeight) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  return { size, lines: wrapLines(text, size, width, bold) };
}

/* =========================
   Page geometry (points) — derived from the styles below
========================= */
const PAGE = {
  width: 595.28,
  height: 841.89,
  padTop: 18,
  padBottom: 24,
  padX: 28,
};
const CONTENT_W = PAGE.width - PAGE.padX * 2;
const BOX_INNER = CONTENT_W - 2; // inside the top box border
const LEFT_TEXT_W = BOX_INNER * 0.58 - 1 - 20; // minus divider + padding
const RIGHT_TEXT_W = BOX_INNER * 0.42 - 20; // minus padding
const CHECKBOX_SPACE = 22 + 8; // checkbox width + its margin
const LABEL_GAP = 6;
const VALUE_PAD = 2;

// Width left for a value after its bold 10pt label.
const valueWidth = (label) =>
  LEFT_TEXT_W - textWidth(label, 10, true) - LABEL_GAP - VALUE_PAD * 2;

// Certificate column widths (must match colDate / colPart in the styles).
const LEDGER_COLS = { date: 0.17, particulars: 0.27 };
const cellTextWidth = (pct) => (CONTENT_W - 2) * pct - 10 - 1; // padding + border

// Nudges smaller text down so its first line sits on the same baseline as a 10pt label.
const baselinePad = (size) => Math.max(0, (10 - size) * 0.84);

// Max height the Purpose/Reason text takes before it starts to shrink (≈ 9 lines at 10pt).
const REASON_MAX_HEIGHT = 115;
// Max height for disapproval remarks (on their own lines) before they shrink.
const REMARKS_MAX_HEIGHT = 34;

/* =========================
   Page budget
   Measured from the rendered form. They only change if the fixed parts of the
   form change (logo, titles, the action column, certificate header): if you
   edit those, re-measure these numbers or the certificate may spill onto page 2.
========================= */
const LAYOUT = {
  topBoxTop: 103.5, // top edge of the top box (page padding + logo + title)
  rightFixed: 203.5, // right column (incl. box borders) without its signature blocks / remarks lines
  belowTopBox: 131, // top box bottom → first certificate row (detach line, title, header, balance forwarded)
  endingRow: 23.5, // "Ending Balance" row
  pageBottom: PAGE.height - PAGE.padBottom, // nothing may go below this
  safety: 1,
};
const ROW_LINE = lineH(10); // one 10pt line

/* =========================
   Signatures
========================= */
const SIG_IMAGE_H = 35;
const INITIALS_W = 45; // 40pt image + 5pt margin
const INITIALS_H = 20;
const INITIALS_GAP = 1.5; // initials start this far below the top of the position text
const INITIALS_OVERHANG = 8; // how far initials may hang into the space below a block
const sigImageBottom = (nameH) => Math.max(12, nameH + 2);
const sigLineH = (nameH) => Math.max(15, nameH + 1);
const sigRoomAbove = (nameH) =>
  sigImageBottom(nameH) + SIG_IMAGE_H - (sigLineH(nameH) - 1);

/**
 * Lays out one signature block: printed name over the line, position under it,
 * and the initials (paraphs) under the right end of the line. The position
 * always keeps clear of the initials:
 *  - a short position stays centred beside them;
 *  - a longer one uses the full line width, and the initials sit beside its
 *    last lines if those leave room on the right, otherwise below it.
 */
function layoutSignature({
  mainApprover,
  initialApprovers = [],
  fallbackName,
  fallbackRole,
  lineWidth,
}) {
  const nameSize = 9;
  const roleSize = 8;

  const getSigUrl = (appr) => {
    if (appr?.status === "APPROVED") {
      return safeImageUrl(
        appr.approverSnapshot?.signatureUrl ||
          appr.approverSignature?.signatureUrl,
      );
    }
    return null;
  };

  // Same rules as before: no approver and no initials → fallback name/role.
  const useFallback =
    !mainApprover && (!initialApprovers || initialApprovers.length === 0);

  // ✅ Ensures the name is shown even if pending
  const name = useFallback
    ? fallbackName
    : mainApprover?.approverSnapshot
      ? getFullApproverName(mainApprover.approverSnapshot)
      : mainApprover?.approver
        ? getFullApproverName(mainApprover.approver)
        : mainApprover?.employee
          ? getFullApproverName(mainApprover.employee)
          : fallbackName;

  const role = useFallback
    ? fallbackRole
    : mainApprover?.approverSnapshot?.position ||
      mainApprover?.approver?.position ||
      mainApprover?.employee?.position ||
      fallbackRole;

  const sigUrl = useFallback ? null : getSigUrl(mainApprover);
  const initialUrls = useFallback
    ? []
    : initialApprovers.filter(Boolean).map(getSigUrl).filter(Boolean);

  const reserve = initialUrls.length * INITIALS_W;
  const safeWidth = Math.max(40, lineWidth - reserve * 2);
  const roleLH = lineH(roleSize);

  let roleLines;
  let rolePadding = 0;
  let initialsLine = 0; // role line the initials start beside
  if (!initialUrls.length) {
    roleLines = wrapLines(role, roleSize, lineWidth);
  } else {
    const beside = wrapLines(role, roleSize, safeWidth);
    if (beside.length <= 2) {
      roleLines = beside;
      rolePadding = reserve;
    } else {
      roleLines = wrapLines(role, roleSize, lineWidth);
      initialsLine = roleLines.length;
      while (
        initialsLine > 0 &&
        textWidth(roleLines[initialsLine - 1], roleSize) <=
          safeWidth - WRAP_SAFETY
      ) {
        initialsLine -= 1;
      }
    }
  }

  const nameLines = wrapLines(name, nameSize, lineWidth - 4, true);
  const nameH = nameLines.length * lineH(nameSize);
  const roleH = roleLines.length * roleLH;
  const initialsTop = INITIALS_GAP + initialsLine * roleLH;
  const underH = initialUrls.length
    ? Math.max(roleH, initialsTop + INITIALS_H - INITIALS_OVERHANG)
    : roleH;
  // A multi-line name pushes the signature image up; add the same amount of
  // space above so the image never reaches into the content above it.
  const extraTop = sigUrl
    ? Math.max(0, sigRoomAbove(nameH) - sigRoomAbove(lineH(nameSize)))
    : 0;

  return {
    nameLines,
    nameSize,
    roleLines,
    roleSize,
    rolePadding,
    sigUrl,
    initialUrls,
    initialsTop,
    underH,
    lineWidth,
    nameH,
    extraTop,
    // Height from the top of the block's margin to the bottom of the block.
    height: (marginTop) => marginTop + extraTop + sigLineH(nameH) + 2 + underH,
  };
}

/* =========================
   Certificate rows
========================= */
/**
 * Fits text into a table cell without ever cutting it: picks the largest size
 * (10 → 7pt) at which it fits in `maxLines` lines of 10pt text. If it doesn't
 * fit even at 7pt, the full text is still printed at 7pt and the row grows.
 */
function fitCell(text, width, maxLines) {
  const fit = fitLines(text, { width, maxHeight: maxLines * ROW_LINE });
  return { ...fit, height: fit.lines.length * lineH(fit.size) };
}

/**
 * Lays out the certificate rows. Date and Particulars are always printed in
 * full and wrap onto the next line when they reach the column's right edge.
 *
 * - If every row fits on page 1 at the normal 10pt size, nothing changes.
 * - Otherwise long rows shrink (down to 7pt, with tighter padding if needed)
 *   so the certificate and its signature stay on page 1. Each row starts at
 *   its smallest size, and rows set below 9pt get room to grow back, one line
 *   at a time, while space remains.
 * - If even the smallest sizes can't fit on one page (lots of rows), rows stay
 *   at 10pt and the table continues on the next page like a normal table.
 */
function fitLedgerRows(transactions, budget) {
  const dateW = cellTextWidth(LEDGER_COLS.date);
  const partW = cellTextWidth(LEDGER_COLS.particulars);
  const rows = transactions.map((t) => ({
    ...t,
    // ✅ Prioritize the formatted displayDate from the backend,
    // fallback to formatting the chronological date if missing.
    dateToShow:
      t.displayDate && t.displayDate !== "N/A"
        ? t.displayDate
        : fmtDateShort(t.date),
  }));

  const fitRow = (r, lines) => {
    const dateFit = fitCell(r.dateToShow, dateW, lines);
    const particularsFit = fitCell(r.description, partW, lines);
    const height = Math.max(ROW_LINE, dateFit.height, particularsFit.height);
    return { ...r, lines, dateFit, particularsFit, height };
  };
  const emptyRows = Math.max(0, 2 - rows.length); // the table always shows 2+ rows
  const totalHeight = (fitted, padV) =>
    fitted.reduce((sum, r) => sum + r.height, 0) +
    emptyRows * ROW_LINE +
    (fitted.length + emptyRows) * (padV * 2 + 1);

  // 1. Normal size fits? Use it.
  const natural = rows.map((r) => fitRow(r, Infinity));
  if (totalHeight(natural, 5) <= budget) {
    return { rows: natural, padV: 5, fits: true, natural: true };
  }

  // 2. Smallest layout: each row on one line if possible, else full text at 7pt.
  //    If that's still too tall, tighten the row padding before giving up.
  const needsMore = (r) => r.dateFit.size < 9 || r.particularsFit.size < 9;
  for (const padV of [5, 3, 2]) {
    const fitted = rows.map((r) => fitRow(r, 1));
    let spare = budget - totalHeight(fitted, padV);
    if (spare < 0) continue;

    // 3. Give rows set below 9pt more lines (a bigger font) while room remains.
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < fitted.length; i++) {
        if (!needsMore(fitted[i])) continue;
        const bigger = fitRow(rows[i], fitted[i].lines + 1);
        const extra = bigger.height - fitted[i].height;
        if (extra <= spare) {
          fitted[i] = bigger;
          spare -= extra;
          grew = true;
        }
      }
    }
    return { rows: fitted, padV, fits: true, natural: false };
  }

  // 4. Can't fit on one page at any size: keep it readable and let the table
  //    continue on the next page like a normal table.
  return { rows: natural, padV: 5, fits: false, natural: false };
}

/* =========================
   Styles
========================= */
const styles = StyleSheet.create({
  page: {
    padding: "18 28 24 28",
    fontSize: 10,
    fontFamily: "Helvetica",
    lineHeight: LINE_HEIGHT,
    position: "relative",
  },
  header: { alignItems: "center", justifyContent: "center", marginBottom: 8 },
  logo: { width: 190, height: 55, objectFit: "contain" },
  formTitle: {
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 10,
    fontSize: 10,
  },
  topBox: {
    borderWidth: 1,
    borderColor: "#000",
    flexDirection: "row",
    width: "100%",
    minHeight: 210,
  },
  topLeft: {
    width: "58%",
    borderRightWidth: 1,
    borderRightColor: "#000",
    padding: 10,
  },
  topRight: { width: "42%", padding: 10 },
  label: { fontWeight: "bold" },
  fieldRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 6 },
  fieldLabel: { marginRight: LABEL_GAP, flexShrink: 0 },
  underlineBox: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    justifyContent: "flex-end",
    position: "relative",
  },
  underlineText: { fontSize: 10, paddingHorizontal: VALUE_PAD, zIndex: 2 },

  /* --- Signatures --- */
  sigBlock: {
    alignItems: "center",
    marginTop: 15,
    width: "100%",
  },
  sigLine: {
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 15,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  // Variable text sets its line height itself: otherwise react-pdf hands down
  // the page's 12.5pt spacing even to smaller text.
  sigName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 2,
    textAlign: "center",
    lineHeight: LINE_HEIGHT,
  },
  sigRoleBox: {
    marginTop: 2,
    position: "relative",
  },
  sigRole: {
    fontSize: 8,
    textAlign: "center",
    lineHeight: LINE_HEIGHT,
  },
  applicantSignature: {
    height: 35,
    width: 120,
    objectFit: "contain",
    position: "absolute",
    bottom: 2,
  },
  approverSignatureAbove: {
    height: SIG_IMAGE_H,
    width: 120,
    objectFit: "contain",
    position: "absolute",
  },
  initialsContainer: {
    position: "absolute",
    right: 0, // Aligns to the right side of the signature line
    flexDirection: "row",
  },
  approverInitialUnder: {
    height: INITIALS_H,
    width: 40,
    objectFit: "contain",
    marginRight: 5,
  },
  digitalSigInfo: {
    fontSize: 5,
    color: "#333",
    textAlign: "center",
    lineHeight: 1.1,
    position: "absolute",
    bottom: 10,
  },
  digitalSignatureText: {
    fontSize: 7,
    color: "#333",
    textAlign: "center",
    lineHeight: 1.1,
    marginBottom: 4,
  },

  actionTitle: { fontWeight: "bold", textAlign: "center", marginBottom: 10 },
  actionRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: "#000",
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flexDirection: "row", alignItems: "flex-end", flex: 1 },
  remarksBlock: {
    marginLeft: CHECKBOX_SPACE,
    marginTop: -6,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingHorizontal: 2,
    paddingBottom: 1,
  },
  approvalLabelLeft: { marginTop: 18, marginBottom: 2 },
  detachRow: { marginTop: 10, marginBottom: 6 },
  detachText: { fontSize: 9 },
  dashedLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderStyle: "dashed",
    marginBottom: 10,
  },
  certificateTitle: {
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 10,
    marginBottom: 6,
  },
  certBox: { borderWidth: 1, borderColor: "#000", width: "100%" },
  gridRow: { flexDirection: "row" },
  gridHeaderCell: {
    borderRightWidth: 1,
    borderRightColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    padding: 5,
    fontWeight: "bold",
    textAlign: "center",
  },
  gridCell: {
    borderRightWidth: 1,
    borderRightColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    padding: 5,
  },

  // ✅ Ledger columns (keep in sync with LEDGER_COLS above)
  colDate: { width: "17%" },
  colPart: { width: "27%" },
  colEarned: { width: "16%" },
  colAvail: { width: "14%" },
  colBal: { width: "13%" },
  colRem: { width: "13%", borderRightWidth: 0 },
  colMerged: { width: "74%" },

  certFooter: {
    minHeight: 120,
    padding: 15,
    paddingRight: 30, // ✅ Slightly padding the right side so it's not directly on the edge
    flexDirection: "row",
    justifyContent: "flex-end", // ✅ Indents the entire block to the right
    alignItems: "flex-end",
  },
  footerBlock: { width: 180, alignItems: "center" },
  footerDateLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    width: 150,
    height: 14,
    marginTop: 10,
    justifyContent: "flex-end", // ✅ Added for date centering at bottom
  },
  footerDateLabel: { textAlign: "center", fontSize: 9, marginTop: 2 },
  boldText: { fontWeight: "bold" },
  textCenter: { textAlign: "center" },
  watermarkContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999999,
  },
  watermarkText: {
    color: "rgba(220, 38, 38, 0.25)",
    fontSize: 100,
    fontFamily: "Helvetica-Bold",
    transform: "rotate(-45deg)",
    letterSpacing: 5,
  },
});

/* =========================
   Underlined field components
========================= */
function UnderlineBox({
  value,
  width,
  flex = 1,
  align = "center",
  minHeight = 12,
  paddingBottom = 1,
  textStyle,
  boxStyle,
  signatureText,
  signatureUrl,
}) {
  return (
    <View
      style={[
        styles.underlineBox,
        { flex, width: width ?? undefined, minHeight, paddingBottom },
        boxStyle,
      ]}
    >
      {signatureUrl ? (
        <Image src={signatureUrl} style={styles.applicantSignature} />
      ) : signatureText ? (
        <Text style={styles.digitalSignatureText}>{signatureText}</Text>
      ) : null}
      <Text style={[styles.underlineText, { textAlign: align }, textStyle]}>
        {String(value || "")}
      </Text>
    </View>
  );
}

/**
 * A bold label followed by an underlined value. `field` holds the value's
 * pre-wrapped lines: when it reaches the right edge it continues on the next
 * line, and the label lines up with the first line.
 */
function LabeledField({ label, field, align = "center" }) {
  const multiLine = field.lines.length > 1 || field.size !== 10;
  return (
    <View style={[styles.fieldRow, multiLine && { alignItems: "flex-start" }]}>
      <Text style={[styles.label, styles.fieldLabel]}>{label}</Text>
      <UnderlineBox
        value={field.lines.join("\n")}
        align={align}
        textStyle={
          multiLine && {
            fontSize: field.size,
            lineHeight: LINE_HEIGHT,
            paddingTop: baselinePad(field.size),
          }
        }
      />
    </View>
  );
}

// Height of a LabeledField row (incl. its 6pt bottom margin).
function fieldRowH(field) {
  const multiLine = field.lines.length > 1 || field.size !== 10;
  const textH =
    (multiLine ? baselinePad(field.size) : 0) +
    field.lines.length * lineH(field.size);
  return Math.max(lineH(10), Math.max(12, textH + 2)) + 6;
}

const CheckMark = () => (
  <Svg viewBox="0 0 24 24" width={14} height={14}>
    <Path d="M20 6L9 17l-5-5" stroke="black" strokeWidth="2.5" fill="none" />
  </Svg>
);

// Table-cell text sized by fitCell().
const CellText = ({ fit }) => (
  <Text style={{ fontSize: fit.size, lineHeight: LINE_HEIGHT }}>
    {fit.lines.join("\n")}
  </Text>
);

// ✅ Centralized Signature Component with Initials Rendering
const SignatureBlock = ({ sig, marginTop }) => (
  <View style={[styles.sigBlock, { marginTop: marginTop + sig.extraTop }]}>
    <View style={[styles.sigLine, { width: sig.lineWidth }]}>
      {sig.sigUrl ? (
        <Image
          src={sig.sigUrl}
          style={[
            styles.approverSignatureAbove,
            { bottom: sigImageBottom(sig.nameH) },
          ]}
        />
      ) : null}

      <Text style={[styles.sigName, { fontSize: sig.nameSize }]}>
        {sig.nameLines.join("\n")}
      </Text>
    </View>
    <View
      style={[
        styles.sigRoleBox,
        {
          width: sig.lineWidth,
          paddingHorizontal: sig.rolePadding,
          minHeight: sig.underH,
        },
      ]}
    >
      {sig.roleLines.length > 0 && (
        <Text style={[styles.sigRole, { fontSize: sig.roleSize }]}>
          {sig.roleLines.join("\n")}
        </Text>
      )}

      {/* ✅ Render initials UNDER the underline, clear of the position text */}
      {sig.initialUrls.length > 0 && (
        <View style={[styles.initialsContainer, { top: sig.initialsTop }]}>
          {sig.initialUrls.map((url, idx) => (
            <Image key={idx} src={url} style={styles.approverInitialUnder} />
          ))}
        </View>
      )}
    </View>
  </View>
);

/* =========================
   PDF Component
========================= */
export default function WellnessLeavePdf({
  app,
  isAfdDivision: isAfdProp, // ✅ Accept prop from the modal
  logoSrc = "/public/logo_dict.png",
  recommendingApproverLabel = "Chief/Division Head",
  approvedLabel = "Regional Director",
  adminFinanceLabel = "Chief, Admin. & Finance Div.",
}) {
  const applicantSnap = app?.applicantSnapshot || {};
  const emp = app?.employee || {};
  const firstName = applicantSnap.firstName || emp.firstName || "";
  const lastName = applicantSnap.lastName || emp.lastName || "";
  const middleName = applicantSnap.middleName || emp.middleName || "";

  const employeeName =
    firstName || lastName
      ? `${firstName} ${middleName} ${lastName}`
          .trim()
          .replace(/\s+/g, " ")
          .toUpperCase()
      : "";

  const position = applicantSnap.position || emp.position || "";

  // Extract officeDivision, handling variations
  const officeDivision =
    applicantSnap.division ||
    applicantSnap.officeDivision ||
    emp.division ||
    emp.officeDivision ||
    emp.office ||
    "";

  const dateOfFiling = fmtDateLong(app?.createdAt) || "";

  const totalDaysUsed = safeNumber(app?.totalDays);
  const inclusiveDates = formatInclusiveDates(app?.inclusiveDates) || "";
  const reason = app?.reason || "";

  const dayCount = Array.isArray(app?.inclusiveDates)
    ? app.inclusiveDates.length
    : totalDaysUsed;

  const applicantSigUrl = safeImageUrl(
    app?.applicantSignatureUrl || emp.signature,
  );
  const applicantSigText =
    !applicantSigUrl && (lastName || firstName)
      ? `Digitally signed\nby ${lastName}\n${firstName}`
      : null;

  const approvals = app?.approvals || [];

  // EXACT ROLE MAPPINGS
  const recInitial = approvals.find(
    (a) => a.role === "Recommending Approval Initial",
  );
  const recSignature = approvals.find(
    (a) => a.role === "Recommending Approval",
  );
  const afdSignature = approvals.find((a) => a.role === "AFD Chief Signature");
  const hrInitial = approvals.find((a) => a.role === "HR Initial");
  const ardSignature = approvals.find((a) => a.role === "ARD Signature");

  const rdSignature = approvals.find(
    (a) => a.role === "Regional Director Signature",
  );

  // ✅ Determine if applicant is from AFD to adapt Recommending Approval role
  // Checks the prop first, falls back to internal calculation
  const isAfdDivision =
    isAfdProp !== undefined
      ? isAfdProp
      : officeDivision.toUpperCase().includes("AFD") ||
        officeDivision.toUpperCase().includes("ADMIN");

  const activeRecSignature = isAfdDivision ? afdSignature : recSignature;
  const activeRecInitial = isAfdDivision ? [] : [recInitial];
  const activeRecFallbackRole = isAfdDivision
    ? adminFinanceLabel
    : recommendingApproverLabel;

  // ✅ Check if fully approved (or revoked later) to show checkmarks
  const isApprovedStatus = [
    "APPROVED",
    "REVOKED",
    "REVOCATION_REQUESTED",
  ].includes(String(app?.overallStatus || "").toUpperCase());

  const isRevoked =
    String(app?.overallStatus || "").toUpperCase() === "REVOKED";
  const isRejected = app?.overallStatus === "REJECTED";

  const getSigDate = (sig) =>
    sig?.status === "APPROVED"
      ? sig?.actionDate || sig?.updatedAt || sig?.createdAt
      : null;

  // ✅ Prioritizes the action date of the Final Approver (RD or ARD)
  const rawApprovalDate =
    getSigDate(rdSignature) ||
    getSigDate(ardSignature) ||
    app?.approvedAt ||
    (isApprovedStatus ? app?.updatedAt : null);

  const formattedApprovalDate = rawApprovalDate
    ? fmtDateLong(rawApprovalDate)
    : "";

  // ==========================================
  // LEDGER DATA EXTRACTION (Match CTO)
  // ==========================================
  const ledger = app?.ledger || {
    balanceForwarded: 0,
    transactions: [],
    endingBalance: 0,
  };
  const transactions = ledger.transactions || [];
  const balanceForwarded = safeNumber(ledger.balanceForwarded);
  const endingBalance = safeNumber(ledger.endingBalance);

  // ==========================================
  // ✅ LONG TEXT: always printed in full, wrapping at the right edge
  // ==========================================
  const wrapField = (label, value) => ({
    size: 10,
    lines: wrapLines(value, 10, valueWidth(label)),
  });
  const fixedFields = {
    name: wrapField("Name:", employeeName),
    position: wrapField("Position:", position),
    office: wrapField("Office/Division:", officeDivision),
    filing: wrapField("Date of Filing:", dateOfFiling),
    days: wrapField(
      "No. of working day/s applied for:",
      totalDaysUsed ? `${totalDaysUsed} Day(s)` : "",
    ),
  };

  // Short remarks stay on the "Disapproved due to" line; longer ones continue
  // on their own line(s) under it.
  const remarks = isRejected ? String(app?.remarks || "").trim() : "";
  const inlineRemarksWidth =
    RIGHT_TEXT_W - CHECKBOX_SPACE - textWidth("Disapproved due to ", 10) - 4;
  const remarksInline =
    textWidth(remarks, 10) <= inlineRemarksWidth - WRAP_SAFETY;

  // Signatures
  const rightSigLine = RIGHT_TEXT_W * 0.95;
  const sigRec = layoutSignature({
    mainApprover: activeRecSignature,
    initialApprovers: activeRecInitial,
    fallbackName: "",
    fallbackRole: activeRecFallbackRole,
    lineWidth: rightSigLine,
  });
  const sigApproved = layoutSignature({
    mainApprover: rdSignature || ardSignature,
    initialApprovers: [afdSignature],
    fallbackName: "",
    fallbackRole: approvedLabel,
    lineWidth: rightSigLine,
  });
  const sigFooter = layoutSignature({
    mainApprover: afdSignature,
    initialApprovers: [hrInitial],
    fallbackName: "",
    fallbackRole: adminFinanceLabel,
    lineWidth: 180,
  });

  // ==========================================
  // ✅ PAGE BUDGET: the certificate gets whatever room is left on page 1
  // ==========================================
  // Everything starts at full size (the reason, inclusive dates and long
  // remarks shrink only once they pass their own space). If the certificate
  // can't then fit on page 1 at full size:
  //  1. spare spacing above two signatures is tightened (barely visible);
  //  2. the certificate rows shrink to fit, if they can;
  //  3. otherwise the reason, dates and remarks get one size smaller at a time.
  // If nothing fits, everything stays at full size and the table continues on
  // page 2.
  const planPage = (maxSize, tight) => {
    const spacing = {
      recLabelGap: tight ? 10 : 25, // under "Recommending Approval:"
      footerSigTop: tight ? 18 : 30, // above the certificate's signature
    };
    const footerH = Math.max(
      120,
      // padding + signature + date line + "Date" label (on the page's 12.5pt line) + padding
      15 + sigFooter.height(spacing.footerSigTop) + 10 + 14 + 2 + ROW_LINE + 15,
    );
    const rowsBottomLimit =
      LAYOUT.pageBottom - 1 - footerH - LAYOUT.endingRow - LAYOUT.safety;
    const sizes = FIT_SIZES.filter((size) => size <= maxSize);
    const fields = {
      ...fixedFields,
      dates: fitLines(inclusiveDates, {
        width: valueWidth("Inclusive Date/s:"),
        maxHeight: 3 * ROW_LINE,
        sizes,
      }),
      reason: fitLines(reason, {
        width: valueWidth("Purpose/Reason:"),
        maxHeight: REASON_MAX_HEIGHT,
        sizes,
      }),
    };
    const remarksFit = remarksInline
      ? null
      : fitLines(remarks, {
          width: RIGHT_TEXT_W - CHECKBOX_SPACE - 4,
          maxHeight: REMARKS_MAX_HEIGHT,
          sizes: sizes.filter((size) => size <= 9),
        });

    const leftBottom =
      LAYOUT.topBoxTop +
      1 +
      10 +
      fieldRowH(fields.name) +
      61 + // signature row
      fieldRowH(fields.position) +
      fieldRowH(fields.office) +
      fieldRowH(fields.filing) +
      fieldRowH(fields.days) +
      fieldRowH(fields.dates) +
      fieldRowH(fields.reason) +
      10 +
      1;
    const remarksH = remarksFit
      ? remarksFit.lines.length * lineH(remarksFit.size) + 2 - 6 + 10
      : 0;
    const rightBottom =
      LAYOUT.topBoxTop +
      LAYOUT.rightFixed -
      (25 - spacing.recLabelGap) +
      remarksH +
      sigRec.height(25) +
      sigApproved.height(25);
    const topBoxBottom = Math.max(
      leftBottom,
      rightBottom,
      LAYOUT.topBoxTop + 210,
    );
    const rowsTop = topBoxBottom + LAYOUT.belowTopBox;
    const ledgerFit = fitLedgerRows(transactions, rowsBottomLimit - rowsTop);
    return {
      fields,
      remarksFit,
      spacing,
      footerH,
      leftBottom,
      rightBottom,
      topBoxBottom,
      rowsTop,
      ledgerFit,
    };
  };

  const fullSize = planPage(10, false);
  let plan = fullSize;
  if (!fullSize.ledgerFit.natural) {
    plan =
      [
        planPage(10, true),
        planPage(9, true),
        planPage(8, true),
        planPage(7, true),
      ].find((p) => p.ledgerFit.fits) || fullSize;
  }
  const { fields, remarksFit, spacing, footerH, ledgerFit } = plan;

  const rowCellPad = { paddingVertical: ledgerFit.padV };
  // If the table must continue on the next page, the last row goes along with
  // Ending Balance and the signature instead of leaving the signature alone.
  const keepWithFooter = LAYOUT.endingRow + footerH + 1;

  const paddedTransactions = [...ledgerFit.rows];
  while (paddedTransactions.length < 2) {
    paddedTransactions.push({ isEmpty: true });
  }

  return (
    <Document title={`Wellness Leave Application - ${lastName || "Applicant"}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={logoSrc} style={styles.logo} />
        </View>

        <Text style={styles.formTitle}>
          APPLICATION FOR AVAILMENT OF WELLNESS LEAVE
        </Text>

        <View style={styles.topBox}>
          <View style={styles.topLeft}>
            <LabeledField label="Name:" field={fields.name} align="left" />
            <View style={styles.fieldRow}>
              <Text style={[styles.label, styles.fieldLabel]}>Signature:</Text>
              <UnderlineBox
                value=""
                flex={1}
                align="center"
                minHeight={55}
                signatureText={applicantSigText}
                signatureUrl={applicantSigUrl}
              />
            </View>
            <LabeledField
              label="Position:"
              field={fields.position}
              align="left"
            />
            <LabeledField
              label="Office/Division:"
              field={fields.office}
              align="left"
            />
            <LabeledField label="Date of Filing:" field={fields.filing} />
            <LabeledField
              label="No. of working day/s applied for:"
              field={fields.days}
            />
            <LabeledField label="Inclusive Date/s:" field={fields.dates} />
            <LabeledField
              label="Purpose/Reason:"
              field={fields.reason}
              align="left"
            />
          </View>

          <View style={styles.topRight}>
            <Text style={styles.actionTitle}>ACTION OF APPLICATION</Text>

            {/* ✅ SVG Checkbox for Guaranteed Rendering */}
            <View style={styles.actionRow}>
              <View style={styles.checkbox}>
                {isApprovedStatus && dayCount ? <CheckMark /> : null}
              </View>
              <View style={styles.actionText}>
                <Text>Approval for </Text>
                <UnderlineBox
                  value={isApprovedStatus && dayCount ? String(dayCount) : ""}
                  width={20}
                  flex={1}
                  align="center"
                  minHeight={10}
                />
                <Text> day/s</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.checkbox}>
                {isRejected ? <CheckMark /> : null}
              </View>
              <View style={styles.actionText}>
                {remarksInline ? (
                  <>
                    <Text>Disapproved due to </Text>
                    <UnderlineBox
                      value={remarks}
                      flex={1}
                      align="center"
                      minHeight={10}
                    />
                  </>
                ) : (
                  <Text>Disapproved due to:</Text>
                )}
              </View>
            </View>

            {remarksFit && (
              <View style={styles.remarksBlock}>
                <Text
                  style={{ fontSize: remarksFit.size, lineHeight: LINE_HEIGHT }}
                >
                  {remarksFit.lines.join("\n")}
                </Text>
              </View>
            )}

            {/* ✅ Recommending Approval: Dynamically adapts if applicant is from AFD */}
            <Text
              style={[
                styles.approvalLabelLeft,
                { marginBottom: spacing.recLabelGap },
              ]}
            >
              Recommending Approval:
            </Text>
            <SignatureBlock sig={sigRec} marginTop={25} />

            {/* ✅ Approved (Regional Director): Main Signature + AFD Signature Under as Initial */}
            <Text style={[styles.approvalLabelLeft, { marginTop: 25 }]}>
              Approved:
            </Text>
            <SignatureBlock sig={sigApproved} marginTop={25} />
          </View>
        </View>

        <View style={styles.detachRow}>
          <Text style={styles.detachText}>Detach for Time Keeper’s Record</Text>
        </View>
        <View style={styles.dashedLine} />

        <Text style={styles.certificateTitle}>
          CERTIFICATE OF WELLNESS LEAVE CREDITS
        </Text>

        <View style={styles.certBox}>
          {/* Header Row — `fixed`: repeats if the table ever continues onto another page */}
          <View style={styles.gridRow} wrap={false} fixed>
            <View style={[styles.gridHeaderCell, styles.colDate]}>
              <Text>Date</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.colPart]}>
              <Text>Particulars</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.colEarned]}>
              <Text>Wellness Leave{"\n"}Credits</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.colAvail]}>
              <Text>Number of{"\n"}Wellness Availed</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.colBal]}>
              <Text>Leave{"\n"}Balance</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.colRem]}>
              <Text>Remarks</Text>
            </View>
          </View>

          {/* Balance Forwarded Row */}
          <View style={styles.gridRow} wrap={false}>
            <View style={[styles.gridCell, styles.colMerged]}>
              <Text style={styles.boldText}>Balance Forwarded</Text>
            </View>
            <View style={[styles.gridCell, styles.colBal, styles.textCenter]}>
              <Text>{balanceForwarded} Day(s)</Text>
            </View>
            <View style={[styles.gridCell, styles.colRem]}>
              <Text> </Text>
            </View>
          </View>

          {/* Dynamic Transaction Rows */}
          {paddedTransactions.map((t, idx) => {
            if (t.isEmpty) {
              return (
                <View style={styles.gridRow} key={`empty-${idx}`} wrap={false}>
                  <View style={[styles.gridCell, styles.colDate, rowCellPad]}>
                    <Text> </Text>
                  </View>
                  <View style={[styles.gridCell, styles.colPart, rowCellPad]}>
                    <Text> </Text>
                  </View>
                  <View style={[styles.gridCell, styles.colEarned, rowCellPad]}>
                    <Text> </Text>
                  </View>
                  <View style={[styles.gridCell, styles.colAvail, rowCellPad]}>
                    <Text> </Text>
                  </View>
                  <View style={[styles.gridCell, styles.colBal, rowCellPad]}>
                    <Text> </Text>
                  </View>
                  <View style={[styles.gridCell, styles.colRem, rowCellPad]}>
                    <Text> </Text>
                  </View>
                </View>
              );
            }

            const isAccrual = t.amount > 0;
            const isLastRow = idx === paddedTransactions.length - 1;

            return (
              <View
                style={styles.gridRow}
                key={idx}
                wrap={false}
                minPresenceAhead={isLastRow ? keepWithFooter : 0}
              >
                <View style={[styles.gridCell, styles.colDate, rowCellPad]}>
                  <CellText fit={t.dateFit} />
                </View>
                <View style={[styles.gridCell, styles.colPart, rowCellPad]}>
                  <CellText fit={t.particularsFit} />
                </View>
                <View
                  style={[
                    styles.gridCell,
                    styles.colEarned,
                    styles.textCenter,
                    rowCellPad,
                  ]}
                >
                  <Text>{isAccrual ? `${t.amount} Day(s)` : ""}</Text>
                </View>
                <View
                  style={[
                    styles.gridCell,
                    styles.colAvail,
                    styles.textCenter,
                    rowCellPad,
                  ]}
                >
                  <Text>
                    {!isAccrual ? `${Math.abs(t.amount)} Day(s)` : ""}
                  </Text>
                </View>
                <View
                  style={[
                    styles.gridCell,
                    styles.colBal,
                    styles.textCenter,
                    rowCellPad,
                  ]}
                >
                  <Text>{t.runningBalance} Day(s)</Text>
                </View>
                <View style={[styles.gridCell, styles.colRem, rowCellPad]}>
                  <Text> </Text>
                </View>
              </View>
            );
          })}

          {/* Ending Balance Row */}
          <View style={styles.gridRow} wrap={false}>
            <View style={[styles.gridCell, styles.colMerged]}>
              <Text style={styles.boldText}>Ending Balance</Text>
            </View>
            <View style={[styles.gridCell, styles.colBal, styles.textCenter]}>
              <Text>{endingBalance} Day(s)</Text>
            </View>
            <View style={[styles.gridCell, styles.colRem]}>
              <Text> </Text>
            </View>
          </View>

          <View style={styles.certFooter} wrap={false}>
            <View style={styles.footerBlock}>
              {/* ✅ Bottom Footer: AFD Chief Signature with HR Signature as the Initial */}
              <SignatureBlock
                sig={sigFooter}
                marginTop={spacing.footerSigTop}
              />
              <View style={styles.footerDateLine}>
                <Text style={{ textAlign: "center", fontSize: 9 }}>
                  {formattedApprovalDate}
                </Text>
              </View>
              <Text style={styles.footerDateLabel}>Date</Text>
            </View>
          </View>
        </View>

        {isRevoked && (
          <View style={styles.watermarkContainer} fixed>
            <Text style={styles.watermarkText}>REVOKED</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
