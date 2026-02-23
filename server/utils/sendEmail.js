// utils/sendEmail.js
const nodemailer = require("nodemailer");
require("dotenv").config();

const DEBUG_EMAIL =
  String(process.env.DEBUG_EMAIL || "").toLowerCase() === "true";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

const EMAIL_USER = requiredEnv("EMAIL_USER");
const EMAIL_PASS = requiredEnv("EMAIL_PASS");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  logger: DEBUG_EMAIL,
  debug: DEBUG_EMAIL,
});

if (DEBUG_EMAIL) {
  transporter.verify((err) => {
    if (err)
      console.error("❌ Email transporter verify failed:", err?.message || err);
    else console.log("✅ Email transporter is ready (verify OK)");
  });
}

const sendEmail = async (to, subject, html) => {
  // ✅ ALWAYS log so you can confirm it's being called from frontend
  console.log("[EMAIL] sendEmail() called:", { to, subject });

  if (!to) throw new Error("sendEmail: 'to' is required");
  if (!subject) throw new Error("sendEmail: 'subject' is required");
  if (!html) throw new Error("sendEmail: 'html' is required");

  try {
    if (DEBUG_EMAIL) {
      console.log("[EMAIL DEBUG] payload:", {
        from: `"DICT HRMS" <${EMAIL_USER}>`,
        to,
        subject,
        html_len: String(html).length,
      });
    }

    const info = await transporter.sendMail({
      from: `"DICT HRMS" <${EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    // ✅ Clear result logs
    console.log("[EMAIL] sendMail result:", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });

    // ✅ Quick success / failure statement
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];

    if (accepted.includes(to))
      console.log("✅ Email accepted for delivery to:", to);
    if (rejected.includes(to))
      console.log("❌ Email rejected for recipient:", to);

    return info;
  } catch (err) {
    console.error("[EMAIL] sendMail FAILED:", {
      message: err?.message,
      code: err?.code,
      command: err?.command,
      response: err?.response,
      responseCode: err?.responseCode,
    });

    throw err;
  }
};

module.exports = sendEmail;
