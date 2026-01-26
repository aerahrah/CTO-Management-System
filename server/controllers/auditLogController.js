// controllers/auditLog.controller.js
const auditLogService = require("../services/auditLog.service");

const getAuditLogs = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const logs = await auditLogService.getAuditLogs(req.query);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};

module.exports = {
  getAuditLogs,
};
