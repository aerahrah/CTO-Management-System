const express = require("express");
const router = express.Router();
const auditLogController = require("../controllers/auditLogController");
const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware");

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];

// =============================
// AUDIT LOGS
// =============================

router.get("/", ...requirePerm("audit.view"), auditLogController.getAuditLogs);

module.exports = router;
