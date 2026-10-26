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
   Text fitting
   Keeps long free-text (purpose/reason, remarks) inside its box so the
   one-page form never stretches or spills onto a second page.
========================= */
const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_PAD_X = 28;
const LINE_HEIGHT = 1.25;
const BOX_INNER_WIDTH = PAGE_WIDTH - PAGE_PAD_X * 2 - 2; // minus topBox borders
const LEFT_COL_TEXT_WIDTH = BOX_INNER_WIDTH * 0.58 - 1 - 20; // minus divider + padding
const RIGHT_COL_TEXT_WIDTH = BOX_INNER_WIDTH * 0.42 - 20; // minus padding
const CHECKBOX_SPACE = 22 + 8; // checkbox width + its margin

// Max height the Purpose/Reason text may take on the form (≈ 9 lines at 10pt).
const REASON_MAX_HEIGHT = 115;
// Max height for disapproval remarks when they don't fit on the inline line.
const REMARKS_MAX_HEIGHT = 34;
const FIT_SIZES = [10, 9, 8, 7];
const CONTINUED_NOTE = " … (continued on attached page)";

// Helvetica glyph widths (1/1000 em) for ASCII 32–126, from the standard AFM metrics.
// prettier-ignore
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833,
  556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  334, 260, 334, 584,
];

function textWidth(str, fontSize, bold = false) {
  let units = 0;
  for (const ch of String(str)) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? HELVETICA_WIDTHS[code - 32] : 556;
  }
  // Helvetica-Bold runs up to ~10% wider; over-estimating is the safe side.
  return (units / 1000) * fontSize * (bold ? 1.1 : 1);
}

/**
 * Splits a word wider than `maxWidth` (memo numbers, URLs) into pieces that
 * fit, preferring to cut right after a separator such as "-", "/", "." or "_".
 */
function splitLongWord(word, fontSize, maxWidth) {
  const pieces = [];
  let rest = word;
  while (rest.length > 1 && textWidth(rest, fontSize) > maxWidth) {
    let n = 1;
    while (
      n < rest.length &&
      textWidth(rest.slice(0, n + 1), fontSize) <= maxWidth
    ) {
      n += 1;
    }
    const sep = Math.max(
      ...["-", "/", ".", "_", ",", ":"].map((c) => rest.lastIndexOf(c, n - 1)),
    );
    if (sep >= n / 2) n = sep + 1;
    pieces.push(rest.slice(0, n));
    rest = rest.slice(n);
  }
  pieces.push(rest);
  return pieces;
}

// Simulates word-wrapping and returns how many lines `text` needs.
function countLines(text, fontSize, maxWidth) {
  const spaceW = textWidth(" ", fontSize);
  let lines = 0;
  for (const paragraph of String(text).split(/\r?\n/)) {
    lines += 1;
    let lineW = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const w = textWidth(word, fontSize);
      if (lineW > 0 && lineW + spaceW + w <= maxWidth) {
        lineW += spaceW + w;
        continue;
      }
      if (lineW > 0) lines += 1;
      // A word wider than the line is broken the same way breakLongWords() does it.
      const pieces =
        w > maxWidth ? splitLongWord(word, fontSize, maxWidth) : [word];
      lines += pieces.length - 1;
      lineW = textWidth(pieces[pieces.length - 1], fontSize);
    }
  }
  return lines;
}

/**
 * Picks the largest font size at which `text` fits in `width` × `maxHeight`.
 * If it can't fit even at the smallest size, returns a shortened preview
 * (cut on a word boundary) with `overflow: true` so the full text can be
 * printed on an attachment page instead of breaking the layout.
 */
function fitText(
  text,
  { width, maxHeight, sizes = FIT_SIZES, note = CONTINUED_NOTE },
) {
  const value = String(text || "").trim();
  const fits = (str, size) =>
    countLines(str, size, width) * size * LINE_HEIGHT <= maxHeight;

  for (const size of sizes) {
    if (fits(value, size)) {
      return { fontSize: size, text: value, overflow: false, maxHeight, note };
    }
  }

  const size = sizes[sizes.length - 1];
  const words = value.split(/\s+/);
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(words.slice(0, mid).join(" ") + note, size)) lo = mid;
    else hi = mid - 1;
  }
  let preview = words.slice(0, lo).join(" ");

  // Not even the first word fits (one huge unbroken string): trim it by characters.
  if (lo === 0) {
    const first = words[0] || "";
    let n = first.length;
    while (n > 0 && !fits(first.slice(0, n) + note, size)) n -= 1;
    preview = first.slice(0, n);
  }

  return { fontSize: size, text: preview, overflow: true, maxHeight, note };
}

/**
 * react-pdf can't always find a break point inside long unbroken strings
 * (memo numbers, URLs), so they run into the next column. This inserts line
 * breaks into any word wider than `maxWidth`.
 */
function breakLongWords(text, fontSize, maxWidth) {
  return String(text)
    .split(/(\s+)/)
    .map((token) =>
      /^\s*$/.test(token) || textWidth(token, fontSize) <= maxWidth
        ? token
        : splitLongWord(token, fontSize, maxWidth).join("\n"),
    )
    .join("");
}

// Height a fitText()/fitCell() result will take when rendered.
function fitHeight(fit, width) {
  const text = fit.text + (fit.overflow ? fit.note : "");
  return countLines(text, fit.fontSize, width) * fit.fontSize * LINE_HEIGHT;
}

/* Page budget: positions in points from the top of the page, measured from
   the rendered form with the styles below. If you change the logo, titles or
   field spacing, re-measure these, or the certificate may spill onto page 2. */
const LAYOUT = {
  reasonRowTop: 298.5, // Purpose/Reason row when every field above it is one line
  rightColumnBottom: 416, // top box bottom when the right column is the taller one
  belowTopBox: 131, // top box → first certificate row (detach line, title, header, balance forwarded)
  rowsBottomLimit: 665.5, // last certificate row must end here so Ending Balance + signature fit
  safety: 3,
};
// Ending Balance row + signature footer, kept together with the last row.
const KEEP_WITH_FOOTER = 155;
const ROW_LINE = 10 * LINE_HEIGHT; // one 10pt line

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
    const height = Math.max(
      ROW_LINE,
      fitHeight(dateFit, dateW),
      fitHeight(particularsFit, partW),
    );
    return { ...r, lines, dateFit, particularsFit, height };
  };
  const emptyRows = Math.max(0, 2 - rows.length); // the table always shows 2+ rows
  const totalHeight = (fitted, padV) =>
    fitted.reduce((sum, r) => sum + r.height, 0) +
    emptyRows * ROW_LINE +
    (fitted.length + emptyRows) * (padV * 2 + 1);

  // 1. Normal size fits? Use it.
  const natural = rows.map((r) => fitRow(r, Infinity));
  if (totalHeight(natural, 5) <= budget) return { rows: natural, padV: 5 };

  // 2. Smallest layout: each row on one line if possible, else full text at 7pt.
  //    If that's still too tall, tighten the row padding before giving up.
  const needsMore = (r) =>
    r.dateFit.fontSize < 9 || r.particularsFit.fontSize < 9;
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
    return { rows: fitted, padV };
  }

  // 4. Can't fit on one page at any size: keep it readable and let the table
  //    continue on the next page like a normal table.
  return { rows: natural, padV: 5 };
}

/**
 * Fits text into a table cell without ever cutting it: picks the largest font
 * (10 → 7pt) at which it fits in `maxLines` lines of 10pt text. If it doesn't
 * fit even at 7pt, the full text is still printed at 7pt and the row grows.
 * Long unbroken strings (memo numbers) are wrapped at the column edge.
 */
function fitCell(text, width, maxLines) {
  const value = String(text || "").trim();
  const maxHeight = maxLines * ROW_LINE;
  const fontSize =
    FIT_SIZES.find(
      (size) =>
        countLines(value, size, width) * size * LINE_HEIGHT <= maxHeight,
    ) ?? FIT_SIZES[FIT_SIZES.length - 1];
  return {
    fontSize,
    text: breakLongWords(value, fontSize, width),
    overflow: false,
    note: "",
  };
}

// Certificate column widths (must match colDate / colPart in the styles).
const LEDGER_COLS = { date: 0.17, particulars: 0.27 };

// Text width inside a certificate column (percent of the table, minus padding + border).
function cellTextWidth(percent) {
  return (PAGE_WIDTH - PAGE_PAD_X * 2 - 2) * percent - 10 - 1;
}

// Width left for the value after a bold 10pt label + its margin + text padding.
function valueWidthAfterLabel(label, colWidth = LEFT_COL_TEXT_WIDTH) {
  return colWidth - textWidth(label, 10, true) - 6 - 4;
}

// Nudges smaller text down so its first line sits on the same baseline as a 10pt label.
function baselinePad(fontSize) {
  return Math.max(0, (10 - fontSize) * 0.84);
}

/* =========================
   Styles
========================= */
const styles = StyleSheet.create({
  page: {
    padding: "18 28 24 28",
    fontSize: 10,
    fontFamily: "Helvetica",
    lineHeight: 1.25,
    position: "relative",
  },
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
  fieldLabel: { marginRight: 6, flexShrink: 0 },
  underlineBox: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    justifyContent: "flex-end",
    position: "relative",
  },
  underlineText: { fontSize: 10, paddingHorizontal: 2, zIndex: 2 },
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
  sigName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 2,
  },
  sigRole: {
    fontSize: 8,
    marginTop: 2,
    textAlign: "center",
  },
  applicantSignature: {
    height: 35,
    width: 120,
    objectFit: "contain",
    position: "absolute",
    bottom: 2,
  },
  approverSignatureAbove: {
    height: 35,
    width: 120,
    objectFit: "contain",
    position: "absolute",
    bottom: 12,
  },
  initialsContainer: {
    position: "absolute",
    top: "110%",
    right: 0,
    flexDirection: "row",
    paddingTop: 2,
  },
  approverInitialUnder: {
    height: 20,
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

  // Keep these in sync with LEDGER_COLS (used to fit text inside the cells).
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
    paddingRight: 30,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  footerBlock: { width: 180, alignItems: "center" },
  footerDateLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    width: 150,
    height: 14,
    marginTop: 10,
    justifyContent: "flex-end",
  },
  footerDateLabel: { textAlign: "center", fontSize: 9, marginTop: 2 },
  boldText: { fontWeight: "bold" },
  textCenter: { textAlign: "center" },

  // Long text handling
  clipBox: { overflow: "hidden" },
  continuedNote: { fontFamily: "Helvetica-Oblique" },
  remarksBlock: {
    marginLeft: CHECKBOX_SPACE,
    marginTop: -6,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingHorizontal: 2,
    paddingBottom: 1,
  },

  // Attachment page
  annexMeta: { marginBottom: 12 },
  annexMetaRow: { flexDirection: "row", marginBottom: 3 },
  annexMetaLabel: { fontFamily: "Helvetica-Bold", width: 90 },
  annexHeading: { fontFamily: "Helvetica-Bold", marginBottom: 4 },
  annexBox: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 10,
    marginBottom: 14,
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
  children,
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
        {children}
      </Text>
    </View>
  );
}

function LabeledUnderlineRow({
  label,
  value,
  lineWidth,
  lineFlex = 1,
  labelStyle,
  align = "center",
  fit, // optional result of fitText() for long, multi-line values
}) {
  if (!fit) {
    return (
      <View style={styles.fieldRow}>
        <Text style={[styles.label, styles.fieldLabel, labelStyle]}>
          {label}
        </Text>
        <UnderlineBox
          value={value}
          width={lineWidth}
          flex={lineFlex}
          align={align}
        />
      </View>
    );
  }

  // Multi-line value: label sits at the top, text shrinks to fit, and the box is
  // capped (and clipped as a last resort) so it can't push the rest of the form down.
  return (
    <View style={[styles.fieldRow, { alignItems: "flex-start" }]}>
      <Text style={[styles.label, styles.fieldLabel, labelStyle]}>{label}</Text>
      <UnderlineBox
        value={fit.text}
        width={lineWidth}
        flex={lineFlex}
        align={align}
        textStyle={{
          fontSize: fit.fontSize,
          // Set explicitly: otherwise the page's 10pt line spacing is inherited.
          lineHeight: LINE_HEIGHT,
          paddingTop: baselinePad(fit.fontSize),
        }}
        boxStyle={[styles.clipBox, { maxHeight: fit.maxHeight + 6 }]}
      >
        {fit.overflow ? (
          <Text style={styles.continuedNote}>{CONTINUED_NOTE}</Text>
        ) : null}
      </UnderlineBox>
    </View>
  );
}

// Table-cell text sized by fitCell().
function FittedCellText({ fit }) {
  return (
    <Text style={{ fontSize: fit.fontSize, lineHeight: LINE_HEIGHT }}>
      {fit.text}
    </Text>
  );
}

const SlotSignatures = ({
  mainApprover,
  initialApprovers = [],
  fallbackName,
  fallbackRole,
  marginTop = 30,
  lineWidth = "90%",
}) => {
  if (!mainApprover && (!initialApprovers || initialApprovers.length === 0)) {
    return (
      <View style={[styles.sigBlock, { marginTop }]}>
        <View style={[styles.sigLine, { width: lineWidth }]}>
          <Text style={styles.sigName}>{fallbackName}</Text>
        </View>
        <Text style={styles.sigRole}>{fallbackRole}</Text>
      </View>
    );
  }

  const getSigUrl = (appr) => {
    if (appr?.status === "APPROVED") {
      return safeImageUrl(
        appr.approverSnapshot?.signatureUrl ||
          appr.approverSignature?.signatureUrl,
      );
    }
    return null;
  };

  const mainName = mainApprover?.approverSnapshot
    ? getFullApproverName(mainApprover.approverSnapshot)
    : mainApprover?.approver
      ? getFullApproverName(mainApprover.approver)
      : fallbackName;

  const mainRole =
    mainApprover?.approverSnapshot?.position ||
    mainApprover?.approver?.position ||
    fallbackRole;

  const mainSigUrl = getSigUrl(mainApprover);
  const initialsToRender = initialApprovers.filter(Boolean);

  return (
    <View style={[styles.sigBlock, { marginTop }]}>
      <View style={[styles.sigLine, { width: lineWidth }]}>
        {mainSigUrl && (
          <Image src={mainSigUrl} style={styles.approverSignatureAbove} />
        )}

        <Text style={styles.sigName}>{mainName}</Text>

        {initialsToRender.length > 0 && (
          <View style={styles.initialsContainer}>
            {initialsToRender.map((appr, idx) => {
              const url = getSigUrl(appr);
              if (!url) return null;
              return (
                <Image
                  key={idx}
                  src={url}
                  style={styles.approverInitialUnder}
                />
              );
            })}
          </View>
        )}
      </View>
      <Text style={styles.sigRole}>{mainRole}</Text>
    </View>
  );
};

/* =========================
   PDF Component
========================= */
export default function CtoApplicationPdf({
  app,
  logoSrc = "/public/logo_dict.png",
  recommendingApproverLabel = "Chief, Technical Operations Division",
  approvedLabel = "Regional Director",
  adminFinanceLabel = "Chief, Admin. & Finance Div.",
}) {
  const applicantSnap = app?.applicantSnapshot || {};
  const emp = app?.employee || {};
  const firstName = applicantSnap.firstName || emp.firstName || "";
  const lastName = applicantSnap.lastName || emp.lastName || "";
  const middleName = applicantSnap.middleName || emp.middleName || "";

  let employeeName =
    firstName || lastName
      ? `${firstName} ${middleName} ${lastName}`
          .trim()
          .replace(/\s+/g, " ")
          .toUpperCase()
      : "";

  const position = applicantSnap.position || emp.position || "";

  const officeDivision =
    applicantSnap.division ||
    applicantSnap.officeDivision ||
    emp.division ||
    emp.officeDivision ||
    emp.office ||
    "";

  const dateOfFiling = fmtDateLong(app?.createdAt) || "";
  const requestedHours = safeNumber(app?.requestedHours) || "";
  const inclusiveDates = formatInclusiveDates(app?.inclusiveDates) || "";
  const reason = app?.reason || "";

  const dayCount = Array.isArray(app?.inclusiveDates)
    ? app.inclusiveDates.length
    : "";
  const applicantSigUrl = safeImageUrl(
    app?.applicantSignatureUrl || emp.signature,
  );
  let applicantSigText =
    !applicantSigUrl && (lastName || firstName)
      ? `Digitally signed\nby ${lastName}\n${firstName}`
      : null;

  const approvals = app?.approvals || [];

  const recInitial = approvals.find(
    (a) => a.role === "Recommending Approval Initial",
  );
  const recSignature = approvals.find(
    (a) => a.role === "Recommending Approval",
  );
  const afdInitial = approvals.find((a) => a.role === "AFD Chief Initial");
  const afdSignature = approvals.find((a) => a.role === "AFD Chief Signature");
  const hrInitial = approvals.find((a) => a.role === "HR Initial");
  const ardSignature = approvals.find((a) => a.role === "ARD Signature");
  const rdSignature = approvals.find(
    (a) => a.role === "Regional Director Signature",
  );

  const isAfdDivision =
    officeDivision.toUpperCase().includes("AFD") ||
    officeDivision.toUpperCase().includes("ADMIN");

  const activeRecSignature = isAfdDivision ? afdSignature : recSignature;
  const activeRecInitial = isAfdDivision ? [] : [recInitial];
  const activeRecFallbackRole = isAfdDivision
    ? adminFinanceLabel
    : recommendingApproverLabel;

  const isRevoked =
    String(app?.overallStatus || "").toUpperCase() === "REVOKED";

  // ✅ Check if fully approved (or revoked later) to show checkmarks
  const isApprovedStatus = [
    "APPROVED",
    "REVOKED",
    "REVOCATION_REQUESTED",
  ].includes(String(app?.overallStatus || "").toUpperCase());

  const getSigDate = (sig) =>
    sig?.status === "APPROVED"
      ? sig?.actionDate || sig?.updatedAt || sig?.createdAt
      : null;

  // ✅ Prioritizes the action date of the AFD Chief, falling back to final approvers
  const rawApprovalDate =
    getSigDate(afdSignature) ||
    getSigDate(rdSignature) ||
    getSigDate(ardSignature) ||
    app?.approvedAt ||
    (isApprovedStatus ? app?.updatedAt : null);

  const formattedApprovalDate = rawApprovalDate
    ? fmtDateLong(rawApprovalDate)
    : "";

  const ledger = app?.ledger || {
    balanceForwarded: 0,
    transactions: [],
    endingBalance: 0,
  };
  const transactions = ledger.transactions || [];
  const balanceForwarded = safeNumber(ledger.balanceForwarded);
  const endingBalance = safeNumber(ledger.endingBalance);

  /* ---- Long text fitting ---- */
  const reasonWidth = valueWidthAfterLabel("Purpose/Reason:");
  const reasonFitRaw = fitText(reason, {
    width: reasonWidth,
    maxHeight: REASON_MAX_HEIGHT,
  });
  const reasonFit = {
    ...reasonFitRaw,
    text: breakLongWords(reasonFitRaw.text, reasonFitRaw.fontSize, reasonWidth),
  };

  const inclusiveDatesFit = fitText(inclusiveDates, {
    width: valueWidthAfterLabel("Inclusive Date/s:"),
    maxHeight: 3 * 10 * LINE_HEIGHT, // up to three 10pt lines' worth
  });

  const isRejected = app?.overallStatus === "REJECTED";
  const remarks = isRejected ? String(app?.remarks || "").trim() : "";
  const inlineRemarksWidth =
    RIGHT_COL_TEXT_WIDTH -
    CHECKBOX_SPACE -
    textWidth("Disapproved due to ", 10) -
    4;
  // Short remarks stay on the original inline line; longer ones go on their own
  // full-width line(s) under the checkbox row.
  const remarksInline = textWidth(remarks, 10) <= inlineRemarksWidth;
  const remarksWidth = RIGHT_COL_TEXT_WIDTH - CHECKBOX_SPACE - 4;
  const remarksFitRaw = remarksInline
    ? null
    : fitText(remarks, {
        width: remarksWidth,
        maxHeight: REMARKS_MAX_HEIGHT,
        sizes: [9, 8, 7],
      });
  const remarksFit = remarksFitRaw && {
    ...remarksFitRaw,
    text: breakLongWords(
      remarksFitRaw.text,
      remarksFitRaw.fontSize,
      remarksWidth,
    ),
  };

  /* ---- Certificate rows: share whatever room is left on page 1 ---- */
  const extraFieldLines = [
    ["Name:", employeeName],
    ["Position:", position],
    ["Office/Division:", officeDivision],
  ].reduce(
    (sum, [label, value]) =>
      sum + countLines(value, 10, valueWidthAfterLabel(label)) - 1,
    0,
  );
  const datesHeight =
    baselinePad(inclusiveDatesFit.fontSize) +
    fitHeight(inclusiveDatesFit, valueWidthAfterLabel("Inclusive Date/s:"));
  const reasonHeight =
    baselinePad(reasonFit.fontSize) + fitHeight(reasonFit, reasonWidth);
  const leftColumnBottom =
    LAYOUT.reasonRowTop +
    extraFieldLines * ROW_LINE +
    Math.max(0, datesHeight - ROW_LINE) +
    Math.max(ROW_LINE, reasonHeight) +
    2 + // underline padding + border
    17; // row margin + column padding + box border
  const rightColumnBottom =
    LAYOUT.rightColumnBottom +
    (remarksFit ? fitHeight(remarksFit, remarksWidth) + 6 : 0);
  const topBoxBottom = Math.max(leftColumnBottom, rightColumnBottom);

  const { rows: ledgerRows, padV: rowPadV } = fitLedgerRows(
    transactions,
    LAYOUT.rowsBottomLimit -
      (topBoxBottom + LAYOUT.belowTopBox) -
      LAYOUT.safety,
  );
  const rowCellPad = { paddingVertical: rowPadV };

  const paddedTransactions = [...ledgerRows];
  while (paddedTransactions.length < 2) {
    paddedTransactions.push({ isEmpty: true });
  }

  // Anything that still doesn't fit is printed in full on an attachment page.
  const attachments = [
    reasonFit.overflow && { title: "Purpose/Reason", text: reason },
    inclusiveDatesFit.overflow && {
      title: "Inclusive Date/s",
      text: inclusiveDates,
    },
    remarksFit?.overflow && { title: "Disapproved due to", text: remarks },
  ].filter(Boolean);

  const watermark = isRevoked ? (
    <View style={styles.watermarkContainer} fixed>
      <Text style={styles.watermarkText}>REVOKED</Text>
    </View>
  ) : null;

  return (
    <Document title={`CTO Application - ${lastName || "Applicant"}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={logoSrc} style={styles.logo} />
        </View>

        <Text style={styles.formTitle}>
          APPLICATION FOR AVAILMENT OF COMPENSATORY TIME-OFF (CTO)
        </Text>

        <View style={styles.topBox}>
          <View style={styles.topLeft}>
            <LabeledUnderlineRow
              label="Name:"
              value={employeeName}
              lineFlex={1}
              align="left"
            />
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
            <LabeledUnderlineRow
              label="Position:"
              value={position}
              lineFlex={1}
              align="left"
            />
            <LabeledUnderlineRow
              label="Office/Division:"
              value={officeDivision}
              lineFlex={1}
              align="left"
            />
            <LabeledUnderlineRow
              label="Date of Filing:"
              value={dateOfFiling}
              lineFlex={1}
              align="center"
            />
            <LabeledUnderlineRow
              label="No. of working hours applied for:"
              value={requestedHours ? `${requestedHours} Hours` : ""}
              lineFlex={1}
              align="center"
            />
            <LabeledUnderlineRow
              label="Inclusive Date/s:"
              lineFlex={1}
              align="center"
              fit={inclusiveDatesFit}
            />
            <LabeledUnderlineRow
              label="Purpose/Reason:"
              lineFlex={1}
              align="left"
              fit={reasonFit}
            />
          </View>

          <View style={styles.topRight}>
            <Text style={styles.actionTitle}>ACTION OF APPLICATION</Text>

            {/* ✅ SVG Checkbox for Guaranteed Rendering */}
            <View style={styles.actionRow}>
              <View style={styles.checkbox}>
                {isApprovedStatus && dayCount ? (
                  <Svg viewBox="0 0 24 24" width={14} height={14}>
                    <Path
                      d="M20 6L9 17l-5-5"
                      stroke="black"
                      strokeWidth="2.5"
                      fill="none"
                    />
                  </Svg>
                ) : null}
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
                {isRejected ? (
                  <Svg viewBox="0 0 24 24" width={14} height={14}>
                    <Path
                      d="M20 6L9 17l-5-5"
                      stroke="black"
                      strokeWidth="2.5"
                      fill="none"
                    />
                  </Svg>
                ) : null}
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
              <View
                style={[
                  styles.remarksBlock,
                  styles.clipBox,
                  { maxHeight: REMARKS_MAX_HEIGHT + 4 },
                ]}
              >
                <Text
                  style={{
                    fontSize: remarksFit.fontSize,
                    lineHeight: LINE_HEIGHT,
                  }}
                >
                  {remarksFit.text}
                  {remarksFit.overflow ? (
                    <Text style={styles.continuedNote}>{CONTINUED_NOTE}</Text>
                  ) : null}
                </Text>
              </View>
            )}

            <Text style={[styles.approvalLabelLeft, { marginBottom: 25 }]}>
              Recommending Approval:
            </Text>
            <SlotSignatures
              mainApprover={activeRecSignature}
              initialApprovers={activeRecInitial}
              fallbackName=""
              fallbackRole={activeRecFallbackRole}
              marginTop={25}
              lineWidth="95%"
            />

            <Text style={[styles.approvalLabelLeft, { marginTop: 25 }]}>
              Approved:
            </Text>
            <SlotSignatures
              mainApprover={rdSignature || ardSignature}
              initialApprovers={[afdSignature]}
              fallbackName=""
              fallbackRole={approvedLabel}
              marginTop={25}
              lineWidth="95%"
            />
          </View>
        </View>

        <View style={styles.detachRow}>
          <Text style={styles.detachText}>Detach for Time Keeper’s Record</Text>
        </View>
        <View style={styles.dashedLine} />

        <Text style={styles.certificateTitle}>
          CERTIFICATE OF COMPENSATORY CREDITS
        </Text>

        <View style={styles.certBox}>
          {/* `fixed`: the header repeats if the table ever continues onto another page */}
          <View style={styles.gridRow} wrap={false} fixed>
            <View style={[styles.gridHeaderCell, styles.colDate]}>
              <Text>Date</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.colPart]}>
              <Text>Particulars</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.colEarned]}>
              <Text>
                Compensatory{"\n"}Overtime{"\n"}Credits
              </Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.colAvail]}>
              <Text>Number of{"\n"}CTO Availed</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.colBal]}>
              <Text>COC{"\n"}Balance</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.colRem]}>
              <Text>Remarks</Text>
            </View>
          </View>

          <View style={styles.gridRow} wrap={false}>
            <View style={[styles.gridCell, styles.colMerged]}>
              <Text style={styles.boldText}>Balance Forwarded</Text>
            </View>
            <View style={[styles.gridCell, styles.colBal, styles.textCenter]}>
              <Text>{balanceForwarded} Hrs.</Text>
            </View>
            <View style={[styles.gridCell, styles.colRem]}>
              <Text> </Text>
            </View>
          </View>

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
            // If the table must continue on the next page, take the last row
            // along with Ending Balance and the signature instead of leaving
            // the signature alone there.
            const isLastRow = idx === paddedTransactions.length - 1;

            return (
              <View
                style={styles.gridRow}
                key={idx}
                wrap={false}
                minPresenceAhead={isLastRow ? KEEP_WITH_FOOTER : 0}
              >
                <View
                  style={[
                    styles.gridCell,
                    styles.colDate,
                    styles.clipBox,
                    rowCellPad,
                  ]}
                >
                  <FittedCellText fit={t.dateFit} />
                </View>
                <View
                  style={[
                    styles.gridCell,
                    styles.colPart,
                    styles.clipBox,
                    rowCellPad,
                  ]}
                >
                  <FittedCellText fit={t.particularsFit} />
                </View>
                <View
                  style={[
                    styles.gridCell,
                    styles.colEarned,
                    styles.textCenter,
                    rowCellPad,
                  ]}
                >
                  <Text>{isAccrual ? `${t.amount} Hrs.` : ""}</Text>
                </View>
                <View
                  style={[
                    styles.gridCell,
                    styles.colAvail,
                    styles.textCenter,
                    rowCellPad,
                  ]}
                >
                  <Text>{!isAccrual ? `${Math.abs(t.amount)} Hrs.` : ""}</Text>
                </View>
                <View
                  style={[
                    styles.gridCell,
                    styles.colBal,
                    styles.textCenter,
                    rowCellPad,
                  ]}
                >
                  <Text>{t.runningBalance} Hrs.</Text>
                </View>
                <View style={[styles.gridCell, styles.colRem, rowCellPad]}>
                  <Text> </Text>
                </View>
              </View>
            );
          })}

          <View style={styles.gridRow} wrap={false}>
            <View style={[styles.gridCell, styles.colMerged]}>
              <Text style={styles.boldText}>Ending Balance</Text>
            </View>
            <View style={[styles.gridCell, styles.colBal, styles.textCenter]}>
              <Text>{endingBalance} Hrs.</Text>
            </View>
            <View style={[styles.gridCell, styles.colRem]}>
              <Text> </Text>
            </View>
          </View>

          <View style={styles.certFooter} wrap={false}>
            <View style={styles.footerBlock}>
              <SlotSignatures
                mainApprover={afdSignature}
                initialApprovers={[hrInitial]}
                fallbackName=""
                fallbackRole={adminFinanceLabel}
                marginTop={30}
                lineWidth="100%"
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

        {watermark}
      </Page>

      {attachments.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Image src={logoSrc} style={styles.logo} />
          </View>
          <Text style={styles.formTitle}>
            ATTACHMENT TO APPLICATION FOR AVAILMENT OF COMPENSATORY TIME-OFF
            (CTO)
          </Text>

          <View style={styles.annexMeta}>
            <View style={styles.annexMetaRow}>
              <Text style={styles.annexMetaLabel}>Name:</Text>
              <Text>{employeeName}</Text>
            </View>
            <View style={styles.annexMetaRow}>
              <Text style={styles.annexMetaLabel}>Date of Filing:</Text>
              <Text>{dateOfFiling}</Text>
            </View>
          </View>

          {attachments.map((item, i) => (
            <View key={i} wrap={false}>
              <Text style={styles.annexHeading}>
                {item.title} (continued from page 1)
              </Text>
              <View style={styles.annexBox}>
                <Text>{item.text}</Text>
              </View>
            </View>
          ))}

          {watermark}
        </Page>
      )}
    </Document>
  );
}
