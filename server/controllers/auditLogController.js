// controllers/auditLogController.js
const auditLogService = require("../services/auditLog.service");

const getAuditLogs = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const logs = await auditLogService.getAuditLogs(req.query);
    return res.json(logs);
  } catch (err) {
    console.error("Audit log fetch error:", err);
    return res
      .status(err.statusCode || 500)
      .json({ message: err.message || "Failed to fetch audit logs" });
  }
};

module.exports = {
  getAuditLogs,
};
