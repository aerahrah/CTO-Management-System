// services/ctoApplicationApprover.service.js
const mongoose = require("mongoose");
const ApprovalStep = require("../models/approvalStepModel");
const CtoApplication = require("../models/ctoApplicationModel");
const Employee = require("../models/employeeModel");
const CtoCredit = require("../models/ctoCreditModel");

const sendEmail = require("../utils/sendEmail");
const ctoApprovalEmail = require("../emails/ctoApprovalRequest");
const ctoRejectionEmail = require("../emails/ctoRejectionRequest");
const ctoFinalApprovalEmail = require("../emails/ctoFinalApprovalEmail");

const buildAuditDetails = require("../utils/auditActionBuilder");
const auditLogService = require("./auditLog.service");

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  return err;
}

function assertObjectId(id, label = "id") {
  if (!id || !mongoose.Types.ObjectId.isValid(id))
    throw httpError(`Invalid ${label}`, 400);
}

function getClientIp(req) {
  const xf = req?.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req?.socket?.remoteAddress || null;
}

const fetchPendingCtoCountService = async (approverId) => {
  if (!approverId) throw httpError("Approver ID is required", 400);

  const approvalSteps = await ApprovalStep.find({
    approver: approverId,
  }).populate({
    path: "ctoApplication",
    populate: [
      { path: "approvals", populate: { path: "approver", select: "_id" } },
    ],
  });

  const pendingCount = approvalSteps.reduce((count, step) => {
    const app = step.ctoApplication;
    if (!app || !Array.isArray(app.approvals) || app.approvals.length === 0)
      return count;

    const steps = app.approvals;
    const userStepIndex = steps.findIndex(
      (s) => s.approver?._id?.toString() === approverId.toString(),
    );
    if (userStepIndex === -1) return count;

    const userStep = steps[userStepIndex];
    if (userStep.status === "REJECTED") return count;
    if (app.overallStatus === "REJECTED") return count;

    const pendingStep = steps.find((s) => s.status === "PENDING");
    const isTheirTurn =
      pendingStep?.approver?._id?.toString() === approverId.toString();

    if (userStep.status === "PENDING" && isTheirTurn) return count + 1;
    return count;
  }, 0);

  return pendingCount;
};

const getApproverOptionsService = async () => {
  return Employee.find({}, "_id firstName lastName position email")
    .sort({ lastName: 1, firstName: 1 })
    .lean();
};

const getCtoApplicationsForApproverService = async (
  approverId,
  search = "",
  status = "",
  page = 1,
  limit = 10,
) => {
  if (!approverId) throw httpError("Approver ID is required.", 400);

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
      const alreadyActed = userStep.status === "APPROVED";

      return isTheirTurn || alreadyActed;
    });

  const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  ctoApplications.forEach((app) => {
    const myStep = app.approvals.find(
      (s) => s.approver?._id?.toString() === approverId.toString(),
    );
    if (myStep?.status === "PENDING") statusCounts.PENDING++;
    if (myStep?.status === "APPROVED") statusCounts.APPROVED++;
    if (myStep?.status === "REJECTED") statusCounts.REJECTED++;
  });

  if (status) {
    ctoApplications = ctoApplications.filter((app) => {
      const myStep = app.approvals.find(
        (s) => s.approver?._id?.toString() === approverId.toString(),
      );
      return myStep?.status === status;
    });
  }

  const s = String(search || "")
    .trim()
    .toLowerCase();
  if (s) {
    ctoApplications = ctoApplications.filter((app) => {
      const fullName =
        `${app.employee?.firstName || ""} ${app.employee?.lastName || ""}`.toLowerCase();
      return fullName.includes(s);
    });
  }

  const total = ctoApplications.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginatedData = ctoApplications.slice(startIndex, startIndex + limit);

  return { data: paginatedData, total, totalPages, statusCounts };
};

const getCtoApplicationByIdService = async (ctoApplicationId) => {
  if (!ctoApplicationId)
    throw httpError("CTO Application ID is required.", 400);

  const application = await CtoApplication.findById(ctoApplicationId)
    .populate({
      path: "employee",
      select: "firstName lastName position department",
    })
    .populate({
      path: "approvals",
      populate: { path: "approver", select: "firstName lastName position" },
    })
    .populate({ path: "memo.memoId", select: "memoNo" });

  if (!application) throw httpError("CTO Application not found", 404);
  return application;
};

const approveCtoApplicationService = async ({
  approverId,
  applicationId,
  req,
}) => {
  assertObjectId(approverId, "approverId");
  assertObjectId(applicationId, "applicationId");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const application = await CtoApplication.findById(applicationId)
      .populate("approvals")
      .populate("employee")
      .session(session);

    if (!application) throw httpError("CTO Application not found.", 404);
    if (application.overallStatus !== "PENDING")
      throw httpError("Application already processed.", 400);

    const currentStep = application.approvals.find(
      (s) => s.approver.toString() === String(approverId),
    );
    if (!currentStep)
      throw httpError("You are not an approver for this application.", 403);

    // Prevent double-approve
    if (currentStep.status !== "PENDING")
      throw httpError("This step has already been processed.", 400);

    const unapprovedPrevious = application.approvals.find(
      (s) => s.level < currentStep.level && s.status !== "APPROVED",
    );
    if (unapprovedPrevious)
      throw httpError(
        `Level ${unapprovedPrevious.level} must approve first.`,
        400,
      );

    await ApprovalStep.findByIdAndUpdate(
      currentStep._id,
      { status: "APPROVED", reviewedAt: new Date() },
      { session },
    );

    const updatedSteps = await ApprovalStep.find({
      _id: { $in: application.approvals },
    }).session(session);
    const allApproved = updatedSteps.every((s) => s.status === "APPROVED");

    if (allApproved) {
      application.overallStatus = "APPROVED";
      await application.save({ session });

      const employeeId = application.employee._id;

      // Update CTO credits using memo entries
      for (const memoItem of application.memo || []) {
        const memoId = memoItem.memoId; // FIX: memoId is already ObjectId in most cases
        const credit = await CtoCredit.findById(memoId).session(session);
        if (!credit) continue;

        const empCredit = credit.employees.find(
          (e) => String(e.employee) === String(employeeId),
        );
        if (!empCredit) continue;

        const appliedHours = Number(memoItem.appliedHours || 0);
        if (appliedHours <= 0) continue;

        if ((empCredit.reservedHours || 0) < appliedHours) {
          throw httpError(
            "Reserved hours mismatch. Please contact admin.",
            400,
          );
        }

        empCredit.reservedHours = (empCredit.reservedHours || 0) - appliedHours;
        empCredit.usedHours = (empCredit.usedHours || 0) + appliedHours;
        empCredit.remainingHours =
          (empCredit.creditedHours || 0) -
          (empCredit.usedHours || 0) -
          (empCredit.reservedHours || 0);

        if (empCredit.remainingHours <= 0) {
          empCredit.remainingHours = 0;
          empCredit.status = "EXHAUSTED";
        }

        await CtoCredit.updateOne(
          { _id: credit._id, "employees.employee": employeeId },
          { $set: { "employees.$": empCredit } },
          { session },
        );
      }

      // Deduct employee CTO balance (don’t allow negative)
      const newBal =
        (application.employee.balances?.ctoHours || 0) -
        (application.requestedHours || 0);
      if (newBal < 0)
        throw httpError("Employee CTO balance would go negative.", 400);

      application.employee.balances.ctoHours = newBal;
      await application.employee.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Audit log after commit
    const approver = await Employee.findById(approverId)
      .select("username")
      .lean();
    const auditBody = {
      approverId,
      applicationId,
      level: currentStep.level,
      approverName: `${approver?.username || "unknown"} (id: ${approverId})`,
      approverUsername: approver?.username || "unknown",
      employeeName: `${application.employee.username} (id: ${application.employee._id})`,
    };

    const auditDetails = buildAuditDetails({
      endpoint: "Approve CTO Application",
      actor: auditBody.approverName,
      targetUser: auditBody.employeeName,
      body: auditBody,
      params: { id: application._id },
      before: { status: currentStep.status },
    });

    await auditLogService.createAuditLog({
      userId: approverId,
      username: auditBody.approverUsername,
      method: "POST",
      endpoint: "Approve CTO Application",
      url: `/cto/applications/approver/${application._id}/approve`,
      statusCode: 200,
      ip: getClientIp(req),
      summary: auditDetails.summary,
      timestamp: new Date(),
    });

    // Emails
    if (!allApproved) {
      const nextStep = updatedSteps.find(
        (s) => s.level === currentStep.level + 1,
      );
      if (nextStep) {
        const nextApprover = await Employee.findById(nextStep.approver)
          .select("email firstName lastName")
          .lean();
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

    return CtoApplication.findById(applicationId)
      .populate({
        path: "approvals",
        populate: {
          path: "approver",
          select: "firstName lastName position email",
        },
      })
      .populate("employee", "firstName lastName position email")
      .populate("memo.memoId", "memoNo uploadedMemo");
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
  req,
}) => {
  assertObjectId(approverId, "approverId");
  assertObjectId(applicationId, "applicationId");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const application = await CtoApplication.findById(applicationId)
      .populate("approvals")
      .populate("memo.memoId")
      .populate("employee", "username firstName lastName email balances")
      .session(session);

    if (!application) throw httpError("CTO Application not found.", 404);
    if (application.overallStatus !== "PENDING")
      throw httpError("Application already processed.", 400);

    const currentStep = application.approvals.find(
      (s) => s.approver.toString() === String(approverId),
    );
    if (!currentStep)
      throw httpError(
        "You are not authorized to reject this application.",
        403,
      );
    if (currentStep.status !== "PENDING")
      throw httpError("This step has already been processed.", 400);

    const unapprovedPrevious = application.approvals.find(
      (s) => s.level < currentStep.level && s.status !== "APPROVED",
    );
    if (unapprovedPrevious)
      throw httpError(
        `Level ${unapprovedPrevious.level} must approve first.`,
        400,
      );

    const employeeId = application.employee._id;

    // Release reserved hours (transactional)
    for (const memoItem of application.memo || []) {
      const memoId = memoItem.memoId?._id || memoItem.memoId;
      const appliedHours = Number(memoItem.appliedHours || 0);
      if (!memoId || appliedHours <= 0) continue;

      const res = await CtoCredit.updateOne(
        {
          _id: memoId,
          employees: {
            $elemMatch: {
              employee: employeeId,
              reservedHours: { $gte: appliedHours },
            },
          },
        },
        {
          $inc: {
            "employees.$.reservedHours": -appliedHours,
            "employees.$.remainingHours": appliedHours,
          },
          $set: { "employees.$.status": "ACTIVE" },
        },
        { session },
      );

      if (res.modifiedCount !== 1) {
        throw httpError(
          "Failed to release reserved hours (data mismatch).",
          400,
        );
      }
    }

    await ApprovalStep.findByIdAndUpdate(
      currentStep._id,
      {
        status: "REJECTED",
        remarks: remarks || "No remarks provided",
        reviewedAt: new Date(),
      },
      { session },
    );

    application.overallStatus = "REJECTED";
    await application.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Audit log after commit
    const approver = await Employee.findById(approverId)
      .select("username")
      .lean();
    const auditBody = {
      approverId,
      applicationId,
      level: currentStep.level,
      approverName: `${approver?.username || "unknown"} (id: ${approverId})`,
      approverUsername: approver?.username || "unknown",
      employeeName: `${application.employee.username} (id: ${application.employee._id})`,
    };

    const auditDetails = buildAuditDetails({
      endpoint: "Reject CTO Application",
      actor: auditBody.approverName,
      targetUser: auditBody.employeeName,
      body: auditBody,
      params: { id: application._id },
      before: { status: currentStep.status },
    });

    await auditLogService.createAuditLog({
      userId: approverId,
      username: auditBody.approverUsername,
      method: "POST",
      endpoint: "Reject CTO Application",
      url: `/cto/applications/approver/${application._id}/reject`,
      statusCode: 200,
      ip: getClientIp(req),
      summary: auditDetails.summary,
      timestamp: new Date(),
    });

    if (application.employee.email) {
      await sendEmail(
        application.employee.email,
        "CTO Application Rejected",
        ctoRejectionEmail({
          employeeName: application.employee.firstName,
          remarks,
        }),
      );
    }

    return CtoApplication.findById(applicationId)
      .populate({
        path: "approvals",
        populate: { path: "approver", select: "firstName lastName position" },
      })
      .populate("employee", "firstName lastName position email")
      .populate("memo.memoId", "memoNo uploadedMemo");
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
