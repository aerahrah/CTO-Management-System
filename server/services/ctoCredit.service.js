// services/ctoCredit.service.js
const mongoose = require("mongoose");
const CtoCredit = require("../models/ctoCreditModel");
const Employee = require("../models/employeeModel");
const NotificationService = require("./notificationService");

const sendEmail = require("../utils/sendEmail");
const {
  ctoCreditAddedEmail,
  ctoCreditRolledBackEmail,
} = require("../utils/emailTemplates");

const EMAIL_KEYS = require("../utils/emailNotificationKeys");
const { isEmailEnabled } = require("../utils/emailNotificationSettings");

// --- CONSTANTS & IMMUTABILITY ---
const CTO_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  CREDITED: "CREDITED",
  ROLLEDBACK: "ROLLEDBACK",
  EXHAUSTED: "EXHAUSTED",
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
    .replace(/\0/g, "") // Prevent Null Byte Injection
    .slice(0, limit)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeString(str) {
  return String(str || "")
    .replace(/\0/g, "")
    .trim();
}

function toHours(duration = {}) {
  const h = Number(duration.hours || 0);
  const m = Number(duration.minutes || 0);

  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) {
    throw createServiceError("Invalid duration provided.", 400);
  }
  return h + m / 60;
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

// ✅ UPDATED HELPER: Made `session` optional so it can be called cleanly by the new API
async function calculateEarnedCTOHoursForMonth(
  employeeId,
  targetDate,
  session = null,
) {
  const date = new Date(targetDate);
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  const pipeline = [
    {
      $match: {
        "inclusiveDates.startDate": { $gte: startOfMonth, $lte: endOfMonth },
        status: { $in: [CTO_STATUS.ACTIVE, CTO_STATUS.CREDITED] },
      },
    },
    { $unwind: "$employees" },
    {
      $match: {
        "employees.employee": new mongoose.Types.ObjectId(employeeId),
        "employees.status": { $ne: CTO_STATUS.ROLLEDBACK },
      },
    },
    {
      $group: {
        _id: null,
        totalEarned: { $sum: "$employees.creditedHours" },
      },
    },
  ];

  const result = session
    ? await CtoCredit.aggregate(pipeline, { session })
    : await CtoCredit.aggregate(pipeline);

  return result.length > 0 ? result[0].totalEarned : 0;
}

// --- SERVICE METHODS ---

// ✅ NEW SERVICE: Calculates exact remaining room for an employee based on CSC rules
async function getRemainingCreditableHours(employeeId, targetDate) {
  assertObjectId(employeeId, "employeeId");

  const MAX_COC_BALANCE = Number(process.env.MAX_COC_BALANCE || 120);
  const MAX_COC_PER_MONTH = Number(process.env.MAX_COC_ACCRUAL_PER_MONTH || 40);

  const emp = await Employee.findById(employeeId).select("balances").lean();
  if (!emp) throw createServiceError("Employee not found.", 404);

  const currentBalance = Number(emp.balances?.ctoHours || 0);
  const dateToCheck = targetDate || new Date();

  // Get how much they've already accrued in this target month
  const earnedThisMonth = await calculateEarnedCTOHoursForMonth(
    employeeId,
    dateToCheck,
  );

  const roomUntil120 = Math.max(0, MAX_COC_BALANCE - currentBalance);
  const roomUntil40 = Math.max(0, MAX_COC_PER_MONTH - earnedThisMonth);

  // The actual amount HR can still safely grant them this month
  const absoluteCreditableNow = Math.min(roomUntil120, roomUntil40);

  return {
    maxBalanceLimit: MAX_COC_BALANCE,
    currentBalance,
    roomUntilMaxBalance: roomUntil120,
    maxMonthlyEarning: MAX_COC_PER_MONTH,
    earnedThisMonth,
    roomUntilMonthlyLimit: roomUntil40,
    absoluteCreditableNow,
  };
}

async function addCredit({
  employees,
  duration,
  inclusiveDates,
  purpose,
  memoNo,
  dateApproved,
  userId,
  filePath,
}) {
  if (!Array.isArray(employees) || employees.length === 0) {
    throw createServiceError(
      "Employees array is required and must not be empty.",
      400,
    );
  }

  const safeMemoNo = sanitizeString(memoNo);
  if (!safeMemoNo) throw createServiceError("memoNo is required.", 400);

  const safePurpose = sanitizeString(purpose);
  if (!safePurpose) throw createServiceError("purpose is required.", 400);

  if (!inclusiveDates || !inclusiveDates.startDate || !inclusiveDates.endDate) {
    throw createServiceError(
      "inclusiveDates (startDate and endDate) are required.",
      400,
    );
  }

  const startDate = new Date(inclusiveDates.startDate);
  const endDate = new Date(inclusiveDates.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw createServiceError("Invalid inclusiveDates format.", 400);
  }

  const safeFilePath = sanitizeString(filePath);
  assertObjectId(userId, "userId");

  const employeeIds = [...new Set(employees.map(String))];
  employeeIds.forEach((id) => assertObjectId(id, "employeeId"));

  const totalHours = toHours(duration);

  if (totalHours <= 0) {
    throw createServiceError("Credited hours must be > 0.", 400);
  }

  // ✅ STRICT 40-HOUR MEMO LIMIT
  if (totalHours > 40) {
    throw createServiceError(
      "Total duration cannot exceed exactly 40 hours (if hours is 40, minutes must be 0).",
      400,
    );
  }

  const approvedDate = dateApproved ? new Date(dateApproved) : new Date();
  if (Number.isNaN(approvedDate.getTime())) {
    throw createServiceError("Invalid dateApproved format.", 400);
  }

  const session = await mongoose.startSession();
  let created;
  let finalEmployeeObjs = [];

  try {
    // ✅ CSC RULES LIMITS
    const MAX_COC_BALANCE = Number(process.env.MAX_COC_BALANCE || 120);
    const MAX_COC_PER_MONTH = Number(
      process.env.MAX_COC_ACCRUAL_PER_MONTH || 40,
    );

    await session.withTransaction(async () => {
      // 1. Fetch all employees to check their current balance
      const employeesData = await Employee.find({ _id: { $in: employeeIds } })
        .select("balances firstName lastName email")
        .session(session)
        .lean();

      if (employeesData.length !== employeeIds.length) {
        throw createServiceError(
          "One or more employee IDs are invalid or not found.",
          400,
        );
      }

      const empMap = new Map(employeesData.map((e) => [e._id.toString(), e]));
      const bulkEmployeeOps = [];

      // 2. Iterate through each employee and apply CSC Capping Rules individually
      for (const empId of employeeIds) {
        const emp = empMap.get(String(empId));
        const currentBalance = Number(emp.balances?.ctoHours || 0);

        // Calculate Room in 120-hour max limit
        const roomUntil120 = Math.max(0, MAX_COC_BALANCE - currentBalance);

        // Calculate Room in 40-hour monthly limit
        const earnedThisMonth = await calculateEarnedCTOHoursForMonth(
          empId,
          startDate,
          session,
        );
        const roomUntil40 = Math.max(0, MAX_COC_PER_MONTH - earnedThisMonth);

        // Absolute maximum they can receive from this memo
        const maxAllowedToCredit = Math.min(roomUntil120, roomUntil40);

        // Final creditable hours
        const actualCreditedHours = Math.max(
          0,
          Math.min(totalHours, maxAllowedToCredit),
        );
        const forfeitedHours = Math.max(0, totalHours - actualCreditedHours);

        finalEmployeeObjs.push({
          employee: empId,
          creditedHours: actualCreditedHours, // What they actually got
          usedHours: 0,
          reservedHours: 0,
          remainingHours: actualCreditedHours,
          forfeitedHours: forfeitedHours, // Record of what they lost due to cap
          status: CTO_STATUS.ACTIVE,
          dateCredited: approvedDate,
        });

        // Only update DB if they actually received > 0 hours
        if (actualCreditedHours > 0) {
          bulkEmployeeOps.push({
            updateOne: {
              filter: { _id: empId },
              update: { $inc: { "balances.ctoHours": actualCreditedHours } },
            },
          });
        }
      }

      // 3. Save the CtoCredit Memo with the dynamically adjusted individual hours
      const docs = await CtoCredit.create(
        [
          {
            memoNo: safeMemoNo,
            dateApproved: approvedDate,
            uploadedMemo: safeFilePath,
            inclusiveDates: { startDate, endDate },
            purpose: safePurpose,
            duration: {
              hours: Number(duration.hours || 0),
              minutes: Number(duration.minutes || 0),
            },
            employees: finalEmployeeObjs,
            creditedBy: userId,
            status: CTO_STATUS.CREDITED,
          },
        ],
        { session },
      );

      created = docs[0];

      // 4. Update the actual Employee Balances
      if (bulkEmployeeOps.length > 0) {
        await Employee.bulkWrite(bulkEmployeeOps, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  // Fetch recipients for both Email and In-App notifications
  const recipients = await Employee.find({ _id: { $in: employeeIds } })
    .select("firstName lastName email phone")
    .lean();
  const recipientMap = new Map(recipients.map((e) => [e._id.toString(), e]));

  // In-App & SMS Notifications
  try {
    const hrEmployee = await Employee.findById(userId)
      .select("firstName lastName phone")
      .lean();

    await Promise.all(
      finalEmployeeObjs.map((empObj) =>
        NotificationService.notifyEmployeeOnCtoCredit({
          employeeId: empObj.employee,
          employee: recipientMap.get(String(empObj.employee)),
          hrEmployee,
          ctoCredit: created,
          creditedHours: empObj.creditedHours, // Notify them of their specific cap
        }),
      ),
    );
  } catch (e) {
    console.error("Failed creating CTO credit notifications:", e?.message);
  }

  // Email Notifications
  try {
    const enabled = await canSend(EMAIL_KEYS.CTO_CREDIT_ADDED);
    if (enabled) {
      await Promise.all(
        recipients.map(async (emp) => {
          if (!emp?.email) return;

          // Find their specific assigned object to get their capped hours
          const specificEmpObj = finalEmployeeObjs.find(
            (e) => String(e.employee) === String(emp._id),
          );

          const tpl = ctoCreditAddedEmail({
            employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
            memoNo: safeMemoNo,
            creditedHours: specificEmpObj.creditedHours, // Email tells them what they actually received
            dateApproved: approvedDate,
          });

          await safeSendEmail(emp.email, tpl.subject, tpl.html);
        }),
      );
    }
  } catch (e) {
    console.error("Failed preparing CTO credit added emails:", e?.message);
  }

  return created;
}

async function rollbackCredit({ creditId, userId }) {
  assertObjectId(creditId, "creditId");
  assertObjectId(userId, "userId");

  const session = await mongoose.startSession();
  let updated;

  try {
    await session.withTransaction(async () => {
      const credit = await CtoCredit.findById(creditId).session(session);
      if (!credit) throw createServiceError("Credit request not found.", 404);

      if (credit.status !== CTO_STATUS.CREDITED) {
        throw createServiceError(
          "This credit is not active or has already been rolled back.",
          400,
        );
      }

      const hasUsedOrReserved = credit.employees.some(
        (e) => (e.usedHours || 0) > 0 || (e.reservedHours || 0) > 0,
      );

      if (hasUsedOrReserved) {
        throw createServiceError(
          "Cannot rollback: Some employees have already used or reserved hours from this credit.",
          400,
        );
      }

      // Rollback only what they were specifically credited (respects previous caps)
      const ops = credit.employees.map((e) => ({
        updateOne: {
          filter: { _id: e.employee },
          update: { $inc: { "balances.ctoHours": -(e.creditedHours || 0) } },
        },
      }));

      if (ops.length > 0) {
        await Employee.bulkWrite(ops, { session });
      }

      credit.employees = credit.employees.map((e) => ({
        ...e.toObject(),
        status: CTO_STATUS.ROLLEDBACK,
        remainingHours: 0,
        reservedHours: 0,
      }));

      credit.status = CTO_STATUS.ROLLEDBACK;
      credit.dateRolledBack = new Date();
      credit.rolledBackBy = userId;

      updated = await credit.save({ session, runValidators: true });
    });
  } finally {
    await session.endSession();
  }

  let creditPopulated = null;

  // In-App & SMS Notifications
  try {
    creditPopulated = await CtoCredit.findById(updated._id)
      .populate("employees.employee", "firstName lastName email phone")
      .lean();

    const hrEmployee = await Employee.findById(userId)
      .select("firstName lastName phone")
      .lean();

    await Promise.all(
      (creditPopulated?.employees || []).map((row) =>
        NotificationService.notifyEmployeeOnCtoRollback({
          employeeId: row.employee?._id,
          employee: row.employee,
          hrEmployee,
          ctoCredit: updated,
          rolledBackHours: row.creditedHours || 0,
        }),
      ),
    );
  } catch (e) {
    console.error("Failed creating CTO rollback notifications:", e?.message);
  }

  // Email Notifications
  try {
    const enabled = await canSend(EMAIL_KEYS.CTO_CREDIT_ROLLED_BACK);
    if (enabled && creditPopulated) {
      const memoNo = creditPopulated.memoNo || "";
      const dateRolledBack = creditPopulated.dateRolledBack || new Date();

      await Promise.all(
        (creditPopulated.employees || []).map(async (row) => {
          const emp = row?.employee;
          if (!emp?.email) return;

          const tpl = ctoCreditRolledBackEmail({
            employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
            memoNo,
            rolledBackHours: row?.creditedHours || 0,
            dateRolledBack,
            reason: "Credit memo rolled back by admin.",
          });

          await safeSendEmail(emp.email, tpl.subject, tpl.html);
        }),
      );
    }
  } catch (e) {
    console.error("Failed preparing CTO credit rollback emails:", e?.message);
  }

  return updated;
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

    query.$or = [
      { memoNo: { $regex: safe, $options: "i" } },
      { purpose: { $regex: safe, $options: "i" } },
      { "employees.employee": { $in: employeeIds } },
    ];
  }

  const [totalCount, items, totalCreditedCount, totalRolledBackCount] =
    await Promise.all([
      CtoCredit.countDocuments(query),
      CtoCredit.find(query)
        .populate("employees.employee", "firstName lastName position")
        .populate("rolledBackBy", "firstName lastName position role")
        .populate("creditedBy", "firstName lastName position role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      CtoCredit.countDocuments({ status: CTO_STATUS.CREDITED }),
      CtoCredit.countDocuments({ status: CTO_STATUS.ROLLEDBACK }),
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
    .select("firstName lastName position department email")
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

  const [totalsAgg] = await CtoCredit.aggregate([
    {
      $match: {
        "employees.employee": employeeObjId,
        status: { $ne: CTO_STATUS.ROLLEDBACK },
      },
    },
    { $unwind: "$employees" },
    {
      $match: {
        "employees.employee": employeeObjId,
        "employees.status": { $ne: CTO_STATUS.ROLLEDBACK },
      },
    },
    {
      $addFields: {
        _usedHours: { $ifNull: ["$employees.usedHours", 0] },
        _reservedHours: { $ifNull: ["$employees.reservedHours", 0] },
        _creditedHours: { $ifNull: ["$employees.creditedHours", 0] },
        _remainingHours: { $ifNull: ["$employees.remainingHours", 0] },
      },
    },
    {
      $group: {
        _id: null,
        totalUsedHours: { $sum: "$_usedHours" },
        totalReservedHours: { $sum: "$_reservedHours" },
        totalRemainingHours: { $sum: "$_remainingHours" },
        totalCreditedHours: { $sum: "$_creditedHours" },
      },
    },
  ]);

  const totals = {
    totalUsedHours: totalsAgg?.totalUsedHours ?? 0,
    totalReservedHours: totalsAgg?.totalReservedHours ?? 0,
    totalRemainingHours: totalsAgg?.totalRemainingHours ?? 0,
    totalCreditedHours: totalsAgg?.totalCreditedHours ?? 0,
  };

  const safeSearch = sanitizeSearch(search, 100);
  const listMatch = {
    employees: {
      $elemMatch: {
        employee: employeeObjId,
        ...(filters.status ? { status: sanitizeString(filters.status) } : {}),
      },
    },
    ...(safeSearch
      ? {
          $or: [
            { memoNo: { $regex: safeSearch, $options: "i" } },
            { purpose: { $regex: safeSearch, $options: "i" } },
          ],
        }
      : {}),
  };

  const [totalCount, credits, statusAggregation] = await Promise.all([
    CtoCredit.countDocuments(listMatch),
    CtoCredit.find(listMatch)
      .populate("employees.employee", "firstName lastName position")
      .populate("rolledBackBy", "firstName lastName position role")
      .populate("creditedBy", "firstName lastName position role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    CtoCredit.aggregate([
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
      creditStatus === CTO_STATUS.ROLLEDBACK ||
      empStatus === CTO_STATUS.ROLLEDBACK;

    return {
      _id: credit._id,
      memoNo: credit.memoNo,
      dateApproved: credit.dateApproved,
      uploadedMemo: credit.uploadedMemo,
      inclusiveDates: credit.inclusiveDates,
      purpose: credit.purpose,
      creditedHours: empData?.creditedHours ?? 0,
      forfeitedHours: empData?.forfeitedHours ?? 0,
      duration: credit.duration,
      usedHours: empData?.usedHours || 0,
      reservedHours: isRolledBack ? 0 : empData?.reservedHours || 0,
      remainingHours: isRolledBack ? 0 : (empData?.remainingHours ?? 0),
      status: credit.status,
      employeeStatus: empData?.status || CTO_STATUS.ACTIVE,
      creditedBy: credit.creditedBy,
      rolledBackBy: credit.rolledBackBy,
    };
  });

  const statusCounts = { ACTIVE: 0, EXHAUSTED: 0, ROLLEDBACK: 0 };
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
  getRemainingCreditableHours,
  addCredit,
  rollbackCredit,
  getAllCredits,
  getEmployeeDetails,
  getEmployeeCredits,
};
