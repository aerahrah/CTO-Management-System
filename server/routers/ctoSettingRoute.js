const express = require("express");
const {
  getApproversByDesignation,
  upsertApproverSetting,
  getAllApproverSettings,
  deleteApproverSetting,
} = require("../controllers/ctoApproverSettingController.js");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware.js");

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getAllApproverSettings
);
router.get(
  "/:provincialOfficeId",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getApproversByDesignation
);
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  upsertApproverSetting
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  deleteApproverSetting
);

module.exports = router;
