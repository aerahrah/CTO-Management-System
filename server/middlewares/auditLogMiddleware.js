// middlewares/auditLogMiddleware.js
const mongoose = require("mongoose");
const auditLogService = require("../services/auditLog.service");
const Employee = require("../models/employeeModel");
const Project = require("../models/projectModel");
const Designation = require("../models/designationModel");
const getEndpointName = require("../utils/endpointMap");
const buildAuditDetails = require("../utils/auditActionBuilder");

// === Config ===
const EXCLUDED_KEYWORDS = ["login", "signup", "reset-password"];
const EXCLUDED_ENDPOINTS = [
  "Approve CTO Application",
  "Reject CTO Application",
];
const LOG_METHODS = ["POST", "PUT", "DELETE", "PATCH"];
const SENSITIVE_GETS = [];

// === Helper: match URL patterns ===
const matchUrl = (url, pattern) => {
  const regex = new RegExp("^" + pattern.replace(/:\w+/g, "\\w+") + "$");
  return regex.test(url);
};

const normalizeUrlForMap = (url) => {
  const clean = String(url || "").split("?")[0];
  return clean.replace(/^\/api/, ""); // endpointMap expects no "/api"
};

const getActorFromReq = (req) => {
  const actorId = req.user?.id || req.user?._id || "GuestID";
  const actorUsername = req.user?.username || "Guest";
  return { actorId, actorUsername, actor: `${actorUsername} (id: ${actorId})` };
};

const safeJsonParse = (val, fallback) => {
  if (val === undefined || val === null) return fallback;
  if (typeof val !== "string") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

// ✅ Since req.params is EMPTY in global middleware, extract IDs from URL
const extractMongoId = (path, regex) => {
  const m = String(path || "").match(regex);
  if (!m) return null;
  const id = m[1];
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
};

const auditLogger = async (req, res, next) => {
  // ✅ Allow preflight to pass cleanly
  if (req.method === "OPTIONS") return next();

  const url = req.originalUrl;
  if (EXCLUDED_KEYWORDS.some((word) => url.includes(word))) return next();

  const isSensitiveGet =
    req.method === "GET" && SENSITIVE_GETS.some((p) => matchUrl(url, p));

  if (!LOG_METHODS.includes(req.method) && !isSensitiveGet) return next();
  if (req.skipAudit) return next();

  const urlForMap = normalizeUrlForMap(url);
  const endpoint = getEndpointName(urlForMap, req.method);

  if (EXCLUDED_ENDPOINTS.includes(endpoint)) return next();

  // ✅ PREFETCH "BEFORE" DATA (must happen BEFORE next())
  // NOTE: do NOT use req.params here (it is empty)
  try {
    // 1) Update Employee Role: /employee/:id/role (POST)
    if (endpoint === "Update Employee Role") {
      const empId = extractMongoId(
        urlForMap,
        /^\/employee\/([a-fA-F0-9]{24})\/role$/,
      );
      if (empId) {
        const emp = await Employee.findById(empId).select("username role");
        if (emp) {
          res.locals.auditTargetUsers = [`${emp.username} (id: ${emp._id})`];
          res.locals.auditBefore = { role: emp.role };
        }
      }
    }

    // 2) Update Employee: /employee/:id (PUT)
    if (endpoint === "Update Employee") {
      const empId = extractMongoId(
        urlForMap,
        /^\/employee\/([a-fA-F0-9]{24})$/,
      );
      if (empId) {
        const emp = await Employee.findById(empId).select("username role");
        if (emp) {
          res.locals.auditTargetUsers = [`${emp.username} (id: ${emp._id})`];
          res.locals.auditBefore = { role: emp.role };
        }
      }
    }

    // 3) Project update/delete: /settings/projects/:id or /settings/projects/:id/status
    if (
      ["Update Project", "Update Project Status", "Delete Project"].includes(
        endpoint,
      )
    ) {
      const projId =
        extractMongoId(
          urlForMap,
          /^\/settings\/projects\/([a-fA-F0-9]{24})$/,
        ) ||
        extractMongoId(
          urlForMap,
          /^\/settings\/projects\/([a-fA-F0-9]{24})\/status$/,
        );

      if (projId) {
        const p = await Project.findById(projId).select("name status");
        if (p) {
          res.locals.auditTargetUsers = [`${p.name || "N/A"} (id: ${p._id})`];
          res.locals.auditBefore = { name: p.name, status: p.status };
        }
      }
    }

    // 4) Designation update/delete: /settings/designation/:id or /settings/designation/:id/status
    if (
      [
        "Update Designation",
        "Update Designation Status",
        "Delete Designation",
      ].includes(endpoint)
    ) {
      const desId =
        extractMongoId(
          urlForMap,
          /^\/settings\/designation\/([a-fA-F0-9]{24})$/,
        ) ||
        extractMongoId(
          urlForMap,
          /^\/settings\/designation\/([a-fA-F0-9]{24})\/status$/,
        );

      if (desId) {
        const d = await Designation.findById(desId).select("name status");
        if (d) {
          res.locals.auditTargetUsers = [`${d.name || "N/A"} (id: ${d._id})`];
          res.locals.auditBefore = { name: d.name, status: d.status };
        }
      }
    }
  } catch (e) {
    console.error("Audit prefetch error:", e?.message || e);
  }

  res.on("finish", async () => {
    try {
      const { actorId, actorUsername, actor } = getActorFromReq(req);

      // ✅ If controller provided before/after (general settings), prefer those
      const effectiveBefore =
        res.locals.auditBefore !== undefined ? res.locals.auditBefore : null;

      const effectiveBody =
        res.locals.auditAfter !== undefined ? res.locals.auditAfter : req.body;

      // ✅ Determine target users
      let targetUsers = Array.isArray(res.locals.auditTargetUsers)
        ? res.locals.auditTargetUsers
        : [];

      // Bulk employees for CTO Credit (keep your existing logic)
      if (
        req.body?.employees?.length &&
        endpoint === "Add CTO Credit Request"
      ) {
        let empIds = Array.isArray(req.body.employees)
          ? req.body.employees
          : safeJsonParse(req.body.employees, []);

        empIds = (empIds || []).filter((id) =>
          mongoose.Types.ObjectId.isValid(id),
        );

        if (empIds.length) {
          const employees = await Employee.find({
            _id: { $in: empIds },
          }).select("username role");
          targetUsers = employees.map(
            (emp) => `${emp.username} (id: ${emp._id})`,
          );
        }
      }

      const targetSummary = targetUsers.join(", ");

      const audit = buildAuditDetails({
        endpoint,
        method: req.method,
        body: effectiveBody, // after
        params: req.params, // can be empty; builder uses targetSummary mostly
        actor,
        targetUser: targetSummary,
        before: effectiveBefore, // before
      });

      await auditLogService.createAuditLog({
        userId: actorId === "GuestID" ? null : actorId,
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
