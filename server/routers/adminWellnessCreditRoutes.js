// routers/adminWellnessCreditRoutes.js
//
// Mounted in the server file:
//   app.use("/api/admin/wellness-credits", adminWellnessCreditRoutes);
// (keep CREDITS_BASE in src/api/wellnessApplicationAdmin.js in sync)

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
  listCredits,
  getCredit,
  previewCreditUpdate,
  updateCredit,
} = require("../controllers/adminWellnessCreditController.js");

// 🔒 ownerOnly lets in just the account IDs in CTO_SYNC_REFS (.env),
// even if another admin's role has these permissions or the "*" wildcard.
// Permissions (defined in models/roleModel.js) are still checked after that.
const VIEW_PERM = "wellness.admin_view"; // search, list, open batches, balance check
const EDIT_PERM = "wellness.admin_edit"; // preview, save edits, recalculate balances

/**
 * 🔒 Runs your normal authorize(perm) check, but when it refuses (403) the
 * response is turned into the same 404 { message: "Not found" } your server
 * gives for unknown URLs — so people without access can't tell these
 * endpoints exist. Works whether authorize() replies with res.status(403)
 * or passes a 403 error to next(). 401 (not logged in) is left alone so
 * your session-expired handling keeps working.
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
