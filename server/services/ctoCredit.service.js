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
  const totalHours = duration.hours + duration.minutes / 60;

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
    status: "CREDITED", // memo-level
  });

  // ✅ Update each employee's CTO balance
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

  // If search is provided, find employees that match firstName or lastName
  if (search) {
    // Use $lookup style: find credits where at least one employee's name matches
    const employees = await Employee.find({
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    const employeeIds = employees.map((e) => e._id);

    // Match any CTO credit where at least one employee is in employeeIds
    query["employees.employee"] = { $in: employeeIds };
  }

  const totalCount = await CtoCredit.countDocuments(query);

  const items = await CtoCredit.find(query)
    .populate("employees.employee", "firstName lastName position")
    .populate("rolledBackBy", "firstName lastName position role")
    .populate("creditedBy", "firstName lastName position role")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return { totalCount, items };
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

  page = parseInt(page);
  limit = Math.min(Math.max(limit, 20), 100);
  const skip = (page - 1) * limit;

  // Base query: filter only for this employee
  const query = { "employees.employee": employeeId };

  // Employee-specific status filter: ACTIVE / EXHAUSTED / ROLLEDBACK
  if (filters.status) {
    query.employees = {
      $elemMatch: { employee: employeeId, status: filters.status },
    };
  }

  // Search filter: only search by memoNo
  if (search) {
    query.memoNo = { $regex: search, $options: "i" };
  }

  // Total count for pagination
  const totalCount = await CtoCredit.countDocuments(query);

  // Fetch credits with pagination
  const credits = await CtoCredit.find(query)
    .populate("employees.employee", "firstName lastName position")
    .populate("rolledBackBy", "firstName lastName position role")
    .populate("creditedBy", "firstName lastName position role")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const formattedCredits = credits.map((credit) => {
    const empData = credit.employees.find(
      (e) => e.employee._id.toString() === employeeId,
    );

    // Calculate remaining hours
    const totalHours = credit.duration.hours + credit.duration.minutes / 60;
    const usedHours = empData?.usedHours || 0;
    const reservedHours = empData?.reservedHours || 0;
    const remainingHours = totalHours - usedHours - reservedHours;

    return {
      memoNo: credit.memoNo,
      dateApproved: credit.dateApproved,
      uploadedMemo: credit.uploadedMemo,
      duration: credit.duration,
      appliedHours: usedHours,
      reservedHours: reservedHours,
      remainingHours: remainingHours,
      status: credit.status,
      usedHours: empData?.usedHours,
      employeeStatus: empData?.status || "ACTIVE",
      creditedBy: credit.creditedBy,
      rolledBackBy: credit.rolledBackBy,
    };
  });

  return { totalCount, credits: formattedCredits, page, limit };
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
