const ApprovalStep = require("../models/approvalStepModel");

const getCtoApplicationsForApproverService = async (approverId) => {
  if (!approverId) {
    const err = new Error("Approver ID is required.");
    err.status = 400;
    throw err;
  }

  const approvalSteps = await ApprovalStep.find({ approver: approverId })
    .populate({
      path: "ctoApplication",
      populate: [
        { path: "employee", select: "firstName lastName position" },
        {
          path: "approvals",
          populate: { path: "approver", select: "firstName lastName position" },
        },
      ],
    })
    .sort({ createdAt: -1 });

  const ctoApplications = approvalSteps
    .map((step) => step.ctoApplication)
    .filter(Boolean);

  return ctoApplications;
};

module.exports = {
  getCtoApplicationsForApproverService,
};
