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

const BRAND_NAME = "CTO Management System";

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

/**
 * Sanitizes input strings by removing null bytes and escaping regex characters.
 * Limits length to prevent ReDoS (Regular Expression Denial of Service).
 */
function sanitizeSearch(str, limit = 100) {
  return String(str || "")
    .replace(/\0/g, "") // Prevent Null Byte Injection
    .slice(0, limit)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Safely strips out null bytes from standard string inputs like file paths or memos.
 */
function sanitizeString(str) {
  return String(str || "")
    .replace(/\0/g, "")
    .trim();
}

/**
 * Strictly parses duration to prevent NoSQL injection via objects.
 */
function toHours(duration = {}) {
  // Explicitly cast to numbers, rejecting injected MongoDB operator objects
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

// --- SERVICE METHODS ---

async function addCredit({
  employees,
  duration,
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
  if (!safeMemoNo) {
    throw createServiceError("memoNo is required.", 400);
  }

  const safeFilePath = sanitizeString(filePath);
  assertObjectId(userId, "userId");

  const employeeIds = [...new Set(employees.map(String))]; // Remove duplicates
  employeeIds.forEach((id) => assertObjectId(id, "employeeId"));

  const totalHours = toHours(duration);
  if (totalHours <= 0)
    throw createServiceError("Credited hours must be > 0.", 400);

  const approvedDate = dateApproved ? new Date(dateApproved) : new Date();
  if (Number.isNaN(approvedDate.getTime())) {
    throw createServiceError("Invalid dateApproved format.", 400);
  }

  const session = await mongoose.startSession();
  try {
    let created;

    await session.withTransaction(async () => {
      const existingCount = await Employee.countDocuments(
        { _id: { $in: employeeIds } },
        { session },
      );

      if (existingCount !== employeeIds.length) {
        throw createServiceError(
          "One or more employee IDs are invalid or not found.",
          400,
        );
      }

      const employeeObjs = employeeIds.map((id) => ({
        employee: id,
        creditedHours: totalHours,
        usedHours: 0,
        reservedHours: 0,
        remainingHours: totalHours,
        status: CTO_STATUS.ACTIVE,
        dateCredited: approvedDate,
      }));

      const docs = await CtoCredit.create(
        [
          {
            memoNo: safeMemoNo,
            dateApproved: approvedDate,
            uploadedMemo: safeFilePath,
            duration: {
              hours: Number(duration.hours || 0),
              minutes: Number(duration.minutes || 0),
            }, // Strict structure
            employees: employeeObjs,
            creditedBy: userId,
            status: CTO_STATUS.CREDITED,
          },
        ],
        { session },
      );

      created = docs[0];

      await Employee.updateMany(
        { _id: { $in: employeeIds } },
        { $inc: { "balances.ctoHours": totalHours } },
        { session },
      );
    });

    // In-App Notifications
    try {
      const hrEmployee = await Employee.findById(userId)
        .select("firstName lastName")
        .lean();

      await Promise.all(
        employeeIds.map((employeeId) =>
          NotificationService.notifyEmployeeOnCtoCredit({
            employeeId,
            hrEmployee,
            ctoCredit: created,
            creditedHours: totalHours,
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
        const recipients = await Employee.find({ _id: { $in: employeeIds } })
          .select("firstName lastName email")
          .lean();

        await Promise.all(
          recipients.map(async (emp) => {
            if (!emp?.email) return;

            const tpl = ctoCreditAddedEmail({
              employeeName:
                `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
              memoNo: safeMemoNo,
              creditedHours: totalHours,
              dateApproved: approvedDate,
              brandName: BRAND_NAME,
            });

            await safeSendEmail(emp.email, tpl.subject, tpl.html);
          }),
        );
      }
    } catch (e) {
      console.error("Failed preparing CTO credit added emails:", e?.message);
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

      // Deduct balances from employees
      const ops = credit.employees.map((e) => ({
        updateOne: {
          filter: { _id: e.employee },
          update: { $inc: { "balances.ctoHours": -(e.creditedHours || 0) } },
        },
      }));

      if (ops.length > 0) {
        await Employee.bulkWrite(ops, { session });
      }

      // Mark each employee record as rolled back
      credit.employees = credit.employees.map((e) => ({
        ...e.toObject(),
        status: CTO_STATUS.ROLLEDBACK,
        remainingHours: 0,
        reservedHours: 0,
      }));

      // Mark credit document as rolled back
      credit.status = CTO_STATUS.ROLLEDBACK;
      credit.dateRolledBack = new Date();
      credit.rolledBackBy = userId;

      updated = await credit.save({ session, runValidators: true });
    });

    // In-App Notifications
    try {
      const hrEmployee = await Employee.findById(userId)
        .select("firstName lastName")
        .lean();

      await Promise.all(
        (updated.employees || []).map((row) =>
          NotificationService.notifyEmployeeOnCtoRollback({
            employeeId: row.employee,
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
      if (enabled) {
        const creditPopulated = await CtoCredit.findById(updated._id)
          .populate("employees.employee", "firstName lastName email")
          .lean();

        const memoNo = creditPopulated?.memoNo || "";
        const dateRolledBack = creditPopulated?.dateRolledBack || new Date();

        await Promise.all(
          (creditPopulated?.employees || []).map(async (row) => {
            const emp = row?.employee;
            if (!emp?.email) return;

            const tpl = ctoCreditRolledBackEmail({
              employeeName:
                `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
              memoNo,
              rolledBackHours: row?.creditedHours || 0,
              dateRolledBack,
              reason: "Credit memo rolled back by admin.",
              brandName: BRAND_NAME,
            });

            await safeSendEmail(emp.email, tpl.subject, tpl.html);
          }),
        );
      }
    } catch (e) {
      console.error("Failed preparing CTO credit rollback emails:", e?.message);
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

    query.$or = [
      { memoNo: { $regex: safe, $options: "i" } },
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
    ...(safeSearch ? { memoNo: { $regex: safeSearch, $options: "i" } } : {}),
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
      creditedHours: empData?.creditedHours ?? 0,
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
  addCredit,
  rollbackCredit,
  getAllCredits,
  getEmployeeDetails,
  getEmployeeCredits,
};
