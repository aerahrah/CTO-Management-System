const express = require("express");
const {
  getApproversByDesignation,
  upsertApproverSetting,
  getAllApproverSettings,
  deleteApproverSetting,
} = require("../controllers/ctoApproverSettingController.js");

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware.js");

const router = express.Router();

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];
const authOnly = [authenticateToken];

// =============================
// CTO APPROVER SETTINGS
// =============================

// View all settings (for the main settings table)
router.get(
  "/",
  ...requirePerm("settings.cto_workflow"),
  getAllApproverSettings,
);

// Get approvers for a specific designation
// (Needed by employees when filing applications to resolve their approval chain)
router.get("/:designationId", ...authOnly, getApproversByDesignation);

// Create or Update an approver setting
router.post(
  "/",
  ...requirePerm("settings.cto_workflow"),
  upsertApproverSetting,
);

// Delete an approver setting
router.delete(
  "/:id",
  ...requirePerm("settings.cto_workflow"),
  deleteApproverSetting,
);

module.exports = router;
