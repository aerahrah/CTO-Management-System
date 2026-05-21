// services/ctoApproval.service.js
const mongoose = require("mongoose");
const ApprovalStep = require("../models/approvalStepModel");
const CtoApplication = require("../models/ctoApplicationModel");
const Employee = require("../models/employeeModel");
const CtoCredit = require("../models/ctoCreditModel");
const NotificationService = require("./notificationService");

const sendEmail = require("../utils/sendEmail");
const EMAIL_KEYS = require("../utils/emailNotificationKeys");
const { isEmailEnabled } = require("../utils/emailNotificationSettings");
const {
  ctoApprovalEmail,
  ctoRejectionEmail,
  ctoFinalApprovalEmail,
} = require("../utils/emailTemplates");

const buildAuditDetails = require("../utils/auditActionBuilder");
const auditLogService = require("./auditLog.service");

// --- CONSTANTS & IMMUTABILITY ---
const CTO_STATUS = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  EXHAUSTED: "EXHAUSTED",
});

/* =========================
   Helpers
========================= */

function createServiceError(message, statusCode = 400) {
  const err = new Error(message);
  err.status = statusCode;
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id, label = "ID") {
  if (!mongoose.isValidObjectId(id)) {
    throw createServiceError(`Invalid ${label} format.`, 400);
  }
}

/**
 * Strips null bytes and strictly caps string lengths to prevent
 * Payload Denial of Service and Null Byte Injection.
 * Default max length is exactly 100 characters.
 */
function sanitizeString(str, maxLength = 100) {
  return String(str || "")
    .replace(/\0/g, "") // Strip null bytes
    .trim()
    .slice(0, maxLength); // Strictly cap at specified length
}

function getClientIp(req) {
  const xf = req?.headers?.["x-forwarded-for"];
  // Note: x-forwarded-for can be spoofed. Only trust if behind a configured reverse proxy.
  if (typeof xf === "string" && xf.length)
    return sanitizeString(xf.split(",")[0], 50);
  return sanitizeString(req?.socket?.remoteAddress, 50) || null;
}

const U = (v) => String(v || "").toUpperCase();
const sameId = (a, b) => String(a) === String(b);
const sortByLevel = (steps = []) =>
  [...steps].sort((a, b) => Number(a?.level || 0) - Number(b?.level || 0));

const getEffectiveStatusForApprover = (app, myStep) => {
  const myStatus = U(myStep?.status);
  const overall = U(app?.overallStatus);

  if (myStatus === CTO_STATUS.APPROVED) return CTO_STATUS.APPROVED;
  if (myStatus === CTO_STATUS.REJECTED) return CTO_STATUS.REJECTED;
  if (myStatus === CTO_STATUS.CANCELLED || overall === CTO_STATUS.CANCELLED)
    return CTO_STATUS.CANCELLED;
  if (overall === CTO_STATUS.REJECTED) return CTO_STATUS.CANCELLED;

  return myStatus;
};

const clampPage = (v) => Math.max(parseInt(v, 10) || 1, 1);
const clampLimit = (v) => Math.min(Math.max(parseInt(v, 10) || 10, 1), 100);

async function safeSendEmail(to, subject, html) {
  try {
    await sendEmail(to, subject, html);
  } catch (e) {
    console.error("[EMAIL] failed but continuing:", {
      to,
      subject,
      message: e?.message,
    });
  }
}

async function canSend(key) {
  return await isEmailEnabled(key);
}

/* =========================
   Services
========================= */

const getApproverOptionsService = async () => {
  return Employee.find({}, "_id firstName lastName position email")
    .sort({ lastName: 1, firstName: 1 })
    .lean();
};

const fetchPendingCtoCountService = async (approverId) => {
  const safeId = String(approverId).trim();
  assertObjectId(safeId, "Approver ID");

  const approvalSteps = await ApprovalStep.find({ approver: safeId })
    .populate({
      path: "ctoApplication",
      select: "approvals overallStatus",
      populate: [
        { path: "approvals", populate: { path: "approver", select: "_id" } },
      ],
    })
    .lean();

  return approvalSteps.reduce((count, step) => {
    const app = step.ctoApplication;
    if (!app || !Array.isArray(app.approvals) || app.approvals.length === 0)
      return count;

    const steps = app.approvals;
    const userStep = steps.find((s) =>
      sameId(s.approver?._id || s.approver, safeId),
    );

    if (!userStep) return count;
    if (
      userStep.status === CTO_STATUS.REJECTED ||
      userStep.status === CTO_STATUS.CANCELLED
    )
      return count;
    if (
      app.overallStatus === CTO_STATUS.REJECTED ||
      app.overallStatus === CTO_STATUS.CANCELLED
    )
      return count;

    const pendingStep = steps.find((s) => s.status === CTO_STATUS.PENDING);
    const isTheirTurn = sameId(
      pendingStep?.approver?._id || pendingStep?.approver,
      safeId,
    );

    if (userStep.status === CTO_STATUS.PENDING && isTheirTurn) return count + 1;
    return count;
  }, 0);
};

const getCtoApplicationsForApproverService = async (
  approverId,
  search = "",
  status = "",
  page = 1,
  limit = 10,
) => {
  const safeId = String(approverId).trim();
  assertObjectId(safeId, "Approver ID");

  const safePage = clampPage(page);
  const safeLimit = clampLimit(limit);

  // Strictly sanitize search to exactly 100 characters max
  const safeSearch = sanitizeString(search, 100).toLowerCase();
  const safeStatus = sanitizeString(status, 20).toUpperCase();

  // Strict projection to prevent Out Of Memory (OOM) crashes
  const approvalSteps = await ApprovalStep.find({ approver: safeId })
    .populate({
      path: "ctoApplication",
      select:
        "employee approvals overallStatus requestedHours inclusiveDates reason createdAt",
      populate: [
        { path: "employee", select: "firstName lastName position" },
        {
          path: "approvals",
          select: "approver status level",
          populate: {
            path: "approver",
            select: "firstName lastName position _id",
          },
        },
      ],
    })
    .sort({ createdAt: -1 })
    .lean();

  const appMap = new Map();
  for (const step of approvalSteps) {
    const app = step?.ctoApplication;
    if (app?._id) appMap.set(String(app._id), app);
  }

  let apps = Array.from(appMap.values());

  apps = apps.filter((app) => {
    const steps = Array.isArray(app?.approvals) ? app.approvals : [];
    if (!steps.length) return false;

    const ordered = sortByLevel(steps);
    const myStep = ordered.find((s) =>
      sameId(s?.approver?._id || s?.approver, safeId),
    );
    if (!myStep) return false;

    const myStatus = U(myStep.status);
    const overall = U(app.overallStatus);

    if (myStatus !== CTO_STATUS.PENDING) return true;
    if (overall !== CTO_STATUS.PENDING) return false;

    const pendingStep = ordered.find((s) => U(s.status) === CTO_STATUS.PENDING);
    if (!pendingStep) return false;

    return sameId(pendingStep?.approver?._id || pendingStep?.approver, safeId);
  });

  if (safeSearch) {
    apps = apps.filter((app) => {
      const fullName =
        `${app.employee?.firstName || ""} ${app.employee?.lastName || ""}`.toLowerCase();
      return fullName.includes(safeSearch);
    });
  }

  const statusCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
    total: 0,
  };

  apps.forEach((app) => {
    const ordered = sortByLevel(app.approvals || []);
    const myStep = ordered.find((s) =>
      sameId(s?.approver?._id || s?.approver, safeId),
    );
    const effective = getEffectiveStatusForApprover(app, myStep);

    statusCounts.total++;
    if (statusCounts[effective] !== undefined) statusCounts[effective]++;
  });

  if (safeStatus) {
    apps = apps.filter((app) => {
      const ordered = sortByLevel(app.approvals || []);
      const myStep = ordered.find((s) =>
        sameId(s?.approver?._id || s?.approver, safeId),
      );
      return getEffectiveStatusForApprover(app, myStep) === safeStatus;
    });
  }

  const total = apps.length;
  const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
  const startIndex = (safePage - 1) * safeLimit;

  return {
    data: apps.slice(startIndex, startIndex + safeLimit),
    total,
    totalPages,
    statusCounts,
  };
};

const getCtoApplicationByIdService = async (ctoApplicationId) => {
  const safeId = String(ctoApplicationId).trim();
  assertObjectId(safeId, "Application ID");

  const application = await CtoApplication.findById(safeId)
    .select("-__v")
    .populate({
      path: "employee",
      select: "firstName lastName position department email balances",
    })
    .populate({
      path: "approvals",
      select: "-__v",
      populate: {
        path: "approver",
        select: "firstName lastName position email",
      },
    })
    .populate({ path: "memo.memoId", select: "memoNo uploadedMemo" })
    .lean();

  if (!application) throw createServiceError("CTO Application not found", 404);

  application.type = "CTO";
  return application;
};

const approveCtoApplicationService = async ({
  approverId,
  applicationId,
  req,
}) => {
  const safeApproverId = String(approverId).trim();
  const safeAppId = String(applicationId).trim();

  assertObjectId(safeApproverId, "Approver ID");
  assertObjectId(safeAppId, "Application ID");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const application = await CtoApplication.findById(safeAppId)
      .populate("approvals")
      .populate("employee", "_id username firstName lastName email balances")
      .session(session);

    if (!application)
      throw createServiceError("CTO Application not found.", 404);
    if (application.overallStatus !== CTO_STATUS.PENDING) {
      throw createServiceError("Application has already been processed.", 400);
    }

    const currentStep = application.approvals.find((s) =>
      sameId(s.approver, safeApproverId),
    );
    if (!currentStep)
      throw createServiceError(
        "You are not an authorized approver for this application.",
        403,
      );
    if (currentStep.status !== CTO_STATUS.PENDING)
      throw createServiceError("This step has already been processed.", 400);

    const unapprovedPrevious = application.approvals.find(
      (s) => s.level < currentStep.level && s.status !== CTO_STATUS.APPROVED,
    );
    if (unapprovedPrevious)
      throw createServiceError(
        `Level ${unapprovedPrevious.level} must approve first.`,
        400,
      );

    // Update approval step securely via $set
    await ApprovalStep.findByIdAndUpdate(
      currentStep._id,
      { $set: { status: CTO_STATUS.APPROVED, reviewedAt: new Date() } },
      { session, runValidators: true },
    );

    const updatedSteps = await ApprovalStep.find({
      _id: { $in: application.approvals },
    }).session(session);

    const allApproved = updatedSteps.every(
      (s) => s.status === CTO_STATUS.APPROVED,
    );

    if (allApproved) {
      application.overallStatus = CTO_STATUS.APPROVED;

      const employeeId = application.employee._id;

      // 1. Atomic updates for CtoCredit ledger (Prevents Race Conditions)
      for (const memoItem of application.memo || []) {
        const memoId = memoItem.memoId;
        const appliedHours = Number(memoItem.appliedHours || 0);

        if (!memoId || appliedHours <= 0) continue;

        const creditResult = await CtoCredit.findOneAndUpdate(
          {
            _id: memoId,
            "employees.employee": employeeId,
            "employees.reservedHours": { $gte: appliedHours }, // Concurrency guard
          },
          {
            $inc: {
              "employees.$.reservedHours": -appliedHours,
              "employees.$.usedHours": appliedHours,
            },
          },
          { session, new: true },
        );

        if (!creditResult) {
          throw createServiceError(
            "Reserved hours mismatch or credit not found. Please contact admin.",
            400,
          );
        }

        // Check if exhausted and update status if necessary
        const updatedEmpCredit = creditResult.employees.find((e) =>
          sameId(e.employee, employeeId),
        );

        if (
          updatedEmpCredit &&
          updatedEmpCredit.remainingHours <= 0 &&
          updatedEmpCredit.status !== CTO_STATUS.EXHAUSTED
        ) {
          await CtoCredit.updateOne(
            { _id: memoId, "employees.employee": employeeId },
            { $set: { "employees.$.status": CTO_STATUS.EXHAUSTED } },
            { session },
          );
        }
      }

      // 2. Atomic update for Employee CTO Balance (Prevents Race Conditions)
      const requestedHours = Number(application.requestedHours || 0);
      const updatedEmployee = await Employee.findOneAndUpdate(
        {
          _id: employeeId,
          "balances.ctoHours": { $gte: requestedHours }, // Concurrency check
        },
        { $inc: { "balances.ctoHours": -requestedHours } },
        { session, new: true },
      );

      if (!updatedEmployee) {
        throw createServiceError(
          "Employee has insufficient CTO balance or record not found.",
          400,
        );
      }

      await application.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Background Logging and Notifications (Post-Transaction)
    const approver = await Employee.findById(safeApproverId)
      .select("username firstName lastName")
      .lean();

    const auditBody = {
      approverId: safeApproverId,
      applicationId: safeAppId,
      level: currentStep.level,
      approverName: `${approver?.username || "unknown"} (id: ${safeApproverId})`,
      approverUsername: approver?.username || "unknown",
      employeeName: `${application.employee.username} (id: ${application.employee._id})`,
    };

    const auditDetails = buildAuditDetails({
      endpoint: "Approve Application",
      actor: auditBody.approverName,
      targetUser: auditBody.employeeName,
      body: auditBody,
      params: { id: application._id },
      before: { status: currentStep.status },
    });

    await auditLogService.createAuditLog({
      userId: safeApproverId,
      username: auditBody.approverUsername,
      method: "POST",
      endpoint: "Approve Application",
      url: `/cto/applications/approver/${application._id}/approve`,
      statusCode: 200,
      ip: getClientIp(req),
      summary: auditDetails.summary,
      timestamp: new Date(),
    });

    try {
      await NotificationService.notifyEmployeeOnCtoApproval({
        employeeId: application.employee._id,
        approver: approver || {
          _id: safeApproverId,
          firstName: "Approver",
          lastName: "",
        },
        ctoApplication: application,
        approvalStep: currentStep,
      });
    } catch (e) {
      console.error("Failed creating CTO approval notification:", e?.message);
    }

    if (!allApproved) {
      const nextStep = updatedSteps.find(
        (s) => s.level === currentStep.level + 1,
      );
      if (nextStep) {
        const nextApprover = await Employee.findById(nextStep.approver)
          .select("email firstName lastName")
          .lean();
        const enabled = await canSend(EMAIL_KEYS.CTO_APPROVAL);

        if (nextApprover?.email && enabled) {
          const tpl = ctoApprovalEmail({
            approverName: `${nextApprover.firstName} ${nextApprover.lastName}`,
            employeeName: `${application.employee.firstName} ${application.employee.lastName}`,
            requestedHours: application.requestedHours,
            reason: application.reason,
            level: nextStep.level,
            link: `${process.env.FRONTEND_URL}/app/cto-approvals/${application._id}`,
            brandName: "CTO Management System",
          });
          await safeSendEmail(nextApprover.email, tpl.subject, tpl.html);
        }
      }
    } else if (application.employee.email) {
      const enabled = await canSend(EMAIL_KEYS.CTO_FINAL_APPROVAL);
      if (enabled) {
        const tpl = ctoFinalApprovalEmail({
          employeeName: application.employee.firstName,
          requestedHours: application.requestedHours,
          brandName: "CTO Management System",
        });
        await safeSendEmail(application.employee.email, tpl.subject, tpl.html);
      }
    }

    // Refetch the fully populated, updated document to return
    return getCtoApplicationByIdService(safeAppId);
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
  const safeApproverId = String(approverId).trim();
  const safeAppId = String(applicationId).trim();

  assertObjectId(safeApproverId, "Approver ID");
  assertObjectId(safeAppId, "Application ID");

  const safeRemarks = sanitizeString(remarks, 1000) || "No remarks provided";

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const application = await CtoApplication.findById(safeAppId)
      .populate("approvals")
      .populate("memo.memoId")
      .populate("employee", "username firstName lastName email balances")
      .session(session);

    if (!application)
      throw createServiceError("CTO Application not found.", 404);
    if (application.overallStatus !== CTO_STATUS.PENDING) {
      throw createServiceError("Application has already been processed.", 400);
    }

    const currentStep = application.approvals.find((s) =>
      sameId(s.approver, safeApproverId),
    );
    if (!currentStep)
      throw createServiceError(
        "You are not authorized to reject this application.",
        403,
      );
    if (currentStep.status !== CTO_STATUS.PENDING)
      throw createServiceError("This step has already been processed.", 400);

    const unapprovedPrevious = application.approvals.find(
      (s) => s.level < currentStep.level && s.status !== CTO_STATUS.APPROVED,
    );
    if (unapprovedPrevious)
      throw createServiceError(
        `Level ${unapprovedPrevious.level} must approve first.`,
        400,
      );

    const employeeId = application.employee._id;

    // Release reserved hours atomically
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
              reservedHours: { $gte: appliedHours }, // Concurrency protection
            },
          },
        },
        {
          $inc: {
            "employees.$.reservedHours": -appliedHours,
            "employees.$.remainingHours": appliedHours,
          },
          $set: { "employees.$.status": CTO_STATUS.ACTIVE },
        },
        { session },
      );

      if (res.modifiedCount !== 1) {
        throw createServiceError(
          "Failed to release reserved hours (data mismatch or insufficient reserves).",
          400,
        );
      }
    }

    // Update current step to rejected securely via $set
    await ApprovalStep.findByIdAndUpdate(
      currentStep._id,
      {
        $set: {
          status: CTO_STATUS.REJECTED,
          remarks: safeRemarks,
          reviewedAt: new Date(),
        },
      },
      { session, runValidators: true },
    );

    // Cancel future steps automatically securely via $set
    const futureStepIds = (application.approvals || [])
      .filter((s) => Number(s.level) > Number(currentStep.level))
      .map((s) => s._id);

    if (futureStepIds.length) {
      await ApprovalStep.updateMany(
        { _id: { $in: futureStepIds }, status: CTO_STATUS.PENDING },
        {
          $set: {
            status: CTO_STATUS.CANCELLED,
            reviewedAt: new Date(),
            remarks:
              "Auto-cancelled due to rejection at an earlier approval level.",
          },
        },
        { session },
      );
    }

    application.overallStatus = CTO_STATUS.REJECTED;
    await application.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Background Logging and Notifications (Post-Transaction)
    const approver = await Employee.findById(safeApproverId)
      .select("username firstName lastName")
      .lean();

    const auditBody = {
      approverId: safeApproverId,
      applicationId: safeAppId,
      level: currentStep.level,
      approverName: `${approver?.username || "unknown"} (id: ${safeApproverId})`,
      approverUsername: approver?.username || "unknown",
      employeeName: `${application.employee.username} (id: ${application.employee._id})`,
    };

    const auditDetails = buildAuditDetails({
      endpoint: "Reject Application",
      actor: auditBody.approverName,
      targetUser: auditBody.employeeName,
      body: auditBody,
      params: { id: application._id },
      before: { status: currentStep.status },
    });

    await auditLogService.createAuditLog({
      userId: safeApproverId,
      username: auditBody.approverUsername,
      method: "POST",
      endpoint: "Reject Application",
      url: `/cto/applications/approver/${application._id}/reject`,
      statusCode: 200,
      ip: getClientIp(req),
      summary: auditDetails.summary,
      timestamp: new Date(),
    });

    try {
      await NotificationService.notifyEmployeeOnCtoRejection({
        employeeId: application.employee._id,
        approver: approver || {
          _id: safeApproverId,
          firstName: "Approver",
          lastName: "",
        },
        ctoApplication: application,
        approvalStep: currentStep,
        remarks: safeRemarks,
      });
    } catch (e) {
      console.error("Failed creating CTO rejection notification:", e?.message);
    }

    if (application.employee.email) {
      const enabled = await canSend(EMAIL_KEYS.CTO_REJECTION);
      if (enabled) {
        const tpl = ctoRejectionEmail({
          employeeName: application.employee.firstName,
          remarks: safeRemarks,
          brandName: "CTO Management System",
        });
        await safeSendEmail(application.employee.email, tpl.subject, tpl.html);
      }
    }

    // Refetch the fully populated, updated document to return
    return getCtoApplicationByIdService(safeAppId);
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
