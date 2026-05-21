// services/designation.service.js
const mongoose = require("mongoose");
const Designation = require("../models/designationModel");

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
    throw httpError("Invalid designation id format", 400);
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

async function createDesignation(payload = {}) {
  const { name } = payload;
  const status = normalizeStatus(payload.status);

  if (!name || typeof name !== "string" || !name.trim()) {
    throw httpError("Designation name is required and must be a string", 400);
  }

  const sanitizedName = name.trim();

  // Use collation for case-insensitive uniqueness check
  const exists = await Designation.findOne({ name: sanitizedName })
    .collation({ locale: "en", strength: 2 })
    .lean();

  if (exists) throw httpError("Designation name already exists", 409);

  return Designation.create({
    name: sanitizedName,
    ...(status ? { status } : {}),
  });
}

async function listDesignations(query = {}) {
  const filter = {};
  if (query.status) filter.status = normalizeStatus(query.status);

  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Designation.find(filter)
      .select("-__v") // Exclude internal version key
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Designation.countDocuments(filter),
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

async function listAllDesignations(query = {}) {
  const filter = {};
  if (query.status) filter.status = normalizeStatus(query.status);

  const items = await Designation.find(filter)
    .select("_id name status")
    .sort({ name: 1 })
    .lean();

  return { items, total: items.length };
}

async function getDesignationById(id) {
  assertObjectId(id);

  const designation = await Designation.findById(id).select("-__v").lean();
  if (!designation) throw httpError("Designation not found", 404);

  return designation;
}

async function updateDesignation(id, payload = {}) {
  assertObjectId(id);

  const updateFields = {};

  if (payload.name !== undefined) {
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      throw httpError("Designation name must be a non-empty string", 400);
    }

    const sanitizedName = payload.name.trim();

    // Check uniqueness ignoring case, excluding the current document
    const existing = await Designation.findOne({
      name: sanitizedName,
      _id: { $ne: id },
    })
      .collation({ locale: "en", strength: 2 })
      .lean();

    if (existing) throw httpError("Designation name already exists", 409);

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
  const designation = await Designation.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { new: true, runValidators: true },
  )
    .select("-__v")
    .lean();

  if (!designation) throw httpError("Designation not found", 404);
  return designation;
}

async function deleteDesignation(id) {
  assertObjectId(id);

  // Select only ID to limit memory overhead
  const deleted = await Designation.findByIdAndDelete(id).select("_id").lean();
  if (!deleted) throw httpError("Designation not found", 404);

  return deleted;
}

async function updateDesignationStatus(id, status) {
  assertObjectId(id);

  const validStatus = normalizeStatus(status);

  const designation = await Designation.findByIdAndUpdate(
    id,
    { $set: { status: validStatus } },
    { new: true, runValidators: true },
  )
    .select("-__v")
    .lean();

  if (!designation) throw httpError("Designation not found", 404);
  return designation;
}

module.exports = {
  createDesignation,
  listDesignations,
  listAllDesignations,
  getDesignationById,
  updateDesignation,
  deleteDesignation,
  updateDesignationStatus,
};
