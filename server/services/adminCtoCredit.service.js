// services/adminCtoCredit.service.js
//
// Admin tools for CTO credit memos (CtoCredit):
//   • search employees with their CTO balance and CSC room (monthly + max balance)
//   • list and filter credit memos
//   • load one memo for editing (rows, CSC room, which applications use it)
//   • preview an edit (dry run: validation, CSC checks, balance impact)
//   • save an edit in one transaction — memo details, memo file, every employee
//     row, adding / removing / reassigning employees, rollback / un-rollback
//
// BALANCE RULE (same as adminCtoApplication.service.js)
// Employee.balances.ctoHours = Σ (remainingHours + reservedHours) over the employee's
// rows that are not ROLLEDBACK, in memos that are not ROLLEDBACK.
//   addCredit        → +credited   (remaining = credited)
//   apply (PENDING)  → hours move remaining → reserved, balance unchanged
//   approve          → hours move reserved → used, balance − hours
//   rollbackCredit   → −credited   (only allowed when nothing is used/reserved)
// Every balance calculation below goes through balanceContributionOf().
//
// CSC LIMITS (same as ctoCredit.service.js addCredit)
//   • a memo is at most 40 hours
//   • MAX_COC_ACCRUAL_PER_MONTH (default 40) credited hours per employee per month,
//     counted by the month of inclusiveDates.startDate
//   • MAX_COC_BALANCE (default 120) hours of CTO balance
// Admin edits that break these are refused unless options.overrideLimit is on.

const mongoose = require("mongoose");
const CtoCredit = require("../models/ctoCreditModel");
const CtoApplication = require("../models/ctoApplicationModel");
const Employee = require("../models/employeeModel");
const { CREDIT_BUCKET_BY_STATUS } = require("./adminCtoApplication.service");

/* =========================================================================
   CONSTANTS
========================================================================= */

const CREDIT_STATUS = Object.freeze({
  CREDITED: "CREDITED",
  ROLLEDBACK: "ROLLEDBACK",
});

const ROW_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  EXHAUSTED: "EXHAUSTED",
  ROLLEDBACK: "ROLLEDBACK",
});

const MEMO_MAX_HOURS = 40; // ctoCreditModel: duration.hours max 40 (minutes 0 when 40)

function getLimits() {
  return {
    maxMemoHours: MEMO_MAX_HOURS,
    maxMonthly: Number(process.env.MAX_COC_ACCRUAL_PER_MONTH || 40),
    maxBalance: Number(process.env.MAX_COC_BALANCE || 120),
  };
}

const EMPLOYEE_SEARCH_CANDIDATES = Object.freeze([
  "firstName",
  "middleName",
  "lastName",
  "email",
  "position",
  "division",
  "employeeNo",
  "employeeNumber",
  "employeeId",
  "idNumber",
]);

const HEADER_LABELS = Object.freeze({
  memoNo: "Memo no.",
  purpose: "Purpose",
  dateApproved: "Date approved",
  dateCredited: "Date credited",
  status: "Status",
  startDate: "Overtime start",
  endDate: "Overtime end",
  durationHours: "Duration (hours)",
  durationMinutes: "Duration (minutes)",
  uploadedMemo: "Memo file",
});
const HEADER_DATE_FIELDS = new Set([
  "dateApproved",
  "dateCredited",
  "startDate",
  "endDate",
]);

const ROW_DIFF_FIELDS = Object.freeze([
  "employee",
  "creditedHours",
  "usedHours",
  "reservedHours",
  "remainingHours",
  "forfeitedHours",
  "status",
  "dateCredited",
]);

const HOUR_FIELD_LABELS = Object.freeze({
  creditedHours: "Credited hours",
  usedHours: "Used hours",
  reservedHours: "Reserved hours",
  forfeitedHours: "Forfeited hours",
});

const SORTABLE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "dateApproved",
  "memoNo",
  "inclusiveDates.startDate",
]);

const HAS_EDIT_HISTORY = Boolean(CtoCredit.schema.path("adminEditHistory"));

/* =========================================================================
   GENERIC HELPERS
========================================================================= */

function createServiceError(message, statusCode = 400, details) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
}

function isObjectIdString(value) {
  return /^[a-f0-9]{24}$/i.test(String(value ?? ""));
}

function assertObjectId(value, label = "ID") {
  if (!isObjectIdString(value))
    throw createServiceError(`Invalid ${label} format.`, 400);
}

function toObjectId(value) {
  return new mongoose.Types.ObjectId(String(value));
}

function idOf(value) {
  return String(value?._id ?? value ?? "");
}

function sanitizeString(value, maxLength = 200) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\0/g, "").trim().slice(0, maxLength);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Finite number rounded to 2 decimals, or null. */
function parseNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return null;
  const n = Number(value);
  return Number.isFinite(n) ? round2(n) : null;
}

/** Date, exact timestamp, or "YYYY-MM-DD" (read as local midnight, like addCredit). */
function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  const str = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function sameTime(a, b) {
  const ta = a ? new Date(a).getTime() : null;
  const tb = b ? new Date(b).getTime() : null;
  return ta === tb;
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
}

function fullName(emp) {
  return [emp?.firstName, emp?.lastName].filter(Boolean).join(" ").trim();
}

function parsePagination(page, limit, defaultLimit = 20, maxLimit = 100) {
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(
    Math.max(parseInt(limit, 10) || defaultLimit, 1),
    maxLimit,
  );
  return { page: p, limit: l, skip: (p - 1) * l };
}

function parseSort(sort) {
  const raw = sanitizeString(sort, 40) || "-createdAt";
  const desc = raw.startsWith("-");
  const field = desc ? raw.slice(1) : raw;
  if (!SORTABLE_FIELDS.has(field)) return { createdAt: -1, _id: -1 };
  return { [field]: desc ? -1 : 1, _id: desc ? -1 : 1 };
}

function normalizeOptions(options) {
  const o = options && typeof options === "object" ? options : {};
  return {
    adjustBalances: toBool(o.adjustBalances, true),
    overrideLimit: toBool(o.overrideLimit, false),
    force: toBool(o.force, false),
  };
}

function memoHoursOf(duration) {
  return round2(
    Number(duration?.hours || 0) + Number(duration?.minutes || 0) / 60,
  );
}

/* =========================================================================
   BALANCE RULE + CSC MONTH HELPERS
========================================================================= */

/** How many hours of a row count toward Employee.balances.ctoHours. */
function balanceContributionOf(row, memoStatus) {
  if (memoStatus === CREDIT_STATUS.ROLLEDBACK) return 0;
  if (!row || row.status === ROW_STATUS.ROLLEDBACK) return 0;
  return round2((row.remainingHours || 0) + (row.reservedHours || 0));
}

/** Same month window as calculateEarnedCTOHoursForMonth (server local time). */
function getMonthBounds(refDate) {
  const ref = parseDate(refDate) || new Date();
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(
    ref.getFullYear(),
    ref.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  const label = start.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
  return {
    start,
    end,
    label,
    key: `${start.getFullYear()}-${start.getMonth() + 1}`,
  };
}

/**
 * Hours credited per employee in memos whose overtime starts in refDate's month.
 * Counts what addCredit counts: memo not ROLLEDBACK, row not ROLLEDBACK.
 */
async function getMonthTotals(
  employeeIds,
  refDate,
  { excludeCreditId, session } = {},
) {
  const ids = [...new Set((employeeIds || []).map(String))]
    .filter(isObjectIdString)
    .map(toObjectId);
  if (!ids.length) return new Map();

  const { start, end } = getMonthBounds(refDate);
  const match = {
    "inclusiveDates.startDate": { $gte: start, $lte: end },
    status: { $ne: CREDIT_STATUS.ROLLEDBACK },
    "employees.employee": { $in: ids },
  };
  if (excludeCreditId) match._id = { $ne: toObjectId(excludeCreditId) };

  const pipeline = CtoCredit.aggregate([
    { $match: match },
    { $unwind: "$employees" },
    {
      $match: {
        "employees.employee": { $in: ids },
        "employees.status": { $ne: ROW_STATUS.ROLLEDBACK },
      },
    },
    {
      $group: {
        _id: "$employees.employee",
        hours: { $sum: { $ifNull: ["$employees.creditedHours", 0] } },
      },
    },
  ]);
  if (session) pipeline.session(session);
  const rows = await pipeline;
  return new Map(rows.map((r) => [String(r._id), round2(r.hours)]));
}

/** CSC room for one employee: monthly accrual + max balance (like getRemainingCreditableHours). */
function describeRoom(
  employee,
  monthLabel,
  creditedThisMonth,
  limits = getLimits(),
) {
  const balance = round2(employee?.balances?.ctoHours || 0);
  const credited = round2(creditedThisMonth || 0);
  const roomMonthly = round2(Math.max(0, limits.maxMonthly - credited));
  const roomBalance = round2(Math.max(0, limits.maxBalance - balance));
  return {
    month: monthLabel,
    creditedThisMonth: credited,
    maxMonthly: limits.maxMonthly,
    roomMonthly,
    balance,
    maxBalance: limits.maxBalance,
    roomBalance,
    creditableNow: Math.min(roomMonthly, roomBalance),
  };
}

/**
 * Which CTO applications use this memo, per employee:
 * reserved = hours of PENDING applications, used = APPROVED / REVOCATION_REQUESTED
 * (same buckets as adminCtoApplication.service.js), other = rejected/cancelled/revoked.
 */
async function getApplicationUsage(creditId, session) {
  const id = toObjectId(creditId);
  const pipeline = CtoApplication.aggregate([
    { $match: { "memo.memoId": id } },
    { $unwind: "$memo" },
    { $match: { "memo.memoId": id } },
    {
      $group: {
        _id: { employee: "$employee", status: "$overallStatus" },
        hours: { $sum: { $ifNull: ["$memo.appliedHours", 0] } },
        count: { $sum: 1 },
      },
    },
  ]);
  if (session) pipeline.session(session);
  const groups = await pipeline;

  const usage = new Map();
  for (const g of groups) {
    const emp = String(g._id.employee);
    const u = usage.get(emp) || {
      reserved: 0,
      used: 0,
      activeCount: 0,
      otherCount: 0,
    };
    const bucket = CREDIT_BUCKET_BY_STATUS[g._id.status] ?? null;
    if (bucket === "reserved") u.reserved = round2(u.reserved + g.hours);
    if (bucket === "used") u.used = round2(u.used + g.hours);
    if (bucket) u.activeCount += g.count;
    else u.otherCount += g.count;
    usage.set(emp, u);
  }
  return usage;
}

const EMPTY_USAGE = Object.freeze({
  reserved: 0,
  used: 0,
  activeCount: 0,
  otherCount: 0,
});

/* =========================================================================
   EMPLOYEE SEARCH HELPERS
========================================================================= */

let searchableFieldsCache = null;

function getSearchableEmployeeFields() {
  if (!searchableFieldsCache) {
    const fields = EMPLOYEE_SEARCH_CANDIDATES.filter(
      (f) => Employee.schema.path(f)?.instance === "String",
    );
    searchableFieldsCache = fields.length ? fields : ["firstName", "lastName"];
  }
  return searchableFieldsCache;
}

/** "juan dela" → every word must match a searchable field; a 24-char id also matches _id. */
function buildEmployeeSearchFilter(text) {
  const q = sanitizeString(text, 100);
  if (!q) return {};
  const fields = getSearchableEmployeeFields();
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 5);
  const byWords = {
    $and: tokens.map((token) => ({
      $or: fields.map((f) => ({
        [f]: { $regex: escapeRegex(token), $options: "i" },
      })),
    })),
  };
  if (isObjectIdString(q)) return { $or: [{ _id: toObjectId(q) }, byWords] };
  return byWords;
}

function summarizeRows(rows = [], memoStatus) {
  const live =
    memoStatus === CREDIT_STATUS.ROLLEDBACK
      ? []
      : rows.filter((r) => r.status !== ROW_STATUS.ROLLEDBACK);
  const sum = (list, field) =>
    round2(list.reduce((acc, r) => acc + (Number(r[field]) || 0), 0));
  return {
    employeeCount: rows.length,
    activeEmployeeCount: live.length,
    creditedHours: sum(live, "creditedHours"),
    usedHours: sum(rows, "usedHours"),
    reservedHours: sum(live, "reservedHours"),
    remainingHours: sum(live, "remainingHours"),
    forfeitedHours: sum(rows, "forfeitedHours"),
  };
}

/* =========================================================================
   EDIT PLANNER (pure — no database access)
========================================================================= */

function snapshotHeader(credit) {
  return {
    memoNo: credit.memoNo || "",
    purpose: credit.purpose || "",
    dateApproved: credit.dateApproved ? new Date(credit.dateApproved) : null,
    dateCredited: credit.dateCredited ? new Date(credit.dateCredited) : null,
    status: credit.status || CREDIT_STATUS.CREDITED,
    startDate: credit.inclusiveDates?.startDate
      ? new Date(credit.inclusiveDates.startDate)
      : null,
    endDate: credit.inclusiveDates?.endDate
      ? new Date(credit.inclusiveDates.endDate)
      : null,
    durationHours: round2(credit.duration?.hours || 0),
    durationMinutes: round2(credit.duration?.minutes || 0),
    uploadedMemo: credit.uploadedMemo || "",
  };
}

function snapshotRow(row) {
  return {
    _id: row._id ? String(row._id) : undefined,
    employee: idOf(row.employee),
    creditedHours: round2(row.creditedHours || 0),
    usedHours: round2(row.usedHours || 0),
    reservedHours: round2(row.reservedHours || 0),
    remainingHours: round2(row.remainingHours || 0),
    forfeitedHours: round2(row.forfeitedHours || 0),
    status: row.status || ROW_STATUS.ACTIVE,
    dateCredited: row.dateCredited ? new Date(row.dateCredited) : null,
  };
}

/**
 * Final status + remaining hours of a row. remainingHours is always derived, never typed:
 *   • memo ROLLEDBACK or row ROLLEDBACK → ROLLEDBACK, remaining 0
 *   • otherwise remaining = credited − used − reserved
 *   • EXHAUSTED is kept only when nothing is left; with hours left the row becomes ACTIVE
 *     (your application service never sets EXHAUSTED, so ACTIVE stays the default)
 */
function resolveRowState({
  memoStatus,
  requestedStatus,
  creditedHours,
  usedHours,
  reservedHours,
}) {
  if (
    memoStatus === CREDIT_STATUS.ROLLEDBACK ||
    requestedStatus === ROW_STATUS.ROLLEDBACK
  ) {
    return {
      status: ROW_STATUS.ROLLEDBACK,
      remainingHours: 0,
      corrected: false,
    };
  }
  const unclaimed = round2(creditedHours - usedHours - reservedHours);
  const remainingHours = Math.max(unclaimed, 0);
  if (requestedStatus === ROW_STATUS.EXHAUSTED) {
    return remainingHours > 0
      ? { status: ROW_STATUS.ACTIVE, remainingHours, corrected: true }
      : { status: ROW_STATUS.EXHAUSTED, remainingHours: 0, corrected: false };
  }
  return { status: ROW_STATUS.ACTIVE, remainingHours, corrected: false };
}

function diffRow(before, after) {
  if (!before) return [];
  const changes = [];
  for (const field of ROW_DIFF_FIELDS) {
    const from = before[field];
    const to = after[field];
    const same =
      field === "dateCredited"
        ? sameTime(from, to)
        : String(from) === String(to);
    if (!same) changes.push({ field, from, to });
  }
  return changes;
}

/**
 * Works out everything an edit would do, without touching the database.
 *
 * payload = {
 *   memoNo?, purpose?, dateApproved?, dateCredited?, status?,
 *   inclusiveDates?: { startDate?, endDate? },
 *   duration?: { hours?, minutes? },
 *   employees?: [{ _id?, employee, creditedHours?, usedHours?, reservedHours?,
 *                  forfeitedHours?, status?, dateCredited? }],
 *   options?: { adjustBalances = true, overrideLimit = false, force = false }
 * }
 * When `employees` is sent it is the complete list: rows left out are removed,
 * rows without `_id` are added. Omitted fields keep their current values.
 *
 * ctx = { employeesById, monthTotals (other memos, same month), appUsage, limits }
 * newMemoFile = path of a newly uploaded memo file (set by the controller, never by the client)
 */
function buildEditPlan({
  credit,
  payload = {},
  ctx,
  userId,
  newMemoFile = null,
  now = new Date(),
}) {
  const errors = [];
  const warnings = [];
  const options = normalizeOptions(payload.options);
  const limits = ctx.limits || getLimits();
  const employeesById = ctx.employeesById || new Map();
  const monthTotals = ctx.monthTotals || new Map();
  const appUsage = ctx.appUsage || new Map();
  const nameOf = (id) =>
    fullName(employeesById.get(String(id))) ||
    `Employee ${String(id).slice(-6)}`;
  const usageOf = (id) => appUsage.get(String(id)) || EMPTY_USAGE;

  /* ---------- memo (header) fields ---------- */
  const before = snapshotHeader(credit);
  const after = { ...before };

  if (payload.memoNo !== undefined) {
    const v = sanitizeString(payload.memoNo, 100);
    if (!v) errors.push("Memo no. is required.");
    else after.memoNo = v;
  }
  if (payload.purpose !== undefined) {
    const v = sanitizeString(payload.purpose, 1000);
    if (!v) errors.push("Purpose is required.");
    else after.purpose = v;
  }
  for (const field of ["dateApproved", "dateCredited"]) {
    if (payload[field] === undefined) continue;
    const d = parseDate(payload[field]);
    if (!d) errors.push(`${HEADER_LABELS[field]} is not a valid date.`);
    else after[field] = d;
  }
  if (payload.status !== undefined) {
    const s = sanitizeString(payload.status, 20).toUpperCase();
    if (!Object.values(CREDIT_STATUS).includes(s)) {
      errors.push(
        `Status must be one of: ${Object.values(CREDIT_STATUS).join(", ")}.`,
      );
    } else {
      after.status = s;
    }
  }
  if (payload.inclusiveDates !== undefined) {
    const inc =
      payload.inclusiveDates && typeof payload.inclusiveDates === "object"
        ? payload.inclusiveDates
        : {};
    for (const [key, field] of [
      ["startDate", "startDate"],
      ["endDate", "endDate"],
    ]) {
      if (inc[key] === undefined) continue;
      const d = parseDate(inc[key]);
      if (!d) errors.push(`${HEADER_LABELS[field]} is not a valid date.`);
      else after[field] = d;
    }
  }
  if (!after.startDate || !after.endDate) {
    errors.push("Overtime start and end dates are required.");
  } else if (after.endDate.getTime() < after.startDate.getTime()) {
    errors.push("Overtime end date cannot be before the start date.");
  }

  if (payload.duration !== undefined) {
    const dur =
      payload.duration && typeof payload.duration === "object"
        ? payload.duration
        : {};
    if (dur.hours !== undefined) {
      const n = parseNumber(dur.hours);
      if (n === null || n < 0)
        errors.push("Duration hours must be a number of 0 or more.");
      else after.durationHours = n;
    }
    if (dur.minutes !== undefined) {
      const n = parseNumber(dur.minutes);
      if (n === null || n < 0 || n > 59)
        errors.push("Duration minutes must be between 0 and 59.");
      else after.durationMinutes = n;
    }
  }
  if (after.durationHours > MEMO_MAX_HOURS) {
    errors.push(`A memo cannot be more than ${MEMO_MAX_HOURS} hours.`);
  } else if (
    after.durationHours === MEMO_MAX_HOURS &&
    after.durationMinutes > 0
  ) {
    errors.push(
      `Total duration cannot exceed exactly ${MEMO_MAX_HOURS} hours (if hours is ${MEMO_MAX_HOURS}, minutes must be 0).`,
    );
  }
  const memoHoursBefore = memoHoursOf({
    hours: before.durationHours,
    minutes: before.durationMinutes,
  });
  const memoHours = memoHoursOf({
    hours: after.durationHours,
    minutes: after.durationMinutes,
  });
  if (memoHours <= 0) errors.push("The memo's duration must be more than 0.");

  if (newMemoFile) after.uploadedMemo = String(newMemoFile);

  const headerChanges = [];
  for (const field of Object.keys(HEADER_LABELS)) {
    const same = HEADER_DATE_FIELDS.has(field)
      ? sameTime(before[field], after[field])
      : String(before[field]) === String(after[field]);
    if (!same)
      headerChanges.push({
        field,
        label: HEADER_LABELS[field],
        from: before[field],
        to: after[field],
      });
  }
  const changed = (field) => headerChanges.some((c) => c.field === field);
  const monthBefore = before.startDate
    ? getMonthBounds(before.startDate)
    : null;
  const monthAfter = after.startDate ? getMonthBounds(after.startDate) : null;
  const monthChanged =
    Boolean(monthAfter) && monthBefore?.key !== monthAfter.key;
  const memoHoursChanged = memoHours !== memoHoursBefore;

  /* ---------- employee rows ---------- */
  const oldRows = (credit.employees || []).map(snapshotRow);
  const oldById = new Map(oldRows.map((r) => [r._id, r]));
  const rowsProvided = payload.employees !== undefined;

  let inputRows = oldRows;
  if (rowsProvided) {
    if (Array.isArray(payload.employees)) inputRows = payload.employees;
    else {
      errors.push("Employees must be a list.");
      inputRows = [];
    }
  }
  if (!inputRows.length)
    errors.push("A credit memo must have at least one employee.");

  const seenRowIds = new Set();
  const seenEmployees = new Set();
  const nextRows = [];
  const rowPlans = [];

  inputRows.forEach((input, index) => {
    const label = `Row ${index + 1}`;
    if (!input || typeof input !== "object") {
      errors.push(`${label}: invalid row.`);
      return;
    }

    const rowId = input._id ? String(input._id) : null;
    const old = rowId ? oldById.get(rowId) : null;
    if (rowId && !old) {
      errors.push(`${label}: this row does not belong to this memo.`);
      return;
    }
    if (rowId) {
      if (seenRowIds.has(rowId)) {
        errors.push(`${label}: the same row is listed twice.`);
        return;
      }
      seenRowIds.add(rowId);
    }

    const employeeId = idOf(input.employee ?? old?.employee);
    if (!isObjectIdString(employeeId)) {
      errors.push(`${label}: a valid employee is required.`);
      return;
    }
    const emp = employeesById.get(employeeId);
    if (!emp) {
      errors.push(`${label}: employee ${employeeId} was not found.`);
      return;
    }
    const name = fullName(emp) || label;
    if (seenEmployees.has(employeeId)) {
      errors.push(`${name} is listed more than once in this memo.`);
      return;
    }
    seenEmployees.add(employeeId);

    const employeeChanged = Boolean(old) && old.employee !== employeeId;
    if (employeeChanged) {
      const oldUsage = usageOf(old.employee);
      if (
        old.usedHours > 0 ||
        old.reservedHours > 0 ||
        oldUsage.activeCount > 0
      ) {
        errors.push(
          `${label}: cannot move this credit from ${nameOf(old.employee)} to ${name} because ` +
            `${nameOf(old.employee)} already used or reserved hours from it.`,
        );
        return;
      }
    }

    let invalidNumber = false;
    const readHours = (field, fallback) => {
      if (input[field] === undefined) return fallback;
      const n = parseNumber(input[field]);
      if (n === null || n < 0) {
        errors.push(
          `${name}: ${HOUR_FIELD_LABELS[field]} must be a number of 0 or more.`,
        );
        invalidNumber = true;
        return 0;
      }
      return n;
    };
    const creditedHours = readHours(
      "creditedHours",
      old ? old.creditedHours : memoHours,
    );
    const usedHours = readHours("usedHours", old ? old.usedHours : 0);
    const reservedHours = readHours(
      "reservedHours",
      old ? old.reservedHours : 0,
    );
    const forfeitedHours = readHours(
      "forfeitedHours",
      old ? old.forfeitedHours : round2(Math.max(memoHours - creditedHours, 0)),
    );
    if (invalidNumber) return;

    if (round2(usedHours + reservedHours) > creditedHours) {
      errors.push(
        `${name}: used (${usedHours}) + reserved (${reservedHours}) cannot be more than credited (${creditedHours}).`,
      );
      return;
    }

    const requestedStatus =
      input.status !== undefined && input.status !== null && input.status !== ""
        ? sanitizeString(input.status, 20).toUpperCase()
        : old?.status || ROW_STATUS.ACTIVE;
    if (!Object.values(ROW_STATUS).includes(requestedStatus)) {
      errors.push(
        `${name}: status must be one of ${Object.values(ROW_STATUS).join(", ")}.`,
      );
      return;
    }

    let dateCredited = old?.dateCredited || after.dateApproved || now;
    if (
      input.dateCredited !== undefined &&
      input.dateCredited !== null &&
      input.dateCredited !== ""
    ) {
      const d = parseDate(input.dateCredited);
      if (!d) {
        errors.push(`${name}: date credited is not a valid date.`);
        return;
      }
      dateCredited = d;
    }

    const state = resolveRowState({
      memoStatus: after.status,
      requestedStatus,
      creditedHours,
      usedHours,
      reservedHours,
    });
    if (state.corrected) {
      warnings.push(
        `${name}: status will be ACTIVE (not EXHAUSTED) because ${state.remainingHours} hour(s) are still unused.`,
      );
    }

    // Rolling back hours that applications hold.
    if (state.status === ROW_STATUS.ROLLEDBACK) {
      // already not counting before this edit → no need to force again
      const alreadyRolledBack =
        Boolean(old) &&
        !employeeChanged &&
        (old.status === ROW_STATUS.ROLLEDBACK ||
          before.status === CREDIT_STATUS.ROLLEDBACK);
      if (reservedHours > 0) {
        errors.push(
          `${name}: ${reservedHours} hour(s) are reserved by pending CTO applications. ` +
            "Resolve those applications (or set reserved hours to 0) before rolling back.",
        );
      }
      if (usedHours > 0 && !alreadyRolledBack && !options.force) {
        errors.push(
          `${name}: ${usedHours} hour(s) were already used. Turn on "Force" to roll back anyway.`,
        );
      }
    }

    // Typed used/reserved vs. the CTO applications that use this memo.
    const usage = usageOf(employeeId);
    const hoursTouched =
      !old ||
      employeeChanged ||
      usedHours !== old.usedHours ||
      reservedHours !== old.reservedHours;
    if (hoursTouched && state.status !== ROW_STATUS.ROLLEDBACK) {
      if (reservedHours !== usage.reserved) {
        warnings.push(
          `${name}: reserved hours (${reservedHours}) differ from pending CTO applications on this memo (${usage.reserved}).`,
        );
      }
      if (usedHours < usage.used) {
        warnings.push(
          `${name}: used hours (${usedHours}) are less than approved CTO applications on this memo (${usage.used}).`,
        );
      }
    }

    // CSC: no more than the memo's hours.
    const creditedChanged =
      !old || employeeChanged || creditedHours !== old.creditedHours;
    if (
      (creditedChanged || memoHoursChanged) &&
      creditedHours > memoHours &&
      memoHours > 0
    ) {
      const msg = `${name}: credited hours (${creditedHours}) are more than the memo's duration (${memoHours}).`;
      if (options.overrideLimit) warnings.push(`${msg} Limit overridden.`);
      else errors.push(`${msg} Turn on "Override CSC limits" to allow it.`);
    }
    if (
      (creditedChanged ||
        memoHoursChanged ||
        forfeitedHours !== old?.forfeitedHours) &&
      round2(creditedHours + forfeitedHours) !== memoHours
    ) {
      warnings.push(
        `${name}: credited (${creditedHours}) + forfeited (${forfeitedHours}) = ${round2(creditedHours + forfeitedHours)}, ` +
          `but the memo is ${memoHours} hour(s).`,
      );
    }

    // CSC: monthly accrual — only when this row starts counting, counts for more, or moves month.
    const counts =
      after.status !== CREDIT_STATUS.ROLLEDBACK &&
      state.status !== ROW_STATUS.ROLLEDBACK;
    const countedBefore =
      Boolean(old) &&
      !employeeChanged &&
      before.status !== CREDIT_STATUS.ROLLEDBACK &&
      old.status !== ROW_STATUS.ROLLEDBACK;
    const needsMonthCheck =
      counts &&
      monthAfter &&
      (!countedBefore || creditedHours > old.creditedHours || monthChanged);
    if (needsMonthCheck) {
      const other = round2(monthTotals.get(employeeId) || 0);
      const total = round2(other + creditedHours);
      if (total > limits.maxMonthly) {
        const msg =
          `${name}: would have ${total} CTO hour(s) credited for ${monthAfter.label} ` +
          `(CSC limit ${limits.maxMonthly}; ${other} from other memos).`;
        if (options.overrideLimit) warnings.push(`${msg} Limit overridden.`);
        else errors.push(`${msg} Turn on "Override CSC limits" to allow it.`);
      }
    }

    const nextRow = {
      _id: old?._id,
      employee: employeeId,
      creditedHours,
      usedHours,
      reservedHours: state.status === ROW_STATUS.ROLLEDBACK ? 0 : reservedHours,
      remainingHours: round2(state.remainingHours),
      forfeitedHours,
      status: state.status,
      dateCredited,
    };

    const changes = diffRow(old, nextRow).map((c) =>
      c.field === "employee"
        ? { ...c, from: nameOf(c.from), to: nameOf(c.to) }
        : c,
    );

    rowPlans.push({
      rowId: old?._id || null,
      employee: { _id: employeeId, name },
      action: !old ? "added" : changes.length ? "updated" : "unchanged",
      before: old || null,
      after: nextRow,
      changes,
      applications: usage,
    });
    nextRows.push(nextRow);
  });

  // Rows left out of the payload are removed.
  if (rowsProvided && Array.isArray(payload.employees)) {
    for (const old of oldRows) {
      if (seenRowIds.has(old._id)) continue;
      const name = nameOf(old.employee);
      const usage = usageOf(old.employee);
      if (old.usedHours > 0 || old.reservedHours > 0 || usage.activeCount > 0) {
        errors.push(
          `${name}: cannot be removed because hours were already used or reserved from this memo. ` +
            "Keep the row and change its status or numbers instead.",
        );
      } else if (usage.otherCount > 0) {
        warnings.push(
          `${name}: ${usage.otherCount} cancelled/rejected/revoked application(s) still point to this memo.`,
        );
      }
      rowPlans.push({
        rowId: old._id,
        employee: { _id: old.employee, name },
        action: "removed",
        before: old,
        after: null,
        changes: [],
        applications: usage,
      });
    }
  }

  /* ---------- balance impact ---------- */
  const balanceChanges = [];
  if (!errors.length) {
    const deltas = new Map();
    const bump = (id, n) => {
      if (!n) return;
      deltas.set(id, round2((deltas.get(id) || 0) + n));
    };
    oldRows.forEach((r) =>
      bump(r.employee, -balanceContributionOf(r, before.status)),
    );
    nextRows.forEach((r) =>
      bump(r.employee, balanceContributionOf(r, after.status)),
    );

    for (const [id, delta] of deltas) {
      if (!delta) continue;
      const current = round2(employeesById.get(id)?.balances?.ctoHours || 0);
      const next = round2(current + delta);
      balanceChanges.push({
        employee: { _id: id, name: nameOf(id) },
        current,
        delta,
        after: options.adjustBalances ? next : current,
      });
      if (!options.adjustBalances) continue;
      if (next < 0) {
        const msg = `${nameOf(id)}: CTO balance would go below zero (${current} → ${next}).`;
        if (options.force) warnings.push(`${msg} Forced.`);
        else errors.push(`${msg} Turn on "Force" to allow it.`);
      }
      if (delta > 0 && next > limits.maxBalance) {
        const msg = `${nameOf(id)}: CTO balance would be ${next} hours (CSC maximum ${limits.maxBalance}).`;
        if (options.overrideLimit) warnings.push(`${msg} Limit overridden.`);
        else errors.push(`${msg} Turn on "Override CSC limits" to allow it.`);
      }
    }
    if (!options.adjustBalances && balanceChanges.length) {
      warnings.push(
        "CTO balances will NOT be adjusted. Stored balances will no longer match the memos until you recalculate them.",
      );
    }
  }

  /* ---------- extra warnings ---------- */
  if (after.status === CREDIT_STATUS.CREDITED && nextRows.length) {
    const stillRolledBack = nextRows.filter(
      (r) => r.status === ROW_STATUS.ROLLEDBACK,
    ).length;
    if (stillRolledBack === nextRows.length) {
      warnings.push(
        "Every employee in this memo is rolled back. Consider setting the memo status to ROLLEDBACK.",
      );
    } else if (
      before.status === CREDIT_STATUS.ROLLEDBACK &&
      stillRolledBack > 0
    ) {
      warnings.push(
        `${stillRolledBack} employee row(s) are still ROLLEDBACK. Set them to ACTIVE to give those employees their hours back.`,
      );
    }
  }
  if (changed("uploadedMemo")) {
    warnings.push(
      "The new memo file will also be linked on every CTO application that uses this memo.",
    );
  }

  /* ---------- rollback metadata ---------- */
  const meta = {};
  if (
    after.status === CREDIT_STATUS.ROLLEDBACK &&
    before.status !== CREDIT_STATUS.ROLLEDBACK
  ) {
    meta.dateRolledBack = now;
    meta.rolledBackBy = userId || null;
  } else if (
    before.status === CREDIT_STATUS.ROLLEDBACK &&
    after.status !== CREDIT_STATUS.ROLLEDBACK
  ) {
    meta.dateRolledBack = null;
    meta.rolledBackBy = null;
  }

  const hasChanges =
    headerChanges.length > 0 || rowPlans.some((r) => r.action !== "unchanged");

  return {
    valid: errors.length === 0,
    hasChanges,
    errors,
    warnings,
    options,
    limits,
    memoHours: { from: memoHoursBefore, to: memoHours },
    month: monthAfter ? monthAfter.label : null,
    header: { changes: headerChanges },
    rows: rowPlans,
    balances: balanceChanges,
    next: {
      header: after,
      rows: nextRows,
      meta,
      fileChanged: changed("uploadedMemo"),
    },
  };
}

function toPublicPlan(plan) {
  const { next, ...rest } = plan; // eslint-disable-line no-unused-vars
  return rest;
}

function buildHistoryEntry(plan, userId, reason) {
  return {
    editedBy: userId,
    editedAt: new Date(),
    reason: reason || undefined,
    changes: {
      header: plan.header.changes,
      rows: plan.rows
        .filter((r) => r.action !== "unchanged")
        .map((r) => ({
          employee: r.employee._id,
          name: r.employee.name,
          action: r.action,
          changes: r.changes,
          ...(r.action === "added" ? { after: r.after } : {}),
          ...(r.action === "removed" ? { before: r.before } : {}),
        })),
      balances: plan.balances.map((b) => ({
        employee: b.employee._id,
        delta: b.delta,
      })),
      options: plan.options,
    },
  };
}

/* =========================================================================
   CONTEXT LOADER
========================================================================= */

async function loadEditContext(creditId, payload, session) {
  const creditQuery = CtoCredit.findById(creditId);
  if (session) creditQuery.session(session);
  const credit = await creditQuery;
  if (!credit) throw createServiceError("CTO credit memo not found.", 404);

  const inputIds = Array.isArray(payload.employees)
    ? payload.employees.map((r) => idOf(r?.employee))
    : [];
  const ids = [
    ...new Set([...credit.employees.map((r) => idOf(r.employee)), ...inputIds]),
  ].filter(isObjectIdString);

  const employeeQuery = Employee.find({ _id: { $in: ids } })
    .select("firstName lastName position employeeType balances.ctoHours")
    .lean();
  if (session) employeeQuery.session(session);

  const refDate =
    parseDate(payload.inclusiveDates?.startDate) ||
    credit.inclusiveDates?.startDate ||
    credit.dateApproved;
  const [employees, monthTotals, appUsage] = await Promise.all([
    employeeQuery,
    getMonthTotals(ids, refDate, { excludeCreditId: credit._id, session }),
    getApplicationUsage(credit._id, session),
  ]);

  return {
    credit,
    ctx: {
      employeesById: new Map(employees.map((e) => [String(e._id), e])),
      monthTotals,
      appUsage,
      limits: getLimits(),
    },
  };
}

/* =========================================================================
   PUBLIC SERVICE METHODS
========================================================================= */

/**
 * Employee search for the admin page: CTO balance + CSC room for the month of refDate
 * (default today), the same numbers getRemainingCreditableHours returns.
 */
async function searchEmployees({ q, limit, employeeType, refDate } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

  const conditions = [];
  const text = sanitizeString(q, 100);
  if (text) conditions.push(buildEmployeeSearchFilter(text));
  const type = sanitizeString(employeeType, 50);
  if (type) conditions.push({ employeeType: type });
  const filter = conditions.length ? { $and: conditions } : {};

  const select = [
    ...new Set([
      "firstName",
      "lastName",
      "position",
      "email",
      "employeeType",
      "balances.ctoHours",
      ...getSearchableEmployeeFields(),
    ]),
  ].join(" ");

  const employees = await Employee.find(filter)
    .select(select)
    .sort({ lastName: 1, firstName: 1 })
    .limit(lim)
    .lean();

  const ref = parseDate(refDate) || new Date();
  const month = getMonthBounds(ref);
  const totals = await getMonthTotals(
    employees.map((e) => e._id),
    ref,
  );
  const limits = getLimits();

  return {
    refDate: ref,
    month: month.label,
    results: employees.map((e) => ({
      ...e,
      fullName: fullName(e),
      ctoBalance: round2(e.balances?.ctoHours || 0),
      room: describeRoom(e, month.label, totals.get(String(e._id)), limits),
    })),
  };
}

/**
 * Paginated memo list.
 * search: memo no., purpose, employee name/email/position, or a memo id.
 * from/to: date approved ("YYYY-MM-DD"). overtimeFrom/overtimeTo: overtime start date.
 */
async function listCredits({
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
} = {}) {
  const pg = parsePagination(page, limit);
  const filter = {};

  const s = sanitizeString(status, 20).toUpperCase();
  if (s) {
    if (!Object.values(CREDIT_STATUS).includes(s))
      throw createServiceError("Invalid status filter.", 400);
    filter.status = s;
  }
  if (employeeId) {
    assertObjectId(employeeId, "employeeId");
    filter["employees.employee"] = toObjectId(employeeId);
  }

  const range = (fromRaw, toRaw, label) => {
    const a = parseDate(fromRaw);
    const b = parseDate(toRaw);
    if (fromRaw && !a)
      throw createServiceError(`Invalid '${label}From' date.`, 400);
    if (toRaw && !b)
      throw createServiceError(`Invalid '${label}To' date.`, 400);
    if (!a && !b) return null;
    const r = {};
    if (a) r.$gte = a;
    if (b) r.$lte = endOfDay(b);
    return r;
  };
  const approved = range(from, to, "");
  if (approved) filter.dateApproved = approved;
  const overtime = range(overtimeFrom, overtimeTo, "overtime");
  if (overtime) filter["inclusiveDates.startDate"] = overtime;

  const q = sanitizeString(search, 100);
  if (q) {
    const matches = await Employee.find(buildEmployeeSearchFilter(q))
      .select("_id")
      .limit(1000)
      .lean();
    const rx = { $regex: escapeRegex(q), $options: "i" };
    const or = [
      { memoNo: rx },
      { purpose: rx },
      { "employees.employee": { $in: matches.map((m) => m._id) } },
    ];
    if (isObjectIdString(q)) or.push({ _id: toObjectId(q) });
    filter.$or = or;
  }

  const [total, items, statusAgg] = await Promise.all([
    CtoCredit.countDocuments(filter),
    CtoCredit.find(filter)
      .populate(
        "employees.employee",
        "firstName lastName position employeeType",
      )
      .populate("creditedBy", "firstName lastName position")
      .populate("rolledBackBy", "firstName lastName position")
      .sort(parseSort(sort))
      .skip(pg.skip)
      .limit(pg.limit)
      .lean(),
    CtoCredit.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const statusCounts = { ALL: 0, CREDITED: 0, ROLLEDBACK: 0 };
  statusAgg.forEach((row) => {
    if (statusCounts[row._id] !== undefined) statusCounts[row._id] = row.count;
    statusCounts.ALL += row.count;
  });

  return {
    items: items.map((item) => ({
      ...item,
      memoHours: memoHoursOf(item.duration),
      summary: summarizeRows(item.employees, item.status),
    })),
    total,
    page: pg.page,
    limit: pg.limit,
    totalPages: Math.max(Math.ceil(total / pg.limit), 1),
    statusCounts,
  };
}

/**
 * One memo, ready for the edit form. Each row keeps `employee` as the id and gets
 * `employeeInfo` (null if the employee was deleted), `room` (CSC room for the memo's
 * month, counting OTHER memos) and `applications` (hours that applications hold).
 */
async function getCreditForEdit(creditId) {
  assertObjectId(creditId, "creditId");

  const query = CtoCredit.findById(creditId);
  if (HAS_EDIT_HISTORY) query.select("+adminEditHistory");
  const credit = await query.lean();
  if (!credit) throw createServiceError("CTO credit memo not found.", 404);

  const rowEmployeeIds = (credit.employees || []).map((r) => idOf(r.employee));
  const history = HAS_EDIT_HISTORY ? credit.adminEditHistory || [] : [];
  const peopleIds = [
    ...new Set(
      [
        ...rowEmployeeIds,
        credit.creditedBy,
        credit.rolledBackBy,
        ...history.map((h) => h.editedBy),
      ]
        .filter(Boolean)
        .map(idOf),
    ),
  ].filter(isObjectIdString);

  const monthRef = credit.inclusiveDates?.startDate || credit.dateApproved;
  const month = getMonthBounds(monthRef);
  const [people, monthTotals, appUsage, apps] = await Promise.all([
    Employee.find({ _id: { $in: peopleIds } })
      .select(
        "firstName lastName position email employeeType balances.ctoHours",
      )
      .lean(),
    getMonthTotals(rowEmployeeIds, monthRef, { excludeCreditId: credit._id }),
    getApplicationUsage(credit._id),
    CtoApplication.find({ "memo.memoId": credit._id })
      .select(
        "employee overallStatus memo inclusiveDates requestedHours createdAt",
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
  ]);

  const byId = new Map(people.map((p) => [String(p._id), p]));
  const limits = getLimits();
  const brief = (id) => {
    if (!id) return null;
    const p = byId.get(idOf(id));
    return p
      ? {
          _id: p._id,
          firstName: p.firstName,
          lastName: p.lastName,
          fullName: fullName(p),
          position: p.position,
        }
      : {
          _id: id,
          firstName: "Unknown",
          lastName: "user",
          fullName: "Unknown user",
        };
  };

  const employees = (credit.employees || []).map((row) => {
    const id = idOf(row.employee);
    const info = byId.get(id) || null;
    return {
      ...row,
      employee: id,
      employeeInfo: info
        ? {
            _id: info._id,
            firstName: info.firstName,
            lastName: info.lastName,
            fullName: fullName(info),
            position: info.position,
            email: info.email,
            employeeType: info.employeeType,
            ctoBalance: round2(info.balances?.ctoHours || 0),
          }
        : null,
      room: info
        ? describeRoom(info, month.label, monthTotals.get(id), limits)
        : null,
      applications: appUsage.get(id) || { ...EMPTY_USAGE },
    };
  });

  const applications = apps.map((a) => ({
    _id: a._id,
    employee: brief(a.employee),
    overallStatus: a.overallStatus,
    creditBucket: CREDIT_BUCKET_BY_STATUS[a.overallStatus] ?? null,
    appliedHours: round2(
      (a.memo || [])
        .filter((m) => idOf(m.memoId) === String(credit._id))
        .reduce((s, m) => s + (m.appliedHours || 0), 0),
    ),
    requestedHours: a.requestedHours,
    inclusiveDates: a.inclusiveDates,
    createdAt: a.createdAt,
  }));

  return {
    ...credit,
    employees,
    creditedBy: brief(credit.creditedBy),
    rolledBackBy: brief(credit.rolledBackBy),
    adminEditHistory: history
      .slice()
      .sort((a, b) => new Date(b.editedAt) - new Date(a.editedAt))
      .map((h) => ({ ...h, editedBy: brief(h.editedBy) })),
    memoHours: memoHoursOf(credit.duration),
    month: month.label,
    limits,
    summary: summarizeRows(credit.employees || [], credit.status),
    applications,
    balanceRule:
      "CTO balance = remaining + reserved hours on rows that are not rolled back",
  };
}

/** Dry run of updateCredit: the full plan, including errors, without saving. */
async function previewCreditUpdate(creditId, payload = {}, userId) {
  assertObjectId(creditId, "creditId");
  const { credit, ctx } = await loadEditContext(creditId, payload, null);
  // The file itself is only sent on save; `newMemoFileName` lets the preview show the change.
  const pendingFile = sanitizeString(payload.newMemoFileName, 200);
  const plan = buildEditPlan({
    credit,
    payload,
    ctx,
    userId,
    newMemoFile: pendingFile ? `(new upload) ${pendingFile}` : null,
  });

  const expected = parseDate(payload.expectedUpdatedAt);
  if (
    expected &&
    credit.updatedAt &&
    expected.getTime() !== credit.updatedAt.getTime()
  ) {
    plan.warnings.unshift(
      "Someone changed this memo after you opened it. Saving will be refused — reload it first.",
    );
  }
  return toPublicPlan(plan);
}

/**
 * Saves an admin edit atomically: memo details, rows, balances, the memo file link on
 * applications that use it, and the edit log.
 * Throws 400 with `details` (all validation errors) or 409 if the memo changed meanwhile.
 * `newMemoFile` is the path of an uploaded memo file (from the controller), or null.
 */
async function updateCredit(
  creditId,
  payload = {},
  userId,
  { newMemoFile = null } = {},
) {
  assertObjectId(creditId, "creditId");
  assertObjectId(userId, "userId");
  const reason = sanitizeString(payload.reason, 500);

  let plan = null;
  let before = null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { credit, ctx } = await loadEditContext(creditId, payload, session);

      const expected = parseDate(payload.expectedUpdatedAt);
      if (
        expected &&
        credit.updatedAt &&
        expected.getTime() !== credit.updatedAt.getTime()
      ) {
        throw createServiceError(
          "This credit memo was changed by someone else after you opened it. Reload it and apply your edits again.",
          409,
        );
      }

      before = credit.toObject();
      plan = buildEditPlan({
        credit,
        payload,
        ctx,
        userId,
        newMemoFile,
        now: new Date(),
      });

      if (!plan.valid) {
        const extra =
          plan.errors.length > 1 ? ` (+${plan.errors.length - 1} more)` : "";
        throw createServiceError(`${plan.errors[0]}${extra}`, 400, plan.errors);
      }
      if (!plan.hasChanges) return;

      const { header, rows, meta, fileChanged } = plan.next;
      credit.memoNo = header.memoNo;
      credit.purpose = header.purpose;
      credit.dateApproved = header.dateApproved;
      if (header.dateCredited) credit.dateCredited = header.dateCredited;
      credit.status = header.status;
      credit.inclusiveDates = {
        startDate: header.startDate,
        endDate: header.endDate,
      };
      credit.duration = {
        hours: header.durationHours,
        minutes: header.durationMinutes,
      };
      credit.uploadedMemo = header.uploadedMemo;
      credit.employees = rows.map(({ _id, ...rest }) =>
        _id ? { _id, ...rest } : rest,
      );
      if ("dateRolledBack" in meta) {
        credit.dateRolledBack = meta.dateRolledBack || undefined;
        credit.rolledBackBy = meta.rolledBackBy || undefined;
      }
      await credit.save({ session });

      // Applications keep their own copy of the memo file path.
      if (fileChanged) {
        await CtoApplication.updateMany(
          { "memo.memoId": credit._id },
          { $set: { "memo.$[m].uploadedMemo": header.uploadedMemo } },
          { arrayFilters: [{ "m.memoId": credit._id }], session },
        );
      }

      if (plan.options.adjustBalances) {
        const ops = plan.balances
          .filter((b) => b.delta !== 0)
          .map((b) => ({
            updateOne: {
              filter: { _id: toObjectId(b.employee._id) },
              update: { $inc: { "balances.ctoHours": b.delta } },
            },
          }));
        if (ops.length) await Employee.bulkWrite(ops, { session });
      }

      if (HAS_EDIT_HISTORY) {
        await CtoCredit.updateOne(
          { _id: credit._id },
          {
            $push: {
              adminEditHistory: buildHistoryEntry(plan, userId, reason),
            },
          },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  const credit = await getCreditForEdit(creditId);
  return { credit, before, plan: toPublicPlan(plan), changed: plan.hasChanges };
}

module.exports = {
  searchEmployees,
  listCredits,
  getCreditForEdit,
  previewCreditUpdate,
  updateCredit,

  // exported for tests / reuse
  buildEditPlan,
  resolveRowState,
  balanceContributionOf,
  buildEmployeeSearchFilter,
  getMonthBounds,
  describeRoom,
  memoHoursOf,
  CREDIT_STATUS,
  ROW_STATUS,
};
