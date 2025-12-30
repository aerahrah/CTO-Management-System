const Employee = require("../models/employeeModel");
const CtoApplication = require("../models/ctoApplicationModel");
const CtoCredit = require("../models/ctoCreditModel");
const ApprovalStep = require("../models/approvalStepModel");

const ctoDashboardService = {
  // Employee: personal summary
  getEmployeeSummary: async (employeeId) => {
    // Current CTO balance
    const employee = await Employee.findById(employeeId).select(
      "balances ctoHours"
    );

    // Used CTO hours (approved requests)
    const approvedApplications = await CtoApplication.find({
      employee: employeeId,
      overallStatus: "APPROVED",
    });

    const usedHours = approvedApplications.reduce(
      (sum, app) => sum + app.requestedHours,
      0
    );

    // Pending requests
    const pendingApplications = await CtoApplication.find({
      employee: employeeId,
      overallStatus: "PENDING",
    });
    const pendingHours = pendingApplications.reduce(
      (sum, app) => sum + app.requestedHours,
      0
    );

    return {
      myCtoSummary: {
        balance: employee.balances.ctoHours,
        used: usedHours,
        pending: pendingHours,
      },
      quickActions: [{ name: "Apply for CTO", link: "/dashboard/cto/apply" }],
    };
  },

  // Supervisor: personal + team summary
  getSupervisorSummary: async (supervisorId) => {
    const employeeSummary = await ctoDashboardService.getEmployeeSummary(
      supervisorId
    );

    // Find team members (simple: same department, excluding supervisor)
    const supervisor = await Employee.findById(supervisorId).select(
      "department"
    );
    const teamMembers = await Employee.find({
      department: supervisor.department,
      _id: { $ne: supervisorId },
    });

    // Team pending approvals
    const teamPendingApplications = await CtoApplication.find({
      overallStatus: "PENDING",
    }).populate("approvals");

    // Filter applications where supervisor is an approver
    const pendingForSupervisor = teamPendingApplications.filter((app) =>
      app.approvals.some(
        (step) =>
          step.approver.toString() === supervisorId.toString() &&
          step.status === "PENDING"
      )
    );

    // Team CTO usage
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
      ...employeeSummary,
      teamPendingApprovals: pendingForSupervisor.length,
      teamCtoUsage,
      quickLinks: [{ name: "Approvals", link: "/dashboard/cto/approvals" }],
    };
  },

  // HR: personal + all employees overview
  getHrSummary: async () => {
    // Personal summary can be skipped or included
    // All CTO requests
    const allApplications = await CtoApplication.find()
      .populate("employee")
      .populate("memo");

    // CTO hours distribution per department
    const employees = await Employee.find();
    const departmentDistribution = {};
    for (let emp of employees) {
      if (!departmentDistribution[emp.department])
        departmentDistribution[emp.department] = 0;
      departmentDistribution[emp.department] += emp.balances.ctoHours;
    }

    // Recently credited / rolled back
    const recentCredits = await CtoCredit.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("employees.employee");

    return {
      allApplications,
      departmentDistribution,
      recentCredits,
      quickLinks: [
        { name: "CTO Records", link: "/dashboard/cto/records" },
        { name: "Manage Credits", link: "/dashboard/cto/credit" },
        { name: "Reports", link: "/dashboard/cto/records" },
      ],
    };
  },

  // Admin: system-wide stats
  getAdminSummary: async () => {
    // Total requests stats
    const totalRequests = await CtoApplication.countDocuments();
    const approvedRequests = await CtoApplication.countDocuments({
      overallStatus: "APPROVED",
    });
    const rejectedRequests = await CtoApplication.countDocuments({
      overallStatus: "REJECTED",
    });

    // Total CTO hours credited / rolled back
    const credits = await CtoCredit.find();
    const totalCredited = credits.reduce((sum, c) => sum + c.totalHours, 0);
    const rolledBack = credits
      .filter((c) => c.status === "ROLLEDBACK")
      .reduce((sum, c) => sum + c.totalHours, 0);

    // Top employees by CTO usage
    const employees = await Employee.find();
    const usageStats = await Promise.all(
      employees.map(async (emp) => {
        const approvedApps = await CtoApplication.find({
          employee: emp._id,
          overallStatus: "APPROVED",
        });
        const usedHours = approvedApps.reduce(
          (sum, app) => sum + app.requestedHours,
          0
        );
        return {
          employeeId: emp._id,
          name: `${emp.firstName} ${emp.lastName}`,
          usedHours,
        };
      })
    );
    usageStats.sort((a, b) => b.usedHours - a.usedHours);
    const topEmployees = usageStats.slice(0, 5);

    return {
      totalRequests,
      approvedRequests,
      rejectedRequests,
      totalCredited,
      rolledBack,
      topEmployees,
      quickLinks: [
        { name: "Manage Employees", link: "/dashboard/employees" },
        { name: "CTO Records", link: "/dashboard/cto/records" },
        { name: "Credits", link: "/dashboard/cto/credit" },
        { name: "Settings", link: "/dashboard/settings" },
      ],
    };
  },
};

module.exports = ctoDashboardService;
