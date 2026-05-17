// routes/wellnessRoutes.js
const express = require("express");
const router = express.Router();

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware.js");

// --- CONTROLLERS ---
const {
  // Approver-side
  getPendingCountForWellnessApproverController,
  getWellnessApplicationsForApprover,
  getWellnessApplicationById,
  approveWellnessApplication,
  rejectWellnessApplication,
} = require("../controllers/wellnessApplicationApprovalController.js");

const {
  // Applications (employee/admin view)
  addWellnessApplicationRequest,
  getAllWellnessApplicationsRequest,
  getWellnessApplicationsByEmployeeRequest,
  cancelWellnessApplicationRequest,
} = require("../controllers/wellnessApplicationController.js");

// --- AUTH HELPERS ---
const requirePerm = (perm) => [authenticateToken, authorize(perm)];
const authOnly = [authenticateToken];

/* =========================================
   WELLNESS APPLICATIONS (EMPLOYEE / ADMIN VIEW)
========================================= */

// Apply for Wellness Leave
router.post(
  "/applications/apply",
  ...requirePerm("wellness.create"),
  addWellnessApplicationRequest,
);

// Admin View All Wellness Applications
router.get(
  "/applications/all",
  ...requirePerm("wellness.applications_view"),
  getAllWellnessApplicationsRequest,
);

// Admin View Specific Employee Applications
router.get(
  "/applications/employee/:employeeId",
  ...requirePerm("wellness.applications_view"),
  getWellnessApplicationsByEmployeeRequest,
);

// Self-service application views & actions
router.get(
  "/applications/my-application",
  ...requirePerm("wellness.view_self"),
  getWellnessApplicationsByEmployeeRequest,
);

router.patch(
  "/applications/:id/cancel",
  ...requirePerm("wellness.view_self"),
  cancelWellnessApplicationRequest,
);

/* =========================================
   APPROVER FLOW
========================================= */
// Kept as authOnly because these rely on the controller verifying
// if req.user._id matches the application's assigned approver.

router.get(
  "/applications/pending-count",
  ...authOnly,
  getPendingCountForWellnessApproverController,
);

router.get(
  "/applications/approvers/my-approvals",
  ...requirePerm("wellness.view_application"),
  getWellnessApplicationsForApprover,
);

router.get(
  "/applications/approvers/my-approvals/:id",
  ...requirePerm("wellness.view_application"),
  getWellnessApplicationById,
);

router.post(
  "/applications/approver/:applicationId/approve",
  ...requirePerm("wellness.manage_application"),
  approveWellnessApplication,
);

router.put(
  "/applications/approver/:applicationId/reject",
  ...requirePerm("wellness.manage_application"),
  rejectWellnessApplication,
);

module.exports = router;
