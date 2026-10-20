// routers/adminCtoApplicationRoutes.js
//
// Mounted in the server file:
//   app.use("/api/admin/cto-applications", adminCtoApplicationRoutes);

const express = require("express");
const router = express.Router();

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware.js");
const ownerOnly = require("../middlewares/ownerOnly.js");

const {
  searchEmployees,
  getEmployeeBalance,
  recalculateEmployeeBalance,
  getEmployeeCredits,
  listApplications,
  getApplication,
  previewApplicationUpdate,
  updateApplication,
} = require("../controllers/adminCtoApplicationController.js");

// 🔒 ownerOnly lets in just the account IDs in CTO_SYNC_REFS (.env),
// even if another admin's role has these permissions or the "*" wildcard.
// Permissions (defined in models/roleModel.js) are still checked after that.
const VIEW_PERM = "cto.admin_view"; // search, list, open applications, balance check, memo list
const EDIT_PERM = "cto.admin_edit"; // preview, save edits, recalculate balances

/**
 * 🔒 Runs your normal authorize(perm) check, but when it refuses (403) the
 * response becomes the same 404 { message: "Not found" } your server gives
 * for unknown URLs, so people without access can't tell these endpoints exist.
 * 401 (not logged in) is left alone so session-expired handling keeps working.
 */
function disguiseForbiddenAsNotFound(guard) {
  return (req, res, next) => {
    const originalStatus = res.status;
    const originalJson = res.json;
    let disguised = false;

    res.status = function status(code) {
      if (code === 403) {
        disguised = true;
        return originalStatus.call(this, 404);
      }
      return originalStatus.call(this, code);
    };
    res.json = function json(body) {
      return originalJson.call(
        this,
        disguised ? { message: "Not found" } : body,
      );
    };

    guard(req, res, (err) => {
      res.status = originalStatus;
      res.json = originalJson;
      if (err && (err.statusCode === 403 || err.status === 403)) {
        return res.status(404).json({ message: "Not found" });
      }
      return next(err);
    });
  };
}

const requirePerm = (perm) => [
  authenticateToken, // 1. logged in (401 if not)
  ownerOnly, // 2. your account only (404 for everyone else)
  disguiseForbiddenAsNotFound(authorize(perm)), // 3. role permission (404 if missing)
];

/* =========================================
   EMPLOYEES (static paths first)
========================================= */

// Search employees (applicants, approvers, notified employees)
router.get("/employees/search", ...requirePerm(VIEW_PERM), searchEmployees);

// Stored CTO balance vs. balance computed from credit memos
router.get(
  "/employees/:employeeId/balance",
  ...requirePerm(VIEW_PERM),
  getEmployeeBalance,
);

// The employee's CTO memos (to choose where an application's hours come from)
router.get(
  "/employees/:employeeId/credits",
  ...requirePerm(VIEW_PERM),
  getEmployeeCredits,
);

// Reset stored CTO balance to what the credits add up to
router.post(
  "/employees/:employeeId/recalculate-balance",
  ...requirePerm(EDIT_PERM),
  recalculateEmployeeBalance,
);

/* =========================================
   APPLICATIONS
========================================= */

// List / search / filter applications
router.get("/", ...requirePerm(VIEW_PERM), listApplications);

// One application, ready for editing
router.get("/:applicationId", ...requirePerm(VIEW_PERM), getApplication);

// Dry run of an edit (validation + hour moves + balance impact, nothing saved)
router.post(
  "/:applicationId/preview",
  ...requirePerm(EDIT_PERM),
  previewApplicationUpdate,
);

// Save an edit
router.put("/:applicationId", ...requirePerm(EDIT_PERM), updateApplication);

module.exports = router;
