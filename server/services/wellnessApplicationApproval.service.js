// services/wellnessApproval.service.js
const mongoose = require("mongoose");
const ApprovalStep = require("../models/approvalStepModel");
const WellnessApplication = require("../models/wellnessApplicationModel");
const Employee = require("../models/employeeModel");
const NotificationService = require("./notificationService");

const buildAuditDetails = require("../utils/auditActionBuilder");
const auditLogService = require("./auditLog.service");

// ✅ Email Dependencies
const sendEmail = require("../utils/sendEmail");
const EMAIL_KEYS = require("../utils/emailNotificationKeys");
const { isEmailEnabled } = require("../utils/emailNotificationSettings");
const {
  wellnessApprovalEmail,
  wellnessFinalApprovalEmail,
  wellnessRejectionEmail,
  wellnessStepApprovalEmail,
} = require("../utils/emailTemplates");

/* =========================
   Helpers
========================= */
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

/**
 * ✅ NEW: Strips null bytes and strictly caps string lengths to prevent
 * Payload Denial of Service and Null Byte Injection.
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

// ✅ The status filter strictly reflects the Approver's personal action
const getEffectiveStatusForApprover = (app, myStep) => {
  const myStatus = U(myStep?.status);
  const overall = U(app?.overallStatus);

  if (myStatus === "APPROVED") return "APPROVED";
  if (myStatus === "REJECTED") return "REJECTED";
  if (myStatus === "CANCELLED" || overall === "CANCELLED") return "CANCELLED";
  if (overall === "REJECTED") return "CANCELLED";

  return myStatus;
};

const clampPage = (v) => Math.max(parseInt(v, 10) || 1, 1);
const clampLimit = (v) => Math.min(Math.max(parseInt(v, 10) || 10, 1), 100);

// ✅ Email Helpers
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

// ✅ HELPER: Formats inclusive dates into a short readable string for the ledger
function formatLedgerDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return "";

  // Filter out invalid dates safely
  const validDates = dates.filter((d) => d && !isNaN(new Date(d).getTime()));
  if (validDates.length === 0) return "";

  const sorted = validDates.map((d) => new Date(d)).sort((a, b) => a - b);
  const start = sorted[0];
  const end = sorted[sorted.length - 1];

  const fmt = (date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  if (start.getTime() === end.getTime()) {
    return fmt(start);
  }
  return `${fmt(start)} to ${fmt(end)}`;
}

/* =========================
   Ledger Generator 
========================= */
async function generateEmployeeLedger(employeeId, asOfDate = null) {
  // 1. Fetch the employee's absolute real-time balance
  const employee = await Employee.findById(employeeId)
    .select("balances")
    .lean();
  const currentBalance = Number(employee?.balances?.wellnessDays || 0);

  // 2. Determine the target year (either the year of the application, or current year)
  const targetYear = asOfDate
    ? new Date(asOfDate).getFullYear()
    : new Date().getFullYear();
  const startOfYear = new Date(`${targetYear}-01-01T00:00:00.000Z`);
  const endOfYear = new Date(`${targetYear}-12-31T23:59:59.999Z`);

  // 3. Only fetch applications from that specific year!
  const applications = await WellnessApplication.find({
    employee: employeeId,
    overallStatus: {
      $in: ["APPROVED", "REVOKED", "PENDING", "REVOCATION_REQUESTED"],
    },
    createdAt: { $gte: startOfYear, $lte: endOfYear },
  }).lean();

  // 4. Mathematically derive the Total Credited Days FOR THIS YEAR
  let totalUsedThisYear = 0;
  applications.forEach((app) => {
    if (
      ["APPROVED", "PENDING", "REVOCATION_REQUESTED"].includes(
        app.overallStatus,
      )
    ) {
      totalUsedThisYear += Number(app.totalDays || 0);
    }
  });

  // This serves as our starting total sum of credited days for the year
  const totalCreditedDaysThisYear = currentBalance + totalUsedThisYear;

  let transactions = [];

  // -------------------------
  // ADD APPLICATIONS (Usage & Revocations)
  // -------------------------
  applications.forEach((app) => {
    const datesCovered = formatLedgerDates(app.inclusiveDates);
    const descriptionBase = datesCovered
      ? `Wellness Leave (${datesCovered})`
      : "Wellness Leave";

    const transactionDate = app.createdAt;
    const displayDate = datesCovered || "N/A";

    if (
      ["APPROVED", "PENDING", "REVOCATION_REQUESTED"].includes(
        app.overallStatus,
      )
    ) {
      let statusSuffix = "";
      if (app.overallStatus === "PENDING") statusSuffix = " (Pending)";
      if (app.overallStatus === "REVOCATION_REQUESTED")
        statusSuffix = " (Revocation Requested)";

      transactions.push({
        date: transactionDate,
        displayDate: displayDate,
        type: "APPLICATION",
        description: `${descriptionBase}${statusSuffix}`,
        amount: -Number(app.totalDays),
        referenceId: app._id,
        sortPriority: 1,
      });
    } else if (app.overallStatus === "REVOKED") {
      transactions.push({
        date: transactionDate,
        displayDate: displayDate,
        type: "APPLICATION",
        description: descriptionBase,
        amount: -Number(app.totalDays),
        referenceId: app._id,
        sortPriority: 1,
      });

      let revokeDate = new Date(app.revokedAt || app.updatedAt);
      if (revokeDate.getTime() < new Date(transactionDate).getTime()) {
        revokeDate = new Date(new Date(transactionDate).getTime() + 1000);
      }

      transactions.push({
        date: revokeDate,
        displayDate: displayDate,
        type: "REVOCATION_RESTORED",
        description: `${descriptionBase} - Revoked`,
        amount: Number(app.totalDays),
        referenceId: app._id,
        sortPriority: 2,
      });
    }
  });

  if (asOfDate) {
    const cutoffDate = new Date(asOfDate);
    transactions = transactions.filter((t) => new Date(t.date) <= cutoffDate);
  }

  transactions.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();

    if (dateA === dateB) {
      return (a.sortPriority || 0) - (b.sortPriority || 0);
    }
    return dateA - dateB;
  });

  let runningBalance = totalCreditedDaysThisYear;
  const ledgerTransactions = transactions.map((t) => {
    runningBalance += t.amount;
    return {
      ...t,
      runningBalance,
    };
  });

  return {
    balanceForwarded: totalCreditedDaysThisYear,
    transactions: ledgerTransactions,
    endingBalance: runningBalance,
  };
}

/* =========================
   Services
========================= */
const fetchPendingWellnessCountService = async (approverId) => {
  if (!approverId) throw httpError("Approver ID is required", 400);

  const approvalSteps = await ApprovalStep.find({
    approver: approverId,
  }).populate({
    path: "wellnessApplication",
    populate: [
      { path: "approvals", populate: { path: "approver", select: "_id" } },
    ],
  });

  const pendingCount = approvalSteps.reduce((count, step) => {
    const app = step.wellnessApplication;
    if (!app || !Array.isArray(app.approvals) || app.approvals.length === 0)
      return count;

    const steps = app.approvals;
    const userStepIndex = steps.findIndex(
      (s) => s.approver?._id?.toString() === approverId.toString(),
    );
    if (userStepIndex === -1) return count;

    const userStep = steps[userStepIndex];

    if (userStep.status === "REJECTED") return count;
    if (userStep.status === "CANCELLED") return count;
    if (app.overallStatus === "REJECTED") return count;
    if (app.overallStatus === "CANCELLED") return count;

    const pendingStep = steps.find((s) => s.status === "PENDING");
    const isTheirTurn =
      pendingStep?.approver?._id?.toString() === approverId.toString();

    if (userStep.status === "PENDING" && isTheirTurn) return count + 1;
    return count;
  }, 0);

  return pendingCount;
};

const getWellnessApplicationsForApproverService = async (
  approverId,
  search = "",
  status = "",
  page = 1,
  limit = 10,
) => {
  if (!approverId) throw httpError("Approver ID is required.", 400);

  const safePage = clampPage(page);
  const safeLimit = clampLimit(limit);

  // ✅ NEW: Strictly sanitize search and status variables
  const safeSearch = sanitizeString(search, 100).toLowerCase();
  const safeStatus = sanitizeString(status, 20).toUpperCase();

  const approvalSteps = await ApprovalStep.find({ approver: approverId })
    .populate({
      path: "wellnessApplication",
      // ✅ NEW: Added lateFiling to projection
      select:
        "employee approvals overallStatus inclusiveDates totalDays reason createdAt employeeType commutation applicantSignatureUrl certificationOfLeaveCredits actionDetails lateFiling",
      populate: [
        {
          path: "employee",
          select:
            "prefixTitle firstName middleName lastName nameExtension postfixTitle position signature",
        },
        {
          path: "approvals",
          select: "approver status level role approverSnapshot",
          populate: {
            path: "approver",
            select:
              "prefixTitle firstName middleName lastName nameExtension postfixTitle position _id",
          },
        },
      ],
    })
    .sort({ createdAt: -1 })
    .lean();

  const appMap = new Map();
  for (const step of approvalSteps) {
    const app = step?.wellnessApplication;
    if (app?._id) appMap.set(String(app._id), app);
  }

  let apps = Array.from(appMap.values()).filter(Boolean);

  apps = apps.filter((app) => {
    const steps = Array.isArray(app?.approvals) ? app.approvals : [];
    if (!steps.length) return false;

    const ordered = sortByLevel(steps);

    const myStep = ordered.find((s) =>
      sameId(s?.approver?._id || s?.approver, approverId),
    );
    if (!myStep) return false;

    const myStatus = U(myStep.status);
    const overall = U(app.overallStatus);

    if (myStatus !== "PENDING") return true;
    if (overall !== "PENDING") return false;

    const pendingStep = ordered.find((s) => U(s.status) === "PENDING");
    if (!pendingStep) return false;

    const isTheirTurn = sameId(
      pendingStep?.approver?._id || pendingStep?.approver,
      approverId,
    );

    return isTheirTurn;
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
      sameId(s?.approver?._id || s?.approver, approverId),
    );
    const effective = getEffectiveStatusForApprover(app, myStep);

    statusCounts.total++;
    if (effective === "PENDING") statusCounts.PENDING++;
    if (effective === "APPROVED") statusCounts.APPROVED++;
    if (effective === "REJECTED") statusCounts.REJECTED++;
    if (effective === "CANCELLED") statusCounts.CANCELLED++;
  });

  if (safeStatus) {
    apps = apps.filter((app) => {
      const ordered = sortByLevel(app.approvals || []);
      const myStep = ordered.find((s) =>
        sameId(s?.approver?._id || s?.approver, approverId),
      );
      const effective = getEffectiveStatusForApprover(app, myStep);
      return effective === safeStatus;
    });
  }

  const total = apps.length;
  const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
  const startIndex = (safePage - 1) * safeLimit;

  const data = apps.slice(startIndex, startIndex + safeLimit);

  const formattedData = data.map((app) => {
    const appObj = app.toObject ? app.toObject() : { ...app };
    appObj.type = "WELLNESS";
    return appObj;
  });

  return {
    data: formattedData,
    total,
    totalPages,
    statusCounts,
  };
};

const getWellnessApplicationByIdService = async (wellnessApplicationId) => {
  if (!wellnessApplicationId)
    throw httpError("Application ID is required.", 400);

  const application = await WellnessApplication.findById(wellnessApplicationId)
    .populate({
      path: "employee",
      select:
        "prefixTitle firstName middleName lastName nameExtension postfixTitle position department signature employeeId email",
    })
    .populate({
      path: "approvals",
      select: "-__v",
      populate: {
        path: "approver",
        select:
          "prefixTitle firstName middleName lastName nameExtension postfixTitle position email",
      },
    })
    .lean();

  if (!application) throw httpError("Wellness Application not found", 404);

  // ✅ Generate and attach Ledger
  const asOfDate = application.createdAt || new Date();
  const employeeId = application.employee?._id || application.employee;
  const ledger = await generateEmployeeLedger(employeeId, asOfDate);

  const appObj = application.toObject ? application.toObject() : application;
  appObj.type = "WELLNESS";
  appObj.ledger = ledger;

  return appObj;
};

const approveWellnessApplicationService = async ({
  approverId,
  applicationId,
  req,
}) => {
  assertObjectId(approverId, "approverId");
  assertObjectId(applicationId, "applicationId");

  const approver = await Employee.findById(approverId)
    .select(
      "prefixTitle firstName middleName lastName nameExtension postfixTitle position email signature",
    )
    .lean();

  if (!approver) {
    throw httpError("Approver profile not found.", 404);
  }
  if (!approver.signature) {
    throw httpError(
      "Action requires an e-signature. Please upload a signature in your profile.",
      400,
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const application = await WellnessApplication.findById(applicationId)
      .populate("approvals")
      .populate("employee")
      .session(session);

    if (!application) throw httpError("Wellness Application not found.", 404);
    if (application.overallStatus !== "PENDING")
      throw httpError("Application already processed.", 400);

    const currentStep = application.approvals.find(
      (s) => s.approver.toString() === String(approverId),
    );
    if (!currentStep)
      throw httpError("You are not an approver for this application.", 403);

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
      {
        $set: {
          status: "APPROVED",
          reviewedAt: new Date(),
          approverSnapshot: {
            prefixTitle: approver.prefixTitle || "",
            firstName: approver.firstName || "",
            middleName: approver.middleName || "",
            lastName: approver.lastName || "",
            nameExtension: approver.nameExtension || "",
            postfixTitle: approver.postfixTitle || "",
            position: approver.position || "",
            signatureUrl: approver.signature,
            signedAt: new Date(),
          },
        },
      },
      { session, runValidators: true },
    );

    const updatedSteps = await ApprovalStep.find({
      _id: { $in: application.approvals },
    }).session(session);

    const anyRejected = updatedSteps.some((s) => s.status === "REJECTED");
    if (anyRejected) {
      application.overallStatus = "REJECTED";
      await application.save({ session });
    }

    const allApproved = updatedSteps.every((s) => s.status === "APPROVED");

    if (allApproved) {
      application.overallStatus = "APPROVED";
      await application.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    const auditBody = {
      approverId,
      applicationId,
      level: currentStep.level,
      approverName: `${approver?.email || "unknown"} (id: ${approverId})`,
      approverEmail: approver?.email || "unknown",
      employeeName: `${application.employee.email} (id: ${application.employee._id})`,
    };

    const auditDetails = buildAuditDetails({
      endpoint: "Approve Wellness Application",
      actor: auditBody.approverName,
      targetUser: auditBody.employeeName,
      body: auditBody,
      params: { id: application._id },
      before: { status: currentStep.status },
    });

    await auditLogService.createAuditLog({
      userId: approverId,
      email: auditBody.approverEmail,
      method: "POST",
      endpoint: "Approve Wellness Application",
      url: `/wellness/applications/approver/${application._id}/approve`,
      statusCode: 200,
      ip: getClientIp(req),
      summary: auditDetails.summary,
      timestamp: new Date(),
    });

    try {
      await NotificationService.notifyEmployeeOnWellnessApproval({
        employeeId: application.employee._id,
        approver,
        wellnessApplication: application,
        allApproved,
      });
    } catch (e) {
      console.error(
        "Failed creating Wellness approval notification:",
        e?.message || e,
      );
    }

    if (allApproved) {
      try {
        const enabled = await canSend(EMAIL_KEYS.WELLNESS_FINAL_APPROVAL);
        if (application.employee.email && enabled) {
          const tpl = wellnessFinalApprovalEmail({
            employeeName: `${application.employee.firstName} ${application.employee.lastName}`,
            requestedDays: application.totalDays,
            inclusiveDates: (application.inclusiveDates || []).join(", "),
          });
          await safeSendEmail(
            application.employee.email,
            tpl.subject,
            tpl.html,
          );
        }
      } catch (err) {
        console.error(
          "Failed to send Wellness final approval email:",
          err?.message,
        );
      }
    } else {
      const nextStep = updatedSteps.find(
        (s) => s.level === currentStep.level + 1,
      );
      if (nextStep) {
        try {
          await NotificationService.notifyApproverOnWellnessRequired({
            approverId: nextStep.approver,
            employee: application.employee,
            wellnessApplication: application,
          });
        } catch (e) {
          console.error(
            "Failed creating next step Wellness notification:",
            e?.message || e,
          );
        }

        try {
          const nextApproverUser = await Employee.findById(nextStep.approver)
            .select("firstName lastName email")
            .lean();

          const enabled = await canSend(EMAIL_KEYS.WELLNESS_APPROVAL);
          if (nextApproverUser?.email && enabled) {
            const tpl = wellnessApprovalEmail({
              approverName: `${nextApproverUser.firstName} ${nextApproverUser.lastName}`,
              employeeName: `${application.employee.firstName} ${application.employee.lastName}`,
              requestedDays: application.totalDays,
              inclusiveDates: (application.inclusiveDates || []).join(", "),
              reason: application.reason,
              level: nextStep.level,
              link: `${process.env.FRONTEND_URL}/app/wellness-approvals/${application._id}`,
            });
            await safeSendEmail(nextApproverUser.email, tpl.subject, tpl.html);
          }
        } catch (err) {
          console.error(
            "Failed to send Wellness next-step approval email:",
            err?.message,
          );
        }
      }

      try {
        if (application.employee.email) {
          const applicantEnabled = await canSend(EMAIL_KEYS.WELLNESS_APPROVAL);
          if (applicantEnabled) {
            const tpl = wellnessStepApprovalEmail({
              employeeName: application.employee.firstName,
              approverName: `${approver.firstName} ${approver.lastName}`,
              level: currentStep.level,
            });
            await safeSendEmail(
              application.employee.email,
              tpl.subject,
              tpl.html,
            );
          }
        }
      } catch (err) {
        console.error(
          "Failed to send Wellness step approval email:",
          err?.message,
        );
      }
    }

    return getWellnessApplicationByIdService(applicationId);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

const rejectWellnessApplicationService = async ({
  approverId,
  applicationId,
  remarks,
  req,
}) => {
  assertObjectId(approverId, "approverId");
  assertObjectId(applicationId, "applicationId");

  // ✅ NEW: Sanitize Rejection Remarks
  const safeRemarks = sanitizeString(remarks, 1000) || "No remarks provided";

  const approver = await Employee.findById(approverId)
    .select(
      "prefixTitle firstName middleName lastName nameExtension postfixTitle position email signature",
    )
    .lean();

  if (!approver) {
    throw httpError("Approver profile not found.", 404);
  }
  if (!approver.signature) {
    throw httpError(
      "Action requires an e-signature. Please upload a signature in your profile.",
      400,
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const application = await WellnessApplication.findById(applicationId)
      .populate("approvals")
      .populate("employee", "firstName lastName email balances")
      .session(session);

    if (!application) throw httpError("Wellness Application not found.", 404);
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

    // Refund Wellness Days
    await Employee.updateOne(
      { _id: employeeId },
      { $inc: { "balances.wellnessDays": application.totalDays } },
      { session },
    );

    await ApprovalStep.findByIdAndUpdate(
      currentStep._id,
      {
        $set: {
          status: "REJECTED",
          remarks: safeRemarks, // ✅ Use sanitized string here
          reviewedAt: new Date(),
          approverSnapshot: {
            prefixTitle: approver.prefixTitle || "",
            firstName: approver.firstName || "",
            middleName: approver.middleName || "",
            lastName: approver.lastName || "",
            nameExtension: approver.nameExtension || "",
            postfixTitle: approver.postfixTitle || "",
            position: approver.position || "",
            signatureUrl: approver.signature,
            signedAt: new Date(),
          },
        },
      },
      { session, runValidators: true },
    );

    const futureStepIds = (application.approvals || [])
      .filter((s) => Number(s.level) > Number(currentStep.level))
      .map((s) => s._id);

    if (futureStepIds.length) {
      await ApprovalStep.updateMany(
        { _id: { $in: futureStepIds }, status: "PENDING" },
        {
          $set: {
            status: "CANCELLED",
            reviewedAt: new Date(),
            remarks:
              "Auto-cancelled due to rejection at an earlier approval level.",
          },
        },
        { session },
      );
    }

    application.overallStatus = "REJECTED";
    await application.save({ session });

    await session.commitTransaction();
    session.endSession();

    const auditBody = {
      approverId,
      applicationId,
      level: currentStep.level,
      approverName: `${approver?.email || "unknown"} (id: ${approverId})`,
      approverEmail: approver?.email || "unknown",
      employeeName: `${application.employee.email} (id: ${application.employee._id})`,
    };

    const auditDetails = buildAuditDetails({
      endpoint: "Reject Wellness Application",
      actor: auditBody.approverName,
      targetUser: auditBody.employeeName,
      body: auditBody,
      params: { id: application._id },
      before: { status: currentStep.status },
    });

    await auditLogService.createAuditLog({
      userId: approverId,
      email: auditBody.approverEmail,
      method: "POST",
      endpoint: "Reject Wellness Application",
      url: `/wellness/applications/approver/${application._id}/reject`,
      statusCode: 200,
      ip: getClientIp(req),
      summary: auditDetails.summary,
      timestamp: new Date(),
    });

    try {
      await NotificationService.notifyEmployeeOnWellnessRejection({
        employeeId: application.employee._id,
        approver,
        wellnessApplication: application,
        remarks: safeRemarks, // ✅ Use sanitized string here
      });
    } catch (e) {
      console.error(
        "Failed creating Wellness rejection notification:",
        e?.message || e,
      );
    }

    try {
      const enabled = await canSend(EMAIL_KEYS.WELLNESS_REJECTION);
      if (application.employee.email && enabled) {
        const tpl = wellnessRejectionEmail({
          employeeName: `${application.employee.firstName} ${application.employee.lastName}`,
          remarks: safeRemarks, // ✅ Use sanitized string here
        });
        await safeSendEmail(application.employee.email, tpl.subject, tpl.html);
      }
    } catch (err) {
      console.error("Failed to send Wellness rejection email:", err?.message);
    }

    return getWellnessApplicationByIdService(applicationId);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

module.exports = {
  fetchPendingWellnessCountService,
  getWellnessApplicationsForApproverService,
  getWellnessApplicationByIdService,
  approveWellnessApplicationService,
  rejectWellnessApplicationService,
};
