// routes/userPreferenceRoutes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/userPreferencesController.js");

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware.js");

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];
const authOnly = [authenticateToken];

// =============================
// USER PREFERENCES (Self-Service)
// =============================
// These routes are kept as `authOnly` because every logged-in employee
// should be able to change their own UI theme and accent color without
// needing a specific database permission.

// Get own preferences
router.get("/me", ...authOnly, controller.getMyPreferences);

// Update own preferences
router.patch("/me", ...authOnly, controller.updateMyPreferences);

// Reset own preferences to default
router.post("/me/reset", ...authOnly, controller.resetMyPreferences);

// Frontend fetch for available theme/accent options
router.get("/options", ...authOnly, controller.getPreferenceOptions);

module.exports = router;
