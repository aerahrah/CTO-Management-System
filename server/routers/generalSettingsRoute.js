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
  authorize,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];

/* =========================
   SESSION SETTINGS
   ========================= */
router.get(
  "/session",
  ...requirePerm("settings.sessions"),
  getSessionSettingsController,
);

router.put(
  "/session",
  ...requirePerm("settings.sessions"),
  updateSessionSettingsController,
);

/* =========================
   WORKING DAYS SETTINGS
   ========================= */
router.get(
  "/working-days",
  ...requirePerm("settings.general"),
  getWorkingDaysSettingsController,
);

router.get(
  "/working-days/public",
  authenticateToken,
  getWorkingDaysSettingsController,
);

router.put(
  "/working-days",
  ...requirePerm("settings.general"),
  updateWorkingDaysSettingsController,
);

module.exports = router;
