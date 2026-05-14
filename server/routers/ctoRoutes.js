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
  ...requirePerm("settings.edit"),
  uploadCtoMemo,
  addCtoCreditRequest,
);

router.patch(
  "/credits/:creditId/rollback",
  ...requirePerm("settings.edit"),
  rollbackCreditedRequest,
);

router.get("/credits/all", ...requirePerm("cto.view_all"), getAllCreditRequests);

router.get(
  "/credits/:employeeId/history",
  ...requirePerm("cto.view_all"),
  getEmployeeCredits,
);

router.get(
  "/credits/my-credits",
  ...authOnly,
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
router.post(
  "/applications/apply",
  ...authOnly,
  addCtoApplicationRequest,
);

router.get(
  "/applications/all",
  ...requirePerm("cto.view_all"),
  getAllCtoApplicationsRequest,
);

router.get(
  "/applications/my-application",
  ...authOnly,
  getCtoApplicationsByEmployeeRequest,
);

router.get(
  "/applications/employee/:employeeId",
  ...requirePerm("cto.view_all"),
  getCtoApplicationsByEmployeeRequest,
);

router.patch(
  "/applications/:id/cancel",
  ...authOnly,
  cancelCtoApplicationRequest,
);

/* =========================================
   APPROVER FLOW
========================================= */
router.get(
  "/applications/pending-count",
  ...authOnly,
  getPendingCountForApproverController,
);

router.get(
  "/applications/approvers",
  ...authOnly,
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
