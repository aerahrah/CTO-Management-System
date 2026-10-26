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

// ✅ Import your buildApiUrl utility so the PDF can construct absolute URLs for the signatures
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

function formatInclusiveDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return "";
  const sorted = dates
    .map((x) => new Date(x))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (sorted.length === 0) return "";
  if (sorted.length === 1) return fmtDateLong(sorted[0]);

  return `${fmtDateLong(sorted[0])} to ${fmtDateLong(sorted[sorted.length - 1])}`;
}

// ✅ Safe URL Wrapper to prevent Buffer errors on relative signature paths
function safeImageUrl(url) {
  if (!url) return null;
  // If it's already an absolute HTTP URL, return it. Otherwise, prepend backend URL.
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
   the right edge instead of running into the next cell, and the layout below
   can work out exactly how tall the form will be.
========================= */
const LH = 1.1; // react-pdf's default line height for Helvetica
const lineH = (size) => size * LH;
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
 * line. `widths` is the line width, or [firstLineWidth, otherLinesWidth] when
 * the first line shares its row with a label. Words wider than a whole line
 * (memo numbers, URLs) are broken, preferably right after a "-", "/" or ".".
 */
function wrapLines(text, size, widths, bold = true) {
  const value = String(text ?? "").trim();
  if (!value) return [];
  const [firstW, restW] = Array.isArray(widths) ? widths : [widths, widths];
  const lines = [];
  const maxW = () => (lines.length === 0 ? firstW : restW) - WRAP_SAFETY;

  for (const paragraph of value.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, bold) <= maxW()) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      } else if (
        lines.length === 0 &&
        textWidth(word, size, bold) <= restW - WRAP_SAFETY
      ) {
        // The word is too long for the short first line but fits a full line:
        // leave the first line blank rather than splitting the word.
        lines.push("");
      }
      let rest = word;
      while (textWidth(rest, size, bold) > maxW()) {
        const piece = fitPrefix(rest, size, maxW(), bold);
        lines.push(piece);
        rest = rest.slice(piece.length);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

// Largest size (from `sizes`) at which `text` fits on one line of `width`.
function oneLineSize(
  text,
  width,
  sizes = [9, 8.5, 8, 7.5, 7, 6.5, 6],
  bold = true,
) {
  return (
    sizes.find((s) => textWidth(text, s, bold) <= width - WRAP_SAFETY) ??
    sizes[sizes.length - 1]
  );
}

/* =========================
   Page geometry (points) — derived from the styles below
========================= */
const PAGE = { width: 595.28, height: 841.89, pad: 20 };
const FORM_INNER = PAGE.width - PAGE.pad * 2 - 2; // inside the 1pt form border
const colWidth = (pct, padX, borderRight = 0) =>
  FORM_INNER * pct - padX * 2 - borderRight;

const LABEL_GAP = 3; // space between an inline label and its underline
const RULE_PAD = 2; // horizontal padding inside inline underlines
const RULE_MIN = 12; // minimum height of an underline box
const CONT_GAP = 2; // space above each continuation line
const labelW = (label) => textWidth(label, 8) + LABEL_GAP;
const CHECKBOX_W = 12; // 8pt box + 4pt margin

const W = (() => {
  const dateCell = colWidth(0.3, 4, 1);
  const positionCell = colWidth(0.4, 4, 1);
  const salaryCell = colWidth(0.3, 4);
  const sixB = colWidth(0.5, 4) - 10; // minus the 10pt indent of the sub-block
  const sevenD = colWidth(0.5, 4) - 10;
  return {
    office: colWidth(0.4, 2, 1),
    namePart: colWidth(0.6, 2) / 3,
    dateFirst: dateCell - labelW("3. DATE OF FILING") - RULE_PAD * 2,
    dateRest: dateCell - RULE_PAD * 2,
    positionFirst: positionCell - labelW("4. POSITION") - RULE_PAD * 2,
    positionRest: positionCell - RULE_PAD * 2,
    salaryFirst: salaryCell - labelW("5. SALARY") - RULE_PAD * 2,
    salaryRest: salaryCell - RULE_PAD * 2,
    locationFirst:
      sixB - CHECKBOX_W - labelW("Within the Philippines") - RULE_PAD * 2,
    locationRest: sixB - CHECKBOX_W - RULE_PAD * 2,
    dates: colWidth(0.5, 4, 1) - 40 - 10, // 20pt side margins + 5pt padding
    others: colWidth(0.5, 4, 1) - 40 - 10, // "Others:" line in 6.A
    asOf: 110 - 10,
    remarks: sevenD - 10,
    sigLine7A: colWidth(0.5, 4, 1) * 0.8,
    sigLine7B: colWidth(0.5, 4) * 0.8,
    sigLineFinal: (FORM_INNER - 20) * 0.5,
  };
})();

/* =========================
   Page budget
   Measured from the rendered form. They only change if the fixed parts of the
   form change (logo, checkbox lists, certification table, paddings): if you
   edit those, re-measure these numbers or the form may spill onto page 2.
========================= */
const LAYOUT = {
  // Top edge of the form border: page padding + header (logo 45pt or
  // placeholder 40pt) + gap + title line + gap.
  formTop: (hasLogo, sp) =>
    PAGE.pad + (hasLogo ? 45 : 40) + sp.headerGap + lineH(16) + sp.titleGap,
  sectionTitle: 18, // grey section title bar
  col6AFixed: 210.6, // 6.A column without the "Others" line
  col6BFixed: 204.8, // 6.B column without the "Within the Philippines" field
  col6D: 82.6, // 6.D column
  col7AFixed: 94.0, // 7.A column without its signature block
  col7BFixed: 99.8, // 7.B column (incl. its 10pt bottom margin) without its signature block
  col7C: 64.8, // 7.C column
  bottomLimit: PAGE.height - PAGE.pad - 1, // the form must end above this
};

const ruleH = (size) => Math.max(RULE_MIN, lineH(size) + 2); // + padding + border
const inlineFieldH = (lines, size) =>
  ruleH(size) + Math.max(0, lines - 1) * (CONT_GAP + ruleH(size));

// Signature block: space above the line for the signature image, the line with
// the printed name, then the position.
const SIG_IMAGE_H = 35;
const INITIALS_H = 20; // initials image height
const INITIALS_OVERHANG = 10; // how far initials may hang into the padding below
const sigImageBottom = (nameH) => Math.max(12, nameH + 2);
const sigLineH = (nameH) => Math.max(15, nameH + 1);
const sigRoomAbove = (nameH) =>
  sigImageBottom(nameH) + SIG_IMAGE_H - (sigLineH(nameH) - 1);

function layoutSignature(input, [nameSize, roleSize]) {
  const {
    mainApprover,
    initialApprovers = [],
    fallbackName,
    fallbackRole,
  } = input;

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

  // ✅ Use updated helper to extract Titles, First, Middle, Last, Extensions dynamically
  const name = useFallback
    ? fallbackName
    : mainApprover?.approverSnapshot
      ? getFullApproverName(mainApprover.approverSnapshot)
      : mainApprover?.approver
        ? getFullApproverName(mainApprover.approver)
        : fallbackName;

  const role = useFallback
    ? fallbackRole
    : mainApprover?.approverSnapshot?.position ||
      mainApprover?.approver?.position ||
      fallbackRole;

  const sigUrl = useFallback ? null : getSigUrl(mainApprover);
  const initialUrls = useFallback
    ? []
    : initialApprovers.filter(Boolean).map(getSigUrl).filter(Boolean);

  // The initials (paraphs) sit under the right end of the line, and the
  // position text always keeps clear of them:
  //  - a short position stays centred beside them, as on the printed form;
  //  - a longer one uses the full line width, and the initials sit beside its
  //    last lines if those leave room on the right, otherwise below it.
  const lineWidth = input.lineWidth;
  const initialsReserve = initialUrls.length ? 10 + initialUrls.length * 45 : 0;
  const safeWidth = Math.max(40, lineWidth - initialsReserve * 2);
  const roleLH = lineH(roleSize);

  let roleLines;
  let rolePadding = 0;
  let initialsLine = 0; // role line the initials start beside
  if (!initialUrls.length) {
    roleLines = wrapLines(role, roleSize, lineWidth, false);
  } else {
    const beside = wrapLines(role, roleSize, safeWidth, false);
    if (beside.length <= 2) {
      roleLines = beside;
      rolePadding = initialsReserve;
    } else {
      roleLines = wrapLines(role, roleSize, lineWidth, false);
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
  const initialsTop = initialsLine * roleLH;
  // Space under the line: the position text, or the initials if they reach
  // lower (they may hang into the block's bottom padding, as before).
  const underH = initialUrls.length
    ? Math.max(roleH, initialsTop + INITIALS_H - INITIALS_OVERHANG)
    : roleH;
  // A multi-line name pushes the signature image up; add the same amount of
  // space above so the image never reaches into the content above it.
  const extraTop = sigUrl
    ? Math.max(0, sigRoomAbove(nameH) - sigRoomAbove(lineH(9)))
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

/* ---- What the fitting step may adjust ---- */
// Spare spacing that can be tightened (barely visible), used before any text shrinks.
const SPACING_LEVERS = ["tightHeader", "tightSignatures", "tightRemarks"];
// Fields that can grow, and the sizes they may shrink to.
const SIZES = [9, 8, 7];
const SIG_SIZES = [
  [9, 8], // [printed name, position]
  [8, 7],
  [7, 6.5],
];
const FIELDS = [
  "office",
  "name",
  "position",
  "others",
  "location",
  "dates",
  "remarks",
  "sigHR",
  "sigRec",
  "sigFinal",
];
const maxLevel = (k) =>
  SPACING_LEVERS.includes(k)
    ? 1
    : (k.startsWith("sig") ? SIG_SIZES : SIZES).length - 1;

function layoutFields(data, level) {
  const s = (f) => SIZES[level[f]];
  const nameSize = s("name");

  // Date of filing and salary are short values: they shrink to stay on one line.
  const dateSize = oneLineSize(data.dateOfFiling, W.dateFirst);
  const salarySize = oneLineSize(data.salaryText, W.salaryFirst);

  return {
    spacing: {
      headerGap: level.tightHeader ? 4 : 10, // below the logo
      titleGap: level.tightHeader ? 2 : 5, // below "APPLICATION FOR LEAVE"
      sig7: level.tightSignatures ? 34 : 40, // room for the 7.A / 7.B signatures
      sigFinal: level.tightSignatures ? 23 : 25, // room for the final signature
      tightRemarks: Boolean(level.tightRemarks), // 7.D rule spacing
    },
    office: {
      size: s("office"),
      lines: wrapLines(data.office, s("office"), W.office),
    },
    name: {
      size: nameSize,
      last: wrapLines(data.displayLastName, nameSize, W.namePart),
      first: wrapLines(data.displayFirstName, nameSize, W.namePart),
      middle: wrapLines(data.middleName, nameSize, W.namePart),
    },
    date: {
      size: dateSize,
      lines: wrapLines(data.dateOfFiling, dateSize, [W.dateFirst, W.dateRest]),
    },
    position: {
      size: s("position"),
      lines: wrapLines(data.position, s("position"), [
        W.positionFirst,
        W.positionRest,
      ]),
    },
    salary: {
      size: salarySize,
      lines: wrapLines(data.salaryText, salarySize, [
        W.salaryFirst,
        W.salaryRest,
      ]),
    },
    others: {
      size: s("others"),
      lines: wrapLines(data.others, s("others"), W.others),
    },
    location: {
      size: s("location"),
      lines: wrapLines(data.location, s("location"), [
        W.locationFirst,
        W.locationRest,
      ]),
    },
    dates: {
      size: s("dates"),
      lines: wrapLines(data.inclusiveDates, s("dates"), W.dates),
    },
    remarks: {
      size: s("remarks"),
      lines: wrapLines(data.remarks, s("remarks"), W.remarks),
    },
    sigHR: layoutSignature(data.sigs.hr, SIG_SIZES[level.sigHR]),
    sigRec: layoutSignature(data.sigs.rec, SIG_SIZES[level.sigRec]),
    sigFinal: layoutSignature(data.sigs.final, SIG_SIZES[level.sigFinal]),
  };
}

// Space above each ruled line in 7.D: three lines for short remarks; longer
// remarks continue on as many lines as they need, spaced more tightly.
function remarksRules(lineCount, tight) {
  if (lineCount <= 3) return tight ? [4, 4, 4] : [4, 8, 8];
  return Array.from({ length: lineCount }, (_, i) => (i === 0 ? 4 : CONT_GAP));
}

// Works out the height of every row of the form for a given layout.
function measureForm(L, hasLogo) {
  const sp = L.spacing;
  const maxLines = (...arrs) => Math.max(...arrs.map((a) => a.length));
  const rows = {};

  rows.row1 =
    Math.max(
      2 + 8.8 + 4 + L.office.lines.length * lineH(L.office.size) + 2,
      2 +
        8.8 +
        4 +
        maxLines(L.name.last, L.name.first, L.name.middle) *
          lineH(L.name.size) +
        1 +
        7.7 +
        2,
    ) + 1;

  rows.row2 =
    Math.max(
      ...[L.date, L.position, L.salary].map(
        (f) => 4 + inlineFieldH(Math.max(1, f.lines.length), f.size) + 4,
      ),
    ) + 1;

  rows.row3 =
    Math.max(
      LAYOUT.col6AFixed +
        inlineFieldH(Math.max(1, L.others.lines.length), L.others.size),
      LAYOUT.col6BFixed +
        inlineFieldH(Math.max(1, L.location.lines.length), L.location.size),
    ) + 1;

  const datesH = Math.max(1, L.dates.lines.length);
  rows.row4 =
    Math.max(
      4 +
        8.8 +
        (4 + RULE_MIN) +
        8 +
        8.8 +
        4 +
        inlineFieldH(datesH, L.dates.size) +
        4,
      LAYOUT.col6D,
    ) + 1;

  rows.row5 =
    Math.max(
      LAYOUT.col7AFixed + L.sigHR.height(sp.sig7),
      LAYOUT.col7BFixed + L.sigRec.height(sp.sig7),
    ) + 1;

  const rules = remarksRules(L.remarks.lines.length, sp.tightRemarks);
  rows.row6 = Math.max(
    LAYOUT.col7C,
    4 +
      8.8 +
      4 +
      rules.reduce((sum, gap) => sum + gap + ruleH(L.remarks.size), 0) +
      4,
  );

  rows.final = 10 + L.sigFinal.height(sp.sigFinal) + 10;

  const bottom =
    LAYOUT.formTop(hasLogo, sp) +
    1 +
    rows.row1 +
    rows.row2 +
    LAYOUT.sectionTitle +
    rows.row3 +
    rows.row4 +
    LAYOUT.sectionTitle +
    rows.row5 +
    rows.row6 +
    rows.final +
    1;

  return { rows, bottom };
}

/**
 * Keeps the form on one page without ever cutting text:
 *  1. Everything starts at full size; long values wrap onto extra lines.
 *  2. If that spills past the page, spare spacing is tightened first.
 *  3. Then fields are shrunk one size at a time (9 → 8 → 7pt), always picking
 *     the change that saves the most height, so only fields that actually
 *     make the form longer get smaller.
 *  4. If even that can't fit one page, everything stays full size and the
 *     form continues on page 2.
 */
function fitForm(data) {
  const evaluate = (level) => {
    const L = layoutFields(data, level);
    return { level, L, ...measureForm(L, data.hasLogo) };
  };
  const start = evaluate(
    Object.fromEntries([...SPACING_LEVERS, ...FIELDS].map((k) => [k, 0])),
  );
  let cur = start;

  const improve = (keys) => {
    while (cur.bottom > LAYOUT.bottomLimit) {
      const open = keys.filter((k) => cur.level[k] < maxLevel(k));
      let best = null;
      const tryStep = (...ks) => {
        const level = { ...cur.level };
        ks.forEach((k) => (level[k] += 1));
        const next = evaluate(level);
        const gain = (cur.bottom - next.bottom) / ks.length;
        if (gain > 0.01 && (!best || gain > best.gain + 0.01)) {
          best = { ...next, gain };
        }
      };
      open.forEach((k) => tryStep(k));
      // Fields side by side in one row only save space when both shrink.
      if (!best) {
        open.forEach((a, i) => open.slice(i + 1).forEach((b) => tryStep(a, b)));
      }
      if (!best) return;
      cur = best;
    }
  };

  improve(SPACING_LEVERS);
  improve(FIELDS);
  return cur.bottom <= LAYOUT.bottomLimit ? cur.L : start.L;
}

/* =========================
   Styles
========================= */
const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE.pad,
    paddingHorizontal: PAGE.pad,
    paddingBottom: PAGE.pad,
    fontFamily: "Helvetica",
  },

  /* --- Header --- */
  headerWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  headerLogoArea: {
    flexDirection: "row",
    alignItems: "center",
    width: "70%",
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: "#eee",
    marginRight: 10,
  },
  stampBox: {
    width: 100,
    height: 35,
    borderWidth: 1,
    borderColor: "#000",
    padding: 2,
  },
  stampText: {
    fontSize: 6,
    textAlign: "center",
  },
  formTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 5,
  },

  /* --- Grid System --- */
  formBorder: {
    borderWidth: 1,
    borderColor: "#000",
    width: "100%",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },
  colRightBorder: {
    borderRightWidth: 1,
    borderRightColor: "#000",
  },

  /* --- Columns (widths must match W above) --- */
  colOffice: { width: "40%", padding: 2 },
  colName: { width: "60%", padding: 2 },
  colDate: { width: "30%", padding: 4 },
  colPosition: { width: "40%", padding: 4 },
  colSalary: { width: "30%", padding: 4 },
  col6A: { width: "50%", padding: 4 },
  col6B: { width: "50%", padding: 4 },
  col6C: { width: "50%", padding: 4 },
  col6D: { width: "50%", padding: 4 },
  col7A: { width: "50%", padding: 4 },
  col7B: { width: "50%", padding: 4, marginBottom: 10 },
  col7C: { width: "50%", padding: 4 },
  col7D: { width: "50%", padding: 4 },
  finalSig: { padding: 10, marginBottom: 0 },

  /* --- Cell Padding & Text --- */
  labelTitle: {
    fontSize: 8,
    fontFamily: "Helvetica",
  },
  inlineLabel: {
    fontSize: 8,
    fontFamily: "Helvetica",
    marginRight: LABEL_GAP,
    flexShrink: 0,
  },
  valueText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: LH,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingVertical: 3,
    backgroundColor: "#f4f4f4",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },

  /* --- Custom Underlines --- */
  inputUnderline: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: RULE_MIN,
    justifyContent: "flex-end",
    paddingBottom: 1,
    flex: 1,
    marginLeft: 5,
  },
  inputUnderlineCenter: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: RULE_MIN,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 1,
    paddingHorizontal: 5,
  },
  // A ruled line that holds one line of (pre-wrapped) text.
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: RULE_MIN,
    justifyContent: "flex-end",
    paddingBottom: 1,
    paddingHorizontal: RULE_PAD,
  },

  /* --- Checkboxes --- */
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  checkbox: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: "#000",
    marginRight: 4,
    marginTop: 1,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  cbLabel: {
    fontSize: 8,
    flex: 1,
  },
  cbLaw: {
    fontSize: 6,
    fontFamily: "Helvetica",
  },

  /* --- Tables inside cells --- */
  innerTable: {
    borderWidth: 1,
    borderColor: "#000",
    marginTop: 5,
  },
  innerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },
  innerHeaderCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "#000",
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  innerCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "#000",
    padding: 2,
    alignItems: "center",
  },
  innerCellLabel: {
    flex: 1.5,
    borderRightWidth: 1,
    borderRightColor: "#000",
    padding: 2,
    fontFamily: "Helvetica-Oblique",
    fontSize: 7,
  },

  /* --- Signatures --- */
  sigBlock: {
    alignItems: "center",
    marginTop: 15,
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
    textAlign: "center",
    lineHeight: LH,
  },
  sigRoleBox: {
    marginTop: 2,
  },
  sigRole: {
    fontSize: 8,
    textAlign: "center",
    lineHeight: LH,
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
  // ✅ Initial signatures under the right end of the signature line
  initialsContainer: {
    position: "absolute",
    right: 10, // aligned with the right end of the signature line
    flexDirection: "row",
  },
  approverInitialUnder: {
    height: 20,
    width: 40,
    objectFit: "contain",
    marginRight: 5,
  },
});

/* =========================
   Sub-components
========================= */
// ✅ Drawn as a vector: Helvetica has no "✓" glyph, so a text check mark prints blank.
const CheckBox = ({ checked }) => (
  <View style={styles.checkbox}>
    {checked ? (
      <Svg viewBox="0 0 24 24" width={6} height={6}>
        <Path d="M20 6L9 17l-5-5" stroke="black" strokeWidth={4} fill="none" />
      </Svg>
    ) : null}
  </View>
);

const CheckboxItem = ({ label, law, checked }) => (
  <View style={styles.checkboxRow}>
    <CheckBox checked={checked} />
    <Text style={styles.cbLabel}>
      {label} {law && <Text style={styles.cbLaw}>{law}</Text>}
    </Text>
  </View>
);

// One ruled line holding one line of text.
const Rule = ({ text, size = 9, align = "center", style }) => (
  <View style={[styles.rule, style]}>
    <Text style={[styles.valueText, { fontSize: size, textAlign: align }]}>
      {text || ""}
    </Text>
  </View>
);

/**
 * A label followed by an underlined value. The first line sits beside the
 * label; when the value reaches the right edge it continues on new ruled
 * lines underneath (starting at `indent`).
 */
const InlineField = ({ prefix, field, align = "center", indent = 0 }) => {
  const [first = "", ...rest] = field.lines;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {prefix}
        <Rule
          text={first}
          size={field.size}
          align={align}
          style={{ flex: 1 }}
        />
      </View>
      {rest.map((line, i) => (
        <Rule
          key={i}
          text={line}
          size={field.size}
          align={align}
          style={{ marginLeft: indent, marginTop: CONT_GAP }}
        />
      ))}
    </View>
  );
};

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
   Main Component
========================= */
export default function OrganicApplicationPdf({ app, logoSrc, signatureSrc }) {
  // ✅ Extract data strictly from Applicant Snapshot for historical accuracy
  const snapshot = app?.applicantSnapshot || {};
  const emp = app?.employee || {}; // Fallback for legacy records

  const office =
    snapshot.division || emp.division || emp.department || "ADMIN AND FINANCE";
  const position = snapshot.position || emp.position || "";

  const prefixTitle = snapshot.prefixTitle || "";
  const firstName = snapshot.firstName || emp.firstName || "";
  const middleName = snapshot.middleName || emp.middleName || "";
  const lastName = snapshot.lastName || emp.lastName || "";
  const nameExtension = snapshot.nameExtension || "";
  const postfixTitle = snapshot.postfixTitle || "";

  // Format Name Strings specifically for the layout boxes
  const displayLastName = [lastName, nameExtension].filter(Boolean).join(" ");
  const displayFirstName = [prefixTitle, firstName, postfixTitle]
    .filter(Boolean)
    .join(" ");

  // ✅ Format Salary Amount
  const amt = snapshot.salaryAmount;
  let salaryText = "";
  if (amt) {
    salaryText = `${Number(amt).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
    })}`;
  }

  const dateOfFiling = fmtDateLong(app?.createdAt);

  const leaveType = app?.type || "Others";
  const daysApplied = app?.totalDays || app?.requestedDays || 1;
  const inclusiveDates = formatInclusiveDates(app?.inclusiveDates || []);

  const isCommutationReq = app?.commutation === "Requested";
  const isCommutationNotReq =
    app?.commutation === "Not Requested" || !isCommutationReq;

  const isRejected = app?.overallStatus === "REJECTED";

  // Final applicant signature
  const rawFinalSignatureSrc =
    app?.applicantSignatureUrl || signatureSrc || emp.signature || null;
  const finalSignatureSrc = safeImageUrl(rawFinalSignatureSrc);

  // ===============================================
  // ✅ EXTRACT CERTIFICATION OF LEAVE CREDITS
  // ===============================================
  const certLeave = app?.certificationOfLeaveCredits || {};
  const certAsOfDate = certLeave.asOfDate
    ? fmtDateLong(certLeave.asOfDate)
    : "";
  const certVL = certLeave.vacationLeave || {};
  const certSL = certLeave.sickLeave || {};

  // ===============================================
  // ✅ EXACT ROLE MAPPINGS INTO SPECIFIC VARIABLES
  // ===============================================
  const approvals = app?.approvals || [];

  // Recommendation Approvals
  const recInitial = approvals.find(
    (a) => a.role === "Recommending Approval Initial",
  );
  const recSignature = approvals.find(
    (a) => a.role === "Recommending Approval",
  );

  // HR Approvals
  const hrInitial = approvals.find((a) => a.role === "HR Initial");

  // AFD Approvals
  const afdInitial = approvals.find((a) => a.role === "AFD Chief Initial");
  const afdSignature = approvals.find((a) => a.role === "AFD Chief Signature");

  // ARD Approvals
  const ardSignature = approvals.find((a) => a.role === "ARD Signature");

  // Regional Director
  const rdSignature = approvals.find(
    (a) => a.role === "Regional Director Signature",
  );

  // ===============================================
  // ✅ SECTION 7.B CONDITIONAL ROUTING BASED ON DIVISION
  // ===============================================
  const officeUpper = office.toUpperCase();
  const isTOD =
    officeUpper.includes("TOD") || officeUpper.includes("TECHNICAL");
  const isORD =
    officeUpper.includes("ORD") ||
    officeUpper.includes("OFFICE OF THE REGIONAL DIRECTOR");

  let sec7B_mainApprover;
  let sec7B_initialApprovers;
  let sec7B_fallbackName;
  let sec7B_fallbackRole;

  if (isTOD || isORD) {
    sec7B_mainApprover = recSignature;
    sec7B_initialApprovers = [recInitial];
    sec7B_fallbackName = "";
    sec7B_fallbackRole = "Chief, Technical Operations Division";
  } else {
    // Defaults to AFD if neither TOD nor ORD
    sec7B_mainApprover = afdSignature;
    sec7B_initialApprovers = [afdInitial];
    sec7B_fallbackName = "MINA FLOR T. VILLAFUERTE";
    sec7B_fallbackRole = "Chief, Admin and Finance Division";
  }

  // Common standard types for checking "Others"
  const standardTypes = [
    "Vacation",
    "Mandatory",
    "Sick",
    "Maternity",
    "Paternity",
    "SPL",
    "Solo Parent",
    "Study",
    "VAWC",
    "Rehabilitation",
    "Women",
    "Calamity",
    "Adoption",
  ];
  const isOtherLeave = !standardTypes.includes(leaveType);

  // ===============================================
  // ✅ FIT LONG TEXT: wrap at the right edge, keep the form on one page
  // ===============================================
  const L = fitForm({
    hasLogo: Boolean(logoSrc),
    office,
    displayLastName,
    displayFirstName,
    middleName,
    dateOfFiling,
    position,
    salaryText,
    others: isOtherLeave ? leaveType : "",
    location: app?.location || "",
    inclusiveDates,
    remarks: isRejected ? app?.remarks || "" : "",
    sigs: {
      // 7.A Approvers -> HR
      hr: {
        mainApprover: hrInitial,
        initialApprovers: [],
        fallbackName: "JAYFER T. AMMASI",
        fallbackRole: "HRMO II",
        lineWidth: W.sigLine7A,
      },
      // 7.B Conditional Approvers Based on Division
      rec: {
        mainApprover: sec7B_mainApprover,
        initialApprovers: sec7B_initialApprovers,
        fallbackName: sec7B_fallbackName,
        fallbackRole: sec7B_fallbackRole,
        lineWidth: W.sigLine7B,
      },
      // 7.C/7.D Approvers -> Regional Director (or ARD)
      final: {
        mainApprover: rdSignature || ardSignature,
        initialApprovers: isTOD || isORD ? [afdSignature] : [],
        fallbackName: "Engr. PINKY T. JIMENEZ, PECE, Ph.D.",
        fallbackRole: "Regional Director",
        lineWidth: W.sigLineFinal,
      },
    },
  });
  const asOfSize = oneLineSize(certAsOfDate, W.asOf);
  const remarkGaps = remarksRules(
    L.remarks.lines.length,
    L.spacing.tightRemarks,
  );

  return (
    <Document title={`Leave Application - ${lastName}`}>
      <Page size="A4" style={styles.page}>
        {/* --- HEADER --- */}
        <View
          style={[styles.headerWrapper, { marginBottom: L.spacing.headerGap }]}
        >
          <View style={styles.headerLogoArea}>
            {logoSrc ? (
              <Image
                src={logoSrc}
                style={{
                  height: 45,
                  width: 250,
                  objectFit: "contain",
                  objectPosition: "left",
                }}
              />
            ) : (
              <View style={styles.logoPlaceholder} />
            )}
          </View>
          <View style={styles.stampBox}>
            <Text style={styles.stampText}>Stamp of Date of Receipt</Text>
          </View>
        </View>

        <Text style={[styles.formTitle, { marginBottom: L.spacing.titleGap }]}>
          APPLICATION FOR LEAVE
        </Text>

        {/* --- MAIN FORM BORDER --- */}
        <View style={styles.formBorder}>
          {/* Row 1: Office & Name */}
          <View style={styles.row}>
            <View style={[styles.colRightBorder, styles.colOffice]}>
              <Text style={styles.labelTitle}>
                1. OFFICE/DEPARTMENT - DISTRICT/SCHOOL
              </Text>
              <Text
                style={[
                  styles.valueText,
                  { marginTop: 4, fontSize: L.office.size },
                ]}
              >
                {L.office.lines.join("\n")}
              </Text>
            </View>
            <View style={styles.colName}>
              <Text style={styles.labelTitle}>2. NAME :</Text>
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                {[
                  [L.name.last, "(Last)"], // lastName + nameExtension
                  [L.name.first, "(First)"], // prefix + firstName + postfix
                  [L.name.middle, "(Middle)"],
                ].map(([lines, caption]) => (
                  <View
                    key={caption}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    <Text style={[styles.valueText, { fontSize: L.name.size }]}>
                      {lines.join("\n")}
                    </Text>
                    <Text style={{ fontSize: 7, marginTop: 1 }}>{caption}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Row 2: Date, Position, Salary */}
          <View style={styles.row}>
            <View style={[styles.colRightBorder, styles.colDate]}>
              <InlineField
                prefix={
                  <Text style={styles.inlineLabel}>3. DATE OF FILING</Text>
                }
                field={L.date}
              />
            </View>
            <View style={[styles.colRightBorder, styles.colPosition]}>
              <InlineField
                prefix={<Text style={styles.inlineLabel}>4. POSITION</Text>}
                field={L.position}
              />
            </View>
            <View style={styles.colSalary}>
              <InlineField
                prefix={<Text style={styles.inlineLabel}>5. SALARY</Text>}
                field={L.salary}
              />
            </View>
          </View>

          {/* Section 6 Title */}
          <Text style={styles.sectionTitle}>6. DETAILS OF APPLICATION</Text>

          {/* Row 3: 6A and 6B */}
          <View style={styles.row}>
            {/* 6.A TYPE OF LEAVE */}
            <View style={[styles.colRightBorder, styles.col6A]}>
              <Text style={[styles.labelTitle, { marginBottom: 6 }]}>
                6.A TYPE OF LEAVE TO BE AVAILED OF
              </Text>

              <CheckboxItem
                label="Vacation Leave"
                law="(Sec. 51, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"
                checked={leaveType === "Vacation"}
              />
              <CheckboxItem
                label="Mandatory/Forced Leave"
                law="(Sec. 25, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"
                checked={leaveType === "Mandatory"}
              />
              <CheckboxItem
                label="Sick Leave"
                law="(Sec. 43, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"
                checked={leaveType === "Sick"}
              />
              <CheckboxItem
                label="Maternity Leave"
                law="(R.A. No. 11210 / IRR issued by CSC, DOLE and SSS)"
                checked={leaveType === "Maternity"}
              />
              <CheckboxItem
                label="Paternity Leave"
                law="(R.A. No. 8187 / CSC MC No. 71, s. 1998, as amended)"
                checked={leaveType === "Paternity"}
              />
              <CheckboxItem
                label="Special Privilege Leave"
                law="(Sec. 21, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"
                checked={leaveType === "SPL"}
              />
              <CheckboxItem
                label="Solo Parent Leave"
                law="(RA No. 8972 / CSC MC No. 8, s. 2004)"
                checked={leaveType === "Solo Parent"}
              />
              <CheckboxItem
                label="Study Leave"
                law="(Sec. 68, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"
                checked={leaveType === "Study"}
              />
              <CheckboxItem
                label="10-Day VAWC Leave"
                law="(RA No. 9262 / CSC MC No. 15, s. 2005)"
                checked={leaveType === "VAWC"}
              />
              <CheckboxItem
                label="Rehabilitation Privilege"
                law="(Sec. 55, Rule XVI, Omnibus Rules Implementing E.O. No. 292)"
                checked={leaveType === "Rehabilitation"}
              />
              <CheckboxItem
                label="Special Leave Benefits for Women"
                law="(RA No. 9710 / CSC MC No. 25, s. 2010)"
                checked={leaveType === "Women"}
              />
              <CheckboxItem
                label="Special Emergency (Calamity) Leave"
                law="(CSC MC No. 2, s. 2012, as amended)"
                checked={leaveType === "Calamity"}
              />
              <CheckboxItem
                label="Adoption Leave"
                law="(R.A. No. 8552)"
                checked={leaveType === "Adoption"}
              />

              <Text
                style={[
                  styles.labelTitle,
                  { marginTop: 6, fontStyle: "italic" },
                ]}
              >
                Others:
              </Text>
              {(L.others.lines.length ? L.others.lines : [""]).map(
                (line, i) => (
                  <Rule
                    key={i}
                    text={line}
                    size={L.others.size}
                    style={{
                      marginHorizontal: 20,
                      marginTop: i === 0 ? 4 : CONT_GAP,
                      paddingHorizontal: 5,
                    }}
                  />
                ),
              )}
            </View>

            {/* 6.B DETAILS OF LEAVE */}
            <View style={styles.col6B}>
              <Text style={[styles.labelTitle, { marginBottom: 6 }]}>
                6.B DETAILS OF LEAVE
              </Text>

              <Text
                style={[
                  styles.labelTitle,
                  { fontStyle: "italic", marginBottom: 2 },
                ]}
              >
                In case of Vacation/Special Privilege Leave:
              </Text>
              <View style={{ paddingLeft: 10, marginBottom: 4 }}>
                <InlineField
                  prefix={
                    <>
                      <CheckBox checked={false} />
                      <Text style={styles.inlineLabel}>
                        Within the Philippines
                      </Text>
                    </>
                  }
                  field={L.location}
                  indent={CHECKBOX_W}
                />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    marginTop: 4,
                  }}
                >
                  <CheckBox checked={false} />
                  <Text style={styles.labelTitle}>Abroad (Specify) </Text>
                  <View style={styles.inputUnderline}>
                    <Text style={styles.valueText}></Text>
                  </View>
                </View>
              </View>

              <Text
                style={[
                  styles.labelTitle,
                  { fontStyle: "italic", marginBottom: 2 },
                ]}
              >
                In case of Sick Leave:
              </Text>
              <View style={{ paddingLeft: 10, marginBottom: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                  <CheckBox checked={false} />
                  <Text style={styles.labelTitle}>
                    In Hospital (Specify Illness){" "}
                  </Text>
                  <View style={styles.inputUnderline}>
                    <Text style={styles.valueText}></Text>
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    marginTop: 4,
                  }}
                >
                  <CheckBox checked={false} />
                  <Text style={styles.labelTitle}>
                    Out Patient (Specify Illness){" "}
                  </Text>
                  <View style={styles.inputUnderline}>
                    <Text style={styles.valueText}></Text>
                  </View>
                </View>
              </View>

              <Text
                style={[
                  styles.labelTitle,
                  { fontStyle: "italic", marginBottom: 2 },
                ]}
              >
                In case of Special Leave Benefits for Women:
              </Text>
              <View
                style={{
                  paddingLeft: 10,
                  marginBottom: 4,
                  flexDirection: "row",
                  alignItems: "flex-end",
                }}
              >
                <Text style={styles.labelTitle}>(Specify Illness) </Text>
                <View style={styles.inputUnderline}>
                  <Text style={styles.valueText}></Text>
                </View>
              </View>

              <Text
                style={[
                  styles.labelTitle,
                  { fontStyle: "italic", marginBottom: 2 },
                ]}
              >
                In case of Study Leave:
              </Text>
              <View style={{ paddingLeft: 10, marginBottom: 4 }}>
                <CheckboxItem
                  label="Completion of Master's Degree"
                  checked={false}
                />
                <CheckboxItem
                  label="BAR/Board Examination Review"
                  checked={false}
                />
              </View>

              <Text
                style={[
                  styles.labelTitle,
                  { fontStyle: "italic", marginBottom: 2 },
                ]}
              >
                Other purpose:
              </Text>
              <View style={{ paddingLeft: 10, marginBottom: 4 }}>
                <CheckboxItem
                  label="Monetization of Leave Credits"
                  checked={false}
                />
                <CheckboxItem label="Terminal Leave" checked={false} />
              </View>
            </View>
          </View>

          {/* Row 4: 6C and 6D */}
          <View style={styles.row}>
            <View style={[styles.colRightBorder, styles.col6C]}>
              <Text style={styles.labelTitle}>
                6.C NUMBER OF WORKING DAYS APPLIED FOR
              </Text>
              <View
                style={[
                  styles.inputUnderlineCenter,
                  { marginHorizontal: 20, marginTop: 4 },
                ]}
              >
                <Text style={styles.valueText}>
                  {daysApplied} day{daysApplied > 1 ? "s" : ""}
                </Text>
              </View>

              <Text style={[styles.labelTitle, { marginTop: 8 }]}>
                INCLUSIVE DATES
              </Text>
              {(L.dates.lines.length ? L.dates.lines : [""]).map((line, i) => (
                <Rule
                  key={i}
                  text={line}
                  size={L.dates.size}
                  style={{
                    marginHorizontal: 20,
                    marginTop: i === 0 ? 4 : CONT_GAP,
                    paddingHorizontal: 5,
                  }}
                />
              ))}
            </View>

            <View style={styles.col6D}>
              <Text style={styles.labelTitle}>6.D COMMUTATION</Text>
              <View style={{ paddingLeft: 10, marginTop: 4 }}>
                <CheckboxItem
                  label="Not Requested"
                  checked={isCommutationNotReq}
                />
                <CheckboxItem label="Requested" checked={isCommutationReq} />
              </View>

              {/* Applicant Signature */}
              <View style={[styles.sigBlock, { marginTop: 10 }]}>
                <View style={[styles.sigLine, { width: "80%" }]}>
                  {finalSignatureSrc ? (
                    <Image
                      src={finalSignatureSrc}
                      style={styles.applicantSignature}
                    />
                  ) : (
                    <Text style={styles.sigName}></Text>
                  )}
                </View>
                <Text style={[styles.sigRole, { marginTop: 2 }]}>
                  (Signature of Applicant)
                </Text>
              </View>
            </View>
          </View>

          {/* Section 7 + 7.A/7.B stay together if the form ever has to break */}
          <View wrap={false}>
            {/* Section 7 Title */}
            <Text style={styles.sectionTitle}>
              7. DETAILS OF ACTION ON APPLICATION
            </Text>

            {/* Row 5: 7A and 7B */}
            <View style={styles.row}>
              {/* 7.A - HRMO Signature Block */}
              <View style={[styles.colRightBorder, styles.col7A]}>
                <Text style={styles.labelTitle}>
                  7.A CERTIFICATION OF LEAVE CREDITS
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "flex-end",
                    marginTop: 4,
                  }}
                >
                  <Text style={styles.labelTitle}>As of </Text>
                  <View
                    style={[
                      styles.inputUnderlineCenter,
                      { width: W.asOf + 10 },
                    ]}
                  >
                    <Text style={[styles.valueText, { fontSize: asOfSize }]}>
                      {certAsOfDate}
                    </Text>
                  </View>
                </View>

                <View style={styles.innerTable}>
                  <View style={styles.innerRow}>
                    <View style={styles.innerCellLabel}>
                      <Text></Text>
                    </View>
                    <View style={styles.innerHeaderCell}>
                      <Text style={styles.labelTitle}>Vacation Leave</Text>
                    </View>
                    <View
                      style={[styles.innerHeaderCell, { borderRightWidth: 0 }]}
                    >
                      <Text style={styles.labelTitle}>Sick Leave</Text>
                    </View>
                  </View>
                  <View style={styles.innerRow}>
                    <View style={styles.innerCellLabel}>
                      <Text style={{ textAlign: "center" }}>Total Earned</Text>
                    </View>
                    <View style={styles.innerCell}>
                      <Text style={styles.labelTitle}>
                        {certVL.totalEarned ?? app?.balances?.vacation ?? ""}
                      </Text>
                    </View>
                    <View style={[styles.innerCell, { borderRightWidth: 0 }]}>
                      <Text style={styles.labelTitle}>
                        {certSL.totalEarned ?? app?.balances?.sick ?? ""}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.innerRow}>
                    <View style={styles.innerCellLabel}>
                      <Text style={{ textAlign: "center" }}>
                        Less this application
                      </Text>
                    </View>
                    <View style={styles.innerCell}>
                      <Text style={styles.labelTitle}>
                        {certVL.lessThisApplication ?? ""}
                      </Text>
                    </View>
                    <View style={[styles.innerCell, { borderRightWidth: 0 }]}>
                      <Text style={styles.labelTitle}>
                        {certSL.lessThisApplication ?? ""}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.innerRow, { borderBottomWidth: 0 }]}>
                    <View style={styles.innerCellLabel}>
                      <Text style={{ textAlign: "center" }}>Balance</Text>
                    </View>
                    <View style={styles.innerCell}>
                      <Text style={styles.labelTitle}>
                        {certVL.balance ?? ""}
                      </Text>
                    </View>
                    <View style={[styles.innerCell, { borderRightWidth: 0 }]}>
                      <Text style={styles.labelTitle}>
                        {certSL.balance ?? ""}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 7.A Approvers -> Map HR Variables */}
                <SignatureBlock sig={L.sigHR} marginTop={L.spacing.sig7} />
              </View>

              {/* 7.B - Recommending Signatures Block */}
              <View style={styles.col7B}>
                <Text style={styles.labelTitle}>7.B RECOMMENDATION</Text>
                <View style={{ paddingLeft: 10, marginTop: 4 }}>
                  <CheckboxItem
                    label="For approval"
                    checked={app?.overallStatus === "APPROVED"}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      marginTop: 4,
                    }}
                  >
                    <CheckBox checked={isRejected} />
                    <Text style={styles.labelTitle}>
                      For disapproval due to{" "}
                    </Text>
                    <View style={styles.inputUnderline}>
                      <Text style={styles.valueText}></Text>
                    </View>
                  </View>
                  <View
                    style={[styles.inputUnderlineCenter, { marginTop: 8 }]}
                  ></View>
                  <View
                    style={[styles.inputUnderlineCenter, { marginTop: 8 }]}
                  ></View>
                </View>

                {/* ✅ 7.B Conditional Approvers Based on Division */}
                <SignatureBlock sig={L.sigRec} marginTop={L.spacing.sig7} />
              </View>
            </View>
          </View>

          {/* 7.C/7.D and the final signature stay together */}
          <View wrap={false}>
            {/* Row 6: 7C and 7D */}
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={[styles.colRightBorder, styles.col7C]}>
                <Text style={styles.labelTitle}>7.C APPROVED FOR:</Text>
                <View style={{ paddingLeft: 10, marginTop: 4 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      marginBottom: 4,
                    }}
                  >
                    <View
                      style={[
                        styles.inputUnderlineCenter,
                        { width: 30, marginRight: 4 },
                      ]}
                    >
                      <Text style={styles.valueText}>{daysApplied}</Text>
                    </View>
                    <Text style={styles.labelTitle}>days with pay</Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      marginBottom: 4,
                    }}
                  >
                    <View
                      style={[
                        styles.inputUnderlineCenter,
                        { width: 30, marginRight: 4 },
                      ]}
                    >
                      <Text style={styles.valueText}></Text>
                    </View>
                    <Text style={styles.labelTitle}>days without pay</Text>
                  </View>
                  <View
                    style={{ flexDirection: "row", alignItems: "flex-end" }}
                  >
                    <View
                      style={[
                        styles.inputUnderlineCenter,
                        { width: 30, marginRight: 4 },
                      ]}
                    >
                      <Text style={styles.valueText}></Text>
                    </View>
                    <Text style={styles.labelTitle}>others (Specify)</Text>
                  </View>
                </View>
              </View>

              <View style={styles.col7D}>
                <Text style={styles.labelTitle}>7.D DISAPPROVED DUE TO:</Text>
                {/* Remarks fill the ruled lines and continue on new lines if longer */}
                <View style={{ paddingLeft: 10, marginTop: 4 }}>
                  {remarkGaps.map((gap, i) => (
                    <Rule
                      key={i}
                      text={L.remarks.lines[i]}
                      size={L.remarks.size}
                      style={{ marginTop: gap, paddingHorizontal: 5 }}
                    />
                  ))}
                </View>
              </View>
            </View>

            {/* ✅ Bottom Final Signature (7C/7D Approvers) */}
            <View style={styles.finalSig}>
              <SignatureBlock sig={L.sigFinal} marginTop={L.spacing.sigFinal} />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
