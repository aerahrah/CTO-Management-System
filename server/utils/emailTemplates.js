// utils/emailTemplates.js
// Single place for all HRMS/CTO email templates (welcome + CTO workflow + CTO credit)
// Usage example:
//   const { employeeWelcomeEmail, ctoApprovalEmail, ctoCreditAddedEmail } = require("../utils/emailTemplates");
//   const tpl = employeeWelcomeEmail({ firstName, username, tempPassword, loginUrl });
//   await sendEmail(to, tpl.subject, tpl.html);

const BRAND = {
  name: "CTO Management System",
  primary: "#2563eb",
  bg: "#f8fafc",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
};

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Avoid `javascript:` links, keep only http/https. Returns "#" if unsafe.
function sanitizeUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "#";
  try {
    const u = new URL(raw, "https://example.com"); // base helps relative parsing
    const isHttp = u.protocol === "http:" || u.protocol === "https:";
    return isHttp ? raw : "#";
  } catch {
    return "#";
  }
}

function emailLayout({
  title,
  preheader,
  greeting, // e.g. "Good day <strong>Marc</strong>,"
  intro, // short paragraph
  detailsRowsHtml, // <tr>...</tr>
  cta, // { label, url } or null
  outro, // closing paragraph
  brandName = BRAND.name,
  footerNote = "This is an automated message. Please do not reply.",
}) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader || title);

  const ctaHtml = cta?.label
    ? `
      <tr>
        <td style="padding-top: 16px;">
          <a href="${sanitizeUrl(cta.url)}" target="_blank" rel="noreferrer"
            style="
              display: inline-block;
              background: ${BRAND.primary};
              color: #ffffff;
              text-decoration: none;
              padding: 12px 18px;
              border-radius: 8px;
              font-weight: 700;
              font-size: 14px;
            ">
            ${escapeHtml(cta.label)}
          </a>
        </td>
      </tr>
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
  <body style="margin:0; padding:0; background:${BRAND.bg}; color:${BRAND.text};">
    <!-- Preheader (hidden) -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      ${safePreheader}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="background:${BRAND.bg}; padding: 24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
            style="
              width: 100%;
              max-width: 600px;
              background: #ffffff;
              border: 1px solid ${BRAND.border};
              border-radius: 14px;
              overflow: hidden;
              box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06);
            ">

            <!-- Header -->
            <tr>
              <td style="background:${BRAND.primary}; padding: 18px 20px;">
                <div style="color:#ffffff; font-weight:800; font-size:16px; letter-spacing:0.2px;">
                  ${escapeHtml(brandName)}
                </div>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 22px 20px;">
                <h1 style="margin:0 0 10px; font-size: 20px; line-height: 1.25; color:${BRAND.text};">
                  ${safeTitle}
                </h1>

                ${
                  greeting
                    ? `<p style="margin: 10px 0 0; color:${BRAND.text}; font-size: 14px; line-height: 1.6;">
                  ${greeting}
                </p>`
                    : ""
                }

                ${
                  intro
                    ? `<p style="margin: 12px 0 0; color:${BRAND.text}; font-size: 14px; line-height: 1.6;">
                  ${intro}
                </p>`
                    : ""
                }

                ${
                  detailsRowsHtml
                    ? `
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                    style="margin-top: 14px; border: 1px solid ${BRAND.border}; border-radius: 12px; overflow:hidden;">
                    ${detailsRowsHtml}
                  </table>
                `
                    : ""
                }

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  ${ctaHtml}
                </table>

                ${
                  outro
                    ? `<p style="margin: 16px 0 0; color:${BRAND.text}; font-size: 14px; line-height: 1.6;">
                  ${outro}
                </p>`
                    : ""
                }

                <p style="margin: 18px 0 0; color:${BRAND.muted}; font-size: 13px; line-height: 1.6;">
                  Regards,<br />
                  <strong>${escapeHtml(brandName)}</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f1f5f9; padding: 14px 20px;">
                <p style="margin:0; color:${BRAND.muted}; font-size: 12px; line-height: 1.5;">
                  ${escapeHtml(footerNote)}
                </p>
                <p style="margin:6px 0 0; color:${BRAND.muted}; font-size: 12px;">
                  &copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}
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

function detailRow(label, value) {
  return `
    <tr>
      <td style="padding: 10px 12px; width: 38%; background:#f8fafc; border-bottom: 1px solid ${BRAND.border}; font-weight: 700; font-size: 13px; color:${BRAND.text};">
        ${escapeHtml(label)}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid ${BRAND.border}; font-size: 13px; color:${BRAND.text};">
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
    month: "short",
    day: "2-digit",
  });
}

function formatHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n)) return "0";
  // keep up to 2 decimals, trim trailing zeros
  return String(Math.round(n * 100) / 100);
}

// ───────────────────────────────────────────────────────────────
// ABOVE EMAIL (Employee creation welcome email)
// ───────────────────────────────────────────────────────────────
function employeeWelcomeEmail({
  firstName,
  username,
  tempPassword,
  loginUrl,
  brandName = "HRMS",
}) {
  const safeFirstName = escapeHtml(firstName || "there");
  const safeUsername = escapeHtml(username || "");
  const safeTempPass = escapeHtml(tempPassword || "");
  const safeLoginUrl = sanitizeUrl(loginUrl);

  const details = `
    ${detailRow("Username", safeUsername || "<em>(not provided)</em>")}
    ${detailRow(
      "Temporary Password",
      safeTempPass
        ? `<code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${safeTempPass}</code>`
        : "<em>(not provided)</em>",
    )}
  `;

  return {
    subject: `Welcome to ${brandName} — Your account details`,
    html: emailLayout({
      title: "Your account has been created",
      preheader: `Login details for ${brandName}`,
      greeting: `Good day <strong>${safeFirstName}</strong>,`,
      intro:
        "Your account is ready. Please use the details below to sign in. For security, change your password immediately after logging in.",
      detailsRowsHtml: details,
      cta:
        safeLoginUrl !== "#"
          ? { label: "Log in", url: `${safeLoginUrl}` }
          : null,
      outro:
        "If you did not expect this email, please contact your HR administrator.",
      brandName,
      footerNote:
        "If you’re having trouble with the button above, copy and paste the login link into your browser.",
    }),
  };
}

// ───────────────────────────────────────────────────────────────
// BELOW EMAILS (CTO approvals)
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
    ${detailRow("Requested Hours", safeHours)}
    ${detailRow("Reason", safeReason)}
    ${detailRow("Approval Level", `Level ${safeLevel}`)}
  `;

  return {
    subject: `CTO Approval Request (Level ${level}) — ${employeeName || "Pending"}`,
    html: emailLayout({
      title: `CTO Approval Request (Level ${safeLevel})`,
      preheader: `Action required: CTO approval for ${employeeName || "an employee"}`,
      greeting: `Good day <strong>${safeApprover}</strong>,`,
      intro:
        "You have a pending CTO application awaiting your approval. Review the request details below and proceed using the button.",
      detailsRowsHtml: details,
      cta: { label: "Review application", url: link },
      outro: "If you believe this was sent in error, please ignore this email.",
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
    ${detailRow("Status", "<strong>Approved</strong>")}
    ${detailRow("Approved Hours", safeHours)}
  `;

  return {
    subject: "CTO Application Approved",
    html: emailLayout({
      title: "Your CTO application is approved",
      preheader: "Your CTO request has been fully approved",
      greeting: `Good day <strong>${safeEmployee}</strong>,`,
      intro: "Your CTO application has been <strong>fully approved</strong>.",
      detailsRowsHtml: details,
      cta: null,
      outro: "You may now proceed based on the approved hours. Thank you.",
      brandName,
    }),
  };
}

function ctoRejectionEmail({ employeeName, remarks, brandName = BRAND.name }) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeRemarks = escapeHtml(remarks || "No remarks provided");

  const details = `
    ${detailRow("Status", "<strong>Rejected</strong>")}
    ${detailRow("Remarks", safeRemarks)}
  `;

  return {
    subject: "CTO Application Rejected",
    html: emailLayout({
      title: "Your CTO application was rejected",
      preheader: "Update on your CTO request",
      greeting: `Good day <strong>${safeEmployee}</strong>,`,
      intro:
        "Your CTO application has been <strong>rejected</strong>. Please see the remarks below.",
      detailsRowsHtml: details,
      cta: null,
      outro:
        "If you need clarification, please coordinate with your supervisor/approver.",
      brandName,
    }),
  };
}

// ───────────────────────────────────────────────────────────────
// CTO CREDIT EMAILS (add credit + rollback credit)
// ───────────────────────────────────────────────────────────────

// For notifying employees that CTO hours were credited to them
function ctoCreditAddedEmail({
  employeeName,
  memoNo,
  creditedHours,
  dateApproved,
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeMemoNo = escapeHtml(memoNo || "—");
  const safeHours = escapeHtml(formatHours(creditedHours));
  const safeDate = escapeHtml(formatDateLikeHuman(dateApproved));

  const details = `
    ${detailRow("Status", "<strong>Credited</strong>")}
    ${detailRow("Memo No.", safeMemoNo)}
    ${detailRow("Date Approved", safeDate)}
    ${detailRow("Credited Hours", safeHours)}
  `;

  return {
    subject: `CTO Credit Added — Memo ${memoNo || ""}`.trim(),
    html: emailLayout({
      title: "CTO credit has been added to your balance",
      preheader: "Your CTO hours have been credited",
      greeting: `Good day <strong>${safeEmployee}</strong>,`,
      intro:
        "Your CTO balance has been updated. Please see the credit details below.",
      detailsRowsHtml: details,
      cta: null,
      outro:
        "If you believe this update is incorrect, please contact your HR/Admin.",
      brandName,
    }),
  };
}

// For notifying employees that a CTO credit memo was rolled back (balance reduced)
function ctoCreditRolledBackEmail({
  employeeName,
  memoNo,
  rolledBackHours,
  dateRolledBack,
  reason, // optional
  brandName = BRAND.name,
}) {
  const safeEmployee = escapeHtml(employeeName || "Employee");
  const safeMemoNo = escapeHtml(memoNo || "—");
  const safeHours = escapeHtml(formatHours(rolledBackHours));
  const safeDate = escapeHtml(formatDateLikeHuman(dateRolledBack));
  const safeReason = escapeHtml(reason || "—");

  const details = `
    ${detailRow("Status", "<strong>Rolled Back</strong>")}
    ${detailRow("Memo No.", safeMemoNo)}
    ${detailRow("Date Rolled Back", safeDate)}
    ${detailRow("Hours Removed", safeHours)}
    ${detailRow("Reason", safeReason)}
  `;

  return {
    subject: `CTO Credit Rolled Back — Memo ${memoNo || ""}`.trim(),
    html: emailLayout({
      title: "A CTO credit was rolled back",
      preheader: "Your CTO balance was adjusted due to a rollback",
      greeting: `Good day <strong>${safeEmployee}</strong>,`,
      intro:
        "A previously credited CTO memo was rolled back, and your CTO balance has been adjusted. Details are below.",
      detailsRowsHtml: details,
      cta: null,
      outro: "If you have questions, please contact your HR/Admin.",
      brandName,
    }),
  };
}

module.exports = {
  employeeWelcomeEmail,
  ctoApprovalEmail,
  ctoFinalApprovalEmail,
  ctoRejectionEmail,
  ctoCreditAddedEmail,
  ctoCreditRolledBackEmail,
};
