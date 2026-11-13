// utils/ctoEmailHistory.js
//
// Loads what already happened on a CTO or Wellness application (submitted,
// Level 1 approved, ...) so the email to the approver whose turn it is can
// list it. Only that approver is emailed; this just gives them the history.
// The list is displayed by previousActionsSection() in utils/emailTemplates.js.
// Works for both application types: both store their steps in ApprovalStep.

const ApprovalStep = require("../models/approvalStepModel");

const DONE_STATUSES = ["APPROVED", "REJECTED"];

function personName(person) {
  if (!person || typeof person !== "object") return "";
  return `${person.firstName || ""} ${person.lastName || ""}`.trim();
}

/**
 * What has happened so far on a CTO application, oldest first.
 * Call it AFTER the current approval is committed, so that approval is included.
 *
 * @param application CTO application with _id, createdAt, approvals (ids or docs)
 *                    and, ideally, a populated employee
 * @returns {Promise<Array<{ date, action, by, position, remarks, status }>>}
 *          Never throws: returns [] on error so the email still goes out.
 */
async function getCtoPreviousActions(application) {
  try {
    const actions = [];

    if (application?.createdAt) {
      actions.push({
        date: application.createdAt,
        action: "Submitted",
        by: personName(application.employee) || "the applicant",
        position: application.employee?.position || "",
        remarks: "",
        status: "SUBMITTED",
      });
    }

    const stepIds = (application?.approvals || [])
      .map((s) => s?._id || s)
      .filter(Boolean);

    if (stepIds.length) {
      const steps = await ApprovalStep.find({ _id: { $in: stepIds } })
        .select("level status reviewedAt remarks approver")
        .populate("approver", "firstName lastName position")
        .sort({ level: 1 })
        .lean();

      for (const step of steps) {
        const status = String(step.status || "").toUpperCase();
        if (!DONE_STATUSES.includes(status)) continue;

        actions.push({
          date: step.reviewedAt,
          action: `Level ${step.level} ${status === "APPROVED" ? "approved" : "rejected"}`,
          by: personName(step.approver) || `the Level ${step.level} approver`,
          position: step.approver?.position || "",
          remarks: status === "REJECTED" ? step.remarks || "" : "",
          status,
        });
      }
    }

    return actions;
  } catch (e) {
    console.error("[EMAIL] Could not load CTO history for email:", e?.message);
    return [];
  }
}

module.exports = {
  getCtoPreviousActions,
  // Same function, for Wellness (or any application with ApprovalStep approvals)
  getPreviousActions: getCtoPreviousActions,
};
