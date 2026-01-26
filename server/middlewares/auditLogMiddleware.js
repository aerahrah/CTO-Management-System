const auditLogService = require("../services/auditLog.service");
const getEndpointName = require("../utils/endpointMap");

const EXCLUDED_KEYWORDS = ["login", "signup", "reset-password"];
const LOG_METHODS = ["POST", "PUT", "DELETE", "PATCH"];
const SENSITIVE_GETS = [
  //   "/employee/my-profile",
  //   "/employee/memos/me",
  //   "/employee/memos/:id",
  //   "/cto/credits/my-credits",
  //   "/cto/credits/:employeeId/history",
  //   "/cto/applications/my-application",
  //   "/cto/applications/employee/:employeeId",
  //   "/cto/applications/approvers/my-approvals",
  //   "/cto/applications/approvers/my-approvals/:id",
];

const auditLogger = (req, res, next) => {
  const url = req.originalUrl;

  // Skip excluded keywords
  if (EXCLUDED_KEYWORDS.some((word) => url.includes(word))) return next();

  // Only log POST, PUT, PATCH, DELETE, OR sensitive GET
  const isSensitiveGet =
    req.method === "GET" &&
    SENSITIVE_GETS.some((pattern) => matchUrl(url, pattern));

  if (!LOG_METHODS.includes(req.method) && !isSensitiveGet) return next();

  res.on("finish", async () => {
    try {
      const endpoint = getEndpointName(url, req.method);
      const clientIp =
        req.headers["x-forwarded-for"] || req.socket.remoteAddress;

      await auditLogService.createAuditLog({
        userId: req.user?._id || null,
        username: req.user?.username || "Guest",
        method: req.method,
        endpoint,
        url,
        statusCode: res.statusCode,
        ip: clientIp,
        requestBody: sanitizeBody(req.body),
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("Audit log error:", err);
    }
  });

  next();
};

// Replace :param with regex for GET matching
const matchUrl = (url, pattern) => {
  const regex = new RegExp("^" + pattern.replace(/:\w+/g, "\\w+") + "$");
  return regex.test(url);
};

const sanitizeBody = (body) => {
  if (!body) return {};
  const cloned = { ...body };
  delete cloned.password;
  delete cloned.confirmPassword;
  return cloned;
};

module.exports = auditLogger;
