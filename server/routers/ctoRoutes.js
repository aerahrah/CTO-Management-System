const express = require("express");
const router = express.Router();

const uploadCtoMemo = require("../middlewares/uploadCtoMemo.middleware.js");
const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware.js");

// --- CONTROLLERS ---
const {
  // Approver-side
  getApproverOptions,
  getPendingCountForApproverController,
  getCtoApplicationsForApprover,
  getCtoApplicationById,
  approveCtoApplication,
  rejectCtoApplication,
} = require("../controllers/ctoApplicationApproverController.js");

const {
  // Credits
  addCtoCreditRequest,
  rollbackCreditedRequest,
  getAllCreditRequests,
  getEmployeeDetails,
  getEmployeeCredits,
} = require("../controllers/ctoCreditController.js");

const {
  // Applications (employee/admin view)
  addCtoApplicationRequest,
  getAllCtoApplicationsRequest,
  getCtoApplicationsByEmployeeRequest,
  cancelCtoApplicationRequest,
} = require("../controllers/ctoApplicationController.js");

// --- AUTH HELPERS ---
const requirePerm = (perm) => [authenticateToken, authorize(perm)];
const authOnly = [authenticateToken];

/* =========================================
   CTO CREDITS
========================================= */
// Manage credits
router.post(
  "/credits",
  ...requirePerm("cto.credits_manage"),
  uploadCtoMemo,
  addCtoCreditRequest,
);

router.patch(
  "/credits/:creditId/rollback",
  ...requirePerm("cto.credits_manage"),
  rollbackCreditedRequest,
);

// View global credit records
router.get(
  "/credits/all",
  ...requirePerm("cto.credits_view"),
  getAllCreditRequests,
);

router.get(
  "/credits/:employeeId/history",
  ...requirePerm("cto.credits_view"),
  getEmployeeCredits,
);

router.get(
  "/employee/:employeeId/details",
  ...requirePerm("cto.records_view"),
  getEmployeeDetails,
);

// Self-service credit views
router.get(
  "/credits/my-credits",
  ...requirePerm("cto.view_self"),
  getEmployeeCredits,
);

/* =========================================
   CTO APPLICATIONS (EMPLOYEE / ADMIN VIEW)
========================================= */

// Apply for CTO
router.post(
  "/applications/apply",
  ...requirePerm("cto.create"),
  addCtoApplicationRequest,
);

// Admin View All Applications
router.get(
  "/applications/all",
  ...requirePerm("cto.applications_view"),
  getAllCtoApplicationsRequest,
);

// Admin View Specific Employee Applications
router.get(
  "/applications/employee/:employeeId",
  ...requirePerm("cto.applications_view"),
  getCtoApplicationsByEmployeeRequest,
);

// Self-service application views & actions
router.get(
  "/applications/my-application",
  ...requirePerm("cto.view_self"),
  getCtoApplicationsByEmployeeRequest,
);

router.patch(
  "/applications/:id/cancel",
  ...requirePerm("cto.view_self"),
  cancelCtoApplicationRequest,
);

/* =========================================
   APPROVER FLOW
========================================= */
// Kept as authOnly because these rely on the controller verifying
// if req.user._id matches the application's assigned supervisor/HR.

router.get(
  "/applications/pending-count",
  ...authOnly,
  getPendingCountForApproverController,
);

router.get("/applications/approvers", ...authOnly, getApproverOptions);

router.get(
  "/applications/approvers/my-approvals",
  ...requirePerm("cto.view_application"),
  getCtoApplicationsForApprover,
);

router.get(
  "/applications/approvers/my-approvals/:id",
  ...requirePerm("cto.view_application"),
  getCtoApplicationById,
);

router.post(
  "/applications/approver/:applicationId/approve",
  ...requirePerm("cto.manage_application"),
  approveCtoApplication,
);

router.put(
  "/applications/approver/:applicationId/reject",
  ...requirePerm("cto.manage_application"),
  rejectCtoApplication,
);

module.exports = router;
