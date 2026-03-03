// routes/userPreferenceRoute.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/userPreferencesController");

const { authenticateToken } = require("../middlewares/authMiddleware.js");

// self settings
router.get("/me", authenticateToken, controller.getMyPreferences);
router.patch("/me", authenticateToken, controller.updateMyPreferences);
router.post("/me/reset", authenticateToken, controller.resetMyPreferences);

// optional: frontend can fetch enums
router.get("/options", authenticateToken, controller.getPreferenceOptions);

module.exports = router;
