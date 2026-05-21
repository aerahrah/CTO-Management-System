// services/project.service.js
const mongoose = require("mongoose");
const Project = require("../models/projectModel");

// Freeze arrays to prevent accidental mutation or prototype pollution
const ALLOWED_LIMITS = Object.freeze([20, 50, 100]);
const ALLOWED_STATUS = Object.freeze(["Active", "Inactive"]);

// --- HELPER FUNCTIONS ---

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw httpError("Invalid project id format", 400);
  }
}

function parsePage(value) {
  const page = Number.parseInt(String(value ?? "1"), 10);
  if (Number.isNaN(page) || page < 1) {
    throw httpError("Invalid page number", 400);
  }
  return page;
}

function parseLimit(value) {
  if (value === undefined || value === null || value === "") return 20;
  const limit = Number.parseInt(String(value), 10);

  if (Number.isNaN(limit)) throw httpError("Invalid limit", 400);

  if (!ALLOWED_LIMITS.includes(limit)) {
    throw httpError(
      `Invalid limit. Allowed values: ${ALLOWED_LIMITS.join(", ")}`,
      400,
    );
  }
  return limit;
}

function normalizeStatus(status) {
  if (status === undefined) return undefined;

  if (!ALLOWED_STATUS.includes(status)) {
    throw httpError(
      `Invalid status. Allowed values: ${ALLOWED_STATUS.join(", ")}`,
      400,
    );
  }
  return status;
}

// --- SERVICE METHODS ---

async function createProject(payload = {}) {
  const { name } = payload;
  const status = normalizeStatus(payload.status);

  if (!name || typeof name !== "string" || !name.trim()) {
    throw httpError("Project name is required and must be a string", 400);
  }

  const sanitizedName = name.trim();

  // Use collation for case-insensitive uniqueness check
  const exists = await Project.findOne({ name: sanitizedName })
    .collation({ locale: "en", strength: 2 })
    .lean();

  if (exists) throw httpError("Project name already exists", 409);

  return Project.create({
    name: sanitizedName,
    ...(status ? { status } : {}),
  });
}

async function listProjects(query = {}) {
  const filter = {};
  if (query.status) filter.status = normalizeStatus(query.status);

  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Project.find(filter)
      .select("-__v") // Exclude internal version key
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Project.countDocuments(filter),
  ]);

  return {
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1, // Fallback to 1 if total is 0
    allowedLimits: ALLOWED_LIMITS,
  };
}

async function listAllProjects(query = {}) {
  const filter = {};
  if (query.status) filter.status = normalizeStatus(query.status);

  const items = await Project.find(filter)
    .select("_id name status")
    .sort({ name: 1 })
    .lean();

  return { items, total: items.length };
}

async function getProjectById(id) {
  assertObjectId(id);

  const project = await Project.findById(id).select("-__v").lean();
  if (!project) throw httpError("Project not found", 404);

  return project;
}

async function updateProject(id, payload = {}) {
  assertObjectId(id);

  const updateFields = {};

  if (payload.name !== undefined) {
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      throw httpError("Project name must be a non-empty string", 400);
    }

    const sanitizedName = payload.name.trim();

    // Check uniqueness ignoring case, excluding the current document
    const existing = await Project.findOne({
      name: sanitizedName,
      _id: { $ne: id },
    })
      .collation({ locale: "en", strength: 2 })
      .lean();

    if (existing) throw httpError("Project name already exists", 409);

    updateFields.name = sanitizedName;
  }

  if (payload.status !== undefined) {
    updateFields.status = normalizeStatus(payload.status);
  }

  // Prevent database hit if nothing is actually being updated
  if (Object.keys(updateFields).length === 0) {
    throw httpError("No valid fields provided to update", 400);
  }

  // Explicitly use $set to prevent document overwrites
  const project = await Project.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { new: true, runValidators: true },
  )
    .select("-__v")
    .lean();

  if (!project) throw httpError("Project not found", 404);
  return project;
}

async function deleteProject(id) {
  assertObjectId(id);

  const deleted = await Project.findByIdAndDelete(id).select("_id").lean();
  if (!deleted) throw httpError("Project not found", 404);

  return deleted;
}

async function updateProjectStatus(id, status) {
  assertObjectId(id);

  const validStatus = normalizeStatus(status);

  const project = await Project.findByIdAndUpdate(
    id,
    { $set: { status: validStatus } },
    { new: true, runValidators: true },
  )
    .select("-__v")
    .lean();

  if (!project) throw httpError("Project not found", 404);
  return project;
}

module.exports = {
  createProject,
  listProjects,
  listAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  updateProjectStatus,
};
