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

  // Build employees array with appliedHours 0
  const employeeObjs = employees.map((id) => ({
    employee: id,
    appliedHours: 0,
  }));

  const credit = await CtoCredit.create({
    memoNo,
    dateApproved,
    uploadedMemo: filePath,
    duration,
    totalHours,
    employees: employeeObjs,
    creditedBy: userId,
  });

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
  if (credit.status !== "CREDITED") {
    throw new Error("This credit is not active or already rolled back");
  }

  const totalHours = credit.duration.hours + credit.duration.minutes / 60;

  await Employee.updateMany(
    { _id: { $in: credit.employees } },
    { $inc: { "balances.ctoHours": -totalHours } }
  );

  credit.status = "ROLLEDBACK";
  credit.dateRolledBack = new Date();
  credit.rolledBackBy = userId;
  await credit.save();

  return credit;
}

async function getRecentCredits() {
  return CtoCredit.find()
    .populate("employees.employee", "firstName lastName position")
    .sort({ createdAt: -1 })
    .limit(10);
}

async function getAllCredits() {
  return CtoCredit.find()
    .populate("employees.employee", "firstName lastName")
    .populate("rolledBackBy", "firstName lastName position role")
    .populate("creditedBy", "firstName lastName position role")
    .sort({ createdAt: -1 });
}

async function getEmployeeDetails(employeeId) {
  return Employee.findById(employeeId)
    .select("firstName lastName position department email")
    .lean();
}

const getEmployeeCredits = async (employeeId) => {
  const credits = await CtoCredit.find({ "employees.employee": employeeId })
    .populate("employees.employee", "firstName lastName")
    .exec();

  return credits.map((credit) => {
    const empData = credit.employees.find(
      (e) => e.employee._id.toString() === employeeId.toString()
    );
    return {
      memoNo: credit.memoNo,
      dateApproved: credit.dateApproved,
      totalHours: credit.totalHours,
      appliedHours: empData?.appliedHours || 0,
      remainingHours: credit.totalHours - (empData?.appliedHours || 0),
      uploadedMemo: credit.uploadedMemo,
      status: credit.status,
    };
  });
};

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
  getRecentCredits,
  getAllCredits,
  getEmployeeDetails,
  getEmployeeCredits,
};
