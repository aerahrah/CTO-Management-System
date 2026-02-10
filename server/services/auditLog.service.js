// services/auditLog.service.js
const AuditLog = require("../models/auditLogModel");

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

const createAuditLog = async (data) => {
  return AuditLog.create(data);
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
}) => {
  const allowedLimits = [10, 20, 50, 100];
  limit = parseIntSafe(limit, 10);
  if (!allowedLimits.includes(limit)) limit = 10;

  page = Math.max(parseIntSafe(page, 1), 1);
  const skip = (page - 1) * limit;

  const filter = {};

  if (userId) filter.userId = userId;

  if (username) {
    const safe = escapeRegExp(username);
    filter.username = { $regex: safe, $options: "i" };
  }

  if (method) {
    const m = String(method).toUpperCase();
    filter.method = m;
  }

  if (endpoint) {
    const safe = escapeRegExp(endpoint);
    filter.endpoint = { $regex: safe, $options: "i" };
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
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    data: logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

module.exports = {
  createAuditLog,
  getAuditLogs,
};
