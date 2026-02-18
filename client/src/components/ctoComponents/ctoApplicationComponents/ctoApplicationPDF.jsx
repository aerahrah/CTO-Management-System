import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

/* =========================
   Helpers (UNCHANGED)
========================= */
function getEmployeeName(employee) {
  if (!employee) return "";
  if (typeof employee === "string") return employee;

  const direct =
    employee.fullName ||
    employee.name ||
    employee.employeeName ||
    employee.displayName;
  if (direct) return String(direct);

  const parts = [
    employee.firstName,
    employee.middleName,
    employee.lastName,
    employee.suffix,
  ]
    .filter(Boolean)
    .map(String);

  return parts.join(" ").trim();
}

function getApproverName(approver) {
  if (!approver) return "";
  if (typeof approver === "string") return approver;

  const direct =
    approver.fullName ||
    approver.name ||
    approver.displayName ||
    approver.approverName;
  if (direct) return String(direct);

  const parts = [
    approver.firstName,
    approver.middleName,
    approver.lastName,
    approver.suffix,
  ]
    .filter(Boolean)
    .map(String);

  return parts.join(" ").trim();
}

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

function toMidnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Formats inclusive dates similar to: "September 11-12, 2024"
 * If multiple non-consecutive ranges exist, joins with ", ".
 */
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

    return `${monthShort(s)} ${s.getDate()}, ${s.getFullYear()} - ${monthShort(
      e,
    )} ${e.getDate()}, ${e.getFullYear()}`;
  };

  return ranges.map(([s, e]) => fmtRange(s, e)).join(", ");
}

function safeNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function pickPosition(employee) {
  return (
    employee?.position ||
    employee?.jobTitle ||
    employee?.designation ||
    employee?.role ||
    ""
  );
}

function pickOfficeDivision(employee) {
  return (
    employee?.officeDivision ||
    employee?.office ||
    employee?.department ||
    employee?.division ||
    ""
  );
}

function memoRowLabel(memoItem) {
  const memo = memoItem?.memoId || {};
  const hours =
    memo?.hoursEarned ??
    memo?.earnedHours ??
    memo?.totalHours ??
    memoItem?.appliedHours ??
    "";

  const date =
    memo?.earnedDate ||
    memo?.creditDate ||
    memo?.dateEarned ||
    memo?.createdAt ||
    "";

  const dateStr = date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : "";
  const hrsStr = hours !== "" ? `${hours} hrs` : "";

  if (!dateStr && !hrsStr) return "";
  return [dateStr, hrsStr].filter(Boolean).join(" – ");
}

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
}) {
  return (
    <View
      style={[
        styles.underlineBox,
        {
          flex,
          width: width ?? undefined,
          minHeight,
          paddingBottom,
        },
        boxStyle,
      ]}
    >
      <Text style={[styles.underlineText, { textAlign: align }, textStyle]}>
        {String(value || "")}
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
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.label, styles.fieldLabel, labelStyle]}>{label}</Text>
      <UnderlineBox
        value={value}
        width={lineWidth}
        flex={lineFlex}
        align={align}
      />
    </View>
  );
}

/* =========================
   Styles (UPDATED to match uploaded layout)
========================= */
const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingHorizontal: 28,
    paddingBottom: 24,
    fontSize: 10,
    fontFamily: "Helvetica",
    lineHeight: 1.25,
  },

  /* --- TOP LOGO (CENTERED) --- */
  header: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logo: {
    width: 190,
    height: 55,
    objectFit: "contain",
  },
  logoPlaceholder: {
    width: 170,
    height: 50,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  logoPlaceholderText: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
  },

  /* --- FORM TITLE (ABOVE BIG BOX) --- */
  formTitle: {
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 10,
    fontSize: 10,
  },

  /* --- TOP 2-COLUMN BIG BOX --- */
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
  topRight: {
    width: "42%",
    padding: 10,
  },

  label: { fontWeight: "bold" },

  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  fieldLabel: {
    marginRight: 6,
    flexShrink: 0,
  },
  underlineBox: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    justifyContent: "flex-end",
  },
  underlineText: {
    fontSize: 10,
    paddingHorizontal: 2,
  },
  spaceBox: {
    justifyContent: "flex-end",
  },
  /* Right: ACTION OF APPLICATION */
  actionTitle: {
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: "#000",
    marginRight: 8,
  },
  actionText: { flexDirection: "row", alignItems: "flex-end", flex: 1 },

  /* Right: signature/approval blocks (match image: lines then label) */
  approvalSection: {
    marginTop: 12,
  },
  approvalLabelLeft: {
    marginTop: 18,
    marginBottom: 6,
  },
  longLine: {
    alignSelf: "center",
  },
  nameLine: {
    alignSelf: "center",
    marginTop: 10,
  },
  roleLabel: {
    textAlign: "center",
    fontSize: 9,
    marginTop: 2,
  },

  /* --- DETACH + DASHED LINE (BELOW BIG BOX) --- */
  detachRow: {
    marginTop: 10,
    marginBottom: 6,
  },
  detachText: {
    fontSize: 9,
  },
  dashedLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    borderStyle: "dashed",
    marginBottom: 10,
  },

  /* --- CERTIFICATE TITLE (ABOVE TABLE) --- */
  certificateTitle: {
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 10,
    marginBottom: 6,
  },

  /* --- CERTIFICATE OUTER BOX --- */
  certBox: {
    borderWidth: 1,
    borderColor: "#000",
    width: "100%",
  },

  /* --- CERTIFICATE GRID (5 columns) --- */
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
  col1: { width: "28%" },
  col2: { width: "20%" },
  col3: { width: "16%" },
  col4: { width: "18%" },
  col5: { width: "18%", borderRightWidth: 0 },

  /* footer signature area inside cert box (blank area under grid) */
  certFooter: {
    minHeight: 70,
    padding: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  footerBlock: {
    width: 220,
    alignItems: "center",
  },
  footerName: {
    fontWeight: "bold",
    textAlign: "center",
  },
  footerRole: {
    fontSize: 9,
    textAlign: "center",
    marginTop: 1,
    marginBottom: 6,
  },
  footerDateLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    width: 140,
    height: 14,
  },
  footerDateLabel: {
    textAlign: "center",
    fontSize: 9,
    marginTop: 2,
  },
});

/* =========================
   PDF Component
========================= */
export default function CtoApplicationPdf({
  app,

  // Header props
  logoSrc = "/public/logo_dict.png",

  // Labels
  recommendingApproverLabel = "(Head of Section/Division)",
  adminFinanceLabel = "Admin. & Finance Div.",
  approvedLabel = "(Authorized Official/Head of Office)",
}) {
  const employee = app?.employee || {};
  const employeeName = getEmployeeName(employee) || "";
  const position = pickPosition(employee) || "";
  const officeDivision = pickOfficeDivision(employee) || "";

  const dateOfFiling = fmtDateLong(app?.createdAt) || "";
  const requestedHours = safeNumber(app?.requestedHours);
  const inclusiveDates = formatInclusiveDates(app?.inclusiveDates || []);
  const dayCount = Array.isArray(app?.inclusiveDates)
    ? app.inclusiveDates.length
    : 0;

  // approver mapping:
  // head of section/division = approver1
  // admin & finance div      = approver2
  // authorized official/head = approver3
  const approver1 =
    app?.approver1 ||
    app?.approvals?.find?.((a) => Number(a?.level) === 1)?.approver ||
    "";
  const approver2 =
    app?.approver2 ||
    app?.approvals?.find?.((a) => Number(a?.level) === 2)?.approver ||
    "";
  const approver3 =
    app?.approver3 ||
    app?.approvals?.find?.((a) => Number(a?.level) === 3)?.approver ||
    "";

  const approver1Name = getApproverName(approver1) || "";
  const approver2Name = getApproverName(approver2) || "";
  const approver3Name = getApproverName(approver3) || "";

  const memos = Array.isArray(app?.memo) ? app.memo : [];

  // ✅ 5-column rows (matches uploaded layout)
  const rows = memos.length
    ? memos.map((m) => ({
        col1: memoRowLabel(m),
        col2: inclusiveDates || "",
        col3: m?.appliedHours != null ? String(m.appliedHours) : "",
        col4: m?.memoId?.remainingHours ?? m?.memoId?.remaining ?? "",
        col5: m?.memoId?.remarks ?? "",
      }))
    : new Array(6).fill(null).map(() => ({
        col1: "",
        col2: "",
        col3: "",
        col4: "",
        col5: "",
      }));

  return (
    <Document title="CTO Application">
      <Page size="A4" style={styles.page}>
        {/* TOP LOGO (CENTERED) */}
        <View style={styles.header}>
          {logoSrc ? (
            <Image src={logoSrc} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderText}>LOGO PLACEHOLDER</Text>
            </View>
          )}
        </View>

        {/* TITLE (ABOVE BIG BOX) */}
        <Text style={styles.formTitle}>
          APPLICATION FOR AVAILMENT OF COMPENSATORY TIME-OFF (CTO)
        </Text>

        {/* BIG 2-COLUMN BOX */}
        <View style={styles.topBox}>
          {/* LEFT */}
          <View style={styles.topLeft}>
            <LabeledUnderlineRow
              label="Name:"
              value={employeeName}
              lineFlex={1}
              align="left"
            />

            <View style={styles.fieldRow}>
              <Text style={[styles.label, styles.fieldLabel]}>Signature:</Text>
              <UnderlineBox value="" flex={1} align="center" minHeight={14} />
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
              value={inclusiveDates}
              lineFlex={1}
              align="center"
            />
          </View>

          {/* RIGHT */}
          <View style={styles.topRight}>
            <Text style={styles.actionTitle}>ACTION OF APPLICATION</Text>

            {/* Approval for ____ day/s */}
            <View style={styles.actionRow}>
              <View style={styles.checkbox} />
              <View style={styles.actionText}>
                <Text>Approval for </Text>
                <UnderlineBox
                  value={dayCount ? String(dayCount) : ""}
                  width={20}
                  flex={1}
                  align="center"
                  minHeight={10}
                />
                <Text> day/s</Text>
              </View>
            </View>

            {/* Disapproved due to ____ */}
            <View style={styles.actionRow}>
              <View style={styles.checkbox} />
              <View style={styles.actionText}>
                <Text>Disapproved due to </Text>
                <UnderlineBox value="" flex={1} align="center" minHeight={10} />
              </View>
            </View>

            {/* extra line below (as in image) */}
            <UnderlineBox
              value=""
              flex={0}
              width={"100%"}
              align="center"
              minHeight={10}
              boxStyle={{ marginTop: -2, marginBottom: 10 }}
            />

            {/* Recommending Approval */}
            <Text style={styles.approvalLabelLeft}>Recommending Approval:</Text>

            {/* signature space (no underline) */}
            <View style={{ height: 32 }} />

            {/* name line (center) */}
            <UnderlineBox
              value={approver1Name}
              flex={0}
              width={170}
              minHeight={12}
              align="center"
              boxStyle={styles.nameLine}
            />
            <Text style={styles.roleLabel}>{recommendingApproverLabel}</Text>

            {/* Approved */}
            <Text style={styles.approvalLabelLeft}>Approved:</Text>

            {/* signature space (no underline) */}
            <View style={{ width: 230, height: 14, alignSelf: "center" }} />

            {/* name line (center, bold + underlined) */}
            <UnderlineBox
              value={approver3Name}
              flex={0}
              width={190}
              minHeight={12}
              align="center"
              textStyle={{ fontWeight: "bold" }}
              boxStyle={styles.nameLine}
            />
            <Text style={styles.roleLabel}>{approvedLabel}</Text>
          </View>
        </View>

        {/* Detach + dashed line (BELOW BIG BOX) */}
        <View style={styles.detachRow}>
          <Text style={styles.detachText}>Detach for Time Keeper’s Record</Text>
        </View>
        <View style={styles.dashedLine} />

        {/* Certificate Title */}
        <Text style={styles.certificateTitle}>
          CERTIFICATE OF COMPENSATORY CREDITS
        </Text>

        {/* Certificate Outer Box */}
        <View style={styles.certBox}>
          {/* Grid header */}
          <View style={styles.gridRow}>
            <View style={[styles.gridHeaderCell, styles.col1]}>
              <Text>
                Total No. of Hours of Earned{"\n"}COCs{"\n"}
                (including COCs earned in{"\n"}previous month/s)
              </Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.col2]}>
              <Text>Date of CTO</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.col3]}>
              <Text>Used COCs</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.col4]}>
              <Text>Remaining COCs</Text>
            </View>
            <View style={[styles.gridHeaderCell, styles.col5]}>
              <Text>Remarks</Text>
            </View>
          </View>

          {/* Grid rows */}
          {rows.map((r, idx) => (
            <View style={styles.gridRow} key={idx}>
              <View style={[styles.gridCell, styles.col1]}>
                <Text>{r.col1}</Text>
              </View>
              <View style={[styles.gridCell, styles.col2]}>
                <Text>{r.col2}</Text>
              </View>
              <View style={[styles.gridCell, styles.col3]}>
                <Text>{r.col3} Hours</Text>
              </View>
              <View style={[styles.gridCell, styles.col4]}>
                <Text>{r.col4}</Text>
              </View>
              <View style={[styles.gridCell, styles.col5]}>
                <Text>{r.col5}</Text>
              </View>
            </View>
          ))}

          {/* Footer signature area INSIDE the same outer box (as in image) */}
          <View style={styles.certFooter}>
            <View style={styles.footerBlock}>
              <View style={{ height: 32 }} />

              <UnderlineBox
                value={approver2Name}
                flex={0}
                width={190}
                minHeight={12}
                align="center"
                textStyle={{ fontWeight: "bold" }}
                boxStyle={styles.nameLine}
              />
              <Text style={styles.footerRole}>{adminFinanceLabel}</Text>
              <View style={styles.footerDateLine}>
                <Text />
              </View>
              <Text style={styles.footerDateLabel}>Date</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
