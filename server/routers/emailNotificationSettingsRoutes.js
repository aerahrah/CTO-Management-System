// routers/emailNotificationSettingsRoutes.js
const express = require("express");
const {
  getEmailNotificationSettingsController,
  updateEmailNotificationSettingController,
} = require("../controllers/emailNotificationSettingsController");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Admin/HR can view all email notif switches
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getEmailNotificationSettingsController,
);

// Admin/HR can toggle a specific email key
// PUT /api/email-notification-settings/cto_approval
// body: { "enabled": true }
router.put(
  "/:key",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  updateEmailNotificationSettingController,
);

module.exports = router;
