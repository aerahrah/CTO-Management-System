const express = require("express");
const router = express.Router();
const {
  getCtoApplicationsForApprover,
  approveCtoApplication,
  rejectCtoApplication,
} = require("../controllers/ctoApplicationApproverController.js");
const {
  addCtoCreditRequest,
  rollbackCreditedRequest,
  getRecentCreditRequests,
  getAllCreditRequests,
  getEmployeeDetails,
  getEmployeeCredits,
  // approveOrRejectCredit,
  // cancelCreditRequest,
  // getEmployeeById,
} = require("../controllers/ctoCreditController.js");

const {
  addCtoApplicationRequest,
  getMyCtoApplicationsRequest,
} = require("../controllers/ctoApplicationController.js");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware.js");

router.post(
  "/credits",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  addCtoCreditRequest
);

// router.patch(
//   "/credits/:creditId/decision",
//   authenticateToken,
//   authorizeRoles("admin", "hr"),
//   approveOrRejectCredit
// );

// router.patch(
//   "/credits/:creditId/cancel",
//   authenticateToken,
//   authorizeRoles("admin", "hr"),
//   cancelCreditRequest
// );

router.patch(
  "/credits/:creditId/rollback",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  rollbackCreditedRequest
);
router.get(
  "/credits/all",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getAllCreditRequests
);

router.get(
  "/credits/recent",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getRecentCreditRequests
);

router.get(
  "/credits/:employeeId/history",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getEmployeeCredits
);

router.get(
  "/employee/:employeeId/details",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getEmployeeDetails
);

router.post(
  "/applications/apply",
  authenticateToken,
  authorizeRoles("admin", "hr", "supervisor", "employee"),
  addCtoApplicationRequest
);

router.get(
  "/applications/my-application",
  authenticateToken,
  authorizeRoles("admin", "hr", "supervisor", "employee"),
  getMyCtoApplicationsRequest
);

router.get(
  "/applications/approvers/my-approvals",
  authenticateToken,
  authorizeRoles("admin", "hr", "supervisor", "employee"),
  getCtoApplicationsForApprover
);

router.post(
  "/applications/approver/:applicationId/approve",
  authenticateToken,
  authorizeRoles("admin", "hr", "supervisor", "employee"),
  approveCtoApplication
);

router.put(
  "/applications/approver/:applicationId/reject",
  authenticateToken,
  authorizeRoles("admin", "hr", "supervisor", "employee"),
  rejectCtoApplication
);
// router.get(
//   "/employees/:id",
//   authenticateToken,
//   authorizeRoles("admin", "hr", "supervisor"),
//   getEmployeeById
// );

module.exports = router;
