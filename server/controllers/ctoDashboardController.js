const ctoDashboardService = require("../services/ctoDashboard.service");
const ctoDashboardController = {
  getDashboard: async (req, res) => {
    try {
      const { id: employeeId, role } = req.user;

      let dashboardData = {};

      // 1. Everyone gets personal CTO summary
      dashboardData = await ctoDashboardService.getEmployeeSummary(employeeId);

      // 2. Get supervisor-style pending approvals (regardless of role)
      const approverData =
        await ctoDashboardService.getSupervisorSummary(employeeId);

      // Always merge pending data
      dashboardData = {
        ...dashboardData,
        teamPendingApprovals: approverData.teamPendingApprovals || 0,
        pendingRequests: approverData.pendingRequests || [],
      };

      // 3. Add HR / Admin scope data
      if (role === "hr" || role === "admin") {
        const hrData = await ctoDashboardService.getHrSummary(employeeId);
        dashboardData = {
          ...dashboardData,
          ...hrData,
        };
      }

      // 4. Add admin-only system-wide metrics
      if (role === "admin") {
        const adminData = await ctoDashboardService.getAdminSummary(employeeId);
        dashboardData = {
          ...dashboardData,
          ...adminData,
        };
      }

      // 5. Merge quickLinks **last**, so we never overwrite
      dashboardData.quickLinks = [
        ...(dashboardData.quickLinks || []),
        ...(approverData.quickLinks || []), // adds "Approvals" link if there are pending approvals
      ];

      return res.json({ success: true, data: dashboardData });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  },
};

module.exports = ctoDashboardController;
