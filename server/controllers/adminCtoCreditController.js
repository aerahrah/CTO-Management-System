// controllers/adminCtoCreditController.js
const path = require("path");
const fs = require("fs/promises");
const CtoCredit = require("../models/ctoCreditModel");
const adminCtoCreditService = require("../services/adminCtoCredit.service");
// Balance check / recalculation use the same CTO balance rule as the CTO application admin.
const adminCtoApplicationService = require("../services/adminCtoApplication.service");

const ALLOWED_MEMO_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]); // same as addCtoCreditRequest

function getUserIdOrThrow(req) {
  const userId = req?.user?.id || req?.user?._id;
  if (!userId) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return String(userId);
}

function sendError(res, err) {
  // Mongoose validation (e.g. the 40-hour duration rule) → 400 with every message
  if (err?.name === "ValidationError" && err.errors) {
    const details = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      message: details[0] || "Invalid data.",
      error: details[0],
      details,
    });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({
      message: `Invalid value for ${err.path}.`,
      error: "Invalid value",
    });
  }
  const status = err.statusCode || err.status || 500;
  if (status >= 500) console.error("[adminCtoCredit]", err);
  const message =
    status >= 500 ? "Server error" : err.message || "Request failed";
  return res.status(status).json({
    message,
    error: message,
    ...(Array.isArray(err.details) ? { details: err.details } : {}),
  });
}

function parseJsonMaybe(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value; // the service reports it as invalid
  }
}

// Only these keys are read from the request. uploadedMemo is never taken from the
// client — a new memo file can only come from an actual upload on save.
const PLAIN_FIELDS = [
  "memoNo",
  "purpose",
  "dateApproved",
  "dateCredited",
  "status",
  "reason",
  "expectedUpdatedAt",
  "newMemoFileName", // preview only: shows that a new file will be attached
];
const JSON_FIELDS = ["inclusiveDates", "duration", "employees", "options"];

/** Works for JSON bodies and multipart form-data (where objects arrive as JSON strings). */
function readEditPayload(req) {
  const body = req.body || {};
  const payload = {};
  for (const key of PLAIN_FIELDS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  for (const key of JSON_FIELDS) {
    if (body[key] !== undefined) payload[key] = parseJsonMaybe(body[key]);
  }
  return payload;
}

function cleanToken(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
}

function safeDateStamp(date) {
  const d = date ? new Date(date) : new Date();
  const ok = !Number.isNaN(d.getTime()) ? d : new Date();
  return ok.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Handles an uploaded replacement memo (same rules and folder as addCtoCreditRequest).
 * The name gets a time suffix so the old file is never overwritten — it stays on disk.
 * Returns { publicPath, absPath } or null when no file was sent.
 */
async function takeUploadedMemo(req, creditId, payload) {
  if (!req.file?.path || !req.file?.originalname) return null;

  const extension = path.extname(req.file.originalname).toLowerCase();
  if (!ALLOWED_MEMO_EXTENSIONS.has(extension)) {
    await fs.unlink(req.file.path).catch(() => {});
    const err = new Error("Invalid file type. Upload PDF/JPG/PNG only.");
    err.statusCode = 400;
    throw err;
  }

  const current = await CtoCredit.findById(creditId)
    .select("memoNo dateApproved")
    .lean()
    .catch(() => null);
  const memoNo = cleanToken(payload.memoNo || current?.memoNo) || "memo";
  const stamp = safeDateStamp(payload.dateApproved || current?.dateApproved);
  const fileName = `${memoNo}_${stamp}_${Date.now()}${extension}`;
  const absPath = path.join(path.dirname(req.file.path), fileName);

  let finalName = fileName;
  let finalAbs = absPath;
  try {
    await fs.rename(req.file.path, absPath);
  } catch {
    finalName = path.basename(req.file.path);
    finalAbs = req.file.path;
  }
  return { publicPath: `/uploads/cto_memos/${finalName}`, absPath: finalAbs };
}

/* ---------- employees ---------- */

const searchEmployees = async (req, res) => {
  try {
    const { q, limit, employeeType, refDate } = req.query;
    const result = await adminCtoCreditService.searchEmployees({
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

const getEmployeeBalance = async (req, res) => {
  try {
    const result = await adminCtoApplicationService.getEmployeeBalanceCheck(
      req.params.employeeId,
    );
    return res.json({ message: "Employee CTO balance", ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

const recalculateEmployeeBalance = async (req, res) => {
  try {
    getUserIdOrThrow(req);
    const result = await adminCtoApplicationService.recalculateEmployeeBalance(
      req.params.employeeId,
    );
    res.locals.auditAfter = {
      employeeId: req.params.employeeId,
      previousBalance: result.previousBalance,
      newBalance: result.newBalance,
    };
    return res.json({
      message: result.changed
        ? `CTO balance updated from ${result.previousBalance} to ${result.newBalance} hours.`
        : "CTO balance already matches the memos.",
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/* ---------- memos ---------- */

const listCredits = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      employeeId,
      from,
      to,
      overtimeFrom,
      overtimeTo,
      sort,
    } = req.query;
    const result = await adminCtoCreditService.listCredits({
      page,
      limit,
      search,
      status,
      employeeId,
      from,
      to,
      overtimeFrom,
      overtimeTo,
      sort,
    });
    return res.json({ message: "CTO credit memos", ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

const getCredit = async (req, res) => {
  try {
    const credit = await adminCtoCreditService.getCreditForEdit(
      req.params.creditId,
    );
    return res.json({ message: "CTO credit memo", credit });
  } catch (error) {
    return sendError(res, error);
  }
};

const previewCreditUpdate = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);
    const plan = await adminCtoCreditService.previewCreditUpdate(
      req.params.creditId,
      readEditPayload(req),
      userId,
    );
    return res.json({ message: "Preview of changes", plan });
  } catch (error) {
    return sendError(res, error);
  }
};

const updateCredit = async (req, res) => {
  let uploaded = null;
  try {
    const userId = getUserIdOrThrow(req);
    const payload = readEditPayload(req);
    delete payload.newMemoFileName;
    uploaded = await takeUploadedMemo(req, req.params.creditId, payload);

    const result = await adminCtoCreditService.updateCredit(
      req.params.creditId,
      payload,
      userId,
      {
        newMemoFile: uploaded?.publicPath || null,
      },
    );

    // Nothing was saved → don't keep the uploaded file around.
    if (uploaded && !result.changed)
      await fs.unlink(uploaded.absPath).catch(() => {});

    res.locals.auditBefore = result.before;
    res.locals.auditAfter = result.credit;
    return res.json({
      message: result.changed
        ? "CTO credit memo updated"
        : "No changes to save",
      changed: result.changed,
      credit: result.credit,
      plan: result.plan,
    });
  } catch (error) {
    if (uploaded) await fs.unlink(uploaded.absPath).catch(() => {});
    else if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
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
