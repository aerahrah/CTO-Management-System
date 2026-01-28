const ApprovalStep = require("../models/approvalStepModel");
const CtoApplication = require("../models/ctoApplicationModel");
const Employee = require("../models/employeeModel");
const CtoCredit = require("../models/ctoCreditModel");
const sendEmail = require("../utils/sendEmail");
const ctoApprovalEmail = require("../emails/ctoApprovalRequest");
const mongoose = require("mongoose");
const ctoRejectionEmail = require("../emails/ctoRejectionRequest");
const ctoFinalApprovalEmail = require("../emails/ctoFinalApprovalEmail");

const fetchPendingCtoCountService = async (approverId) => {
  if (!approverId) throw new Error("Approver ID is required");

  // Fetch all approval steps for this approver
  const approvalSteps = await ApprovalStep.find({
    approver: approverId,
  }).populate({
    path: "ctoApplication",
    populate: [
      { path: "approvals", populate: { path: "approver", select: "_id" } },
    ],
  });

  // Filter applications relevant to this approver
  const pendingCount = approvalSteps.reduce((count, step) => {
    const app = step.ctoApplication;
    if (!app || !app.approvals || app.approvals.length === 0) return count;

    const steps = app.approvals;
    const userStepIndex = steps.findIndex(
      (s) => s.approver?._id?.toString() === approverId.toString(),
    );
    if (userStepIndex === -1) return count;

    const userStep = steps[userStepIndex];

    // Skip rejected applications (unless you want to count them)
    if (userStep.status === "REJECTED") return count;
    if (app.overallStatus === "REJECTED") return count;

    const pendingStep = steps.find((s) => s.status === "PENDING");
    const isTheirTurn =
      pendingStep?.approver?._id?.toString() === approverId.toString();

    // Only count if it’s their turn and status is PENDING
    if (userStep.status === "PENDING" && isTheirTurn) return count + 1;

    return count;
  }, 0);

  return pendingCount;
};

const getApproverOptionsService = async () => {
  const query = {
    // role: { $in: ["supervisor", "hr", "manager"] },
  };

  const employees = await Employee.find(
    query,
    "_id firstName lastName position email",
  ).sort({ lastName: 1, firstName: 1 });

  return employees;
};

const getCtoApplicationsForApproverService = async (
  approverId,
  search = "",
  status = "",
  page = 1,
  limit = 10,
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
        (s) => s.approver?._id?.toString() === approverId.toString(),
      );
      if (userStepIndex === -1) return false;

      const userStep = steps[userStepIndex];

      if (userStep.status === "REJECTED") return true;
      if (app.overallStatus === "REJECTED") return false;

      const pendingStep = steps.find((s) => s.status === "PENDING");
      if (userStepIndex === 0) return true;

      const isTheirTurn =
        pendingStep?.approver?._id?.toString() === approverId.toString();

      const alreadyActed = ["APPROVED"].includes(userStep.status);

      return isTheirTurn || alreadyActed;
    });

  // ✅ COUNT STATUSES (BASED ON SAME DATA SET)
  const statusCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  };

  ctoApplications.forEach((app) => {
    const myStep = app.approvals.find(
      (s) => s.approver?._id?.toString() === approverId.toString(),
    );

    if (myStep?.status === "PENDING") statusCounts.PENDING++;
    if (myStep?.status === "APPROVED") statusCounts.APPROVED++;
    if (myStep?.status === "REJECTED") statusCounts.REJECTED++;
  });

  // ✅ STATUS FILTER (UNCHANGED)
  if (status) {
    ctoApplications = ctoApplications.filter((app) => {
      const myStep = app.approvals.find(
        (s) => s.approver?._id?.toString() === approverId.toString(),
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
    statusCounts,
  };
};

const getCtoApplicationByIdService = async (ctoApplicationId) => {
  if (!ctoApplicationId) {
    const err = new Error("CTO Application ID is required.");
    err.status = 400;
    throw err;
  }

  const application = await CtoApplication.findById(ctoApplicationId)
    .populate({
      path: "employee",
      select: "firstName lastName position department",
    })
    .populate({
      path: "approvals",
      populate: { path: "approver", select: "firstName lastName position" },
    })
    .populate({
      path: "memo.memoId",
      select: "memoNo",
    });

  if (!application) {
    const err = new Error("CTO Application not found");
    err.status = 404;
    throw err;
  }

  return application;
};
const approveCtoApplicationService = async ({ approverId, applicationId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const application = await CtoApplication.findById(applicationId)
      .populate("approvals")
      .populate("employee")
      .session(session);

    if (!application) {
      const err = new Error("CTO Application not found.");
      err.status = 404;
      throw err;
    }

    const currentStep = application.approvals.find(
      (s) => s.approver.toString() === approverId,
    );

    if (!currentStep) {
      const err = new Error("You are not an approver for this application.");
      err.status = 403;
      throw err;
    }

    // Ensure previous approvals
    const unapprovedPrevious = application.approvals.find(
      (s) => s.level < currentStep.level && s.status !== "APPROVED",
    );

    if (unapprovedPrevious) {
      const err = new Error(
        `Level ${unapprovedPrevious.level} must approve first.`,
      );
      err.status = 400;
      throw err;
    }

    // ✅ Approve current step
    await ApprovalStep.findByIdAndUpdate(
      currentStep._id,
      { status: "APPROVED" },
      { session },
    );

    // 🔁 Re-fetch updated steps
    const updatedSteps = await ApprovalStep.find({
      _id: { $in: application.approvals },
    }).session(session);

    const allApproved = updatedSteps.every((s) => s.status === "APPROVED");

    // 🎉 FINAL APPROVAL LOGIC
    if (allApproved) {
      application.overallStatus = "APPROVED";
      await application.save({ session });

      // Update credits
      for (const memoItem of application.memo) {
        const credit = await CtoCredit.findById(memoItem.memoId._id).session(
          session,
        );
        if (!credit) continue;

        const empCredit = credit.employees.find(
          (e) => e.employee.toString() === application.employee._id.toString(),
        );
        if (!empCredit) continue;

        const appliedHours = memoItem.appliedHours || 0;

        empCredit.reservedHours -= appliedHours;
        empCredit.usedHours = (empCredit.usedHours || 0) + appliedHours;
        empCredit.remainingHours =
          empCredit.creditedHours -
          empCredit.usedHours -
          empCredit.reservedHours;

        if (empCredit.remainingHours <= 0) empCredit.status = "EXHAUSTED";

        await CtoCredit.updateOne(
          { _id: credit._id, "employees.employee": application.employee._id },
          { $set: { "employees.$": empCredit } },
          { session },
        );
      }

      application.employee.balances.ctoHours -= application.requestedHours;
      await application.employee.save({ session });
    }

    // Commit transaction first
    await session.commitTransaction();
    session.endSession();

    // =========================
    // Send emails AFTER commit
    // =========================
    if (!allApproved) {
      const nextStep = updatedSteps.find(
        (s) => s.level === currentStep.level + 1,
      );
      if (nextStep) {
        const nextApprover = await Employee.findById(nextStep.approver);
        if (nextApprover?.email) {
          await sendEmail(
            nextApprover.email,
            "CTO Approval Request",
            ctoApprovalEmail({
              approverName: `${nextApprover.firstName} ${nextApprover.lastName}`,
              employeeName: `${application.employee.firstName} ${application.employee.lastName}`,
              requestedHours: application.requestedHours,
              reason: application.reason,
              level: nextStep.level,
              link: `${process.env.FRONTEND_URL}/app/cto/approvals/${application._id}`,
            }),
          );
        }
      }
    } else {
      if (application.employee.email) {
        await sendEmail(
          application.employee.email,
          "CTO Application Approved",
          ctoFinalApprovalEmail({
            employeeName: application.employee.firstName,
            requestedHours: application.requestedHours,
          }),
        );
      }
    }

    // Return updated application
    return await CtoApplication.findById(applicationId)
      .populate({
        path: "approvals",
        populate: {
          path: "approver",
          select: "firstName lastName position email",
        },
      })
      .populate("employee", "firstName lastName position email")
      .populate(
        "memo.memoId",
        "memoNo uploadedMemo creditedHours remainingHours reservedHours usedHours",
      );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

const rejectCtoApplicationService = async ({
  approverId,
  applicationId,
  remarks,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1️⃣ Fetch the application with approvals and memos (for update)
    const application = await CtoApplication.findById(applicationId)
      .populate("approvals")
      .populate("memo.memoId")
      .populate("employee", "firstName lastName email")
      .session(session);

    if (!application) {
      const err = new Error("CTO Application not found.");
      err.status = 404;
      throw err;
    }

    // 2️⃣ Find the approver’s step
    const currentStep = application.approvals.find(
      (s) => s.approver.toString() === approverId,
    );

    if (!currentStep) {
      const err = new Error(
        "You are not authorized to reject this application.",
      );
      err.status = 403;
      throw err;
    }

    // ✅ Prevent double-rejection / rapid clicks
    if (currentStep.status === "REJECTED") {
      const err = new Error("This step has already been processed.");
      err.status = 400;
      throw err;
    }

    // 3️⃣ Ensure previous steps are approved
    const previousLevels = application.approvals.filter(
      (s) => s.level < currentStep.level,
    );
    const unapprovedPrevious = previousLevels.find(
      (s) => s.status !== "APPROVED",
    );
    if (unapprovedPrevious) {
      const err = new Error(
        `Level ${unapprovedPrevious.level} must approve first.`,
      );
      err.status = 400;
      throw err;
    }

    // 4️⃣ Release reserved hours for each memo
    for (const memoItem of application.memo) {
      const credit = await CtoCredit.findById(memoItem.memoId._id).session(
        session,
      );
      if (!credit) continue;

      const empCredit = credit.employees.find(
        (e) => e.employee.toString() === application.employee.toString(),
      );
      if (!empCredit) continue;

      const appliedHours = memoItem.appliedHours || 0;
      empCredit.reservedHours = (empCredit.reservedHours || 0) - appliedHours;
      empCredit.remainingHours = (empCredit.remainingHours || 0) + appliedHours;

      await CtoCredit.updateOne(
        { _id: credit._id, "employees.employee": application.employee },
        { $set: { "employees.$": empCredit } },
      ).session(session);
    }

    // 5️⃣ Update current approver’s step to REJECTED
    await ApprovalStep.findByIdAndUpdate(
      currentStep._id,
      { status: "REJECTED", remarks: remarks || "No remarks provided" },
      { session },
    );

    // 6️⃣ Set overall application status to REJECTED
    application.overallStatus = "REJECTED";
    await application.save({ session });

    // ✅ Commit transaction first
    await session.commitTransaction();
    session.endSession();

    // 7️⃣ Send rejection email after DB commit

    if (application.employee.email) {
      await sendEmail(
        application.employee.email,
        "CTO Application Rejected",
        ctoRejectionEmail({
          employeeName: application.employee.firstName,
          remarks: remarks,
        }),
      );
    }

    // 8️⃣ Return updated application (populated)
    return await CtoApplication.findById(applicationId)
      .populate({
        path: "approvals",
        populate: { path: "approver", select: "firstName lastName position" },
      })
      .populate("employee", "firstName lastName position email")
      .populate(
        "memo.memoId",
        "memoNo uploadedMemo creditedHours remainingHours reservedHours usedHours",
      );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

module.exports = {
  fetchPendingCtoCountService,
  getApproverOptionsService,
  getCtoApplicationsForApproverService,
  getCtoApplicationByIdService,
  approveCtoApplicationService,
  rejectCtoApplicationService,
};
