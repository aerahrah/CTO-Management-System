const express = require("express");
const {
  // ✅ session controllers
  getSessionSettingsController,
  updateSessionSettingsController,

  // ✅ working days controllers
  getWorkingDaysSettingsController,
  updateWorkingDaysSettingsController,
} = require("../controllers/generalSettingsController");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// ✅ reuse auth middleware for these routes
const settingsAuth = [authenticateToken, authorizeRoles("admin", "hr")];

/* =========================
   SESSION SETTINGS
   ========================= */
router.get("/session", ...settingsAuth, getSessionSettingsController);
router.put("/session", ...settingsAuth, updateSessionSettingsController);

/* =========================
   WORKING DAYS SETTINGS
   ========================= */
router.get("/working-days", ...settingsAuth, getWorkingDaysSettingsController);
router.put(
  "/working-days",
  ...settingsAuth,
  updateWorkingDaysSettingsController,
);

module.exports = router;
