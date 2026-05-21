// services/ctoDashboard.service.js
const mongoose = require("mongoose");
const Employee = require("../models/employeeModel");
const CtoApplication = require("../models/ctoApplicationModel");
const CtoCredit = require("../models/ctoCreditModel");
const ApprovalStep = require("../models/approvalStepModel");

// --- CONSTANTS ---
const CTO_STATUS = Object.freeze({
  APPROVED: "APPROVED",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  CREDITED: "CREDITED",
  ROLLEDBACK: "ROLLEDBACK",
});

// --- HELPER FUNCTIONS ---

function createServiceError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id, fieldName = "ID") {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw createServiceError(`Invalid ${fieldName} format.`, 400);
  }
}

// --- INTERNAL AGGREGATIONS ---

async function sumApprovedHours(employeeId) {
  const employeeObjId = new mongoose.Types.ObjectId(employeeId);

  const [agg] = await CtoApplication.aggregate([
    { $match: { employee: employeeObjId, overallStatus: CTO_STATUS.APPROVED } },
    { $group: { _id: null, usedHours: { $sum: "$requestedHours" } } },
  ]);

  return agg?.usedHours || 0;
}

async function getEmployeeCreditTotals(employeeId) {
  try {
    if (!employeeId || !mongoose.isValidObjectId(employeeId)) return null;

    const employeeObjId = new mongoose.Types.ObjectId(employeeId);

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
          _creditStatus: { $ifNull: ["$status", ""] }, // root doc status
        },
      },
      {
        $group: {
          _id: null,
          totalUsedHours: {
            $sum: {
              $cond: [
                { $ne: ["$_creditStatus", CTO_STATUS.ROLLEDBACK] },
                "$_usedHours",
                0,
              ],
            },
          },
          totalReservedHours: {
            $sum: {
              $cond: [
                { $ne: ["$_creditStatus", CTO_STATUS.ROLLEDBACK] },
                "$_reservedHours",
                0,
              ],
            },
          },
          totalRemainingHours: {
            $sum: {
              $cond: [
                { $ne: ["$_creditStatus", CTO_STATUS.ROLLEDBACK] },
                "$_remainingHours",
                0,
              ],
            },
          },
          totalCreditedHours: {
            $sum: {
              $cond: [
                { $ne: ["$_creditStatus", CTO_STATUS.ROLLEDBACK] },
                "$_creditedHours",
                0,
              ],
            },
          },
        },
      },
    ]);

    if (!totalsAgg) return null;

    return {
      totalUsedHours: totalsAgg?.totalUsedHours ?? 0,
      totalReservedHours: totalsAgg?.totalReservedHours ?? 0,
      totalRemainingHours: totalsAgg?.totalRemainingHours ?? 0,
      totalCreditedHours: totalsAgg?.totalCreditedHours ?? 0,
    };
  } catch (e) {
    // Fail gracefully on aggregation errors to preserve the dashboard load
    console.error("[Dashboard] Error fetching credit totals:", e);
    return null;
  }
}

// --- SERVICE METHODS ---

async function getPersonalCtoSummary(employeeId) {
  assertObjectId(employeeId, "Employee ID");

  const employee = await Employee.findById(employeeId)
    .select("balances")
    .lean();

  if (!employee) {
    return {
      totalCredit: 0,
      balance: 0,
      used: 0,
      reserved: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      totalRequests: 0,
      recentRequests: [],
      wellnessBalance: 0,
    };
  }

  const [
    approvedCount,
    pendingCount,
    rejectedCount,
    cancelledCount,
    totalCount,
    usedHours,
    creditTotals,
  ] = await Promise.all([
    CtoApplication.countDocuments({
      employee: employeeId,
      overallStatus: CTO_STATUS.APPROVED,
    }),
    CtoApplication.countDocuments({
      employee: employeeId,
      overallStatus: CTO_STATUS.PENDING,
    }),
    CtoApplication.countDocuments({
      employee: employeeId,
      overallStatus: CTO_STATUS.REJECTED,
    }),
    CtoApplication.countDocuments({
      employee: employeeId,
      overallStatus: CTO_STATUS.CANCELLED,
    }),
    CtoApplication.countDocuments({ employee: employeeId }),
    sumApprovedHours(employeeId),
    getEmployeeCreditTotals(employeeId),
  ]);

  const recentRequests = await CtoApplication.find({ employee: employeeId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("requestedHours overallStatus inclusiveDates reason createdAt")
    .lean();

  const totals = creditTotals || {
    totalUsedHours: 0,
    totalReservedHours: 0,
    totalRemainingHours: 0,
    totalCreditedHours: 0,
  };

  return {
    totalCredit: totals.totalCreditedHours,
    balance: creditTotals
      ? totals.totalRemainingHours
      : employee.balances?.ctoHours || 0,
    used: creditTotals ? totals.totalUsedHours : usedHours,
    reserved: totals.totalReservedHours,
    pending: pendingCount,
    approved: approvedCount,
    rejected: rejectedCount,
    cancelled: cancelledCount,
    totalRequests: totalCount,
    recentRequests,
    wellnessBalance: employee.balances?.wellnessDays || 0,
  };
}

async function getEmployeeSummary(employeeId) {
  assertObjectId(employeeId, "Employee ID");
  const myCtoSummary = await getPersonalCtoSummary(employeeId);
  return { myCtoSummary };
}

async function getSupervisorSummary(employeeId) {
  assertObjectId(employeeId, "Employee ID");
  const myCtoSummary = await getPersonalCtoSummary(employeeId);

  // Fetch only CTO applications routed to this specific approver
  // Added .lean() to prevent memory bloat since we iterate over this data
  const approvalSteps = await ApprovalStep.find({ approver: employeeId })
    .populate({
      path: "ctoApplication",
      select: "-__v",
      populate: [
        { path: "employee", select: "firstName lastName" },
        { path: "approvals", populate: { path: "approver", select: "_id" } },
      ],
    })
    .sort({ createdAt: -1 })
    .lean();

  const uniqueAppsMap = new Map();

  for (const step of approvalSteps) {
    const app = step.ctoApplication;
    if (!app) continue;
    uniqueAppsMap.set(String(app._id), { app, step });
  }

  let totalApproverRequests = 0;
  let totalApproved = 0;
  let totalPending = 0;
  let totalRejected = 0;
  let totalCancelled = 0;

  const pendingApplicationsMap = new Map();

  for (const { app, step } of uniqueAppsMap.values()) {
    totalApproverRequests++;

    const myStatus = String(step.status || "").toUpperCase();
    const overallStatus = String(app.overallStatus || "").toUpperCase();

    if (myStatus === CTO_STATUS.APPROVED) totalApproved++;
    else if (myStatus === CTO_STATUS.REJECTED) totalRejected++;
    else if (myStatus === CTO_STATUS.PENDING) totalPending++;
    else if (myStatus === CTO_STATUS.CANCELLED) totalCancelled++;

    if (!Array.isArray(app.approvals) || app.approvals.length === 0) continue;
    if (
      overallStatus === CTO_STATUS.REJECTED ||
      overallStatus === CTO_STATUS.CANCELLED
    )
      continue;

    const steps = app.approvals;
    const pendingStep = steps.find((s) => s.status === CTO_STATUS.PENDING);

    const isTheirTurn =
      pendingStep?.approver?._id &&
      String(pendingStep.approver._id) === String(employeeId);

    if (myStatus === CTO_STATUS.PENDING && isTheirTurn) {
      pendingApplicationsMap.set(String(app._id), app);
    }
  }

  const allPendingRequests = Array.from(pendingApplicationsMap.values()).map(
    (app) => ({
      id: app._id,
      employeeId: app.employee._id,
      employeeName: `${app.employee.firstName} ${app.employee.lastName}`,
      requestedHours: app.requestedHours,
      inclusiveDates:
        app.inclusiveDates ||
        (app.startDate ? [app.startDate, app.endDate] : []),
      reason: app.reason,
      createdAt: app.createdAt,
    }),
  );

  const recentPendingRequests = allPendingRequests.slice(0, 5);

  return {
    myCtoSummary,
    teamPendingApprovals: allPendingRequests.length,
    pendingRequests: recentPendingRequests,
    approverStats: {
      all: totalApproverRequests,
      pending: totalPending,
      approved: totalApproved,
      rejected: totalRejected,
      cancelled: totalCancelled,
    },
  };
}

async function getHrSummary(hrId) {
  assertObjectId(hrId, "HR ID");
  const myCtoSummary = await getPersonalCtoSummary(hrId);

  const [
    recentCredits,
    totalCreditedCount,
    totalRolledBackCount,
    totalPendingRequests,
  ] = await Promise.all([
    CtoCredit.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "memoNo dateApproved status duration employees creditedBy createdAt",
      )
      .populate("employees.employee", "firstName lastName position")
      .lean(),
    CtoCredit.countDocuments({ status: CTO_STATUS.CREDITED }),
    CtoCredit.countDocuments({ status: CTO_STATUS.ROLLEDBACK }),
    CtoApplication.countDocuments({ overallStatus: CTO_STATUS.PENDING }),
  ]);

  return {
    myCtoSummary,
    recentCredits,
    totalCreditedCount,
    totalRolledBackCount,
    totalPendingRequests,
  };
}

async function getAdminSummary(adminId) {
  assertObjectId(adminId, "Admin ID");
  const hrData = await getHrSummary(adminId);

  const [totalRequests, approvedRequests, rejectedRequests, creditAgg] =
    await Promise.all([
      CtoApplication.countDocuments(),
      CtoApplication.countDocuments({ overallStatus: CTO_STATUS.APPROVED }),
      CtoApplication.countDocuments({ overallStatus: CTO_STATUS.REJECTED }),
      CtoCredit.aggregate([
        { $unwind: "$employees" },
        {
          $group: {
            _id: null,
            totalCredited: {
              $sum: {
                $cond: [
                  { $eq: ["$status", CTO_STATUS.CREDITED] },
                  "$employees.creditedHours",
                  0,
                ],
              },
            },
            totalRolledBack: {
              $sum: {
                $cond: [
                  { $eq: ["$status", CTO_STATUS.ROLLEDBACK] },
                  "$employees.creditedHours",
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

  return {
    ...hrData,
    totalRequests,
    approvedRequests,
    rejectedRequests,
    totalCredited: creditAgg[0]?.totalCredited || 0,
    rolledBack: creditAgg[0]?.totalRolledBack || 0,
  };
}

module.exports = {
  getPersonalCtoSummary,
  getEmployeeSummary,
  getSupervisorSummary,
  getHrSummary,
  getAdminSummary,
};
