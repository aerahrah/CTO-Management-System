// routes/adminWellnessCreditRoutes.js
//
// Mount in your server file, e.g.:
//   app.use("/api/admin/wellness-credits", require("./routes/adminWellnessCreditRoutes"));
// (keep the frontend's BASE path in src/api/adminWellnessCreditApi.js in sync)

const express = require("express");
const router = express.Router();

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware.js");

const {
  searchEmployees,
  getEmployeeBalance,
  recalculateEmployeeBalance,
  listCredits,
  getCredit,
  previewCreditUpdate,
  updateCredit,
} = require("../controllers/adminWellnessCreditController.js");

// Admin-only permissions (defined in models/roleModel.js).
// The Admin role's "*" wildcard covers both; no other role gets them unless you add them.
const VIEW_PERM = "wellness.admin_view"; // search, list, open batches, balance check
const EDIT_PERM = "wellness.admin_edit"; // preview, save edits, recalculate balances

const requirePerm = (perm) => [authenticateToken, authorize(perm)];

/* =========================================
   EMPLOYEES (static paths first)
========================================= */

// Search employees by name / email / position (+ balance and limit usage)
router.get("/employees/search", ...requirePerm(VIEW_PERM), searchEmployees);

// Stored balance vs. balance computed from credits
router.get(
  "/employees/:employeeId/balance",
  ...requirePerm(VIEW_PERM),
  getEmployeeBalance,
);

// Reset stored balance to what the credits add up to
router.post(
  "/employees/:employeeId/recalculate-balance",
  ...requirePerm(EDIT_PERM),
  recalculateEmployeeBalance,
);

/* =========================================
   CREDIT BATCHES
========================================= */

// List / search / filter batches
router.get("/", ...requirePerm(VIEW_PERM), listCredits);

// One batch, ready for editing
router.get("/:creditId", ...requirePerm(VIEW_PERM), getCredit);

// Dry run of an edit (validation + balance impact, nothing saved)
router.post(
  "/:creditId/preview",
  ...requirePerm(EDIT_PERM),
  previewCreditUpdate,
);

// Save an edit
router.put("/:creditId", ...requirePerm(EDIT_PERM), updateCredit);

module.exports = router;
