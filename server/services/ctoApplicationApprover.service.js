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
  ctoStepApprovalEmail,
  ctoNotifiedFinalApprovalEmail,
  ctoNotifiedRejectionEmail,
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
  ACTIVE: "ACTIVE",
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
    throw createServiceError("Invalid " + label + " format.", 400);
  }
}

function extractId(item) {
  if (item && typeof item === "object") {
    return item._id || item.id || item.employee || item.approver;
  }
  return item;
}

function fullNameOf(person) {
  const first = person?.firstName || "";
  const last = person?.lastName || "";
  return (first + " " + last).trim();
}

/**
 * Strips null bytes and strictly caps string lengths to prevent
 * Payload Denial of Service and Null Byte Injection.
 * Default max length is exactly 100 characters.
 */
function sanitizeString(str, maxLength = 100) {
  return String(str || "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, maxLength);
}

function getClientIp(req) {
  const xf = req?.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) {
    return sanitizeString(xf.split(",")[0], 50);
  }
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

function strictNumber(val, fallback = 0) {
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatLedgerDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return "";

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
  return fmt(start) + " to " + fmt(end);
}

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
  if (!key) return false;
  try {
    return await isEmailEnabled(key);
  } catch (e) {
    console.error("[EMAIL] could not read email setting:", key, e?.message);
    return false;
  }
}

// Loads the notified (tagged) employees of an application, excluding approvers
async function getNotifiedDocs(application, excludeIds = []) {
  const excluded = new Set(excludeIds.map(String));

  const ids = [
    ...new Set(
      (application?.notifiedEmployees || [])
        .map((item) => String(extractId(item)))
        .filter((id) => mongoose.isValidObjectId(id) && !excluded.has(id)),
    ),
  ];

  if (ids.length === 0) return { ids: [], docs: [] };

  const docs = await Employee.find({ _id: { $in: ids } })
    .select("firstName lastName email phone")
    .lean();

  return { ids, docs };
}

// Audit logging must never break an already-committed approval/rejection
async function writeAuditLog({
  endpoint,
  urlSuffix,
  approver,
  approverId,
  application,
  currentStep,
  req,
}) {
  try {
    const approverEmail = approver?.email || "unknown";
    const auditBody = {
      approverId,
      applicationId: String(application._id),
      level: currentStep.level,
      approverName: approverEmail + " (id: " + approverId + ")",
      approverEmail,
      employeeName:
        (application.employee?.email || "unknown") +
        " (id: " +
        application.employee?._id +
        ")",
    };

    const auditDetails = buildAuditDetails({
      endpoint,
      actor: auditBody.approverName,
      targetUser: auditBody.employeeName,
      body: auditBody,
      params: { id: application._id },
      before: { status: CTO_STATUS.PENDING },
    });

    await auditLogService.createAuditLog({
      userId: approverId,
      email: approverEmail,
      method: "POST",
      endpoint,
      url: "/cto/applications/approver/" + application._id + "/" + urlSuffix,
      statusCode: 200,
      ip: getClientIp(req),
      summary: auditDetails.summary,
      timestamp: new Date(),
    });
  } catch (e) {
    console.error("[AUDIT] Failed writing " + endpoint + " log:", e?.message);
  }
}

/* =========================
   Ledger Generator 
========================= */
async function generateEmployeeLedger(employeeId, asOfDate = null) {
  const credits = await CtoCredit.find({
    "employees.employee": employeeId,
  }).lean();

  const applications = await CtoApplication.find({
    employee: employeeId,
    overallStatus: {
      $in: ["APPROVED", "REVOKED", "PENDING", "REVOCATION_REQUESTED"],
    },
  }).lean();

  let transactions = [];

  // 1. ADD CREDITS
  credits.forEach((credit) => {
    const empRec = credit.employees?.find(
      (e) => String(e.employee) === String(employeeId),
    );
    if (empRec) {
      const earned =
        strictNumber(empRec.totalHours) ||
        strictNumber(empRec.remainingHours) +
          strictNumber(empRec.usedHours) +
          strictNumber(empRec.reservedHours);

      if (earned > 0) {
        const accrualDate =
          credit.createdAt || credit.dateCredited || credit.dateApproved;

        let displayDate = "N/A";
        if (credit.inclusiveDates?.startDate) {
          const datesArr = [credit.inclusiveDates.startDate];
          if (credit.inclusiveDates.endDate)
            datesArr.push(credit.inclusiveDates.endDate);
          displayDate = formatLedgerDates(datesArr);
        } else if (credit.dateApproved) {
          displayDate = formatLedgerDates([credit.dateApproved]);
        }

        let description = "N/A";
        if (credit.purpose) {
          description = credit.purpose + " (Please see attached memo)";
        } else if (credit.memoNo) {
          description = "Memo " + credit.memoNo;
        }

        transactions.push({
          date: accrualDate,
          displayDate: displayDate,
          type: "ACCRUAL",
          description: description,
          amount: earned,
          referenceId: credit._id,
          sortPriority: 0,
        });
      }
    }
  });

  // 2. ADD APPLICATIONS
  applications.forEach((app) => {
    const datesCovered = formatLedgerDates(app.inclusiveDates);
    const descriptionBase = datesCovered
      ? "Compensatory Time Off (" + datesCovered + ")"
      : "Compensatory Time Off";

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
        description: descriptionBase + statusSuffix,
        amount: -strictNumber(app.requestedHours),
        referenceId: app._id,
        sortPriority: 1,
      });
    } else if (app.overallStatus === "REVOKED") {
      transactions.push({
        date: transactionDate,
        displayDate: displayDate,
        type: "APPLICATION",
        description: descriptionBase,
        amount: -strictNumber(app.requestedHours),
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
        description: descriptionBase + " - Revoked",
        amount: strictNumber(app.requestedHours),
        referenceId: app._id,
        sortPriority: 2,
      });
    }
  });

  if (asOfDate) {
    const cutoffDate = new Date(asOfDate);
    transactions = transactions.filter((t) => new Date(t.date) <= cutoffDate);
  }

  // 3. SORT CHRONOLOGICALLY
  transactions.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();

    if (dateA === dateB) {
      return (a.sortPriority || 0) - (b.sortPriority || 0);
    }
    return dateA - dateB;
  });

  // 4. CALCULATE BALANCE
  let runningBalance = 0;
  const ledgerTransactions = transactions.map((t) => {
    runningBalance += t.amount;
    return {
      ...t,
      runningBalance,
    };
  });

  return {
    balanceForwarded: 0,
    transactions: ledgerTransactions,
    endingBalance: runningBalance,
  };
}

/* =========================
   Services
========================= */

const getApproverOptionsService = async () => {
  const employees = await Employee.find(
    {},
    "_id prefixTitle firstName middleName lastName nameExtension postfixTitle position email employeeType phone",
  )
    .sort({ lastName: 1, firstName: 1 })
    .lean();

  const organicCount = employees.filter(
    (e) => e.employeeType === "Organic",
  ).length;
  const jobOrderCount = employees.filter(
    (e) => e.employeeType === "Job Order" || e.employeeType === "JO",
  ).length;

  return {
    data: employees,
    organicCount,
    jobOrderCount,
  };
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

  const safeSearch = sanitizeString(search, 100).toLowerCase();
  const safeStatus = sanitizeString(status, 20).toUpperCase();

  const approvalSteps = await ApprovalStep.find({ approver: safeId })
    .populate({
      path: "ctoApplication",
      select:
        "employee approvals notifiedEmployees overallStatus requestedHours inclusiveDates reason createdAt lateFiling",
      populate: [
        {
          path: "employee",
          select:
            "prefixTitle firstName middleName lastName nameExtension postfixTitle position email phone",
        },
        {
          path: "approvals",
          select: "approver status level role approverSnapshot",
          populate: {
            path: "approver",
            select:
              "prefixTitle firstName middleName lastName nameExtension postfixTitle position email phone _id",
          },
        },
        {
          path: "notifiedEmployees",
          select:
            "prefixTitle firstName middleName lastName nameExtension postfixTitle position email phone _id",
          strictPopulate: false,
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
      const fullName = fullNameOf(app.employee).toLowerCase();
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
      select:
        "prefixTitle firstName middleName lastName nameExtension postfixTitle position department email phone balances",
    })
    .populate({
      path: "approvals",
      select: "-__v",
      populate: {
        path: "approver",
        select:
          "prefixTitle firstName middleName lastName nameExtension postfixTitle position email phone",
      },
    })
    .populate({
      path: "notifiedEmployees",
      select:
        "prefixTitle firstName middleName lastName nameExtension postfixTitle position email phone",
      strictPopulate: false,
    })
    .populate({ path: "memo.memoId", select: "memoNo uploadedMemo" })
    .lean();

  if (!application) throw createServiceError("CTO Application not found", 404);

  application.type = "CTO";

  // === LEDGER INTEGRATION ===
  const asOfDate = application.createdAt || new Date();
  const employeeId = application.employee?._id || application.employee;
  const ledger = await generateEmployeeLedger(employeeId, asOfDate);
  application.ledger = ledger;

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

  const approver = await Employee.findById(safeApproverId)
    .select(
      "prefixTitle firstName middleName lastName nameExtension postfixTitle position email signature phone",
    )
    .lean();

  if (!approver) {
    throw createServiceError("Approver profile not found.", 404);
  }
  if (!approver.signature) {
    throw createServiceError(
      "Action requires an e-signature. Please upload a signature in your profile.",
      400,
    );
  }

  // ==========================================
  // TRANSACTION (all DB changes succeed or none do)
  // ==========================================
  let application;
  let currentStep;
  let updatedSteps = [];
  let allApproved = false;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    application = await CtoApplication.findById(safeAppId)
      .populate("approvals")
      .populate("employee", "_id firstName lastName email balances phone")
      .session(session);

    if (!application)
      throw createServiceError("CTO Application not found.", 404);
    if (application.overallStatus !== CTO_STATUS.PENDING) {
      throw createServiceError("Application has already been processed.", 400);
    }

    currentStep = application.approvals.find((s) =>
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
        "Level " + unapprovedPrevious.level + " must approve first.",
        400,
      );

    // Update approval step securely, injecting the full approverSnapshot
    await ApprovalStep.findByIdAndUpdate(
      currentStep._id,
      {
        $set: {
          status: CTO_STATUS.APPROVED,
          reviewedAt: new Date(),
          "approverSnapshot.signatureUrl": approver.signature,
          "approverSnapshot.signedAt": new Date(),
        },
      },
      { session, runValidators: true },
    );

    updatedSteps = await ApprovalStep.find({
      _id: {
        $in: application.approvals,
      },
    }).session(session);

    allApproved = updatedSteps.every((s) => s.status === CTO_STATUS.APPROVED);

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
            employees: {
              $elemMatch: {
                employee: employeeId,
                reservedHours: {
                  $gte: appliedHours,
                },
              },
            },
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
            {
              _id: memoId,
              employees: { $elemMatch: { employee: employeeId } },
            },
            {
              $set: {
                "employees.$.status": CTO_STATUS.EXHAUSTED,
              },
            },
            { session },
          );
        }
      }

      // 2. Atomic update for Employee CTO Balance (Prevents Race Conditions)
      const requestedHours = Number(application.requestedHours || 0);
      const updatedEmployee = await Employee.findOneAndUpdate(
        {
          _id: employeeId,
          "balances.ctoHours": {
            $gte: requestedHours,
          },
        },
        {
          $inc: {
            "balances.ctoHours": -requestedHours,
          },
        },
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
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    session.endSession();
  }

  // ==========================================
  // SIDE EFFECTS (already committed — nothing below may fail the request)
  // ==========================================
  await writeAuditLog({
    endpoint: "Approve Application",
    urlSuffix: "approve",
    approver,
    approverId: safeApproverId,
    application,
    currentStep,
    req,
  });

  const applicantName = fullNameOf(application.employee);

  // 1. IN-APP NOTIFICATION TO APPLICANT (Triggers for every approval step)
  try {
    await NotificationService.notifyEmployeeOnCtoApproval({
      employeeId: application.employee._id,
      employee: application.employee,
      approver,
      ctoApplication: application,
      approvalStep: currentStep,
    });
  } catch (e) {
    console.error("Failed creating CTO approval notification:", e?.message);
  }

  if (!allApproved) {
    // ---------- INTERMEDIATE STEP ----------
    // Notified employees are NOT informed on intermediate steps.
    const nextStep = updatedSteps.find(
      (s) => s.level === currentStep.level + 1,
    );

    if (nextStep) {
      let nextApprover = null;

      try {
        nextApprover = await Employee.findById(nextStep.approver)
          .select("email firstName lastName phone")
          .lean();

        await NotificationService.notifyApproverOnCtoRequired({
          approverId: nextStep.approver,
          approver: nextApprover,
          employee: application.employee,
          ctoApplication: application,
        });
      } catch (e) {
        console.error(
          "Failed creating next step CTO notification:",
          e?.message,
        );
      }

      try {
        const enabled = await canSend(EMAIL_KEYS.CTO_APPROVAL);
        if (nextApprover?.email && enabled) {
          const frontendUrl = process.env.FRONTEND_URL || "";
          const tpl = ctoApprovalEmail({
            approverName: fullNameOf(nextApprover),
            employeeName: applicantName,
            requestedHours: application.requestedHours,
            reason: application.reason,
            level: nextStep.level,
            link: frontendUrl + "/app/cto-approvals/" + application._id,
          });
          await safeSendEmail(nextApprover.email, tpl.subject, tpl.html);
        }
      } catch (e) {
        console.error("Failed emailing next CTO approver:", e?.message);
      }
    }

    // Email the APPLICANT about the intermediate approval
    try {
      const applicantEnabled = await canSend(EMAIL_KEYS.CTO_APPROVAL);
      if (application.employee.email && applicantEnabled) {
        const tpl = ctoStepApprovalEmail({
          employeeName: application.employee.firstName,
          approverName: fullNameOf(approver),
          level: currentStep.level,
        });
        await safeSendEmail(application.employee.email, tpl.subject, tpl.html);
      }
    } catch (e) {
      console.error("Failed emailing applicant on CTO step:", e?.message);
    }
  } else {
    // ---------- FINAL APPROVAL ----------
    const finalApprovalEmailEnabled = await canSend(
      EMAIL_KEYS.CTO_FINAL_APPROVAL,
    );

    // Email the applicant
    try {
      if (application.employee.email && finalApprovalEmailEnabled) {
        const tpl = ctoFinalApprovalEmail({
          employeeName: application.employee.firstName,
          requestedHours: application.requestedHours,
        });
        await safeSendEmail(application.employee.email, tpl.subject, tpl.html);
      }
    } catch (e) {
      console.error("Failed emailing applicant on CTO final:", e?.message);
    }

    // Notify passive tagged employees ONLY on Final Approval
    try {
      const approverIds = updatedSteps.map((s) => String(s.approver));
      const { ids: notifiedIds, docs: notifiedDocs } = await getNotifiedDocs(
        application,
        approverIds,
      );

      if (notifiedIds.length > 0) {
        if (
          typeof NotificationService.notifyTaggedEmployeesOnCtoFinalApproval ===
          "function"
        ) {
          try {
            await NotificationService.notifyTaggedEmployeesOnCtoFinalApproval({
              notifiedIds,
              notifiedEmployees: notifiedDocs,
              employee: application.employee,
              approver,
              ctoApplication: application,
            });
          } catch (e) {
            console.error(
              "Failed in-app notify of tagged employees on CTO final:",
              e?.message,
            );
          }
        }

        if (finalApprovalEmailEnabled) {
          await Promise.all(
            notifiedDocs
              .filter((emp) => emp?.email)
              .map((emp) => {
                const tpl = ctoNotifiedFinalApprovalEmail({
                  recipientName: fullNameOf(emp),
                  employeeName: applicantName,
                  requestedHours: application.requestedHours,
                  inclusiveDates: application.inclusiveDates,
                  approvedBy: fullNameOf(approver),
                });
                return safeSendEmail(emp.email, tpl.subject, tpl.html);
              }),
          );
        }
      }
    } catch (e) {
      console.error(
        "Failed notifying tagged employees on CTO final approval:",
        e?.message,
      );
    }
  }

  return getCtoApplicationByIdService(safeAppId);
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

  const approver = await Employee.findById(safeApproverId)
    .select(
      "prefixTitle firstName middleName lastName nameExtension postfixTitle position email signature phone",
    )
    .lean();

  if (!approver) {
    throw createServiceError("Approver profile not found.", 404);
  }
  if (!approver.signature) {
    throw createServiceError(
      "Action requires an e-signature. Please upload a signature in your profile.",
      400,
    );
  }

  // ==========================================
  // TRANSACTION (all DB changes succeed or none do)
  // ==========================================
  let application;
  let currentStep;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    application = await CtoApplication.findById(safeAppId)
      .populate("approvals")
      .populate("memo.memoId")
      .populate("employee", "firstName lastName email balances phone")
      .session(session);

    if (!application)
      throw createServiceError("CTO Application not found.", 404);
    if (application.overallStatus !== CTO_STATUS.PENDING) {
      throw createServiceError("Application has already been processed.", 400);
    }

    currentStep = application.approvals.find((s) =>
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
        "Level " + unapprovedPrevious.level + " must approve first.",
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
              reservedHours: {
                $gte: appliedHours,
              },
            },
          },
        },
        {
          $inc: {
            "employees.$.reservedHours": -appliedHours,
            "employees.$.remainingHours": appliedHours,
          },
          $set: {
            "employees.$.status": CTO_STATUS.ACTIVE,
          },
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

    // Update current step to rejected securely, injecting the full approverSnapshot
    await ApprovalStep.findByIdAndUpdate(
      currentStep._id,
      {
        $set: {
          status: CTO_STATUS.REJECTED,
          remarks: safeRemarks,
          reviewedAt: new Date(),
          "approverSnapshot.signatureUrl": approver.signature,
          "approverSnapshot.signedAt": new Date(),
        },
      },
      { session, runValidators: true },
    );

    // Cancel future steps automatically
    const futureStepIds = (application.approvals || [])
      .filter((s) => Number(s.level) > Number(currentStep.level))
      .map((s) => s._id);

    if (futureStepIds.length) {
      await ApprovalStep.updateMany(
        {
          _id: {
            $in: futureStepIds,
          },
          status: CTO_STATUS.PENDING,
        },
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
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    session.endSession();
  }

  // ==========================================
  // SIDE EFFECTS (already committed — nothing below may fail the request)
  // ==========================================
  await writeAuditLog({
    endpoint: "Reject Application",
    urlSuffix: "reject",
    approver,
    approverId: safeApproverId,
    application,
    currentStep,
    req,
  });

  const applicantName = fullNameOf(application.employee);

  // 1. IN-APP NOTIFICATION TO APPLICANT
  try {
    await NotificationService.notifyEmployeeOnCtoRejection({
      employeeId: application.employee._id,
      employee: application.employee,
      approver,
      ctoApplication: application,
      approvalStep: currentStep,
      remarks: safeRemarks,
    });
  } catch (e) {
    console.error("Failed creating CTO rejection notification:", e?.message);
  }

  const rejectionEmailEnabled = await canSend(EMAIL_KEYS.CTO_REJECTION);

  // 2. EMAIL NOTIFICATION TO APPLICANT
  try {
    if (application.employee.email && rejectionEmailEnabled) {
      const tpl = ctoRejectionEmail({
        employeeName: application.employee.firstName,
        remarks: safeRemarks,
      });
      await safeSendEmail(application.employee.email, tpl.subject, tpl.html);
    }
  } catch (e) {
    console.error("Failed emailing applicant on CTO rejection:", e?.message);
  }

  // 3. NOTIFY TAGGED EMPLOYEES (notifiedEmployees) ON REJECTION
  try {
    const approverIds = (application.approvals || []).map((s) =>
      String(s.approver),
    );
    const { ids: notifiedIds, docs: notifiedDocs } = await getNotifiedDocs(
      application,
      approverIds,
    );

    if (notifiedIds.length > 0) {
      if (
        typeof NotificationService.notifyTaggedEmployeesOnCtoRejection ===
        "function"
      ) {
        try {
          await NotificationService.notifyTaggedEmployeesOnCtoRejection({
            notifiedIds,
            notifiedEmployees: notifiedDocs,
            employee: application.employee,
            approver,
            ctoApplication: application,
            approvalStep: currentStep,
            remarks: safeRemarks,
          });
        } catch (e) {
          console.error(
            "Failed in-app notify of tagged employees on CTO rejection:",
            e?.message,
          );
        }
      }

      if (rejectionEmailEnabled) {
        await Promise.all(
          notifiedDocs
            .filter((emp) => emp?.email)
            .map((emp) => {
              const tpl = ctoNotifiedRejectionEmail({
                recipientName: fullNameOf(emp),
                employeeName: applicantName,
                requestedHours: application.requestedHours,
                inclusiveDates: application.inclusiveDates,
                rejectedBy: fullNameOf(approver),
                remarks: safeRemarks,
              });
              return safeSendEmail(emp.email, tpl.subject, tpl.html);
            }),
        );
      }
    }
  } catch (e) {
    console.error(
      "Failed notifying tagged employees on CTO rejection:",
      e?.message,
    );
  }

  return getCtoApplicationByIdService(safeAppId);
};

module.exports = {
  fetchPendingCtoCountService,
  getApproverOptionsService,
  getCtoApplicationsForApproverService,
  getCtoApplicationByIdService,
  approveCtoApplicationService,
  rejectCtoApplicationService,
};
