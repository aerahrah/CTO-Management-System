const CtoApplication = require("../models/ctoApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const Employee = require("../models/employeeModel");

const addCtoApplicationService = async ({
  userId,
  requestedHours,
  reason,
  approver1,
  approver2,
  approver3,
}) => {
  if (!requestedHours) {
    const err = new Error("Requested hours are required.");
    err.status = 400;
    throw err;
  }

  if (!approver1 || !approver2 || !approver3) {
    const err = new Error("All 3 approvers (Level 1, 2, and 3) are required.");
    err.status = 400;
    throw err;
  }

  const approvers = [approver1, approver2, approver3];

  for (const approverId of approvers) {
    const approver = await Employee.findById(approverId);
    if (!approver) {
      const err = new Error(`Approver not found: ${approverId}`);
      err.status = 404;
      throw err;
    }
  }

  const newCtoApplication = new CtoApplication({
    employee: userId,
    requestedHours,
    reason,
    overallStatus: "PENDING",
  });

  await newCtoApplication.save();

  const approvalSteps = await Promise.all(
    approvers.map(async (approverId, index) => {
      return await ApprovalStep.create({
        level: index + 1,
        approver: approverId,
        status: "PENDING",
        ctoApplication: newCtoApplication._id,
      });
    })
  );

  newCtoApplication.approvals = approvalSteps.map((step) => step._id);
  await newCtoApplication.save();

  const populatedApp = await CtoApplication.findById(newCtoApplication._id)
    .populate({
      path: "approvals",
      populate: { path: "approver", select: "firstName lastName position" },
    })
    .populate("employee", "firstName lastName");

  return populatedApp;
};

const getMyCtoApplicationsService = async (userId) => {
  if (!userId) {
    const err = new Error("User ID is required.");
    err.status = 400;
    throw err;
  }

  const applications = await CtoApplication.find({ employee: userId })
    .select("requestedHours reason overallStatus approvals employee createdAt")
    .populate({
      path: "approvals",
      populate: { path: "approver", select: "firstName lastName position" },
    })
    .populate("employee", "firstName lastName position")
    .sort({ createdAt: -1 }); // newest first

  return applications;
};

module.exports = { addCtoApplicationService, getMyCtoApplicationsService };
