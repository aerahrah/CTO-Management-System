const express = require("express");
const router = express.Router();
const { getDashboard } = require("../controllers/ctoDashboardController");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware");

router.get(
  "/dashboard",
  authenticateToken,
  authorizeRoles("employee", "supervisor", "hr", "admin"),
  getDashboard
);

module.exports = router;
