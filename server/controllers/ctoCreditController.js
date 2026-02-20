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
  const ok = !Number.isNaN(d.getTime()) ? d : new Date();
  return ok.toISOString().slice(0, 10).replace(/-/g, "");
}

function cleanToken(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
}

function sendError(res, err) {
  const status = err.statusCode || err.status || 500;
  return res.status(status).json({ message: err.message || "Server error" });
}

const addCtoCreditRequest = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);

    const { employees, duration, memoNo, dateApproved } = req.body;

    // robust parsing (supports form-data string OR JSON body)
    const employeesArray = parseJsonMaybe(employees, employees);
    const durationObj = parseJsonMaybe(duration, duration);

    if (!memoNo) {
      return res.status(400).json({ message: "memoNo is required" });
    }

    let fileName = null; // just "xxx.pdf"
    let filePath = null; // "/uploads/cto_memos/xxx.pdf" (what we store)

    // If a file was uploaded via multer
    if (req.file?.path && req.file?.originalname) {
      const extension = path.extname(req.file.originalname).toLowerCase();

      // Allow only pdf/images
      const allowed = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
      if (!allowed.has(extension)) {
        await fs.unlink(req.file.path).catch(() => {});
        return res
          .status(400)
          .json({ message: "Invalid file type. Upload PDF/JPG/PNG only." });
      }

      const cleanMemoNo = cleanToken(memoNo) || "memo";
      const cleanDate = safeDateStamp(dateApproved);
      const newFileName = `${cleanMemoNo}_${cleanDate}${extension}`;

      // Rename inside whatever folder multer saved to (usually uploads/cto_memos)
      const uploadDir = path.dirname(req.file.path);
      const newAbsPath = path.join(uploadDir, newFileName);

      try {
        await fs.rename(req.file.path, newAbsPath);
        fileName = newFileName;
      } catch {
        // fallback: keep the multer-generated name, but still store filename only
        fileName = path.basename(req.file.path);
      }

      // ✅ store the public URL path (matches your express.static mount)
      filePath = `/uploads/cto_memos/${fileName}`;
    }

    const creditRequest = await ctoCreditService.addCredit({
      employees: employeesArray,
      duration: durationObj,
      memoNo,
      dateApproved,
      userId,
      filePath, // ✅ "/uploads/cto_memos/<filename>" OR null
    });

    return res.status(201).json({
      message: "CTO credit request created",
      creditRequest,
    });
  } catch (error) {
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
