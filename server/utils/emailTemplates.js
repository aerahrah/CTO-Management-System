// utils/emailTemplates.js
// Single place for all HRMS/CTO email templates (welcome + CTO workflow + CTO credit + Wellness + Leave Credits + Revocations)

const BRAND = {
  name: "DICT Wellness & CTO",
  primary: "#2563eb", // Modern blue
  primaryHover: "#1d4ed8",
  bg: "#f1f5f9", // Softer slate background
  surface: "#ffffff",
  text: "#1e293b", // Slate 800
  muted: "#64748b", // Slate 500
  border: "#e2e8f0", // Slate 200
  success: "#16a34a",
  danger: "#dc2626",
  warning: "#d97706",
};

// Fallback font stack favored by modern email clients
const FONT_FAMILY = `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "#";
  try {
    const u = new URL(raw, "https://example.com");
    const isHttp = u.protocol === "http:" || u.protocol === "https:";
    return isHttp ? raw : "#";
  } catch {
    return "#";
  }
}

// ───────────────────────────────────────────────────────────────
// MASTER LAYOUT
// ───────────────────────────────────────────────────────────────
function emailLayout({
  title,
  preheader,
  greeting,
  intro,
  detailsRowsHtml,
  cta,
  outro,
  brandName = BRAND.name,
  footerNote = "This is an automated message. Please do not reply directly to this email.",
}) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader || title);

  const ctaHtml = cta?.label
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 32px; margin-bottom: 32px;">
        <tr>
          <td align="center">
            <a href="${sanitizeUrl(cta.url)}" target="_blank" rel="noreferrer"
              style="
                display: inline-block;
                background-color: ${BRAND.primary};
                color: #ffffff;
                text-decoration: none;
                padding: 14px 28px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 15px;
                text-align: center;
              ">
              ${escapeHtml(cta.label)}
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${BRAND.bg}; color:${BRAND.text}; font-family:${FONT_FAMILY}; -webkit-font-smoothing: antialiased;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      ${safePreheader} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.bg}; padding: 40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
            style="
              width: 100%;
              max-width: 600px;
              background-color: ${BRAND.surface};
              border: 1px solid ${BRAND.border};
              border-radius: 12px;
              overflow: hidden;
            ">

            <tr>
              <td style="padding: 24px 32px; border-bottom: 1px solid ${BRAND.border};">
                <div style="color:${BRAND.primary}; font-weight:700; font-size:18px; letter-spacing:-0.3px;">
                  ${escapeHtml(brandName)}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding: 32px;">
                <h1 style="margin:0 0 16px; font-size: 22px; font-weight: 700; color:${BRAND.text}; letter-spacing: -0.5px;">
                  ${safeTitle}
                </h1>

                ${
                  greeting
                    ? `<p style="margin: 0 0 16px; color:${BRAND.text}; font-size: 16px; line-height: 24px;">
                  ${greeting}
                </p>`
                    : ""
                }

                ${
                  intro
                    ? `<p style="margin: 0 0 24px; color:${BRAND.muted}; font-size: 15px; line-height: 24px;">
                  ${intro}
                </p>`
                    : ""
                }

                ${
                  detailsRowsHtml
                    ? `
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                    style="background-color: #f8fafc; border: 1px solid ${BRAND.border}; border-radius: 8px; margin-bottom: 24px;">
                    ${detailsRowsHtml}
                  </table>
                `
                    : ""
                }

                ${ctaHtml}

                ${
                  outro
                    ? `<p style="margin: 0 0 24px; color:${BRAND.muted}; font-size: 15px; line-height: 24px;">
                  ${outro}
                </p>`
                    : ""
                }

                <p style="margin: 0; color:${BRAND.text}; font-size: 15px; line-height: 24px;">
                  Best regards,<br />
                  <span style="font-weight: 600;">The Dev Team</span>
                </p>
              </td>
            </tr>

          </table>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width: 100%; max-width: 600px;">
            <tr>
              <td style="padding: 24px 32px; text-align: center;">
                <p style="margin:0 0 8px; color:${BRAND.muted}; font-size: 13px; line-height: 20px;">
                  ${escapeHtml(footerNote).replace(/\n/g, "<br />")}
                   </p>
                <p style="margin:0; color:${BRAND.muted}; font-size: 13px;">
                  &copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ───────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────
function detailRow(label, value, isLast = false, valueColor = BRAND.text) {
  const borderBottom = isLast
    ? ""
    : `border-bottom: 1px solid ${BRAND.border};`;
  return `
    <tr>
      <td style="padding: 14px 16px; width: 35%; ${borderBottom} font-weight: 600; font-size: 14px; color:${BRAND.muted}; vertical-align: top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding: 14px 16px; ${borderBottom} font-size: 14px; color:${valueColor}; font-weight: 500; vertical-align: top; line-height: 20px;">
        ${value}
      </td>
    </tr>
  `;
}

function formatDateLikeHuman(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

// Accepts either a preformatted string ("Oct 5, 2026 to Oct 6, 2026")
// or an array of dates and returns readable text.
function formatDateRange(dates) {
  if (!dates) return "—";
  if (typeof dates === "string") return dates.trim() || "—";
  if (!Array.isArray(dates) || dates.length === 0) return "—";

  const valid = dates
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);

  if (valid.length === 0) return "—";

  const first = formatDateLikeHuman(valid[0]);
  const last = formatDateLikeHuman(valid[valid.length - 1]);
  return first === last ? first : `${first} to ${last}`;
}

// ───────────────────────────────────────────────────────────────
// WELCOME EMAIL
// ───────────────────────────────────────────────────────────────
function employeeWelcomeEmail({
  firstName,
  email,
  tempPassword,
  loginUrl,
  brandName = BRAND.name,
}) {
  const safeFirstName = escapeHtml(firstName || "there");
  const safeEmail = escapeHtml(email || "");
  const safeTempPass = escapeHtml(tempPassword || "");
  const safeLoginUrl = sanitizeUrl(loginUrl);

  const details = `
    ${detailRow("Email Address", safeEmail || "<em>(not provided)</em>")} 
    ${detailRow(
      "Temporary Password",
      safeTempPass
        ? `<code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: ${BRAND.text};">${safeTempPass}</code>`
        : "<em>(not provided)</em>",
      true,
    )}
  `;

  return {
    subject: `Welcome to ${brandName} — Your Account Details`,
    html: emailLayout({
      title: "Your account is ready",
      preheader: `Login details for your new ${brandName} account`,
      greeting: `Hi <strong>${safeFirstName}</strong>,`,
      intro:
        "An account has been created for you on the portal. Please use the credentials below to log in. We highly recommend changing your password immediately after your first sign-in.",
      detailsRowsHtml: details,
      cta:
        safeLoginUrl !== "#"
          ? { label: "Sign In to Portal", url: `${safeLoginUrl}` }
          : null,
      outro:
        "If you did not expect this email, please contact your administrator immediately.",
      brandName,
      footerNote:
        "If the button above does not work, copy and paste this link into your browser: " +
        safeLoginUrl,
    }),
  };
}

// ───────────────────────────────────────────────────────────────
// CTO APPROVALS
// ───────────────────────────────────────────────────────────────
function ctoApprovalEmail({
  approverName,
  employeeName,
  requestedHours,
  reason,
  level,
  link,
  brandName = BRAND.name,
}) {
  const safeApprover = escapeHtml(approverName || "Approver");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeHours = escapeHtml(requestedHours ?? "0");
  const safeReason = escapeHtml(reason || "—");
  const safeLevel = escapeHtml(level ?? "—");

  const details = `
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Hours", `${safeHours} hrs`)}
    ${detailRow("Reason", safeReason)}
    ${detailRow("Approval Level", `Level ${safeLevel}`, true)}
  `;

  return {
    subject: `Action Required: CTO Application — ${employeeName || "Pending"}`,
    html: emailLayout({
      title: "Pending CTO Application",
      preheader: `Review required for CTO request by ${employeeName}`,
      greeting: `Hi <strong>${safeApprover}</strong>,`,
      intro:
        "A Compensatory Time-Off (CTO) application requires your review and approval. Please verify the details below.",
      detailsRowsHtml: details,
      cta: { label: "Review Application", url: link },
      outro:
        "Prompt action helps ensure smooth processing of employee leave records.",
      brandName,
    }),
  };
}

function ctoFollowUpEmail({
  approverName,
  employeeName,
  requestedHours,
  level,
  link,
  brandName = BRAND.name,
}) {
  const safeApprover = escapeHtml(approverName || "Approver");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeHours = escapeHtml(requestedHours ?? "0");
  const safeLevel = escapeHtml(level ?? "—");

  const details = `
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Hours", `${safeHours} hrs`)}
    ${detailRow("Approval Level", `Level ${safeLevel}`, true)}
  `;

  return {
    subject: `Reminder: CTO Application Pending Approval — ${employeeName || "Pending"}`,
    html: emailLayout({
      title: "CTO Application Follow-up",
      preheader: `Reminder to review the pending CTO request from ${employeeName}`,
      greeting: `Hi <strong>${safeApprover}</strong>,`,
      intro: `<strong>${safeEmployee}</strong> has requested a follow-up on their pending Compensatory Time-Off (CTO) application. Please review it at your earliest convenience.`,
      detailsRowsHtml: details,
      cta: { label: "Review Application", url: link },
      outro:
        "Prompt action helps ensure smooth processing of employee leave records.",
      brandName,
    }),
  };
}

function ctoStepApprovalEmail({
  employeeName,
  approverName,
  level,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeApprover = escapeHtml(approverName || "an approver");
  const safeLevel = escapeHtml(level ?? "—");

  const details = `
    ${detailRow("Status", "Partially Approved", false, BRAND.primary)}
    ${detailRow("Approved By", safeApprover)}
    ${detailRow("Approval Level", `Level ${safeLevel}`, true)}
  `;

  return {
    subject: `Update: CTO Application Approved (Level ${safeLevel})`,
    html: emailLayout({
      title: "CTO Application Update",
      preheader: `Your CTO application has passed Level ${safeLevel} approval.`,
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro: `Your Compensatory Time-Off (CTO) application has been approved by <strong>${safeApprover}</strong> (Level ${safeLevel}). It has now been forwarded to the next step for further review.`,
      detailsRowsHtml: details,
      cta: null,
      outro: "We will notify you once the final approval is completed.",
      brandName,
    }),
  };
}

function ctoFinalApprovalEmail({
  employeeName,
  requestedHours,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeHours = escapeHtml(requestedHours ?? "0");

  const details = `
    ${detailRow("Status", "Approved", false, BRAND.success)}
    ${detailRow("Approved Hours", `${safeHours} hrs`, true)}
  `;

  return {
    subject: "Approved: Your CTO Application",
    html: emailLayout({
      title: "CTO Application Approved",
      preheader: "Your CTO request has been successfully approved.",
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro:
        "Great news! Your Compensatory Time-Off (CTO) application has been fully approved by all required signatories.",
      detailsRowsHtml: details,
      cta: null,
      outro:
        "Your hours have been deducted and the schedule is confirmed. Enjoy your time off.",
      brandName,
    }),
  };
}

function ctoRejectionEmail({ employeeName, remarks, brandName = BRAND.name }) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeRemarks = escapeHtml(remarks || "No remarks provided.");

  const details = `
    ${detailRow("Status", "Rejected", false, BRAND.danger)}
    ${detailRow("Remarks", safeRemarks, true)}
  `;

  return {
    subject: "Update: Your CTO Application",
    html: emailLayout({
      title: "CTO Application Update",
      preheader: "There has been an update regarding your CTO application.",
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro:
        "Your recent Compensatory Time-Off (CTO) application has unfortunately been declined. Please review the specific remarks below.",
      detailsRowsHtml: details,
      cta: null,
      outro:
        "If you require further clarification, please reach out directly to your approving supervisor.",
      brandName,
    }),
  };
}

// Sent to approvers who already saw the request when the employee cancels it
function ctoCancelledApproverEmail({
  approverName,
  employeeName,
  requestedHours,
  inclusiveDates,
  brandName = BRAND.name,
}) {
  const safeApprover = escapeHtml(approverName || "Approver");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeHours = escapeHtml(formatHours(requestedHours));
  const safeDates = escapeHtml(formatDateRange(inclusiveDates));

  const details = `
    ${detailRow("Status", "Cancelled by Employee", false, BRAND.muted)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Hours", `${safeHours} hrs`)}
    ${detailRow("Dates Covered", safeDates, true)}
  `;

  return {
    subject: `Notice: CTO Application Cancelled — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "CTO Application Cancelled",
      preheader: `${employeeName || "An employee"} has cancelled their CTO application.`,
      greeting: `Hi <strong>${safeApprover}</strong>,`,
      intro: `<strong>${safeEmployee}</strong> has cancelled their Compensatory Time-Off (CTO) application.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No further action is required from you. The application has been removed from your approval queue.",
      brandName,
    }),
  };
}

// ───────────────────────────────────────────────────────────────
// CTO — NOTIFIED EMPLOYEES (FYI only, no action required)
// ───────────────────────────────────────────────────────────────

// Sent when the CTO application is filed
function ctoNotifiedEmail({
  recipientName,
  employeeName,
  requestedHours,
  inclusiveDates,
  reason,
  brandName = BRAND.name,
}) {
  const safeRecipient = escapeHtml(recipientName || "there");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeHours = escapeHtml(formatHours(requestedHours));
  const safeDates = escapeHtml(formatDateRange(inclusiveDates));
  const safeReason = escapeHtml(reason || "—");

  const details = `
    ${detailRow("Status", "Pending Approval", false, BRAND.warning)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Hours", `${safeHours} hrs`)}
    ${detailRow("Dates Covered", safeDates)}
    ${detailRow("Reason", safeReason, true)}
  `;

  return {
    subject: `For Your Information: CTO Application — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "CTO Application Filed",
      preheader: `${employeeName || "An employee"} has filed a CTO application.`,
      greeting: `Hi <strong>${safeRecipient}</strong>,`,
      intro: `This is to inform you that <strong>${safeEmployee}</strong> has filed a Compensatory Time-Off (CTO) application. You are receiving this because you were tagged to be notified on their requests.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No action is required from you. This notice is for your information and coordination only.",
      brandName,
    }),
  };
}

// Sent when the CTO application is fully approved (final approver signed)
function ctoNotifiedFinalApprovalEmail({
  recipientName,
  employeeName,
  requestedHours,
  inclusiveDates,
  approvedBy,
  brandName = BRAND.name,
}) {
  const safeRecipient = escapeHtml(recipientName || "there");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeHours = escapeHtml(formatHours(requestedHours));
  const safeDates = escapeHtml(formatDateRange(inclusiveDates));
  const safeApprovedBy = escapeHtml(approvedBy || "");

  const details = `
    ${detailRow("Status", "Approved", false, BRAND.success)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Approved Hours", `${safeHours} hrs`)}
    ${detailRow("Dates Covered", safeDates, !safeApprovedBy)}
    ${safeApprovedBy ? detailRow("Final Approver", safeApprovedBy, true) : ""}
  `;

  return {
    subject: `For Your Information: CTO Approved — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "CTO Application Approved",
      preheader: `${employeeName || "An employee"}'s CTO application has been approved.`,
      greeting: `Hi <strong>${safeRecipient}</strong>,`,
      intro: `This is to inform you that the Compensatory Time-Off (CTO) application of <strong>${safeEmployee}</strong> has been fully approved.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No action is required from you. Please take note of the dates above for coordination purposes.",
      brandName,
    }),
  };
}

// Sent when the CTO application is rejected by an approver
function ctoNotifiedRejectionEmail({
  recipientName,
  employeeName,
  requestedHours,
  inclusiveDates,
  rejectedBy,
  remarks,
  brandName = BRAND.name,
}) {
  const safeRecipient = escapeHtml(recipientName || "there");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeHours = escapeHtml(formatHours(requestedHours));
  const safeDates = escapeHtml(formatDateRange(inclusiveDates));
  const safeRejectedBy = escapeHtml(rejectedBy || "an approver");
  const safeRemarks = escapeHtml(remarks || "No remarks provided.");

  const details = `
    ${detailRow("Status", "Rejected", false, BRAND.danger)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Hours", `${safeHours} hrs`)}
    ${detailRow("Dates Covered", safeDates)}
    ${detailRow("Rejected By", safeRejectedBy)}
    ${detailRow("Remarks", safeRemarks, true)}
  `;

  return {
    subject: `For Your Information: CTO Not Approved — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "CTO Application Not Approved",
      preheader: `${employeeName || "An employee"}'s CTO application was not approved.`,
      greeting: `Hi <strong>${safeRecipient}</strong>,`,
      intro: `This is to inform you that the Compensatory Time-Off (CTO) application of <strong>${safeEmployee}</strong> was not approved.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No action is required from you. The employee is expected to report for work on the dates above.",
      brandName,
    }),
  };
}

// Sent when the employee cancels their CTO application
function ctoNotifiedCancelledEmail({
  recipientName,
  employeeName,
  requestedHours,
  inclusiveDates,
  brandName = BRAND.name,
}) {
  const safeRecipient = escapeHtml(recipientName || "there");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeHours = escapeHtml(formatHours(requestedHours));
  const safeDates = escapeHtml(formatDateRange(inclusiveDates));

  const details = `
    ${detailRow("Status", "Cancelled by Employee", false, BRAND.muted)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Hours", `${safeHours} hrs`)}
    ${detailRow("Dates Covered", safeDates, true)}
  `;

  return {
    subject: `For Your Information: CTO Cancelled — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "CTO Application Cancelled",
      preheader: `${employeeName || "An employee"} has cancelled their CTO application.`,
      greeting: `Hi <strong>${safeRecipient}</strong>,`,
      intro: `This is to inform you that <strong>${safeEmployee}</strong> has cancelled their Compensatory Time-Off (CTO) application.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No action is required from you. The employee is expected to report for work on the dates above.",
      brandName,
    }),
  };
}

// ───────────────────────────────────────────────────────────────
// WELLNESS APPROVALS
// ───────────────────────────────────────────────────────────────
function wellnessApprovalEmail({
  approverName,
  employeeName,
  requestedDays,
  inclusiveDates,
  reason,
  level,
  link,
  brandName = BRAND.name,
}) {
  const safeApprover = escapeHtml(approverName || "Approver");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeDays = escapeHtml(requestedDays ?? "0");
  const safeDates = escapeHtml(inclusiveDates || "—");
  const safeReason = escapeHtml(reason || "—");
  const safeLevel = escapeHtml(level ?? "—");

  const details = `
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Days", `${safeDays} day(s)`)}
    ${detailRow("Dates Covered", safeDates)}
    ${detailRow("Reason", safeReason)}
    ${detailRow("Approval Level", `Level ${safeLevel}`, true)}
  `;

  return {
    subject: `Action Required: Wellness Leave — ${employeeName || "Pending"}`,
    html: emailLayout({
      title: "Pending Wellness Leave",
      preheader: `Review required for Wellness Leave request by ${employeeName}`,
      greeting: `Hi <strong>${safeApprover}</strong>,`,
      intro:
        "A Wellness Leave application requires your review. Please verify the schedule and details provided below.",
      detailsRowsHtml: details,
      cta: { label: "Review Application", url: link },
      outro:
        "Prompt action helps ensure smooth processing of employee leave records.",
      brandName,
    }),
  };
}

function wellnessFollowUpEmail({
  approverName,
  employeeName,
  requestedDays,
  level,
  link,
  brandName = BRAND.name,
}) {
  const safeApprover = escapeHtml(approverName || "Approver");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeDays = escapeHtml(requestedDays ?? "0");
  const safeLevel = escapeHtml(level ?? "—");

  const details = `
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Days", `${safeDays} day(s)`)}
    ${detailRow("Approval Level", `Level ${safeLevel}`, true)}
  `;

  return {
    subject: `Reminder: Wellness Leave Pending Approval — ${employeeName || "Pending"}`,
    html: emailLayout({
      title: "Wellness Leave Follow-up",
      preheader: `Reminder to review the pending Wellness Leave request from ${employeeName}`,
      greeting: `Hi <strong>${safeApprover}</strong>,`,
      intro: `<strong>${safeEmployee}</strong> has requested a follow-up on their pending Wellness Leave application. Please review it at your earliest convenience.`,
      detailsRowsHtml: details,
      cta: { label: "Review Application", url: link },
      outro:
        "Prompt action helps ensure smooth processing of employee leave records.",
      brandName,
    }),
  };
}

function wellnessStepApprovalEmail({
  employeeName,
  approverName,
  level,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeApprover = escapeHtml(approverName || "an approver");
  const safeLevel = escapeHtml(level ?? "—");

  const details = `
    ${detailRow("Status", "Partially Approved", false, BRAND.primary)}
    ${detailRow("Approved By", safeApprover)}
    ${detailRow("Approval Level", `Level ${safeLevel}`, true)}
  `;

  return {
    subject: `Update: Wellness Leave Approved (Level ${safeLevel})`,
    html: emailLayout({
      title: "Wellness Leave Update",
      preheader: `Your Wellness Leave application has passed Level ${safeLevel} approval.`,
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro: `Your Wellness Leave application has been approved by <strong>${safeApprover}</strong> (Level ${safeLevel}). It has now been forwarded to the next step for further review.`,
      detailsRowsHtml: details,
      cta: null,
      outro: "We will notify you once the final approval is completed.",
      brandName,
    }),
  };
}

function wellnessFinalApprovalEmail({
  employeeName,
  requestedDays,
  inclusiveDates,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeDays = escapeHtml(requestedDays ?? "0");
  const safeDates = escapeHtml(inclusiveDates || "—");

  const details = `
    ${detailRow("Status", "Approved", false, BRAND.success)}
    ${detailRow("Approved Days", `${safeDays} day(s)`)}
    ${detailRow("Dates Covered", safeDates, true)}
  `;

  return {
    subject: "Approved: Your Wellness Leave",
    html: emailLayout({
      title: "Wellness Leave Approved",
      preheader: "Your Wellness Leave request has been successfully approved.",
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro:
        "Great news! Your Wellness Leave application has been fully approved.",
      detailsRowsHtml: details,
      cta: null,
      outro:
        "Your leave balance has been adjusted accordingly. We hope you have a restful time off.",
      brandName,
    }),
  };
}

function wellnessRejectionEmail({
  employeeName,
  remarks,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeRemarks = escapeHtml(remarks || "No remarks provided.");

  const details = `
    ${detailRow("Status", "Rejected", false, BRAND.danger)}
    ${detailRow("Remarks", safeRemarks, true)}
  `;

  return {
    subject: "Update: Your Wellness Leave",
    html: emailLayout({
      title: "Wellness Leave Update",
      preheader:
        "There has been an update regarding your Wellness Leave application.",
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro:
        "Your recent Wellness Leave application has unfortunately been declined. Please review the specific remarks below.",
      detailsRowsHtml: details,
      cta: null,
      outro:
        "If you require further clarification, please reach out directly to your approving supervisor.",
      brandName,
    }),
  };
}

// Sent to approvers who already saw the request when the employee cancels it
function wellnessCancelledApproverEmail({
  approverName,
  employeeName,
  requestedDays,
  inclusiveDates,
  brandName = BRAND.name,
}) {
  const safeApprover = escapeHtml(approverName || "Approver");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeDays = escapeHtml(String(requestedDays ?? 0));
  const safeDates = escapeHtml(formatDateRange(inclusiveDates));

  const details = `
    ${detailRow("Status", "Cancelled by Employee", false, BRAND.muted)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Days", `${safeDays} day(s)`)}
    ${detailRow("Dates Covered", safeDates, true)}
  `;

  return {
    subject: `Notice: Wellness Leave Cancelled — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "Wellness Leave Cancelled",
      preheader: `${employeeName || "An employee"} has cancelled their Wellness Leave application.`,
      greeting: `Hi <strong>${safeApprover}</strong>,`,
      intro: `<strong>${safeEmployee}</strong> has cancelled their Wellness Leave application.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No further action is required from you. The application has been removed from your approval queue.",
      brandName,
    }),
  };
}

// ───────────────────────────────────────────────────────────────
// WELLNESS — NOTIFIED EMPLOYEES (FYI only, no action required)
// ───────────────────────────────────────────────────────────────

// Sent when the Wellness Leave application is filed
function wellnessNotifiedEmail({
  recipientName,
  employeeName,
  requestedDays,
  inclusiveDates,
  reason,
  brandName = BRAND.name,
}) {
  const safeRecipient = escapeHtml(recipientName || "there");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeDays = escapeHtml(String(requestedDays ?? 0));
  const safeDates = escapeHtml(formatDateRange(inclusiveDates));
  const safeReason = escapeHtml(reason || "—");

  const details = `
    ${detailRow("Status", "Pending Approval", false, BRAND.warning)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Days", `${safeDays} day(s)`)}
    ${detailRow("Dates Covered", safeDates)}
    ${detailRow("Reason", safeReason, true)}
  `;

  return {
    subject: `For Your Information: Wellness Leave — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "Wellness Leave Filed",
      preheader: `${employeeName || "An employee"} has filed a Wellness Leave application.`,
      greeting: `Hi <strong>${safeRecipient}</strong>,`,
      intro: `This is to inform you that <strong>${safeEmployee}</strong> has filed a Wellness Leave application. You are receiving this because you were tagged to be notified on their requests.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No action is required from you. This notice is for your information and coordination only.",
      brandName,
    }),
  };
}

// Sent when the Wellness Leave application is fully approved
function wellnessNotifiedFinalApprovalEmail({
  recipientName,
  employeeName,
  requestedDays,
  inclusiveDates,
  approvedBy,
  brandName = BRAND.name,
}) {
  const safeRecipient = escapeHtml(recipientName || "there");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeDays = escapeHtml(String(requestedDays ?? 0));
  const safeDates = escapeHtml(formatDateRange(inclusiveDates));
  const safeApprovedBy = escapeHtml(approvedBy || "");

  const details = `
    ${detailRow("Status", "Approved", false, BRAND.success)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Approved Days", `${safeDays} day(s)`)}
    ${detailRow("Dates Covered", safeDates, !safeApprovedBy)}
    ${safeApprovedBy ? detailRow("Final Approver", safeApprovedBy, true) : ""}
  `;

  return {
    subject: `For Your Information: Wellness Leave Approved — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "Wellness Leave Approved",
      preheader: `${employeeName || "An employee"}'s Wellness Leave has been approved.`,
      greeting: `Hi <strong>${safeRecipient}</strong>,`,
      intro: `This is to inform you that the Wellness Leave application of <strong>${safeEmployee}</strong> has been fully approved.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No action is required from you. Please take note of the dates above for coordination purposes.",
      brandName,
    }),
  };
}

// Sent when the Wellness Leave application is rejected by an approver
function wellnessNotifiedRejectionEmail({
  recipientName,
  employeeName,
  requestedDays,
  inclusiveDates,
  rejectedBy,
  remarks,
  brandName = BRAND.name,
}) {
  const safeRecipient = escapeHtml(recipientName || "there");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeDays = escapeHtml(String(requestedDays ?? 0));
  const safeDates = escapeHtml(formatDateRange(inclusiveDates));
  const safeRejectedBy = escapeHtml(rejectedBy || "an approver");
  const safeRemarks = escapeHtml(remarks || "No remarks provided.");

  const details = `
    ${detailRow("Status", "Rejected", false, BRAND.danger)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Days", `${safeDays} day(s)`)}
    ${detailRow("Dates Covered", safeDates)}
    ${detailRow("Rejected By", safeRejectedBy)}
    ${detailRow("Remarks", safeRemarks, true)}
  `;

  return {
    subject: `For Your Information: Wellness Leave Not Approved — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "Wellness Leave Not Approved",
      preheader: `${employeeName || "An employee"}'s Wellness Leave was not approved.`,
      greeting: `Hi <strong>${safeRecipient}</strong>,`,
      intro: `This is to inform you that the Wellness Leave application of <strong>${safeEmployee}</strong> was not approved.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No action is required from you. The employee is expected to report for work on the dates above.",
      brandName,
    }),
  };
}

// Sent when the employee cancels their Wellness Leave application
function wellnessNotifiedCancelledEmail({
  recipientName,
  employeeName,
  requestedDays,
  inclusiveDates,
  brandName = BRAND.name,
}) {
  const safeRecipient = escapeHtml(recipientName || "there");
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeDays = escapeHtml(String(requestedDays ?? 0));
  const safeDates = escapeHtml(formatDateRange(inclusiveDates));

  const details = `
    ${detailRow("Status", "Cancelled by Employee", false, BRAND.muted)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Requested Days", `${safeDays} day(s)`)}
    ${detailRow("Dates Covered", safeDates, true)}
  `;

  return {
    subject: `For Your Information: Wellness Leave Cancelled — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "Wellness Leave Cancelled",
      preheader: `${employeeName || "An employee"} has cancelled their Wellness Leave application.`,
      greeting: `Hi <strong>${safeRecipient}</strong>,`,
      intro: `This is to inform you that <strong>${safeEmployee}</strong> has cancelled their Wellness Leave application.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No action is required from you. The employee is expected to report for work on the dates above.",
      brandName,
    }),
  };
}

// ───────────────────────────────────────────────────────────────
// CTO REVOCATIONS
// ───────────────────────────────────────────────────────────────
function ctoRevocationRequestEmail({
  hrName = "HR Admin",
  employeeName,
  requestedHours,
  reason,
  link,
  brandName = BRAND.name,
}) {
  const safeHR = escapeHtml(hrName);
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeHours = escapeHtml(requestedHours ?? "0");
  const safeReason = escapeHtml(reason || "—");

  const details = `
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Hours to Revoke", `${safeHours} hrs`)}
    ${detailRow("Reason", safeReason, true)}
  `;

  return {
    subject: `Action Required: CTO Revocation Request — ${employeeName || "Pending"}`,
    html: emailLayout({
      title: "Pending CTO Revocation Request",
      preheader: `${employeeName} has requested to revoke an approved CTO.`,
      greeting: `Hi <strong>${safeHR}</strong>,`,
      intro: `<strong>${safeEmployee}</strong> has submitted a request to revoke a previously approved Compensatory Time-Off (CTO). Please review the request and attachment.`,
      detailsRowsHtml: details,
      cta: { label: "Review Revocation", url: link },
      outro: "Please process this request to maintain accurate leave balances.",
      brandName,
    }),
  };
}

function ctoRevocationApprovedEmail({
  employeeName,
  restoredHours,
  remarks,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeHours = escapeHtml(restoredHours ?? "0");
  const safeRemarks = escapeHtml(remarks || "—");

  const details = `
    ${detailRow("Status", "Revocation Approved", false, BRAND.success)}
    ${detailRow("Restored Hours", `+${safeHours} hrs`)}
    ${detailRow("Remarks", safeRemarks, true)}
  `;

  return {
    subject: "Approved: Your CTO Revocation Request",
    html: emailLayout({
      title: "CTO Revocation Approved",
      preheader: "Your CTO revocation request has been successfully approved.",
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro:
        "Your request to revoke your previously approved Compensatory Time-Off (CTO) has been fully approved by HR.",
      detailsRowsHtml: details,
      cta: null,
      outro: "Your hours have been successfully restored to your CTO balance.",
      brandName,
    }),
  };
}

function ctoRevocationRejectedEmail({
  employeeName,
  remarks,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeRemarks = escapeHtml(remarks || "No remarks provided.");

  const details = `
    ${detailRow("Status", "Revocation Rejected", false, BRAND.danger)}
    ${detailRow("Remarks", safeRemarks, true)}
  `;

  return {
    subject: "Update: Your CTO Revocation Request",
    html: emailLayout({
      title: "CTO Revocation Rejected",
      preheader: "Your CTO revocation request has been declined.",
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro:
        "Your request to revoke your approved Compensatory Time-Off (CTO) has unfortunately been declined by HR.",
      detailsRowsHtml: details,
      cta: null,
      outro:
        "Your CTO schedule and balance remain unchanged. Please review the remarks or reach out to HR for further clarification.",
      brandName,
    }),
  };
}

function ctoRevocationCancelledEmail({
  hrName = "HR Admin",
  employeeName,
  requestedHours,
  brandName = BRAND.name,
}) {
  const safeHR = escapeHtml(hrName);
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeHours = escapeHtml(requestedHours ?? "0");

  const details = `
    ${detailRow("Status", "Withdrawn by Employee", false, BRAND.muted)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Hours Intended to Revoke", `${safeHours} hrs`, true)}
  `;

  return {
    subject: `Notice: CTO Revocation Withdrawn — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "CTO Revocation Withdrawn",
      preheader: `${employeeName} has withdrawn their CTO revocation request.`,
      greeting: `Hi <strong>${safeHR}</strong>,`,
      intro: `<strong>${safeEmployee}</strong> has withdrawn their pending request to revoke a Compensatory Time-Off (CTO).`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No further action is required from you for this request. The leave remains in its original Approved state.",
      brandName,
    }),
  };
}

// ───────────────────────────────────────────────────────────────
// WELLNESS REVOCATIONS
// ───────────────────────────────────────────────────────────────
function wellnessRevocationRequestEmail({
  hrName = "HR Admin",
  employeeName,
  requestedDays,
  inclusiveDates,
  reason,
  link,
  brandName = BRAND.name,
}) {
  const safeHR = escapeHtml(hrName);
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeDays = escapeHtml(requestedDays ?? "0");
  const safeDates = escapeHtml(inclusiveDates || "—");
  const safeReason = escapeHtml(reason || "—");

  const details = `
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Days to Revoke", `${safeDays} day(s)`)}
    ${detailRow("Dates Covered", safeDates)}
    ${detailRow("Reason", safeReason, true)}
  `;

  return {
    subject: `Action Required: Wellness Revocation Request — ${employeeName || "Pending"}`,
    html: emailLayout({
      title: "Pending Wellness Revocation Request",
      preheader: `${employeeName} has requested to revoke an approved Wellness Leave.`,
      greeting: `Hi <strong>${safeHR}</strong>,`,
      intro: `<strong>${safeEmployee}</strong> has submitted a request to revoke a previously approved Wellness Leave. Please review the request and attachment.`,
      detailsRowsHtml: details,
      cta: { label: "Review Revocation", url: link },
      outro: "Please process this request to maintain accurate leave balances.",
      brandName,
    }),
  };
}

function wellnessRevocationApprovedEmail({
  employeeName,
  restoredDays,
  inclusiveDates,
  remarks,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeDays = escapeHtml(restoredDays ?? "0");
  const safeDates = escapeHtml(inclusiveDates || "—");
  const safeRemarks = escapeHtml(remarks || "—");

  const details = `
    ${detailRow("Status", "Revocation Approved", false, BRAND.success)}
    ${detailRow("Restored Days", `+${safeDays} day(s)`)}
    ${detailRow("Original Dates", safeDates)}
    ${detailRow("Remarks", safeRemarks, true)}
  `;

  return {
    subject: "Approved: Your Wellness Leave Revocation Request",
    html: emailLayout({
      title: "Wellness Revocation Approved",
      preheader: "Your Wellness Leave revocation request has been approved.",
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro:
        "Your request to revoke your previously approved Wellness Leave has been fully approved by HR.",
      detailsRowsHtml: details,
      cta: null,
      outro:
        "Your days have been successfully restored to your Wellness Leave balance.",
      brandName,
    }),
  };
}

function wellnessRevocationRejectedEmail({
  employeeName,
  remarks,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeRemarks = escapeHtml(remarks || "No remarks provided.");

  const details = `
    ${detailRow("Status", "Revocation Rejected", false, BRAND.danger)}
    ${detailRow("Remarks", safeRemarks, true)}
  `;

  return {
    subject: "Update: Your Wellness Leave Revocation Request",
    html: emailLayout({
      title: "Wellness Revocation Rejected",
      preheader: "Your Wellness Leave revocation request has been declined.",
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro:
        "Your request to revoke your approved Wellness Leave has unfortunately been declined by HR.",
      detailsRowsHtml: details,
      cta: null,
      outro:
        "Your leave schedule and balance remain unchanged. Please review the remarks or reach out to HR for further clarification.",
      brandName,
    }),
  };
}

function wellnessRevocationCancelledEmail({
  hrName = "HR Admin",
  employeeName,
  requestedDays,
  inclusiveDates,
  brandName = BRAND.name,
}) {
  const safeHR = escapeHtml(hrName);
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeDays = escapeHtml(requestedDays ?? "0");
  const safeDates = escapeHtml(inclusiveDates || "—");

  const details = `
    ${detailRow("Status", "Withdrawn by Employee", false, BRAND.muted)}
    ${detailRow("Employee", safeEmployee)}
    ${detailRow("Days Intended to Revoke", `${safeDays} day(s)`)}
    ${detailRow("Original Dates", safeDates, true)}
  `;

  return {
    subject: `Notice: Wellness Revocation Withdrawn — ${employeeName || "Employee"}`,
    html: emailLayout({
      title: "Wellness Revocation Withdrawn",
      preheader: `${employeeName} has withdrawn their Wellness Leave revocation request.`,
      greeting: `Hi <strong>${safeHR}</strong>,`,
      intro: `<strong>${safeEmployee}</strong> has withdrawn their pending request to revoke an approved Wellness Leave.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "No further action is required from you for this request. The leave remains in its original Approved state.",
      brandName,
    }),
  };
}

// ───────────────────────────────────────────────────────────────
// CTO CREDIT EMAILS
// ───────────────────────────────────────────────────────────────

// Handles three cases:
//  - Fully credited              (forfeitedHours = 0)
//  - Partially credited (capped) (creditedHours > 0, forfeitedHours > 0)
//  - Not credited (limit reached)(creditedHours = 0)
function ctoCreditAddedEmail({
  employeeName,
  memoNo,
  creditedHours,
  forfeitedHours = 0,
  capReason = "", // "BALANCE" | "MONTHLY" | ""
  maxBalanceLimit = 120,
  maxMonthlyEarning = 40,
  dateApproved,
  brandName = BRAND.name,
}) {
  const credited = Number(creditedHours) || 0;
  const forfeited = Number(forfeitedHours) || 0;

  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeMemoNo = escapeHtml(memoNo || "—");
  const safeCredited = escapeHtml(formatHours(credited));
  const safeForfeited = escapeHtml(formatHours(forfeited));
  const safeDate = escapeHtml(formatDateLikeHuman(dateApproved));

  const limitText =
    capReason === "BALANCE"
      ? `the ${formatHours(maxBalanceLimit)}-hour maximum for unused CTO hours`
      : capReason === "MONTHLY"
        ? `the ${formatHours(maxMonthlyEarning)}-hour monthly earning limit`
        : "the CSC earning limits";
  const safeLimitText = escapeHtml(limitText);

  const notCredited = credited <= 0;
  const partial = !notCredited && forfeited > 0;

  const statusLabel = notCredited
    ? "Not Credited (Limit Reached)"
    : partial
      ? "Partially Credited"
      : "Credited";
  const statusColor = notCredited || partial ? BRAND.warning : BRAND.primary;

  const details = `
    ${detailRow("Status", statusLabel, false, statusColor)}
    ${detailRow("Memo Ref.", safeMemoNo)}
    ${detailRow("Date Approved", safeDate)}
    ${detailRow(
      "Credited Hours",
      `+${safeCredited} hrs`,
      forfeited <= 0,
      notCredited ? BRAND.muted : BRAND.success,
    )}
    ${
      forfeited > 0
        ? `${detailRow("Not Credited", `${safeForfeited} hrs`, false, BRAND.danger)}
           ${detailRow("Reason", `Reached ${safeLimitText}`, true)}`
        : ""
    }
  `;

  const memoSuffix = memoNo ? ` (Memo ${memoNo})` : "";

  let subject;
  let title;
  let preheader;
  let intro;
  let outro;

  if (notCredited) {
    subject = `Notice: CTO Credit Not Applied${memoSuffix}`;
    title = "CTO Credit Not Applied";
    preheader = "No CTO hours were added because you reached the CSC limit.";
    intro = `You were included in a CTO credit memo, but <strong>no hours were added</strong> to your balance because you have reached ${safeLimitText}.`;
    outro =
      "Once you use some of your CTO hours (or a new month starts, for the monthly limit), you can earn credits again. Please contact HR if you believe this is incorrect.";
  } else if (partial) {
    subject = `Notice: CTO Partially Credited${memoSuffix}`;
    title = "CTO Partially Credited";
    preheader =
      "Some of your CTO hours were not credited due to the CSC limit.";
    intro = `<strong>${safeCredited} hour(s)</strong> were added to your CTO balance. The remaining <strong>${safeForfeited} hour(s)</strong> were not credited because you reached ${safeLimitText}.`;
    outro =
      "You can view your updated balance in the portal. Please contact HR if you believe this is incorrect.";
  } else {
    subject = `Notice: New CTO Credit Added${memoSuffix}`;
    title = "CTO Balance Updated";
    preheader = "New compensatory hours have been added to your account.";
    intro =
      "New Compensatory Time-Off (CTO) hours have been successfully credited to your balance.";
    outro = "You can view your updated total balance directly in the portal.";
  }

  return {
    subject,
    html: emailLayout({
      title,
      preheader,
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro,
      detailsRowsHtml: details,
      cta: null,
      outro,
      brandName,
    }),
  };
}

function ctoCreditRolledBackEmail({
  employeeName,
  memoNo,
  rolledBackHours,
  dateRolledBack,
  reason,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeMemoNo = escapeHtml(memoNo || "—");
  const safeHours = escapeHtml(formatHours(rolledBackHours));
  const safeDate = escapeHtml(formatDateLikeHuman(dateRolledBack));
  const safeReason = escapeHtml(reason || "—");

  const details = `
    ${detailRow("Status", "Rolled Back", false, BRAND.warning)}
    ${detailRow("Memo Ref.", safeMemoNo)}
    ${detailRow("Date Reversed", safeDate)}
    ${detailRow("Hours Deducted", `-${safeHours} hrs`, false, BRAND.danger)}
    ${detailRow("Reason", safeReason, true)}
  `;

  return {
    subject: `Notice: CTO Credit Reversal (Memo ${memoNo || ""})`.trim(),
    html: emailLayout({
      title: "CTO Credit Reversed",
      preheader: "A previous CTO credit was rolled back from your account.",
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro:
        "A previously applied Compensatory Time-Off (CTO) credit has been rolled back, and your balance has been adjusted accordingly.",
      detailsRowsHtml: details,
      cta: null,
      outro:
        "If you believe this adjustment was made in error, please contact HR/Administration immediately.",
      brandName,
    }),
  };
}

// ───────────────────────────────────────────────────────────────
// WELLNESS CREDIT EMAILS
// ───────────────────────────────────────────────────────────────
function wellnessCreditAddedEmail({
  employeeName,
  memoNo,
  creditedDays,
  dateApproved,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeMemoNo = escapeHtml(memoNo || "—");
  const safeDays = escapeHtml(String(creditedDays ?? 0));
  const safeDate = escapeHtml(formatDateLikeHuman(dateApproved));

  const details = `
    ${detailRow("Status", "Credited", false, BRAND.primary)}
    ${detailRow("Memo Ref.", safeMemoNo)}
    ${detailRow("Date Approved", safeDate)}
    ${detailRow("Credited Days", `+${safeDays} day(s)`, true, BRAND.success)}
  `;

  return {
    subject:
      `Notice: New Wellness Leave Credited (Memo ${memoNo || ""})`.trim(),
    html: emailLayout({
      title: "Wellness Balance Updated",
      preheader: "New wellness days have been added to your account.",
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro:
        "New Wellness Leave days have been successfully credited to your balance.",
      detailsRowsHtml: details,
      cta: null,
      outro: "You can view your updated leave balance directly in the portal.",
      brandName,
    }),
  };
}

function wellnessCreditRolledBackEmail({
  employeeName,
  memoNo,
  rolledBackDays,
  dateRolledBack,
  reason,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeMemoNo = escapeHtml(memoNo || "—");
  const safeDays = escapeHtml(String(rolledBackDays ?? 0));
  const safeDate = escapeHtml(formatDateLikeHuman(dateRolledBack));
  const safeReason = escapeHtml(reason || "—");

  const details = `
    ${detailRow("Status", "Rolled Back", false, BRAND.warning)}
    ${detailRow("Memo Ref.", safeMemoNo)}
    ${detailRow("Date Reversed", safeDate)}
    ${detailRow("Days Deducted", `-${safeDays} day(s)`, false, BRAND.danger)}
    ${detailRow("Reason", safeReason, true)}
  `;

  return {
    subject: `Notice: Wellness Leave Reversal (Memo ${memoNo || ""})`.trim(),
    html: emailLayout({
      title: "Wellness Credit Reversed",
      preheader:
        "A previous Wellness credit was rolled back from your account.",
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro:
        "A previously applied Wellness Leave credit has been rolled back, and your balance has been adjusted accordingly.",
      detailsRowsHtml: details,
      cta: null,
      outro:
        "If you believe this adjustment was made in error, please contact HR/Administration immediately.",
      brandName,
    }),
  };
}

// ───────────────────────────────────────────────────────────────
// LEAVE CREDIT EMAILS (VL/SL)
// ───────────────────────────────────────────────────────────────
function leaveCreditAddedEmail({
  employeeName,
  leaveType,
  creditedDays,
  dateApproved,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const fullLeaveName =
    leaveType === "VL"
      ? "Vacation Leave"
      : leaveType === "SL"
        ? "Sick Leave"
        : escapeHtml(leaveType || "Leave");
  const safeDays = escapeHtml(String(creditedDays ?? 0));
  const safeDate = escapeHtml(formatDateLikeHuman(dateApproved));

  const details = `
    ${detailRow("Status", "Credited", false, BRAND.primary)}
    ${detailRow("Leave Type", fullLeaveName)}
    ${detailRow("Date Approved", safeDate)}
    ${detailRow("Credited Days", `+${safeDays} day(s)`, true, BRAND.success)}
  `;

  return {
    subject: `Notice: New ${fullLeaveName} Credit Added`,
    html: emailLayout({
      title: "Leave Balance Updated",
      preheader: `New ${fullLeaveName} days have been added to your account.`,
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro: `New ${fullLeaveName} days have been successfully credited to your balance.`,
      detailsRowsHtml: details,
      cta: null,
      outro: "You can view your updated leave balance directly in the portal.",
      brandName,
    }),
  };
}

function leaveCreditRolledBackEmail({
  employeeName,
  leaveType,
  rolledBackDays,
  dateRolledBack,
  reason,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const fullLeaveName =
    leaveType === "VL"
      ? "Vacation Leave"
      : leaveType === "SL"
        ? "Sick Leave"
        : escapeHtml(leaveType || "Leave");
  const safeDays = escapeHtml(String(rolledBackDays ?? 0));
  const safeDate = escapeHtml(formatDateLikeHuman(dateRolledBack));
  const safeReason = escapeHtml(reason || "—");

  const details = `
    ${detailRow("Status", "Rolled Back", false, BRAND.warning)}
    ${detailRow("Leave Type", fullLeaveName)}
    ${detailRow("Date Reversed", safeDate)}
    ${detailRow("Days Deducted", `-${safeDays} day(s)`, false, BRAND.danger)}
    ${detailRow("Reason", safeReason, true)}
  `;

  return {
    subject: `Notice: ${fullLeaveName} Credit Reversal`,
    html: emailLayout({
      title: "Leave Credit Reversed",
      preheader: `A previous ${fullLeaveName} credit was rolled back from your account.`,
      greeting: `Hi <strong>${safeEmployee}</strong>,`,
      intro: `A previously applied ${fullLeaveName} credit has been rolled back, and your balance has been adjusted accordingly.`,
      detailsRowsHtml: details,
      cta: null,
      outro:
        "If you believe this adjustment was made in error, please contact HR/Administration immediately.",
      brandName,
    }),
  };
}
module.exports = {
  employeeWelcomeEmail,

  // CTO workflow
  ctoApprovalEmail,
  ctoFollowUpEmail,
  ctoStepApprovalEmail,
  ctoFinalApprovalEmail,
  ctoRejectionEmail,
  ctoCancelledApproverEmail,

  // CTO — notified employees
  ctoNotifiedEmail,
  ctoNotifiedFinalApprovalEmail,
  ctoNotifiedRejectionEmail,
  ctoNotifiedCancelledEmail,

  // CTO revocations
  ctoRevocationRequestEmail,
  ctoRevocationApprovedEmail,
  ctoRevocationRejectedEmail,
  ctoRevocationCancelledEmail,

  // CTO credits
  ctoCreditAddedEmail,
  ctoCreditRolledBackEmail,

  // Wellness workflow
  wellnessApprovalEmail,
  wellnessFollowUpEmail,
  wellnessStepApprovalEmail,
  wellnessFinalApprovalEmail,
  wellnessRejectionEmail,
  wellnessCancelledApproverEmail,

  // Wellness — notified employees
  wellnessNotifiedEmail,
  wellnessNotifiedFinalApprovalEmail,
  wellnessNotifiedRejectionEmail,
  wellnessNotifiedCancelledEmail,

  // Wellness revocations
  wellnessRevocationRequestEmail,
  wellnessRevocationApprovedEmail,
  wellnessRevocationRejectedEmail,
  wellnessRevocationCancelledEmail,

  // Wellness credits
  wellnessCreditAddedEmail,
  wellnessCreditRolledBackEmail,

  // Leave credits (VL/SL)
  leaveCreditAddedEmail,
  leaveCreditRolledBackEmail,

  // Shared building blocks (used by utils/blastEmailTemplates.js)
  BRAND,
  emailLayout,
  detailRow,
  escapeHtml,
  sanitizeUrl,
  formatDateLikeHuman,
};
