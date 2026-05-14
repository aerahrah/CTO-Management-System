const express = require("express");
const router = express.Router();
const { getDashboard } = require("../controllers/ctoDashboardController");
const { authenticateToken } = require("../middlewares/authMiddleware");

router.get(
  "/dashboard",
  authenticateToken,
  getDashboard
);

module.exports = router;
