// controllers/auditLogController.js
const auditLogService = require("../services/auditLog.service");

const getAuditLogs = async (req, res) => {
  try {
    const logs = await auditLogService.getAuditLogs(req.query);
    return res.json(logs);
  } catch (err) {
    return res
      .status(err.statusCode || 500)
      .json({ message: err.message || "Failed to fetch audit logs" });
  }
};

module.exports = {
  getAuditLogs,
};
