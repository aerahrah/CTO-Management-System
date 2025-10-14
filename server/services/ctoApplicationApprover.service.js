const ApprovalStep = require("../models/approvalStepModel");
const CtoApplication = require("../models/ctoApplicationModel");

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

const approveCtoApplicationService = async ({ approverId, applicationId }) => {
  const application = await CtoApplication.findById(applicationId).populate(
    "approvals"
  );

  if (!application) {
    const err = new Error("CTO Application not found.");
    err.status = 404;
    throw err;
  }

  // Find the approval step of this approver
  const currentStep = application.approvals.find(
    (s) => s.approver.toString() === approverId
  );

  if (!currentStep) {
    const err = new Error("You are not an approver for this application.");
    err.status = 403;
    throw err;
  }

  // Make sure previous level(s) are already approved
  const previousLevels = application.approvals.filter(
    (s) => s.level < currentStep.level
  );
  const unapprovedPrevious = previousLevels.find(
    (s) => s.status !== "APPROVED"
  );
  if (unapprovedPrevious) {
    const err = new Error(
      `Level ${unapprovedPrevious.level} must approve first.`
    );
    err.status = 400;
    throw err;
  }

  // Update this approver’s step
  await ApprovalStep.findByIdAndUpdate(currentStep._id, {
    status: "APPROVED",
  });

  // Check if all steps are now approved
  const updatedSteps = await ApprovalStep.find({
    _id: { $in: application.approvals },
  });

  const allApproved = updatedSteps.every((s) => s.status === "APPROVED");
  if (allApproved) {
    application.overallStatus = "APPROVED";
    await application.save();
  }

  return await CtoApplication.findById(applicationId)
    .populate({
      path: "approvals",
      populate: { path: "approver", select: "firstName lastName position" },
    })
    .populate("employee", "firstName lastName position");
};

module.exports = {
  getCtoApplicationsForApproverService,
  approveCtoApplicationService,
};
