const ctoDashboardService = require("../services/ctoDashboard.service");

const ctoDashboardController = {
  getDashboard: async (req, res) => {
    try {
      const user = req.user; // assume JWT middleware sets req.user with role and _id
      let data;

      switch (user.role) {
        case "employee":
          data = await ctoDashboardService.getEmployeeSummary(user._id);
          break;
        case "supervisor":
          data = await ctoDashboardService.getSupervisorSummary(user._id);
          break;
        case "hr":
          data = await ctoDashboardService.getHrSummary();
          break;
        case "admin":
          data = await ctoDashboardService.getAdminSummary();
          break;
        default:
          return res.status(403).json({ message: "Role not allowed" });
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  },
};

module.exports = ctoDashboardController;
