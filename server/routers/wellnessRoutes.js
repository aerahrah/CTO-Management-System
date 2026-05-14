const express = require("express");

const {
  addWellnessApplicationRequest,
  getAllWellnessApplicationsRequest,
  getWellnessApplicationsByEmployeeRequest,
  cancelWellnessApplicationRequest,
} = require("../controllers/wellnessApplicationController");

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
// WELLNESS APPLICATIONS
// =============================

// Create Application
router.post("/applications", ...authOnly, addWellnessApplicationRequest);

// Admin View All
router.get(
  "/applications",
  ...requirePerm("wellness.manage"),
  getAllWellnessApplicationsRequest,
);

// Employee Self View
router.get(
  "/applications/my-applications",
  ...authOnly,
  getWellnessApplicationsByEmployeeRequest,
);

// Admin View Employee Applications
router.get(
  "/applications/employee/:employeeId",
  ...requirePerm("wellness.manage"),
  getWellnessApplicationsByEmployeeRequest,
);

// Cancel Application
router.patch(
  "/applications/:id/cancel",
  ...authOnly,
  cancelWellnessApplicationRequest,
);

module.exports = router;
