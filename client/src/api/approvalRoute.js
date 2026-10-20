import API from "./api";

const unwrap = (res) => res?.data;

const safeError = (err, fallback = "Request failed") => {
  const msg =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback;
  const e = new Error(msg);
  e.status = err?.response?.status;
  throw e;
};

// Builds "?designation=A&designation=B&project=X". Arrays become repeated
// keys, which Express parses back into arrays. Empty values are skipped.
const toQuery = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values
      .filter((v) => v !== undefined && v !== null && v !== "")
      .forEach((v) => qs.append(key, v));
  });
  const str = qs.toString();
  return str ? `?${str}` : "";
};

// ✅ Fetch the dynamic list of approval roles
export const fetchApprovalRoles = async () => {
  try {
    const res = await API.get("/approval-routes/roles", {
      withCredentials: true,
    });
    return unwrap(res)?.data || [];
  } catch (err) {
    safeError(err, "Failed to fetch approval roles");
  }
};

export const fetchAllApprovalRoutes = async () => {
  try {
    const res = await API.get("/approval-routes", { withCredentials: true });
    return unwrap(res)?.data || [];
  } catch (err) {
    safeError(err, "Failed to fetch approval routes");
  }
};

export const fetchApprovalRouteById = async (id) => {
  try {
    const res = await API.get(`/approval-routes/${id}`, {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to fetch approval route");
  }
};

export const createApprovalRoute = async (payload) => {
  try {
    const res = await API.post("/approval-routes", payload, {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to create approval route");
  }
};

export const updateApprovalRoute = async (id, payload) => {
  try {
    const res = await API.patch(`/approval-routes/${id}`, payload, {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to update approval route");
  }
};

export const deleteApprovalRoute = async (id) => {
  try {
    const res = await API.delete(`/approval-routes/${id}`, {
      withCredentials: true,
    });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to delete approval route");
  }
};

export const upsertMyApprovalRoute = async (payload) => {
  try {
    const res = await API.put("/approval-routes/my", payload, {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to save personal workflow");
  }
};

// =============================
// MY WORKFLOW (any logged-in employee)
// =============================

/**
 * The workflow that applies to me right now.
 * → { source: "personal" | "assigned" | "none", workflow, defaultWorkflow,
 *     defaultMatchedBy, hasPersonalWorkflow, canResetToDefault, employee }
 * Use `canResetToDefault` to enable/disable the Default button.
 */
export const fetchMyWorkflow = async () => {
  try {
    const res = await API.get("/approval-routes/my", {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to fetch your workflow");
  }
};

/**
 * The Default button: deletes my personal workflow so the assigned one applies.
 * → { message, data: { changed, ...same shape as fetchMyWorkflow } }
 * Throws with err.status === 409 if no default workflow is assigned to me yet.
 */
export const resetMyWorkflow = async () => {
  try {
    const res = await API.delete("/approval-routes/my", {
      withCredentials: true,
    });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to reset to the default workflow");
  }
};

/**
 * My own notified people (saved on my personal workflow). People HR already
 * notifies for me are skipped, so nobody is listed twice.
 * → { saved, restored, skipped, ...same shape as fetchMyWorkflow }
 * Throws 409 while I'm on the default workflow (Customize first).
 */
export const updateMyNotified = async (notifiedEmployees) => {
  try {
    const res = await API.put(
      "/approval-routes/my/notified",
      { notifiedEmployees },
      { withCredentials: true },
    );
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to save notified employees");
  }
};

/** Remove people HR set (notify groups) from my requests. Refused (403) for locked groups. */
export const removeMyAssignedNotified = async (ids) => {
  try {
    const res = await API.post(
      "/approval-routes/my/notified/remove",
      { ids },
      { withCredentials: true },
    );
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to remove notified employees");
  }
};

/** Put HR-set people I removed back on my list. */
export const restoreMyAssignedNotified = async (ids) => {
  try {
    const res = await API.post(
      "/approval-routes/my/notified/restore",
      { ids },
      { withCredentials: true },
    );
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to restore notified employees");
  }
};

// =============================
// SETTINGS (settings.cto_workflow_assign)
// =============================

/**
 * → { sharedWorkflowsEnabled, employeeCount, withPersonalWorkflow, withoutPersonalWorkflow, updatedAt }
 * sharedWorkflowsEnabled false = HR uses each employee's personal workflow only.
 */
export const fetchWorkflowSettings = async () => {
  try {
    const res = await API.get("/approval-routes/settings", {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to load workflow settings");
  }
};

/** Turn shared workflows on/off. Assignments are kept either way. */
export const updateWorkflowSettings = async ({ sharedWorkflowsEnabled }) => {
  try {
    const res = await API.put(
      "/approval-routes/settings",
      { sharedWorkflowsEnabled },
      { withCredentials: true },
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to update workflow settings");
  }
};

// =============================
// SHARED WORKFLOWS (settings.cto_workflow_assign)
// =============================

/** → [{ ...route, assignmentCounts: { employee, project, designation, global }, isCompanyDefault }] */
export const fetchWorkflowTemplates = async () => {
  try {
    const res = await API.get("/approval-routes/templates", {
      withCredentials: true,
    });
    return unwrap(res)?.data || [];
  } catch (err) {
    safeError(err, "Failed to fetch shared workflows");
  }
};

/** payload: { name, description?, steps, notifiedEmployees? } (same as createApprovalRoute) */
export const createWorkflowTemplate = async (payload) => {
  try {
    const res = await API.post("/approval-routes/templates", payload, {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to create shared workflow");
  }
};

export const updateWorkflowTemplate = async (id, payload) => {
  try {
    const res = await API.patch(`/approval-routes/templates/${id}`, payload, {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to update shared workflow");
  }
};

/**
 * Throws with err.status === 409 while the workflow is still assigned.
 * Pass { force: true } to also remove its assignments.
 */
export const deleteWorkflowTemplate = async (id, { force = false } = {}) => {
  try {
    const res = await API.delete(
      `/approval-routes/templates/${id}${toQuery({ force: force || undefined })}`,
      { withCredentials: true },
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to delete shared workflow");
  }
};

// =============================
// ASSIGNMENTS (settings.cto_workflow_assign)
// =============================

/** params: { scope?: "employee" | "project" | "designation" | "global", routeId? } */
export const fetchWorkflowAssignments = async (params = {}) => {
  try {
    const res = await API.get(
      `/approval-routes/assignments${toQuery(params)}`,
      { withCredentials: true },
    );
    return unwrap(res)?.data || [];
  } catch (err) {
    safeError(err, "Failed to fetch workflow assignments");
  }
};

/**
 * Rule for a designation / project / single employee. Replaces the previous one.
 *   { scope: "designation", value: "Engineer", routeId }
 *   { scope: "project", value: projectId, routeId }
 * Response includes `employeeCount` (0 usually means a typo in the designation).
 */
export const setWorkflowAssignment = async ({ scope, value, routeId }) => {
  try {
    const res = await API.put(
      "/approval-routes/assignments",
      { scope, value, routeId },
      { withCredentials: true },
    );
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to assign workflow");
  }
};

/** Company default: applies to everyone with no other match. */
export const setCompanyDefaultWorkflow = async (routeId) =>
  setWorkflowAssignment({ scope: "global", routeId });

/**
 * Assign to picked employees and/or everyone matching filters (right now only).
 *   { routeId, employeeIds: [...] }
 *   { routeId, filters: { designation: ["Engineer"], project: [projectId] } }
 *   resetPersonal: true → also drop their personal workflows
 * → { route, assigned, personalWorkflowsReset, keepingPersonalWorkflow }
 */
export const assignWorkflowToEmployees = async ({
  routeId,
  employeeIds,
  filters,
  resetPersonal = false,
}) => {
  try {
    const res = await API.post(
      "/approval-routes/assignments/employees",
      { routeId, employeeIds, filters, resetPersonal },
      { withCredentials: true },
    );
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to assign workflow to employees");
  }
};

/** Bulk remove: { assignmentIds?: [...], employeeIds?: [...] } */
export const removeWorkflowAssignments = async ({
  assignmentIds,
  employeeIds,
} = {}) => {
  try {
    const res = await API.post(
      "/approval-routes/assignments/remove",
      { assignmentIds, employeeIds },
      { withCredentials: true },
    );
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to remove workflow assignments");
  }
};

export const removeWorkflowAssignment = async (assignmentId) => {
  try {
    const res = await API.delete(
      `/approval-routes/assignments/${assignmentId}`,
      { withCredentials: true },
    );
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to remove workflow assignment");
  }
};

/**
 * Every designation (or project) with its employee count + assigned workflow.
 * scope: "designation" | "project"
 * → [{ value, label, employeeCount, assignment: { _id, route: { _id, name } } | null }]
 */
export const fetchWorkflowScopeValues = async (scope) => {
  try {
    const res = await API.get(`/approval-routes/scope-values/${scope}`, {
      withCredentials: true,
    });
    return unwrap(res)?.data || [];
  } catch (err) {
    safeError(err, `Failed to fetch ${scope} list`);
  }
};

// =============================
// EMPLOYEES' WORKFLOWS (settings.cto_workflow_assign)
// =============================

/**
 * params: { designation?: string | string[], project?: string | string[],
 *           search?, page?, limit? }
 * → { items: [same shape as fetchMyWorkflow], page, limit, total, totalPages }
 */
export const fetchEmployeeWorkflows = async (params = {}) => {
  try {
    const res = await API.get(`/approval-routes/employees${toQuery(params)}`, {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to fetch employee workflows");
  }
};

export const fetchEmployeeWorkflow = async (employeeId) => {
  try {
    const res = await API.get(`/approval-routes/employees/${employeeId}`, {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to fetch employee workflow");
  }
};

/**
 * Reset one employee to their default workflow.
 * Throws with err.status === 409 if they have no default; { force: true } overrides.
 */
export const resetEmployeeWorkflow = async (
  employeeId,
  { force = false } = {},
) => {
  try {
    const res = await API.post(
      `/approval-routes/employees/${employeeId}/reset`,
      { force },
      { withCredentials: true },
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to reset employee workflow");
  }
};

// =============================
// NOTIFY GROUPS (settings.cto_workflow_assign)
// Who gets notified (no approval) when an employee files a request.
// An employee can be in several groups; everyone in all of them is notified.
// =============================

/** → [{ _id, name, description, notifiedEmployees: [employee], memberCount }] */
export const fetchNotifyGroups = async () => {
  try {
    const res = await API.get("/approval-routes/notify-groups", {
      withCredentials: true,
    });
    return unwrap(res)?.data || [];
  } catch (err) {
    safeError(err, "Failed to fetch notify groups");
  }
};

export const fetchNotifyGroup = async (id) => {
  try {
    const res = await API.get(`/approval-routes/notify-groups/${id}`, {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to fetch notify group");
  }
};

/** payload: { name, description?, notifiedEmployees: [ids] } */
export const createNotifyGroup = async (payload) => {
  try {
    const res = await API.post("/approval-routes/notify-groups", payload, {
      withCredentials: true,
    });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to create notify group");
  }
};

export const updateNotifyGroup = async (id, payload) => {
  try {
    const res = await API.patch(
      `/approval-routes/notify-groups/${id}`,
      payload,
      {
        withCredentials: true,
      },
    );
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to update notify group");
  }
};

export const deleteNotifyGroup = async (id) => {
  try {
    const res = await API.delete(`/approval-routes/notify-groups/${id}`, {
      withCredentials: true,
    });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to delete notify group");
  }
};

/** → [{ _id, label }] employees in the group */
export const fetchNotifyGroupMembers = async (id) => {
  try {
    const res = await API.get(`/approval-routes/notify-groups/${id}/members`, {
      withCredentials: true,
    });
    return unwrap(res)?.data || [];
  } catch (err) {
    safeError(err, "Failed to fetch group members");
  }
};

/** { add?: [ids], remove?: [ids] } → { added, removed, memberCount } */
export const updateNotifyGroupMembers = async (id, { add, remove } = {}) => {
  try {
    const res = await API.post(
      `/approval-routes/notify-groups/${id}/members`,
      { add, remove },
      { withCredentials: true },
    );
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to save group members");
  }
};
