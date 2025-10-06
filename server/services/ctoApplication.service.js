const CtoApplication = require("../models/ctoApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const Employee = require("../models/employeeModel");
const mongoose = require("mongoose");

const addCtoApplicationService = async ({
  userId,
  requestedHours,
  reason,
  level1Approver,
  level2Approver,
  level3Approver,
}) => {
  if (!requestedHours) {
    const err = new Error("Requested hours are required");
    err.status = 400;
    throw err;
  }

  if (!level1Approver || !level2Approver || !level3Approver) {
    const err = new Error("All 3 approvers (L1, L2, L3) are required");
    err.status = 400;
    throw err;
  }

  const approvers = [level1Approver, level2Approver, level3Approver];
  for (const approverId of approvers) {
    const approver = await Employee.findById(approverId);
    if (!approver) {
      const err = new Error(`Approver not found: ${approverId}`);
      err.status = 404;
      throw err;
    }
  }

  const approvalSteps = await Promise.all(
    approvers.map(async (approverId, index) => {
      return await ApprovalStep.create({
        level: index + 1,
        approver: approverId,
        status: "PENDING",
      });
    })
  );

  const newCtoApplication = new CtoApplication({
    employee: userId,
    requestedHours,
    reason,
    approvals: approvalSteps.map((step) => step._id),
    overallStatus: "PENDING",
  });

  await newCtoApplication.save();

  return newCtoApplication;
};

module.exports = {
  addCtoApplicationService,
};
