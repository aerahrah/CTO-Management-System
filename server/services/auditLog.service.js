// services/auditLog.service.js
const mongoose = require("mongoose");
const AuditLog = require("../models/auditLogModel");

// --- CONSTANTS & IMMUTABILITY ---
const ALLOWED_LIMITS = Object.freeze([10, 20, 50, 100]);
const ALLOWED_METHODS = Object.freeze([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

// --- HELPER FUNCTIONS ---

function createServiceError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Sanitizes input strings by removing null bytes and escaping regex characters.
 * Limits length to prevent ReDoS (Regular Expression Denial of Service).
 */
function sanitizeSearch(str, limit = 100) {
  return String(str || "")
    .replace(/\0/g, "") // Prevent Null Byte Injection
    .slice(0, limit)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseIntSafe(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function parseDateSafe(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// --- SERVICE METHODS ---

const createAuditLog = async (data = {}) => {
  // Prevent mass assignment vulnerabilities by explicitly selecting allowed fields
  const {
    userId,
    username,
    method,
    endpoint,
    url,
    statusCode,
    ip,
    summary,
    timestamp,
  } = data;

  return AuditLog.create({
    userId,
    username,
    method: method ? String(method).toUpperCase() : undefined,
    endpoint,
    url,
    statusCode: parseIntSafe(statusCode, undefined),
    ip,
    summary,
    timestamp: parseDateSafe(timestamp) || new Date(),
  });
};

const getAuditLogs = async ({
  page = 1,
  limit = 10,
  userId,
  username,
  method,
  endpoint,
  statusCode,
  startDate,
  endDate,
} = {}) => {
  let parsedLimit = parseIntSafe(limit, 10);
  if (!ALLOWED_LIMITS.includes(parsedLimit)) parsedLimit = 10;

  const parsedPage = Math.max(parseIntSafe(page, 1), 1);
  const skip = (parsedPage - 1) * parsedLimit;

  const filter = {};

  if (userId) {
    if (!mongoose.isValidObjectId(userId)) {
      throw createServiceError("Invalid User ID format", 400);
    }
    filter.userId = userId;
  }

  if (username) {
    const safeUsername = sanitizeSearch(username, 100);
    if (safeUsername) filter.username = { $regex: safeUsername, $options: "i" };
  }

  if (method) {
    const m = String(method).toUpperCase();
    if (ALLOWED_METHODS.includes(m)) {
      filter.method = m;
    }
  }

  if (endpoint) {
    const safeEndpoint = sanitizeSearch(endpoint, 150);
    if (safeEndpoint) filter.endpoint = { $regex: safeEndpoint, $options: "i" };
  }

  if (statusCode !== undefined && statusCode !== null && statusCode !== "") {
    const sc = parseIntSafe(statusCode, NaN);
    if (Number.isFinite(sc)) filter.statusCode = sc;
  }

  const sd = parseDateSafe(startDate);
  const ed = parseDateSafe(endDate);

  if (sd || ed) {
    filter.timestamp = {};
    if (sd) filter.timestamp.$gte = sd;
    if (ed) filter.timestamp.$lte = ed;
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .select("-__v") // Prevent leaking internal Mongoose versioning keys
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(), // Use lean() for performance, returning plain JS objects
    AuditLog.countDocuments(filter),
  ]);

  return {
    data: logs,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit) || 1, // Fallback to 1 if total is 0
  };
};

module.exports = {
  createAuditLog,
  getAuditLogs,
};
