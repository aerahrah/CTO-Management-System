// services/ctoDashboard.service.js
const mongoose = require("mongoose");
const Employee = require("../models/employeeModel");
const CtoApplication = require("../models/ctoApplicationModel");
const CtoCredit = require("../models/ctoCreditModel");
const ApprovalStep = require("../models/approvalStepModel");

async function sumApprovedHours(employeeId) {
  const [agg] = await CtoApplication.aggregate([
    { $match: { employee: employeeId, overallStatus: "APPROVED" } },
    { $group: { _id: null, usedHours: { $sum: "$requestedHours" } } },
  ]);
  return agg?.usedHours || 0;
}

async function getEmployeeCreditTotals(employeeId) {
  try {
    if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId))
      return null;

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

          // ✅ exclude rolled back from these totals (safe + consistent)
          totalUsedHours: {
            $sum: {
              $cond: [
                { $ne: ["$_creditStatus", "ROLLEDBACK"] },
                "$_usedHours",
                0,
              ],
            },
          },
          totalReservedHours: {
            $sum: {
              $cond: [
                { $ne: ["$_creditStatus", "ROLLEDBACK"] },
                "$_reservedHours",
                0,
              ],
            },
          },

          // ✅ already excluded rolled back (kept same behavior)
          totalRemainingHours: {
            $sum: {
              $cond: [
                { $ne: ["$_creditStatus", "ROLLEDBACK"] },
                "$_remainingHours",
                0,
              ],
            },
          },

          // ✅ FIX: exclude rolled back from credited total
          totalCreditedHours: {
            $sum: {
              $cond: [
                { $ne: ["$_creditStatus", "ROLLEDBACK"] },
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
    return null;
  }
}

const ctoDashboardService = {
  getPersonalCtoSummary: async (employeeId) => {
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
        totalRequests: 0,
        recentRequests: [],
      };
    }

    const [
      approvedCount,
      pendingCount,
      rejectedCount,
      totalCount,
      usedHours,
      creditTotals,
    ] = await Promise.all([
      CtoApplication.countDocuments({
        employee: employeeId,
        overallStatus: "APPROVED",
      }),
      CtoApplication.countDocuments({
        employee: employeeId,
        overallStatus: "PENDING",
      }),
      CtoApplication.countDocuments({
        employee: employeeId,
        overallStatus: "REJECTED",
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
      // ✅ now excludes rolled back credits
      totalCredit: totals.totalCreditedHours,

      balance: creditTotals
        ? totals.totalRemainingHours
        : employee.balances?.ctoHours || 0,

      used: creditTotals ? totals.totalUsedHours : usedHours,
      reserved: totals.totalReservedHours,

      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      totalRequests: totalCount,
      recentRequests,
    };
  },

  getEmployeeSummary: async (employeeId) => {
    const myCtoSummary =
      await ctoDashboardService.getPersonalCtoSummary(employeeId);
    return {
      myCtoSummary,
      quickActions: [{ name: "Apply for CTO", link: "/app/cto-apply" }],
    };
  },

  getSupervisorSummary: async (employeeId) => {
    const myCtoSummary =
      await ctoDashboardService.getPersonalCtoSummary(employeeId);

    const approvalSteps = await ApprovalStep.find({ approver: employeeId })
      .populate({
        path: "ctoApplication",
        populate: [
          { path: "employee", select: "firstName lastName" },
          { path: "approvals", populate: { path: "approver", select: "_id" } },
        ],
      })
      .sort({ createdAt: -1 });

    const pendingApplicationsMap = new Map();

    for (const step of approvalSteps) {
      const app = step.ctoApplication;
      if (!app || !Array.isArray(app.approvals) || app.approvals.length === 0)
        continue;
      if (app.overallStatus === "REJECTED") continue;

      const steps = app.approvals;
      const userStepIndex = steps.findIndex(
        (s) => s.approver?._id?.toString() === employeeId.toString(),
      );
      if (userStepIndex === -1) continue;

      const userStep = steps[userStepIndex];
      if (userStep.status === "REJECTED") continue;

      const pendingStep = steps.find((s) => s.status === "PENDING");
      const isTheirTurn =
        pendingStep?.approver?._id?.toString() === employeeId.toString();

      if (userStep.status === "PENDING" && isTheirTurn) {
        pendingApplicationsMap.set(app._id.toString(), app);
      }
    }

    const allPendingRequests = Array.from(pendingApplicationsMap.values()).map(
      (app) => ({
        id: app._id,
        employeeId: app.employee._id,
        employeeName: `${app.employee.firstName} ${app.employee.lastName}`,
        requestedHours: app.requestedHours,
        inclusiveDates: app.inclusiveDates,
        reason: app.reason,
        createdAt: app.createdAt,
      }),
    );

    const recentPendingRequests = allPendingRequests.slice(0, 5);

    return {
      myCtoSummary,
      teamPendingApprovals: allPendingRequests.length,
      pendingRequests: recentPendingRequests,
      quickLinks:
        allPendingRequests.length > 0
          ? [{ name: "Approvals", link: "/app/cto-approvals" }]
          : [],
    };
  },

  getHrSummary: async (hrId) => {
    const myCtoSummary = await ctoDashboardService.getPersonalCtoSummary(hrId);

    const recentCredits = await CtoCredit.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "memoNo dateApproved status duration employees creditedBy createdAt",
      )
      .populate("employees.employee", "firstName lastName position")
      .lean();

    const [totalCreditedCount, totalRolledBackCount, totalPendingRequests] =
      await Promise.all([
        CtoCredit.countDocuments({ status: "CREDITED" }),
        CtoCredit.countDocuments({ status: "ROLLEDBACK" }),
        CtoApplication.countDocuments({ overallStatus: "PENDING" }),
      ]);

    return {
      myCtoSummary,
      recentCredits,
      totalCreditedCount,
      totalRolledBackCount,
      totalPendingRequests,
      quickLinks: [
        { name: "CTO Records", link: "/app/cto-records" },
        { name: "Manage Credits", link: "/app/cto-credit" },
        { name: "Reports", link: "/app/cto-records" },
      ],
    };
  },

  getAdminSummary: async (adminId) => {
    const hrData = await ctoDashboardService.getHrSummary(adminId);

    const [totalRequests, approvedRequests, rejectedRequests] =
      await Promise.all([
        CtoApplication.countDocuments(),
        CtoApplication.countDocuments({ overallStatus: "APPROVED" }),
        CtoApplication.countDocuments({ overallStatus: "REJECTED" }),
      ]);

    const [creditAgg] = await CtoCredit.aggregate([
      { $unwind: "$employees" },
      {
        $group: {
          _id: null,
          totalCredited: {
            $sum: {
              $cond: [
                { $eq: ["$status", "CREDITED"] },
                "$employees.creditedHours",
                0,
              ],
            },
          },
          totalRolledBack: {
            $sum: {
              $cond: [
                { $eq: ["$status", "ROLLEDBACK"] },
                "$employees.creditedHours",
                0,
              ],
            },
          },
        },
      },
    ]);

    return {
      ...hrData,
      totalRequests,
      approvedRequests,
      rejectedRequests,
      totalCredited: creditAgg?.totalCredited || 0,
      rolledBack: creditAgg?.totalRolledBack || 0,
    };
  },
};

module.exports = ctoDashboardService;
