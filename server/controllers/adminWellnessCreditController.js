// controllers/adminWellnessCreditController.js
const adminWellnessCreditService = require("../services/adminWellnessCredit.service");

function getUserIdOrThrow(req) {
  const userId = req?.user?.id;
  if (!userId) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return userId;
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

function sendError(res, err) {
  const status = err.statusCode || err.status || 500;
  if (status >= 500) console.error("[ADMIN WELLNESS CREDIT]", err);

  const body = {
    message: status >= 500 ? "Server error" : err.message || "Request failed",
  };
  if (Array.isArray(err.details) && err.details.length)
    body.details = err.details;
  return res.status(status).json(body);
}

// Accepts JSON bodies and form-data (employees/options sent as JSON strings).
function readEditPayload(body = {}) {
  return {
    dateApproved: body.dateApproved,
    days: body.days,
    status: body.status,
    employees:
      body.employees === undefined
        ? undefined
        : parseJsonMaybe(body.employees, body.employees),
    options: parseJsonMaybe(body.options, {}),
    reason: body.reason,
    expectedUpdatedAt: body.expectedUpdatedAt,
  };
}

// GET /employees/search?q=&limit=&employeeType=&refDate=
const searchEmployees = async (req, res) => {
  try {
    const { q, limit, employeeType, refDate } = req.query;
    const result = await adminWellnessCreditService.searchEmployees({
      q,
      limit,
      employeeType,
      refDate,
    });
    return res.json({ message: "Employees found", ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /employees/:employeeId/balance
const getEmployeeBalance = async (req, res) => {
  try {
    const result = await adminWellnessCreditService.getEmployeeBalanceCheck(
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
    const result = await adminWellnessCreditService.recalculateEmployeeBalance(
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
        ? `Balance updated from ${result.previousBalance} to ${result.newBalance}.`
        : "Balance already matches the credits. Nothing changed.",
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /?page=&limit=&search=&status=&employeeId=&from=&to=&sort=
const listCredits = async (req, res) => {
  try {
    const { page, limit, search, status, employeeId, from, to, sort } =
      req.query;
    const result = await adminWellnessCreditService.listCredits({
      page,
      limit,
      search,
      status,
      employeeId,
      from,
      to,
      sort,
    });
    return res.json({ message: "Wellness credit batches", ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /:creditId
const getCredit = async (req, res) => {
  try {
    const credit = await adminWellnessCreditService.getCreditForEdit(
      req.params.creditId,
    );
    return res.json({ message: "Wellness credit batch", credit });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /:creditId/preview — same body as PUT, nothing is saved
const previewCreditUpdate = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);
    const plan = await adminWellnessCreditService.previewCreditUpdate(
      req.params.creditId,
      readEditPayload(req.body),
      userId,
    );
    return res.json({ message: "Preview of changes", plan });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUT /:creditId
const updateCredit = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);
    const result = await adminWellnessCreditService.updateCredit(
      req.params.creditId,
      readEditPayload(req.body),
      userId,
    );

    // for the audit middleware
    res.locals.auditBefore = result.before;
    res.locals.auditAfter = result.credit;

    return res.json({
      message: result.changed
        ? "Wellness credit updated"
        : "No changes to save",
      changed: result.changed,
      credit: result.credit,
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
  listCredits,
  getCredit,
  previewCreditUpdate,
  updateCredit,
};
