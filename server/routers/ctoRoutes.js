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
router.post(
  "/credits",
  ...requirePerm("settings.edit"), // Kept from your original, though you might consider a dedicated cto.edit_credits later
  uploadCtoMemo,
  addCtoCreditRequest,
);

router.patch(
  "/credits/:creditId/rollback",
  ...requirePerm("settings.edit"),
  rollbackCreditedRequest,
);

router.get(
  "/credits/all",
  ...requirePerm("cto.view_all"),
  getAllCreditRequests,
);

router.get(
  "/credits/:employeeId/history",
  ...requirePerm("cto.view_all"),
  getEmployeeCredits,
);

// ✅ Updated: Now strictly requires the "cto.view_self" permission
router.get(
  "/credits/my-credits",
  ...requirePerm("cto.view_self"),
  getEmployeeCredits,
);

router.get(
  "/employee/:employeeId/details",
  ...requirePerm("cto.view_all"),
  getEmployeeDetails,
);

/* =========================================
   CTO APPLICATIONS (EMPLOYEE / ADMIN VIEW)
========================================= */
// ✅ Updated: Now requires "cto.create" to submit an application
router.post(
  "/applications/apply",
  ...requirePerm("cto.create"),
  addCtoApplicationRequest,
);

router.get(
  "/applications/all",
  ...requirePerm("cto.view_all"),
  getAllCtoApplicationsRequest,
);

// ✅ Updated: Restricts viewing own applications to "cto.view_self"
router.get(
  "/applications/my-application",
  ...requirePerm("cto.view_self"),
  getCtoApplicationsByEmployeeRequest,
);

router.get(
  "/applications/employee/:employeeId",
  ...requirePerm("cto.view_all"),
  getCtoApplicationsByEmployeeRequest,
);

// ✅ Updated: Assuming if you can view your own, you can cancel it (controller should verify ownership)
router.patch(
  "/applications/:id/cancel",
  ...requirePerm("cto.view_self"),
  cancelCtoApplicationRequest,
);

/* =========================================
   APPROVER FLOW
========================================= */
// Note: Kept as authOnly because these usually rely on the controller verifying
// if req.user._id matches the application's supervisorId or if they are HR.

router.get(
  "/applications/pending-count",
  ...authOnly,
  getPendingCountForApproverController,
);

router.get(
  "/applications/approvers",
  ...authOnly, // Everyone needs to see this to populate the dropdown when applying
  getApproverOptions,
);

router.get(
  "/applications/approvers/my-approvals",
  ...authOnly,
  getCtoApplicationsForApprover,
);

router.get(
  "/applications/approvers/my-approvals/:id",
  ...authOnly,
  getCtoApplicationById,
);

router.post(
  "/applications/approver/:applicationId/approve",
  ...authOnly,
  approveCtoApplication,
);

router.put(
  "/applications/approver/:applicationId/reject",
  ...authOnly,
  rejectCtoApplication,
);

module.exports = router;
