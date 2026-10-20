const express = require("express");
const router = express.Router();
const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware");

const {
  getApprovalRoles,
  getAllApprovalRoutes,
  getApprovalRouteById,
  createApprovalRoute,
  updateApprovalRoute,
  deleteApprovalRoute,
  upsertMyApprovalRoute,
  // workflow
  getMyWorkflow,
  resetMyWorkflow,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listEmployeeWorkflows,
  getEmployeeWorkflow,
  resetEmployeeWorkflow,
  getScopeValues,
  listAssignments,
  setAssignment,
  assignToEmployees,
  removeAssignments,
  removeAssignment,
  listNotifyGroups,
  getNotifyGroup,
  createNotifyGroup,
  updateNotifyGroup,
  deleteNotifyGroup,
  getNotifyGroupMembers,
  updateNotifyGroupMembers,
  updateMyNotified,
  removeMyAssignedNotified,
  restoreMyAssignedNotified,
  getWorkflowSettings,
  updateWorkflowSettings,
} = require("../controllers/approvalRouteController");

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];
const authOnly = [authenticateToken];

// Own workflow vs. workflows for other employees
const OWN_WORKFLOW = "settings.cto_workflow";
const ASSIGN_WORKFLOW = "settings.cto_workflow_assign";

// =============================
// UTILITY & SELF-SERVICE
// (all of these MUST be defined before /:id routes)
// =============================

// ✅ Fetch dynamic roles from the backend constants
router.get("/roles", ...authOnly, getApprovalRoles);

// The workflow that applies to me (personal or assigned) + what Default gives me
router.get("/my", ...authOnly, getMyWorkflow);

// User saving their own personal workflow
router.put("/my", ...authOnly, upsertMyApprovalRoute);

// "Default" button: drop my personal workflow, go back to the assigned one
router.delete("/my", ...authOnly, resetMyWorkflow);

// My notified employees (one list: mine + the ones HR set)
router.put("/my/notified", ...authOnly, updateMyNotified);
// Only people from notify groups that aren't locked can be removed
router.post("/my/notified/remove", ...authOnly, removeMyAssignedNotified);
router.post("/my/notified/restore", ...authOnly, restoreMyAssignedNotified);

// =============================
// SHARED WORKFLOWS (templates for other employees)
// (single-segment paths MUST be defined before /:id routes)
// =============================

// Use shared workflows, or only each employee's personal workflow
router.get("/settings", ...requirePerm(ASSIGN_WORKFLOW), getWorkflowSettings);
router.put(
  "/settings",
  ...requirePerm(ASSIGN_WORKFLOW),
  updateWorkflowSettings,
);

router.get("/templates", ...requirePerm(ASSIGN_WORKFLOW), listTemplates);
router.post("/templates", ...requirePerm(ASSIGN_WORKFLOW), createTemplate);
router.patch("/templates/:id", ...requirePerm(ASSIGN_WORKFLOW), updateTemplate);
router.delete(
  "/templates/:id",
  ...requirePerm(ASSIGN_WORKFLOW),
  deleteTemplate,
);

// =============================
// NOTIFY GROUPS (who gets notified, per employee)
// =============================

router.get("/notify-groups", ...requirePerm(ASSIGN_WORKFLOW), listNotifyGroups);
router.post(
  "/notify-groups",
  ...requirePerm(ASSIGN_WORKFLOW),
  createNotifyGroup,
);
router.get(
  "/notify-groups/:id",
  ...requirePerm(ASSIGN_WORKFLOW),
  getNotifyGroup,
);
router.patch(
  "/notify-groups/:id",
  ...requirePerm(ASSIGN_WORKFLOW),
  updateNotifyGroup,
);
router.delete(
  "/notify-groups/:id",
  ...requirePerm(ASSIGN_WORKFLOW),
  deleteNotifyGroup,
);
router.get(
  "/notify-groups/:id/members",
  ...requirePerm(ASSIGN_WORKFLOW),
  getNotifyGroupMembers,
);
router.post(
  "/notify-groups/:id/members",
  ...requirePerm(ASSIGN_WORKFLOW),
  updateNotifyGroupMembers,
);

// =============================
// WORKFLOW ASSIGNMENTS
// =============================

// Assignment rules: per employee, project, designation, or company default
router.get("/assignments", ...requirePerm(ASSIGN_WORKFLOW), listAssignments);
router.put("/assignments", ...requirePerm(ASSIGN_WORKFLOW), setAssignment);
router.post(
  "/assignments/employees",
  ...requirePerm(ASSIGN_WORKFLOW),
  assignToEmployees,
);
router.post(
  "/assignments/remove",
  ...requirePerm(ASSIGN_WORKFLOW),
  removeAssignments,
);
router.delete(
  "/assignments/:assignmentId",
  ...requirePerm(ASSIGN_WORKFLOW),
  removeAssignment,
);

// Every designation/project with its employee count + assigned workflow
router.get(
  "/scope-values/:scope",
  ...requirePerm(ASSIGN_WORKFLOW),
  getScopeValues,
);

// Employees with the workflow each one is currently on
router.get(
  "/employees",
  ...requirePerm(ASSIGN_WORKFLOW),
  listEmployeeWorkflows,
);
router.get(
  "/employees/:employeeId",
  ...requirePerm(ASSIGN_WORKFLOW),
  getEmployeeWorkflow,
);
router.post(
  "/employees/:employeeId/reset",
  ...requirePerm(ASSIGN_WORKFLOW),
  resetEmployeeWorkflow,
);

// =============================
// APPROVAL ROUTE MANAGEMENT (own workflow)
// =============================

// Viewing all approval routes (public + own)
router.get("/", ...requirePerm(OWN_WORKFLOW), getAllApprovalRoutes);

// Viewing a specific approval route
router.get("/:id", ...requirePerm(OWN_WORKFLOW), getApprovalRouteById);

// Creating an approval route
router.post("/", ...requirePerm(OWN_WORKFLOW), createApprovalRoute);

// Updating a specific approval route (shared workflows are blocked here)
router.patch("/:id", ...requirePerm(OWN_WORKFLOW), updateApprovalRoute);

// Deleting an approval route (shared workflows are blocked here)
router.delete("/:id", ...requirePerm(OWN_WORKFLOW), deleteApprovalRoute);

module.exports = router;
