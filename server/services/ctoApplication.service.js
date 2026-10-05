// services/ctoApplication.service.js
const mongoose = require("mongoose");
const CtoApplication = require("../models/ctoApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const ApprovalRoute = require("../models/approvalRouteModel");
const Employee = require("../models/employeeModel");
const CtoCredit = require("../models/ctoCreditModel");
const RevocationSetting = require("../models/revocationSettingModel");
const GeneralSetting = require("../models/generalSettingsModel");

const { resolveApproversFromRoute } = require("./approvalRoute.service");
const sendEmail = require("../utils/sendEmail");
const NotificationService = require("./notificationService");

const EMAIL_KEYS = require("../utils/emailNotificationKeys");
const { isEmailEnabled } = require("../utils/emailNotificationSettings");
const {
  ctoApprovalEmail,
  ctoNotifiedEmail,
  ctoCancelledApproverEmail,
  ctoNotifiedCancelledEmail,
  ctoFollowUpEmail,
  ctoRevocationRequestEmail,
  ctoRevocationCancelledEmail,
  ctoRevocationApprovedEmail,
  ctoRevocationRejectedEmail,
} = require("../utils/emailTemplates");
const { APPROVAL_ROLE_VALUES } = require("../constants/approvalRoles");

const { getRevocationApproverEmails } = require("../utils/getHrEmails");

/* =========================
   Helpers
========================= */
const AUTO_CANCEL_REMARK_REJECT =
  "Auto-cancelled: A previous approver rejected this request.";

const AUTO_CANCEL_REMARK_EMPLOYEE =
  "Auto-cancelled: The employee cancelled this request.";

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

function sanitizeSearch(str, limit = 100) {
  return String(str || "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, limit)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeText(str, limit = 1000) {
  return String(str || "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, limit);
}

function strictNumber(val, fallback = 0) {
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractRemarks(app) {
  if (!app || !Array.isArray(app.approvals)) return app?.revokeReason || "";

  const rejectedStep = app.approvals.find(
    (step) => step.status === "REJECTED" || step.status === "CANCELLED",
  );

  if (rejectedStep && rejectedStep.remarks) {
    return rejectedStep.remarks;
  }

  return app.revokeReason || "";
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

function getWorkingDaysLeadTime(startDate, endDate, activeWorkingDays) {
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  let workingDaysCount = 0;

  if (current >= end) return 0;

  while (current < end) {
    current.setDate(current.getDate() + 1);
    if (activeWorkingDays.includes(current.getDay())) {
      workingDaysCount++;
    }
  }

  return workingDaysCount;
}

async function safeSendEmail(to, subject, html) {
  try {
    await sendEmail(to, subject, html);
  } catch (e) {
    console.error("[EMAIL] failed but continuing:", {
      to,
      subject,
      message: e?.message,
      code: e?.code,
      response: e?.response,
    });
  }
}

async function canSend(key) {
  if (!key) return false;
  return await isEmailEnabled(key);
}

const populateApplicationById = async (applicationId) => {
  assertObjectId(applicationId, "Application ID");

  const app = await CtoApplication.findById(applicationId)
    .populate(
      "employee",
      "prefixTitle firstName middleName lastName nameExtension postfixTitle division position email employeeId signature phone",
    )
    .populate({
      path: "approvals",
      populate: {
        path: "approver",
        select:
          "prefixTitle firstName middleName lastName nameExtension postfixTitle division position email phone",
      },
      options: { sort: { level: 1 } },
    })
    .populate({
      path: "notifiedEmployees",
      select:
        "prefixTitle firstName middleName lastName nameExtension postfixTitle division position email phone",
      strictPopulate: false,
    })
    .populate("memo.memoId", "memoNo uploadedMemo duration totalHours");

  if (app?.memo && Array.isArray(app.memo)) {
    app.memo.forEach((m) => {
      if (m?.memoId?.uploadedMemo) {
        m.memoId.uploadedMemo = m.memoId.uploadedMemo.replace(/\\/g, "/");
      }
    });
  }

  return app;
};

const cancelApprovalSteps = async ({
  applicationId,
  approvalIds,
  reason,
  afterLevel = 0,
}) => {
  await ApprovalStep.updateMany(
    {
      _id: {
        $in: approvalIds,
      },
      status: "PENDING",
      level: {
        $gt: afterLevel,
      },
      ctoApplication: applicationId,
    },
    {
      $set: {
        status: "CANCELLED",
        remarks: reason,
        reviewedAt: new Date(),
      },
    },
  );
};

const restoreMemoHours = async ({ employeeId, memoItems }) => {
  if (!memoItems?.length) return;

  for (const m of memoItems) {
    if (!m?.memoId || !m?.appliedHours) continue;

    const appliedHours = strictNumber(m.appliedHours);
    if (appliedHours <= 0) continue;

    await CtoCredit.updateOne(
      {
        _id: m.memoId,
        employees: {
          $elemMatch: { employee: employeeId },
        },
      },
      {
        $inc: {
          "employees.$.reservedHours": -appliedHours,
          "employees.$.remainingHours": appliedHours,
        },
      },
    );
  }
};

async function notifyApproversOfCancellation({
  application,
  employee,
  approvalIds = [],
}) {
  const approvalSteps = approvalIds.length
    ? await ApprovalStep.find({
        _id: {
          $in: approvalIds,
        },
      })
        .select("approver level status remarks")
        .lean()
    : [];

  const approverIds = [
    ...new Set(
      approvalSteps
        .filter((step) => step?.approver)
        .map((step) => String(step.approver)),
    ),
  ].filter((id) => mongoose.isValidObjectId(id));

  // Only email approvers who have already seen the request:
  // those who approved it + the one it was waiting on.
  // Later-level approvers were never emailed, so they are skipped.
  const orderedSteps = [...approvalSteps].sort(
    (a, b) => Number(a.level || 0) - Number(b.level || 0),
  );
  const waitingStep = orderedSteps.find(
    (s) =>
      s.status === "CANCELLED" && s.remarks === AUTO_CANCEL_REMARK_EMPLOYEE,
  );
  const emailApproverIds = new Set(
    orderedSteps
      .filter(
        (s) =>
          s.status === "APPROVED" ||
          (waitingStep && String(s._id) === String(waitingStep._id)),
      )
      .map((s) => String(s.approver))
      .filter((id) => mongoose.isValidObjectId(id)),
  );

  let emailEnabled = false;
  try {
    emailEnabled = await canSend(
      EMAIL_KEYS.CTO_CANCELLED || EMAIL_KEYS.CTO_APPROVAL,
    );
  } catch (e) {
    console.error("Failed reading CTO cancel email setting:", e?.message);
  }

  const employeeName = fullNameOf(employee);

  // 1. Notify approvers (In-App + SMS to all, Email to those who saw it)
  if (approverIds.length > 0) {
    let approvers = [];
    try {
      approvers = await Employee.find({
        _id: {
          $in: approverIds,
        },
      })
        .select("phone firstName lastName email")
        .lean();

      await NotificationService.notifyApproversOnCtoCancellation({
        approverIds,
        approvers,
        employee,
        ctoApplication: application,
      });
    } catch (e) {
      console.error(
        "Failed creating CTO cancellation notifications for approvers:",
        e?.message || e,
      );
    }

    if (emailEnabled && emailApproverIds.size > 0) {
      try {
        await Promise.all(
          approvers
            .filter((a) => a?.email && emailApproverIds.has(String(a._id)))
            .map((a) => {
              const tpl = ctoCancelledApproverEmail({
                approverName: fullNameOf(a),
                employeeName,
                requestedHours: application.requestedHours,
                inclusiveDates: application.inclusiveDates,
              });
              return safeSendEmail(a.email, tpl.subject, tpl.html);
            }),
        );
      } catch (e) {
        console.error(
          "Failed emailing approvers on CTO cancellation:",
          e?.message || e,
        );
      }
    }
  }

  // 2. Notify passive tagged employees (In-App + SMS + Email)
  //    Skipped entirely when there are no notified employees.
  const approverIdSet = new Set(approverIds);
  const notifiedIds = [
    ...new Set(
      (application?.notifiedEmployees || [])
        .map((item) => String(extractId(item)))
        .filter((id) => mongoose.isValidObjectId(id) && !approverIdSet.has(id)),
    ),
  ];

  if (notifiedIds.length > 0) {
    let notifiedDocs = [];
    try {
      notifiedDocs = await Employee.find({
        _id: {
          $in: notifiedIds,
        },
      })
        .select("phone firstName lastName email")
        .lean();

      if (
        typeof NotificationService.notifyTaggedEmployeesOnCtoCancellation ===
        "function"
      ) {
        await NotificationService.notifyTaggedEmployeesOnCtoCancellation({
          notifiedIds,
          notifiedEmployees: notifiedDocs,
          employee,
          ctoApplication: application,
        });
      } else {
        await NotificationService.notifyApproversOnCtoCancellation({
          approverIds: notifiedIds,
          approvers: notifiedDocs,
          employee,
          ctoApplication: application,
        });
      }
    } catch (e) {
      console.error(
        "Failed creating CTO cancellation notifications for tagged employees:",
        e?.message || e,
      );
    }

    if (emailEnabled) {
      try {
        await Promise.all(
          notifiedDocs
            .filter((doc) => doc?.email)
            .map((doc) => {
              const tpl = ctoNotifiedCancelledEmail({
                recipientName: fullNameOf(doc),
                employeeName,
                requestedHours: application.requestedHours,
                inclusiveDates: application.inclusiveDates,
              });
              return safeSendEmail(doc.email, tpl.subject, tpl.html);
            }),
        );
      } catch (e) {
        console.error(
          "Failed emailing tagged employees on CTO cancellation:",
          e?.message || e,
        );
      }
    }
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

  transactions.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();

    if (dateA === dateB) {
      return (a.sortPriority || 0) - (b.sortPriority || 0);
    }
    return dateA - dateB;
  });

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

const addCtoApplicationService = async ({
  userId,
  requestedHours,
  reason,
  routeId,
  approvers,
  notifiedEmployees,
  inclusiveDates,
  memos,
  employeeType,
  commutation,
  certificationOfLeaveCredits,
  actionDetails,
  lateFiling,
}) => {
  assertObjectId(userId, "User ID");

  const strictReqHours = strictNumber(requestedHours);
  const safeReason = sanitizeText(reason, 1000);

  if (strictReqHours <= 0 || !safeReason || !inclusiveDates?.length) {
    throw createServiceError(
      "Requested hours (>0), reason, and inclusive dates are required.",
      400,
    );
  }

  if (!employeeType) {
    throw createServiceError("Employee type is required.", 400);
  }

  // ==========================================
  // ENFORCE CSC USAGE (AVAILMENT) RULES
  // ==========================================

  // Rule 1: Availed in blocks of 4 or 8 hours
  if (strictReqHours % 4 !== 0) {
    throw createServiceError(
      "Per CSC rules, CTO must be availed in blocks of 4 hours (half day) or 8 hours (full day).",
      400,
    );
  }

  // Rule 2: Maximum of 5 consecutive days (40 hours) per single availment
  if (strictReqHours > 40) {
    throw createServiceError(
      "Per CSC rules, continuous CTO availment cannot exceed 40 hours (5 consecutive days) per application. Please stagger your request.",
      400,
    );
  }

  // ==========================================
  // LATE FILING & COMPUTATION MODE RULE
  // ==========================================
  const settingsDoc = (await GeneralSetting.findOne()) || {};
  const workingDaysEnable = settingsDoc.workingDaysEnable ?? true;
  const workingDaysValue = settingsDoc.workingDaysValue ?? 5;
  const computationMode = settingsDoc.computationMode || "Working Days";

  const activeWorkingDays =
    computationMode === "Calendar Days"
      ? [0, 1, 2, 3, 4, 5, 6]
      : settingsDoc.activeWorkingDays || [1, 2, 3, 4, 5];

  let validatedLateFiling = { isLateFiling: false };

  if (workingDaysEnable) {
    const earliestDate = new Date(
      Math.min(...inclusiveDates.map((d) => new Date(d))),
    );
    const today = new Date();

    const leadTime = getWorkingDaysLeadTime(
      today,
      earliestDate,
      activeWorkingDays,
    );

    if (leadTime < workingDaysValue) {
      if (
        !lateFiling ||
        lateFiling.isLateFiling !== true ||
        !lateFiling.justification?.trim()
      ) {
        const dayTypeLabel =
          computationMode === "Calendar Days"
            ? "calendar day(s)"
            : "working day(s)";
        throw createServiceError(
          "Applications filed with less than " +
            workingDaysValue +
            " " +
            dayTypeLabel +
            " of lead time require a late filing justification. (Your lead time: " +
            leadTime +
            " " +
            dayTypeLabel +
            ")",
          400,
        );
      }

      validatedLateFiling = {
        isLateFiling: true,
        justification: sanitizeText(lateFiling.justification, 1000),
        attachment: lateFiling.attachment || null,
      };
    } else if (lateFiling && lateFiling.isLateFiling) {
      validatedLateFiling = {
        isLateFiling: true,
        justification: sanitizeText(lateFiling.justification, 1000),
        attachment: lateFiling.attachment || null,
      };
    }
  } else if (lateFiling && lateFiling.isLateFiling) {
    validatedLateFiling = {
      isLateFiling: true,
      justification: sanitizeText(lateFiling.justification, 1000),
      attachment: lateFiling.attachment || null,
    };
  }

  // ==========================================
  // EMPLOYEE & DUPLICATE CHECKS
  // ==========================================
  const employee = await Employee.findById(userId).populate("salary").lean();
  if (!employee) {
    throw createServiceError("Employee not found.", 404);
  }

  const isOrganic =
    employee.employeeType === "Organic" ||
    employee.contractType === "Organic" ||
    employeeType === "Organic";

  const existingApplications = await CtoApplication.find({
    employee: userId,
    overallStatus: {
      $in: ["PENDING", "APPROVED"],
    },
    inclusiveDates: {
      $in: inclusiveDates,
    },
  });

  if (existingApplications.length > 0) {
    throw createServiceError(
      "You already have a Pending or Approved CTO application for one or more of the selected dates.",
      400,
    );
  }

  if (isOrganic) {
    if (!commutation || !["Requested", "Not Requested"].includes(commutation)) {
      throw createServiceError(
        "Commutation is required and must be either 'Requested' or 'Not Requested' for Organic employees.",
        400,
      );
    }

    if (!employee.signature) {
      throw createServiceError(
        "A digital signature is required to process CSC Form 6. Please upload your signature in your profile before applying.",
        403,
      );
    }

    if (!employee.salary || typeof employee.salary.amount !== "number") {
      throw createServiceError(
        "Salary Amount information is missing from your profile. This is required for CSC Form 6. Please contact HR.",
        400,
      );
    }
  }

  // ==========================================
  // APPROVERS & NOTIFIED EMPLOYEES
  // ==========================================
  let finalApprovers = [];
  let routeNotifiedIds = [];

  if (routeId) {
    assertObjectId(routeId, "Route ID");
    finalApprovers = await resolveApproversFromRoute(routeId);

    const routeDoc = await ApprovalRoute.findById(routeId)
      .select("notifiedEmployees")
      .lean();
    if (Array.isArray(routeDoc?.notifiedEmployees)) {
      routeNotifiedIds = routeDoc.notifiedEmployees
        .map((item) => extractId(item))
        .filter((id) => mongoose.isValidObjectId(id))
        .map(String);
    }
  } else if (approvers && Array.isArray(approvers)) {
    finalApprovers = approvers
      .map((a) => {
        const approverId = extractId(a?.approver || a);
        if (approverId && mongoose.isValidObjectId(approverId)) {
          return { approver: String(approverId), role: a?.role };
        }
        return { approver: null, role: undefined };
      })
      .filter((a) => a.approver && mongoose.isValidObjectId(a.approver));
  }

  if (!finalApprovers || finalApprovers.length === 0) {
    throw createServiceError(
      "At least one valid approver is required (via route template or custom selection).",
      400,
    );
  }

  for (const fa of finalApprovers) {
    if (!fa.role || !APPROVAL_ROLE_VALUES.includes(fa.role)) {
      throw createServiceError(
        "Invalid or missing approval role for approver ID " +
          fa.approver +
          ". Role must be one of: " +
          APPROVAL_ROLE_VALUES.join(", "),
        400,
      );
    }
  }

  // Safely parse notifiedEmployees (array, JSON string from FormData, or route defaults)
  let parsedNotifiedInput = notifiedEmployees;
  if (typeof parsedNotifiedInput === "string" && parsedNotifiedInput.trim()) {
    try {
      parsedNotifiedInput = JSON.parse(parsedNotifiedInput);
    } catch {
      parsedNotifiedInput = [parsedNotifiedInput.trim()];
    }
  }

  const candidateNotifiedIds = Array.isArray(parsedNotifiedInput)
    ? parsedNotifiedInput.map((item) => extractId(item)).filter(Boolean)
    : routeNotifiedIds;

  for (let i = 0; i < candidateNotifiedIds.length; i++) {
    if (!mongoose.isValidObjectId(candidateNotifiedIds[i])) {
      throw createServiceError(
        "Invalid notified employee ID at position " + (i + 1) + ".",
        400,
      );
    }
  }

  // Exclude the applicant and active approvers from notifiedEmployees
  const excludedIds = new Set([
    String(userId),
    ...finalApprovers.map((a) => String(a.approver)),
  ]);

  const finalNotifiedIds = [
    ...new Set(candidateNotifiedIds.map((id) => String(id))),
  ].filter((id) => !excludedIds.has(id));

  // ==========================================
  // MEMO VALIDATION
  // ==========================================
  if (!memos || !Array.isArray(memos) || !memos.length) {
    throw createServiceError(
      "At least one memo with applied hours must be provided.",
      400,
    );
  }

  const sanitizedMemos = memos.map((m) => {
    const hours = strictNumber(m.appliedHours);
    if (hours <= 0) {
      throw createServiceError("Applied hours must be a positive number.", 400);
    }
    assertObjectId(m.memoId, "Memo ID");
    return { ...m, appliedHours: hours };
  });

  const memoIds = sanitizedMemos.map((m) => m.memoId);

  const credits = await CtoCredit.find({
    _id: {
      $in: memoIds,
    },
    "employees.employee": employee._id,
    status: "CREDITED",
  });

  if (credits.length !== memoIds.length) {
    throw createServiceError("Some memos are invalid or not credited.", 400);
  }

  // ==========================================
  // PERSIST (reserve hours -> steps -> application)
  // Anything that fails here is fully rolled back.
  // ==========================================
  let stage = "reserve-hours";
  let totalAppliedHours = 0;
  const memoUsage = [];
  const rollbackActions = [];

  let newApplication = null;
  let approvalSteps = [];
  let approverEmployees = [];
  let stepsInserted = false;
  let applicationSaved = false;

  try {
    for (const input of sanitizedMemos) {
      const credit = credits.find(
        (c) => String(c._id) === String(input.memoId),
      );

      if (!credit)
        throw createServiceError(
          "Credit not found for memoId " + input.memoId,
          400,
        );

      const empCredit = credit.employees.find(
        (e) => String(e.employee) === String(employee._id),
      );
      if (!empCredit)
        throw createServiceError(
          "Employee credit record not found for memo " + credit.memoNo,
          400,
        );

      const availableHours = strictNumber(empCredit.remainingHours);

      if (input.appliedHours <= 0 || input.appliedHours > availableHours) {
        throw createServiceError(
          "Invalid applied hours for memo " +
            credit.memoNo +
            ". Available: " +
            availableHours,
          400,
        );
      }

      const updateResult = await CtoCredit.updateOne(
        {
          _id: credit._id,
          employees: {
            $elemMatch: {
              employee: employee._id,
              remainingHours: {
                $gte: input.appliedHours,
              },
            },
          },
        },
        {
          $inc: {
            "employees.$.reservedHours": input.appliedHours,
            "employees.$.remainingHours": -input.appliedHours,
          },
          $set: {
            "employees.$.status": empCredit.status || "ACTIVE",
          },
        },
      );

      if (updateResult.modifiedCount === 0) {
        throw createServiceError(
          "Failed to reserve hours for memo " +
            credit.memoNo +
            ". Concurrency mismatch.",
          400,
        );
      }

      rollbackActions.push({
        memoId: credit._id,
        appliedHours: input.appliedHours,
      });

      memoUsage.push({
        memoId: credit._id,
        uploadedMemo: (credit.uploadedMemo || "").replace(/\\/g, "/"),
        appliedHours: input.appliedHours,
      });

      totalAppliedHours += input.appliedHours;
    }

    if (totalAppliedHours !== strictReqHours) {
      throw createServiceError(
        "Sum of applied hours (" +
          totalAppliedHours +
          ") does not match requested hours (" +
          strictReqHours +
          ")",
        400,
      );
    }

    stage = "build-application";

    const applicationPayload = {
      employee: employee._id,
      employeeType,
      applicantSnapshot: {
        prefixTitle: employee.prefixTitle || "",
        firstName: employee.firstName || "",
        middleName: employee.middleName || "",
        lastName: employee.lastName || "",
        nameExtension: employee.nameExtension || "",
        postfixTitle: employee.postfixTitle || "",
        division: employee.division || "",
        position: employee.position || "",
      },
      requestedHours: strictReqHours,
      reason: safeReason,
      inclusiveDates,
      memo: memoUsage,
      notifiedEmployees: finalNotifiedIds,
      overallStatus: "PENDING",
      commutation: commutation || "Not Requested",
      lateFiling: validatedLateFiling,
    };

    if (isOrganic) {
      applicationPayload.applicantSignatureUrl = employee.signature;
      applicationPayload.applicantSnapshot.salaryGrade = employee.salary?.grade;
      applicationPayload.applicantSnapshot.salaryAmount =
        employee.salary?.amount;

      const currentVlDays = employee.balances?.vlDays || 0;
      const currentSlDays = employee.balances?.slDays || 0;

      applicationPayload.certificationOfLeaveCredits = {
        ...(certificationOfLeaveCredits || {}),
        asOfDate: certificationOfLeaveCredits?.asOfDate || new Date(),
        vacationLeave: {
          ...(certificationOfLeaveCredits?.vacationLeave || {}),
          totalEarned: currentVlDays,
          balance: currentVlDays,
        },
        sickLeave: {
          ...(certificationOfLeaveCredits?.sickLeave || {}),
          totalEarned: currentSlDays,
          balance: currentSlDays,
        },
      };
    }

    if (actionDetails) applicationPayload.actionDetails = actionDetails;

    newApplication = new CtoApplication(applicationPayload);

    stage = "build-approval-steps";

    const approverIds = finalApprovers.map((a) => a.approver);

    approverEmployees = await Employee.find({
      _id: {
        $in: approverIds,
      },
    })
      .select(
        "prefixTitle firstName middleName lastName nameExtension postfixTitle position signature phone email",
      )
      .lean();

    const approverMap = new Map(
      approverEmployees.map((emp) => [String(emp._id), emp]),
    );

    approvalSteps = finalApprovers.map((approverObj, index) => {
      const approverData = approverMap.get(String(approverObj.approver));

      return new ApprovalStep({
        level: index + 1,
        approver: approverObj.approver,
        role: approverObj.role,
        status: "PENDING",
        ctoApplication: newApplication._id,

        approverSnapshot: {
          prefixTitle: approverData?.prefixTitle || "",
          firstName: approverData?.firstName || "",
          middleName: approverData?.middleName || "",
          lastName: approverData?.lastName || "",
          nameExtension: approverData?.nameExtension || "",
          postfixTitle: approverData?.postfixTitle || "",
          position: approverData?.position || "",
        },
      });
    });

    newApplication.approvals = approvalSteps.map((step) => step._id);

    // Validate the application BEFORE writing anything else
    stage = "validate-application";
    await newApplication.validate();

    stage = "insert-approval-steps";
    await ApprovalStep.insertMany(approvalSteps);
    stepsInserted = true;

    stage = "save-application";
    await newApplication.save();
    applicationSaved = true;
  } catch (error) {
    console.error(
      '[addCtoApplicationService] failed at stage "' + stage + '":',
      error?.message || error,
    );

    // Undo anything that was written so no half-saved application remains
    if (applicationSaved && newApplication?._id) {
      try {
        await CtoApplication.deleteOne({ _id: newApplication._id });
      } catch (e) {
        console.error(
          "[ROLLBACK FAILED] Could not delete application " +
            newApplication._id +
            ":",
          e?.message,
        );
      }
    }

    if (stepsInserted && approvalSteps.length > 0) {
      try {
        await ApprovalStep.deleteMany({
          _id: { $in: approvalSteps.map((s) => s._id) },
        });
      } catch (e) {
        console.error(
          "[ROLLBACK FAILED] Could not delete approval steps for application " +
            newApplication?._id +
            ":",
          e?.message,
        );
      }
    }

    for (const action of rollbackActions) {
      try {
        await CtoCredit.updateOne(
          {
            _id: action.memoId,
            employees: {
              $elemMatch: { employee: employee._id },
            },
          },
          {
            $inc: {
              "employees.$.reservedHours": -action.appliedHours,
              "employees.$.remainingHours": action.appliedHours,
            },
          },
        );
      } catch (rollbackErr) {
        console.error(
          "[ROLLBACK FAILED] Could not restore " +
            action.appliedHours +
            "h to memo " +
            action.memoId +
            ". Manual intervention may be required! Error:",
          rollbackErr.message,
        );
      }
    }

    throw error;
  }

  // ==========================================
  // SIDE EFFECTS (the application is already saved —
  // nothing below may fail the request)
  // ==========================================
  let populatedApp = null;
  try {
    populatedApp = await populateApplicationById(newApplication._id);
  } catch (err) {
    console.error(
      "[addCtoApplicationService] populate failed (application was saved):",
      err?.message,
    );
    populatedApp = newApplication.toObject();
  }

  const justApproverIds = finalApprovers.map((a) => String(a.approver));

  // 1. Notify active approvers (In-App + SMS)
  try {
    await NotificationService.notifyApproversOnCtoSubmission({
      approverIds: justApproverIds,
      approvers: approverEmployees,
      employee,
      ctoApplication: newApplication,
    });
  } catch (err) {
    console.error(
      "Failed to notify approvers on CTO submission:",
      err?.message,
    );
  }

  // 2. Notify passive tagged employees (In-App + SMS + Email)
  //    Skipped entirely when there are no notified employees.
  if (finalNotifiedIds.length > 0) {
    let notifiedDocs = [];

    try {
      notifiedDocs = await Employee.find({
        _id: {
          $in: finalNotifiedIds,
        },
      })
        .select(
          "prefixTitle firstName middleName lastName nameExtension postfixTitle position phone email",
        )
        .lean();

      if (
        typeof NotificationService.notifyTaggedEmployeesOnCtoSubmission ===
        "function"
      ) {
        await NotificationService.notifyTaggedEmployeesOnCtoSubmission({
          notifiedIds: finalNotifiedIds,
          notifiedEmployees: notifiedDocs,
          employee,
          ctoApplication: newApplication,
        });
      } else {
        await NotificationService.notifyApproversOnCtoSubmission({
          approverIds: finalNotifiedIds,
          approvers: notifiedDocs,
          employee,
          ctoApplication: newApplication,
        });
      }
    } catch (err) {
      console.error(
        "Failed to notify tagged employees on CTO submission:",
        err?.message,
      );
    }

    // Email only those notified employees who actually have an email
    try {
      const recipients = notifiedDocs.filter((doc) => doc?.email);

      if (recipients.length > 0) {
        const emailKey = EMAIL_KEYS.CTO_NOTIFIED || EMAIL_KEYS.CTO_APPROVAL;
        const enabled = await canSend(emailKey);

        if (enabled) {
          await Promise.all(
            recipients.map((doc) => {
              const tpl = ctoNotifiedEmail({
                recipientName: fullNameOf(doc),
                employeeName: fullNameOf(employee),
                requestedHours: strictReqHours,
                inclusiveDates,
                reason: safeReason,
              });
              return safeSendEmail(doc.email, tpl.subject, tpl.html);
            }),
          );
        }
      }
    } catch (err) {
      console.error(
        "Failed to email tagged employees on CTO submission:",
        err?.message,
      );
    }
  }

  // 3. Notify the applicant (In-App + SMS)
  try {
    await NotificationService.notifyEmployeeOnCtoSubmissionCreated({
      employee,
      ctoApplication: newApplication,
    });
  } catch (err) {
    console.error(
      "Failed to notify applicant on CTO submission:",
      err?.message,
    );
  }

  // 4. Email the level-1 approver
  try {
    const firstApproval = approvalSteps.find((a) => a.level === 1);
    const approverUser = firstApproval
      ? await Employee.findById(firstApproval.approver)
          .select("firstName lastName email")
          .lean()
      : null;

    const enabled = await canSend(EMAIL_KEYS.CTO_APPROVAL);

    if (approverUser?.email && enabled) {
      const frontendUrl = process.env.FRONTEND_URL || "";
      const tpl = ctoApprovalEmail({
        approverName: fullNameOf(approverUser),
        employeeName: fullNameOf(employee),
        requestedHours: strictReqHours,
        reason: safeReason,
        level: 1,
        link: frontendUrl + "/app/cto-approvals/" + newApplication._id,
      });

      await safeSendEmail(approverUser.email, tpl.subject, tpl.html);
    } else if (!enabled) {
      console.warn(
        "[addCtoApplicationService] CTO_APPROVAL email is disabled in settings — email not sent.",
      );
    } else if (!approverUser?.email) {
      console.warn(
        "[addCtoApplicationService] Level-1 approver has no email on file — email not sent.",
      );
    }
  } catch (err) {
    console.error("Failed to send CTO approval email:", err?.message);
  }

  return populatedApp;
};

const cancelCtoApplicationService = async ({ userId, applicationId }) => {
  assertObjectId(userId, "User ID");
  assertObjectId(applicationId, "Application ID");

  const app = await CtoApplication.findById(applicationId);
  if (!app) {
    throw createServiceError("Application not found.", 404);
  }

  if (String(app.employee) !== String(userId)) {
    throw createServiceError("Not authorized to cancel this application.", 403);
  }

  if (app.overallStatus !== "PENDING") {
    throw createServiceError(
      "Only PENDING applications can be cancelled.",
      400,
    );
  }

  const employee = await Employee.findById(userId).select(
    "prefixTitle firstName middleName lastName nameExtension postfixTitle email phone",
  );

  app.overallStatus = "CANCELLED";
  await app.save();

  await cancelApprovalSteps({
    applicationId: app._id,
    approvalIds: app.approvals || [],
    reason: AUTO_CANCEL_REMARK_EMPLOYEE,
    afterLevel: 0,
  });

  await restoreMemoHours({
    employeeId: app.employee,
    memoItems: app.memo || [],
  });

  try {
    if (employee) {
      await notifyApproversOfCancellation({
        application: app,
        employee,
        approvalIds: app.approvals || [],
      });
    }
  } catch (err) {
    console.error(
      "Failed to create CTO cancellation notifications:",
      err?.message || err,
    );
  }

  return populateApplicationById(app._id);
};

const followUpCtoApplicationService = async ({ userId, applicationId }) => {
  assertObjectId(userId, "User ID");
  assertObjectId(applicationId, "Application ID");

  const app = await CtoApplication.findById(applicationId)
    .populate("employee", "firstName lastName")
    .populate({
      path: "approvals",
      populate: {
        path: "approver",
        select: "firstName lastName email phone",
      },
      options: { sort: { level: 1 } },
    });

  if (!app) {
    throw createServiceError("Application not found.", 404);
  }

  if (String(app.employee._id) !== String(userId)) {
    throw createServiceError(
      "Not authorized to follow up on this application.",
      403,
    );
  }

  if (app.overallStatus !== "PENDING") {
    throw createServiceError(
      "You can only follow up on PENDING applications.",
      400,
    );
  }

  const currentStep = app.approvals.find((step) => step.status === "PENDING");

  if (!currentStep || !currentStep.approver) {
    throw createServiceError(
      "No pending approver found to follow up with.",
      404,
    );
  }

  const approverUser = currentStep.approver;

  if (!approverUser.email) {
    throw createServiceError(
      "The current approver does not have an email address on file.",
      400,
    );
  }

  const enabled = await canSend(EMAIL_KEYS.CTO_APPROVAL);

  if (enabled) {
    const frontendUrl = process.env.FRONTEND_URL || "";
    const tpl = ctoFollowUpEmail({
      approverName: fullNameOf(approverUser),
      employeeName: fullNameOf(app.employee),
      requestedHours: app.requestedHours,
      level: currentStep.level,
      link: frontendUrl + "/app/cto-approvals/" + app._id,
    });

    await safeSendEmail(approverUser.email, tpl.subject, tpl.html);

    try {
      await NotificationService.notifyApproverOnCtoFollowUp({
        approverId: approverUser._id,
        approver: approverUser,
        employee: app.employee,
        ctoApplication: app,
      });
    } catch (e) {
      console.error(
        "Failed creating CTO follow-up notification:",
        e?.message || e,
      );
    }
  } else {
    throw createServiceError(
      "Email notifications are currently disabled in the system settings.",
      400,
    );
  }

  return { message: "Follow-up notification sent successfully." };
};

const requestRevocationCtoApplicationService = async ({
  userId,
  applicationId,
  reason,
  attachment,
}) => {
  assertObjectId(userId, "User ID");
  assertObjectId(applicationId, "Application ID");

  const setting = await RevocationSetting.findOne();

  const isEnabled = setting
    ? setting.isEnabled !== false && setting.isRevocationEnabled !== false
    : true;
  if (!isEnabled) {
    throw createServiceError(
      "Revocation requests are currently disabled by HR settings.",
      403,
    );
  }

  const fileUrl = attachment?.url || attachment?.fileUrl;

  const isAttachmentRequired = setting ? setting.isAttachmentRequired : false;
  if (isAttachmentRequired && !fileUrl) {
    throw createServiceError(
      "An attachment (e.g., medical certificate or memo) is required to request a revocation.",
      400,
    );
  }

  const safeReason = sanitizeText(reason, 1000);
  if (!safeReason) {
    throw createServiceError(
      "A reason must be provided to request revocation.",
      400,
    );
  }

  const app = await CtoApplication.findById(applicationId);
  if (!app) {
    throw createServiceError("Application not found.", 404);
  }

  if (String(app.employee) !== String(userId)) {
    throw createServiceError("Not authorized to modify this application.", 403);
  }

  if (app.overallStatus !== "APPROVED") {
    throw createServiceError(
      "Only APPROVED applications can be requested for revocation.",
      400,
    );
  }

  app.overallStatus = "REVOCATION_REQUESTED";
  app.revocationRequest = {
    reason: safeReason,
    requestedAt: new Date(),
  };

  if (fileUrl) {
    app.revocationRequest.attachment = {
      fileName:
        sanitizeText(attachment.filename || attachment.fileName, 255) ||
        "Revocation_Attachment",
      fileUrl: sanitizeText(fileUrl, 500),
      fileType: attachment.mimetype || attachment.fileType || "application/pdf",
      uploadedAt: new Date(),
    };
  }

  await app.save();

  try {
    const employee = await Employee.findById(userId).select(
      "firstName lastName phone",
    );
    const hrEmails = await getRevocationApproverEmails();
    let hrIds = [];
    let hrEmployees = [];

    if (hrEmails && hrEmails.length > 0) {
      hrEmployees = await Employee.find({
        email: {
          $in: hrEmails,
        },
      }).select("_id phone firstName lastName");
      hrIds = hrEmployees.map((emp) => emp._id);

      await NotificationService.notifyHrOnCtoRevocationRequest({
        hrIds,
        hrs: hrEmployees,
        employee,
        ctoApplication: app,
      });

      const emailEnabled = await canSend(EMAIL_KEYS.CTO_REVOCATION_REQUEST);
      if (emailEnabled) {
        const frontendUrl = process.env.FRONTEND_URL || "";
        const tpl = ctoRevocationRequestEmail({
          hrName: "HR Team",
          employeeName: fullNameOf(employee),
          requestedHours: app.requestedHours,
          reason: safeReason,
          link: frontendUrl + "/app/leave-revocations/" + app._id,
        });

        const emailPromises = hrEmails.map((hrEmail) =>
          safeSendEmail(hrEmail, tpl.subject, tpl.html),
        );
        await Promise.all(emailPromises);
      }
    }
  } catch (err) {
    console.error(
      "Failed to send CTO revocation request notifications:",
      err?.message,
    );
  }

  return populateApplicationById(app._id);
};

const cancelRevocationCtoRequestService = async ({ userId, applicationId }) => {
  assertObjectId(userId, "User ID");
  assertObjectId(applicationId, "Application ID");

  const session = await mongoose.startSession();
  session.startTransaction();

  let application;

  try {
    application = await CtoApplication.findById(applicationId).session(session);

    if (!application) {
      throw createServiceError("Application not found.", 404);
    }

    if (String(application.employee) !== String(userId)) {
      throw createServiceError(
        "Not authorized to modify this application.",
        403,
      );
    }

    if (application.overallStatus !== "REVOCATION_REQUESTED") {
      throw createServiceError(
        "There is no pending revocation request to cancel.",
        400,
      );
    }

    if (!application.revocationHistory) {
      application.revocationHistory = [];
    }

    application.revocationHistory.push({
      reason: application.revocationRequest.reason,
      attachment: application.revocationRequest.attachment,
      requestedAt: application.revocationRequest.requestedAt,
      status: "CANCELLED",
      processedBy: userId,
      remarks: "Revocation request was withdrawn by the employee.",
      processedAt: new Date(),
    });

    application.overallStatus = "APPROVED";
    application.revocationRequest = undefined;
    application.revokedBy = undefined;
    application.revokeReason = undefined;
    application.revokedAt = undefined;

    await application.save({ session });

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }

  try {
    const employee = await Employee.findById(userId).select(
      "firstName lastName phone",
    );
    const hrEmails = await getRevocationApproverEmails();
    let hrIds = [];
    let hrEmployees = [];

    if (hrEmails && hrEmails.length > 0) {
      hrEmployees = await Employee.find({
        email: {
          $in: hrEmails,
        },
      }).select("_id phone firstName lastName");
      hrIds = hrEmployees.map((emp) => emp._id);

      await NotificationService.notifyHrOnCtoRevocationCancelled({
        hrIds,
        hrs: hrEmployees,
        employee,
        ctoApplication: application,
      });

      const emailEnabled = await canSend(EMAIL_KEYS.CTO_REVOCATION_CANCELLED);
      if (emailEnabled) {
        const tpl = ctoRevocationCancelledEmail({
          hrName: "HR Team",
          employeeName: fullNameOf(employee),
          requestedHours: application.requestedHours,
        });

        const emailPromises = hrEmails.map((hrEmail) =>
          safeSendEmail(hrEmail, tpl.subject, tpl.html),
        );
        await Promise.all(emailPromises);
      }
    }
  } catch (err) {
    console.error(
      "Failed to send CTO revocation cancellation notifications:",
      err?.message,
    );
  }

  return populateApplicationById(application._id);
};

const processRevocationRequestService = async ({
  adminId,
  applicationId,
  action,
  remarks,
}) => {
  assertObjectId(adminId, "Admin ID");
  assertObjectId(applicationId, "Application ID");

  const setting = await RevocationSetting.findOne();
  const isEnabled = setting
    ? setting.isEnabled !== false && setting.isRevocationEnabled !== false
    : true;
  if (!isEnabled) {
    throw createServiceError(
      "Revocation requests are currently disabled by HR settings.",
      403,
    );
  }

  const safeAction = String(action).toUpperCase();
  const safeRemarks =
    sanitizeText(remarks, 1000) ||
    (safeAction === "APPROVE"
      ? "Revocation approved by HR."
      : "Revocation rejected by HR.");

  if (!["APPROVE", "REJECT"].includes(safeAction)) {
    throw createServiceError("Action must be either APPROVE or REJECT.", 400);
  }

  const hrAdmin = await Employee.findById(adminId).select("firstName lastName");

  const session = await mongoose.startSession();
  session.startTransaction();

  let application;

  try {
    application = await CtoApplication.findById(applicationId)
      .populate("employee", "_id firstName lastName email phone balances")
      .session(session);

    if (!application) {
      throw createServiceError("Application not found.", 404);
    }

    if (application.overallStatus !== "REVOCATION_REQUESTED") {
      throw createServiceError(
        "This application does not have a pending revocation request.",
        400,
      );
    }

    if (safeAction === "APPROVE") {
      const employeeId = application.employee._id;
      const requestedHours = strictNumber(application.requestedHours);

      for (const memoItem of application.memo || []) {
        const memoId = memoItem.memoId?._id || memoItem.memoId;
        const appliedHours = strictNumber(memoItem.appliedHours);

        if (!memoId || appliedHours <= 0) continue;

        const creditResult = await CtoCredit.findOneAndUpdate(
          {
            _id: memoId,
            employees: {
              $elemMatch: {
                employee: employeeId,
                usedHours: {
                  $gte: appliedHours,
                },
              },
            },
          },
          {
            $inc: {
              "employees.$.usedHours": -appliedHours,
              "employees.$.remainingHours": appliedHours,
            },
            $set: {
              "employees.$.status": "ACTIVE",
            },
          },
          { session, new: true },
        );

        if (!creditResult) {
          throw createServiceError(
            "Failed to restore credit hours for memo " +
              memoId +
              ". Data mismatch or insufficient used hours.",
            400,
          );
        }
      }

      const updatedEmployee = await Employee.findOneAndUpdate(
        { _id: employeeId },
        {
          $inc: {
            "balances.ctoHours": requestedHours,
          },
        },
        { session, new: true },
      );

      if (!updatedEmployee) {
        throw createServiceError(
          "Employee record not found for balance restoration.",
          400,
        );
      }

      application.overallStatus = "REVOKED";
      application.revokedBy = adminId;
      application.revokeReason = safeRemarks;
      application.revokedAt = new Date();
    } else if (safeAction === "REJECT") {
      if (!application.revocationHistory) {
        application.revocationHistory = [];
      }

      application.revocationHistory.push({
        reason: application.revocationRequest.reason,
        attachment: application.revocationRequest.attachment,
        requestedAt: application.revocationRequest.requestedAt,
        status: "REJECTED",
        processedBy: adminId,
        remarks: safeRemarks,
        processedAt: new Date(),
      });

      application.overallStatus = "APPROVED";
      application.revocationRequest = undefined;
      application.revokedBy = undefined;
      application.revokeReason = undefined;
      application.revokedAt = undefined;
    }

    await application.save({ session });

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }

  try {
    const emp = application.employee;
    if (emp && emp.email) {
      const empName = fullNameOf(emp);
      const requestedHours = strictNumber(application.requestedHours);

      if (safeAction === "APPROVE") {
        await NotificationService.notifyEmployeeOnCtoRevocationApproved({
          employeeId: emp._id,
          employee: emp,
          hrEmployee: hrAdmin,
          ctoApplication: application,
          restoredHours: requestedHours,
        });

        const emailEnabled = await canSend(EMAIL_KEYS.CTO_REVOCATION_APPROVED);
        if (emailEnabled) {
          const tpl = ctoRevocationApprovedEmail({
            employeeName: empName,
            restoredHours: requestedHours,
            remarks: safeRemarks,
          });
          await safeSendEmail(emp.email, tpl.subject, tpl.html);
        }
      } else if (safeAction === "REJECT") {
        await NotificationService.notifyEmployeeOnCtoRevocationRejected({
          employeeId: emp._id,
          employee: emp,
          hrEmployee: hrAdmin,
          ctoApplication: application,
          remarks: safeRemarks,
        });

        const emailEnabled = await canSend(EMAIL_KEYS.CTO_REVOCATION_REJECTED);
        if (emailEnabled) {
          const tpl = ctoRevocationRejectedEmail({
            employeeName: empName,
            remarks: safeRemarks,
          });
          await safeSendEmail(emp.email, tpl.subject, tpl.html);
        }
      }
    }
  } catch (err) {
    console.error(
      "Failed to send CTO revocation process notifications:",
      err?.message,
    );
  }

  return application;
};

const getRevocationRequestsService = async (
  filters = {},
  page = 1,
  limit = 20,
) => {
  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(parseInt(limit) || 20, 100);
  const skip = (page - 1) * limit;

  const baseQuery = {};

  if (filters.status) {
    baseQuery.overallStatus = String(filters.status).toUpperCase();
  } else {
    baseQuery.overallStatus = {
      $in: ["REVOCATION_REQUESTED", "REVOKED"],
    };
  }

  if (filters.employeeId) {
    assertObjectId(filters.employeeId, "Employee ID");
    baseQuery.employee = filters.employeeId;
  }

  if (filters.employeeType) {
    baseQuery.employeeType = filters.employeeType;
  }

  if (filters.from && filters.to) {
    baseQuery["revocationRequest.requestedAt"] = {
      $gte: new Date(filters.from),
      $lte: new Date(filters.to),
    };
  }

  if (filters.search) {
    const safeSearch = sanitizeSearch(filters.search, 100);
    baseQuery["memo.memoId.memoNo"] = {
      $regex: safeSearch,
      $options: "i",
    };
  }

  const [applications, total] = await Promise.all([
    CtoApplication.find(baseQuery)
      .select(
        "requestedHours reason overallStatus approvals notifiedEmployees employee inclusiveDates memo createdAt employeeType commutation applicantSignatureUrl applicantSnapshot certificationOfLeaveCredits revokedBy revokeReason revokedAt revocationRequest lateFiling revocationHistory",
      )
      .populate({
        path: "approvals",
        options: { sort: { level: 1 } },
        populate: {
          path: "approver",
          select:
            "prefixTitle firstName middleName lastName nameExtension postfixTitle division position _id",
        },
      })
      .populate({
        path: "notifiedEmployees",
        select:
          "prefixTitle firstName middleName lastName nameExtension postfixTitle division position _id",
        strictPopulate: false,
      })
      .populate(
        "employee",
        "prefixTitle firstName middleName lastName nameExtension postfixTitle division position _id signature",
      )
      .populate("memo.memoId", "memoNo uploadedMemo totalHours appliedHours")
      .sort({ "revocationRequest.requestedAt": -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CtoApplication.countDocuments(baseQuery),
  ]);

  const transformed = applications.map((app) => {
    const approvals = app.approvals || [];
    return {
      ...app,
      category: app.employeeType,
      approver1: approvals[0]?.approver || null,
      approver2: approvals[1]?.approver || null,
      approver3: approvals[2]?.approver || null,
      remarks: extractRemarks(app),
    };
  });

  const statusAgg = await CtoApplication.aggregate([
    {
      $match: {
        overallStatus: {
          $in: ["REVOCATION_REQUESTED", "REVOKED"],
        },
      },
    },
    {
      $group: {
        _id: "$overallStatus",
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  const statusCounts = {
    REVOCATION_REQUESTED: 0,
    REVOKED: 0,
    total: 0,
  };

  statusAgg.forEach((s) => {
    if (s._id) {
      statusCounts[s._id] = s.count;
      statusCounts.total += s.count;
    }
  });

  return {
    data: transformed,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    statusCounts,
  };
};

const getAllCtoApplicationsService = async (
  filters = {},
  page = 1,
  limit = 20,
) => {
  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(parseInt(limit) || 20, 100);
  const skip = (page - 1) * limit;

  const baseQuery = {};

  if (filters.employeeId) {
    assertObjectId(filters.employeeId, "Employee ID");
    baseQuery.employee = filters.employeeId;
  }

  if (filters.employeeType) {
    baseQuery.employeeType = filters.employeeType;
  }

  if (filters.from && filters.to) {
    baseQuery.createdAt = {
      $gte: new Date(filters.from),
      $lte: new Date(filters.to),
    };
  }

  if (filters.search) {
    const safeSearch = sanitizeSearch(filters.search, 100);
    baseQuery["memo.memoId.memoNo"] = {
      $regex: safeSearch,
      $options: "i",
    };
  }

  const query = { ...baseQuery };
  if (filters.status) {
    query.overallStatus = String(filters.status).toUpperCase();
  }

  const [applications, total] = await Promise.all([
    CtoApplication.find(query)
      .select(
        "requestedHours reason overallStatus approvals notifiedEmployees employee inclusiveDates memo createdAt employeeType commutation applicantSignatureUrl applicantSnapshot certificationOfLeaveCredits revokedBy revokeReason revokedAt revocationRequest lateFiling revocationHistory",
      )
      .populate({
        path: "approvals",
        options: { sort: { level: 1 } },
        populate: {
          path: "approver",
          select:
            "prefixTitle firstName middleName lastName nameExtension postfixTitle division position _id",
        },
      })
      .populate({
        path: "notifiedEmployees",
        select:
          "prefixTitle firstName middleName lastName nameExtension postfixTitle division position _id",
        strictPopulate: false,
      })
      .populate(
        "employee",
        "prefixTitle firstName middleName lastName nameExtension postfixTitle division position _id signature",
      )
      .populate("memo.memoId", "memoNo uploadedMemo totalHours appliedHours")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CtoApplication.countDocuments(query),
  ]);

  const transformed = applications.map((app) => {
    const approvals = app.approvals || [];
    return {
      ...app,
      category: app.employeeType,
      approver1: approvals[0]?.approver || null,
      approver2: approvals[1]?.approver || null,
      approver3: approvals[2]?.approver || null,
      remarks: extractRemarks(app),
    };
  });

  const statusAgg = await CtoApplication.aggregate([
    {
      $match: baseQuery,
    },
    {
      $group: {
        _id: "$overallStatus",
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  const totalAll = await CtoApplication.countDocuments(baseQuery);

  const statusCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
    REVOCATION_REQUESTED: 0,
    REVOKED: 0,
    total: totalAll,
  };

  statusAgg.forEach((s) => {
    if (s._id) statusCounts[s._id] = s.count;
  });

  let ledger = null;
  if (filters.employeeId) {
    ledger = await generateEmployeeLedger(filters.employeeId);
  }

  return {
    data: transformed,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    statusCounts,
    ledger,
  };
};

const getCtoApplicationsByEmployeeService = async (
  employeeId,
  page = 1,
  limit = 20,
  filters = {},
) => {
  assertObjectId(employeeId, "Employee ID");
  const employeeObjectId = new mongoose.Types.ObjectId(employeeId);

  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(parseInt(limit) || 20, 100);
  const skip = (page - 1) * limit;

  const pipeline = [
    {
      $match: { employee: employeeObjectId },
    },
  ];

  if (filters.employeeType) {
    pipeline.push({
      $match: { employeeType: filters.employeeType },
    });
  }

  if (filters.from && filters.to) {
    pipeline.push({
      $match: {
        createdAt: {
          $gte: new Date(filters.from),
          $lte: new Date(filters.to),
        },
      },
    });
  }

  pipeline.push({
    $lookup: {
      from: "ctocredits",
      localField: "memo.memoId",
      foreignField: "_id",
      pipeline: [
        {
          $project: {
            dateApproved: 1,
            createdAt: 1,
            memoNo: 1,
            status: 1,
            employees: 1,
            uploadedMemo: 1,
            duration: 1,
            totalHours: 1,
            inclusiveDates: 1,
            purpose: 1,
          },
        },
      ],
      as: "memoDetails",
    },
  });

  if (filters.search) {
    const safeSearch = sanitizeSearch(filters.search, 100);
    pipeline.push({
      $match: {
        "memoDetails.memoNo": {
          $regex: safeSearch,
          $options: "i",
        },
      },
    });
  }

  const countPipelineStages = [...pipeline];

  if (filters.status) {
    pipeline.push({
      $match: { overallStatus: String(filters.status).toUpperCase() },
    });
  }

  pipeline.push({
    $lookup: {
      from: "approvalsteps",
      localField: "approvals",
      foreignField: "_id",
      pipeline: [
        {
          $lookup: {
            from: "employees",
            localField: "approver",
            foreignField: "_id",
            as: "approver",
          },
        },
        {
          $unwind: {
            path: "$approver",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            level: 1,
            status: 1,
            reviewedAt: 1,
            remarks: 1,
            role: 1,
            approverSignature: 1,
            approverSnapshot: 1,
            approver: {
              _id: "$approver._id",
              prefixTitle: "$approver.prefixTitle",
              firstName: "$approver.firstName",
              middleName: "$approver.middleName",
              lastName: "$approver.lastName",
              nameExtension: "$approver.nameExtension",
              postfixTitle: "$approver.postfixTitle",
              division: "$approver.division",
              position: "$approver.position",
            },
          },
        },
        {
          $sort: { level: 1 },
        },
      ],
      as: "approvals",
    },
  });

  pipeline.push({
    $lookup: {
      from: "employees",
      localField: "notifiedEmployees",
      foreignField: "_id",
      pipeline: [
        {
          $project: {
            _id: 1,
            prefixTitle: 1,
            firstName: 1,
            middleName: 1,
            lastName: 1,
            nameExtension: 1,
            postfixTitle: 1,
            division: 1,
            position: 1,
          },
        },
      ],
      as: "notifiedEmployees",
    },
  });

  pipeline.push({
    $lookup: {
      from: "employees",
      localField: "employee",
      foreignField: "_id",
      as: "employeeDoc",
    },
  });

  pipeline.push({
    $unwind: {
      path: "$employeeDoc",
      preserveNullAndEmptyArrays: true,
    },
  });

  pipeline.push({
    $addFields: {
      employee: {
        _id: "$employeeDoc._id",
        prefixTitle: "$employeeDoc.prefixTitle",
        firstName: "$employeeDoc.firstName",
        middleName: "$employeeDoc.middleName",
        lastName: "$employeeDoc.lastName",
        nameExtension: "$employeeDoc.nameExtension",
        postfixTitle: "$employeeDoc.postfixTitle",
        division: "$employeeDoc.division",
        position: "$employeeDoc.position",
        signature: "$employeeDoc.signature",
      },
    },
  });

  pipeline.push({
    $project: { employeeDoc: 0 },
  });
  pipeline.push({
    $sort: { createdAt: -1 },
  });
  pipeline.push({
    $skip: skip,
  });
  pipeline.push({
    $limit: limit,
  });

  const skipKey = "$" + "skip";
  const limitKey = "$" + "limit";
  const sortKey = "$" + "sort";

  let applications = await CtoApplication.aggregate(pipeline);

  applications = applications.map((app) => {
    app.category = app.employeeType;
    app.remarks = extractRemarks(app);

    if (app.memo && Array.isArray(app.memo)) {
      const memoMap = (app.memoDetails || []).reduce((acc, md) => {
        if (md && md._id) {
          const matchedEmp = Array.isArray(md.employees)
            ? md.employees.find(
                (e) => String(e.employee) === String(employeeId),
              ) || null
            : null;
          const { employees, ...restMemo } = md;
          acc[md._id.toString()] = {
            ...restMemo,
            employee: matchedEmp,
          };
        }
        return acc;
      }, {});

      app.memo = app.memo.map((m) => {
        const memoIdStr = m?.memoId ? m.memoId.toString() : null;
        return {
          ...m,
          memoId: memoMap[memoIdStr] || null,
        };
      });
    }

    delete app.memoDetails;
    return app;
  });

  const countPipeline = [
    ...pipeline.filter(
      (stage) =>
        !(skipKey in stage) && !(limitKey in stage) && !(sortKey in stage),
    ),
    {
      $count: "total",
    },
  ];

  const totalResult = await CtoApplication.aggregate(countPipeline);
  const total = totalResult[0]?.total || 0;

  countPipelineStages.push({
    $group: {
      _id: "$overallStatus",
      count: {
        $sum: 1,
      },
    },
  });

  const statusCountsAgg = await CtoApplication.aggregate(countPipelineStages);
  const totalAll = statusCountsAgg.reduce((acc, curr) => acc + curr.count, 0);

  const statusCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
    REVOCATION_REQUESTED: 0,
    REVOKED: 0,
    total: totalAll,
  };

  statusCountsAgg.forEach((s) => {
    if (s._id) statusCounts[s._id] = s.count;
  });

  const ledger = await generateEmployeeLedger(employeeId);

  return {
    data: applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    statusCounts,
    ledger,
  };
};

const getCtoRevocationByIdService = async (applicationId) => {
  assertObjectId(applicationId, "Application ID");
  const app = await populateApplicationById(applicationId);
  if (!app) {
    throw createServiceError("Application not found.", 404);
  }

  const asOfDate = app.createdAt || new Date();

  const employeeId = app.employee?._id || app.employee;
  const ledger = await generateEmployeeLedger(employeeId, asOfDate);

  const appObj = app.toObject ? app.toObject() : app;
  return {
    ...appObj,
    remarks: extractRemarks(appObj),
    ledger,
  };
};

module.exports = {
  addCtoApplicationService,
  cancelCtoApplicationService,
  getAllCtoApplicationsService,
  getCtoApplicationsByEmployeeService,
  followUpCtoApplicationService,
  requestRevocationCtoApplicationService,
  cancelRevocationCtoRequestService,
  processRevocationRequestService,
  getRevocationRequestsService,
  getCtoRevocationByIdService,
};
