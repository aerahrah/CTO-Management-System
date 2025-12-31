const Employee = require("../models/employeeModel");
const CtoApplication = require("../models/ctoApplicationModel");
const CtoCredit = require("../models/ctoCreditModel");
const ApprovalStep = require("../models/approvalStepModel");

const ctoDashboardService = {
  // --- Personal CTO Summary (for reuse) ---
  getPersonalCtoSummary: async (employeeId) => {
    const employee = await Employee.findById(employeeId).select(
      "balances ctoHours"
    );

    if (!employee) {
      console.warn(`Employee not found: ${employeeId}`);
      return {
        balance: 0,
        used: 0,
        pending: 0,
        approved: 0, // new
      };
    }

    const approvedApplications = await CtoApplication.find({
      employee: employeeId,
      overallStatus: "APPROVED",
    });
    const usedHours = approvedApplications.reduce(
      (sum, app) => sum + app.requestedHours,
      0
    );

    const pendingApplications = await CtoApplication.find({
      employee: employeeId,
      overallStatus: "PENDING",
    });

    return {
      balance: employee.balances?.ctoHours || 0,
      used: usedHours,
      pending: pendingApplications.length, // now returns count
      approved: approvedApplications.length, // new
    };
  },

  // --- Employee ---
  getEmployeeSummary: async (employeeId) => {
    const myCtoSummary = await ctoDashboardService.getPersonalCtoSummary(
      employeeId
    );

    return {
      myCtoSummary,
      quickActions: [{ name: "Apply for CTO", link: "/dashboard/cto/apply" }],
    };
  },

  // --- Supervisor ---
  getSupervisorSummary: async (supervisorId) => {
    const myCtoSummary = await ctoDashboardService.getPersonalCtoSummary(
      supervisorId
    );

    const supervisor = await Employee.findById(supervisorId).select(
      "department"
    );
    const teamMembers = await Employee.find({
      department: supervisor.department,
      _id: { $ne: supervisorId },
    });

    const teamPendingApplications = await CtoApplication.find({
      overallStatus: "PENDING",
    }).populate("approvals");

    const pendingForSupervisor = teamPendingApplications.filter((app) =>
      app.approvals.some(
        (step) =>
          step.approver.toString() === supervisorId.toString() &&
          step.status === "PENDING"
      )
    );

    const teamCtoUsage = await Promise.all(
      teamMembers.map(async (member) => {
        const approvedApps = await CtoApplication.find({
          employee: member._id,
          overallStatus: "APPROVED",
        });
        const usedHours = approvedApps.reduce(
          (sum, app) => sum + app.requestedHours,
          0
        );
        return {
          employeeId: member._id,
          name: `${member.firstName} ${member.lastName}`,
          balance: member.balances.ctoHours,
          used: usedHours,
        };
      })
    );

    return {
      myCtoSummary,
      teamPendingApprovals: pendingForSupervisor.length,
      teamCtoUsage,
      quickLinks: [{ name: "Approvals", link: "/dashboard/cto/approvals" }],
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
        { name: "CTO Records", link: "/dashboard/cto/records" },
        { name: "Manage Credits", link: "/dashboard/cto/credit" },
        { name: "Reports", link: "/dashboard/cto/records" },
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
