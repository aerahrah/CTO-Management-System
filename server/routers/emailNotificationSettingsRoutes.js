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

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];

// =============================
// EMAIL NOTIFICATION SETTINGS
// =============================

// Admin/HR can view all email notif switches
router.get(
  "/",
  ...requirePerm("settings.email"),
  getEmailNotificationSettingsController,
);

// Admin/HR can toggle a specific email key
// PUT /api/email-notification-settings/cto_approval
// body: { "enabled": true }
router.put(
  "/:key",
  ...requirePerm("settings.email"),
  updateEmailNotificationSettingController,
);

module.exports = router;
