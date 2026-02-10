// controllers/ctoCreditController.js
const ctoCreditService = require("../services/ctoCredit.service");
const path = require("path");
const fs = require("fs/promises");

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

function safeDateStamp(dateApproved) {
  const d = dateApproved ? new Date(dateApproved) : new Date();
  if (Number.isNaN(d.getTime()))
    return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function sendError(res, err) {
  const status = err.statusCode || err.status || 500;
  return res.status(status).json({ message: err.message || "Server error" });
}

const addCtoCreditRequest = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);

    const { employees, duration, memoNo, dateApproved } = req.body;

    // robust parsing (supports form-data string OR JSON body array/object)
    const employeesArray = parseJsonMaybe(employees, employees);
    const durationObj = parseJsonMaybe(duration, duration);

    if (!memoNo) {
      return res.status(400).json({ message: "memoNo is required" });
    }

    let fileName = null;

    // Store only filename (avoid leaking absolute server paths)
    if (req.file?.path && req.file?.originalname) {
      const extension = path.extname(req.file.originalname).toLowerCase();

      // Optional: allow only pdf/images
      const allowed = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
      if (!allowed.has(extension)) {
        // cleanup uploaded file if type not allowed
        await fs.unlink(req.file.path).catch(() => {});
        return res
          .status(400)
          .json({ message: "Invalid file type. Upload PDF/JPG/PNG only." });
      }

      const cleanMemoNo = String(memoNo)
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "");

      const cleanDate = safeDateStamp(dateApproved);
      const newFileName = `${cleanMemoNo || "memo"}_${cleanDate}${extension}`;

      const newPath = path.join(path.dirname(req.file.path), newFileName);

      try {
        await fs.rename(req.file.path, newPath);
        fileName = newFileName;
      } catch (err) {
        // keep original filename if rename fails
        fileName = path.basename(req.file.path);
        console.warn(
          "File rename failed, keeping original filename:",
          err?.message,
        );
      }
    }

    const creditRequest = await ctoCreditService.addCredit({
      employees: employeesArray,
      duration: durationObj,
      memoNo,
      dateApproved,
      userId,
      filePath: fileName, // store filename only
    });

    return res.status(201).json({
      message: "CTO credit request created",
      creditRequest,
    });
  } catch (error) {
    console.error("Add CTO credit error:", error);
    return sendError(res, error);
  }
};

const rollbackCreditedRequest = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);
    const { creditId } = req.params;

    const credit = await ctoCreditService.rollbackCredit({ creditId, userId });

    return res.json({
      message: "CTO credit rolled back and employee balances updated",
      credit,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const getEmployeeDetails = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await ctoCreditService.getEmployeeDetails(employeeId);

    if (!employee)
      return res.status(404).json({ message: "Employee not found" });

    return res.json({ message: "Employee fetched", employee });
  } catch (error) {
    return sendError(res, error);
  }
};

const getAllCreditRequests = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;

    const credits = await ctoCreditService.getAllCredits({
      page,
      limit,
      search,
      filters: { status },
    });

    return res.json({
      message: "Showing credit requests",
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

const getEmployeeCredits = async (req, res) => {
  try {
    // allow /:employeeId OR fallback to current user
    const employeeId = req.params.employeeId || req?.user?.id;
    if (!employeeId) return res.status(401).json({ message: "Unauthorized" });

    const { search, status, page, limit } = req.query;

    const result = await ctoCreditService.getEmployeeCredits(employeeId, {
      search,
      filters: { status },
      page,
      limit,
    });

    return res.json({
      message: "Employee credits fetched successfully",
      employeeId,
      ...result,
    });
  } catch (error) {
    console.error("Controller error:", error.message);
    return sendError(res, error);
  }
};

module.exports = {
  addCtoCreditRequest,
  rollbackCreditedRequest,
  getAllCreditRequests,
  getEmployeeDetails,
  getEmployeeCredits,
};
