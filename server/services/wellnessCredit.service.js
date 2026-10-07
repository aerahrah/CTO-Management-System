// services/wellnessCredit.service.js
const mongoose = require("mongoose");
const WellnessCredit = require("../models/wellnessCreditModel");
const Employee = require("../models/employeeModel");
const NotificationService = require("./notificationService");

const sendEmail = require("../utils/sendEmail");
const {
  wellnessCreditAddedEmail,
  wellnessCreditRolledBackEmail,
} = require("../utils/emailTemplates");

const EMAIL_KEYS = require("../utils/emailNotificationKeys");
const { isEmailEnabled } = require("../utils/emailNotificationSettings");

// --- CONSTANTS & IMMUTABILITY ---
const WELLNESS_CREDIT_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  CREDITED: "CREDITED",
  ROLLEDBACK: "ROLLEDBACK",
  EXHAUSTED: "EXHAUSTED",
  EXPIRED: "EXPIRED",
});

// --- HELPER FUNCTIONS ---

function createServiceError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id, label = "ID") {
  if (!mongoose.isValidObjectId(id)) {
    throw createServiceError(`Invalid ${label} format.`, 400);
  }
}

function sanitizeSearch(str, limit = 100) {
  return String(str || "")
    .replace(/\0/g, "")
    .slice(0, limit)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeString(str) {
  return String(str || "")
    .replace(/\0/g, "")
    .trim();
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
  return await isEmailEnabled(key);
}

// --- LIFECYCLE METHODS: RESERVE, APPROVE, REVERT ---

/**
 * Step 1: RESERVE (When application is submitted/pending)
 */
async function reserveWellnessDays(employeeId, totalDaysToReserve, session) {
  let daysLeft = totalDaysToReserve;

  const activeCredits = await WellnessCredit.find({
    status: WELLNESS_CREDIT_STATUS.CREDITED,
    employees: {
      $elemMatch: {
        employee: employeeId,
        status: WELLNESS_CREDIT_STATUS.ACTIVE,
        remainingDays: { $gt: 0 },
      },
    },
  })
    .sort({ dateApproved: 1 })
    .session(session);

  for (const credit of activeCredits) {
    if (daysLeft <= 0) break;

    const empRecord = credit.employees.find(
      (e) => String(e.employee) === String(employeeId),
    );
    if (
      !empRecord ||
      empRecord.remainingDays <= 0 ||
      empRecord.status !== WELLNESS_CREDIT_STATUS.ACTIVE
    )
      continue;

    const daysToTake = Math.min(empRecord.remainingDays, daysLeft);

    empRecord.remainingDays -= daysToTake;
    empRecord.reservedDays += daysToTake;

    if (empRecord.remainingDays === 0) {
      empRecord.status = WELLNESS_CREDIT_STATUS.EXHAUSTED;
    }

    daysLeft -= daysToTake;
    await credit.save({ session });
  }

  if (daysLeft > 0) {
    throw createServiceError(
      `Insufficient detailed wellness credits. Short by ${daysLeft} day(s).`,
      400,
    );
  }
}

/**
 * Step 2: APPROVE (When HR/Manager finalizes approval)
 */
async function finalizeApprovedWellnessDays(
  employeeId,
  totalDaysToApprove,
  session,
) {
  let daysLeft = totalDaysToApprove;

  const reservedCredits = await WellnessCredit.find({
    status: {
      $in: [WELLNESS_CREDIT_STATUS.CREDITED, WELLNESS_CREDIT_STATUS.EXPIRED],
    },
    employees: {
      $elemMatch: {
        employee: employeeId,
        reservedDays: { $gt: 0 },
      },
    },
  })
    .sort({ dateApproved: 1 })
    .session(session);

  for (const credit of reservedCredits) {
    if (daysLeft <= 0) break;

    const empRecord = credit.employees.find(
      (e) => String(e.employee) === String(employeeId),
    );
    if (!empRecord || empRecord.reservedDays <= 0) continue;

    const daysToConfirm = Math.min(empRecord.reservedDays, daysLeft);

    empRecord.reservedDays -= daysToConfirm;
    empRecord.usedDays += daysToConfirm;

    daysLeft -= daysToConfirm;
    await credit.save({ session });
  }
}

/**
 * Step 3: REVERT (When application is cancelled or revoked)
 */
async function revertReservedWellnessDays(
  employeeId,
  totalDaysToRevert,
  session,
) {
  let daysLeftToRevert = totalDaysToRevert;

  const utilizedCredits = await WellnessCredit.find({
    status: {
      $in: [WELLNESS_CREDIT_STATUS.CREDITED, WELLNESS_CREDIT_STATUS.EXPIRED],
    },
    employees: {
      $elemMatch: {
        employee: employeeId,
        $or: [{ reservedDays: { $gt: 0 } }, { usedDays: { $gt: 0 } }],
      },
    },
  })
    .sort({ dateApproved: -1 })
    .session(session);

  for (const credit of utilizedCredits) {
    if (daysLeftToRevert <= 0) break;

    const empRecord = credit.employees.find(
      (e) => String(e.employee) === String(employeeId),
    );
    if (!empRecord) continue;

    if (empRecord.reservedDays > 0) {
      const daysToRestore = Math.min(empRecord.reservedDays, daysLeftToRevert);
      empRecord.reservedDays -= daysToRestore;
      empRecord.remainingDays += daysToRestore;
      daysLeftToRevert -= daysToRestore;
    }

    if (daysLeftToRevert > 0 && empRecord.usedDays > 0) {
      const daysToRestore = Math.min(empRecord.usedDays, daysLeftToRevert);
      empRecord.usedDays -= daysToRestore;
      empRecord.remainingDays += daysToRestore;
      daysLeftToRevert -= daysToRestore;
    }

    if (
      empRecord.remainingDays > 0 &&
      credit.status !== WELLNESS_CREDIT_STATUS.EXPIRED
    ) {
      empRecord.status = WELLNESS_CREDIT_STATUS.ACTIVE;
    }

    await credit.save({ session });
  }
}

/**
 * EXPIRE PREVIOUS YEAR (Manual Trigger)
 * Finds all credit batches approved before Jan 1st of the current year,
 * zeroes out remaining days, updates employee balances, and marks them EXPIRED.
 */
async function expirePreviousYearCredits() {
  const currentYear = new Date().getFullYear();
  const startOfCurrentYear = new Date(currentYear, 0, 1); // January 1st, Midnight

  const session = await mongoose.startSession();
  try {
    let affectedBatches = 0;

    await session.withTransaction(async () => {
      const expiringCredits = await WellnessCredit.find({
        dateApproved: { $lt: startOfCurrentYear },
        status: WELLNESS_CREDIT_STATUS.CREDITED,
      }).session(session);

      for (const credit of expiringCredits) {
        for (const empRecord of credit.employees) {
          if (empRecord.status === WELLNESS_CREDIT_STATUS.ACTIVE) {
            const daysToForfeit = empRecord.remainingDays;

            if (daysToForfeit > 0) {
              await Employee.updateOne(
                { _id: empRecord.employee },
                { $inc: { "balances.wellnessDays": -daysToForfeit } },
                { session },
              );
            }

            empRecord.remainingDays = 0;
            empRecord.status = WELLNESS_CREDIT_STATUS.EXPIRED;
          }
        }

        credit.status = WELLNESS_CREDIT_STATUS.EXPIRED;
        await credit.save({ session });
        affectedBatches++;
      }
    });

    return { affectedBatches };
  } finally {
    await session.endSession();
  }
}

// --- STANDARD SERVICE METHODS ---

async function addCredit({ employees, days, dateApproved, userId }) {
  if (!Array.isArray(employees) || employees.length === 0) {
    throw createServiceError(
      "Employees array is required and must not be empty.",
      400,
    );
  }

  assertObjectId(userId, "userId");
  const employeeIds = [...new Set(employees.map(String))];
  employeeIds.forEach((id) => assertObjectId(id, "employeeId"));

  const creditedDays = Number(days);
  if (!Number.isFinite(creditedDays) || creditedDays <= 0) {
    throw createServiceError("Credited days must be > 0.", 400);
  }

  const approvedDate = dateApproved ? new Date(dateApproved) : new Date();
  if (Number.isNaN(approvedDate.getTime())) {
    throw createServiceError("Invalid dateApproved format.", 400);
  }

  const currentYear = approvedDate.getFullYear();
  const currentMonth = approvedDate.getMonth();
  const isFirstHalf = currentMonth < 6;

  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

  const halfStart = new Date(currentYear, isFirstHalf ? 0 : 6, 1);
  const halfEnd = new Date(
    currentYear,
    isFirstHalf ? 5 : 11,
    isFirstHalf ? 30 : 31,
    23,
    59,
    59,
    999,
  );

  const session = await mongoose.startSession();
  try {
    let created;

    await session.withTransaction(async () => {
      const employeeRecords = await Employee.find(
        { _id: { $in: employeeIds } },
        "firstName lastName position employeeType",
      ).session(session);

      if (employeeRecords.length !== employeeIds.length) {
        throw createServiceError(
          "One or more employee IDs are invalid or not found.",
          400,
        );
      }

      for (const emp of employeeRecords) {
        const isJO = emp.employeeType === "Job Order";
        const limit = isJO ? 2 : 5;
        const startDate = isJO ? halfStart : yearStart;
        const endDate = isJO ? halfEnd : yearEnd;

        const existingCredits = await WellnessCredit.aggregate([
          {
            $match: {
              dateApproved: { $gte: startDate, $lte: endDate },
              status: { $ne: WELLNESS_CREDIT_STATUS.ROLLEDBACK },
              "employees.employee": emp._id,
            },
          },
          { $unwind: "$employees" },
          {
            $match: {
              "employees.employee": emp._id,
              "employees.status": { $ne: WELLNESS_CREDIT_STATUS.ROLLEDBACK },
            },
          },
          {
            $group: {
              _id: null,
              totalCredited: { $sum: "$employees.creditedDays" },
            },
          },
        ]).session(session);

        const currentCredited = existingCredits[0]?.totalCredited || 0;

        if (currentCredited + creditedDays > limit) {
          const periodString = isJO ? "this 6-month period" : "this year";
          throw createServiceError(
            `Cannot credit ${creditedDays} days to ${emp.firstName} ${emp.lastName}. They already have ${currentCredited} days for ${periodString} (Limit: ${limit}).`,
            400,
          );
        }
      }

      const employeeObjs = employeeIds.map((id) => ({
        employee: id,
        creditedDays: creditedDays,
        usedDays: 0,
        reservedDays: 0,
        remainingDays: creditedDays,
        status: WELLNESS_CREDIT_STATUS.ACTIVE,
        dateCredited: approvedDate,
      }));

      const docs = await WellnessCredit.create(
        [
          {
            dateApproved: approvedDate,
            days: creditedDays,
            employees: employeeObjs,
            creditedBy: userId,
            status: WELLNESS_CREDIT_STATUS.CREDITED,
          },
        ],
        { session },
      );

      created = docs[0];

      await Employee.updateMany(
        { _id: { $in: employeeIds } },
        { $inc: { "balances.wellnessDays": creditedDays } },
        { session },
      );
    });

    const recipients = await Employee.find({ _id: { $in: employeeIds } })
      .select("firstName lastName email phone")
      .lean();
    const recipientMap = new Map(recipients.map((e) => [String(e._id), e]));

    try {
      const hrEmployee = await Employee.findById(userId)
        .select("firstName lastName phone")
        .lean();

      await Promise.all(
        employeeIds.map((employeeId) =>
          NotificationService.notifyEmployeeOnWellnessCredit({
            employeeId,
            employee: recipientMap.get(String(employeeId)),
            hrEmployee,
            wellnessCredit: created,
            creditedDays: creditedDays,
          }),
        ),
      );
    } catch (e) {
      console.error(
        "Failed creating Wellness credit notifications:",
        e?.message,
      );
    }

    try {
      const enabled = await canSend(EMAIL_KEYS.WELLNESS_CREDIT_ADDED);
      if (enabled) {
        await Promise.all(
          recipients.map(async (emp) => {
            if (!emp?.email) return;

            const tpl = wellnessCreditAddedEmail({
              employeeName:
                `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
              creditedDays: creditedDays,
              dateApproved: approvedDate,
            });

            await safeSendEmail(emp.email, tpl.subject, tpl.html);
          }),
        );
      }
    } catch (e) {
      console.error(
        "Failed preparing Wellness credit added emails:",
        e?.message,
      );
    }

    return created;
  } finally {
    await session.endSession();
  }
}

async function rollbackCredit({ creditId, userId }) {
  assertObjectId(creditId, "creditId");
  assertObjectId(userId, "userId");

  const session = await mongoose.startSession();
  try {
    let updated;

    await session.withTransaction(async () => {
      const credit = await WellnessCredit.findById(creditId).session(session);
      if (!credit) throw createServiceError("Credit request not found.", 404);

      if (credit.status !== WELLNESS_CREDIT_STATUS.CREDITED) {
        throw createServiceError(
          "This credit is not active or has already been rolled back.",
          400,
        );
      }

      const hasUsedOrReserved = credit.employees.some(
        (e) => (e.usedDays || 0) > 0 || (e.reservedDays || 0) > 0,
      );

      if (hasUsedOrReserved) {
        throw createServiceError(
          "Cannot rollback: Some employees have already used or reserved days directly tied to this credit.",
          400,
        );
      }

      const employeeIdsToCheck = credit.employees.map((e) => e.employee);
      const employeeRecords = await Employee.find({
        _id: { $in: employeeIdsToCheck },
      })
        .select("firstName lastName balances")
        .session(session)
        .lean();

      const employeeMap = new Map(
        employeeRecords.map((emp) => [emp._id.toString(), emp]),
      );

      for (const e of credit.employees) {
        const empData = employeeMap.get(e.employee.toString());
        if (!empData) continue;

        const currentBalance = empData.balances?.wellnessDays || 0;
        const daysToRollback = e.creditedDays || 0;

        if (currentBalance < daysToRollback) {
          throw createServiceError(
            `Cannot rollback: ${empData.firstName} ${empData.lastName} has already utilized some of these days (Current Balance: ${currentBalance}, Attempted Rollback: ${daysToRollback}). Rolling this back would result in a negative balance.`,
            400,
          );
        }
      }

      const ops = credit.employees.map((e) => ({
        updateOne: {
          filter: { _id: e.employee },
          update: { $inc: { "balances.wellnessDays": -(e.creditedDays || 0) } },
        },
      }));

      if (ops.length > 0) {
        await Employee.bulkWrite(ops, { session });
      }

      credit.employees = credit.employees.map((e) => ({
        ...e.toObject(),
        status: WELLNESS_CREDIT_STATUS.ROLLEDBACK,
        remainingDays: 0,
        reservedDays: 0,
      }));

      credit.status = WELLNESS_CREDIT_STATUS.ROLLEDBACK;
      credit.dateRolledBack = new Date();
      credit.rolledBackBy = userId;

      updated = await credit.save({ session, runValidators: true });
    });

    let creditPopulated = null;

    try {
      creditPopulated = await WellnessCredit.findById(updated._id)
        .populate("employees.employee", "firstName lastName email phone")
        .lean();

      const hrEmployee = await Employee.findById(userId)
        .select("firstName lastName phone")
        .lean();

      await Promise.all(
        (creditPopulated?.employees || []).map((row) =>
          NotificationService.notifyEmployeeOnWellnessRollback({
            employeeId: row.employee?._id,
            employee: row.employee,
            hrEmployee,
            wellnessCredit: updated,
            rolledBackDays: row.creditedDays || 0,
          }),
        ),
      );
    } catch (e) {
      console.error(
        "Failed creating Wellness rollback notifications:",
        e?.message,
      );
    }

    try {
      const enabled = await canSend(EMAIL_KEYS.WELLNESS_CREDIT_ROLLED_BACK);
      if (enabled && creditPopulated) {
        const dateRolledBack = creditPopulated.dateRolledBack || new Date();

        await Promise.all(
          (creditPopulated.employees || []).map(async (row) => {
            const emp = row?.employee;
            if (!emp?.email) return;

            const tpl = wellnessCreditRolledBackEmail({
              employeeName:
                `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
              rolledBackDays: row?.creditedDays || 0,
              dateRolledBack,
              reason: "Credit rolled back by admin.",
            });

            await safeSendEmail(emp.email, tpl.subject, tpl.html);
          }),
        );
      }
    } catch (e) {
      console.error(
        "Failed preparing Wellness credit rollback emails:",
        e?.message,
      );
    }

    return updated;
  } finally {
    await session.endSession();
  }
}

async function getAllCredits({
  page = 1,
  limit = 20,
  search = "",
  filters = {},
}) {
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 20), 100);
  const skip = (parsedPage - 1) * parsedLimit;

  const query = {};
  if (filters.status) query.status = sanitizeString(filters.status);

  const q = sanitizeString(search);
  if (q) {
    const safe = sanitizeSearch(q, 100);

    const employees = await Employee.find({
      $or: [
        { firstName: { $regex: safe, $options: "i" } },
        { lastName: { $regex: safe, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();

    const employeeIds = employees.map((e) => e._id);
    query["employees.employee"] = { $in: employeeIds };
  }

  const [totalCount, items, totalCreditedCount, totalRolledBackCount] =
    await Promise.all([
      WellnessCredit.countDocuments(query),
      WellnessCredit.find(query)
        .populate("employees.employee", "firstName lastName position")
        .populate("rolledBackBy", "firstName lastName position role")
        .populate("creditedBy", "firstName lastName position role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      WellnessCredit.countDocuments({
        status: WELLNESS_CREDIT_STATUS.CREDITED,
      }),
      WellnessCredit.countDocuments({
        status: WELLNESS_CREDIT_STATUS.ROLLEDBACK,
      }),
    ]);

  return {
    totalCount,
    items,
    grandTotals: {
      credited: totalCreditedCount,
      rolledBack: totalRolledBackCount,
    },
  };
}

async function getEmployeeDetails(employeeId) {
  assertObjectId(employeeId, "employeeId");

  const employee = await Employee.findById(employeeId)
    .select("firstName lastName position department email phone")
    .lean();

  if (!employee) throw createServiceError("Employee not found.", 404);

  return employee;
}

async function getEmployeeCredits(
  employeeId,
  { search = "", filters = {}, page = 1, limit = 20 } = {},
) {
  assertObjectId(employeeId, "employeeId");
  const employeeObjId = new mongoose.Types.ObjectId(employeeId);

  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 20), 100);
  const skip = (parsedPage - 1) * parsedLimit;

  const [totalsAgg] = await WellnessCredit.aggregate([
    {
      $match: {
        "employees.employee": employeeObjId,
        status: { $ne: WELLNESS_CREDIT_STATUS.ROLLEDBACK },
      },
    },
    { $unwind: "$employees" },
    {
      $match: {
        "employees.employee": employeeObjId,
        "employees.status": { $ne: WELLNESS_CREDIT_STATUS.ROLLEDBACK },
      },
    },
    {
      $addFields: {
        _usedDays: { $ifNull: ["$employees.usedDays", 0] },
        _reservedDays: { $ifNull: ["$employees.reservedDays", 0] },
        _creditedDays: { $ifNull: ["$employees.creditedDays", 0] },
        _remainingDays: { $ifNull: ["$employees.remainingDays", 0] },
      },
    },
    {
      $group: {
        _id: null,
        totalUsedDays: { $sum: "$_usedDays" },
        totalReservedDays: { $sum: "$_reservedDays" },
        totalRemainingDays: { $sum: "$_remainingDays" },
        totalCreditedDays: { $sum: "$_creditedDays" },
      },
    },
  ]);

  const totals = {
    totalUsedDays: totalsAgg?.totalUsedDays ?? 0,
    totalReservedDays: totalsAgg?.totalReservedDays ?? 0,
    totalRemainingDays: totalsAgg?.totalRemainingDays ?? 0,
    totalCreditedDays: totalsAgg?.totalCreditedDays ?? 0,
  };

  const listMatch = {
    employees: {
      $elemMatch: {
        employee: employeeObjId,
        ...(filters.status ? { status: sanitizeString(filters.status) } : {}),
      },
    },
  };

  const [totalCount, credits, statusAggregation] = await Promise.all([
    WellnessCredit.countDocuments(listMatch),
    WellnessCredit.find(listMatch)
      .populate("employees.employee", "firstName lastName position email phone")
      .populate("rolledBackBy", "firstName lastName position role")
      .populate("creditedBy", "firstName lastName position role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    WellnessCredit.aggregate([
      { $match: { "employees.employee": employeeObjId } },
      { $unwind: "$employees" },
      { $match: { "employees.employee": employeeObjId } },
      { $group: { _id: "$employees.status", count: { $sum: 1 } } },
    ]),
  ]);

  const formattedCredits = credits.map((credit) => {
    const empData = credit.employees.find(
      (e) => e.employee?._id?.toString() === employeeId,
    );

    const creditStatus = String(credit?.status || "").toUpperCase();
    const empStatus = String(empData?.status || "").toUpperCase();
    const isRolledBack =
      creditStatus === WELLNESS_CREDIT_STATUS.ROLLEDBACK ||
      empStatus === WELLNESS_CREDIT_STATUS.ROLLEDBACK;

    return {
      _id: credit._id,
      dateApproved: credit.dateApproved,
      creditedDays: empData?.creditedDays ?? 0,
      days: credit.days,
      usedDays: empData?.usedDays || 0,
      reservedDays: isRolledBack ? 0 : empData?.reservedDays || 0,
      remainingDays: isRolledBack ? 0 : (empData?.remainingDays ?? 0),
      status: credit.status,
      employeeStatus: empData?.status || WELLNESS_CREDIT_STATUS.ACTIVE,
      creditedBy: credit.creditedBy,
      rolledBackBy: credit.rolledBackBy,
    };
  });

  const statusCounts = { ACTIVE: 0, EXHAUSTED: 0, ROLLEDBACK: 0, EXPIRED: 0 };
  statusAggregation.forEach((s) => {
    if (statusCounts[s._id] !== undefined) {
      statusCounts[s._id] = s.count;
    }
  });

  return {
    total: totalCount,
    credits: formattedCredits,
    page: parsedPage,
    limit: parsedLimit,
    statusCounts,
    totals,
  };
}

module.exports = {
  addCredit,
  rollbackCredit,
  getAllCredits,
  getEmployeeDetails,
  getEmployeeCredits,
  reserveWellnessDays,
  finalizeApprovedWellnessDays,
  revertReservedWellnessDays,
  expirePreviousYearCredits,
};
