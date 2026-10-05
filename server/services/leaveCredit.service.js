// services/leaveCredit.service.js
const mongoose = require("mongoose");
const LeaveCredit = require("../models/leaveCreditModel");
const Employee = require("../models/employeeModel");
const NotificationService = require("./notificationService");
const sendEmail = require("../utils/sendEmail");

const {
  leaveCreditAddedEmail,
  leaveCreditRolledBackEmail,
} = require("../utils/emailTemplates");

const EMAIL_KEYS = require("../utils/emailNotificationKeys");
const { isEmailEnabled } = require("../utils/emailNotificationSettings");

// --- CONSTANTS & IMMUTABILITY ---
const LEAVE_CREDIT_STATUS = Object.freeze({
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

// --- SERVICE METHODS ---

async function addCredit({
  employees,
  leaveType, // "VL" or "SL"
  days,
  dateApproved,
  userId,
}) {
  if (!Array.isArray(employees) || employees.length === 0) {
    throw createServiceError(
      "Employees array is required and must not be empty.",
      400,
    );
  }

  if (!["VL", "SL"].includes(leaveType)) {
    throw createServiceError("Invalid leaveType. Must be 'VL' or 'SL'.", 400);
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

  const balanceField =
    leaveType === "VL" ? "balances.vlDays" : "balances.slDays";

  const session = await mongoose.startSession();
  try {
    let created;

    await session.withTransaction(async () => {
      // 1. Fetch employees to verify they exist
      const employeeRecords = await Employee.find(
        { _id: { $in: employeeIds } },
        "firstName lastName position",
      ).session(session);

      if (employeeRecords.length !== employeeIds.length) {
        throw createServiceError(
          "One or more employee IDs are invalid or not found.",
          400,
        );
      }

      // 2. Create the Credit Document
      const employeeObjs = employeeIds.map((id) => ({
        employee: id,
        creditedDays: creditedDays,
        usedDays: 0,
        reservedDays: 0,
        remainingDays: creditedDays,
        status: LEAVE_CREDIT_STATUS.ACTIVE,
        dateCredited: approvedDate,
      }));

      const docs = await LeaveCredit.create(
        [
          {
            leaveType: leaveType,
            dateApproved: approvedDate,
            days: creditedDays,
            employees: employeeObjs,
            creditedBy: userId,
            status: LEAVE_CREDIT_STATUS.CREDITED,
          },
        ],
        { session },
      );

      created = docs[0];

      // 3. Update Employee Balances
      await Employee.updateMany(
        { _id: { $in: employeeIds } },
        { $inc: { [balanceField]: creditedDays } },
        { session },
      );
    });

    // Fetch recipients for both Email and In-App/SMS notifications
    const recipients = await Employee.find({ _id: { $in: employeeIds } })
      .select("firstName lastName email phone")
      .lean();
    const recipientMap = new Map(recipients.map((e) => [String(e._id), e]));

    // In-App & SMS Notifications
    try {
      const hrEmployee = await Employee.findById(userId)
        .select("firstName lastName phone")
        .lean();

      await Promise.all(
        employeeIds.map((employeeId) =>
          NotificationService.notifyEmployeeOnLeaveCredit({
            employeeId,
            employee: recipientMap.get(String(employeeId)), // ✅ Pass full object for SMS
            hrEmployee,
            leaveCredit: created,
            creditedDays: creditedDays,
            leaveType,
          }),
        ),
      );
    } catch (e) {
      console.error("Failed creating Leave credit notifications:", e?.message);
    }

    // Email Notifications
    try {
      const enabled = await canSend(EMAIL_KEYS.LEAVE_CREDIT_ADDED);
      if (enabled) {
        await Promise.all(
          recipients.map(async (emp) => {
            if (!emp?.email) return;

            const tpl = leaveCreditAddedEmail({
              employeeName:
                `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
              leaveType,
              creditedDays: creditedDays,
              dateApproved: approvedDate,
            });

            await safeSendEmail(emp.email, tpl.subject, tpl.html);
          }),
        );
      }
    } catch (e) {
      console.error("Failed preparing Leave credit added emails:", e?.message);
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
      const credit = await LeaveCredit.findById(creditId).session(session);
      if (!credit) throw createServiceError("Credit request not found.", 404);

      if (credit.status !== LEAVE_CREDIT_STATUS.CREDITED) {
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
          "Cannot rollback: Some employees have already used or reserved days from this credit.",
          400,
        );
      }

      const balanceField =
        credit.leaveType === "VL" ? "balances.vlDays" : "balances.slDays";

      // Deduct balances from employees
      const ops = credit.employees.map((e) => ({
        updateOne: {
          filter: { _id: e.employee },
          update: { $inc: { [balanceField]: -(e.creditedDays || 0) } },
        },
      }));

      if (ops.length > 0) {
        await Employee.bulkWrite(ops, { session });
      }

      // Mark each employee record as rolled back
      credit.employees = credit.employees.map((e) => ({
        ...e.toObject(),
        status: LEAVE_CREDIT_STATUS.ROLLEDBACK,
        remainingDays: 0,
        reservedDays: 0,
      }));

      // Mark credit document as rolled back
      credit.status = LEAVE_CREDIT_STATUS.ROLLEDBACK;
      credit.dateRolledBack = new Date();
      credit.rolledBackBy = userId;

      updated = await credit.save({ session, runValidators: true });
    });

    let creditPopulated = null;

    // In-App & SMS Notifications
    try {
      creditPopulated = await LeaveCredit.findById(updated._id)
        .populate("employees.employee", "firstName lastName email phone")
        .lean();

      const hrEmployee = await Employee.findById(userId)
        .select("firstName lastName phone")
        .lean();

      await Promise.all(
        (creditPopulated?.employees || []).map((row) =>
          NotificationService.notifyEmployeeOnLeaveRollback({
            employeeId: row.employee?._id,
            employee: row.employee, // ✅ Pass full object for SMS
            hrEmployee,
            leaveCredit: updated,
            rolledBackDays: row.creditedDays || 0,
          }),
        ),
      );
    } catch (e) {
      console.error(
        "Failed creating Leave rollback notifications:",
        e?.message,
      );
    }

    // Email Notifications
    try {
      const enabled = await canSend(EMAIL_KEYS.LEAVE_CREDIT_ROLLED_BACK);
      if (enabled && creditPopulated) {
        const dateRolledBack = creditPopulated.dateRolledBack || new Date();

        await Promise.all(
          (creditPopulated.employees || []).map(async (row) => {
            const emp = row?.employee;
            if (!emp?.email) return;

            const tpl = leaveCreditRolledBackEmail({
              employeeName:
                `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
              leaveType: creditPopulated.leaveType,
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
        "Failed preparing Leave credit rollback emails:",
        e?.message,
      );
    }

    return updated;
  } finally {
    await session.endSession();
  }
}

// ✅ NEW SERVICE: Directly edit/initialize balances for Organic employees
async function updateEmployeeLeaveBalances({
  employeeId,
  vlDays,
  slDays,
  userId,
}) {
  assertObjectId(employeeId, "employeeId");
  assertObjectId(userId, "userId");

  const session = await mongoose.startSession();
  try {
    let updatedEmployee;

    await session.withTransaction(async () => {
      const employee = await Employee.findById(employeeId).session(session);

      if (!employee) {
        throw createServiceError("Employee not found.", 404);
      }

      // Enforce business rule: only Organic employees can be initialized this way
      if (employee.employeeType !== "Organic") {
        throw createServiceError(
          "Direct initialization of leave balances is only allowed for Organic employees.",
          400,
        );
      }

      // Update VL Days if explicitly provided
      if (vlDays !== undefined && vlDays !== null) {
        const parsedVl = Number(vlDays);
        if (!Number.isFinite(parsedVl) || parsedVl < 0) {
          throw createServiceError(
            "VL days must be a valid positive number.",
            400,
          );
        }
        employee.balances.vlDays = parsedVl;
      }

      // Update SL Days if explicitly provided
      if (slDays !== undefined && slDays !== null) {
        const parsedSl = Number(slDays);
        if (!Number.isFinite(parsedSl) || parsedSl < 0) {
          throw createServiceError(
            "SL days must be a valid positive number.",
            400,
          );
        }
        employee.balances.slDays = parsedSl;
      }

      updatedEmployee = await employee.save({ session });
    });

    return updatedEmployee;
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
  if (filters.leaveType) query.leaveType = sanitizeString(filters.leaveType);

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
      LeaveCredit.countDocuments(query),
      LeaveCredit.find(query)
        .populate("employees.employee", "firstName lastName position")
        .populate("rolledBackBy", "firstName lastName position role")
        .populate("creditedBy", "firstName lastName position role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      LeaveCredit.countDocuments({ status: LEAVE_CREDIT_STATUS.CREDITED }),
      LeaveCredit.countDocuments({ status: LEAVE_CREDIT_STATUS.ROLLEDBACK }),
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
    .select("firstName lastName position division email phone") // ✅ Added phone
    .lean();

  if (!employee) throw createServiceError("Employee not found.", 404);

  return employee;
}

async function getEmployeeCredits(
  employeeId,
  { search = "", filters = {}, page = 1, limit = 20 } = {},
) {
  assertObjectId(employeeId, "employeeId");

  const employeeCheck = await Employee.findById(employeeId)
    .select("_id")
    .lean();
  if (!employeeCheck) throw createServiceError("Employee not found.", 404);

  const employeeObjId = new mongoose.Types.ObjectId(employeeId);

  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 20), 100);
  const skip = (parsedPage - 1) * parsedLimit;

  // Aggregate totals using days
  const [totalsAgg] = await LeaveCredit.aggregate([
    {
      $match: {
        "employees.employee": employeeObjId,
        status: { $ne: LEAVE_CREDIT_STATUS.ROLLEDBACK },
        ...(filters.leaveType
          ? { leaveType: sanitizeString(filters.leaveType) }
          : {}),
      },
    },
    { $unwind: "$employees" },
    {
      $match: {
        "employees.employee": employeeObjId,
        "employees.status": { $ne: LEAVE_CREDIT_STATUS.ROLLEDBACK },
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
    ...(filters.leaveType
      ? { leaveType: sanitizeString(filters.leaveType) }
      : {}),
  };

  const [totalCount, credits, statusAggregation] = await Promise.all([
    LeaveCredit.countDocuments(listMatch),
    LeaveCredit.find(listMatch)
      .populate("employees.employee", "firstName lastName position email phone") // ✅ Added phone
      .populate("rolledBackBy", "firstName lastName position role")
      .populate("creditedBy", "firstName lastName position role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    LeaveCredit.aggregate([
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
      creditStatus === LEAVE_CREDIT_STATUS.ROLLEDBACK ||
      empStatus === LEAVE_CREDIT_STATUS.ROLLEDBACK;

    return {
      _id: credit._id,
      leaveType: credit.leaveType,
      dateApproved: credit.dateApproved,
      creditedDays: empData?.creditedDays ?? 0,
      days: credit.days,
      usedDays: empData?.usedDays || 0,
      reservedDays: isRolledBack ? 0 : empData?.reservedDays || 0,
      remainingDays: isRolledBack ? 0 : (empData?.remainingDays ?? 0),
      status: credit.status,
      employeeStatus: empData?.status || LEAVE_CREDIT_STATUS.ACTIVE,
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
  updateEmployeeLeaveBalances,
  getAllCredits,
  getEmployeeDetails,
  getEmployeeCredits,
};
