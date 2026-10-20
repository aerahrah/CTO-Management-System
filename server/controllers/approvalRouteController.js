// controllers/approvalRouteController.js
const {
  getApprovalRolesService,
  getAllApprovalRoutesService,
  getApprovalRouteByIdService,
  createApprovalRouteService,
  updateApprovalRouteService,
  deleteApprovalRouteService,
  upsertMyApprovalRouteService,
} = require("../services/approvalRoute.service");

const {
  getEffectiveWorkflowService,
  resetToDefaultService,
  isTemplateRoute,
  listTemplatesService,
  createTemplateService,
  updateTemplateService,
  deleteTemplateService,
  listEmployeesService,
  getScopeValuesService,
  listAssignmentsService,
  setAssignmentService,
  assignToEmployeesService,
  removeAssignmentService,
  removeAssignmentsService,
  getWorkflowSettingsService,
  updateWorkflowSettingsService,
  stripAssignedNotified,
  updateMyNotifiedService,
  removeAssignedNotifiedService,
  restoreAssignedNotifiedService,
  listNotifyGroupsService,
  getNotifyGroupService,
  createNotifyGroupService,
  updateNotifyGroupService,
  deleteNotifyGroupService,
  getNotifyGroupMembersService,
  updateNotifyGroupMembersService,
} = require("../services/approvalWorkflow.service");

function sendError(res, err) {
  const status = err.statusCode || err.status || 500;
  return res.status(status).json({ message: err.message || "Server error" });
}

// ?designation=A&designation=B&project=<id>  →  { designation: [...], project: [...] }
const FILTER_KEYS = ["project", "designation"];
function filtersFromQuery(query) {
  const filters = {};
  for (const key of FILTER_KEYS) {
    if (query[key] !== undefined && query[key] !== "")
      filters[key] = query[key];
  }
  return filters;
}

// GET /api/approval-routes/roles
const getApprovalRoles = async (req, res) => {
  try {
    const roles = await getApprovalRolesService();
    return res.json({ success: true, count: roles.length, data: roles });
  } catch (err) {
    return sendError(res, err);
  }
};

// GET /api/approval-routes
const getAllApprovalRoutes = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const routes = await getAllApprovalRoutesService({ requesterId });
    return res.json({ success: true, count: routes.length, data: routes });
  } catch (err) {
    return sendError(res, err);
  }
};

// GET /api/approval-routes/:id
const getApprovalRouteById = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const route = await getApprovalRouteByIdService({ id, requesterId });
    return res.json({ success: true, data: route });
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/approval-routes
const createApprovalRoute = async (req, res) => {
  try {
    const createdBy = req.user?.id;
    if (!createdBy) return res.status(401).json({ message: "Unauthorized" });

    const route = await createApprovalRouteService({
      data: req.body,
      createdBy,
    });

    return res.status(201).json({
      success: true,
      message: "Approval route created successfully.",
      data: route,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// PATCH /api/approval-routes/:id
const updateApprovalRoute = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const isAdmin = ["admin", "hr"].includes(req.user?.role);

    // Shared workflows are edited from /templates/:id (needs settings.cto_workflow_assign)
    if (await isTemplateRoute(id)) {
      return res.status(403).json({
        message: "This is a shared workflow. Edit it from Workflow Templates.",
      });
    }

    const route = await updateApprovalRouteService({
      id,
      data: req.body,
      requesterId,
      isAdmin,
    });

    return res.json({
      success: true,
      message: "Approval route updated successfully.",
      data: route,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// DELETE /api/approval-routes/:id
const deleteApprovalRoute = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const isAdmin = ["admin", "hr"].includes(req.user?.role);

    // Shared workflows are deleted from /templates/:id (needs settings.cto_workflow_assign)
    if (await isTemplateRoute(id)) {
      return res.status(403).json({
        message:
          "This is a shared workflow. Delete it from Workflow Templates.",
      });
    }

    const result = await deleteApprovalRouteService({
      id,
      requesterId,
      isAdmin,
    });

    return res.json({
      success: true,
      message: "Approval route deleted successfully.",
      ...result,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// PUT /api/approval-routes/my  — upsert personal route (create or update atomically)
const upsertMyApprovalRoute = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    // Don't store people HR already notifies for them (no duplicates)
    const data = { ...(req.body || {}) };
    if (data.notifiedEmployees !== undefined) {
      data.notifiedEmployees = await stripAssignedNotified({
        employeeId: requesterId,
        ids: data.notifiedEmployees,
      });
    }

    const route = await upsertMyApprovalRouteService({
      data,
      requesterId,
    });

    return res.json({
      success: true,
      message: "Personal workflow saved.",
      data: route,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

/* ═══════════════════════════════════════════════════
   WORKFLOW: effective workflow + Default button
   ═══════════════════════════════════════════════════ */

// GET /api/approval-routes/my  — the workflow that applies to me + what Default gives me
const getMyWorkflow = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const data = await getEffectiveWorkflowService({ employeeId: requesterId });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
};

// PUT /api/approval-routes/my/notified  { notifiedEmployees: [ids] }
// My own notified people (on my personal workflow). People HR already notifies are skipped.
const updateMyNotified = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });
    const data = await updateMyNotifiedService({
      employeeId: requesterId,
      notifiedEmployees: req.body?.notifiedEmployees,
    });
    return res.json({
      success: true,
      message: "Notified employees saved.",
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/approval-routes/my/notified/remove  { ids: [...] }
// Remove people HR set (notify groups) from my own requests. Only groups that aren't locked.
const removeMyAssignedNotified = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });
    const data = await removeAssignedNotifiedService({
      employeeId: requesterId,
      ids: req.body?.ids,
    });
    return res.json({
      success: true,
      message: "Removed from your notified employees.",
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/approval-routes/my/notified/restore  { ids: [...] }
const restoreMyAssignedNotified = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });
    const data = await restoreAssignedNotifiedService({
      employeeId: requesterId,
      ids: req.body?.ids,
    });
    return res.json({
      success: true,
      message: "Restored to your notified employees.",
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// DELETE /api/approval-routes/my  — the Default button (drops my personal workflow)
const resetMyWorkflow = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const data = await resetToDefaultService({ employeeId: requesterId });
    return res.json({
      success: true,
      message: data.changed
        ? "Switched back to the default workflow."
        : "You are already using the default workflow.",
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

/* ═══════════════════════════════════════════════════
   WORKFLOW: settings (use shared workflows or personal only)
   ═══════════════════════════════════════════════════ */

// GET /api/approval-routes/settings
const getWorkflowSettings = async (req, res) => {
  try {
    const data = await getWorkflowSettingsService();
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
};

// PUT /api/approval-routes/settings  { sharedWorkflowsEnabled: boolean }
const updateWorkflowSettings = async (req, res) => {
  try {
    const data = await updateWorkflowSettingsService({
      data: req.body,
      updatedBy: req.user?.id,
    });
    return res.json({
      success: true,
      message: data.sharedWorkflowsEnabled
        ? "Shared workflows turned on."
        : "Shared workflows turned off.",
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

/* ═══════════════════════════════════════════════════
   WORKFLOW: shared workflows (templates)
   ═══════════════════════════════════════════════════ */

// GET /api/approval-routes/templates
const listTemplates = async (req, res) => {
  try {
    const data = await listTemplatesService();
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/approval-routes/templates   { name, description?, steps, notifiedEmployees? }
const createTemplate = async (req, res) => {
  try {
    const createdBy = req.user?.id;
    if (!createdBy) return res.status(401).json({ message: "Unauthorized" });

    const data = await createTemplateService({ data: req.body, createdBy });
    return res
      .status(201)
      .json({ success: true, message: "Shared workflow created.", data });
  } catch (err) {
    return sendError(res, err);
  }
};

// PATCH /api/approval-routes/templates/:id
const updateTemplate = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const data = await updateTemplateService({
      id: req.params.id,
      data: req.body,
      requesterId,
    });
    return res.json({
      success: true,
      message: "Shared workflow updated.",
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// DELETE /api/approval-routes/templates/:id?force=true
const deleteTemplate = async (req, res) => {
  try {
    const data = await deleteTemplateService({
      id: req.params.id,
      force: req.query.force === "true",
    });
    return res.json({
      success: true,
      message: "Shared workflow deleted.",
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

/* ═══════════════════════════════════════════════════
   WORKFLOW: admin / HR
   ═══════════════════════════════════════════════════ */

// GET /api/approval-routes/employees?designation=&project=&search=&ids=&page=&limit=
const listEmployeeWorkflows = async (req, res) => {
  try {
    const data = await listEmployeesService({
      employeeIds: req.query.ids, // optional: only these employees (?ids=a&ids=b)
      filters: filtersFromQuery(req.query),
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
};

// GET /api/approval-routes/employees/:employeeId
const getEmployeeWorkflow = async (req, res) => {
  try {
    const data = await getEffectiveWorkflowService({
      employeeId: req.params.employeeId,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/approval-routes/employees/:employeeId/reset   { force? }
const resetEmployeeWorkflow = async (req, res) => {
  try {
    const data = await resetToDefaultService({
      employeeId: req.params.employeeId,
      force: req.body?.force === true,
    });
    return res.json({
      success: true,
      message: data.changed
        ? "Employee switched back to the default workflow."
        : "Employee is already using the default workflow.",
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// GET /api/approval-routes/scope-values/:scope   (designation | project)
const getScopeValues = async (req, res) => {
  try {
    const data = await getScopeValuesService({ scope: req.params.scope });
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    return sendError(res, err);
  }
};

// GET /api/approval-routes/assignments?scope=&routeId=
const listAssignments = async (req, res) => {
  try {
    const data = await listAssignmentsService({
      scope: req.query.scope,
      routeId: req.query.routeId,
    });
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    return sendError(res, err);
  }
};

// PUT /api/approval-routes/assignments   { scope, value, routeId }
const setAssignment = async (req, res) => {
  try {
    const assignedBy = req.user?.id;
    if (!assignedBy) return res.status(401).json({ message: "Unauthorized" });

    const data = await setAssignmentService({
      scope: req.body?.scope,
      value: req.body?.value,
      routeId: req.body?.routeId,
      assignedBy,
    });
    return res.json({ success: true, message: "Workflow assigned.", data });
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/approval-routes/assignments/employees   { routeId, employeeIds?, filters?, resetPersonal? }
const assignToEmployees = async (req, res) => {
  try {
    const assignedBy = req.user?.id;
    if (!assignedBy) return res.status(401).json({ message: "Unauthorized" });

    const data = await assignToEmployeesService({
      routeId: req.body?.routeId,
      employeeIds: req.body?.employeeIds,
      filters: req.body?.filters,
      resetPersonal: req.body?.resetPersonal === true,
      assignedBy,
    });
    return res.json({
      success: true,
      message: `Workflow assigned to ${data.assigned} employee(s).`,
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/approval-routes/assignments/remove   { assignmentIds?, employeeIds? }
const removeAssignments = async (req, res) => {
  try {
    const data = await removeAssignmentsService({
      assignmentIds: req.body?.assignmentIds,
      employeeIds: req.body?.employeeIds,
    });
    return res.json({
      success: true,
      message: `${data.deleted} assignment(s) removed.`,
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// DELETE /api/approval-routes/assignments/:assignmentId
const removeAssignment = async (req, res) => {
  try {
    const data = await removeAssignmentService({ id: req.params.assignmentId });
    return res.json({ success: true, message: "Assignment removed.", data });
  } catch (err) {
    return sendError(res, err);
  }
};

/* ═══════════════════════════════════════════════════
   NOTIFY GROUPS: who gets notified, per employee
   ═══════════════════════════════════════════════════ */

// GET /api/approval-routes/notify-groups
const listNotifyGroups = async (req, res) => {
  try {
    const data = await listNotifyGroupsService();
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    return sendError(res, err);
  }
};

// GET /api/approval-routes/notify-groups/:id
const getNotifyGroup = async (req, res) => {
  try {
    const data = await getNotifyGroupService({ id: req.params.id });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/approval-routes/notify-groups   { name, description?, notifiedEmployees }
const createNotifyGroup = async (req, res) => {
  try {
    const createdBy = req.user?.id;
    if (!createdBy) return res.status(401).json({ message: "Unauthorized" });
    const data = await createNotifyGroupService({ data: req.body, createdBy });
    return res
      .status(201)
      .json({ success: true, message: "Notify group created.", data });
  } catch (err) {
    return sendError(res, err);
  }
};

// PATCH /api/approval-routes/notify-groups/:id   { name?, description?, notifiedEmployees? }
const updateNotifyGroup = async (req, res) => {
  try {
    const data = await updateNotifyGroupService({
      id: req.params.id,
      data: req.body,
    });
    return res.json({ success: true, message: "Notify group updated.", data });
  } catch (err) {
    return sendError(res, err);
  }
};

// DELETE /api/approval-routes/notify-groups/:id
const deleteNotifyGroup = async (req, res) => {
  try {
    const data = await deleteNotifyGroupService({ id: req.params.id });
    return res.json({ success: true, message: "Notify group deleted.", data });
  } catch (err) {
    return sendError(res, err);
  }
};

// GET /api/approval-routes/notify-groups/:id/members
const getNotifyGroupMembers = async (req, res) => {
  try {
    const data = await getNotifyGroupMembersService({ id: req.params.id });
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/approval-routes/notify-groups/:id/members   { add?: [ids], remove?: [ids] }
const updateNotifyGroupMembers = async (req, res) => {
  try {
    const data = await updateNotifyGroupMembersService({
      id: req.params.id,
      add: req.body?.add,
      remove: req.body?.remove,
    });
    return res.json({ success: true, message: "Members saved.", data });
  } catch (err) {
    return sendError(res, err);
  }
};

module.exports = {
  // notify groups
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
};
