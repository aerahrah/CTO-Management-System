// services/designation.service.js
const mongoose = require("mongoose");
const Designation = require("../models/designationModel");

const ALLOWED_LIMITS = [20, 50, 100];
const ALLOWED_STATUS = ["Active", "Inactive"];

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError("Invalid designation id", 400);
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

function normalizeStatus(status) {
  if (status === undefined) return undefined;
  if (!ALLOWED_STATUS.includes(status)) {
    throw httpError("Invalid status. Allowed values: Active, Inactive", 400);
  }
  return status;
}

async function createDesignation(payload) {
  const { name } = payload || {};
  const status = normalizeStatus(payload?.status);

  if (!name || typeof name !== "string" || !name.trim()) {
    throw httpError("Designation name is required", 400);
  }

  const exists = await Designation.findOne({ name: name.trim() });
  if (exists) throw httpError("Designation name already exists", 409);

  return Designation.create({
    name: name.trim(),
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
    pages: Math.ceil(total / limit),
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

  const designation = await Designation.findById(id).lean();
  if (!designation) throw httpError("Designation not found", 404);

  return designation;
}

async function updateDesignation(id, payload) {
  assertObjectId(id);

  const update = {};

  if (payload.name !== undefined) {
    if (
      !payload.name ||
      typeof payload.name !== "string" ||
      !payload.name.trim()
    ) {
      throw httpError("Designation name must be a non-empty string", 400);
    }

    const existing = await Designation.findOne({
      name: payload.name.trim(),
      _id: { $ne: id },
    });
    if (existing) throw httpError("Designation name already exists", 409);

    update.name = payload.name.trim();
  }

  if (payload.status !== undefined) {
    update.status = normalizeStatus(payload.status);
  }

  const designation = await Designation.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).lean();

  if (!designation) throw httpError("Designation not found", 404);
  return designation;
}

async function deleteDesignation(id) {
  assertObjectId(id);

  const deleted = await Designation.findByIdAndDelete(id).lean();
  if (!deleted) throw httpError("Designation not found", 404);

  return deleted;
}

async function updateDesignationStatus(id, status) {
  assertObjectId(id);

  const st = normalizeStatus(status);

  const designation = await Designation.findByIdAndUpdate(
    id,
    { status: st },
    { new: true, runValidators: true },
  ).lean();

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
