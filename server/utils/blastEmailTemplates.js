// utils/blastEmailTemplates.js
// Bulk / broadcast ("blast") email templates.
//
// Every template returns { subject, html, text }. The plain-text part matters
// for bulk sends: mail servers are more likely to flag HTML-only messages as spam.

const {
  BRAND,
  emailLayout,
  detailRow,
  escapeHtml,
  sanitizeUrl,
} = require("./emailTemplates");

// Name shown in blast emails (workflow emails keep BRAND.name)
const BLAST_BRAND_NAME = "DICT CTO & Wellness";

const FONT_FAMILY = `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const CODE_STYLE = `font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: ${BRAND.text};`;

const CATEGORY_COLORS = {
  GENERAL: BRAND.primary,
  REMINDER: BRAND.warning,
  MAINTENANCE: BRAND.warning,
  URGENT: BRAND.danger,
};

const PASSWORD_WARNING =
  "IMPORTANT: Please change your password immediately after logging in!";
const PASSWORD_TIP =
  "For security purposes, use a strong password with at least 8 characters including uppercase, lowercase, numbers, and special characters.";
const DEPARTMENT =
  "Department of Information and Communications Technology – Region 2";

// "JOEY MARK" -> "Joey Mark", "CIRILO JR." -> "Cirilo Jr."
function toNameCase(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'.])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

// Plain text -> safe HTML. Blank lines split paragraphs, single newlines become <br />.
function textToHtml(text) {
  return String(text ?? "")
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((para) => escapeHtml(para.trim()).replace(/\r?\n/g, "<br />"))
    .filter(Boolean)
    .join("<br /><br />");
}

function textFooter(brandName) {
  return [
    "Best regards,",
    "The Dev Team",
    "",
    "---",
    `This is an automated message from ${brandName}`,
    DEPARTMENT,
    "Please do not reply to this email.",
  ].join("\n");
}

// ───────────────────────────────────────────────────────────────
// ACCOUNT CREDENTIALS BLAST
// Welcomes each employee and sends their login email + password.
// Has its own layout: yellow warning box and dark footer.
// ───────────────────────────────────────────────────────────────
function blastAccountCredentialsEmail({
  fullName, // e.g. "MARC IVAN GUILLERMO D."
  email,
  defaultPassword,
  loginUrl,
  brandName = BLAST_BRAND_NAME,
}) {
  const displayName = String(fullName || "")
    .trim()
    .toUpperCase();
  const safeBrand = escapeHtml(brandName);
  const safeName = escapeHtml(displayName);
  const safeEmail = escapeHtml(email || "");
  const safePassword = escapeHtml(defaultPassword || "");
  const safeLoginUrl = sanitizeUrl(loginUrl);
  const hasLink = safeLoginUrl !== "#";

  const title = `Welcome to ${brandName}!`;
  const introText =
    `Welcome to the ${brandName} Portal - the official CTO and Wellness Leave ` +
    "management platform for the Department of Information and Communications " +
    "Technology (DICT) Region 2. You may now sign in using the credentials below:";

  const details = `
    ${detailRow("Email", safeEmail || "<em>(not provided)</em>")}
    ${detailRow(
      "Password",
      safePassword
        ? `<code style="${CODE_STYLE}">${safePassword}</code>`
        : "<em>(not provided)</em>",
      true,
    )}
  `;

  const ctaHtml = hasLink
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 8px;">
        <tr>
          <td align="center">
            <a href="${safeLoginUrl}" target="_blank" rel="noreferrer"
              style="display:inline-block; background-color:${BRAND.primary}; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-weight:600; font-size:15px;">
              Sign In to Portal
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top: 12px; color:${BRAND.muted}; font-size:12px; line-height:18px;">
            If the button does not work, copy and paste this link into your browser:<br />
            <a href="${safeLoginUrl}" target="_blank" rel="noreferrer" style="color:${BRAND.primary}; word-break: break-all;">${escapeHtml(safeLoginUrl)}</a>
          </td>
        </tr>
      </table>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${BRAND.bg}; color:${BRAND.text}; font-family:${FONT_FAMILY}; -webkit-font-smoothing: antialiased;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      Your login credentials for the ${safeBrand} Portal &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.bg}; padding: 40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
            style="width:100%; max-width:600px; background-color:${BRAND.surface}; border:1px solid ${BRAND.border}; border-radius:12px; overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="padding: 24px 32px; border-bottom: 1px solid ${BRAND.border};">
                <div style="color:${BRAND.primary}; font-weight:700; font-size:18px; letter-spacing:-0.3px;">
                  ${safeBrand}
                </div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 32px;">
                <h1 style="margin:0 0 16px; font-size:22px; font-weight:700; color:${BRAND.text}; letter-spacing:-0.5px;">
                  ${escapeHtml(title)}
                </h1>

                <p style="margin:0 0 16px; color:${BRAND.text}; font-size:16px; line-height:24px;">
                  ${displayName ? `Dear <strong>${safeName}</strong>,` : "Dear Sir/Ma'am,"}
                </p>

                <p style="margin:0 0 24px; color:${BRAND.muted}; font-size:15px; line-height:24px;">
                  ${escapeHtml(introText)}
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                  style="background-color:#f8fafc; border:1px solid ${BRAND.border}; border-radius:8px; margin-bottom:24px;">
                  ${details}
                </table>

                ${ctaHtml}

                <!-- Warning -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                  style="margin-top:24px; background-color:#fef3c7; border:1px solid #fbbf24; border-radius:8px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <p style="margin:0 0 8px; color:#92400e; font-size:15px; font-weight:700; line-height:22px;">
                        ${escapeHtml(PASSWORD_WARNING)}
                      </p>
                      <p style="margin:0; color:#78350f; font-size:13px; line-height:20px;">
                        ${escapeHtml(PASSWORD_TIP)}
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0; color:${BRAND.text}; font-size:15px; line-height:24px;">
                  Best regards,<br />
                  <span style="font-weight:600;">The Dev Team</span>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding: 24px 32px; background-color:#1f1f1f;">
                <p style="margin:0 0 8px; color:#d4d4d4; font-size:13px; line-height:20px;">
                  This is an automated message from <strong style="color:#ffffff;">${safeBrand}</strong>
                </p>
                <p style="margin:0 0 8px; color:#a3a3a3; font-size:12px; line-height:18px;">
                  ${escapeHtml(DEPARTMENT)}
                </p>
                <p style="margin:0; color:#a3a3a3; font-size:12px; line-height:18px;">
                  Please do not reply to this email.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    title,
    "",
    displayName ? `Dear ${displayName},` : "Dear Sir/Ma'am,",
    "",
    introText,
    "",
    `Email: ${email || "(not provided)"}`,
    `Password: ${defaultPassword || "(not provided)"}`,
    hasLink ? `Portal: ${safeLoginUrl}` : null,
    "",
    PASSWORD_WARNING,
    PASSWORD_TIP,
    "",
    textFooter(brandName),
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    subject: `Welcome to ${brandName} — Your Login Credentials`,
    html,
    text,
  };
}

// ───────────────────────────────────────────────────────────────
// GENERIC ANNOUNCEMENT BLAST
// Free-form message to everyone (maintenance notices, reminders, memos, ...).
// ───────────────────────────────────────────────────────────────
function blastAnnouncementEmail({
  recipientName,
  subject,
  title,
  message, // plain text; blank lines = new paragraph
  category = "GENERAL", // GENERAL | REMINDER | MAINTENANCE | URGENT
  details = [], // [{ label, value }] plain-text values
  cta = null, // { label, url }
  senderName = "",
  brandName = BLAST_BRAND_NAME,
}) {
  const displayName = toNameCase(recipientName);
  const cat = String(category || "GENERAL").toUpperCase();
  const catLabel = cat.charAt(0) + cat.slice(1).toLowerCase();
  const catColor = CATEGORY_COLORS[cat] || BRAND.primary;
  const finalTitle = title || subject || "Announcement";

  const greetingHtml = displayName
    ? `Good day, Sir/Ma'am <strong>${escapeHtml(displayName)}</strong>,`
    : "Good day, Sir/Ma'am,";
  const greetingText = displayName
    ? `Good day, Sir/Ma'am ${displayName},`
    : "Good day, Sir/Ma'am,";

  const rows = [
    { label: "Category", value: catLabel, color: catColor },
    ...details.filter((d) => d && d.label),
    ...(senderName ? [{ label: "From", value: senderName }] : []),
  ];
  const detailsRowsHtml = rows
    .map((r, i) =>
      detailRow(
        r.label,
        escapeHtml(r.value ?? "—"),
        i === rows.length - 1,
        r.color || BRAND.text,
      ),
    )
    .join("");

  const ctaUrl = cta?.label ? sanitizeUrl(cta.url) : "#";
  const hasCta = ctaUrl !== "#";

  const html = emailLayout({
    title: finalTitle,
    preheader: String(message ?? "")
      .trim()
      .split(/\r?\n/)[0]
      .slice(0, 120),
    greeting: greetingHtml,
    intro: textToHtml(message),
    detailsRowsHtml,
    cta: hasCta ? { label: cta.label, url: ctaUrl } : null,
    outro: null,
    brandName,
  });

  const text = [
    greetingText,
    "",
    String(message ?? "").trim(),
    "",
    ...rows.map((r) => `${r.label}: ${r.value ?? "—"}`),
    hasCta ? `${cta.label}: ${ctaUrl}` : null,
    "",
    textFooter(brandName),
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    subject: subject || finalTitle,
    html,
    text,
  };
}

module.exports = {
  blastAccountCredentialsEmail,
  blastAnnouncementEmail,

  // helpers
  toNameCase,
  textToHtml,
};
