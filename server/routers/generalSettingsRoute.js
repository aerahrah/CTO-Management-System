const express = require("express");
const {
  getGeneralSettingsController,
  updateGeneralSettingsController,
} = require("../controllers/generalSettingsController");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/session",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getGeneralSettingsController,
);

router.put(
  "/session",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  updateGeneralSettingsController,
);

module.exports = router;
