// controllers/wellnessCreditController.js
const wellnessCreditService = require("../services/wellnessCredit.service");

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
  return res.status(status).json({ message: err.message || "Server error" });
}

const addWellnessCreditRequest = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);

    const { employees, days, dateApproved } = req.body;

    // robust parsing (supports form-data string OR JSON body)
    const employeesArray = parseJsonMaybe(employees, employees);

    // ✅ normalize req.body too (helps audit middleware if it reads req.body)
    req.body.employees = employeesArray;
    req.body.days = days;

    const creditRequest = await wellnessCreditService.addCredit({
      employees: employeesArray,
      days,
      dateApproved,
      userId,
    });

    // ✅ BEST: provide DB doc for audit summary (days + employees objects)
    res.locals.auditAfter = creditRequest;

    return res.status(201).json({
      message: "Wellness credit request created",
      creditRequest,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const rollbackWellnessCreditRequest = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);
    const { creditId } = req.params;

    const credit = await wellnessCreditService.rollbackCredit({
      creditId,
      userId,
    });

    // ✅ provide updated doc to audit builder (has employees + creditedDays)
    res.locals.auditAfter = credit;

    return res.json({
      message: "Wellness credit rolled back and employee balances updated",
      credit,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const getEmployeeDetails = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await wellnessCreditService.getEmployeeDetails(employeeId);

    if (!employee)
      return res.status(404).json({ message: "Employee not found" });

    return res.json({ message: "Employee fetched", employee });
  } catch (error) {
    return sendError(res, error);
  }
};

const getAllWellnessCreditRequests = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;

    const credits = await wellnessCreditService.getAllCredits({
      page,
      limit,
      search,
      filters: { status },
    });

    return res.json({
      message: "Showing wellness credit requests",
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      total: credits.totalCount,
      credits: credits.items,
      grandTotals: credits.grandTotals,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const getEmployeeWellnessCredits = async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req?.user?.id;
    if (!employeeId) return res.status(401).json({ message: "Unauthorized" });

    const { search, status, page, limit } = req.query;

    const result = await wellnessCreditService.getEmployeeCredits(employeeId, {
      search,
      filters: { status },
      page,
      limit,
    });

    return res.json({
      message: "Employee wellness credits fetched successfully",
      employeeId,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const triggerYearEndReset = async (req, res) => {
  try {
    const result = await wellnessCreditService.expirePreviousYearCredits();

    return res.status(200).json({
      message: `Successfully expired ${result.affectedBatches} credit batch(es) from previous years.`,
      affectedBatches: result.affectedBatches,
    });
  } catch (error) {
    console.error("Year-end reset failed:", error);
    return sendError(res, error);
  }
};

module.exports = {
  addWellnessCreditRequest,
  rollbackWellnessCreditRequest,
  getAllWellnessCreditRequests,
  getEmployeeDetails,
  getEmployeeWellnessCredits,
  triggerYearEndReset,
};
