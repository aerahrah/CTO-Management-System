// controllers/ctoDashboardController.js
const ctoDashboardService = require("../services/ctoDashboard.service");

function sendError(res, err) {
  const status = err.statusCode || err.status || 500;
  return res
    .status(status)
    .json({ success: false, message: err.message || "Server Error" });
}

const ctoDashboardController = {
  getDashboard: async (req, res) => {
    try {
      const { id: employeeId, role } = req.user || {};
      if (!employeeId)
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });

      // 1. Everyone gets personal CTO summary
      let dashboardData =
        await ctoDashboardService.getEmployeeSummary(employeeId);

      // 2. Get supervisor-style pending approvals (regardless of role)
      const approverData =
        await ctoDashboardService.getSupervisorSummary(employeeId);

      dashboardData = {
        ...dashboardData,
        teamPendingApprovals: approverData.teamPendingApprovals || 0,
        pendingRequests: approverData.pendingRequests || [],
      };

      // 3. HR/Admin extra
      if (role === "hr" || role === "admin") {
        const hrData = await ctoDashboardService.getHrSummary(employeeId);
        dashboardData = { ...dashboardData, ...hrData };
      }

      // 4. Admin-only
      if (role === "admin") {
        const adminData = await ctoDashboardService.getAdminSummary(employeeId);
        dashboardData = { ...dashboardData, ...adminData };
      }

      // 5. Merge quickLinks last
      dashboardData.quickLinks = [
        ...(dashboardData.quickLinks || []),
        ...(approverData.quickLinks || []),
      ];

      return res.json({ success: true, data: dashboardData });
    } catch (err) {
      console.error(err);
      return sendError(res, err);
    }
  },
};

module.exports = ctoDashboardController;
