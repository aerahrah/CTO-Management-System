// controllers/adminWellnessApplicationController.js
const adminWellnessAppService = require("../services/adminWellnessApplication.service");

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
  // Mongoose validation errors (e.g. a required field the model enforces) → 400
  const isValidation =
    err?.name === "ValidationError" || err?.name === "CastError";
  const status = err.statusCode || err.status || (isValidation ? 400 : 500);
  if (status >= 500) console.error("[ADMIN WELLNESS APPLICATION]", err);
  const message =
    status >= 500 ? "Server error" : err.message || "Request failed";
  const body = { message, error: message };
  if (Array.isArray(err.details) && err.details.length)
    body.details = err.details;
  return res.status(status).json(body);
}

const JSON_FIELDS = [
  "inclusiveDates",
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
  "totalDays",
  "overallStatus",
  "editReason",
  "expectedUpdatedAt",
];

// Accepts JSON bodies and form-data (objects/arrays sent as JSON strings).
// Only these keys are read — anything else in the body is ignored.
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
    const result = await adminWellnessAppService.searchEmployees({
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
    const result = await adminWellnessAppService.getEmployeeBalanceCheck(
      req.params.employeeId,
    );
    return res.json({ message: "Employee wellness balance", ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /employees/:employeeId/recalculate-balance
const recalculateEmployeeBalance = async (req, res) => {
  try {
    getUserIdOrThrow(req);
    const result = await adminWellnessAppService.recalculateEmployeeBalance(
      req.params.employeeId,
    );

    res.locals.auditBefore = {
      employee: req.params.employeeId,
      wellnessDays: result.previousBalance,
    };
    res.locals.auditAfter = {
      employee: req.params.employeeId,
      wellnessDays: result.newBalance,
    };

    return res.json({
      message: result.changed
        ? `Wellness balance updated from ${result.previousBalance} to ${result.newBalance} days.`
        : "Wellness balance already matches the credits. Nothing changed.",
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /employees/:employeeId/credits
const getEmployeeCredits = async (req, res) => {
  try {
    const result = await adminWellnessAppService.listEmployeeCredits(
      req.params.employeeId,
    );
    return res.json({ message: "Employee wellness credit batches", ...result });
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
    const result = await adminWellnessAppService.listApplications({
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
    return res.json({ message: "Wellness applications", ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /:applicationId
const getApplication = async (req, res) => {
  try {
    const application = await adminWellnessAppService.getApplicationForEdit(
      req.params.applicationId,
    );
    return res.json({ message: "Wellness application", application });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /:applicationId/preview — same body as PUT, nothing is saved
const previewApplicationUpdate = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);
    const plan = await adminWellnessAppService.previewApplicationUpdate(
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
    const result = await adminWellnessAppService.updateApplication(
      req.params.applicationId,
      readEditPayload(req.body),
      userId,
    );

    // for the audit middleware
    res.locals.auditBefore = result.before;
    res.locals.auditAfter = result.application;

    return res.json({
      message: result.changed
        ? "Wellness application updated"
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
