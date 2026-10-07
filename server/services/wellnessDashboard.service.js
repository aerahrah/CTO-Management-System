// services/wellnessDashboard.service.js
const mongoose = require("mongoose");
const Employee = require("../models/employeeModel");
const WellnessApplication = require("../models/wellnessApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");

// --- CONSTANTS ---
const WELLNESS_STATUS = Object.freeze({
  APPROVED: "APPROVED",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
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

// ✅ UPDATED: Dynamic aggregation to sum days based on status (Handles both used and reserved days)
async function sumDaysByStatus(employeeId, status) {
  const employeeObjId = new mongoose.Types.ObjectId(employeeId);

  const [agg] = await WellnessApplication.aggregate([
    {
      $match: {
        employee: employeeObjId,
        overallStatus: status,
      },
    },
    {
      $group: {
        _id: null,
        // Uses totalDays if it exists, otherwise falls back to requestedDays for older records
        total: { $sum: { $ifNull: ["$totalDays", "$requestedDays"] } },
      },
    },
  ]);

  return agg?.total || 0;
}

// --- SERVICE METHODS ---

async function getPersonalWellnessSummary(employeeId) {
  assertObjectId(employeeId, "Employee ID");

  const employee = await Employee.findById(employeeId)
    .select("balances")
    .lean();

  if (!employee) {
    return {
      balance: 0,
      used: 0,
      reservedDays: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      totalRequests: 0,
      recentRequests: [],
    };
  }

  const [
    approvedCount,
    pendingCount,
    rejectedCount,
    cancelledCount,
    totalCount,
    usedDays,
    reservedDays, // ✅ NEW: Fetch reserved days
    recentRequests,
  ] = await Promise.all([
    WellnessApplication.countDocuments({
      employee: employeeId,
      overallStatus: WELLNESS_STATUS.APPROVED,
    }),
    WellnessApplication.countDocuments({
      employee: employeeId,
      overallStatus: WELLNESS_STATUS.PENDING,
    }),
    WellnessApplication.countDocuments({
      employee: employeeId,
      overallStatus: WELLNESS_STATUS.REJECTED,
    }),
    WellnessApplication.countDocuments({
      employee: employeeId,
      overallStatus: WELLNESS_STATUS.CANCELLED,
    }),
    WellnessApplication.countDocuments({ employee: employeeId }),
    sumDaysByStatus(employeeId, WELLNESS_STATUS.APPROVED), // Calculate Used Days
    sumDaysByStatus(employeeId, WELLNESS_STATUS.PENDING), // ✅ Calculate Reserved Days
    WellnessApplication.find({ employee: employeeId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "totalDays requestedDays overallStatus inclusiveDates reason createdAt",
      )
      .lean(),
  ]);

  return {
    balance: employee.balances?.wellnessDays || 0,
    used: usedDays,
    reservedDays: reservedDays, // ✅ NEW: Returned in the summary
    pending: pendingCount,
    approved: approvedCount,
    rejected: rejectedCount,
    cancelled: cancelledCount,
    totalRequests: totalCount,
    recentRequests,
  };
}

async function getEmployeeSummary(employeeId) {
  assertObjectId(employeeId, "Employee ID");
  const myWellnessSummary = await getPersonalWellnessSummary(employeeId);
  return { myWellnessSummary };
}

async function getSupervisorSummary(employeeId) {
  assertObjectId(employeeId, "Employee ID");
  const myWellnessSummary = await getPersonalWellnessSummary(employeeId);

  // Fetch only Wellness applications routed to this specific approver
  const approvalSteps = await ApprovalStep.find({ approver: employeeId })
    .populate({
      path: "wellnessApplication",
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
    const app = step.wellnessApplication;
    if (!app) continue;
    uniqueAppsMap.set(String(app._id), app);
  }

  let totalApproverRequests = 0;
  let totalApproved = 0;
  let totalPending = 0;
  let totalRejected = 0;
  let totalCancelled = 0;

  const pendingApplicationsMap = new Map();

  // Helper to sort steps chronologically by level
  const sortByLevel = (steps = []) =>
    [...steps].sort((a, b) => Number(a?.level || 0) - Number(b?.level || 0));

  // Matches the exact calculation logic from your wellnessApproval.service list endpoint
  const getEffectiveStatus = (app, myStep) => {
    const myStatus = String(myStep?.status || "").toUpperCase();
    const overall = String(app?.overallStatus || "").toUpperCase();

    if (myStatus === WELLNESS_STATUS.APPROVED) return WELLNESS_STATUS.APPROVED;
    if (myStatus === WELLNESS_STATUS.REJECTED) return WELLNESS_STATUS.REJECTED;
    if (
      myStatus === WELLNESS_STATUS.CANCELLED ||
      overall === WELLNESS_STATUS.CANCELLED
    )
      return WELLNESS_STATUS.CANCELLED;
    if (overall === WELLNESS_STATUS.REJECTED) return WELLNESS_STATUS.CANCELLED;

    return myStatus;
  };

  for (const app of uniqueAppsMap.values()) {
    const steps = Array.isArray(app.approvals) ? app.approvals : [];
    if (!steps.length) continue;

    const orderedSteps = sortByLevel(steps);

    // Grab the approver's earliest step on this application
    const myStep = orderedSteps.find(
      (s) => String(s?.approver?._id || s?.approver) === String(employeeId),
    );
    if (!myStep) continue;

    const myStatus = String(myStep.status || "").toUpperCase();
    const overallStatus = String(app.overallStatus || "").toUpperCase();

    // Check if it's their turn for PENDING requests
    let isTheirTurn = false;
    if (
      myStatus === WELLNESS_STATUS.PENDING &&
      overallStatus === WELLNESS_STATUS.PENDING
    ) {
      const pendingStep = orderedSteps.find(
        (s) => String(s.status || "").toUpperCase() === WELLNESS_STATUS.PENDING,
      );
      isTheirTurn =
        pendingStep &&
        String(pendingStep?.approver?._id || pendingStep?.approver) ===
          String(employeeId);
    }

    // STRICT FILTER: If it is pending but NOT their turn, exclude it entirely from stats
    if (myStatus === WELLNESS_STATUS.PENDING && !isTheirTurn) {
      continue;
    }

    // If it passed the filter above, it officially belongs in the supervisor's stats
    totalApproverRequests++;

    const effectiveStatus = getEffectiveStatus(app, myStep);

    if (effectiveStatus === WELLNESS_STATUS.APPROVED) {
      totalApproved++;
    } else if (effectiveStatus === WELLNESS_STATUS.REJECTED) {
      totalRejected++;
    } else if (effectiveStatus === WELLNESS_STATUS.CANCELLED) {
      totalCancelled++;
    } else if (effectiveStatus === WELLNESS_STATUS.PENDING) {
      totalPending++;
      pendingApplicationsMap.set(String(app._id), app);
    }
  }

  const allPendingRequests = Array.from(pendingApplicationsMap.values()).map(
    (app) => ({
      id: app._id,
      employeeId: app.employee._id,
      employeeName: `${app.employee.firstName} ${app.employee.lastName}`,
      requestedDays: app.totalDays || app.requestedDays, // ✅ Safely handle both
      inclusiveDates:
        app.inclusiveDates ||
        (app.startDate ? [app.startDate, app.endDate] : []),
      reason: app.reason,
      createdAt: app.createdAt,
    }),
  );

  const recentPendingRequests = allPendingRequests.slice(0, 5);

  return {
    myWellnessSummary,
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
  const myWellnessSummary = await getPersonalWellnessSummary(hrId);

  const [recentApplications, totalPendingRequests] = await Promise.all([
    WellnessApplication.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "totalDays requestedDays overallStatus inclusiveDates reason createdAt",
      )
      .populate("employee", "firstName lastName position")
      .lean(),
    WellnessApplication.countDocuments({
      overallStatus: WELLNESS_STATUS.PENDING,
    }),
  ]);

  return {
    myWellnessSummary,
    recentApplications,
    totalPendingRequests,
  };
}

async function getAdminSummary(adminId) {
  assertObjectId(adminId, "Admin ID");
  const hrData = await getHrSummary(adminId);

  const [totalRequests, approvedRequests, rejectedRequests] = await Promise.all(
    [
      WellnessApplication.countDocuments(),
      WellnessApplication.countDocuments({
        overallStatus: WELLNESS_STATUS.APPROVED,
      }),
      WellnessApplication.countDocuments({
        overallStatus: WELLNESS_STATUS.REJECTED,
      }),
    ],
  );

  return {
    ...hrData,
    totalRequests,
    approvedRequests,
    rejectedRequests,
  };
}

module.exports = {
  getPersonalWellnessSummary,
  getEmployeeSummary,
  getSupervisorSummary,
  getHrSummary,
  getAdminSummary,
};
