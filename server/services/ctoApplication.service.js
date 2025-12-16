const CtoApplication = require("../models/ctoApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const Employee = require("../models/employeeModel");
const CtoCredit = require("../models/ctoCreditModel");

const addCtoApplicationService = async ({
  userId,
  requestedHours,
  reason,
  approver1,
  approver2,
  approver3,
  memoId,
  inclusiveDates,
}) => {
  // Validations
  if (!requestedHours || !reason || !memoId || !inclusiveDates?.length) {
    const err = new Error(
      "Requested hours, reason, memo, and inclusive dates are required."
    );
    err.status = 400;
    throw err;
  }

  if (!approver1 || !approver2 || !approver3) {
    const err = new Error("All 3 approvers (Level 1, 2, and 3) are required.");
    err.status = 400;
    throw err;
  }

  // Employee check & balance
  const employee = await Employee.findById(userId);
  if (!employee) {
    const err = new Error("Employee not found.");
    err.status = 404;
    throw err;
  }
  if (employee.balances.ctoHours < requestedHours) {
    const err = new Error("Insufficient CTO hours balance.");
    err.status = 400;
    throw err;
  }

  // Check memo existence
  const memo = await CtoCredit.findById(memoId);
  if (!memo) {
    const err = new Error("Selected CTO memo does not exist.");
    err.status = 404;
    throw err;
  }

  // Validate approvers
  const approvers = [approver1, approver2, approver3];
  for (const approverId of approvers) {
    const approver = await Employee.findById(approverId);
    if (!approver) {
      const err = new Error(`Approver not found: ${approverId}`);
      err.status = 404;
      throw err;
    }
  }

  // Create CTO application
  const newCtoApplication = new CtoApplication({
    employee: userId,
    requestedHours,
    reason,
    memo: memoId,
    inclusiveDates,
    overallStatus: "PENDING",
  });

  await newCtoApplication.save();

  // Create approval steps
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

  // Populate for return
  const populatedApp = await CtoApplication.findById(newCtoApplication._id)
    .populate({
      path: "approvals",
      populate: { path: "approver", select: "firstName lastName position" },
    })
    .populate("employee", "firstName lastName position")
    .populate("memo", "memoNo uploadedMemo totalHours");

  return populatedApp;
};

const getMyCtoApplicationsService = async (userId) => {
  if (!userId) {
    const err = new Error("User ID is required.");
    err.status = 400;
    throw err;
  }

  const applications = await CtoApplication.find({ employee: userId })
    .select(
      "requestedHours reason overallStatus approvals employee inclusiveDates memo createdAt"
    )
    .populate({
      path: "approvals",
      populate: { path: "approver", select: "firstName lastName position" },
    })
    .populate("employee", "firstName lastName position")
    .populate("memo", "memoNo uploadedMemo totalHours")
    .sort({ createdAt: -1 });

  return applications;
};

module.exports = { addCtoApplicationService, getMyCtoApplicationsService };
