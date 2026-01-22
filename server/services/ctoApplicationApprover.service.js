const ApprovalStep = require("../models/approvalStepModel");
const CtoApplication = require("../models/ctoApplicationModel");
const Employee = require("../models/employeeModel");
const CtoCredit = require("../models/ctoCreditModel");

const getCtoApplicationsForApproverService = async (
  approverId,
  search = "",
  status = "", // ✅ ADDED
  page = 1,
  limit = 10
) => {
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

  let ctoApplications = approvalSteps
    .map((step) => step.ctoApplication)
    .filter(Boolean)
    .filter((app) => {
      if (!app.approvals || app.approvals.length === 0) return false;

      const steps = app.approvals;
      const userStepIndex = steps.findIndex(
        (s) => s.approver?._id?.toString() === approverId.toString()
      );
      if (userStepIndex === -1) return false;

      const userStep = steps[userStepIndex];

      // ❗ EXISTING LOGIC — UNTOUCHED
      if (userStep.status === "REJECTED") return true;
      if (app.overallStatus === "REJECTED") return false;

      const pendingStep = steps.find((s) => s.status === "PENDING");
      if (userStepIndex === 0) return true;

      const isTheirTurn =
        pendingStep?.approver?._id?.toString() === approverId.toString();

      const alreadyActed = ["APPROVED"].includes(userStep.status);

      return isTheirTurn || alreadyActed;
    });

  // ✅ STATUS FILTER (POST-LOGIC, SAFE)
  if (status) {
    ctoApplications = ctoApplications.filter((app) => {
      const myStep = app.approvals.find(
        (s) => s.approver?._id?.toString() === approverId.toString()
      );
      return myStep?.status === status;
    });
  }

  // 🔎 SEARCH FILTER (UNCHANGED)
  if (search.trim()) {
    const lowerSearch = search.toLowerCase();
    ctoApplications = ctoApplications.filter((app) => {
      const fullName = `${app.employee?.firstName || ""} ${
        app.employee?.lastName || ""
      }`.toLowerCase();
      return fullName.includes(lowerSearch);
    });
  }

  // 📄 PAGINATION (UNCHANGED)
  const total = ctoApplications.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginatedData = ctoApplications.slice(startIndex, startIndex + limit);

  return {
    data: paginatedData,
    total,
    totalPages,
  };
};

const approveCtoApplicationService = async ({ approverId, applicationId }) => {
  // 1️⃣ Fetch the application with approvals and memos
  const application = await CtoApplication.findById(applicationId).populate(
    "approvals"
  );

  if (!application) {
    const err = new Error("CTO Application not found.");
    err.status = 404;
    throw err;
  }

  // 2️⃣ Find the approval step for this approver
  const currentStep = application.approvals.find(
    (s) => s.approver.toString() === approverId
  );

  if (!currentStep) {
    const err = new Error("You are not an approver for this application.");
    err.status = 403;
    throw err;
  }

  // 3️⃣ Ensure previous levels are approved
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

  // 4️⃣ Update this approver's step to APPROVED
  await ApprovalStep.findByIdAndUpdate(currentStep._id, { status: "APPROVED" });

  // 5️⃣ Check if all steps are now approved
  const updatedSteps = await ApprovalStep.find({
    _id: { $in: application.approvals },
  });
  const allApproved = updatedSteps.every((s) => s.status === "APPROVED");

  if (allApproved) {
    // ✅ Mark application as APPROVED
    application.overallStatus = "APPROVED";
    await application.save();

    // 6️⃣ Update CTO credits for each memo
    for (const memoItem of application.memo) {
      const credit = await CtoCredit.findById(memoItem.memoId._id);
      if (!credit) continue;

      const empCredit = credit.employees.find(
        (e) => e.employee.toString() === application.employee.toString()
      );
      if (!empCredit) continue;

      const appliedHours = memoItem.appliedHours || 0;

      // Move reserved → used
      empCredit.reservedHours = Math.max(
        0,
        (empCredit.reservedHours || 0) - appliedHours
      );
      empCredit.usedHours = (empCredit.usedHours || 0) + appliedHours;

      // Recalculate remaining hours
      empCredit.remainingHours = Math.max(
        0,
        (empCredit.creditedHours || 0) -
          empCredit.usedHours -
          empCredit.reservedHours
      );

      // If no remaining hours, mark as EXHAUSTED
      if (empCredit.remainingHours === 0) empCredit.status = "EXHAUSTED";

      // Update CTO credit
      await CtoCredit.updateOne(
        { _id: credit._id, "employees.employee": application.employee },
        { $set: { "employees.$": empCredit } }
      );
    }

    // 7️⃣ Deduct total requested hours from employee CTO balance
    const employee = await Employee.findById(application.employee);
    if (employee) {
      employee.balances.ctoHours = Math.max(
        0,
        employee.balances.ctoHours - application.requestedHours
      );
      await employee.save();
    }
  }

  // 8️⃣ Return populated application
  return await CtoApplication.findById(applicationId)
    .populate({
      path: "approvals",
      populate: { path: "approver", select: "firstName lastName position" },
    })
    .populate("employee", "firstName lastName position")
    .populate(
      "memo.memoId",
      "memoNo uploadedMemo creditedHours remainingHours reservedHours usedHours"
    );
};

const rejectCtoApplicationService = async ({
  approverId,
  applicationId,
  remarks,
}) => {
  // 1️⃣ Fetch the application with approvals and memos
  const application = await CtoApplication.findById(applicationId)
    .populate("approvals")
    .populate("memo.memoId");

  if (!application) {
    const err = new Error("CTO Application not found.");
    err.status = 404;
    throw err;
  }

  // 2️⃣ Prevent rejecting an already rejected application
  if (application.overallStatus === "REJECTED") {
    const err = new Error("This application has already been rejected.");
    err.status = 400;
    throw err;
  }

  // 3️⃣ Find the approver’s step
  const currentStep = application.approvals.find(
    (s) => s.approver.toString() === approverId
  );

  if (!currentStep) {
    const err = new Error("You are not authorized to reject this application.");
    err.status = 403;
    throw err;
  }

  // 4️⃣ Ensure previous steps are approved
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

  // 5️⃣ Release the reserved hours for each memo based on appliedHours
  for (const memoItem of application.memo) {
    const credit = await CtoCredit.findById(memoItem.memoId._id);
    if (!credit) continue;

    const empCredit = credit.employees.find(
      (e) => e.employee.toString() === application.employee.toString()
    );
    if (!empCredit) continue;

    const appliedHours = memoItem.appliedHours || 0;

    // Adjust reserved and remaining hours
    empCredit.reservedHours = (empCredit.reservedHours || 0) - appliedHours;
    empCredit.remainingHours = (empCredit.remainingHours || 0) + appliedHours;

    // Update the CTO credit
    await CtoCredit.updateOne(
      { _id: credit._id, "employees.employee": application.employee },
      { $set: { "employees.$": empCredit } }
    );
  }

  // 6️⃣ Update current approver’s step to REJECTED
  await ApprovalStep.findByIdAndUpdate(currentStep._id, {
    status: "REJECTED",
    remarks: remarks || "No remarks provided",
  });

  // 7️⃣ Set the application overall status to REJECTED
  application.overallStatus = "REJECTED";
  await application.save();

  // 8️⃣ Return updated application with populated data
  return await CtoApplication.findById(applicationId)
    .populate({
      path: "approvals",
      populate: { path: "approver", select: "firstName lastName position" },
    })
    .populate("employee", "firstName lastName position")
    .populate(
      "memo.memoId",
      "memoNo uploadedMemo creditedHours remainingHours reservedHours usedHours"
    );
};
module.exports = {
  getCtoApplicationsForApproverService,
  approveCtoApplicationService,
  rejectCtoApplicationService,
};
