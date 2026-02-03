const Employee = require("../models/employeeModel");
const CtoApplication = require("../models/ctoApplicationModel");
const CtoCredit = require("../models/ctoCreditModel");
const ApprovalStep = require("../models/approvalStepModel");

const ctoDashboardService = {
  // --- Personal CTO Summary (for reuse) ---
  getPersonalCtoSummary: async (employeeId) => {
    const employee =
      await Employee.findById(employeeId).select("balances ctoHours");

    if (!employee) {
      console.warn(`Employee not found: ${employeeId}`);
      return {
        balance: 0,
        used: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalRequests: 0, // total count of all requests
      };
    }

    // Count by status
    const [approvedCount, pendingCount, rejectedCount, totalCount] =
      await Promise.all([
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
      ]);

    // Used hours comes from approved applications
    const approvedApplications = await CtoApplication.find({
      employee: employeeId,
      overallStatus: "APPROVED",
    });
    const usedHours = approvedApplications.reduce(
      (sum, app) => sum + app.requestedHours,
      0,
    );

    const recentRequests = await CtoApplication.find({ employee: employeeId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("requestedHours overallStatus inclusiveDates reason createdAt")
      .lean();

    return {
      balance: employee.balances?.ctoHours || 0,
      used: usedHours,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      totalRequests: totalCount,
      recentRequests,
    };
  },

  // --- Employee ---
  getEmployeeSummary: async (employeeId) => {
    const myCtoSummary =
      await ctoDashboardService.getPersonalCtoSummary(employeeId);

    return {
      myCtoSummary,
      quickActions: [{ name: "Apply for CTO", link: "/app/cto/apply" }],
    };
  },

  // --- Supervisor ---
  getSupervisorSummary: async (employeeId) => {
    const myCtoSummary =
      await ctoDashboardService.getPersonalCtoSummary(employeeId);

    // Fetch all approval steps for this approver
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
      if (!app || !app.approvals || app.approvals.length === 0) continue;
      if (app.overallStatus === "REJECTED") continue;

      const steps = app.approvals;
      const userStepIndex = steps.findIndex(
        (s) => s.approver?._id?.toString() === employeeId.toString(),
      );
      if (userStepIndex === -1) continue;

      const userStep = steps[userStepIndex];
      if (userStep.status === "REJECTED") continue;

      // Only include if it's their turn
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

    // For dashboard, only show recent 5
    const recentPendingRequests = allPendingRequests.slice(0, 5);

    // Add quick link if at least 1 pending approval exists
    const quickLinks =
      allPendingRequests.length > 0
        ? [{ name: "Approvals", link: "/app/cto/approvals" }]
        : [];

    return {
      myCtoSummary,
      teamPendingApprovals: allPendingRequests.length,
      pendingRequests: recentPendingRequests,
      quickLinks,
    };
  },
  // --- HR ---
  getHrSummary: async (hrId) => {
    const myCtoSummary = await ctoDashboardService.getPersonalCtoSummary(hrId);

    const recentCredits = await CtoCredit.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("employees.employee");

    const totalCreditedCount = await CtoCredit.countDocuments({
      status: "CREDITED",
    });

    const totalRolledBackCount = await CtoCredit.countDocuments({
      status: "ROLLEDBACK",
    });

    const totalPendingRequests = await CtoApplication.countDocuments({
      overallStatus: "PENDING",
    });

    return {
      myCtoSummary,
      recentCredits,
      totalCreditedCount,
      totalRolledBackCount,
      totalPendingRequests,
      quickLinks: [
        { name: "CTO Records", link: "/app/cto/records" },
        { name: "Manage Credits", link: "/app/cto/credit" },
        { name: "Reports", link: "/app/cto/records" },
      ],
    };
  },

  // --- Admin (refactored) ---
  getAdminSummary: async (adminId) => {
    // Reuse HR summary
    const hrData = await ctoDashboardService.getHrSummary(adminId);

    // Add admin-specific data
    const totalRequests = await CtoApplication.countDocuments();
    const approvedRequests = await CtoApplication.countDocuments({
      overallStatus: "APPROVED",
    });
    const rejectedRequests = await CtoApplication.countDocuments({
      overallStatus: "REJECTED",
    });

    const credits = await CtoCredit.find();
    const totalCredited = credits.reduce((sum, c) => sum + c.totalHours, 0);
    const rolledBack = credits
      .filter((c) => c.status === "ROLLEDBACK")
      .reduce((sum, c) => sum + c.totalHours, 0);

    return {
      ...hrData, // include all HR summary data
      totalRequests,
      approvedRequests,
      rejectedRequests,
      totalCredited,
      rolledBack,
    };
  },
};

module.exports = ctoDashboardService;
