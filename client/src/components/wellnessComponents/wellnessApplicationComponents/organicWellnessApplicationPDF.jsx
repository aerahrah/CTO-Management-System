import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
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
   Styles
========================= */
const styles = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
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

  /* --- Cell Padding & Text --- */
  labelTitle: {
    fontSize: 8,
    fontFamily: "Helvetica",
  },
  valueText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
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
    minHeight: 12,
    justifyContent: "flex-end",
    paddingBottom: 1,
    flex: 1,
    marginLeft: 5,
  },
  inputUnderlineCenter: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 12,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 1,
    paddingHorizontal: 5,
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
  },
  checkMark: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
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
  },
  sigRole: {
    fontSize: 8,
    marginTop: 2,
    textAlign: "center",
  },
  digitalSigInfo: {
    fontSize: 5,
    position: "absolute",
    right: 10,
    bottom: 12,
    textAlign: "right",
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
  // ✅ New styles for initial signatures under the line
  initialsContainer: {
    position: "absolute",
    top: "100%", // This places it exactly beneath the sigLine border
    right: 10, // Aligns it to the left side of the signature line
    flexDirection: "row",
    paddingTop: 2,
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
const CheckboxItem = ({ label, law, checked }) => (
  <View style={styles.checkboxRow}>
    <View style={styles.checkbox}>
      <Text style={styles.checkMark}>{checked ? "✓" : ""}</Text>
    </View>
    <Text style={styles.cbLabel}>
      {label} {law && <Text style={styles.cbLaw}>{law}</Text>}
    </Text>
  </View>
);

const SlotSignatures = ({
  mainApprover,
  initialApprovers = [],
  fallbackName,
  fallbackRole,
  marginTop = 30,
  lineWidth = "80%", // ✅ Added a default width prop to customize the line length
}) => {
  // If no main approver or initials are available, render fallbacks
  if (!mainApprover && (!initialApprovers || initialApprovers.length === 0)) {
    return (
      <View style={[styles.sigBlock, { marginTop }]}>
        {/* ✅ Dynamic width applied here */}
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

  // ✅ Use updated helper to extract Titles, First, Middle, Last, Extensions dynamically
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
      {/* ✅ Dynamic width applied here */}
      <View style={[styles.sigLine, { width: lineWidth }]}>
        {mainSigUrl && (
          <Image src={mainSigUrl} style={styles.approverSignatureAbove} />
        )}

        <Text style={styles.sigName}>{mainName}</Text>

        {/* ✅ Render initials UNDER the underline */}
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
   Main Component
========================= */
export default function WellnessApplicationPdf({ app, logoSrc, signatureSrc }) {
  // ✅ Extract data strictly from Applicant Snapshot for historical accuracy
  const snapshot = app?.applicantSnapshot || {};
  const emp = app?.employee || {}; // Still needed strictly for fallback signature if no snapshot sig exists

  // ✅ Use snapshot for all organizational and personal fields
  const office = snapshot.division || "ADMIN AND FINANCE";
  const position = snapshot.position || "";

  const prefixTitle = snapshot.prefixTitle || "";
  const firstName = snapshot.firstName || "";
  const middleName = snapshot.middleName || "";
  const lastName = snapshot.lastName || "";
  const nameExtension = snapshot.nameExtension || "";
  const postfixTitle = snapshot.postfixTitle || "";

  // Format Name Strings specifically for the layout boxes
  const displayLastName = [lastName, nameExtension].filter(Boolean).join(" ");
  const displayFirstName = [prefixTitle, firstName, postfixTitle]
    .filter(Boolean)
    .join(" ");

  // Create a continuous string for the digital signature block
  const fullApplicantName = [
    prefixTitle,
    firstName,
    middleName,
    lastName,
    nameExtension,
    postfixTitle,
  ]
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

  const leaveType = app?.type || "WELLNESS";
  const daysApplied = app?.totalDays || app?.requestedDays || 1;
  const inclusiveDates = formatInclusiveDates(app?.inclusiveDates || []);

  const isCommutationReq = app?.commutation === "Requested";
  const isCommutationNotReq =
    app?.commutation === "Not Requested" || !isCommutationReq;

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
  const ardInitial = approvals.find((a) => a.role === "ARD Initial");
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
    sec7B_fallbackName = ""; // TOD/ORD Chief Name Fallback if needed
    sec7B_fallbackRole = "Chief, Technical Operations Division";
  } else {
    // Defaults to AFD if neither TOD nor ORD
    sec7B_mainApprover = afdSignature;
    sec7B_initialApprovers = [afdInitial];
    sec7B_fallbackName = "MINA FLOR T. VILLAFUERTE";
    sec7B_fallbackRole = "Chief, Admin and Finance Division";
  }

  return (
    <Document title={`Wellness Leave Application - ${lastName}`}>
      <Page size="A4" style={styles.page}>
        {/* --- HEADER --- */}
        <View style={styles.headerWrapper}>
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

        <Text style={styles.formTitle}>APPLICATION FOR LEAVE</Text>

        {/* --- MAIN FORM BORDER --- */}
        <View style={styles.formBorder}>
          {/* Row 1: Office & Name */}
          <View style={styles.row}>
            <View style={[styles.colRightBorder, { width: "40%", padding: 2 }]}>
              <Text style={styles.labelTitle}>
                1. OFFICE/DEPARTMENT - DISTRICT/SCHOOL
              </Text>
              <Text style={[styles.valueText, { marginTop: 4 }]}>{office}</Text>
            </View>
            <View style={{ width: "60%", padding: 2 }}>
              <Text style={styles.labelTitle}>2. NAME :</Text>
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                <View style={{ flex: 1, alignItems: "center" }}>
                  {/* Combines lastName and nameExtension */}
                  <Text style={styles.valueText}>{displayLastName}</Text>
                  <Text style={{ fontSize: 7, marginTop: 1 }}>(Last)</Text>
                </View>
                <View style={{ flex: 1, alignItems: "center" }}>
                  {/* Combines prefix, firstName, and postfix */}
                  <Text style={styles.valueText}>{displayFirstName}</Text>
                  <Text style={{ fontSize: 7, marginTop: 1 }}>(First)</Text>
                </View>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={styles.valueText}>{middleName}</Text>
                  <Text style={{ fontSize: 7, marginTop: 1 }}>(Middle)</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Row 2: Date, Position, Salary */}
          <View style={styles.row}>
            <View
              style={[
                styles.colRightBorder,
                { width: "30%", padding: 4, flexDirection: "row" },
              ]}
            >
              <Text style={styles.labelTitle}>3. DATE OF FILING </Text>
              <View style={styles.inputUnderlineCenter}>
                <Text style={styles.valueText}>{dateOfFiling}</Text>
              </View>
            </View>
            <View
              style={[
                styles.colRightBorder,
                { width: "40%", padding: 4, flexDirection: "row" },
              ]}
            >
              <Text style={styles.labelTitle}>4. POSITION </Text>
              <View style={styles.inputUnderlineCenter}>
                <Text style={styles.valueText}>{position}</Text>
              </View>
            </View>
            <View style={{ width: "30%", padding: 4, flexDirection: "row" }}>
              <Text style={styles.labelTitle}>5. SALARY </Text>
              <View style={styles.inputUnderlineCenter}>
                <Text style={styles.valueText}>{salaryText}</Text>
              </View>
            </View>
          </View>

          {/* Section 6 Title */}
          <Text style={styles.sectionTitle}>6. DETAILS OF APPLICATION</Text>

          {/* Row 3: 6A and 6B */}
          <View style={styles.row}>
            {/* 6.A TYPE OF LEAVE */}
            <View style={[styles.colRightBorder, { width: "50%", padding: 4 }]}>
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
              <View
                style={[
                  styles.inputUnderlineCenter,
                  { marginHorizontal: 20, marginTop: 4 },
                ]}
              >
                <Text style={styles.valueText}>
                  {leaveType === "WELLNESS" ? "Wellness Leave" : ""}
                </Text>
              </View>
            </View>

            {/* 6.B DETAILS OF LEAVE */}
            <View style={{ width: "50%", padding: 4 }}>
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
                <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                  <View style={styles.checkbox}>
                    <Text style={styles.checkMark}>
                      {leaveType === "WELLNESS" ? "✓" : ""}
                    </Text>
                  </View>
                  <Text style={styles.labelTitle}>Within the Philippines </Text>
                  <View style={styles.inputUnderline}>
                    <Text style={styles.valueText}>{app?.location || ""}</Text>
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    marginTop: 4,
                  }}
                >
                  <View style={styles.checkbox}>
                    <Text style={styles.checkMark}></Text>
                  </View>
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
                  <View style={styles.checkbox}>
                    <Text style={styles.checkMark}></Text>
                  </View>
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
                  <View style={styles.checkbox}>
                    <Text style={styles.checkMark}></Text>
                  </View>
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
            <View style={[styles.colRightBorder, { width: "50%", padding: 4 }]}>
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
              <View
                style={[
                  styles.inputUnderlineCenter,
                  { marginHorizontal: 20, marginTop: 4 },
                ]}
              >
                <Text style={styles.valueText}>{inclusiveDates}</Text>
              </View>
            </View>

            <View style={{ width: "50%", padding: 4 }}>
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
                <Text style={styles.sigRole}>(Signature of Applicant)</Text>
              </View>
            </View>
          </View>

          {/* Section 7 Title */}
          <Text style={styles.sectionTitle}>
            7. DETAILS OF ACTION ON APPLICATION
          </Text>

          {/* Row 5: 7A and 7B */}
          <View style={styles.row}>
            {/* 7.A - HRMO Signature Block */}
            <View style={[styles.colRightBorder, { width: "50%", padding: 4 }]}>
              <Text style={styles.labelTitle}>
                7.A CERTIFICATION OF LEAVE CREDITS
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  marginTop: 4,
                }}
              >
                <Text style={styles.labelTitle}>As of </Text>
                <View style={[styles.inputUnderlineCenter, { width: 80 }]}>
                  <Text style={styles.valueText}>{certAsOfDate}</Text>
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
              <SlotSignatures
                mainApprover={hrInitial}
                fallbackName=""
                fallbackRole=""
                marginTop={40}
              />
            </View>

            {/* 7.B - Recommending Signatures Block */}
            <View style={{ width: "50%", padding: 4, marginBottom: 10 }}>
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
                  <View style={styles.checkbox}>
                    <Text style={styles.checkMark}>
                      {app?.overallStatus === "REJECTED" ? "✓" : ""}
                    </Text>
                  </View>
                  <Text style={styles.labelTitle}>For disapproval due to </Text>
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
              <SlotSignatures
                mainApprover={sec7B_mainApprover}
                initialApprovers={sec7B_initialApprovers}
                fallbackName={sec7B_fallbackName}
                fallbackRole={sec7B_fallbackRole}
                marginTop={40}
              />
            </View>
          </View>

          {/* Row 6: 7C and 7D */}
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={[styles.colRightBorder, { width: "50%", padding: 4 }]}>
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
                <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
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

            <View style={{ width: "50%", padding: 4 }}>
              <Text style={styles.labelTitle}>7.D DISAPPROVED DUE TO:</Text>
              <View style={{ paddingLeft: 10, marginTop: 4 }}>
                <View style={[styles.inputUnderlineCenter, { marginTop: 4 }]}>
                  <Text style={styles.valueText}>
                    {app?.overallStatus === "REJECTED" ? app?.remarks : ""}
                  </Text>
                </View>
                <View
                  style={[styles.inputUnderlineCenter, { marginTop: 8 }]}
                ></View>
                <View
                  style={[styles.inputUnderlineCenter, { marginTop: 8 }]}
                ></View>
              </View>
            </View>
          </View>

          {/* ✅ Bottom Final Signature (7C/7D Approvers) -> Set lineWidth to 40% for proportional layout */}
          <View style={{ padding: 10, marginBottom: 0 }}>
            <SlotSignatures
              mainApprover={rdSignature || ardSignature}
              initialApprovers={isTOD || isORD ? [afdSignature] : []}
              fallbackName=""
              fallbackRole=""
              marginTop={25}
              lineWidth="50%"
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
