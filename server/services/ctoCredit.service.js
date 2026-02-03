// services/ctoCredit.service.js
const CtoCredit = require("../models/ctoCreditModel");
const Employee = require("../models/employeeModel");
const mongoose = require("mongoose");
const addCredit = async ({
  employees,
  duration,
  memoNo,
  dateApproved,
  userId,
  filePath,
}) => {
  const totalHours =
    Number(duration.hours || 0) + Number(duration.minutes || 0) / 60;

  const employeeObjs = employees.map((id) => ({
    employee: id,
    creditedHours: totalHours,
    usedHours: 0,
    remainingHours: totalHours,
    status: "ACTIVE",
    dateCredited: dateApproved,
  }));

  const credit = await CtoCredit.create({
    memoNo,
    dateApproved,
    uploadedMemo: filePath,
    duration,
    employees: employeeObjs,
    creditedBy: userId,
    status: "CREDITED",
  });

  await Promise.all(
    employees.map(async (employeeId) => {
      const employee = await Employee.findById(employeeId);
      if (employee) {
        employee.balances.ctoHours =
          (employee.balances.ctoHours || 0) + totalHours;
        await employee.save();
      }
    }),
  );

  return credit;
};

// const rollbackCredit = async ({ creditId, userId }) => {
//   const credit = await CtoCredit.findById(creditId);
//   if (!credit) throw new Error("Credit not found");

//   credit.status = "ROLLEDBACK";
//   credit.dateRolledBack = new Date();
//   credit.rolledBackBy = userId;
//   await credit.save();

//   // Optionally, update applied hours on employees here

//   return credit;
// };

async function rollbackCredit({ creditId, userId }) {
  const credit = await CtoCredit.findById(creditId);
  if (!credit) throw new Error("Credit request not found");

  // Cannot rollback if credit is already rolled back or not active
  if (credit.status !== "CREDITED") {
    throw new Error("This credit is not active or already rolled back");
  }

  // Check if any employee has usedHours or reservedHours
  const hasUsedOrReserved = credit.employees.some(
    (e) => (e.usedHours || 0) > 0 || (e.reservedHours || 0) > 0,
  );
  if (hasUsedOrReserved) {
    throw new Error(
      "Cannot rollback: Some employees have already used or reserved hours",
    );
  }

  // Calculate total credited hours for each employee
  const employeeHoursMap = credit.employees.reduce((acc, e) => {
    const hours = e.creditedHours || 0;
    acc[e.employee] = hours;
    return acc;
  }, {});

  // Deduct hours from each employee's balance
  await Promise.all(
    Object.entries(employeeHoursMap).map(([empId, hours]) =>
      Employee.updateOne(
        { _id: empId },
        { $inc: { "balances.ctoHours": -hours } },
      ),
    ),
  );

  // Update status for each employee inside the credit document
  credit.employees = credit.employees.map((e) => ({
    ...e.toObject(),
    status: "ROLLEDBACK",
  }));

  // Update memo-level status
  credit.status = "ROLLEDBACK";
  credit.dateRolledBack = new Date();
  credit.rolledBackBy = userId;

  await credit.save();

  return credit;
}
async function getAllCredits({
  page = 1,
  limit = 20,
  search = "",
  filters = {},
}) {
  page = parseInt(page);
  limit = Math.min(Math.max(limit, 20), 100);
  const skip = (page - 1) * limit;

  const query = {};
  if (filters.status) query.status = filters.status;

  // Search by employee name
  if (search) {
    const employees = await Employee.find({
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    const employeeIds = employees.map((e) => e._id);
    query["employees.employee"] = { $in: employeeIds };
  }

  // Pagination query
  const totalCount = await CtoCredit.countDocuments(query);
  const items = await CtoCredit.find(query)
    .populate("employees.employee", "firstName lastName position")
    .populate("rolledBackBy", "firstName lastName position role")
    .populate("creditedBy", "firstName lastName position role")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // GRAND COUNTS: not affected by pagination or filters
  const totalCreditedCount = await CtoCredit.countDocuments({
    status: "CREDITED",
  });
  const totalRolledBackCount = await CtoCredit.countDocuments({
    status: "ROLLEDBACK",
  });

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
  return Employee.findById(employeeId)
    .select("firstName lastName position department email")
    .lean();
}
async function getEmployeeCredits(
  employeeId,
  { search = "", filters = {}, page = 1, limit = 20 } = {},
) {
  if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
    throw new Error("Invalid employee ID");
  }

  const employeeObjId = new mongoose.Types.ObjectId(employeeId);

  page = parseInt(page, 10);
  limit = Math.min(Math.max(parseInt(limit, 10) || 20, 20), 100);
  const skip = (page - 1) * limit;

  // -----------------------------
  // 1) Totals (IGNORE search/filters)
  // -----------------------------
  const [totalsAgg] = await CtoCredit.aggregate([
    // Narrow docs quickly
    { $match: { "employees.employee": employeeObjId } },
    { $unwind: "$employees" },
    { $match: { "employees.employee": employeeObjId } },

    // Compute per-credit total hours (duration) and remaining
    {
      $addFields: {
        _durationHours: {
          $add: [
            { $ifNull: ["$duration.hours", 0] },
            {
              $divide: [{ $ifNull: ["$duration.minutes", 0] }, 60],
            },
          ],
        },
        _usedHours: { $ifNull: ["$employees.usedHours", 0] },
        _reservedHours: { $ifNull: ["$employees.reservedHours", 0] },
        _creditedHours: { $ifNull: ["$employees.creditedHours", 0] },
      },
    },
    {
      $addFields: {
        _remainingHours: {
          $subtract: [
            "$_durationHours",
            { $add: ["$_usedHours", "$_reservedHours"] },
          ],
        },
      },
    },

    // Sum totals for employee across ALL credits
    {
      $group: {
        _id: null,
        totalUsedHours: { $sum: "$_usedHours" },
        totalReservedHours: { $sum: "$_reservedHours" },
        totalRemainingHours: { $sum: "$_remainingHours" },
        totalCreditedHours: { $sum: "$_creditedHours" }, // optional but handy
      },
    },
  ]);

  const totals = {
    totalUsedHours: totalsAgg?.totalUsedHours ?? 0,
    totalReservedHours: totalsAgg?.totalReservedHours ?? 0,
    totalRemainingHours: totalsAgg?.totalRemainingHours ?? 0,
    totalCreditedHours: totalsAgg?.totalCreditedHours ?? 0, // optional
  };

  // -----------------------------
  // 2) List query (APPLY search/filters)
  // -----------------------------
  const listMatch = {
    employees: {
      $elemMatch: {
        employee: employeeObjId,
        ...(filters.status ? { status: filters.status } : {}),
      },
    },
    ...(search ? { memoNo: { $regex: search, $options: "i" } } : {}),
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

    const totalHours =
      (credit.duration?.hours || 0) + (credit.duration?.minutes || 0) / 60;

    const usedHours = empData?.usedHours || 0;
    const reservedHours = empData?.reservedHours || 0;

    return {
      memoNo: credit.memoNo,
      dateApproved: credit.dateApproved,
      uploadedMemo: credit.uploadedMemo,

      creditedHours: empData?.creditedHours ?? 0,
      duration: credit.duration,

      usedHours,
      reservedHours,
      remainingHours: totalHours - usedHours - reservedHours,

      status: credit.status,
      employeeStatus: empData?.status || "ACTIVE",

      creditedBy: credit.creditedBy,
      rolledBackBy: credit.rolledBackBy,
    };
  });

  // Status counts (this is overall for the employee; also ignores search/filters)
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
    totals, // ✅ totals unaffected by search/filters
  };
}
// async function createCreditRequest({
//   employees,
//   hours,
//   memoNo,
//   approver,
//   filePath,
// }) {
//   const existingEmployees = await Employee.find({ _id: { $in: employees } });
//   if (existingEmployees.length !== employees.length) {
//     throw new Error(
//       "Some employee IDs are invalid or not found in the database"
//     );
//   }

//   const approverExists = await Employee.findById(approver);
//   if (!approverExists) {
//     throw new Error("Approver ID is invalid or not found in the database");
//   }

//   const creditRequest = await CtoCredit.create({
//     employees,
//     hours,
//     memoNo,
//     approver,
//     status: "PENDING",
//     uploadedMemo: filePath,
//   });

//   return creditRequest;
// }

// async function approveOrRejectCredit({ creditId, decision, remarks, userId }) {
//   const credit = await CtoCredit.findById(creditId);
//   if (!credit) throw new Error("Credit request not found");
//   if (credit.status !== "PENDING") throw new Error("Already processed");
//   if (credit.approver.toString() !== userId.toString()) {
//     throw new Error("You are not authorized to approve/reject this request");
//   }

//   if (decision === "APPROVE") {
//     credit.status = "APPROVED";
//     credit.dateApproved = new Date();
//     await credit.save();

//     await Employee.updateMany(
//       { _id: { $in: credit.employees } },
//       { $inc: { "balances.ctoHours": credit.hours } }
//     );
//   } else if (decision === "REJECT") {
//     credit.status = "REJECTED";
//     credit.reviewedAt = new Date();
//     if (remarks) credit.remarks = remarks;
//     await credit.save();
//   } else {
//     throw new Error("Invalid decision. Use APPROVE or REJECT.");
//   }

//   return credit;
// }

// async function cancelCreditRequest({ creditId, userId }) {
//   const credit = await CtoCredit.findById(creditId);
//   if (!credit) throw new Error("Credit request not found");
//   if (credit.status !== "PENDING")
//     throw new Error("Only pending requests can be canceled");

//   credit.status = "CANCELED";
//   credit.canceledAt = new Date();
//   credit.canceledBy = userId;
//   await credit.save();

//   return credit;
// }

module.exports = {
  addCredit,
  rollbackCredit,
  getAllCredits,
  getEmployeeDetails,
  getEmployeeCredits,
};
