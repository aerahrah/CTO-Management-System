// routes/wellnessRoutes.js
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

// Set up temporary storage for uploaded memos before the controller moves them
const upload = multer({ dest: "uploads/temp/" });

// ✅ Custom Storage for Wellness Revocation Attachments (preserves file extensions)
const revocationStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/wellness/revocation/attachments/";
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
const uploadWellnessRevocation = multer({ storage: revocationStorage });

// ✅ Custom Storage for Wellness Application Attachments (Late Filing)
const applicationStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/wellness/applications/attachments/";
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
const uploadWellnessApplication = multer({ storage: applicationStorage });

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
  getWellnessRevocationByIdRequest,
  cancelWellnessApplicationRequest,
  followUpWellnessApplicationRequest,
  requestRevocationWellnessController,
  processRevocationWellnessController,
  getRevocationRequestsController,
  cancelRevocationWellnessController,
} = require("../controllers/wellnessApplicationController.js");

const {
  // Wellness Credits (HR/Admin management)
  addWellnessCreditRequest,
  rollbackWellnessCreditRequest,
  getAllWellnessCreditRequests,
  getEmployeeDetails,
  getEmployeeWellnessCredits,
  triggerYearEndReset, // ✅ Added this import
} = require("../controllers/wellnessCreditController.js");

// --- AUTH HELPERS ---
const requirePerm = (perm) => [authenticateToken, authorize(perm)];
const authOnly = [authenticateToken];

/* =========================================
   WELLNESS APPLICATIONS - STATIC GET ROUTES 
   (These MUST come before any dynamic /:id routes)
========================================= */

// Admin View All Wellness Applications
router.get(
  "/applications/all",
  ...requirePerm("wellness.view_all"),
  getAllWellnessApplicationsRequest,
);

// Admin View All Revocation Requests
router.get(
  "/applications/revocations",
  ...requirePerm("revocation.view_application"),
  getRevocationRequestsController,
);

// Self-service application views & actions
router.get(
  "/applications/my-application",
  ...requirePerm("wellness.view_self"),
  getWellnessApplicationsByEmployeeRequest,
);

// Approver pending count
router.get(
  "/applications/pending-count",
  ...authOnly,
  getPendingCountForWellnessApproverController,
);

// Approver list of approvals
router.get(
  "/applications/approvers/my-approvals",
  ...requirePerm("wellness.view_application"),
  getWellnessApplicationsForApprover,
);

/* =========================================
   WELLNESS APPLICATIONS - DYNAMIC GET ROUTES 
   (These catch parameters like IDs)
========================================= */

// Approver specific approval details
router.get(
  "/applications/approvers/my-approvals/:id",
  ...requirePerm("wellness.view_application"),
  getWellnessApplicationById,
);

// Admin View Specific Employee Applications
router.get(
  "/applications/employee/:employeeId",
  ...requirePerm("wellness.view_all"),
  getWellnessApplicationsByEmployeeRequest,
);

// Admin View Specific Application By ID
router.get(
  "/revocation/applications/:id",
  ...requirePerm("revocation.manage_application"),
  getWellnessRevocationByIdRequest,
);

/* =========================================
   WELLNESS APPLICATIONS - POST / PATCH / PUT
   (Method-specific, order is less strict here)
========================================= */

// Apply for Wellness Leave
router.post(
  "/applications/apply",
  ...requirePerm("wellness.manage_self"),
  uploadWellnessApplication.single("file"),
  addWellnessApplicationRequest,
);

// Cancel Application
router.patch(
  "/applications/:id/cancel",
  ...requirePerm("wellness.manage_self"),
  cancelWellnessApplicationRequest,
);

// Follow-up Route
router.post(
  "/applications/:id/follow-up",
  ...requirePerm("wellness.manage_self"),
  followUpWellnessApplicationRequest,
);

// Employee requests revocation of an approved leave
router.post(
  "/revocation/applications/:id/revoke-request",
  ...requirePerm("revocation.manage_self"),
  uploadWellnessRevocation.single("file"),
  requestRevocationWellnessController,
);

// Employee cancels their pending revocation request
router.patch(
  "/revocation/applications/:id/cancel-request",
  ...requirePerm("revocation.manage_self"),
  cancelRevocationWellnessController,
);

// HR processes (approves/rejects) the revocation request
router.patch(
  "/revocation/applications/:id/revoke-process",
  ...requirePerm("revocation.manage_application"),
  processRevocationWellnessController,
);

// Approver Approves
router.post(
  "/applications/approvers/my-approvals/:applicationId/approve",
  ...requirePerm("wellness.manage_application"),
  approveWellnessApplication,
);

// Approver Rejects
router.put(
  "/applications/approvers/my-approvals/:applicationId/reject",
  ...requirePerm("wellness.manage_application"),
  rejectWellnessApplication,
);

/* =========================================
   WELLNESS CREDITS (HR / ADMIN FLOW)
========================================= */

// Get basic details of an employee for the crediting form
router.get(
  "/credits/employee-details/:employeeId",
  ...requirePerm("wellness.view_all"),
  getEmployeeDetails,
);

// Add Wellness Credits to employees
router.post(
  "/credits/add",
  ...requirePerm("wellness.manage"),
  upload.single("file"),
  addWellnessCreditRequest,
);

// Rollback a credited memo
router.put(
  "/credits/:creditId/rollback",
  ...requirePerm("wellness.manage"),
  rollbackWellnessCreditRequest,
);

// Get a list of all credited memos (Admin/HR view)
router.get(
  "/credits/all",
  ...requirePerm("wellness.view_all"),
  getAllWellnessCreditRequests,
);

// Get personal credit history (Self-service view)
router.get(
  "/credits/my-credits",
  ...requirePerm("wellness.view_self"),
  getEmployeeWellnessCredits,
);

// Get credit history for a specific employee (Admin/HR view)
router.get(
  "/credits/employee/:employeeId",
  ...requirePerm("wellness.view_all"),
  getEmployeeWellnessCredits,
);

// ✅ NEW: Trigger year-end reset for previous year's credits
router.post(
  "/credits/expire-previous-year",
  ...requirePerm("wellness.manage"),
  triggerYearEndReset,
);

module.exports = router;
