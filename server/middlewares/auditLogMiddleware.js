// middlewares/auditLogMiddleware.js
const mongoose = require("mongoose");
const auditLogService = require("../services/auditLog.service");
const Employee = require("../models/employeeModel");
const Project = require("../models/projectModel"); // ✅ NEW (for before snapshots if controller didn't attach)
const getEndpointName = require("../utils/endpointMap");
const buildAuditDetails = require("../utils/auditActionBuilder");

// === Config ===
const EXCLUDED_KEYWORDS = ["login", "signup", "reset-password"];
const EXCLUDED_ENDPOINTS = [
  "Approve CTO Application",
  "Reject CTO Application",
]; // handled manually elsewhere
const LOG_METHODS = ["POST", "PUT", "DELETE", "PATCH"];
const SENSITIVE_GETS = []; // URLs to log selectively even on GET

// === Helper: match URL patterns ===
const matchUrl = (url, pattern) => {
  const regex = new RegExp("^" + pattern.replace(/:\w+/g, "\\w+") + "$");
  return regex.test(url);
};

// ✅ Helper: normalize URL for endpointMap matching (removes query + optional /api prefix)
const normalizeUrlForMap = (url) => {
  const clean = String(url || "").split("?")[0];
  return clean.replace(/^\/api/, ""); // adjust if your prefix is different
};

// ✅ Helper: safe pick from req.user (supports both {id} and {_id})
const getActorFromReq = (req) => {
  const actorId = req.user?.id || req.user?._id || "GuestID";
  const actorUsername = req.user?.username || "Guest";
  return {
    actorId,
    actorUsername,
    actor: `${actorUsername} (id: ${actorId})`,
  };
};

// ✅ Helper: best-effort "before" for Projects (if controller didn't attach req.auditBeforeProject)
const tryFetchProjectBefore = async (projectId) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) return null;
  const p = await Project.findById(projectId).select("name status");
  if (!p) return null;
  return { name: p.name, status: p.status, _id: p._id };
};

// === Middleware function ===
const auditLogger = (req, res, next) => {
  const url = req.originalUrl;

  // Skip excluded keywords
  if (EXCLUDED_KEYWORDS.some((word) => url.includes(word))) return next();

  // Skip logging if method not in LOG_METHODS and not sensitive GET
  const isSensitiveGet =
    req.method === "GET" && SENSITIVE_GETS.some((p) => matchUrl(url, p));

  if (!LOG_METHODS.includes(req.method) && !isSensitiveGet) return next();

  // Skip if service flagged it
  if (req.skipAudit) return next();

  res.on("finish", async () => {
    try {
      const urlForMap = normalizeUrlForMap(url);
      const endpoint = getEndpointName(urlForMap, req.method);

      // Skip excluded endpoints
      if (EXCLUDED_ENDPOINTS.includes(endpoint)) return;

      const { actorId, actorUsername, actor } = getActorFromReq(req);

      let targetUsers = [];
      let beforeData = null;

      /* =========================
         1) Bulk employees for CTO Credit
      ========================= */
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
          // keep as array for bulk (builder can handle array too)
          beforeData = employees.map((emp) => ({ role: emp.role }));
        }
      } else if (
        /* =========================
         2) Project operations (✅ NEW + fixes "before" N/A)
         Prefer controller-attached snapshot:
           req.auditBeforeProject, req.auditTarget
      ========================= */
        ["Update Project", "Update Project Status", "Delete Project"].includes(
          endpoint,
        ) &&
        req.params.id &&
        mongoose.Types.ObjectId.isValid(req.params.id)
      ) {
        // target label
        if (req.auditTarget) targetUsers = [req.auditTarget];

        // before snapshot
        if (req.auditBeforeProject) {
          beforeData = req.auditBeforeProject;
        } else {
          // fallback: fetch before (may be null if already deleted)
          const before = await tryFetchProjectBefore(req.params.id);
          if (before) {
            beforeData = { name: before.name, status: before.status };
            if (!targetUsers.length) {
              targetUsers = [`${before.name || "N/A"} (id: ${before._id})`];
            }
          }
        }

        if (!targetUsers.length) {
          targetUsers = [`N/A (id: ${req.params.id})`];
        }
        if (!beforeData) beforeData = {};
      } else if (
        /* =========================
         3) Single employee operations (existing)
      ========================= */
        req.params.id &&
        mongoose.Types.ObjectId.isValid(req.params.id)
      ) {
        const emp = await Employee.findById(req.params.id).select(
          "username role",
        );
        if (emp) {
          targetUsers.push(`${emp.username} (id: ${emp._id})`);
          beforeData = { role: emp.role };
        } else {
          targetUsers.push(`N/A (id: ${req.params.id})`);
          beforeData = {};
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
        before: beforeData,
      });

      // Save audit log
      await auditLogService.createAuditLog({
        userId: actorId === "GuestID" ? null : actorId, // ✅ store real id when present
        username: actorUsername,
        method: req.method,
        endpoint,
        url: urlForMap,
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

module.exports = auditLogger;
