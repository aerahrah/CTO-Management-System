// services/ctoCredit.service.js
const CtoCredit = require("../models/ctoCreditModel");
const Employee = require("../models/employeeModel");
const CtoApplication = require("../models/ctoApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const mongoose = require("mongoose");

async function addCredit({
  employees,
  duration,
  memoNo,
  dateApproved,
  userId,
  filePath,
}) {
  if (
    !duration ||
    typeof duration.hours !== "number" ||
    typeof duration.minutes !== "number"
  ) {
    throw new Error("Invalid duration format");
  }
  if (duration.minutes < 0 || duration.minutes >= 60) {
    throw new Error("Minutes must be between 0 and 59");
  }

  const existingEmployees = await Employee.find({ _id: { $in: employees } });
  if (existingEmployees.length !== employees.length) {
    throw new Error(
      "Some employee IDs are invalid or not found in the database"
    );
  }

  const totalHours = duration.hours + duration.minutes / 60;

  const creditRequest = await CtoCredit.create({
    employees,
    duration,
    memoNo,
    status: "CREDITED",
    dateApproved: dateApproved ? new Date(dateApproved) : null,
    dateCredited: new Date(),
    creditedBy: userId,
    uploadedMemo: filePath,
  });

  await Employee.updateMany(
    { _id: { $in: employees } },
    { $inc: { "balances.ctoHours": totalHours } }
  );

  return creditRequest;
}

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
    .populate("employees", "firstName lastName position")
    .sort({ createdAt: -1 })
    .limit(10);
}

async function getAllCredits() {
  return CtoCredit.find()
    .populate("employees", "firstName lastName position")
    .populate("rolledBackBy", "firstName lastName position role")
    .populate("creditedBy", "firstName lastName position role")
    .sort({ createdAt: -1 });
}

async function getEmployeeDetails(employeeId) {
  return Employee.findById(employeeId)
    .select("firstName lastName position department email")
    .lean();
}

async function getEmployeeCredits(employeeId) {
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    throw new Error("Invalid employee ID");
  }

  return CtoCredit.find({ employees: employeeId })
    .populate("creditedBy", "firstName lastName position")
    .populate("rolledBackBy", "firstName lastName position")
    .lean();
}

const applyCtoService = async ({
  employeeId,
  requestedHours,
  reason,
  approvers,
}) => {
  // 1️⃣ Validate input
  if (!requestedHours || !approvers || approvers.length === 0) {
    const err = new Error(
      "Requested hours and at least one approver are required"
    );
    err.status = 400;
    throw err;
  }

  // 2️⃣ Verify employee exists
  const employee = await Employee.findById(employeeId);
  if (!employee) {
    const err = new Error("Employee not found");
    err.status = 404;
    throw err;
  }

  // 3️⃣ Create approval steps
  const approvalStepDocs = await Promise.all(
    approvers.map(async (approverId, index) => {
      return await ApprovalStep.create({
        level: index + 1,
        approver: approverId,
        status: "PENDING",
      });
    })
  );

  // 4️⃣ Create CTO application
  const newCtoApplication = new CtoApplication({
    employee: employeeId,
    requestedHours,
    reason,
    approvals: approvalStepDocs.map((step) => step._id),
    overallStatus: "PENDING",
    // attachment: { ... } // For future file upload
  });

  await newCtoApplication.save();

  return newCtoApplication;
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
  applyCtoService,
};
