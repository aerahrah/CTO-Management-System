// controllers/adminCtoApplicationController.js
const adminCtoService = require("../services/adminCtoApplication.service");

function getUserIdOrThrow(req) {
  const userId = req?.user?.id || req?.user?._id;
  if (!userId) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return String(userId);
}

function parseJsonMaybe(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

// Sends both `message` and `error` so it works with either frontend helper.
function sendError(res, err) {
  const status = err.statusCode || err.status || 500;
  if (status >= 500) console.error("[ADMIN CTO APPLICATION]", err);
  const message =
    status >= 500 ? "Server error" : err.message || "Request failed";
  const body = { message, error: message };
  if (Array.isArray(err.details) && err.details.length)
    body.details = err.details;
  return res.status(status).json(body);
}

const JSON_FIELDS = [
  "inclusiveDates",
  "memo",
  "approvals",
  "notifiedEmployees",
  "lateFiling",
  "actionDetails",
  "certificationOfLeaveCredits",
  "applicantSnapshot",
  "revocation",
  "options",
];
const PLAIN_FIELDS = [
  "reason",
  "employeeType",
  "commutation",
  "requestedHours",
  "overallStatus",
  "editReason",
  "expectedUpdatedAt",
];

// Accepts JSON bodies and form-data (objects/arrays sent as JSON strings).
function readEditPayload(body = {}) {
  const payload = {};
  PLAIN_FIELDS.forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key];
  });
  JSON_FIELDS.forEach((key) => {
    if (body[key] !== undefined)
      payload[key] = parseJsonMaybe(body[key], body[key]);
  });
  return payload;
}

// GET /employees/search?q=&limit=&employeeType=
const searchEmployees = async (req, res) => {
  try {
    const { q, limit, employeeType } = req.query;
    const result = await adminCtoService.searchEmployees({
      q,
      limit,
      employeeType,
    });
    return res.json({ message: "Employees found", ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /employees/:employeeId/balance
const getEmployeeBalance = async (req, res) => {
  try {
    const result = await adminCtoService.getEmployeeBalanceCheck(
      req.params.employeeId,
    );
    return res.json({ message: "Employee CTO balance", ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /employees/:employeeId/recalculate-balance
const recalculateEmployeeBalance = async (req, res) => {
  try {
    getUserIdOrThrow(req);
    const result = await adminCtoService.recalculateEmployeeBalance(
      req.params.employeeId,
    );

    res.locals.auditBefore = {
      employee: req.params.employeeId,
      ctoHours: result.previousBalance,
    };
    res.locals.auditAfter = {
      employee: req.params.employeeId,
      ctoHours: result.newBalance,
    };

    return res.json({
      message: result.changed
        ? `CTO balance updated from ${result.previousBalance} to ${result.newBalance} hours.`
        : "CTO balance already matches the credits. Nothing changed.",
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /employees/:employeeId/credits?applicationId=
const getEmployeeCredits = async (req, res) => {
  try {
    const result = await adminCtoService.listEmployeeCredits(
      req.params.employeeId,
      {
        applicationId: req.query.applicationId,
      },
    );
    return res.json({ message: "Employee CTO memos", ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /?page=&limit=&search=&status=&employeeId=&employeeType=&from=&to=&filedFrom=&filedTo=&sort=
const listApplications = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      employeeId,
      employeeType,
      from,
      to,
      filedFrom,
      filedTo,
      sort,
    } = req.query;
    const result = await adminCtoService.listApplications({
      page,
      limit,
      search,
      status,
      employeeId,
      employeeType,
      from,
      to,
      filedFrom,
      filedTo,
      sort,
    });
    return res.json({ message: "CTO applications", ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /:applicationId
const getApplication = async (req, res) => {
  try {
    const application = await adminCtoService.getApplicationForEdit(
      req.params.applicationId,
    );
    return res.json({ message: "CTO application", application });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /:applicationId/preview — same body as PUT, nothing is saved
const previewApplicationUpdate = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);
    const plan = await adminCtoService.previewApplicationUpdate(
      req.params.applicationId,
      readEditPayload(req.body),
      userId,
    );
    return res.json({ message: "Preview of changes", plan });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUT /:applicationId
const updateApplication = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);
    const result = await adminCtoService.updateApplication(
      req.params.applicationId,
      readEditPayload(req.body),
      userId,
    );

    // for the audit middleware
    res.locals.auditBefore = result.before;
    res.locals.auditAfter = result.application;

    return res.json({
      message: result.changed
        ? "CTO application updated"
        : "No changes to save",
      changed: result.changed,
      application: result.application,
      plan: result.plan,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports = {
  searchEmployees,
  getEmployeeBalance,
  recalculateEmployeeBalance,
  getEmployeeCredits,
  listApplications,
  getApplication,
  previewApplicationUpdate,
  updateApplication,
};
