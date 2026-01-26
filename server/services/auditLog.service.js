const AuditLog = require("../models/auditLogModel");

/**
 * Create a new audit log
 */
const createAuditLog = async (data) => {
  return await AuditLog.create(data);
};

/**
 * Get audit logs with pagination and filters
 * @param {Object} options - pagination and filters
 * @param {number} options.page - page number
 * @param {number} options.limit - items per page (10, 20, 50, 100)
 * @param {string} options.userId - filter by user ID
 * @param {string} options.username - filter by username (partial match)
 * @param {string} options.method - filter by HTTP method (GET, POST, etc.)
 * @param {string} options.endpoint - filter by endpoint (partial match)
 * @param {number} options.statusCode - filter by HTTP status code
 * @param {string} options.startDate - filter by start date (ISO string)
 * @param {string} options.endDate - filter by end date (ISO string)
 */
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
  // Ensure minimum page size 10 and allowed options
  const allowedLimits = [10, 20, 50, 100];
  limit = parseInt(limit);
  if (!allowedLimits.includes(limit)) limit = 10;

  page = parseInt(page) || 1;
  const skip = (page - 1) * limit;

  // Build filter object
  const filter = {};
  if (userId) filter.userId = userId;
  if (username) filter.username = { $regex: username, $options: "i" }; // case-insensitive partial match
  if (method) filter.method = method.toUpperCase();
  if (endpoint) filter.endpoint = { $regex: endpoint, $options: "i" };
  if (statusCode) filter.statusCode = statusCode;
  if (startDate || endDate) filter.timestamp = {};
  if (startDate) filter.timestamp.$gte = new Date(startDate);
  if (endDate) filter.timestamp.$lte = new Date(endDate);

  const logs = await AuditLog.find(filter)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit);

  const total = await AuditLog.countDocuments(filter);

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
