// utils/sendNotifEmail.js
const sendEmail = require("./sendEmail");
const templates = require("./emailTemplates");
const KEYS = require("./emailNotificationKeys");
const { isEmailEnabled } = require("./emailNotificationSettings");

function getTemplate(key, data) {
  switch (key) {
    case KEYS.EMPLOYEE_WELCOME:
      return templates.employeeWelcomeEmail(data);

    // --- CTO Workflows ---
    case KEYS.CTO_APPROVAL:
      return templates.ctoApprovalEmail(data);

    case KEYS.CTO_FOLLOW_UP:
      return templates.ctoFollowUpEmail(data);

    case KEYS.CTO_FINAL_APPROVAL:
      return templates.ctoFinalApprovalEmail(data);

    case KEYS.CTO_REJECTION:
      return templates.ctoRejectionEmail(data);

    // --- CTO Revocations ---
    case KEYS.CTO_REVOCATION_REQUEST:
      return templates.ctoRevocationRequestEmail(data);

    case KEYS.CTO_REVOCATION_APPROVED:
      return templates.ctoRevocationApprovedEmail(data);

    case KEYS.CTO_REVOCATION_REJECTED:
      return templates.ctoRevocationRejectedEmail(data);

    case KEYS.CTO_REVOCATION_CANCELLED: // ✅ Added
      return templates.ctoRevocationCancelledEmail(data);

    // --- CTO Credits ---
    case KEYS.CTO_CREDIT_ADDED:
      return templates.ctoCreditAddedEmail(data);

    case KEYS.CTO_CREDIT_ROLLED_BACK:
      return templates.ctoCreditRolledBackEmail(data);

    // --- Wellness Workflows ---
    case KEYS.WELLNESS_APPROVAL:
      return templates.wellnessApprovalEmail(data);

    case KEYS.WELLNESS_FOLLOW_UP:
      return templates.wellnessFollowUpEmail(data);

    case KEYS.WELLNESS_FINAL_APPROVAL:
      return templates.wellnessFinalApprovalEmail(data);

    case KEYS.WELLNESS_REJECTION:
      return templates.wellnessRejectionEmail(data);

    // --- Wellness Revocations ---
    case KEYS.WELLNESS_REVOCATION_REQUEST:
      return templates.wellnessRevocationRequestEmail(data);

    case KEYS.WELLNESS_REVOCATION_APPROVED:
      return templates.wellnessRevocationApprovedEmail(data);

    case KEYS.WELLNESS_REVOCATION_REJECTED:
      return templates.wellnessRevocationRejectedEmail(data);

    case KEYS.WELLNESS_REVOCATION_CANCELLED: // ✅ Added
      return templates.wellnessRevocationCancelledEmail(data);

    // --- Wellness Credits ---
    case KEYS.WELLNESS_CREDIT_ADDED:
      return templates.wellnessCreditAddedEmail(data);

    case KEYS.WELLNESS_CREDIT_ROLLED_BACK:
      return templates.wellnessCreditRolledBackEmail(data);

    // --- Regular Leave Credits (VL/SL) ---
    case KEYS.LEAVE_CREDIT_ADDED:
      return templates.leaveCreditAddedEmail(data);

    case KEYS.LEAVE_CREDIT_ROLLED_BACK:
      return templates.leaveCreditRolledBackEmail(data);

    default:
      throw new Error(`Unknown email notification key: ${key}`);
  }
}

/**
 * @param key   one of emailNotificationKeys
 * @param data  { to, thread?, ...templateData }
 *              thread: ctoThread(app) / wellnessThread(app) from ./emailThread,
 *              so the email joins that application's thread in the recipient's inbox
 */
async function sendNotifEmail(key, { to, thread, ...data }, opts = {}) {
  const enabled = await isEmailEnabled(key);

  if (!enabled && !opts.forceSend) {
    console.log("[EMAIL] Skipped (disabled):", { key, to });
    return { skipped: true, reason: "disabled" };
  }

  const tpl = getTemplate(key, data);
  return sendEmail(to, tpl.subject, tpl.html, { thread });
}

module.exports = sendNotifEmail;
