// routes/auditLog.routes.js
const express = require("express");
const router = express.Router();
const auditLogController = require("../controllers/auditLogController");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware");

router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  auditLogController.getAuditLogs,
);

module.exports = router;
