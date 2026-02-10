const mongoose = require("mongoose");
const Project = require("../models/projectModel");

const ALLOWED_LIMITS = [20, 50, 100];

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError("Invalid project id", 400);
  }
}

function parsePage(value) {
  const page = Number.parseInt(String(value ?? "1"), 10);
  if (Number.isNaN(page) || page < 1)
    throw httpError("Invalid page number", 400);
  return page;
}

function parseLimit(value) {
  if (value === undefined || value === null || value === "") return 20;

  const limit = Number.parseInt(String(value), 10);
  if (Number.isNaN(limit)) throw httpError("Invalid limit", 400);

  if (!ALLOWED_LIMITS.includes(limit)) {
    throw httpError("Invalid limit. Allowed values: 20, 50, 100", 400);
  }

  return limit;
}

async function createProject(payload) {
  const { name, status } = payload;

  if (!name || typeof name !== "string" || !name.trim()) {
    throw httpError("Project name is required", 400);
  }

  const exists = await Project.findOne({ name: name.trim() });
  if (exists) throw httpError("Project name already exists", 409);

  return Project.create({
    name: name.trim(),
    ...(status ? { status } : {}),
  });
}

async function listProjects(query = {}) {
  const filter = {};
  if (query.status) filter.status = query.status;

  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Project.countDocuments(filter),
  ]);

  return {
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    allowedLimits: ALLOWED_LIMITS,
  };
}

/**
 * ✅ NEW: listAllProjects (NO pagination)
 * Use this for dropdown/options.
 * - supports optional ?status=Active|Inactive
 * - returns minimal fields and sorted by name
 */
async function listAllProjects(query = {}) {
  const filter = {};
  if (query.status) filter.status = query.status;

  const items = await Project.find(filter)
    .select("_id name status") // keep payload small for options
    .sort({ name: 1 });

  return {
    items,
    total: items.length,
  };
}

async function getProjectById(id) {
  assertObjectId(id);

  const project = await Project.findById(id);
  if (!project) throw httpError("Project not found", 404);

  return project;
}

async function updateProject(id, payload) {
  assertObjectId(id);

  const update = {};

  if (payload.name !== undefined) {
    if (
      !payload.name ||
      typeof payload.name !== "string" ||
      !payload.name.trim()
    ) {
      throw httpError("Project name must be a non-empty string", 400);
    }

    const existing = await Project.findOne({
      name: payload.name.trim(),
      _id: { $ne: id },
    });

    if (existing) throw httpError("Project name already exists", 409);

    update.name = payload.name.trim();
  }

  if (payload.status !== undefined) {
    update.status = payload.status;
  }

  const project = await Project.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });

  if (!project) throw httpError("Project not found", 404);
  return project;
}

async function deleteProject(id) {
  assertObjectId(id);

  const deleted = await Project.findByIdAndDelete(id);
  if (!deleted) throw httpError("Project not found", 404);

  return deleted;
}

/* ✅ ONE API: set status Active/Inactive */
async function updateProjectStatus(id, status) {
  assertObjectId(id);

  if (!status || !["Active", "Inactive"].includes(status)) {
    throw httpError("Invalid status. Allowed values: Active, Inactive", 400);
  }

  const project = await Project.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true },
  );

  if (!project) throw httpError("Project not found", 404);
  return project;
}

module.exports = {
  createProject,
  listProjects,
  listAllProjects, // ✅ export
  getProjectById,
  updateProject,
  deleteProject,
  updateProjectStatus,
};
