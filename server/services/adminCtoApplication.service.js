// services/adminCtoApplication.service.js
//
// Admin tools for CTO applications:
//   • search employees (name, email, position, division, employee ID)
//   • list / filter every CTO application
//   • load one application for editing (with its approval steps and memo credits)
//   • list an employee's CTO credit memos (to re-allocate hours)
//   • preview an edit (dry run: validation, hour moves, balance impact)
//   • save an edit in one transaction — every field, dates, hours, memo allocation,
//     overall status, approval steps (add / remove / reorder / change), notified
//     employees and revocation details
//   • compare an employee's stored CTO balance with their credits, and recalculate it
//
// Admin edits are silent corrections: no emails or in-app notifications are sent.
//
// HOURS RULE — how the existing services move CTO hours:
//   submit (PENDING)            → memo hours: remaining → reserved
//   cancel / reject             → memo hours: reserved  → remaining
//   final approval (APPROVED)   → memo hours: reserved  → used,  balances.ctoHours − requested
//   revocation approved         → memo hours: used      → remaining, balances.ctoHours + requested
// So each status says where the application's hours sit (CREDIT_BUCKET_BY_STATUS)
// and whether they are deducted from the balance (STATUSES_THAT_DEDUCT_BALANCE).
// Every admin edit just moves the difference. If your approval service behaves
// differently, change those two constants — everything here goes through them.

const mongoose = require("mongoose");
const CtoApplication = require("../models/ctoApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const CtoCredit = require("../models/ctoCreditModel");
const Employee = require("../models/employeeModel");
const { APPROVAL_ROLE_VALUES } = require("../constants/approvalRoles");

/* =========================================================================
   CONSTANTS
========================================================================= */

const APP_STATUS = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  REVOCATION_REQUESTED: "REVOCATION_REQUESTED",
  REVOKED: "REVOKED",
});
const APP_STATUS_VALUES = Object.values(APP_STATUS);
const STEP_STATUS_VALUES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const EMPLOYEE_TYPES = ["Organic", "JO"];
const COMMUTATION_VALUES = ["Requested", "Not Requested"];

/** HOURS RULE (see header) */
const CREDIT_BUCKET_BY_STATUS = Object.freeze({
  PENDING: "reserved",
  APPROVED: "used",
  REVOCATION_REQUESTED: "used",
  REJECTED: null,
  CANCELLED: null,
  REVOKED: null,
});
const STATUSES_THAT_DEDUCT_BALANCE = new Set([
  "APPROVED",
  "REVOCATION_REQUESTED",
]);

/** Statuses that block another application on the same dates (same as the submit check + revocation). */
const DATE_BLOCKING_STATUSES = ["PENDING", "APPROVED", "REVOCATION_REQUESTED"];

/** CSC availment rules used by addCtoApplicationService. */
const CSC_BLOCK_HOURS = 4;
const CSC_MAX_HOURS = 40;
const MODEL_MAX_HOURS = 300;

const ROLLEDBACK = "ROLLEDBACK";

const EMPLOYEE_SEARCH_CANDIDATES = Object.freeze([
  "firstName",
  "middleName",
  "lastName",
  "email",
  "position",
  "division",
  "employeeId",
  "employeeNo",
]);

const PERSON_FIELDS =
  "prefixTitle firstName middleName lastName nameExtension postfixTitle position division email employeeType";

const SORTABLE_FIELDS = new Set(["createdAt", "updatedAt", "requestedHours"]);

/** Simple editable fields: payload path → rules. */
const FIELD_SPECS = [
  { path: "reason", label: "Reason", type: "text", max: 1000, required: true },
  {
    path: "employeeType",
    label: "Employee type",
    type: "enum",
    values: EMPLOYEE_TYPES,
  },
  {
    path: "commutation",
    label: "Commutation",
    type: "enum",
    values: COMMUTATION_VALUES,
  },

  { path: "lateFiling.isLateFiling", label: "Late filing", type: "bool" },
  {
    path: "lateFiling.justification",
    label: "Late filing justification",
    type: "text",
    max: 1000,
  },

  {
    path: "actionDetails.approvedDaysWithPay",
    label: "Approved days with pay",
    type: "number",
    min: 0,
    nullable: true,
  },
  {
    path: "actionDetails.approvedDaysWithoutPay",
    label: "Approved days without pay",
    type: "number",
    min: 0,
    nullable: true,
  },
  {
    path: "actionDetails.approvedOthersSpecify",
    label: "Approved — others",
    type: "text",
    max: 500,
  },
  {
    path: "actionDetails.disapprovedDueTo",
    label: "Disapproved due to",
    type: "text",
    max: 500,
  },

  {
    path: "certificationOfLeaveCredits.asOfDate",
    label: "Leave credits as of",
    type: "date",
    nullable: true,
  },
  {
    path: "certificationOfLeaveCredits.vacationLeave.totalEarned",
    label: "VL total earned",
    type: "number",
    nullable: true,
  },
  {
    path: "certificationOfLeaveCredits.vacationLeave.lessThisApplication",
    label: "VL less this application",
    type: "number",
    nullable: true,
  },
  {
    path: "certificationOfLeaveCredits.vacationLeave.balance",
    label: "VL balance",
    type: "number",
    nullable: true,
  },
  {
    path: "certificationOfLeaveCredits.sickLeave.totalEarned",
    label: "SL total earned",
    type: "number",
    nullable: true,
  },
  {
    path: "certificationOfLeaveCredits.sickLeave.lessThisApplication",
    label: "SL less this application",
    type: "number",
    nullable: true,
  },
  {
    path: "certificationOfLeaveCredits.sickLeave.balance",
    label: "SL balance",
    type: "number",
    nullable: true,
  },

  {
    path: "applicantSnapshot.prefixTitle",
    label: "Prefix title",
    type: "text",
    max: 50,
  },
  {
    path: "applicantSnapshot.firstName",
    label: "First name",
    type: "text",
    max: 100,
    required: true,
  },
  {
    path: "applicantSnapshot.middleName",
    label: "Middle name",
    type: "text",
    max: 100,
  },
  {
    path: "applicantSnapshot.lastName",
    label: "Last name",
    type: "text",
    max: 100,
    required: true,
  },
  {
    path: "applicantSnapshot.nameExtension",
    label: "Name extension",
    type: "text",
    max: 20,
  },
  {
    path: "applicantSnapshot.postfixTitle",
    label: "Postfix title",
    type: "text",
    max: 50,
  },
  {
    path: "applicantSnapshot.division",
    label: "Division",
    type: "text",
    max: 200,
    required: true,
  },
  {
    path: "applicantSnapshot.position",
    label: "Position",
    type: "text",
    max: 200,
    required: true,
  },
  {
    path: "applicantSnapshot.salaryGrade",
    label: "Salary grade",
    type: "number",
    min: 0,
    nullable: true,
  },
  {
    path: "applicantSnapshot.salaryAmount",
    label: "Salary amount",
    type: "number",
    min: 0,
    nullable: true,
  },
];

const hasPath = (model, path) =>
  model.schema.pathType(path) !== "adhocOrUndefined";
const HAS_EDIT_HISTORY = hasPath(CtoApplication, "adminEditHistory");
const STEP_HAS = {
  signature: hasPath(ApprovalStep, "approverSignature"),
  snapshot: hasPath(ApprovalStep, "approverSnapshot"),
  reviewedAt: hasPath(ApprovalStep, "reviewedAt"),
  ctoApplication: hasPath(ApprovalStep, "ctoApplication"),
};

/* =========================================================================
   GENERIC HELPERS
========================================================================= */

function createServiceError(message, statusCode = 400, details) {
  const err = new Error(message);
  err.status = statusCode;
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
  if (
    value &&
    typeof value === "object" &&
    !(value instanceof mongoose.Types.ObjectId)
  ) {
    return String(value._id ?? value.id ?? "");
  }
  return value === undefined || value === null ? "" : String(value);
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

function parseNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) ? round2(n) : null;
}

/** Date, ISO string, or "YYYY-MM-DD" (local midnight). */
function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  const str = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad2 = (n) => String(n).padStart(2, "0");

/** Calendar day of a date in the server's time zone, e.g. "2026-10-20". */
function dayKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()))
    return value.trim();
  const d = parseDate(value);
  if (!d) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * A new Date for calendar day `key`, stored with the same time-of-day as the
 * application's existing dates, so old and new dates look alike in the database.
 */
function buildDay(key, template) {
  const [y, m, d] = key.split("-").map(Number);
  const localMidnight = new Date(y, m - 1, d);
  if (!template) return localMidnight;
  const t = new Date(template);
  const tMidnight = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return new Date(
    localMidnight.getTime() + (t.getTime() - tMidnight.getTime()),
  );
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

function getPath(obj, path) {
  return path
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function fullName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim();
}

function brief(person) {
  if (!person) return null;
  return {
    _id: person._id,
    firstName: person.firstName,
    lastName: person.lastName,
    fullName: fullName(person),
    position: person.position,
    division: person.division,
    email: person.email,
    employeeType: person.employeeType,
  };
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
    adjustCredits: toBool(o.adjustCredits, true),
    adjustBalance: toBool(o.adjustBalance, true),
    force: toBool(o.force, false),
  };
}

function creditRowOf(credit, employeeId) {
  return (
    (credit?.employees || []).find(
      (e) => idOf(e.employee) === String(employeeId),
    ) || null
  );
}

function rowHours(row) {
  const remaining = round2(row?.remainingHours || 0);
  const reserved = round2(row?.reservedHours || 0);
  const used = round2(row?.usedHours || 0);
  return {
    remaining,
    reserved,
    used,
    // ctoCreditModel stores this as creditedHours (totalHours kept for older data)
    total: round2(
      Number(row?.creditedHours ?? row?.totalHours) ||
        remaining + reserved + used,
    ),
    status: row?.status || null,
  };
}

/* =========================================================================
   BALANCE RULE
========================================================================= */

/** Hours of an application that are deducted from balances.ctoHours. */
function balanceDeductionOf(status, requestedHours) {
  return STATUSES_THAT_DEDUCT_BALANCE.has(status)
    ? round2(requestedHours || 0)
    : 0;
}

/** What balances.ctoHours should be, given computeCtoLedger() totals. */
function expectedBalanceFromLedger(ledger) {
  return round2(ledger.remainingHours + ledger.reservedHours);
}

/* =========================================================================
   EMPLOYEE SEARCH
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

/** "juan dela" → every word must match a searchable field. A 24-hex string also matches _id. */
function buildEmployeeSearchFilter(text) {
  const q = sanitizeString(text, 100);
  if (!q) return {};
  const fields = getSearchableEmployeeFields();
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 5);
  const byWords = {
    $and: tokens.map((t) => ({
      $or: fields.map((f) => ({
        [f]: { $regex: escapeRegex(t), $options: "i" },
      })),
    })),
  };
  return isObjectIdString(q)
    ? { $or: [{ _id: toObjectId(q) }, byWords] }
    : byWords;
}

/* =========================================================================
   LEDGER
========================================================================= */

async function computeCtoLedger(employeeId, session) {
  const id = toObjectId(employeeId);
  const pipeline = CtoCredit.aggregate([
    { $match: { "employees.employee": id, status: { $ne: ROLLEDBACK } } },
    { $unwind: "$employees" },
    {
      $match: {
        "employees.employee": id,
        "employees.status": { $ne: ROLLEDBACK },
      },
    },
    {
      $project: {
        remaining: { $ifNull: ["$employees.remainingHours", 0] },
        reserved: { $ifNull: ["$employees.reservedHours", 0] },
        used: { $ifNull: ["$employees.usedHours", 0] },
        total: {
          $ifNull: [
            "$employees.creditedHours",
            { $ifNull: ["$employees.totalHours", 0] },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        memos: { $sum: 1 },
        remaining: { $sum: "$remaining" },
        reserved: { $sum: "$reserved" },
        used: { $sum: "$used" },
        total: {
          $sum: {
            $cond: [
              { $gt: ["$total", 0] },
              "$total",
              { $add: ["$remaining", "$reserved", "$used"] },
            ],
          },
        },
      },
    },
  ]);
  if (session) pipeline.session(session);
  const [row] = await pipeline;
  return {
    memos: row?.memos || 0,
    totalHours: round2(row?.total || 0),
    remainingHours: round2(row?.remaining || 0),
    reservedHours: round2(row?.reserved || 0),
    usedHours: round2(row?.used || 0),
  };
}

/* =========================================================================
   EDIT PLANNER (pure — no database access)
========================================================================= */

function normalizeFieldValue(spec, raw, errors) {
  const label = spec.label;
  switch (spec.type) {
    case "text": {
      const v = sanitizeString(raw, spec.max || 200);
      if (spec.required && !v) errors.push(`${label} is required.`);
      return v;
    }
    case "enum": {
      const v = sanitizeString(raw, 50);
      if (!spec.values.includes(v)) {
        errors.push(`${label} must be one of: ${spec.values.join(", ")}.`);
        return undefined;
      }
      return v;
    }
    case "bool":
      return toBool(raw, false);
    case "number": {
      if (raw === null || raw === "") {
        if (spec.nullable) return null;
        errors.push(`${label} is required.`);
        return undefined;
      }
      const n = parseNumber(raw);
      if (n === null || (spec.min !== undefined && n < spec.min)) {
        errors.push(
          `${label} must be a number${spec.min !== undefined ? ` of ${spec.min} or more` : ""}.`,
        );
        return undefined;
      }
      return n;
    }
    case "date": {
      if (raw === null || raw === "") {
        if (spec.nullable) return null;
        errors.push(`${label} is required.`);
        return undefined;
      }
      const d = parseDate(raw);
      if (!d) {
        errors.push(`${label} is not a valid date.`);
        return undefined;
      }
      return d;
    }
    default:
      return undefined;
  }
}

function valuesEqual(type, a, b) {
  if (type === "date") return sameTime(a, b);
  const norm = (v) => (v === undefined || v === null ? "" : String(v));
  return norm(a) === norm(b);
}

function snapshotFromPerson(person) {
  return {
    prefixTitle: person?.prefixTitle || "",
    firstName: person?.firstName || "",
    middleName: person?.middleName || "",
    lastName: person?.lastName || "",
    nameExtension: person?.nameExtension || "",
    postfixTitle: person?.postfixTitle || "",
    position: person?.position || "",
  };
}

/**
 * Works out everything an edit would do, without touching the database.
 *
 * app     — the application (plain object or document)
 * steps   — its approval steps
 * payload — any of:
 *   reason, employeeType, commutation, requestedHours, inclusiveDates: ["YYYY-MM-DD"],
 *   overallStatus, lateFiling{}, actionDetails{}, certificationOfLeaveCredits{}, applicantSnapshot{},
 *   notifiedEmployees: [id], memo: [{ memoId, appliedHours }],
 *   approvals: [{ _id?, approver, role, status, remarks, reviewedAt }]   (full ordered list),
 *   revocation: { requestReason, revokeReason },
 *   options: { adjustCredits = true, adjustBalance = true, force = false }
 * ctx — { employee, creditsById, peopleById, overlaps } from loadEditContext()
 */
function buildEditPlan({
  app: appInput,
  steps = [],
  payload = {},
  ctx,
  userId,
  now = new Date(),
}) {
  const app =
    typeof appInput?.toObject === "function" ? appInput.toObject() : appInput;
  const errors = [];
  const warnings = [];
  const options = normalizeOptions(payload.options);
  const applicantId = idOf(app.employee);
  const nameOf = (id) =>
    fullName(ctx.peopleById.get(String(id))) ||
    `Employee ${String(id).slice(-6)}`;

  const set = {};
  const unset = [];
  const fieldChanges = [];
  const change = (field, label, from, to) =>
    fieldChanges.push({ field, label, from, to });

  /* ---------- simple fields ---------- */
  for (const spec of FIELD_SPECS) {
    const raw = getPath(payload, spec.path);
    if (raw === undefined) continue;
    const value = normalizeFieldValue(spec, raw, errors);
    if (value === undefined) continue;
    const current = getPath(app, spec.path);
    if (!valuesEqual(spec.type, current, value)) {
      set[spec.path] = value;
      change(spec.path, spec.label, current ?? null, value);
    }
  }
  const valueAfter = (path) => (path in set ? set[path] : getPath(app, path));

  if (
    valueAfter("lateFiling.isLateFiling") === true &&
    !sanitizeString(valueAfter("lateFiling.justification"), 1000)
  ) {
    errors.push(
      "A late filing justification is required when late filing is on.",
    );
  }

  /* ---------- status ---------- */
  const statusBefore = app.overallStatus || APP_STATUS.PENDING;
  let statusAfter = statusBefore;
  if (payload.overallStatus !== undefined) {
    const s = sanitizeString(payload.overallStatus, 30).toUpperCase();
    if (!APP_STATUS_VALUES.includes(s))
      errors.push(`Status must be one of: ${APP_STATUS_VALUES.join(", ")}.`);
    else statusAfter = s;
  }
  if (statusAfter !== statusBefore) {
    set.overallStatus = statusAfter;
    change("overallStatus", "Status", statusBefore, statusAfter);
  }

  /* ---------- requested hours ---------- */
  const hoursBefore = round2(app.requestedHours || 0);
  let hoursAfter = hoursBefore;
  if (payload.requestedHours !== undefined) {
    const n = parseNumber(payload.requestedHours);
    if (n === null || n <= 0)
      errors.push("Requested hours must be a number greater than 0.");
    else if (n > MODEL_MAX_HOURS)
      errors.push(`Requested hours cannot be more than ${MODEL_MAX_HOURS}.`);
    else hoursAfter = n;
  }
  if (hoursAfter !== hoursBefore) {
    set.requestedHours = hoursAfter;
    change("requestedHours", "Requested hours", hoursBefore, hoursAfter);
    const cscProblems = [];
    if (hoursAfter % CSC_BLOCK_HOURS !== 0)
      cscProblems.push(`blocks of ${CSC_BLOCK_HOURS} hours`);
    if (hoursAfter > CSC_MAX_HOURS)
      cscProblems.push(`at most ${CSC_MAX_HOURS} hours per application`);
    if (cscProblems.length) {
      const msg = `CSC rules expect ${cscProblems.join(" and ")} (got ${hoursAfter}).`;
      if (options.force) warnings.push(`${msg} Allowed because "Force" is on.`);
      else errors.push(`${msg} Turn on "Force" to allow it.`);
    }
  }

  /* ---------- inclusive dates ---------- */
  const oldDates = (app.inclusiveDates || []).map((d) => new Date(d));
  const oldByKey = new Map(oldDates.map((d) => [dayKey(d), d]));
  const oldKeys = [...oldByKey.keys()].sort();
  let datesAfter = oldDates;
  let newKeys = oldKeys;
  let datesChanged = false;
  if (payload.inclusiveDates !== undefined) {
    if (
      !Array.isArray(payload.inclusiveDates) ||
      payload.inclusiveDates.length === 0
    ) {
      errors.push("At least one inclusive date is required.");
    } else {
      // Each entry is either an exact timestamp (kept exactly as sent, so the
      // server's time zone can't shift it) or a plain "YYYY-MM-DD" day.
      const sentByKey = new Map();
      payload.inclusiveDates.forEach((raw, i) => {
        const isDayOnly =
          typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
        const exact = isDayOnly ? null : parseDate(raw);
        const key = isDayOnly ? raw.trim() : exact ? dayKey(exact) : null;
        if (!key) errors.push(`Inclusive date #${i + 1} is not a valid date.`);
        else if (!sentByKey.has(key)) sentByKey.set(key, exact);
      });
      const unique = [...sentByKey.keys()].sort();
      if (unique.length && unique.join(",") !== oldKeys.join(",")) {
        newKeys = unique;
        datesAfter = unique.map(
          (k) =>
            oldByKey.get(k) || sentByKey.get(k) || buildDay(k, oldDates[0]),
        );
        datesChanged = true;
        set.inclusiveDates = datesAfter;
        // exact timestamps, so the browser shows them in the user's own time zone
        change(
          "inclusiveDates",
          "Inclusive dates",
          oldDates.map((d) => d.toISOString()),
          datesAfter.map((d) => new Date(d).toISOString()),
        );
      }
    }
  }
  if (
    (datesChanged || hoursAfter !== hoursBefore) &&
    hoursAfter > newKeys.length * 8
  ) {
    warnings.push(
      `${hoursAfter} hours is more than 8 hours per selected day (${newKeys.length} day(s)).`,
    );
  }

  /* ---------- overlapping applications ---------- */
  const blocksDates = DATE_BLOCKING_STATUSES.includes(statusAfter);
  const startsBlocking =
    blocksDates && !DATE_BLOCKING_STATUSES.includes(statusBefore);
  if (blocksDates && (datesChanged || startsBlocking)) {
    const mine = new Set(newKeys);
    const clashes = [];
    for (const other of ctx.overlaps || []) {
      const shared = (other.inclusiveDates || [])
        .map(dayKey)
        .filter((k) => mine.has(k));
      if (shared.length)
        clashes.push(
          `#${String(other._id).slice(-6).toUpperCase()} (${other.overallStatus}) on ${[...new Set(shared)].join(", ")}`,
        );
    }
    if (clashes.length) {
      const msg = `The employee already has CTO on the same date(s): ${clashes.join("; ")}.`;
      if (options.force) warnings.push(`${msg} Allowed because "Force" is on.`);
      else errors.push(`${msg} Turn on "Force" to allow it.`);
    }
  }

  /* ---------- Organic requirements ---------- */
  if (valueAfter("employeeType") === "Organic") {
    const missing = [];
    if (parseNumber(valueAfter("applicantSnapshot.salaryGrade")) === null)
      missing.push("salary grade");
    if (parseNumber(valueAfter("applicantSnapshot.salaryAmount")) === null)
      missing.push("salary amount");
    if (missing.length)
      errors.push(
        `Organic applications need the applicant's ${missing.join(" and ")}.`,
      );
    if (!app.applicantSignatureUrl) {
      if (ctx.employee?.signature) {
        set.applicantSignatureUrl = ctx.employee.signature;
        warnings.push(
          "The applicant's current signature will be attached (required for Organic / CSC Form 6).",
        );
      } else {
        errors.push(
          "Organic applications need the applicant's signature, but none is on file.",
        );
      }
    }
  }

  /* ---------- memo allocation ---------- */
  const oldAlloc = (app.memo || []).map((m) => ({
    _id: m._id ? String(m._id) : undefined,
    memoId: idOf(m.memoId),
    uploadedMemo: m.uploadedMemo,
    appliedHours: round2(m.appliedHours || 0),
  }));
  const oldAllocById = new Map(oldAlloc.map((m) => [m.memoId, m]));
  let newAlloc = oldAlloc;
  let memoProvided = false;
  if (payload.memo !== undefined) {
    memoProvided = true;
    if (!Array.isArray(payload.memo) || payload.memo.length === 0) {
      errors.push("At least one memo with applied hours is required.");
      newAlloc = [];
    } else {
      const seen = new Set();
      newAlloc = [];
      payload.memo.forEach((m, i) => {
        const memoId = idOf(m?.memoId);
        if (!isObjectIdString(memoId)) {
          errors.push(`Memo row #${i + 1}: pick a valid memo.`);
          return;
        }
        if (seen.has(memoId)) {
          errors.push(
            `Memo ${ctx.creditsById.get(memoId)?.memoNo || memoId} is listed twice.`,
          );
          return;
        }
        seen.add(memoId);
        const hours = parseNumber(m.appliedHours);
        if (hours === null || hours < 0.5) {
          errors.push(
            `Memo ${ctx.creditsById.get(memoId)?.memoNo || memoId}: applied hours must be at least 0.5.`,
          );
          return;
        }
        const old = oldAllocById.get(memoId);
        const credit = ctx.creditsById.get(memoId);
        let uploadedMemo = old?.uploadedMemo;
        if (!uploadedMemo) {
          uploadedMemo = String(credit?.uploadedMemo || "").replace(/\\/g, "/");
          if (!uploadedMemo) {
            uploadedMemo = "N/A";
            warnings.push(
              `Memo ${credit?.memoNo || memoId} has no uploaded file; the link is saved as "N/A".`,
            );
          }
        }
        newAlloc.push({
          _id: old?._id,
          memoId,
          uploadedMemo,
          appliedHours: hours,
        });
      });
    }
  }
  const allocTotal = round2(newAlloc.reduce((s, m) => s + m.appliedHours, 0));
  if (newAlloc.length && allocTotal !== hoursAfter) {
    errors.push(
      `Applied hours across memos (${allocTotal}) must equal the requested hours (${hoursAfter}).`,
    );
  }

  /* ---------- credit hour moves ---------- */
  const bucketBefore = CREDIT_BUCKET_BY_STATUS[statusBefore] ?? null;
  const bucketAfter = CREDIT_BUCKET_BY_STATUS[statusAfter] ?? null;
  const newAllocById = new Map(newAlloc.map((m) => [m.memoId, m]));
  const memoIds = [
    ...new Set([...oldAllocById.keys(), ...newAllocById.keys()]),
  ];
  const memoPlans = [];
  const creditOps = [];

  for (const memoId of memoIds) {
    const credit = ctx.creditsById.get(memoId);
    const memoNo = credit?.memoNo || `#${memoId.slice(-6)}`;
    const fromHours = oldAllocById.get(memoId)?.appliedHours || 0;
    const toHours = newAllocById.get(memoId)?.appliedHours || 0;
    const action = !fromHours
      ? "added"
      : !toHours
        ? "removed"
        : fromHours !== toHours
          ? "updated"
          : "unchanged";

    const holdBefore = {
      reserved: bucketBefore === "reserved" ? fromHours : 0,
      used: bucketBefore === "used" ? fromHours : 0,
    };
    const holdAfter = {
      reserved: bucketAfter === "reserved" ? toHours : 0,
      used: bucketAfter === "used" ? toHours : 0,
    };
    let reservedDelta = round2(holdAfter.reserved - holdBefore.reserved);
    let usedDelta = round2(holdAfter.used - holdBefore.used);

    const plan = { memoId, memoNo, action, fromHours, toHours, credit: null };
    memoPlans.push(plan);

    if (!credit) {
      if (toHours > 0) errors.push(`Memo ${memoNo} was not found.`);
      else
        warnings.push(`Memo ${memoNo} no longer exists; nothing to give back.`);
      continue;
    }
    const row = creditRowOf(credit, applicantId);
    if (!row) {
      if (toHours > 0)
        errors.push(`Memo ${memoNo} does not credit this employee.`);
      else
        warnings.push(
          `Memo ${memoNo} no longer has this employee; nothing to give back.`,
        );
      continue;
    }

    const takesMore =
      toHours > fromHours || (bucketAfter && !bucketBefore && toHours > 0);
    if (
      takesMore &&
      (credit.status === ROLLEDBACK || row.status === ROLLEDBACK)
    ) {
      errors.push(`Memo ${memoNo} was rolled back and cannot be used.`);
    } else if (takesMore && credit.status && credit.status !== "CREDITED") {
      const msg = `Memo ${memoNo} has status ${credit.status}.`;
      if (options.force)
        warnings.push(`${msg} Used anyway because "Force" is on.`);
      else errors.push(`${msg} Turn on "Force" to use it anyway.`);
    }

    const cur = rowHours(row);
    if (options.force) {
      if (cur.reserved + reservedDelta < 0) {
        warnings.push(
          `Memo ${memoNo}: reserved hours would go below zero; kept at 0.`,
        );
        reservedDelta = -cur.reserved;
      }
      if (cur.used + usedDelta < 0) {
        warnings.push(
          `Memo ${memoNo}: used hours would go below zero; kept at 0.`,
        );
        usedDelta = -cur.used;
      }
    } else {
      if (cur.reserved + reservedDelta < 0) {
        errors.push(
          `Memo ${memoNo}: only ${cur.reserved} reserved hour(s) to release, needs ${-reservedDelta}. The memo data looks off — turn on "Force" to continue.`,
        );
      }
      if (cur.used + usedDelta < 0) {
        errors.push(
          `Memo ${memoNo}: only ${cur.used} used hour(s) to give back, needs ${-usedDelta}. The memo data looks off — turn on "Force" to continue.`,
        );
      }
    }
    const remainingDelta = round2(-(reservedDelta + usedDelta));
    if (cur.remaining + remainingDelta < 0) {
      errors.push(
        `Memo ${memoNo} has only ${cur.remaining} hour(s) left; this change needs ${-remainingDelta}.`,
      );
    }

    const after = {
      remaining: round2(cur.remaining + remainingDelta),
      reserved: round2(cur.reserved + reservedDelta),
      used: round2(cur.used + usedDelta),
    };
    plan.credit = {
      before: {
        remaining: cur.remaining,
        reserved: cur.reserved,
        used: cur.used,
      },
      after,
    };

    if (
      options.adjustCredits &&
      (reservedDelta || usedDelta || remainingDelta)
    ) {
      creditOps.push({
        memoId,
        memoNo,
        reservedDelta,
        usedDelta,
        remainingDelta,
        setActive: after.remaining > 0 && row.status === "EXHAUSTED",
      });
    }
  }
  const creditMoves = (p) =>
    p.credit &&
    ["remaining", "reserved", "used"].some(
      (k) => p.credit.before[k] !== p.credit.after[k],
    );
  if (!options.adjustCredits && memoPlans.some(creditMoves)) {
    warnings.push(
      "Memo hours will NOT be moved (Adjust memo hours is off). Memos may no longer match this application.",
    );
  }
  if (memoPlans.some((p) => p.action !== "unchanged")) {
    const describe = (list) =>
      list
        .map(
          (m) =>
            `${ctx.creditsById.get(m.memoId)?.memoNo || m.memoId}: ${m.appliedHours}h`,
        )
        .join(", ");
    change("memo", "Memo hours", describe(oldAlloc), describe(newAlloc));
  }

  /* ---------- balance ---------- */
  const deductBefore = balanceDeductionOf(statusBefore, hoursBefore);
  const deductAfter = balanceDeductionOf(statusAfter, hoursAfter);
  const balanceDelta = round2(deductBefore - deductAfter);
  let balance = null;
  if (balanceDelta !== 0) {
    const current = round2(ctx.employee?.balances?.ctoHours || 0);
    const after = round2(current + (options.adjustBalance ? balanceDelta : 0));
    balance = {
      current,
      delta: balanceDelta,
      after,
      applied: options.adjustBalance,
    };
    if (options.adjustBalance && after < 0) {
      const msg = `${fullName(ctx.employee) || "The employee"}'s CTO balance would go below zero (${current} → ${after}).`;
      if (options.force) warnings.push(`${msg} Allowed because "Force" is on.`);
      else errors.push(`${msg} Turn on "Force" to allow it.`);
    }
    if (!options.adjustBalance) {
      warnings.push(
        "The CTO balance will NOT be adjusted (Adjust balance is off). Recalculate it later if needed.",
      );
    }
  }

  /* ---------- approval steps ---------- */
  const oldSteps = [...steps]
    .map((s) => ({
      _id: String(s._id),
      level: Number(s.level) || 0,
      approver: idOf(s.approver),
      role: s.role,
      status: s.status || "PENDING",
      remarks: s.remarks || "",
      reviewedAt: s.reviewedAt || null,
      approverSignature: s.approverSignature || null,
    }))
    .sort((a, b) => a.level - b.level);
  const oldStepById = new Map(oldSteps.map((s) => [s._id, s]));
  const stepInputs =
    payload.approvals === undefined ? oldSteps : payload.approvals;
  const stepPlans = [];
  const stepUpserts = [];
  const keptStepIds = new Set();

  if (!Array.isArray(stepInputs) || stepInputs.length === 0) {
    errors.push("At least one approver is required.");
  } else {
    const seenApprovers = new Set();
    stepInputs.forEach((input, index) => {
      const label = `Approver #${index + 1}`;
      if (!input || typeof input !== "object") {
        errors.push(`${label}: invalid row.`);
        return;
      }
      const stepId = input._id ? String(input._id) : null;
      const old = stepId ? oldStepById.get(stepId) : null;
      if (stepId && !old) {
        errors.push(`${label}: this step does not belong to this application.`);
        return;
      }
      if (stepId) keptStepIds.add(stepId);

      const approverId = idOf(input.approver ?? old?.approver);
      const keptSameApprover = Boolean(old) && old.approver === approverId;
      const approver =
        ctx.peopleById.get(approverId) ||
        (keptSameApprover
          ? { _id: approverId, firstName: "Unknown", lastName: "approver" }
          : null);
      if (!isObjectIdString(approverId) || !approver) {
        errors.push(`${label}: pick a valid approver.`);
        return;
      }
      if (approverId === applicantId)
        warnings.push(`${label}: ${fullName(approver)} is the applicant.`);
      if (seenApprovers.has(approverId))
        warnings.push(
          `${fullName(approver)} appears more than once as an approver.`,
        );
      seenApprovers.add(approverId);

      const role =
        input.role !== undefined ? sanitizeString(input.role, 60) : old?.role;
      if (!role || !APPROVAL_ROLE_VALUES.includes(role)) {
        errors.push(
          `${label}: role must be one of ${APPROVAL_ROLE_VALUES.join(", ")}.`,
        );
        return;
      }
      const status = sanitizeString(
        input.status ?? old?.status ?? "PENDING",
        20,
      ).toUpperCase();
      if (!STEP_STATUS_VALUES.includes(status)) {
        errors.push(
          `${label}: status must be one of ${STEP_STATUS_VALUES.join(", ")}.`,
        );
        return;
      }
      const remarks =
        input.remarks !== undefined
          ? sanitizeString(input.remarks, 1000)
          : old?.remarks || "";

      let reviewedAt = old?.reviewedAt || null;
      if (input.reviewedAt !== undefined) {
        if (input.reviewedAt === null || input.reviewedAt === "")
          reviewedAt = null;
        else {
          const d = parseDate(input.reviewedAt);
          if (!d) {
            errors.push(`${label}: reviewed date is not valid.`);
            return;
          }
          reviewedAt = d;
        }
      }
      const statusChanged = !old || old.status !== status;
      if (status === "PENDING") {
        if (statusChanged) reviewedAt = null;
      } else if (!reviewedAt && statusChanged) {
        reviewedAt = now;
      }

      const level = index + 1;
      const approverChanged = Boolean(old) && old.approver !== approverId;
      const data = { level, approver: approverId, role, status, remarks };
      if (STEP_HAS.reviewedAt) data.reviewedAt = reviewedAt;
      if (STEP_HAS.snapshot && (!old || approverChanged))
        data.approverSnapshot = snapshotFromPerson(approver);
      if (STEP_HAS.signature) {
        if (status === "APPROVED") {
          const needsNewSignature = statusChanged || approverChanged;
          data.approverSignature = needsNewSignature
            ? approver.signature || null
            : old.approverSignature;
          if (needsNewSignature && !data.approverSignature) {
            warnings.push(
              `${label}: ${fullName(approver)} has no signature on file.`,
            );
          }
        } else {
          data.approverSignature = statusChanged
            ? null
            : old?.approverSignature || null;
        }
      }

      const changes = [];
      if (old) {
        if (old.level !== level)
          changes.push({ field: "level", from: old.level, to: level });
        if (approverChanged)
          changes.push({
            field: "approver",
            from: nameOf(old.approver),
            to: fullName(approver),
          });
        if (old.role !== role)
          changes.push({ field: "role", from: old.role, to: role });
        if (old.status !== status)
          changes.push({ field: "status", from: old.status, to: status });
        if ((old.remarks || "") !== remarks)
          changes.push({
            field: "remarks",
            from: old.remarks || "",
            to: remarks,
          });
        if (!sameTime(old.reviewedAt, reviewedAt) && old.status === status) {
          changes.push({
            field: "reviewedAt",
            from: old.reviewedAt,
            to: reviewedAt,
          });
        }
      }
      const action = !old ? "added" : changes.length ? "updated" : "unchanged";
      stepPlans.push({
        stepId: old?._id || null,
        level,
        approver: { _id: approverId, name: fullName(approver) },
        role,
        status,
        action,
        changes,
      });
      stepUpserts.push({
        _id: old?._id || null,
        data,
        changed: action !== "unchanged",
      });
    });
  }
  const removedStepIds = [];
  if (payload.approvals !== undefined && Array.isArray(payload.approvals)) {
    for (const old of oldSteps) {
      if (keptStepIds.has(old._id)) continue;
      removedStepIds.push(old._id);
      stepPlans.push({
        stepId: old._id,
        level: old.level,
        approver: { _id: old.approver, name: nameOf(old.approver) },
        role: old.role,
        status: old.status,
        action: "removed",
        changes: [],
      });
    }
  }
  const orderChanged =
    stepUpserts.length !== oldSteps.length ||
    stepUpserts.some((s, i) => s._id !== (oldSteps[i]?._id || null));

  // Do the steps agree with the overall status?
  const finalSteps = stepPlans
    .filter((p) => p.action !== "removed")
    .sort((a, b) => a.level - b.level);
  if (finalSteps.length) {
    const notApproved = finalSteps.filter((s) => s.status !== "APPROVED");
    const firstPending = finalSteps.findIndex((s) => s.status === "PENDING");
    if (
      ["APPROVED", "REVOCATION_REQUESTED", "REVOKED"].includes(statusAfter) &&
      notApproved.length
    ) {
      warnings.push(
        `Status is ${statusAfter}, but ${notApproved.map((s) => `level ${s.level}`).join(", ")} ${notApproved.length > 1 ? "are" : "is"} not approved.`,
      );
    }
    if (statusAfter === "PENDING") {
      if (firstPending === -1)
        warnings.push(
          "Status is PENDING, but no approver step is waiting, so nobody can act on it.",
        );
      if (finalSteps.some((s) => s.status === "REJECTED"))
        warnings.push("Status is PENDING, but a step is REJECTED.");
    }
    if (
      statusAfter === "REJECTED" &&
      !finalSteps.some((s) => s.status === "REJECTED")
    ) {
      warnings.push("Status is REJECTED, but no step is marked REJECTED.");
    }
    if (
      ["REJECTED", "CANCELLED"].includes(statusAfter) &&
      finalSteps.some((s) => s.status === "PENDING")
    ) {
      warnings.push(
        `Status is ${statusAfter}, but some steps are still PENDING and would appear in approvers' queues.`,
      );
    }
    if (
      firstPending !== -1 &&
      finalSteps.slice(firstPending + 1).some((s) => s.status === "APPROVED")
    ) {
      warnings.push("A step is APPROVED after a step that is still PENDING.");
    }
  }

  /* ---------- notified employees ---------- */
  const approverIdsAfter = new Set(stepUpserts.map((s) => s.data.approver));
  const notifiedBefore = (app.notifiedEmployees || []).map(idOf);
  let notifiedAfter = notifiedBefore;
  if (payload.notifiedEmployees !== undefined) {
    if (!Array.isArray(payload.notifiedEmployees)) {
      errors.push("Notified employees must be a list.");
    } else {
      const list = [];
      payload.notifiedEmployees.forEach((raw, i) => {
        const id = idOf(raw);
        const known = ctx.peopleById.has(id) || notifiedBefore.includes(id);
        if (!isObjectIdString(id) || !known) {
          errors.push(`Notified employee #${i + 1} was not found.`);
          return;
        }
        if (id === applicantId) {
          warnings.push(
            `${nameOf(id)} is the applicant and was left out of the notified list.`,
          );
          return;
        }
        if (approverIdsAfter.has(id)) {
          warnings.push(
            `${nameOf(id)} is an approver and was left out of the notified list.`,
          );
          return;
        }
        if (!list.includes(id)) list.push(id);
      });
      notifiedAfter = list;
    }
  }
  const notifiedChanged = notifiedAfter.join(",") !== notifiedBefore.join(",");
  if (notifiedChanged) {
    set.notifiedEmployees = notifiedAfter;
    change(
      "notifiedEmployees",
      "Notified employees",
      notifiedBefore.map(nameOf),
      notifiedAfter.map(nameOf),
    );
  }

  /* ---------- revocation details ---------- */
  let revocationHistoryEntry = null;
  const rev =
    payload.revocation && typeof payload.revocation === "object"
      ? payload.revocation
      : {};
  if (statusAfter === "REVOKED") {
    const reasonIn =
      rev.revokeReason !== undefined
        ? sanitizeString(rev.revokeReason, 1000)
        : undefined;
    if (statusBefore !== "REVOKED") {
      set.revokedBy = userId || null;
      set.revokedAt = now;
      set.revokeReason = reasonIn || app.revokeReason || "Revoked by admin.";
      change(
        "revokeReason",
        "Revoke reason",
        app.revokeReason || null,
        set.revokeReason,
      );
    } else if (
      reasonIn !== undefined &&
      reasonIn !== (app.revokeReason || "")
    ) {
      set.revokeReason = reasonIn;
      change(
        "revokeReason",
        "Revoke reason",
        app.revokeReason || null,
        reasonIn,
      );
    }
  } else if (statusBefore === "REVOKED") {
    unset.push("revokedBy", "revokedAt", "revokeReason");
  }
  if (
    statusBefore === "REVOCATION_REQUESTED" &&
    !["REVOCATION_REQUESTED", "REVOKED"].includes(statusAfter)
  ) {
    if (app.revocationRequest?.reason || app.revocationRequest?.requestedAt) {
      revocationHistoryEntry = {
        reason: app.revocationRequest.reason,
        attachment: app.revocationRequest.attachment,
        requestedAt: app.revocationRequest.requestedAt,
        status: "CANCELLED",
        processedBy: userId || undefined,
        remarks: "Revocation request closed by an admin edit.",
        processedAt: now,
      };
    }
    unset.push("revocationRequest");
  }
  if (statusAfter === "REVOCATION_REQUESTED") {
    const reasonIn =
      rev.requestReason !== undefined
        ? sanitizeString(rev.requestReason, 1000)
        : undefined;
    if (statusBefore !== "REVOCATION_REQUESTED") {
      const reason = reasonIn || app.revocationRequest?.reason;
      if (!reason)
        errors.push(
          "A revocation request reason is required to set the status to REVOCATION_REQUESTED.",
        );
      else {
        set.revocationRequest = { reason, requestedAt: now };
        if (app.revocationRequest?.attachment?.fileUrl)
          set.revocationRequest.attachment = app.revocationRequest.attachment;
      }
    } else if (reasonIn && reasonIn !== app.revocationRequest?.reason) {
      set["revocationRequest.reason"] = reasonIn;
      change(
        "revocationRequest.reason",
        "Revocation reason",
        app.revocationRequest?.reason || null,
        reasonIn,
      );
    }
  }

  const stepsChanged =
    removedStepIds.length > 0 ||
    orderChanged ||
    stepPlans.some((p) => p.action !== "unchanged");
  const memoChanged = memoPlans.some((p) => p.action !== "unchanged");
  const hasChanges =
    Object.keys(set).length > 0 ||
    unset.length > 0 ||
    stepsChanged ||
    memoChanged ||
    creditOps.length > 0;

  return {
    valid: errors.length === 0,
    hasChanges,
    errors,
    warnings,
    options,
    status: { from: statusBefore, to: statusAfter },
    hours: { from: hoursBefore, to: hoursAfter },
    fields: fieldChanges,
    memo: memoPlans,
    steps: stepPlans.sort(
      (a, b) =>
        (a.action === "removed") - (b.action === "removed") ||
        a.level - b.level,
    ),
    balance,
    next: {
      set,
      unset,
      memo: newAlloc,
      memoChanged: memoProvided && memoChanged,
      steps: {
        upserts: stepUpserts,
        removeIds: removedStepIds,
        changed: stepsChanged,
      },
      creditOps,
      balanceDelta: options.adjustBalance ? balanceDelta : 0,
      revocationHistoryEntry,
    },
  };
}

function toPublicPlan(plan) {
  const { next, ...rest } = plan; // eslint-disable-line no-unused-vars
  return rest;
}

function buildHistoryEntry(plan, userId, editReason) {
  return {
    editedBy: userId,
    editedAt: new Date(),
    reason: editReason || undefined,
    changes: {
      fields: plan.fields.map((f) => ({
        field: f.field,
        label: f.label,
        from: f.from,
        to: f.to,
      })),
      memo: plan.memo
        .filter((m) => m.action !== "unchanged")
        .map((m) => ({
          memoId: m.memoId,
          memoNo: m.memoNo,
          action: m.action,
          fromHours: m.fromHours,
          toHours: m.toHours,
        })),
      steps: plan.steps
        .filter((s) => s.action !== "unchanged")
        .map((s) => ({
          level: s.level,
          approver: s.approver,
          action: s.action,
          changes: s.changes,
        })),
      balance: plan.balance,
      options: plan.options,
    },
  };
}

/* =========================================================================
   CONTEXT LOADER
========================================================================= */

async function loadEditContext(applicationId, payload, session) {
  const appQuery = CtoApplication.findById(applicationId);
  if (session) appQuery.session(session);
  const app = await appQuery;
  if (!app) throw createServiceError("CTO application not found.", 404);

  const applicantId = idOf(app.employee);

  const stepQuery = ApprovalStep.find({
    _id: { $in: app.approvals || [] },
  }).lean();
  if (session) stepQuery.session(session);
  const steps = await stepQuery;

  // people: applicant, current + proposed approvers, current + proposed notified employees
  const approverInputs = Array.isArray(payload.approvals)
    ? payload.approvals.map((a) => idOf(a?.approver))
    : [];
  const notifiedInputs = Array.isArray(payload.notifiedEmployees)
    ? payload.notifiedEmployees.map(idOf)
    : [];
  const peopleIds = [
    ...new Set([
      applicantId,
      ...steps.map((s) => idOf(s.approver)),
      ...(app.notifiedEmployees || []).map(idOf),
      ...approverInputs,
      ...notifiedInputs,
    ]),
  ].filter(isObjectIdString);
  const peopleQuery = Employee.find({ _id: { $in: peopleIds } })
    .select(`${PERSON_FIELDS} signature balances.ctoHours`)
    .lean();
  if (session) peopleQuery.session(session);

  // memo credits: current + proposed
  const memoInputs = Array.isArray(payload.memo)
    ? payload.memo.map((m) => idOf(m?.memoId))
    : [];
  const memoIds = [
    ...new Set([...(app.memo || []).map((m) => idOf(m.memoId)), ...memoInputs]),
  ].filter(isObjectIdString);
  const creditQuery = CtoCredit.find({ _id: { $in: memoIds } })
    .select("memoNo uploadedMemo status employees dateApproved")
    .lean();
  if (session) creditQuery.session(session);

  // other applications of the same employee that could share dates
  const keys = Array.isArray(payload.inclusiveDates)
    ? payload.inclusiveDates.map(dayKey).filter(Boolean)
    : (app.inclusiveDates || []).map(dayKey).filter(Boolean);
  let overlapQuery = null;
  if (keys.length) {
    const sorted = [...keys].sort();
    const from = parseDate(sorted[0]);
    const to = parseDate(sorted[sorted.length - 1]);
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() + 2);
    overlapQuery = CtoApplication.find({
      _id: { $ne: app._id },
      employee: toObjectId(applicantId),
      overallStatus: { $in: DATE_BLOCKING_STATUSES },
      inclusiveDates: { $elemMatch: { $gte: from, $lt: to } },
    })
      .select("overallStatus inclusiveDates")
      .lean();
    if (session) overlapQuery.session(session);
  }

  const [people, credits, overlaps] = await Promise.all([
    peopleQuery,
    creditQuery,
    overlapQuery || Promise.resolve([]),
  ]);

  const peopleById = new Map(people.map((p) => [String(p._id), p]));
  return {
    app,
    steps,
    ctx: {
      employee: peopleById.get(applicantId) || null,
      peopleById,
      creditsById: new Map(credits.map((c) => [String(c._id), c])),
      overlaps,
    },
  };
}

/* =========================================================================
   PUBLIC SERVICE METHODS
========================================================================= */

/** Employee search (applicants, approvers, notified employees). */
async function searchEmployees({ q, limit, employeeType } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const conditions = [];
  const text = sanitizeString(q, 100);
  if (text) conditions.push(buildEmployeeSearchFilter(text));
  const type = sanitizeString(employeeType, 50);
  if (type) conditions.push({ employeeType: type });

  const select = [
    ...new Set([
      ...PERSON_FIELDS.split(" "),
      "balances.ctoHours",
      ...getSearchableEmployeeFields(),
    ]),
  ].join(" ");
  const employees = await Employee.find(
    conditions.length ? { $and: conditions } : {},
  )
    .select(select)
    .sort({ lastName: 1, firstName: 1 })
    .limit(lim)
    .lean();

  return {
    results: employees.map((e) => ({
      ...brief(e),
      middleName: e.middleName,
      prefixTitle: e.prefixTitle,
      ctoBalance: round2(e.balances?.ctoHours || 0),
    })),
  };
}

/**
 * Paginated application list.
 * search: employee name / email / position / division, application ID, or memo number.
 * from/to: leave dates (inclusiveDates). filedFrom/filedTo: date filed (createdAt).
 */
async function listApplications({
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
} = {}) {
  const pg = parsePagination(page, limit);
  const filter = {};

  const s = sanitizeString(status, 30).toUpperCase();
  if (s) {
    if (!APP_STATUS_VALUES.includes(s))
      throw createServiceError("Invalid status filter.", 400);
    filter.overallStatus = s;
  }
  if (employeeId) {
    assertObjectId(employeeId, "employeeId");
    filter.employee = toObjectId(employeeId);
  }
  const type = sanitizeString(employeeType, 20);
  if (type) {
    if (!EMPLOYEE_TYPES.includes(type))
      throw createServiceError("Invalid employee type filter.", 400);
    filter.employeeType = type;
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
    if (b) {
      const end = new Date(b);
      end.setHours(23, 59, 59, 999);
      r.$lte = end;
    }
    return r;
  };
  const leaveRange = range(from, to, "");
  if (leaveRange) filter.inclusiveDates = { $elemMatch: leaveRange };
  const filedRange = range(filedFrom, filedTo, "filed");
  if (filedRange) filter.createdAt = filedRange;

  const q = sanitizeString(search, 100);
  if (q) {
    const [people, memos] = await Promise.all([
      Employee.find(buildEmployeeSearchFilter(q))
        .select("_id")
        .limit(1000)
        .lean(),
      CtoCredit.find({ memoNo: { $regex: escapeRegex(q), $options: "i" } })
        .select("_id")
        .limit(500)
        .lean(),
    ]);
    const or = [{ employee: { $in: people.map((p) => p._id) } }];
    if (memos.length)
      or.push({ "memo.memoId": { $in: memos.map((m) => m._id) } });
    if (isObjectIdString(q)) or.push({ _id: toObjectId(q) });
    filter.$or = or;
  }

  const [total, items, statusAgg] = await Promise.all([
    CtoApplication.countDocuments(filter),
    CtoApplication.find(filter)
      .select(
        "employee employeeType requestedHours inclusiveDates reason overallStatus memo approvals createdAt updatedAt lateFiling applicantSnapshot",
      )
      .populate("employee", PERSON_FIELDS)
      .populate({
        path: "approvals",
        select: "level status approver role",
        populate: { path: "approver", select: "firstName lastName" },
      })
      .populate("memo.memoId", "memoNo")
      .sort(parseSort(sort))
      .skip(pg.skip)
      .limit(pg.limit)
      .lean(),
    CtoApplication.aggregate([
      { $group: { _id: "$overallStatus", count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts = {
    ALL: 0,
    ...Object.fromEntries(APP_STATUS_VALUES.map((v) => [v, 0])),
  };
  statusAgg.forEach((r) => {
    if (r._id in statusCounts) statusCounts[r._id] = r.count;
    statusCounts.ALL += r.count;
  });

  return {
    items: items.map((app) => {
      const steps = [...(app.approvals || [])].sort(
        (a, b) => a.level - b.level,
      );
      const waiting = steps.find((st) => st.status === "PENDING");
      return {
        _id: app._id,
        employee: app.employee ? brief(app.employee) : null,
        applicantSnapshot: app.applicantSnapshot,
        employeeType: app.employeeType,
        requestedHours: app.requestedHours,
        inclusiveDates: app.inclusiveDates,
        reason: app.reason,
        overallStatus: app.overallStatus,
        isLateFiling: Boolean(app.lateFiling?.isLateFiling),
        memos: (app.memo || []).map((m) => ({
          memoNo: m.memoId?.memoNo || null,
          appliedHours: m.appliedHours,
        })),
        approvalProgress: {
          total: steps.length,
          approved: steps.filter((st) => st.status === "APPROVED").length,
          waitingOn: waiting
            ? { level: waiting.level, name: fullName(waiting.approver) || null }
            : null,
        },
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      };
    }),
    total,
    page: pg.page,
    limit: pg.limit,
    totalPages: Math.max(Math.ceil(total / pg.limit), 1),
    statusCounts,
  };
}

/** One application, ready for the edit form. */
async function getApplicationForEdit(applicationId) {
  assertObjectId(applicationId, "applicationId");

  const query = CtoApplication.findById(applicationId);
  if (HAS_EDIT_HISTORY) query.select("+adminEditHistory");
  const app = await query.lean();
  if (!app) throw createServiceError("CTO application not found.", 404);

  const applicantId = idOf(app.employee);
  const steps = await ApprovalStep.find({
    _id: { $in: app.approvals || [] },
  }).lean();
  steps.sort((a, b) => (a.level || 0) - (b.level || 0));

  const history = HAS_EDIT_HISTORY ? app.adminEditHistory || [] : [];
  const peopleIds = [
    ...new Set(
      [
        applicantId,
        ...steps.map((s) => idOf(s.approver)),
        ...(app.notifiedEmployees || []).map(idOf),
        idOf(app.revokedBy),
        ...history.map((h) => idOf(h.editedBy)),
        ...(app.revocationHistory || []).map((h) => idOf(h.processedBy)),
      ].filter(Boolean),
    ),
  ].filter(isObjectIdString);

  const memoIds = (app.memo || [])
    .map((m) => idOf(m.memoId))
    .filter(isObjectIdString);
  const keys = (app.inclusiveDates || []).map(dayKey).filter(Boolean).sort();
  let overlapFrom = null;
  let overlapTo = null;
  if (keys.length) {
    overlapFrom = parseDate(keys[0]);
    overlapFrom.setDate(overlapFrom.getDate() - 1);
    overlapTo = parseDate(keys[keys.length - 1]);
    overlapTo.setDate(overlapTo.getDate() + 2);
  }

  const [people, credits, overlaps] = await Promise.all([
    Employee.find({ _id: { $in: peopleIds } })
      .select(`${PERSON_FIELDS} balances.ctoHours`)
      .lean(),
    CtoCredit.find({ _id: { $in: memoIds } })
      .select(
        "memoNo uploadedMemo status dateApproved inclusiveDates purpose employees",
      )
      .lean(),
    keys.length
      ? CtoApplication.find({
          _id: { $ne: app._id },
          employee: toObjectId(applicantId),
          overallStatus: { $in: DATE_BLOCKING_STATUSES },
          inclusiveDates: { $elemMatch: { $gte: overlapFrom, $lt: overlapTo } },
        })
          .select("overallStatus inclusiveDates requestedHours")
          .lean()
      : Promise.resolve([]),
  ]);

  const byId = new Map(people.map((p) => [String(p._id), p]));
  const creditsById = new Map(credits.map((c) => [String(c._id), c]));
  const mine = new Set(keys);
  const applicant = byId.get(applicantId);

  return {
    ...app,
    employee: applicantId,
    employeeInfo: applicant
      ? {
          ...brief(applicant),
          ctoBalance: round2(applicant.balances?.ctoHours || 0),
        }
      : null,
    memo: (app.memo || []).map((m) => {
      const credit = creditsById.get(idOf(m.memoId));
      const row = credit ? creditRowOf(credit, applicantId) : null;
      return {
        ...m,
        memoId: idOf(m.memoId),
        credit: credit
          ? {
              _id: credit._id,
              memoNo: credit.memoNo,
              status: credit.status,
              dateApproved: credit.dateApproved,
              inclusiveDates: credit.inclusiveDates,
              purpose: credit.purpose,
              uploadedMemo: credit.uploadedMemo,
              row: row ? rowHours(row) : null,
            }
          : null,
      };
    }),
    approvals: steps.map((s) => ({
      ...s,
      approver: idOf(s.approver),
      approverInfo: brief(byId.get(idOf(s.approver))) || null,
    })),
    notifiedEmployees: (app.notifiedEmployees || []).map(idOf),
    notifiedInfo: (app.notifiedEmployees || []).map(
      (id) =>
        brief(byId.get(idOf(id))) || {
          _id: idOf(id),
          fullName: "Unknown employee",
        },
    ),
    revokedByInfo: app.revokedBy ? brief(byId.get(idOf(app.revokedBy))) : null,
    revocationHistory: (app.revocationHistory || []).map((h) => ({
      ...h,
      processedByInfo: brief(byId.get(idOf(h.processedBy))),
    })),
    adminEditHistory: history
      .slice()
      .sort((a, b) => new Date(b.editedAt) - new Date(a.editedAt))
      .map((h) => ({
        ...h,
        editedBy: brief(byId.get(idOf(h.editedBy))) || {
          _id: h.editedBy,
          fullName: "Unknown user",
        },
      })),
    hoursRule: {
      creditBucket: CREDIT_BUCKET_BY_STATUS[app.overallStatus] ?? null,
      deductsBalance: STATUSES_THAT_DEDUCT_BALANCE.has(app.overallStatus),
      byStatus: CREDIT_BUCKET_BY_STATUS,
      deductingStatuses: [...STATUSES_THAT_DEDUCT_BALANCE],
    },
    overlaps: overlaps
      .map((o) => ({
        _id: o._id,
        overallStatus: o.overallStatus,
        requestedHours: o.requestedHours,
        sharedDates: [
          ...new Set(
            (o.inclusiveDates || []).map(dayKey).filter((k) => mine.has(k)),
          ),
        ],
      }))
      .filter((o) => o.sharedDates.length),
    approvalRoles: APPROVAL_ROLE_VALUES,
  };
}

/** An employee's CTO memos, for picking where an application's hours come from. */
async function listEmployeeCredits(employeeId, { applicationId } = {}) {
  assertObjectId(employeeId, "employeeId");
  let allocation = new Map();
  if (applicationId) {
    assertObjectId(applicationId, "applicationId");
    const app = await CtoApplication.findById(applicationId)
      .select("memo employee")
      .lean();
    if (app && idOf(app.employee) === String(employeeId)) {
      allocation = new Map(
        (app.memo || []).map((m) => [
          idOf(m.memoId),
          round2(m.appliedHours || 0),
        ]),
      );
    }
  }

  const credits = await CtoCredit.find({
    "employees.employee": toObjectId(employeeId),
  })
    .select(
      "memoNo uploadedMemo status dateApproved inclusiveDates purpose employees createdAt",
    )
    .sort({ dateApproved: -1, createdAt: -1 })
    .limit(300)
    .lean();

  return {
    credits: credits.map((c) => {
      const row = creditRowOf(c, employeeId);
      return {
        _id: c._id,
        memoNo: c.memoNo,
        status: c.status,
        dateApproved: c.dateApproved,
        inclusiveDates: c.inclusiveDates,
        purpose: c.purpose,
        uploadedMemo: c.uploadedMemo,
        row: row ? rowHours(row) : null,
        appliedByThisApplication: allocation.get(String(c._id)) || 0,
        usable: c.status === "CREDITED" && row?.status !== ROLLEDBACK,
      };
    }),
  };
}

/** Dry run of updateApplication: the full plan including errors, nothing saved. */
async function previewApplicationUpdate(applicationId, payload = {}, userId) {
  assertObjectId(applicationId, "applicationId");
  const { app, steps, ctx } = await loadEditContext(
    applicationId,
    payload,
    null,
  );
  const plan = buildEditPlan({ app, steps, payload, ctx, userId });

  const expected = parseDate(payload.expectedUpdatedAt);
  if (
    expected &&
    app.updatedAt &&
    expected.getTime() !== app.updatedAt.getTime()
  ) {
    plan.warnings.unshift(
      "Someone changed this application after you opened it. Saving will be refused — reload it first.",
    );
  }
  return toPublicPlan(plan);
}

/**
 * Saves an admin edit atomically: application fields, approval steps, memo
 * hours, the employee's CTO balance and the edit log. No notifications are sent.
 */
async function updateApplication(applicationId, payload = {}, userId) {
  assertObjectId(applicationId, "applicationId");
  assertObjectId(userId, "userId");
  const editReason = sanitizeString(payload.editReason, 500);

  let plan = null;
  let before = null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { app, steps, ctx } = await loadEditContext(
        applicationId,
        payload,
        session,
      );

      const expected = parseDate(payload.expectedUpdatedAt);
      if (
        expected &&
        app.updatedAt &&
        expected.getTime() !== app.updatedAt.getTime()
      ) {
        throw createServiceError(
          "This application was changed by someone else after you opened it. Reload it and apply your edits again.",
          409,
        );
      }

      before = { ...app.toObject(), approvalSteps: steps };
      plan = buildEditPlan({
        app,
        steps,
        payload,
        ctx,
        userId,
        now: new Date(),
      });
      if (!plan.valid) {
        const extra =
          plan.errors.length > 1 ? ` (+${plan.errors.length - 1} more)` : "";
        throw createServiceError(`${plan.errors[0]}${extra}`, 400, plan.errors);
      }
      if (!plan.hasChanges) return;

      const { next } = plan;
      const employeeId = toObjectId(idOf(app.employee));

      /* approval steps */
      if (next.steps.changed) {
        if (next.steps.removeIds.length) {
          await ApprovalStep.deleteMany(
            { _id: { $in: next.steps.removeIds.map(toObjectId) } },
            { session },
          );
        }
        const orderedIds = [];
        const toInsert = [];
        for (const step of next.steps.upserts) {
          if (step._id) {
            orderedIds.push(toObjectId(step._id));
            if (step.changed) {
              const $set = {};
              const $unset = {};
              Object.entries(step.data).forEach(([k, v]) => {
                if (v === null || v === undefined) $unset[k] = "";
                else $set[k] = v;
              });
              const update = {};
              if (Object.keys($set).length) update.$set = $set;
              if (Object.keys($unset).length) update.$unset = $unset;
              if (Object.keys(update).length) {
                await ApprovalStep.updateOne(
                  { _id: toObjectId(step._id) },
                  update,
                  { session },
                );
              }
            }
          } else {
            const data = Object.fromEntries(
              Object.entries(step.data).filter(
                ([, v]) => v !== null && v !== undefined,
              ),
            );
            const doc = new ApprovalStep({
              ...data,
              ...(STEP_HAS.ctoApplication ? { ctoApplication: app._id } : {}),
            });
            toInsert.push(doc);
            orderedIds.push(doc._id);
          }
        }
        if (toInsert.length)
          await ApprovalStep.insertMany(toInsert, { session });
        app.approvals = orderedIds;
      }

      /* application fields */
      Object.entries(next.set).forEach(([path, value]) => app.set(path, value));
      next.unset.forEach((path) => app.set(path, undefined));
      if (next.memoChanged) {
        app.memo = next.memo.map(
          ({ _id, memoId, uploadedMemo, appliedHours }) => ({
            ...(_id ? { _id } : {}),
            memoId,
            uploadedMemo,
            appliedHours,
          }),
        );
      }
      if (next.revocationHistoryEntry) {
        app.revocationHistory = app.revocationHistory || [];
        app.revocationHistory.push(next.revocationHistoryEntry);
      }
      await app.save({ session });

      /* memo hours */
      for (const op of next.creditOps) {
        const elem = { employee: employeeId };
        if (op.remainingDelta < 0)
          elem.remainingHours = { $gte: -op.remainingDelta };
        const $inc = {};
        if (op.reservedDelta)
          $inc["employees.$.reservedHours"] = op.reservedDelta;
        if (op.usedDelta) $inc["employees.$.usedHours"] = op.usedDelta;
        if (op.remainingDelta)
          $inc["employees.$.remainingHours"] = op.remainingDelta;
        const update = { $inc };
        if (op.setActive) update.$set = { "employees.$.status": "ACTIVE" };
        const res = await CtoCredit.updateOne(
          { _id: toObjectId(op.memoId), employees: { $elemMatch: elem } },
          update,
          { session },
        );
        if (!res.matchedCount) {
          throw createServiceError(
            `Memo ${op.memoNo} changed while saving. Reload and try again.`,
            409,
          );
        }
      }

      /* CTO balance */
      if (next.balanceDelta) {
        await Employee.updateOne(
          { _id: employeeId },
          { $inc: { "balances.ctoHours": next.balanceDelta } },
          { session },
        );
      }

      /* edit log */
      if (HAS_EDIT_HISTORY) {
        await CtoApplication.updateOne(
          { _id: app._id },
          {
            $push: {
              adminEditHistory: buildHistoryEntry(plan, userId, editReason),
            },
          },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  const application = await getApplicationForEdit(applicationId);
  return {
    application,
    before,
    plan: toPublicPlan(plan),
    changed: plan.hasChanges,
  };
}

/** Stored CTO balance vs. what the employee's credits add up to. */
async function getEmployeeBalanceCheck(employeeId) {
  assertObjectId(employeeId, "employeeId");
  const select = [
    ...new Set([
      ...PERSON_FIELDS.split(" "),
      "balances.ctoHours",
      ...getSearchableEmployeeFields(),
    ]),
  ].join(" ");
  const employee = await Employee.findById(employeeId).select(select).lean();
  if (!employee) throw createServiceError("Employee not found.", 404);

  const [ledger, statusAgg] = await Promise.all([
    computeCtoLedger(employeeId),
    CtoApplication.aggregate([
      { $match: { employee: toObjectId(employeeId) } },
      {
        $group: {
          _id: "$overallStatus",
          count: { $sum: 1 },
          hours: { $sum: "$requestedHours" },
        },
      },
    ]),
  ]);
  const storedBalance = round2(employee.balances?.ctoHours || 0);
  const computedBalance = expectedBalanceFromLedger(ledger);
  const applications = Object.fromEntries(
    APP_STATUS_VALUES.map((v) => [v, { count: 0, hours: 0 }]),
  );
  statusAgg.forEach((r) => {
    if (r._id in applications)
      applications[r._id] = { count: r.count, hours: round2(r.hours) };
  });

  return {
    employee: { ...brief(employee), ctoBalance: storedBalance },
    storedBalance,
    computedBalance,
    difference: round2(storedBalance - computedBalance),
    inSync: storedBalance === computedBalance,
    ledger,
    applications,
  };
}

/** Sets balances.ctoHours to what the credits add up to. */
async function recalculateEmployeeBalance(employeeId) {
  assertObjectId(employeeId, "employeeId");
  let previousBalance = 0;
  let newBalance = 0;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const employee = await Employee.findById(employeeId)
        .select("balances.ctoHours")
        .session(session)
        .lean();
      if (!employee) throw createServiceError("Employee not found.", 404);
      const ledger = await computeCtoLedger(employeeId, session);
      previousBalance = round2(employee.balances?.ctoHours || 0);
      newBalance = expectedBalanceFromLedger(ledger);
      if (previousBalance !== newBalance) {
        await Employee.updateOne(
          { _id: employeeId },
          { $set: { "balances.ctoHours": newBalance } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  const check = await getEmployeeBalanceCheck(employeeId);
  return {
    previousBalance,
    newBalance,
    changed: previousBalance !== newBalance,
    check,
  };
}

module.exports = {
  searchEmployees,
  listApplications,
  getApplicationForEdit,
  listEmployeeCredits,
  previewApplicationUpdate,
  updateApplication,
  getEmployeeBalanceCheck,
  recalculateEmployeeBalance,

  // exported for tests / reuse
  buildEditPlan,
  buildEmployeeSearchFilter,
  dayKey,
  buildDay,
  APP_STATUS,
  CREDIT_BUCKET_BY_STATUS,
  STATUSES_THAT_DEDUCT_BALANCE,
};
