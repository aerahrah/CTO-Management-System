// utils/sendNotifEmail.js
const sendEmail = require("./sendEmail");
const templates = require("./emailTemplates");
const KEYS = require("./emailNotificationKeys");
const { isEmailEnabled } = require("./emailNotificationSettings");

function getTemplate(key, data) {
  switch (key) {
    case KEYS.EMPLOYEE_WELCOME:
      return templates.employeeWelcomeEmail(data);

    case KEYS.CTO_APPROVAL:
      return templates.ctoApprovalEmail(data);

    case KEYS.CTO_FINAL_APPROVAL:
      return templates.ctoFinalApprovalEmail(data);

    case KEYS.CTO_REJECTION:
      return templates.ctoRejectionEmail(data);

    case KEYS.CTO_CREDIT_ADDED:
      return templates.ctoCreditAddedEmail(data);

    case KEYS.CTO_CREDIT_ROLLED_BACK:
      return templates.ctoCreditRolledBackEmail(data);

    default:
      throw new Error(`Unknown email notification key: ${key}`);
  }
}

async function sendNotifEmail(key, { to, ...data }, opts = {}) {
  const enabled = await isEmailEnabled(key);

  if (!enabled && !opts.forceSend) {
    console.log("[EMAIL] Skipped (disabled):", { key, to });
    return { skipped: true, reason: "disabled" };
  }

  const tpl = getTemplate(key, data);
  return sendEmail(to, tpl.subject, tpl.html);
}

module.exports = sendNotifEmail;
