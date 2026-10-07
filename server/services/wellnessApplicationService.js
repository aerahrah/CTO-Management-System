// services/wellnessApplication.service.js
const mongoose = require("mongoose");
const WellnessApplication = require("../models/wellnessApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const ApprovalRoute = require("../models/approvalRouteModel");
const Employee = require("../models/employeeModel");
const RevocationSetting = require("../models/revocationSettingModel");
const GeneralSetting = require("../models/generalSettingsModel");
const { resolveApproversFromRoute } = require("./approvalRoute.service");
const NotificationService = require("./notificationService");
const { APPROVAL_ROLE_VALUES } = require("../constants/approvalRoles");

// NEW: Import the Credit Lifecycle functions
const {
  reserveWellnessDays,
  revertReservedWellnessDays,
} = require("./wellnessCredit.service");

// Email Dependencies
const sendEmail = require("../utils/sendEmail");
const EMAIL_KEYS = require("../utils/emailNotificationKeys");
const { isEmailEnabled } = require("../utils/emailNotificationSettings");
const {
  wellnessApprovalEmail,
  wellnessNotifiedEmail,
  wellnessCancelledApproverEmail,
  wellnessNotifiedCancelledEmail,
  wellnessFollowUpEmail,
  wellnessRevocationRequestEmail,
  wellnessRevocationApprovedEmail,
  wellnessRevocationRejectedEmail,
  wellnessRevocationCancelledEmail,
} = require("../utils/emailTemplates");
const { getRevocationApproverEmails } = require("../utils/getHrEmails");

/* =========================
   Helpers
========================= */

const AUTO_CANCEL_REMARK_EMPLOYEE =
  "Auto-cancelled: The employee cancelled this request.";

function serviceError(message, status = 400) {
  return Object.assign(new Error(message), { status, statusCode: status });
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
    .replace(/[.*+?^\x24{}()|[\]\\]/g, "\\\x24&");
}

function sanitizeText(str, limit = 1000) {
  return String(str || "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, limit);
}

// Comma-separated date list used by the approver/HR templates
function formatDatesList(dates) {
  return (Array.isArray(dates) ? dates : [])
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()))
    .map((d) => d.toLocaleDateString())
    .join(", ");
}

// HELPER: Formats inclusive dates into a short readable string for the ledger
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

// HELPER: Calculate working days difference for late filing
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

const populateApplicationById = async (applicationId, session = null) => {
  return WellnessApplication.findById(applicationId)
    .populate(
      "employee",
      "prefixTitle firstName middleName lastName nameExtension postfixTitle position division email employeeId signature phone",
    )
    .populate({
      path: "approvals",
      populate: {
        path: "approver",
        select:
          "prefixTitle firstName middleName lastName nameExtension postfixTitle position division email phone",
      },
      options: { sort: { level: 1 } },
    })
    .populate({
      path: "notifiedEmployees",
      select:
        "prefixTitle firstName middleName lastName nameExtension postfixTitle position division email phone",
      strictPopulate: false,
    })
    .session(session);
};

const cancelApprovalSteps = async (
  { applicationId, approvalIds, reason, afterLevel = 0 },
  session = null,
) => {
  await ApprovalStep.updateMany(
    {
      _id: {
        $in: approvalIds,
      },
      status: "PENDING",
      level: {
        $gt: afterLevel,
      },
      wellnessApplication: applicationId,
    },
    {
      $set: {
        status: "CANCELLED",
        remarks: reason,
        reviewedAt: new Date(),
      },
    },
    { session },
  );
};

const notifyApproversOfCancellation = async ({
  application,
  employee,
  approvalIds = [],
}) => {
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

  const emailEnabled = await canSend(
    EMAIL_KEYS.WELLNESS_CANCELLED || EMAIL_KEYS.WELLNESS_APPROVAL,
  );
  const employeeName = fullNameOf(employee);

  // 1. Approvers
  if (approverIds.length > 0) {
    let approvers = [];
    try {
      approvers = await Employee.find({ _id: { $in: approverIds } })
        .select("phone firstName lastName email")
        .lean();

      await NotificationService.notifyApproversOnWellnessCancellation({
        approverIds,
        approvers,
        employee,
        wellnessApplication: application,
      });
    } catch (e) {
      console.error(
        "Failed creating Wellness cancellation notifications for approvers:",
        e?.message || e,
      );
    }

    if (emailEnabled && emailApproverIds.size > 0) {
      try {
        await Promise.all(
          approvers
            .filter((a) => a?.email && emailApproverIds.has(String(a._id)))
            .map((a) => {
              const tpl = wellnessCancelledApproverEmail({
                approverName: fullNameOf(a),
                employeeName,
                requestedDays: application.totalDays,
                inclusiveDates: application.inclusiveDates,
              });
              return safeSendEmail(a.email, tpl.subject, tpl.html);
            }),
        );
      } catch (e) {
        console.error(
          "Failed emailing approvers on Wellness cancellation:",
          e?.message || e,
        );
      }
    }
  }

  // 2. Notified employees
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
      notifiedDocs = await Employee.find({ _id: { $in: notifiedIds } })
        .select("phone firstName lastName email")
        .lean();

      if (
        typeof NotificationService.notifyTaggedEmployeesOnWellnessCancellation ===
        "function"
      ) {
        await NotificationService.notifyTaggedEmployeesOnWellnessCancellation({
          notifiedIds,
          notifiedEmployees: notifiedDocs,
          employee,
          wellnessApplication: application,
        });
      } else {
        await NotificationService.notifyApproversOnWellnessCancellation({
          approverIds: notifiedIds,
          approvers: notifiedDocs,
          employee,
          wellnessApplication: application,
        });
      }
    } catch (e) {
      console.error(
        "Failed creating Wellness cancellation notifications for tagged employees:",
        e?.message || e,
      );
    }

    if (emailEnabled) {
      try {
        await Promise.all(
          notifiedDocs
            .filter((doc) => doc?.email)
            .map((doc) => {
              const tpl = wellnessNotifiedCancelledEmail({
                recipientName: fullNameOf(doc),
                employeeName,
                requestedDays: application.totalDays,
                inclusiveDates: application.inclusiveDates,
              });
              return safeSendEmail(doc.email, tpl.subject, tpl.html);
            }),
        );
      } catch (e) {
        console.error(
          "Failed emailing tagged employees on Wellness cancellation:",
          e?.message || e,
        );
      }
    }
  }
};

/* =========================
   Ledger Generator 
========================= */
async function generateEmployeeLedger(employeeId, asOfDate = null) {
  const employee = await Employee.findById(employeeId)
    .select("balances")
    .lean();
  const currentBalance = Number(employee?.balances?.wellnessDays || 0);

  const targetYear = asOfDate
    ? new Date(asOfDate).getFullYear()
    : new Date().getFullYear();
  const startOfYear = new Date(targetYear + "-01-01T00:00:00.000Z");
  const endOfYear = new Date(targetYear + "-12-31T23:59:59.999Z");

  const applications = await WellnessApplication.find({
    employee: employeeId,
    overallStatus: {
      $in: ["APPROVED", "REVOKED", "PENDING", "REVOCATION_REQUESTED"],
    },
    createdAt: {
      $gte: startOfYear,
      $lte: endOfYear,
    },
  }).lean();

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

  const totalCreditedDaysThisYear = currentBalance + totalUsedThisYear;

  let transactions = [];

  applications.forEach((app) => {
    const datesCovered = formatLedgerDates(app.inclusiveDates);
    const descriptionBase = datesCovered
      ? "Wellness Leave (" + datesCovered + ")"
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
        description: descriptionBase + statusSuffix,
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
        description: descriptionBase + " - Revoked",
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

const addWellnessApplicationService = async ({
  userId,
  inclusiveDates,
  reason,
  routeId,
  approvers,
  notifiedEmployees,
  employeeType,
  commutation,
  certificationOfLeaveCredits,
  actionDetails,
  lateFiling,
  req,
}) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw serviceError("Invalid User ID format.", 400);
  }

  const finalReason = sanitizeText(
    reason || "Availment of Wellness Leave",
    1000,
  );

  if (
    !inclusiveDates ||
    !Array.isArray(inclusiveDates) ||
    inclusiveDates.length === 0
  ) {
    throw serviceError("Inclusive dates array is required.", 400);
  }

  const totalDays = inclusiveDates.length;

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
        throw serviceError(
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

  const employee = await Employee.findById(userId).populate("salary").lean();
  if (!employee) {
    throw serviceError("Employee not found.", 404);
  }

  const existingApplications = await WellnessApplication.find({
    employee: userId,
    overallStatus: {
      $in: ["PENDING", "APPROVED"],
    },
    inclusiveDates: {
      $in: inclusiveDates,
    },
  });

  if (existingApplications.length > 0) {
    throw serviceError(
      "You already have a Pending or Approved Wellness Leave application for one or more of the selected dates.",
      400,
    );
  }

  const finalEmployeeType = employeeType || employee.employeeType || "Organic";
  const isOrganic = finalEmployeeType === "Organic";

  if (isOrganic) {
    if (!commutation || !["Requested", "Not Requested"].includes(commutation)) {
      throw serviceError(
        "Commutation is required and must be either 'Requested' or 'Not Requested' for Organic employees.",
        400,
      );
    }

    if (!employee.signature) {
      throw serviceError(
        "A digital signature is required to process CSC Form 6. Please upload your signature in your profile before applying.",
        403,
      );
    }

    if (!employee.salary || typeof employee.salary.amount !== "number") {
      throw serviceError(
        "Salary Amount information is missing from your profile. This is required for CSC Form 6. Please contact HR.",
        400,
      );
    }
  }

  let finalApprovers = [];
  let routeNotifiedIds = [];

  if (routeId) {
    if (!mongoose.isValidObjectId(routeId)) {
      throw serviceError("Invalid Route ID format.", 400);
    }
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
    throw serviceError(
      "At least one valid approver is required (via route template or custom selection).",
      400,
    );
  }

  for (const fa of finalApprovers) {
    if (!fa.role || !APPROVAL_ROLE_VALUES.includes(fa.role)) {
      throw serviceError(
        "Invalid or missing approval role for approver ID " +
          fa.approver +
          ". Role must be one of: " +
          APPROVAL_ROLE_VALUES.join(", "),
        400,
      );
    }
  }

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
      throw serviceError(
        "Invalid notified employee ID at position " + (i + 1) + ".",
        400,
      );
    }
  }

  const excludedIds = new Set([
    String(userId),
    ...finalApprovers.map((a) => String(a.approver)),
  ]);

  const finalNotifiedIds = [
    ...new Set(candidateNotifiedIds.map((id) => String(id))),
  ].filter((id) => !excludedIds.has(id));

  let newApplication;
  let approvalSteps = [];
  let approverMap = new Map();

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const currentWellnessBalance = employee.balances?.wellnessDays || 0;
    if (currentWellnessBalance < totalDays) {
      throw serviceError(
        "Insufficient Wellness Leave balance. Available: " +
          currentWellnessBalance,
        400,
      );
    }

    const updatedEmployee = await Employee.findOneAndUpdate(
      {
        _id: userId,
        "balances.wellnessDays": {
          $gte: totalDays,
        },
      },
      {
        $inc: {
          "balances.wellnessDays": -totalDays,
        },
      },
      { new: true, session },
    );

    if (!updatedEmployee) {
      throw serviceError(
        "Failed to deduct Wellness Leave balance. Please try again. Possible concurrency conflict.",
        400,
      );
    }

    // NEW: Trigger the exact batch deduction & reservation
    await reserveWellnessDays(userId, totalDays, session);

    const applicationPayload = {
      employee: employee._id,
      employeeType: finalEmployeeType,
      applicantSnapshot: {
        prefixTitle: employee.prefixTitle || "",
        firstName: employee.firstName || "",
        middleName: employee.middleName || "",
        lastName: employee.lastName || "",
        nameExtension: employee.nameExtension || "",
        postfixTitle: employee.postfixTitle || "",
        position: employee.position || "",
        division: employee.division || "",
        wellnessBalance: currentWellnessBalance,
      },
      inclusiveDates,
      totalDays,
      reason: finalReason,
      notifiedEmployees: finalNotifiedIds,
      overallStatus: "PENDING",
      lateFiling: validatedLateFiling,
    };

    if (isOrganic) {
      applicationPayload.commutation = commutation || "Not Requested";
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

      if (actionDetails) {
        applicationPayload.actionDetails = actionDetails;
      }
    }

    newApplication = new WellnessApplication(applicationPayload);

    const approverProfiles = await Employee.find({
      _id: {
        $in: finalApprovers.map((a) => a.approver),
      },
    })
      .select(
        "prefixTitle firstName middleName lastName nameExtension postfixTitle position email phone",
      )
      .session(session)
      .lean();

    approverMap = new Map(approverProfiles.map((a) => [String(a._id), a]));

    const stepDocs = finalApprovers.map((approverObj, index) => {
      const approverProfile = approverMap.get(String(approverObj.approver));

      return {
        _id: new mongoose.Types.ObjectId(),
        level: index + 1,
        approver: approverObj.approver,
        role: approverObj.role,
        status: "PENDING",
        wellnessApplication: newApplication._id,

        approverSnapshot: {
          prefixTitle: approverProfile?.prefixTitle || "",
          firstName: approverProfile?.firstName || "",
          middleName: approverProfile?.middleName || "",
          lastName: approverProfile?.lastName || "",
          nameExtension: approverProfile?.nameExtension || "",
          postfixTitle: approverProfile?.postfixTitle || "",
          position: approverProfile?.position || "",

          signatureUrl: null,
          signedAt: null,
        },
      };
    });

    approvalSteps = await ApprovalStep.insertMany(stepDocs, { session });

    newApplication.approvals = approvalSteps.map((step) => step._id);
    await newApplication.save({ session });

    await session.commitTransaction();
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    session.endSession();
  }

  let populatedApp = null;
  try {
    populatedApp = await populateApplicationById(newApplication._id);
  } catch (err) {
    console.error(
      "[addWellnessApplicationService] populate failed (application was saved):",
      err?.message,
    );
    populatedApp = newApplication.toObject();
  }

  const applicantName = fullNameOf(employee);
  const formattedDates = formatDatesList(inclusiveDates);
  const frontendUrl = process.env.FRONTEND_URL || "";

  const firstStep = approvalSteps.find((s) => s.level === 1);
  if (firstStep) {
    try {
      await NotificationService.notifyApproverOnWellnessSubmission({
        approverId: firstStep.approver,
        approver: approverMap.get(String(firstStep.approver)),
        employee,
        wellnessApplication: populatedApp,
        totalDays,
      });
    } catch (e) {
      console.error(
        "Failed creating Wellness submission notification:",
        e?.message || e,
      );
    }

    try {
      const emailEnabled = await canSend(EMAIL_KEYS.WELLNESS_APPROVAL);
      const approverUser = approverMap.get(String(firstStep.approver));

      if (approverUser?.email && emailEnabled) {
        const tpl = wellnessApprovalEmail({
          approverName: fullNameOf(approverUser),
          employeeName: applicantName,
          requestedDays: totalDays,
          inclusiveDates: formattedDates,
          reason: finalReason,
          level: 1,
          link: frontendUrl + "/app/wellness-approvals/" + newApplication._id,
        });

        await safeSendEmail(approverUser.email, tpl.subject, tpl.html);
      }
    } catch (err) {
      console.error("Failed to send Wellness approval email:", err?.message);
    }
  }

  if (finalNotifiedIds.length > 0) {
    let notifiedDocs = [];

    try {
      notifiedDocs = await Employee.find({
        _id: {
          $in: finalNotifiedIds,
        },
      })
        .select(
          "prefixTitle firstName middleName lastName nameExtension postfixTitle position email phone",
        )
        .lean();

      if (
        typeof NotificationService.notifyTaggedEmployeesOnWellnessSubmission ===
        "function"
      ) {
        await NotificationService.notifyTaggedEmployeesOnWellnessSubmission({
          notifiedIds: finalNotifiedIds,
          notifiedEmployees: notifiedDocs,
          employee,
          wellnessApplication: populatedApp,
          totalDays,
        });
      } else {
        await Promise.all(
          notifiedDocs.map((notifiedEmp) =>
            NotificationService.notifyApproverOnWellnessSubmission({
              approverId: notifiedEmp._id,
              approver: notifiedEmp,
              employee,
              wellnessApplication: populatedApp,
              totalDays,
            }),
          ),
        );
      }
    } catch (e) {
      console.error(
        "Failed notifying tagged employees on Wellness submission:",
        e?.message || e,
      );
    }

    try {
      const recipients = notifiedDocs.filter((doc) => doc?.email);

      if (recipients.length > 0) {
        const enabled = await canSend(
          EMAIL_KEYS.WELLNESS_NOTIFIED || EMAIL_KEYS.WELLNESS_APPROVAL,
        );

        if (enabled) {
          await Promise.all(
            recipients.map((doc) => {
              const tpl = wellnessNotifiedEmail({
                recipientName: fullNameOf(doc),
                employeeName: applicantName,
                requestedDays: totalDays,
                inclusiveDates,
                reason: finalReason,
              });
              return safeSendEmail(doc.email, tpl.subject, tpl.html);
            }),
          );
        }
      }
    } catch (e) {
      console.error(
        "Failed emailing tagged employees on Wellness submission:",
        e?.message || e,
      );
    }
  }

  return populatedApp;
};

const followUpWellnessApplicationService = async ({
  userId,
  applicationId,
}) => {
  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(applicationId)
  ) {
    throw serviceError("Invalid ID format.", 400);
  }

  const app = await WellnessApplication.findById(applicationId)
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
    throw serviceError("Application not found.", 404);
  }

  if (String(app.employee._id) !== String(userId)) {
    throw serviceError("Not authorized to follow up on this application.", 403);
  }

  if (app.overallStatus !== "PENDING") {
    throw serviceError("You can only follow up on PENDING applications.", 400);
  }

  const currentStep = app.approvals.find((step) => step.status === "PENDING");

  if (!currentStep || !currentStep.approver) {
    throw serviceError("No pending approver found to follow up with.", 404);
  }

  const approverUser = currentStep.approver;

  if (!approverUser.email) {
    throw serviceError(
      "The current approver does not have an email address on file.",
      400,
    );
  }

  const enabled = await canSend(EMAIL_KEYS.WELLNESS_APPROVAL);

  if (enabled) {
    const frontendUrl = process.env.FRONTEND_URL || "";
    const tpl = wellnessFollowUpEmail({
      approverName: fullNameOf(approverUser),
      employeeName: fullNameOf(app.employee),
      requestedDays: app.totalDays,
      level: currentStep.level,
      link: frontendUrl + "/app/wellness-approvals/" + app._id,
    });

    await safeSendEmail(approverUser.email, tpl.subject, tpl.html);

    try {
      await NotificationService.notifyApproverOnWellnessFollowUp({
        approverId: approverUser._id,
        approver: approverUser,
        employee: app.employee,
        wellnessApplication: app,
      });
    } catch (e) {
      console.error(
        "Failed creating Wellness follow-up notification:",
        e?.message || e,
      );
    }
  } else {
    throw serviceError(
      "Email notifications are currently disabled in the system settings.",
      400,
    );
  }

  return { message: "Follow-up notification sent successfully." };
};

const getAllWellnessApplicationsService = async (
  filters = {},
  page = 1,
  limit = 20,
) => {
  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(parseInt(limit) || 20, 100);
  const skip = (page - 1) * limit;

  const baseQuery = {};

  if (filters.employeeId) {
    if (!mongoose.isValidObjectId(filters.employeeId)) {
      throw serviceError("Invalid Employee ID format.", 400);
    }
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
    const employeeIds = await Employee.find({
      $or: [
        { firstName: { $regex: safeSearch, $options: "i" } },
        { lastName: { $regex: safeSearch, $options: "i" } },
        { employeeId: { $regex: safeSearch, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();

    baseQuery.employee = {
      $in: employeeIds.map((e) => e._id),
    };
  }

  const query = { ...baseQuery };
  if (filters.status) {
    query.overallStatus = String(filters.status).toUpperCase();
  }

  const [applications, total] = await Promise.all([
    WellnessApplication.find(query)
      .select(
        "totalDays reason overallStatus approvals notifiedEmployees employee inclusiveDates createdAt employeeType commutation applicantSignatureUrl applicantSnapshot certificationOfLeaveCredits revokedBy revokeReason revokedAt revocationRequest lateFiling memo revocationHistory",
      )
      .populate(
        "employee",
        "prefixTitle firstName middleName lastName nameExtension postfixTitle position division email employeeId signature phone",
      )
      .populate({
        path: "approvals",
        populate: {
          path: "approver",
          select:
            "prefixTitle firstName middleName lastName nameExtension postfixTitle position division email _id phone",
        },
        options: { sort: { level: 1 } },
      })
      .populate({
        path: "notifiedEmployees",
        select:
          "prefixTitle firstName middleName lastName nameExtension postfixTitle position division email _id phone",
        strictPopulate: false,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WellnessApplication.countDocuments(query),
  ]);

  const transformed = applications.map((app) => {
    const approvals = app.approvals || [];
    return {
      ...app,
      category: app.employeeType,
      approver1: approvals[0]?.approver || null,
      approver2: approvals[1]?.approver || null,
      approver3: approvals[2]?.approver || null,
    };
  });

  const statusAgg = await WellnessApplication.aggregate([
    { $match: baseQuery },
    { $group: { _id: "$overallStatus", count: { $sum: 1 } } },
  ]);

  const totalAll = await WellnessApplication.countDocuments(baseQuery);

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

const getWellnessApplicationsByEmployeeService = async (
  employeeId,
  page = 1,
  limit = 20,
  filters = {},
) => {
  if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
    throw serviceError("Invalid Employee ID", 400);
  }

  const employeeObjectId = new mongoose.Types.ObjectId(employeeId);
  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(parseInt(limit) || 20, 100);
  const skip = (page - 1) * limit;

  const pipeline = [{ $match: { employee: employeeObjectId } }];

  if (filters.employeeType) {
    pipeline.push({ $match: { employeeType: filters.employeeType } });
  }

  if (filters.status) {
    pipeline.push({
      $match: { overallStatus: String(filters.status).toUpperCase() },
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

  if (filters.search) {
    const safeSearch = sanitizeSearch(filters.search, 100);
    pipeline.push({
      $match: { reason: { $regex: safeSearch, $options: "i" } },
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
          $unwind: { path: "$approver", preserveNullAndEmptyArrays: true },
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
              position: "$approver.position",
              division: "$approver.division",
              email: "$approver.email",
              phone: "$approver.phone",
            },
          },
        },
        { $sort: { level: 1 } },
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
            position: 1,
            division: 1,
            email: 1,
            phone: 1,
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
    $unwind: { path: "$employeeDoc", preserveNullAndEmptyArrays: true },
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
        position: "$employeeDoc.position",
        division: "$employeeDoc.division",
        email: "$employeeDoc.email",
        phone: "$employeeDoc.phone",
        signature: "$employeeDoc.signature",
      },
    },
  });

  pipeline.push({ $project: { employeeDoc: 0 } });
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  const skipKey = "\x24skip";
  const limitKey = "\x24limit";
  const sortKey = "\x24sort";

  let applications = await WellnessApplication.aggregate(pipeline);

  applications = applications.map((app) => {
    app.category = app.employeeType;
    return app;
  });

  const countPipeline = [
    ...pipeline.filter(
      (stage) =>
        !(skipKey in stage) && !(limitKey in stage) && !(sortKey in stage),
    ),
    { $count: "total" },
  ];

  const totalResult = await WellnessApplication.aggregate(countPipeline);
  const total = totalResult[0]?.total || 0;

  const statusCountsAgg = await WellnessApplication.aggregate([
    { $match: { employee: employeeObjectId } },
    { $group: { _id: "$overallStatus", count: { $sum: 1 } } },
  ]);

  const totalAll = await WellnessApplication.countDocuments({
    employee: employeeObjectId,
  });

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

const cancelWellnessApplicationService = async ({
  userId,
  applicationId,
  req,
}) => {
  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(applicationId)
  ) {
    throw serviceError("Invalid ID format.", 400);
  }

  let application;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    application = await WellnessApplication.findOne({
      _id: applicationId,
      employee: userId,
    }).session(session);

    if (!application) {
      throw serviceError("Application not found or unauthorized.", 404);
    }

    if (application.overallStatus !== "PENDING") {
      throw serviceError(
        "Cannot cancel a " + application.overallStatus + " application.",
        400,
      );
    }

    await Employee.updateOne(
      { _id: userId },
      {
        $inc: {
          "balances.wellnessDays": application.totalDays,
        },
      },
      { session },
    );

    // NEW: Revert reserved days for this cancelled request
    await revertReservedWellnessDays(userId, application.totalDays, session);

    application.overallStatus = "CANCELLED";
    await application.save({ session });

    await cancelApprovalSteps(
      {
        applicationId,
        approvalIds: application.approvals,
        reason: AUTO_CANCEL_REMARK_EMPLOYEE,
        afterLevel: 0,
      },
      session,
    );

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
  try {
    const employee = await Employee.findById(userId)
      .select("firstName lastName phone email")
      .lean();

    await notifyApproversOfCancellation({
      application,
      employee,
      approvalIds: application.approvals || [],
    });
  } catch (err) {
    console.error(
      "Failed to send Wellness cancellation notifications:",
      err?.message || err,
    );
  }

  return populateApplicationById(applicationId);
};

const requestRevocationWellnessApplicationService = async ({
  userId,
  applicationId,
  reason,
  attachment,
}) => {
  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(applicationId)
  ) {
    throw serviceError("Invalid ID format.", 400);
  }

  const setting = await RevocationSetting.findOne();
  const isEnabled = setting
    ? setting.isEnabled !== false && setting.isRevocationEnabled !== false
    : true;

  if (!isEnabled) {
    throw serviceError(
      "Revocation requests are currently disabled by HR settings.",
      403,
    );
  }

  const fileUrl = attachment?.url || attachment?.fileUrl;

  const isAttachmentRequired = setting ? setting.isAttachmentRequired : false;
  if (isAttachmentRequired && !fileUrl) {
    throw serviceError(
      "An attachment (e.g., medical certificate or memo) is required to request a revocation.",
      400,
    );
  }

  const safeReason = sanitizeText(reason, 1000);
  if (!safeReason) {
    throw serviceError("A reason must be provided to request revocation.", 400);
  }

  const app = await WellnessApplication.findById(applicationId);
  if (!app) {
    throw serviceError("Application not found.", 404);
  }

  if (String(app.employee) !== String(userId)) {
    throw serviceError("Not authorized to modify this application.", 403);
  }

  if (app.overallStatus !== "APPROVED") {
    throw serviceError(
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

    if (hrEmails && hrEmails.length > 0) {
      const hrEmployees = await Employee.find({
        email: { $in: hrEmails },
      }).select("_id phone firstName lastName");
      const hrIds = hrEmployees.map((emp) => emp._id);

      await NotificationService.notifyHrOnWellnessRevocationRequest({
        hrIds,
        hrs: hrEmployees,
        employee,
        wellnessApplication: app,
      });

      const emailEnabled = await canSend(
        EMAIL_KEYS.WELLNESS_REVOCATION_REQUEST,
      );
      if (emailEnabled) {
        const frontendUrl = process.env.FRONTEND_URL || "";
        const tpl = wellnessRevocationRequestEmail({
          hrName: "HR Team",
          employeeName: fullNameOf(employee),
          requestedDays: app.totalDays,
          inclusiveDates: formatDatesList(app.inclusiveDates),
          reason: safeReason,
          link:
            frontendUrl +
            "/app/leave-revocations/" +
            app._id +
            "?type=WELLNESS",
        });

        await Promise.all(
          hrEmails.map((hrEmail) =>
            safeSendEmail(hrEmail, tpl.subject, tpl.html),
          ),
        );
      }
    }
  } catch (err) {
    console.error(
      "Failed to send Wellness revocation request notifications:",
      err?.message,
    );
  }

  return populateApplicationById(app._id);
};

const processRevocationWellnessRequestService = async ({
  adminId,
  applicationId,
  action,
  remarks,
}) => {
  if (
    !mongoose.isValidObjectId(adminId) ||
    !mongoose.isValidObjectId(applicationId)
  ) {
    throw serviceError("Invalid ID format.", 400);
  }

  const setting = await RevocationSetting.findOne();
  const isEnabled = setting
    ? setting.isEnabled !== false && setting.isRevocationEnabled !== false
    : true;

  if (!isEnabled) {
    throw serviceError(
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
    throw serviceError("Action must be either APPROVE or REJECT.", 400);
  }

  const hrAdmin = await Employee.findById(adminId).select("firstName lastName");

  let application;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    application = await WellnessApplication.findById(applicationId)
      .populate("employee", "_id firstName lastName email balances phone")
      .session(session);

    if (!application) {
      throw serviceError("Application not found.", 404);
    }

    if (application.overallStatus !== "REVOCATION_REQUESTED") {
      throw serviceError(
        "This application does not have a pending revocation request.",
        400,
      );
    }

    if (safeAction === "APPROVE") {
      const employeeId = application.employee._id;
      const totalDays = application.totalDays;

      const updatedEmployee = await Employee.findOneAndUpdate(
        { _id: employeeId },
        { $inc: { "balances.wellnessDays": totalDays } },
        { session, new: true },
      );

      if (!updatedEmployee) {
        throw serviceError(
          "Employee record not found for balance restoration.",
          400,
        );
      }

      // NEW: If HR approves the revocation, refund the used days back to remainingDays
      await revertReservedWellnessDays(employeeId, totalDays, session);

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
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    session.endSession();
  }

  try {
    const emp = application.employee;
    if (emp && emp.email) {
      const empName = fullNameOf(emp);

      if (safeAction === "APPROVE") {
        await NotificationService.notifyEmployeeOnWellnessRevocationApproved({
          employeeId: emp._id,
          employee: emp,
          hrEmployee: hrAdmin,
          wellnessApplication: application,
          restoredDays: application.totalDays,
        });

        const emailEnabled = await canSend(
          EMAIL_KEYS.WELLNESS_REVOCATION_APPROVED,
        );
        if (emailEnabled) {
          const tpl = wellnessRevocationApprovedEmail({
            employeeName: empName,
            restoredDays: application.totalDays,
            inclusiveDates: formatDatesList(application.inclusiveDates),
            remarks: safeRemarks,
          });
          await safeSendEmail(emp.email, tpl.subject, tpl.html);
        }
      } else if (safeAction === "REJECT") {
        await NotificationService.notifyEmployeeOnWellnessRevocationRejected({
          employeeId: emp._id,
          employee: emp,
          hrEmployee: hrAdmin,
          wellnessApplication: application,
          remarks: safeRemarks,
        });

        const emailEnabled = await canSend(
          EMAIL_KEYS.WELLNESS_REVOCATION_REJECTED,
        );
        if (emailEnabled) {
          const tpl = wellnessRevocationRejectedEmail({
            employeeName: empName,
            remarks: safeRemarks,
          });
          await safeSendEmail(emp.email, tpl.subject, tpl.html);
        }
      }
    }
  } catch (err) {
    console.error(
      "Failed to send Wellness revocation process notifications:",
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
    if (!mongoose.isValidObjectId(filters.employeeId)) {
      throw serviceError("Invalid Employee ID format.", 400);
    }
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
    const employeeIds = await Employee.find({
      $or: [
        { firstName: { $regex: safeSearch, $options: "i" } },
        { lastName: { $regex: safeSearch, $options: "i" } },
        { employeeId: { $regex: safeSearch, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();

    baseQuery.employee = {
      $in: employeeIds.map((e) => e._id),
    };
  }

  const [applications, total] = await Promise.all([
    WellnessApplication.find(baseQuery)
      .select(
        "totalDays reason overallStatus approvals notifiedEmployees employee inclusiveDates createdAt employeeType commutation applicantSignatureUrl applicantSnapshot certificationOfLeaveCredits revokedBy revokeReason revokedAt revocationRequest lateFiling memo revocationHistory",
      )
      .populate(
        "employee",
        "prefixTitle firstName middleName lastName nameExtension postfixTitle position division email employeeId signature phone",
      )
      .populate({
        path: "approvals",
        options: { sort: { level: 1 } },
        populate: {
          path: "approver",
          select:
            "prefixTitle firstName middleName lastName nameExtension postfixTitle position division email _id phone",
        },
      })
      .populate({
        path: "notifiedEmployees",
        select:
          "prefixTitle firstName middleName lastName nameExtension postfixTitle position division email _id phone",
        strictPopulate: false,
      })
      .sort({ "revocationRequest.requestedAt": -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WellnessApplication.countDocuments(baseQuery),
  ]);

  const transformed = applications.map((app) => {
    const approvals = app.approvals || [];
    return {
      ...app,
      category: app.employeeType,
      approver1: approvals[0]?.approver || null,
      approver2: approvals[1]?.approver || null,
      approver3: approvals[2]?.approver || null,
    };
  });

  const statusAgg = await WellnessApplication.aggregate([
    {
      $match: {
        overallStatus: { $in: ["REVOCATION_REQUESTED", "REVOKED"] },
      },
    },
    { $group: { _id: "$overallStatus", count: { $sum: 1 } } },
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

const getWellnessRevocationByIdService = async (applicationId) => {
  if (!mongoose.isValidObjectId(applicationId)) {
    throw serviceError("Invalid Application ID format.", 400);
  }
  const app = await populateApplicationById(applicationId);
  if (!app) {
    throw serviceError("Application not found.", 404);
  }

  const asOfDate = app.createdAt || new Date();
  const employeeId = app.employee?._id || app.employee;
  const ledger = await generateEmployeeLedger(employeeId, asOfDate);

  const appObj = app.toObject ? app.toObject() : app;
  return {
    ...appObj,
    ledger,
  };
};

const cancelRevocationWellnessRequestService = async ({
  userId,
  applicationId,
}) => {
  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(applicationId)
  ) {
    throw serviceError("Invalid ID format.", 400);
  }

  let application;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    application =
      await WellnessApplication.findById(applicationId).session(session);

    if (!application) {
      throw serviceError("Application not found.", 404);
    }

    if (String(application.employee) !== String(userId)) {
      throw serviceError("Not authorized to modify this application.", 403);
    }

    if (application.overallStatus !== "REVOCATION_REQUESTED") {
      throw serviceError(
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
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    session.endSession();
  }

  try {
    const employee = await Employee.findById(userId).select(
      "firstName lastName phone",
    );
    const hrEmails = await getRevocationApproverEmails();

    if (hrEmails && hrEmails.length > 0) {
      const hrEmployees = await Employee.find({
        email: { $in: hrEmails },
      }).select("_id phone firstName lastName");
      const hrIds = hrEmployees.map((emp) => emp._id);

      await NotificationService.notifyHrOnWellnessRevocationCancelled({
        hrIds,
        hrs: hrEmployees,
        employee,
        wellnessApplication: application,
      });

      const emailEnabled = await canSend(
        EMAIL_KEYS.WELLNESS_REVOCATION_CANCELLED,
      );
      if (emailEnabled) {
        const tpl = wellnessRevocationCancelledEmail({
          hrName: "HR Team",
          employeeName: fullNameOf(employee),
          requestedDays: application.totalDays,
          inclusiveDates: formatDatesList(application.inclusiveDates),
        });

        await Promise.all(
          hrEmails.map((hrEmail) =>
            safeSendEmail(hrEmail, tpl.subject, tpl.html),
          ),
        );
      }
    }
  } catch (err) {
    console.error(
      "Failed to send Wellness revocation cancellation notifications:",
      err?.message,
    );
  }

  return populateApplicationById(application._id);
};

module.exports = {
  addWellnessApplicationService,
  followUpWellnessApplicationService,
  getAllWellnessApplicationsService,
  getWellnessApplicationsByEmployeeService,
  cancelWellnessApplicationService,
  populateApplicationById,
  requestRevocationWellnessApplicationService,
  processRevocationWellnessRequestService,
  getRevocationRequestsService,
  getWellnessRevocationByIdService,
  cancelRevocationWellnessRequestService,
};
