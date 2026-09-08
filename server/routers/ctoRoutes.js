// routes/ctoRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Helper function to ensure the upload directories exist
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// ✅ Custom Storage for CTO Revocation Attachments (preserves file extensions)
const revocationStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/cto/revocation/attachments/";
    ensureDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Generates a safe, unique filename: file-1683921345.pdf
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});
const uploadCtoRevocation = multer({ storage: revocationStorage });

// ✅ Custom Storage for CTO Application Attachments (Late Filing)
const applicationStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/cto/applications/attachments/";
    ensureDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});
const uploadCtoApplication = multer({ storage: applicationStorage });

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
  getRemainingCreditableHoursRequest, // ✅ Imported the new controller
} = require("../controllers/ctoCreditController.js");

const {
  // Applications (employee/admin view)
  addCtoApplicationRequest,
  getAllCtoApplicationsRequest,
  getCtoApplicationsByEmployeeRequest,
  getCtoRevocationByIdRequest,
  cancelCtoApplicationRequest,
  followUpCtoApplicationRequest,
  getRevocationRequestsController,
  requestRevocationController,
  cancelRevocationController,
  processRevocationController,
} = require("../controllers/ctoApplicationController.js");

// Organic Leaves Controllers
const {
  addOrganicLeaveRequest,
  getAllOrganicLeavesRequest,
  getOrganicLeavesByEmployeeRequest,
  cancelOrganicLeaveRequest,
} = require("../controllers/organicLeaveController.js");

// --- AUTH HELPERS ---
const requirePerm = (perm) => [authenticateToken, authorize(perm)];
const authOnly = [authenticateToken];

/* =========================================
   EMPLOYEE DETAILS
========================================= */
router.get(
  "/employee/:employeeId/details",
  ...requirePerm("cto.records_view"),
  getEmployeeDetails,
);

/* =========================================
   CTO CREDITS
========================================= */
// Static Routes First
router.get(
  "/credits/all",
  ...requirePerm("cto.credits_view"),
  getAllCreditRequests,
);

router.get(
  "/credits/my-credits",
  ...requirePerm("cto.view_self"),
  getEmployeeCredits,
);

// ✅ NEW: Route for an employee to check their own remaining creditable hours (CSC limits)
router.get(
  "/credits/my-remaining-hours",
  ...requirePerm("cto.view_self"),
  getRemainingCreditableHoursRequest,
);

router.post(
  "/credits",
  ...requirePerm("cto.credits_manage"),
  uploadCtoMemo,
  addCtoCreditRequest,
);

// Dynamic Routes Last
router.get(
  "/credits/:employeeId/history",
  ...requirePerm("cto.credits_view"),
  getEmployeeCredits,
);

// ✅ NEW: Route for HR/Admins to check a specific employee's remaining creditable hours
router.get(
  "/credits/employee/:employeeId/remaining-hours",
  ...requirePerm("cto.credits_view"),
  getRemainingCreditableHoursRequest,
);

router.patch(
  "/credits/:creditId/rollback",
  ...requirePerm("cto.credits_manage"),
  rollbackCreditedRequest,
);

/* =========================================
   CTO APPLICATIONS (Base)
========================================= */
// Static Routes First
router.get(
  "/applications/all",
  ...requirePerm("cto.applications_view"),
  getAllCtoApplicationsRequest,
);

router.get(
  "/applications/revocations",
  ...requirePerm("revocation.view_application"),
  getRevocationRequestsController,
);

router.get(
  "/applications/my-application",
  ...requirePerm("cto.view_self"),
  getCtoApplicationsByEmployeeRequest,
);

router.post(
  "/applications/apply",
  ...requirePerm("cto.manage_self"),
  uploadCtoApplication.single("file"), // ✅ Uses updated storage
  addCtoApplicationRequest,
);

// Dynamic Routes Last
router.get(
  "/applications/employee/:employeeId",
  ...requirePerm("cto.applications_view"),
  getCtoApplicationsByEmployeeRequest,
);

router.patch(
  "/applications/:applicationId/cancel",
  ...requirePerm("cto.manage_self"),
  cancelCtoApplicationRequest,
);

router.post(
  "/applications/:applicationId/follow-up",
  ...requirePerm("cto.manage_self"),
  followUpCtoApplicationRequest,
);

/* =========================================
   CTO APPLICATIONS (Approvers Flow)
========================================= */
// Static Routes First
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

// Dynamic Routes Last
router.get(
  "/applications/approvers/my-approvals/:applicationId",
  ...requirePerm("cto.view_application"),
  getCtoApplicationById,
);

router.post(
  "/applications/approvers/my-approvals/:applicationId/approve",
  ...requirePerm("cto.manage_application"),
  approveCtoApplication,
);

router.put(
  "/applications/approvers/my-approvals/:applicationId/reject",
  ...requirePerm("cto.manage_application"),
  rejectCtoApplication,
);

/* =========================================
   CTO REVOCATIONS
========================================= */

router.get(
  "/revocation/applications/:applicationId",
  ...requirePerm("revocation.view_application"),
  getCtoRevocationByIdRequest,
);

router.post(
  "/revocation/applications/:applicationId/revoke-request",
  ...requirePerm("revocation.manage_self"),
  uploadCtoRevocation.single("file"), // ✅ Uses updated storage
  requestRevocationController,
);

router.patch(
  "/revocation/applications/:applicationId/cancel-request",
  ...requirePerm("revocation.manage_self"),
  cancelRevocationController,
);

router.patch(
  "/revocation/applications/:applicationId/revoke-process",
  ...requirePerm("revocation.manage_application"),
  processRevocationController,
);

module.exports = router;
