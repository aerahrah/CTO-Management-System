// services/approvalRoute.service.js
const mongoose = require("mongoose");
const ApprovalRoute = require("../models/approvalRouteModel");
const Employee = require("../models/employeeModel");

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

const POPULATE_STEPS = {
  path: "steps.approver",
  select: "firstName lastName position designation",
};

const POPULATE_CREATED_BY = {
  path: "createdBy",
  select: "firstName lastName position",
};

/* ─── GET ALL (public + own private) ────────────── */
async function getAllApprovalRoutesService({ requesterId }) {
  assertObjectId(requesterId, "requesterId");

  const routes = await ApprovalRoute.find({
    $or: [{ isPublic: true }, { createdBy: requesterId }],
  })
    .populate(POPULATE_CREATED_BY)
    .populate(POPULATE_STEPS)
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
    .lean();

  if (!route) throw httpError("Approval route not found.", 404);

  // Only allow viewing if public or owned by requester
  const isOwner = String(route.createdBy?._id || route.createdBy) === String(requesterId);
  if (!route.isPublic && !isOwner) {
    throw httpError("Access denied.", 403);
  }

  return route;
}

/* ─── CREATE ─────────────────────────────────────── */
async function createApprovalRouteService({ data, createdBy }) {
  assertObjectId(createdBy, "createdBy");

  const { name, description, isPublic, steps } = data || {};

  if (!name || !String(name).trim()) {
    throw httpError("Route name is required.", 400);
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    throw httpError("At least one approver step is required.", 400);
  }

  // Validate steps
  const sortedSteps = [...steps].sort((a, b) => a.level - b.level);

  for (let i = 0; i < sortedSteps.length; i++) {
    const s = sortedSteps[i];
    if (!s.approver || !mongoose.Types.ObjectId.isValid(s.approver)) {
      throw httpError(`Step ${i + 1}: invalid approver ID.`, 400);
    }
    if (s.level !== i + 1) {
      throw httpError(
        `Steps must be sequential starting at 1. Got level ${s.level} at position ${i + 1}.`,
        400,
      );
    }
  }

  // All approvers must be distinct
  const approverIds = sortedSteps.map((s) => String(s.approver));
  if (new Set(approverIds).size !== approverIds.length) {
    throw httpError("Each step must have a unique approver.", 400);
  }

  // Verify all approvers exist
  const found = await Employee.countDocuments({
    _id: { $in: approverIds },
  });
  if (found !== approverIds.length) {
    throw httpError("One or more approvers not found.", 404);
  }

  const route = await ApprovalRoute.create({
    name: String(name).trim(),
    description: description ? String(description).trim() : "",
    createdBy,
    isPublic: isPublic !== false, // default true
    steps: sortedSteps.map((s) => ({
      level: s.level,
      approver: s.approver,
      role: s.role || "",
      notes: s.notes || "",
      isEnabled: s.isEnabled !== false,
    })),
  });

  return ApprovalRoute.findById(route._id)
    .populate(POPULATE_CREATED_BY)
    .populate(POPULATE_STEPS)
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

  const { name, description, isPublic, steps } = data || {};

  if (name !== undefined) {
    if (!String(name).trim()) throw httpError("Route name cannot be empty.", 400);
    route.name = String(name).trim();
  }

  if (description !== undefined) {
    route.description = String(description).trim();
  }

  if (isPublic !== undefined) {
    route.isPublic = Boolean(isPublic);
  }

  if (steps !== undefined) {
    if (!Array.isArray(steps) || steps.length === 0) {
      throw httpError("At least one approver step is required.", 400);
    }

    const sortedSteps = [...steps].sort((a, b) => a.level - b.level);

    for (let i = 0; i < sortedSteps.length; i++) {
      const s = sortedSteps[i];
      if (!s.approver || !mongoose.Types.ObjectId.isValid(s.approver)) {
        throw httpError(`Step ${i + 1}: invalid approver ID.`, 400);
      }
      if (s.level !== i + 1) {
        throw httpError(
          `Steps must be sequential starting at 1. Got level ${s.level} at position ${i + 1}.`,
          400,
        );
      }
    }

    const approverIds = sortedSteps.map((s) => String(s.approver));
    if (new Set(approverIds).size !== approverIds.length) {
      throw httpError("Each step must have a unique approver.", 400);
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

  console.log("[UPDATE ROUTE] Saving route with steps:", JSON.stringify(route.steps, null, 2));
  await route.save();
  console.log("[UPDATE ROUTE] Save successful");

  return ApprovalRoute.findById(route._id)
    .populate(POPULATE_CREATED_BY)
    .populate(POPULATE_STEPS)
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
    .map((s) => String(s.approver));
}

/* ─── UPSERT (create-or-update for personal routes) ── */
async function upsertMyApprovalRouteService({ data, requesterId }) {
  assertObjectId(requesterId, "requesterId");

  const { name, steps, isPublic } = data || {};

  if (!Array.isArray(steps) || steps.length === 0) {
    throw httpError("At least one approver step is required.", 400);
  }

  const sortedSteps = [...steps].sort((a, b) => a.level - b.level);

  // Re-number levels sequentially to be safe
  const normalizedSteps = sortedSteps.map((s, i) => ({
    level: i + 1,
    approver: s.approver,
    role: s.role || "",
    notes: s.notes || "",
    isEnabled: s.isEnabled !== false,
  }));

  for (const s of normalizedSteps) {
    if (!s.approver || !mongoose.Types.ObjectId.isValid(s.approver)) {
      throw httpError(`Step ${s.level}: invalid approver ID.`, 400);
    }
  }

  const approverIds = normalizedSteps.map((s) => String(s.approver));
  const found = await Employee.countDocuments({ _id: { $in: approverIds } });
  if (found !== approverIds.length) {
    throw httpError("One or more approvers not found.", 404);
  }

  const routeName = name || "Personal Workflow";

  // Clean up any duplicates caused by the previous race condition bug
  const userRoutes = await ApprovalRoute.find({ createdBy: requesterId }).sort({ createdAt: -1 });
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
    route = await ApprovalRoute.findByIdAndUpdate(
      targetRouteId,
      {
        $set: {
          name: String(routeName).trim(),
          isPublic: isPublic === true,
          steps: normalizedSteps,
        },
      },
      { new: true, runValidators: true }
    );
  } else {
    route = await ApprovalRoute.create({
      createdBy: requesterId,
      name: String(routeName).trim(),
      isPublic: isPublic === true,
      steps: normalizedSteps,
    });
  }

  return ApprovalRoute.findById(route._id)
    .populate(POPULATE_CREATED_BY)
    .populate(POPULATE_STEPS)
    .lean();
}

module.exports = {
  getAllApprovalRoutesService,
  getApprovalRouteByIdService,
  createApprovalRouteService,
  updateApprovalRouteService,
  deleteApprovalRouteService,
  resolveApproversFromRoute,
  upsertMyApprovalRouteService,
};
