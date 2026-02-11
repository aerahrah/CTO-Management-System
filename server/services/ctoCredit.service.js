// services/ctoCredit.service.js
const mongoose = require("mongoose");
const CtoCredit = require("../models/ctoCreditModel");
const Employee = require("../models/employeeModel");

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id, label = "id") {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(`Invalid ${label}`, 400);
  }
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toHours(duration) {
  const h = Number(duration?.hours || 0);
  const m = Number(duration?.minutes || 0);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) {
    throw httpError("Invalid duration", 400);
  }
  return h + m / 60;
}

async function addCredit({
  employees,
  duration,
  memoNo,
  dateApproved,
  userId,
  filePath,
}) {
  if (!Array.isArray(employees) || employees.length === 0) {
    throw httpError("Employees array is required", 400);
  }
  if (!memoNo || typeof memoNo !== "string" || !memoNo.trim()) {
    throw httpError("memoNo is required", 400);
  }
  assertObjectId(userId, "userId");

  const employeeIds = employees.map(String);
  employeeIds.forEach((id) => assertObjectId(id, "employeeId"));

  const totalHours = toHours(duration);
  if (totalHours <= 0) throw httpError("Credited hours must be > 0", 400);

  const approvedDate = dateApproved ? new Date(dateApproved) : new Date();
  if (Number.isNaN(approvedDate.getTime()))
    throw httpError("Invalid dateApproved", 400);

  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      const existingCount = await Employee.countDocuments(
        { _id: { $in: employeeIds } },
        { session },
      );
      if (existingCount !== employeeIds.length) {
        throw httpError("Some employee IDs are invalid or not found", 400);
      }

      const employeeObjs = employeeIds.map((id) => ({
        employee: id,
        creditedHours: totalHours,
        usedHours: 0,
        reservedHours: 0,
        remainingHours: totalHours,
        status: "ACTIVE",
        dateCredited: approvedDate,
      }));

      const docs = await CtoCredit.create(
        [
          {
            memoNo: memoNo.trim(),
            dateApproved: approvedDate,
            uploadedMemo: filePath,
            duration,
            employees: employeeObjs,
            creditedBy: userId,
            status: "CREDITED",
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

    return created;
  } finally {
    session.endSession();
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
      if (!credit) throw httpError("Credit request not found", 404);

      if (credit.status !== "CREDITED") {
        throw httpError(
          "This credit is not active or already rolled back",
          400,
        );
      }

      const hasUsedOrReserved = credit.employees.some(
        (e) => (e.usedHours || 0) > 0 || (e.reservedHours || 0) > 0,
      );
      if (hasUsedOrReserved) {
        throw httpError(
          "Cannot rollback: Some employees have used or reserved hours",
          400,
        );
      }

      const ops = credit.employees.map((e) => ({
        updateOne: {
          filter: { _id: e.employee },
          update: { $inc: { "balances.ctoHours": -(e.creditedHours || 0) } },
        },
      }));

      if (ops.length) {
        await Employee.bulkWrite(ops, { session });
      }

      credit.employees = credit.employees.map((e) => ({
        ...e.toObject(),
        status: "ROLLEDBACK",
      }));

      credit.status = "ROLLEDBACK";
      credit.dateRolledBack = new Date();
      credit.rolledBackBy = userId;

      updated = await credit.save({ session });
    });

    return updated;
  } finally {
    session.endSession();
  }
}

async function getAllCredits({
  page = 1,
  limit = 20,
  search = "",
  filters = {},
}) {
  page = Math.max(parseInt(page, 10) || 1, 1);
  limit = Math.min(Math.max(parseInt(limit, 10) || 20, 20), 100);
  const skip = (page - 1) * limit;

  const query = {};
  if (filters.status) query.status = filters.status;

  const q = String(search || "").trim();
  if (q) {
    const safe = escapeRegExp(q);

    // employee name search
    const employees = await Employee.find({
      $or: [
        { firstName: { $regex: safe, $options: "i" } },
        { lastName: { $regex: safe, $options: "i" } },
      ],
    }).select("_id");

    const employeeIds = employees.map((e) => e._id);

    // allow memoNo search too
    query.$or = [
      { memoNo: { $regex: safe, $options: "i" } },
      { "employees.employee": { $in: employeeIds } },
    ];
  }

  const [totalCount, items] = await Promise.all([
    CtoCredit.countDocuments(query),
    CtoCredit.find(query)
      .populate("employees.employee", "firstName lastName position")
      .populate("rolledBackBy", "firstName lastName position role")
      .populate("creditedBy", "firstName lastName position role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const [totalCreditedCount, totalRolledBackCount] = await Promise.all([
    CtoCredit.countDocuments({ status: "CREDITED" }),
    CtoCredit.countDocuments({ status: "ROLLEDBACK" }),
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
  return Employee.findById(employeeId)
    .select("firstName lastName position department email")
    .lean();
}

async function getEmployeeCredits(
  employeeId,
  { search = "", filters = {}, page = 1, limit = 20 } = {},
) {
  if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
    throw httpError("Invalid employee ID", 400);
  }

  const employeeObjId = new mongoose.Types.ObjectId(employeeId);

  page = Math.max(parseInt(page, 10) || 1, 1);
  limit = Math.min(Math.max(parseInt(limit, 10) || 20, 20), 100);
  const skip = (page - 1) * limit;

  // totals (ignore filters/search)
  const [totalsAgg] = await CtoCredit.aggregate([
    { $match: { "employees.employee": employeeObjId } },
    { $unwind: "$employees" },
    { $match: { "employees.employee": employeeObjId } },
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

  const safeSearch = String(search || "").trim();
  const listMatch = {
    employees: {
      $elemMatch: {
        employee: employeeObjId,
        ...(filters.status ? { status: filters.status } : {}),
      },
    },
    ...(safeSearch
      ? { memoNo: { $regex: escapeRegExp(safeSearch), $options: "i" } }
      : {}),
  };

  const totalCount = await CtoCredit.countDocuments(listMatch);

  const credits = await CtoCredit.find(listMatch)
    .populate("employees.employee", "firstName lastName position")
    .populate("rolledBackBy", "firstName lastName position role")
    .populate("creditedBy", "firstName lastName position role")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const formattedCredits = credits.map((credit) => {
    const empData = credit.employees.find(
      (e) => e.employee?._id?.toString() === employeeId,
    );

    return {
      _id: credit._id,
      memoNo: credit.memoNo,
      dateApproved: credit.dateApproved,
      uploadedMemo: credit.uploadedMemo,

      creditedHours: empData?.creditedHours ?? 0,
      duration: credit.duration,

      usedHours: empData?.usedHours || 0,
      reservedHours: empData?.reservedHours || 0,
      remainingHours: empData?.remainingHours ?? 0,

      status: credit.status,
      employeeStatus: empData?.status || "ACTIVE",

      creditedBy: credit.creditedBy,
      rolledBackBy: credit.rolledBackBy,
    };
  });

  const statusAggregation = await CtoCredit.aggregate([
    { $match: { "employees.employee": employeeObjId } },
    { $unwind: "$employees" },
    { $match: { "employees.employee": employeeObjId } },
    { $group: { _id: "$employees.status", count: { $sum: 1 } } },
  ]);

  const statusCounts = { ACTIVE: 0, EXHAUSTED: 0, ROLLEDBACK: 0 };
  statusAggregation.forEach((s) => {
    statusCounts[s._id] = s.count;
  });

  return {
    total: totalCount,
    credits: formattedCredits,
    page,
    limit,
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
