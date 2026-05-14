// routes/auditLog.routes.js
const express = require("express");
const router = express.Router();
const auditLogController = require("../controllers/auditLogController");
const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware");

router.get(
  "/",
  authenticateToken,
  authorize("settings.view"),
  auditLogController.getAuditLogs,
);

module.exports = router;
