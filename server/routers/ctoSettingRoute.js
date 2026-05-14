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

router.get(
  "/",
  authenticateToken,
  authorize("settings.edit"),
  getAllApproverSettings,
);
router.get(
  "/:designationId",
  authenticateToken,
  // We can just rely on authenticateToken since anyone can get settings
  // But strictly, anyone with basic viewing permissions
  // Let's just remove authorize for reading settings

  getApproversByDesignation,
);
router.post(
  "/",
  authenticateToken,
  authorize("settings.edit"),
  upsertApproverSetting,
);
router.delete(
  "/:id",
  authenticateToken,
  authorize("settings.edit"),
  deleteApproverSetting,
);

module.exports = router;
