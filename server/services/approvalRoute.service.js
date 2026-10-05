// services/approvalRoute.service.js
const mongoose = require("mongoose");
const ApprovalRoute = require("../models/approvalRouteModel");
const Employee = require("../models/employeeModel");
const {
  APPROVAL_ROLES,
  APPROVAL_ROLE_DESCRIPTIONS,
} = require("../constants/approvalRoles");

/* ─── helpers ─────────────────────────────────────── */
function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id, label = "id") {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(`Invalid ${label}`, 400);
  }
}

function extractId(item) {
  if (item && typeof item === "object") {
    return item._id || item.id || item.employee || item.approver;
  }
  return item;
}

async function normalizeAndValidateNotifiedIds(notifiedEmployees) {
  if (!notifiedEmployees) return [];

  let parsed = notifiedEmployees;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw httpError("notifiedEmployees must be a valid array.", 400);
    }
  }

  if (!Array.isArray(parsed)) {
    throw httpError("notifiedEmployees must be an array.", 400);
  }

  if (parsed.length === 0) return [];

  const extractedIds = [];
  for (let i = 0; i < parsed.length; i++) {
    const rawId = extractId(parsed[i]);
    if (!rawId || !mongoose.Types.ObjectId.isValid(rawId)) {
      throw httpError(`Notified employee ${i + 1}: invalid employee ID.`, 400);
    }
    extractedIds.push(String(rawId));
  }

  const uniqueIds = [...new Set(extractedIds)];

  const found = await Employee.countDocuments({
    _id: { $in: uniqueIds },
  });
  if (found !== uniqueIds.length) {
    throw httpError("One or more notified employees not found.", 404);
  }

  return uniqueIds;
}

const POPULATE_STEPS = {
  path: "steps.approver",
  select: "firstName lastName position designation",
};

const POPULATE_NOTIFIED_EMPLOYEES = {
  path: "notifiedEmployees",
  select: "firstName lastName position designation",
  options: { strictPopulate: false },
};

const POPULATE_CREATED_BY = {
  path: "createdBy",
  select: "firstName lastName position",
};

/* ─── GET ROLES ──────────────────────────────────── */
async function getApprovalRolesService() {
  return Object.values(APPROVAL_ROLES).map((role) => ({
    id: role,
    label: role,
    description: APPROVAL_ROLE_DESCRIPTIONS[role] || "Assigned approval role.",
  }));
}

/* ─── GET ALL (public + own private) ────────────── */
async function getAllApprovalRoutesService({ requesterId }) {
  assertObjectId(requesterId, "requesterId");

  const routes = await ApprovalRoute.find({
    $or: [{ isPublic: true }, { createdBy: requesterId }],
  })
    .populate(POPULATE_CREATED_BY)
    .populate(POPULATE_STEPS)
    .populate(POPULATE_NOTIFIED_EMPLOYEES)
    .sort({ createdAt: -1 })
    .lean();

  return routes;
}

/* ─── GET ONE ────────────────────────────────────── */
async function getApprovalRouteByIdService({ id, requesterId }) {
  assertObjectId(id, "route id");
  assertObjectId(requesterId, "requesterId");

  const route = await ApprovalRoute.findById(id)
    .populate(POPULATE_CREATED_BY)
    .populate(POPULATE_STEPS)
    .populate(POPULATE_NOTIFIED_EMPLOYEES)
    .lean();

  if (!route) throw httpError("Approval route not found.", 404);

  const isOwner =
    String(route.createdBy?._id || route.createdBy) === String(requesterId);
  if (!route.isPublic && !isOwner) {
    throw httpError("Access denied.", 403);
  }

  return route;
}

/* ─── CREATE ─────────────────────────────────────── */
async function createApprovalRouteService({ data, createdBy }) {
  assertObjectId(createdBy, "createdBy");

  const { name, description, isPublic, category, steps, notifiedEmployees } =
    data || {};

  if (!name || !String(name).trim()) {
    throw httpError("Route name is required.", 400);
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    throw httpError("At least one approver step is required.", 400);
  }

  const sortedSteps = [...steps].sort((a, b) => a.level - b.level);

  for (let i = 0; i < sortedSteps.length; i++) {
    const s = sortedSteps[i];
    const approverId = extractId(s.approver);
    if (!approverId || !mongoose.Types.ObjectId.isValid(approverId)) {
      throw httpError(`Step ${i + 1}: invalid approver ID.`, 400);
    }
    s.approver = String(approverId);

    if (s.level !== i + 1) {
      throw httpError(
        `Steps must be sequential starting at 1. Got level \({s.level} at position\){i + 1}.`,
        400,
      );
    }
  }

  const approverIds = sortedSteps.map((s) => String(s.approver));
  if (new Set(approverIds).size !== approverIds.length) {
    throw httpError("Each step must have a unique approver.", 400);
  }

  const assignedRoles = sortedSteps.map((s) => s.role).filter(Boolean);
  if (new Set(assignedRoles).size !== assignedRoles.length) {
    throw httpError(
      "Each approval role can only be assigned once per workflow.",
      400,
    );
  }

  const found = await Employee.countDocuments({
    _id: { $in: approverIds },
  });
  if (found !== approverIds.length) {
    throw httpError("One or more approvers not found.", 404);
  }

  const approverIdSet = new Set(approverIds);
  const validatedNotifiedIds = (
    await normalizeAndValidateNotifiedIds(notifiedEmployees)
  ).filter((id) => !approverIdSet.has(id));

  const route = await ApprovalRoute.create({
    name: String(name).trim(),
    description: description ? String(description).trim() : "",
    createdBy,
    isPublic: isPublic !== false,
    ...(category ? { category } : {}),
    steps: sortedSteps.map((s) => ({
      level: s.level,
      approver: s.approver,
      role: s.role || "",
      notes: s.notes || "",
      isEnabled: s.isEnabled !== false,
    })),
    notifiedEmployees: validatedNotifiedIds,
  });

  return ApprovalRoute.findById(route._id)
    .populate(POPULATE_CREATED_BY)
    .populate(POPULATE_STEPS)
    .populate(POPULATE_NOTIFIED_EMPLOYEES)
    .lean();
}

/* ─── UPDATE ─────────────────────────────────────── */
async function updateApprovalRouteService({ id, data, requesterId, isAdmin }) {
  assertObjectId(id, "route id");
  assertObjectId(requesterId, "requesterId");

  const route = await ApprovalRoute.findById(id);
  if (!route) throw httpError("Approval route not found.", 404);

  const isOwner = String(route.createdBy) === String(requesterId);
  if (!isOwner && !isAdmin) {
    throw httpError("You can only edit your own routes.", 403);
  }

  const { name, description, isPublic, category, steps, notifiedEmployees } =
    data || {};

  if (name !== undefined) {
    if (!String(name).trim())
      throw httpError("Route name cannot be empty.", 400);
    route.name = String(name).trim();
  }

  if (description !== undefined) {
    route.description = String(description).trim();
  }

  if (isPublic !== undefined) {
    route.isPublic = Boolean(isPublic);
  }

  if (category !== undefined) {
    route.category = category;
  }

  if (steps !== undefined) {
    if (!Array.isArray(steps) || steps.length === 0) {
      throw httpError("At least one approver step is required.", 400);
    }

    const sortedSteps = [...steps].sort((a, b) => a.level - b.level);

    for (let i = 0; i < sortedSteps.length; i++) {
      const s = sortedSteps[i];
      const approverId = extractId(s.approver);
      if (!approverId || !mongoose.Types.ObjectId.isValid(approverId)) {
        throw httpError(`Step ${i + 1}: invalid approver ID.`, 400);
      }
      s.approver = String(approverId);

      if (s.level !== i + 1) {
        throw httpError(
          `Steps must be sequential starting at 1. Got level \({s.level} at position\){i + 1}.`,
          400,
        );
      }
    }

    const approverIds = sortedSteps.map((s) => String(s.approver));
    if (new Set(approverIds).size !== approverIds.length) {
      throw httpError("Each step must have a unique approver.", 400);
    }

    const assignedRoles = sortedSteps.map((s) => s.role).filter(Boolean);
    if (new Set(assignedRoles).size !== assignedRoles.length) {
      throw httpError(
        "Each approval role can only be assigned once per workflow.",
        400,
      );
    }

    const found = await Employee.countDocuments({ _id: { $in: approverIds } });
    if (found !== approverIds.length) {
      throw httpError("One or more approvers not found.", 404);
    }

    route.steps = sortedSteps.map((s) => ({
      level: s.level,
      approver: s.approver,
      role: s.role || "",
      notes: s.notes || "",
      isEnabled: s.isEnabled !== false,
    }));
  }

  if (notifiedEmployees !== undefined) {
    const currentApproverIds = new Set(
      (route.steps || []).map((s) => String(extractId(s.approver))),
    );
    const validatedNotifiedIds = (
      await normalizeAndValidateNotifiedIds(notifiedEmployees)
    ).filter((empId) => !currentApproverIds.has(empId));

    route.notifiedEmployees = validatedNotifiedIds;
  }

  console.log(
    "[UPDATE ROUTE] Saving route with steps:",
    JSON.stringify(route.steps, null, 2),
  );
  await route.save();
  console.log("[UPDATE ROUTE] Save successful");

  return ApprovalRoute.findById(route._id)
    .populate(POPULATE_CREATED_BY)
    .populate(POPULATE_STEPS)
    .populate(POPULATE_NOTIFIED_EMPLOYEES)
    .lean();
}

/* ─── DELETE ─────────────────────────────────────── */
async function deleteApprovalRouteService({ id, requesterId, isAdmin }) {
  assertObjectId(id, "route id");
  assertObjectId(requesterId, "requesterId");

  const route = await ApprovalRoute.findById(id);
  if (!route) throw httpError("Approval route not found.", 404);

  const isOwner = String(route.createdBy) === String(requesterId);
  if (!isOwner && !isAdmin) {
    throw httpError("You can only delete your own routes.", 403);
  }

  await ApprovalRoute.findByIdAndDelete(id);
  return { deleted: true, id };
}

/* ─── RESOLVE APPROVERS (used by application service) ── */
async function resolveApproversFromRoute(routeId) {
  assertObjectId(routeId, "routeId");

  const route = await ApprovalRoute.findById(routeId).lean();
  if (!route) throw httpError("Approval route not found.", 404);
  if (!route.steps || route.steps.length === 0) {
    throw httpError("Approval route has no steps configured.", 400);
  }

  return route.steps
    .filter((s) => s.isEnabled !== false)
    .sort((a, b) => a.level - b.level)
    .map((s) => ({
      approver: String(extractId(s.approver)),
      role: s.role || "",
    }));
}

/* ─── UPSERT (create-or-update for personal routes) ── */
async function upsertMyApprovalRouteService({ data, requesterId }) {
  assertObjectId(requesterId, "requesterId");

  const { name, steps, isPublic, category, notifiedEmployees } = data || {};

  if (!Array.isArray(steps) || steps.length === 0) {
    throw httpError("At least one approver step is required.", 400);
  }

  const sortedSteps = [...steps].sort((a, b) => a.level - b.level);

  const normalizedSteps = sortedSteps.map((s, i) => ({
    level: i + 1,
    approver: extractId(s.approver),
    role: s.role || "",
    notes: s.notes || "",
    isEnabled: s.isEnabled !== false,
  }));

  for (const s of normalizedSteps) {
    if (!s.approver || !mongoose.Types.ObjectId.isValid(s.approver)) {
      throw httpError(`Step ${s.level}: invalid approver ID.`, 400);
    }
    s.approver = String(s.approver);
  }

  const approverIds = normalizedSteps.map((s) => String(s.approver));
  if (new Set(approverIds).size !== approverIds.length) {
    throw httpError("Each step must have a unique approver.", 400);
  }

  const found = await Employee.countDocuments({ _id: { $in: approverIds } });
  if (found !== approverIds.length) {
    throw httpError("One or more approvers not found.", 404);
  }

  const assignedRoles = normalizedSteps.map((s) => s.role).filter(Boolean);
  if (new Set(assignedRoles).size !== assignedRoles.length) {
    throw httpError(
      "Each approval role can only be assigned once per workflow.",
      400,
    );
  }

  const approverIdSet = new Set(approverIds);
  let validatedNotifiedIds;
  if (notifiedEmployees !== undefined) {
    validatedNotifiedIds = (
      await normalizeAndValidateNotifiedIds(notifiedEmployees)
    ).filter((id) => !approverIdSet.has(id));
  }

  const routeName = name || "Personal Workflow";

  const userRoutes = await ApprovalRoute.find({ createdBy: requesterId }).sort({
    createdAt: -1,
  });
  let targetRouteId;

  if (userRoutes.length > 0) {
    targetRouteId = userRoutes[0]._id;
    if (userRoutes.length > 1) {
      const duplicateIds = userRoutes.slice(1).map((r) => r._id);
      await ApprovalRoute.deleteMany({ _id: { $in: duplicateIds } });
    }
  }

  let route;
  if (targetRouteId) {
    const updateFields = {
      name: String(routeName).trim(),
      isPublic: isPublic === true,
      steps: normalizedSteps,
    };
    if (category !== undefined) updateFields.category = category;
    if (validatedNotifiedIds !== undefined) {
      updateFields.notifiedEmployees = validatedNotifiedIds;
    }

    route = await ApprovalRoute.findByIdAndUpdate(
      targetRouteId,
      { $set: updateFields },
      { new: true, runValidators: true },
    );
  } else {
    route = await ApprovalRoute.create({
      createdBy: requesterId,
      name: String(routeName).trim(),
      isPublic: isPublic === true,
      ...(category ? { category } : {}),
      steps: normalizedSteps,
      notifiedEmployees: validatedNotifiedIds || [],
    });
  }

  return ApprovalRoute.findById(route._id)
    .populate(POPULATE_CREATED_BY)
    .populate(POPULATE_STEPS)
    .populate(POPULATE_NOTIFIED_EMPLOYEES)
    .lean();
}

module.exports = {
  getApprovalRolesService,
  getAllApprovalRoutesService,
  getApprovalRouteByIdService,
  createApprovalRouteService,
  updateApprovalRouteService,
  deleteApprovalRouteService,
  resolveApproversFromRoute,
  upsertMyApprovalRouteService,
};
