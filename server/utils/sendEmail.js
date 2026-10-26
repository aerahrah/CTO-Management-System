// utils/sendEmail.js
const nodemailer = require("nodemailer");
const { convert } = require("html-to-text");
require("dotenv").config();

const DEBUG_EMAIL =
  String(process.env.DEBUG_EMAIL || "").toLowerCase() === "true";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

// GovMail address + its app password
const EMAIL_USER = requiredEnv("EMAIL_USER");
const EMAIL_PASS = requiredEnv("EMAIL_PASS");
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "CTO & Wellness System";
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

// ─── Monitoring settings ────────────────────────────────────────────────────
// Alerts go through a channel that does NOT depend on GovMail, because a
// broken GovMail login can't send its own warning.
//   Option 1: a personal Gmail account (its password doesn't reset monthly)
const ALERT_EMAIL_USER = process.env.ALERT_EMAIL_USER;
const ALERT_EMAIL_PASS = process.env.ALERT_EMAIL_PASS;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || ALERT_EMAIL_USER;
//   Option 2: a Telegram bot message to your phone
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Don't repeat the same alert more often than this
const ALERT_COOLDOWN_MINUTES = Number(process.env.ALERT_COOLDOWN_MINUTES || 60);
// How often to test the GovMail login (0 turns the check off)
const HEALTHCHECK_HOURS = Number(process.env.EMAIL_HEALTHCHECK_HOURS || 6);

// ─── Main transporter (GovMail) ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  logger: DEBUG_EMAIL,
  debug: DEBUG_EMAIL,
});

// ─── Helpers ────────────────────────────────────────────────────────────────
// juan.delacruz@gmail.com → ju***@gmail.com (keeps employee emails out of plain logs)
function maskEmail(addr) {
  const s = String(addr);
  const at = s.indexOf("@");
  if (at < 1) return "***";
  return `${s.slice(0, Math.min(2, at))}***${s.slice(at)}`;
}

function maskList(list) {
  return (Array.isArray(list) ? list : [list]).map(maskEmail);
}

function nowManila() {
  return new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

// Turns common SMTP errors into a plain-language hint
function explainError(err) {
  const text = `${err?.response || ""} ${err?.message || ""}`;
  if (err?.code === "EAUTH") {
    return "GovMail login rejected. If the GovMail password was changed recently, its app passwords were revoked: create a new app password and update EMAIL_PASS.";
  }
  if (/5\.4\.5|sending limit/i.test(text)) {
    return "The account hit Google's daily sending limit. Sending resumes automatically within 24 hours.";
  }
  if (["ETIMEDOUT", "ECONNECTION", "ESOCKET"].includes(err?.code)) {
    return "Could not reach the mail server. The host or firewall may be blocking outgoing SMTP ports.";
  }
  return undefined;
}

// ─── Alerts ─────────────────────────────────────────────────────────────────
let alertTransporter = null;
function getAlertTransporter() {
  if (!ALERT_EMAIL_USER || !ALERT_EMAIL_PASS) return null;
  if (!alertTransporter) {
    alertTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: ALERT_EMAIL_USER, pass: ALERT_EMAIL_PASS },
    });
  }
  return alertTransporter;
}

const lastAlertAt = new Map(); // alert key → timestamp of last alert
let failing = false; // true after a failure, until sending works again

// Sends an alert to every configured channel. Never throws.
async function sendAlert(key, subject, lines, { force = false } = {}) {
  const now = Date.now();
  const last = lastAlertAt.get(key) || 0;
  if (!force && now - last < ALERT_COOLDOWN_MINUTES * 60 * 1000) return;
  lastAlertAt.set(key, now);

  const body = lines.filter(Boolean).join("\n");
  const tasks = [];

  const alertMailer = getAlertTransporter();
  if (alertMailer) {
    tasks.push(
      alertMailer.sendMail({
        from: { name: `${EMAIL_FROM_NAME} Monitor`, address: ALERT_EMAIL_USER },
        to: ALERT_EMAIL_TO,
        subject,
        text: body,
      }),
    );
  }

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID && typeof fetch === "function") {
    tasks.push(
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: `${subject}\n\n${body}`,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error(`Telegram responded with HTTP ${r.status}`);
      }),
    );
  }

  if (!tasks.length) {
    console.error(
      `[EMAIL ALERT] (no alert channel configured)\n${subject}\n${body}`,
    );
    return;
  }

  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error(
        "[EMAIL ALERT] Could not deliver alert:",
        r.reason?.message || r.reason,
      );
    }
  }
  console.log(`[EMAIL ALERT] Sent: ${subject}`);
}

async function alertFailure(err, context) {
  failing = true;
  const isAuth = err?.code === "EAUTH";
  const hint = explainError(err);

  const subject = isAuth
    ? `⚠️ ${EMAIL_FROM_NAME}: GovMail app password stopped working`
    : `⚠️ ${EMAIL_FROM_NAME}: emails are failing to send`;

  await sendAlert(err?.code || "UNKNOWN", subject, [
    `Time: ${nowManila()}`,
    `Account: ${EMAIL_USER}`,
    `Detected during: ${context}`,
    `Error: ${[err?.code, err?.message || String(err)].filter(Boolean).join(" - ")}`,
    hint && `\nWhat it means: ${hint}`,
    isAuth &&
      "\nTo fix:\n1. Sign in to your GovMail account\n2. Go to myaccount.google.com/apppasswords and create a new app password\n3. Replace EMAIL_PASS in .env with the new one\n4. Restart the app",
    `\nYou won't get a repeat of this alert for ${ALERT_COOLDOWN_MINUTES} minutes.`,
  ]);
}

async function alertRecovered() {
  if (!failing) return;
  failing = false;
  lastAlertAt.clear(); // so the next failure alerts right away
  await sendAlert(
    "RECOVERED",
    `✅ ${EMAIL_FROM_NAME}: email sending is working again`,
    [`Time: ${nowManila()}`, `Account: ${EMAIL_USER}`],
    { force: true },
  );
}

// ─── Health check: tests the GovMail login without sending an email ────────
async function checkEmailHealth() {
  try {
    await transporter.verify();
    console.log("[EMAIL] Health check OK: GovMail login works");
    await alertRecovered();
    return true;
  } catch (err) {
    console.error("[EMAIL] Health check FAILED:", {
      message: err?.message,
      code: err?.code,
      hint: explainError(err),
    });
    await alertFailure(err, "scheduled health check");
    return false;
  }
}

// Manually confirm alerts reach you: require("./utils/sendEmail").sendTestAlert()
function sendTestAlert() {
  return sendAlert(
    "TEST",
    `🔔 ${EMAIL_FROM_NAME}: test alert`,
    [
      `Time: ${nowManila()}`,
      "If you're reading this, email failure alerts will reach you.",
    ],
    { force: true },
  );
}

// ─── Send an email ──────────────────────────────────────────────────────────
const sendEmail = async (to, subject, html) => {
  if (!to) throw new Error("sendEmail: 'to' is required");
  if (!subject) throw new Error("sendEmail: 'subject' is required");
  if (!html) throw new Error("sendEmail: 'html' is required");

  // ✅ ALWAYS log so you can confirm it's being called from frontend
  console.log("[EMAIL] sendEmail() called:", { to: maskList(to), subject });

  const htmlStr = String(html);

  const message = {
    // Must be the same address you sign in with, or Gmail treats it as spoofing
    from: { name: EMAIL_FROM_NAME, address: EMAIL_USER },
    to,
    subject,
    html: htmlStr,
    // A plain-text version alongside the HTML lowers spam scores
    text: convert(htmlStr, { wordwrap: 100 }),
    ...(EMAIL_REPLY_TO && { replyTo: EMAIL_REPLY_TO }),
  };

  try {
    if (DEBUG_EMAIL) {
      console.log("[EMAIL DEBUG] payload:", {
        from: `"${EMAIL_FROM_NAME}" <${EMAIL_USER}>`,
        to: maskList(to),
        subject,
        html_len: message.html.length,
        text_len: message.text.length,
      });
    }

    const info = await transporter.sendMail(message);

    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];

    console.log("[EMAIL] sendMail result:", {
      messageId: info.messageId,
      accepted: maskList(accepted),
      rejected: maskList(rejected),
      response: info.response,
    });

    // "Accepted" means Google's server took the message, not that it reached the inbox
    if (accepted.length)
      console.log("✅ Accepted for delivery:", maskList(accepted));
    if (rejected.length)
      console.log("❌ Rejected recipients:", maskList(rejected));

    alertRecovered().catch(() => {});
    return info;
  } catch (err) {
    console.error("[EMAIL] sendMail FAILED:", {
      message: err?.message,
      code: err?.code,
      command: err?.command,
      response: err?.response,
      responseCode: err?.responseCode,
      hint: explainError(err),
    });

    // Don't make the caller wait for the alert
    alertFailure(err, `sending "${subject}"`).catch(() => {});
    throw err;
  }
};

// ─── Start monitoring ───────────────────────────────────────────────────────
if (!getAlertTransporter() && !(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)) {
  console.warn(
    "[EMAIL] No alert channel set. Add ALERT_EMAIL_USER/ALERT_EMAIL_PASS or TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID to .env to be notified when emails fail.",
  );
}

if (HEALTHCHECK_HOURS > 0) {
  checkEmailHealth(); // once at startup
  const timer = setInterval(
    checkEmailHealth,
    HEALTHCHECK_HOURS * 60 * 60 * 1000,
  );
  timer.unref?.(); // don't keep one-off scripts running just for this
}

module.exports = sendEmail;
module.exports.checkEmailHealth = checkEmailHealth;
module.exports.sendTestAlert = sendTestAlert;
