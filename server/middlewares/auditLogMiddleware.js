// middlewares/auditLogMiddleware.js
const mongoose = require("mongoose");
const auditLogService = require("../services/auditLog.service");
const Employee = require("../models/employeeModel");
const getEndpointName = require("../utils/endpointMap");
const buildAuditDetails = require("../utils/auditActionBuilder");

// === Config ===
const EXCLUDED_KEYWORDS = ["login", "signup", "reset-password"];
const EXCLUDED_ENDPOINTS = [
  "Approve CTO Application",
  "Reject CTO Application",
]; // endpoints handled manually in service
const LOG_METHODS = ["POST", "PUT", "DELETE", "PATCH"];
const SENSITIVE_GETS = []; // URLs to log selectively even on GET

// === Middleware function ===
const auditLogger = (req, res, next) => {
  const url = req.originalUrl;

  // Skip excluded keywords
  if (EXCLUDED_KEYWORDS.some((word) => url.includes(word))) return next();

  // Skip logging if method not in LOG_METHODS and not sensitive GET
  const isSensitiveGet =
    req.method === "GET" &&
    SENSITIVE_GETS.some((pattern) => matchUrl(url, pattern));

  if (!LOG_METHODS.includes(req.method) && !isSensitiveGet) return next();

  // Skip if service flagged it
  if (req.skipAudit) return next();

  res.on("finish", async () => {
    try {
      const endpoint = getEndpointName(url, req.method);

      // Skip excluded endpoints (like Approve CTO Application)
      if (EXCLUDED_ENDPOINTS.includes(endpoint)) return;

      const actorId = req.user?.id || "GuestID";
      const actorUsername = req.user?.username || "Guest";
      const actor = `${actorUsername} (id: ${actorId})`;

      let targetUsers = [];
      let beforeData = [];

      // 1️⃣ Bulk employees for CTO Credit
      if (
        req.body?.employees?.length &&
        endpoint === "Add CTO Credit Request"
      ) {
        let empIds = Array.isArray(req.body.employees)
          ? req.body.employees
          : JSON.parse(req.body.employees);

        empIds = empIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

        if (empIds.length) {
          const employees = await Employee.find({
            _id: { $in: empIds },
          }).select("username role");
          targetUsers = employees.map(
            (emp) => `${emp.username} (id: ${emp._id})`,
          );
          beforeData = employees.map((emp) => ({ role: emp.role }));
        }
      }
      // 2️⃣ Single employee operations
      else if (
        req.params.id &&
        mongoose.Types.ObjectId.isValid(req.params.id)
      ) {
        const emp = await Employee.findById(req.params.id).select(
          "username role",
        );
        if (emp) {
          targetUsers.push(`${emp.username} (id: ${emp._id})`);
          beforeData.push({ role: emp.role });
        } else {
          targetUsers.push(`N/A (id: ${req.params.id})`);
          beforeData.push({});
        }
      }

      const targetSummary = targetUsers.join(", ");

      // Build audit summary
      const audit = buildAuditDetails({
        endpoint,
        method: req.method,
        body: req.body,
        params: req.params,
        actor,
        targetUser: targetSummary,
        before: beforeData.length === 1 ? beforeData[0] : beforeData,
      });

      // Save audit log
      await auditLogService.createAuditLog({
        userId: req.user?._id || null,
        username: actorUsername,
        method: req.method,
        endpoint,
        url,
        statusCode: res.statusCode,
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        summary: audit.summary,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("Audit log error:", err);
    }
  });

  next();
};

// === Helper function to match URL patterns ===
const matchUrl = (url, pattern) => {
  const regex = new RegExp("^" + pattern.replace(/:\w+/g, "\\w+") + "$");
  return regex.test(url);
};

module.exports = auditLogger;
