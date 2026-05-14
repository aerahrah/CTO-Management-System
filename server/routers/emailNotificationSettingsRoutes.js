// routers/emailNotificationSettingsRoutes.js
const express = require("express");
const {
  getEmailNotificationSettingsController,
  updateEmailNotificationSettingController,
} = require("../controllers/emailNotificationSettingsController");

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Admin/HR can view all email notif switches
router.get(
  "/",
  authenticateToken,
  authorize("settings.edit"),
  getEmailNotificationSettingsController,
);

// Admin/HR can toggle a specific email key
// PUT /api/email-notification-settings/cto_approval
// body: { "enabled": true }
router.put(
  "/:key",
  authenticateToken,
  authorize("settings.edit"),
  updateEmailNotificationSettingController,
);

module.exports = router;
