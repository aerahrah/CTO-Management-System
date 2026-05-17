const express = require("express");
const router = express.Router();
const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware");

const {
  getAllApprovalRoutes,
  getApprovalRouteById,
  createApprovalRoute,
  updateApprovalRoute,
  deleteApprovalRoute,
  upsertMyApprovalRoute,
} = require("../controllers/approvalRouteController");

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];
const authOnly = [authenticateToken];

// =============================
// SELF-SERVICE
// =============================

// User updating their own specific approval route
// MUST be defined before /:id routes to prevent parameter collisions
router.put("/my", ...authOnly, upsertMyApprovalRoute);

// =============================
// APPROVAL ROUTE MANAGEMENT
// =============================

// Admin/HR viewing all approval routes
router.get("/", ...requirePerm("settings.cto_workflow"), getAllApprovalRoutes);

// Admin/HR viewing a specific approval route
router.get(
  "/:id",
  ...requirePerm("settings.cto_workflow"),
  getApprovalRouteById,
);

// Admin/HR creating an approval route
router.post("/", ...requirePerm("settings.cto_workflow"), createApprovalRoute);

// Admin/HR updating a specific approval route
router.patch(
  "/:id",
  ...requirePerm("settings.cto_workflow"),
  updateApprovalRoute,
);

// Admin/HR deleting an approval route
router.delete(
  "/:id",
  ...requirePerm("settings.cto_workflow"),
  deleteApprovalRoute,
);

module.exports = router;
