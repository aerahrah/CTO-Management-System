const express = require("express");
const router = express.Router();

const uploadCtoMemo = require("../middlewares/uploadCtoMemo.middleware.js");
const {
  authenticateToken,
  authorizeRoles,
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
const allow = (...roles) => [authenticateToken, authorizeRoles(...roles)];

/* =========================================
   CTO CREDITS
========================================= */
router.post(
  "/credits",
  ...allow("admin", "hr"),
  uploadCtoMemo,
  addCtoCreditRequest,
);

router.patch(
  "/credits/:creditId/rollback",
  ...allow("admin", "hr"),
  rollbackCreditedRequest,
);

router.get("/credits/all", ...allow("admin", "hr"), getAllCreditRequests);

router.get(
  "/credits/:employeeId/history",
  ...allow("admin", "hr"),
  getEmployeeCredits,
);

router.get(
  "/credits/my-credits",
  ...allow("admin", "hr", "employee", "supervisor"),
  getEmployeeCredits,
);

router.get(
  "/employee/:employeeId/details",
  ...allow("admin", "hr"),
  getEmployeeDetails,
);

/* =========================================
   CTO APPLICATIONS (EMPLOYEE / ADMIN VIEW)
========================================= */
router.post(
  "/applications/apply",
  ...allow("admin", "hr", "supervisor", "employee"),
  addCtoApplicationRequest,
);

router.get(
  "/applications/all",
  ...allow("admin", "hr", "supervisor", "employee"),
  getAllCtoApplicationsRequest,
);

router.get(
  "/applications/my-application",
  ...allow("admin", "hr", "supervisor", "employee"),
  getCtoApplicationsByEmployeeRequest,
);

router.get(
  "/applications/employee/:employeeId",
  ...allow("admin", "hr", "supervisor", "employee"),
  getCtoApplicationsByEmployeeRequest,
);

router.patch(
  "/applications/:id/cancel",
  ...allow("admin", "hr", "supervisor", "employee"),
  cancelCtoApplicationRequest,
);

/* =========================================
   APPROVER FLOW
========================================= */
router.get(
  "/applications/pending-count",
  ...allow("admin", "hr", "supervisor", "employee"),
  getPendingCountForApproverController,
);

router.get(
  "/applications/approvers",
  ...allow("admin", "hr", "supervisor", "employee"),
  getApproverOptions,
);

router.get(
  "/applications/approvers/my-approvals",
  ...allow("admin", "hr", "supervisor", "employee"),
  getCtoApplicationsForApprover,
);

router.get(
  "/applications/approvers/my-approvals/:id",
  ...allow("admin", "hr", "supervisor", "employee"),
  getCtoApplicationById,
);

router.post(
  "/applications/approver/:applicationId/approve",
  ...allow("admin", "hr", "supervisor", "employee"),
  approveCtoApplication,
);

router.put(
  "/applications/approver/:applicationId/reject",
  ...allow("admin", "hr", "supervisor", "employee"),
  rejectCtoApplication,
);

module.exports = router;
