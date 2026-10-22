// services/adminWellnessApplication.service.js
//
// Admin tools for Wellness Leave applications:
//   • search employees (name, email, position, division, employee ID)
//   • list / filter every wellness application
//   • load one application for editing (with its approval steps and the
//     employee's wellness credit batches)
//   • preview an edit (dry run: validation, credit batch moves, balance impact)
//   • save an edit in one transaction — every field, dates, days, overall status,
//     approval steps (add / remove / reorder / change), notified employees and
//     revocation details
//   • compare an employee's stored wellness balance with their credit batches
//     and applications, and recalculate it
//
// Admin edits are silent corrections: no emails or in-app notifications are sent.
//
// DAYS RULE — how the existing services move wellness days:
//   submit (PENDING)          → balance − days;  batches: remaining → reserved  (oldest batch first)
//   final approval (APPROVED) → batches: reserved → used                        (oldest batch first)
//   cancel / reject           → balance + days;  batches: reserved → remaining  (newest batch first)
//   revocation approved       → balance + days;  batches: used     → remaining  (newest batch first)
// (reserveWellnessDays, finalizeApprovedWellnessDays and revertReservedWellnessDays
// in services/wellnessCredit.service.js.)
// So each status says where the application's days sit in the batches
// (DAY_BUCKET_BY_STATUS) and whether they are taken off the balance
// (STATUSES_THAT_DEDUCT_BALANCE). Every admin edit just moves the difference,
// in the same batch order. If your services behave differently, change those two
// constants — everything here goes through them.
//
// An application does not record which batch its days came from, so the batches
// are treated as one pool per employee, exactly like the services above do.

const mongoose = require("mongoose");
const WellnessApplication = require("../models/wellnessApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const WellnessCredit = require("../models/wellnessCreditModel");
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

/** DAYS RULE (see header) */
const DAY_BUCKET_BY_STATUS = Object.freeze({
  PENDING: "reserved",
  APPROVED: "used",
  REVOCATION_REQUESTED: "used",
  REJECTED: null,
  CANCELLED: null,
  REVOKED: null,
});
const STATUSES_THAT_DEDUCT_BALANCE = new Set([
  "PENDING",
  "APPROVED",
  "REVOCATION_REQUESTED",
]);

/** Statuses that block another application on the same dates. */
const DATE_BLOCKING_STATUSES = ["PENDING", "APPROVED", "REVOCATION_REQUESTED"];

/** wellnessApplicationModel: totalDays min 0.5. Days go in half-day steps. */
const MIN_DAYS = 0.5;
const DAY_STEP = 0.5;
const MAX_DAYS = 366;

const CREDIT = Object.freeze({
  CREDITED: "CREDITED",
  ROLLEDBACK: "ROLLEDBACK",
  EXPIRED: "EXPIRED",
});
const ROW = Object.freeze({
  ACTIVE: "ACTIVE",
  EXHAUSTED: "EXHAUSTED",
  ROLLEDBACK: "ROLLEDBACK",
  EXPIRED: "EXPIRED",
});

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

const SORTABLE_FIELDS = new Set(["createdAt", "updatedAt", "totalDays"]);

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
    // required by wellnessApplicationModel
    path: "applicantSnapshot.middleName",
    label: "Middle name",
    type: "text",
    max: 100,
    required: true,
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
    path: "applicantSnapshot.wellnessBalance",
    label: "Wellness balance at filing",
    type: "number",
    min: 0,
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
const HAS_EDIT_HISTORY = hasPath(WellnessApplication, "adminEditHistory");
const STEP_HAS = {
  signature: hasPath(ApprovalStep, "approverSignature"),
  snapshot: hasPath(ApprovalStep, "approverSnapshot"),
  // the wellness submit service stores the signature inside the snapshot too
  snapshotSignatureUrl: hasPath(ApprovalStep, "approverSnapshot.signatureUrl"),
  snapshotSignedAt: hasPath(ApprovalStep, "approverSnapshot.signedAt"),
  reviewedAt: hasPath(ApprovalStep, "reviewedAt"),
  wellnessApplication: hasPath(ApprovalStep, "wellnessApplication"),
};
const SNAPSHOT_KEYS = [
  "prefixTitle",
  "firstName",
  "middleName",
  "lastName",
  "nameExtension",
  "postfixTitle",
  "position",
];

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

/** { "a.b": 1, c: 2 } → { a: { b: 1 }, c: 2 } */
function expandDotted(flat) {
  const out = {};
  Object.entries(flat).forEach(([path, value]) => {
    const keys = path.split(".");
    let node = out;
    keys.slice(0, -1).forEach((k) => {
      node[k] = node[k] && typeof node[k] === "object" ? node[k] : {};
      node = node[k];
    });
    node[keys[keys.length - 1]] = value;
  });
  return out;
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

const fmtDays = (n) => `${round2(n)} day${round2(n) === 1 ? "" : "s"}`;
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "no date";

/* =========================================================================
   BALANCE RULE
========================================================================= */

/** Days of an application that are taken off balances.wellnessDays. */
function balanceDeductionOf(status, totalDays) {
  return STATUSES_THAT_DEDUCT_BALANCE.has(status) ? round2(totalDays || 0) : 0;
}

/**
 * What balances.wellnessDays should be: the remaining days on the employee's
 * non-rolled-back rows (same rule as the wellness credit admin).
 */
function expectedBalanceFromLedger(ledger) {
  return round2(ledger.remainingDays);
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
   CREDIT BATCHES (the employee's pool of wellness days)
========================================================================= */

/** One entry per batch row of this employee, in a shape the planner can use. */
function poolRowsFrom(credits, employeeId) {
  const rows = [];
  for (const c of credits || []) {
    for (const r of c.employees || []) {
      if (idOf(r.employee) !== String(employeeId)) continue;
      rows.push({
        creditId: String(c._id),
        rowId: r._id ? String(r._id) : null,
        dateApproved: c.dateApproved ? new Date(c.dateApproved) : null,
        createdAt: c.createdAt ? new Date(c.createdAt) : null,
        batchStatus: c.status || CREDIT.CREDITED,
        status: r.status || ROW.ACTIVE,
        credited: round2(r.creditedDays || 0),
        remaining: round2(r.remainingDays || 0),
        reserved: round2(r.reservedDays || 0),
        used: round2(r.usedDays || 0),
      });
    }
  }
  return rows;
}

function ledgerFromRows(rows) {
  const live = rows.filter(
    (r) => r.batchStatus !== CREDIT.ROLLEDBACK && r.status !== ROW.ROLLEDBACK,
  );
  const sum = (k) => round2(live.reduce((s, r) => s + (Number(r[k]) || 0), 0));
  return {
    batches: live.length,
    creditedDays: sum("credited"),
    usedDays: sum("used"),
    reservedDays: sum("reserved"),
    remainingDays: sum("remaining"),
  };
}

/**
 * Works out which batch rows give / take days so the pool's reserved and used
 * totals change by `reservedDelta` and `usedDelta`. Same order as the services:
 *   reserved → used (approve)     oldest batch first  (finalizeApprovedWellnessDays)
 *   take from remaining           oldest batch first, CREDITED batches, active rows
 *                                 (reserveWellnessDays)
 *   give back to remaining        newest batch first  (revertReservedWellnessDays)
 *   used → reserved (un-approve)  newest batch first
 * Pure: never touches the database.
 */
function planCreditMoves({ rows, reservedDelta, usedDelta, force = false }) {
  const errors = [];
  const warnings = [];
  const work = (rows || [])
    .filter(
      (r) => r.batchStatus !== CREDIT.ROLLEDBACK && r.status !== ROW.ROLLEDBACK,
    )
    .map((r) => ({
      ...r,
      before: {
        remaining: r.remaining,
        reserved: r.reserved,
        used: r.used,
        status: r.status,
      },
    }));
  const t = (d) => (d ? new Date(d).getTime() : 0);
  const asc = [...work].sort(
    (a, b) =>
      t(a.dateApproved) - t(b.dateApproved) ||
      t(a.createdAt) - t(b.createdAt) ||
      a.creditId.localeCompare(b.creditId),
  );
  const desc = [...asc].reverse();
  const touched = new Set();

  const move = (list, from, to, amount, eligible) => {
    let left = round2(amount);
    for (const r of list) {
      if (left <= 0) break;
      if (!eligible(r) || r[from] <= 0) continue;
      const take = round2(Math.min(r[from], left));
      r[from] = round2(r[from] - take);
      r[to] = round2(r[to] + take);
      left = round2(left - take);
      touched.add(r);
    }
    return round2(amount - left);
  };
  const anyLive = () => true;
  const finalizable = (r) =>
    r.batchStatus === CREDIT.CREDITED || r.batchStatus === CREDIT.EXPIRED;
  const reservable = (r) =>
    r.batchStatus === CREDIT.CREDITED &&
    r.status !== ROW.EXPIRED &&
    r.status !== ROW.ROLLEDBACK;
  const available = (key, eligible) =>
    round2(work.filter(eligible).reduce((s, r) => s + Math.max(r[key], 0), 0));

  let dR = round2(reservedDelta || 0);
  let dU = round2(usedDelta || 0);

  // 1. / 2. move days between reserved and used. Like finalizeApprovedWellnessDays,
  // a shortfall is never taken from remaining — it is reported instead.
  const transfer = (list, from, to, want, eligible, what) => {
    const moved = move(list, from, to, want, eligible);
    if (moved < want) {
      const msg = `The credit batches have only ${fmtDays(moved)} ${from} to ${what}; this change needs ${fmtDays(want)}.`;
      if (force)
        warnings.push(
          `${msg} Only ${fmtDays(moved)} will be moved because "Force" is on.`,
        );
      else
        errors.push(
          `${msg} The batch data looks off — turn on "Force" to move only what is there.`,
        );
    }
  };
  if (dR < 0 && dU > 0) {
    const want = round2(Math.min(-dR, dU));
    transfer(asc, "reserved", "used", want, finalizable, "mark as used");
    dR = round2(dR + want);
    dU = round2(dU - want);
  }
  if (dR > 0 && dU < 0) {
    const want = round2(Math.min(dR, -dU));
    transfer(desc, "used", "reserved", want, anyLive, "move back to reserved");
    dR = round2(dR - want);
    dU = round2(dU + want);
  }
  // 3. / 4. give days back to remaining
  for (const [key, label] of [
    ["reserved", "reserved"],
    ["used", "used"],
  ]) {
    const delta = key === "reserved" ? dR : dU;
    if (delta >= 0) continue;
    const need = -delta;
    const have = available(key, anyLive);
    if (have < need) {
      const msg = `The credit batches have only ${fmtDays(have)} ${label} to give back; this change needs ${fmtDays(need)}.`;
      if (force)
        warnings.push(
          `${msg} Only ${fmtDays(have)} will be given back because "Force" is on.`,
        );
      else
        errors.push(
          `${msg} The batch data looks off — turn on "Force" to give back only what is there.`,
        );
    }
    move(desc, key, "remaining", Math.min(need, have), anyLive);
    if (key === "reserved") dR = 0;
    else dU = 0;
  }
  // 5. / 6. take days from remaining
  const needFromRemaining = round2(Math.max(dR, 0) + Math.max(dU, 0));
  if (needFromRemaining > 0) {
    const have = available("remaining", reservable);
    if (have < needFromRemaining) {
      errors.push(
        `Not enough wellness credits: this change needs ${fmtDays(needFromRemaining)} from active credit batches, but only ${fmtDays(have)} ${have === 1 ? "is" : "are"} left. Add credits first, or turn off "Adjust credit batches".`,
      );
    }
    if (dR > 0) move(asc, "remaining", "reserved", dR, reservable);
    if (dU > 0) move(asc, "remaining", "used", dU, reservable);
  }

  // row status, the same way the services set it
  for (const r of touched) {
    if (r.remaining <= 0 && r.status === ROW.ACTIVE) r.status = ROW.EXHAUSTED;
    else if (
      r.remaining > 0 &&
      r.batchStatus !== CREDIT.EXPIRED &&
      r.status === ROW.EXHAUSTED
    )
      r.status = ROW.ACTIVE;
    const backToRemaining = round2(r.remaining - r.before.remaining);
    if (r.batchStatus === CREDIT.EXPIRED && backToRemaining > 0) {
      warnings.push(
        `${fmtDays(backToRemaining)} go back to the batch approved ${fmtDate(r.dateApproved)}, which has expired. They count in the balance but can't be used for new applications.`,
      );
    }
  }

  const moves = asc
    .filter((r) => touched.has(r))
    .map((r) => ({
      creditId: r.creditId,
      rowId: r.rowId,
      dateApproved: r.dateApproved,
      batchStatus: r.batchStatus,
      before: r.before,
      after: {
        remaining: r.remaining,
        reserved: r.reserved,
        used: r.used,
        status: r.status,
      },
      delta: {
        remaining: round2(r.remaining - r.before.remaining),
        reserved: round2(r.reserved - r.before.reserved),
        used: round2(r.used - r.before.used),
      },
    }))
    .filter(
      (m) =>
        m.delta.remaining ||
        m.delta.reserved ||
        m.delta.used ||
        m.before.status !== m.after.status,
    );

  return { moves, errors, warnings };
}

async function loadEmployeeCredits(employeeId, session) {
  const query = WellnessCredit.find({
    "employees.employee": toObjectId(employeeId),
  })
    .select("dateApproved days status employees createdAt")
    .sort({ dateApproved: -1, createdAt: -1 })
    .limit(500)
    .lean();
  if (session) query.session(session);
  return query;
}

/** Days per application status for one employee. */
async function applicationTotals(employeeId) {
  const rows = await WellnessApplication.aggregate([
    { $match: { employee: toObjectId(employeeId) } },
    {
      $group: {
        _id: "$overallStatus",
        count: { $sum: 1 },
        days: { $sum: "$totalDays" },
      },
    },
  ]);
  const totals = Object.fromEntries(
    APP_STATUS_VALUES.map((v) => [v, { count: 0, days: 0 }]),
  );
  rows.forEach((r) => {
    if (r._id in totals)
      totals[r._id] = { count: r.count, days: round2(r.days) };
  });
  return totals;
}

/**
 * Do the batches hold what the applications say?
 * reserved should equal the PENDING days, used the APPROVED + REVOCATION_REQUESTED days.
 */
function describePool(ledger, totals) {
  const expected = { reserved: 0, used: 0 };
  Object.entries(DAY_BUCKET_BY_STATUS).forEach(([status, bucket]) => {
    if (bucket)
      expected[bucket] = round2(expected[bucket] + totals[status].days);
  });
  const reservedDiff = round2(ledger.reservedDays - expected.reserved);
  const usedDiff = round2(ledger.usedDays - expected.used);
  return {
    expectedReserved: expected.reserved,
    expectedUsed: expected.used,
    reservedDays: ledger.reservedDays,
    usedDays: ledger.usedDays,
    reservedDiff,
    usedDiff,
    inSync: reservedDiff === 0 && usedDiff === 0,
  };
}

function publicCreditRow(row) {
  return {
    creditedDays: row.credited,
    usedDays: row.used,
    reservedDays: row.reserved,
    remainingDays: row.remaining,
    status: row.status,
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
  return Object.fromEntries(SNAPSHOT_KEYS.map((k) => [k, person?.[k] || ""]));
}

/**
 * Works out everything an edit would do, without touching the database.
 *
 * app     — the application (plain object or document)
 * steps   — its approval steps
 * payload — any of:
 *   reason, employeeType, commutation, totalDays, inclusiveDates: ["YYYY-MM-DD" | ISO],
 *   overallStatus, lateFiling{}, actionDetails{}, certificationOfLeaveCredits{}, applicantSnapshot{},
 *   notifiedEmployees: [id],
 *   approvals: [{ _id?, approver, role, status, remarks, reviewedAt }]   (full ordered list),
 *   revocation: { requestReason, revokeReason },
 *   options: { adjustCredits = true, adjustBalance = true, force = false }
 * ctx — { employee, peopleById, creditRows, overlaps } from loadEditContext()
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

  /* ---------- inclusive dates ---------- */
  const oldDates = (app.inclusiveDates || []).map((d) => new Date(d));
  const oldByKey = new Map(oldDates.map((d) => [dayKey(d), d]));
  const oldKeys = [...oldByKey.keys()].sort();
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
        const datesAfter = unique.map(
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

  /* ---------- total days ---------- */
  const daysBefore = round2(app.totalDays || 0);
  let daysAfter = daysBefore;
  if (payload.totalDays !== undefined) {
    const n = parseNumber(payload.totalDays);
    if (n === null || n < MIN_DAYS)
      errors.push(`Total days must be at least ${MIN_DAYS}.`);
    else if (n > MAX_DAYS)
      errors.push(`Total days cannot be more than ${MAX_DAYS}.`);
    else if (round2(n / DAY_STEP) % 1 !== 0)
      errors.push(`Total days must be in steps of ${DAY_STEP} (half days).`);
    else daysAfter = n;
  } else if (datesChanged) {
    // the submit service sets totalDays = number of dates
    daysAfter = newKeys.length;
  }
  if (daysAfter !== daysBefore) {
    set.totalDays = daysAfter;
    change("totalDays", "Total days", daysBefore, daysAfter);
  }
  if (datesChanged || daysAfter !== daysBefore) {
    if (daysAfter > newKeys.length) {
      const msg = `${fmtDays(daysAfter)} is more than the ${newKeys.length} selected date(s).`;
      if (options.force) warnings.push(`${msg} Allowed because "Force" is on.`);
      else errors.push(`${msg} Turn on "Force" to allow it.`);
    } else if (daysAfter < newKeys.length) {
      warnings.push(
        `${fmtDays(daysAfter)} for ${newKeys.length} selected date(s) — some dates count as half days.`,
      );
    }
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
      const msg = `The employee already has Wellness Leave on the same date(s): ${clashes.join("; ")}.`;
      if (options.force) warnings.push(`${msg} Allowed because "Force" is on.`);
      else errors.push(`${msg} Turn on "Force" to allow it.`);
    }
  }

  /* ---------- Organic requirements (CSC Form 6) ---------- */
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
    if (!valueAfter("commutation")) {
      set.commutation = "Not Requested";
      change("commutation", "Commutation", null, "Not Requested");
    }
  }

  /* ---------- credit batch moves ---------- */
  const bucketBefore = DAY_BUCKET_BY_STATUS[statusBefore] ?? null;
  const bucketAfter = DAY_BUCKET_BY_STATUS[statusAfter] ?? null;
  const holdBefore = {
    reserved: bucketBefore === "reserved" ? daysBefore : 0,
    used: bucketBefore === "used" ? daysBefore : 0,
  };
  const holdAfter = {
    reserved: bucketAfter === "reserved" ? daysAfter : 0,
    used: bucketAfter === "used" ? daysAfter : 0,
  };
  const reservedDelta = round2(holdAfter.reserved - holdBefore.reserved);
  const usedDelta = round2(holdAfter.used - holdBefore.used);
  const poolChanges = reservedDelta !== 0 || usedDelta !== 0;

  let creditMoves = [];
  if (poolChanges && options.adjustCredits) {
    const res = planCreditMoves({
      rows: ctx.creditRows || [],
      reservedDelta,
      usedDelta,
      force: options.force,
    });
    creditMoves = res.moves;
    errors.push(...res.errors);
    warnings.push(...res.warnings);
  } else if (poolChanges) {
    warnings.push(
      "Credit batch days will NOT be moved (Adjust credit batches is off). The batches may no longer match this application.",
    );
  }

  /* ---------- balance ---------- */
  const deductBefore = balanceDeductionOf(statusBefore, daysBefore);
  const deductAfter = balanceDeductionOf(statusAfter, daysAfter);
  const balanceDelta = round2(deductBefore - deductAfter);
  let balance = null;
  if (balanceDelta !== 0) {
    const current = round2(ctx.employee?.balances?.wellnessDays || 0);
    const after = round2(current + (options.adjustBalance ? balanceDelta : 0));
    balance = {
      current,
      delta: balanceDelta,
      after,
      applied: options.adjustBalance,
    };
    if (options.adjustBalance && after < 0) {
      const msg = `${fullName(ctx.employee) || "The employee"}'s wellness balance would go below zero (${current} → ${after}).`;
      if (options.force) warnings.push(`${msg} Allowed because "Force" is on.`);
      else errors.push(`${msg} Turn on "Force" to allow it.`);
    }
    if (!options.adjustBalance) {
      warnings.push(
        "The wellness balance will NOT be adjusted (Adjust balance is off). Recalculate it later if needed.",
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
      // dotted paths, so the signature kept inside approverSnapshot survives
      const data = { level, approver: approverId, role, status, remarks };
      if (STEP_HAS.reviewedAt) data.reviewedAt = reviewedAt;
      if (STEP_HAS.snapshot && (!old || approverChanged)) {
        Object.entries(snapshotFromPerson(approver)).forEach(([k, v]) => {
          data[`approverSnapshot.${k}`] = v;
        });
      }
      const needsNewSignature =
        status === "APPROVED" && (statusChanged || approverChanged);
      const clearsSignature = status !== "APPROVED" && statusChanged;
      if (needsNewSignature) {
        const sig = approver.signature || null;
        if (STEP_HAS.signature) data.approverSignature = sig;
        if (STEP_HAS.snapshotSignatureUrl)
          data["approverSnapshot.signatureUrl"] = sig;
        if (STEP_HAS.snapshotSignedAt)
          data["approverSnapshot.signedAt"] = reviewedAt || now;
        if (!sig)
          warnings.push(
            `${label}: ${fullName(approver)} has no signature on file.`,
          );
      } else if (clearsSignature) {
        if (STEP_HAS.signature) data.approverSignature = null;
        if (STEP_HAS.snapshotSignatureUrl)
          data["approverSnapshot.signatureUrl"] = null;
        if (STEP_HAS.snapshotSignedAt) data["approverSnapshot.signedAt"] = null;
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
  const hasChanges =
    Object.keys(set).length > 0 ||
    unset.length > 0 ||
    stepsChanged ||
    creditMoves.length > 0 ||
    Boolean(revocationHistoryEntry);

  return {
    valid: errors.length === 0,
    hasChanges,
    errors,
    warnings,
    options,
    status: { from: statusBefore, to: statusAfter },
    days: { from: daysBefore, to: daysAfter },
    fields: fieldChanges,
    credits: {
      reservedDelta,
      usedDelta,
      applied: options.adjustCredits,
      moves: creditMoves,
    },
    steps: stepPlans.sort(
      (a, b) =>
        (a.action === "removed") - (b.action === "removed") ||
        a.level - b.level,
    ),
    balance,
    next: {
      set,
      unset,
      steps: {
        upserts: stepUpserts,
        removeIds: removedStepIds,
        changed: stepsChanged,
      },
      creditMoves: options.adjustCredits ? creditMoves : [],
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
      credits: plan.credits.moves.map((m) => ({
        creditId: m.creditId,
        dateApproved: m.dateApproved,
        before: m.before,
        after: m.after,
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
  const appQuery = WellnessApplication.findById(applicationId);
  if (session) appQuery.session(session);
  const app = await appQuery;
  if (!app) throw createServiceError("Wellness application not found.", 404);

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
    .select(`${PERSON_FIELDS} signature balances.wellnessDays`)
    .lean();
  if (session) peopleQuery.session(session);

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
    overlapQuery = WellnessApplication.find({
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
    isObjectIdString(applicantId)
      ? loadEmployeeCredits(applicantId, session)
      : Promise.resolve([]),
    overlapQuery || Promise.resolve([]),
  ]);

  const peopleById = new Map(people.map((p) => [String(p._id), p]));
  return {
    app,
    steps,
    ctx: {
      employee: peopleById.get(applicantId) || null,
      peopleById,
      creditRows: poolRowsFrom(credits, applicantId),
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
      "balances.wellnessDays",
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
      wellnessBalance: round2(e.balances?.wellnessDays || 0),
    })),
  };
}

/**
 * Paginated application list.
 * search: employee name / email / position / division, or application ID.
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
    const people = await Employee.find(buildEmployeeSearchFilter(q))
      .select("_id")
      .limit(1000)
      .lean();
    const or = [{ employee: { $in: people.map((p) => p._id) } }];
    if (isObjectIdString(q)) or.push({ _id: toObjectId(q) });
    filter.$or = or;
  }

  const [total, items, statusAgg] = await Promise.all([
    WellnessApplication.countDocuments(filter),
    WellnessApplication.find(filter)
      .select(
        "employee employeeType totalDays inclusiveDates reason overallStatus approvals createdAt updatedAt lateFiling applicantSnapshot",
      )
      .populate("employee", PERSON_FIELDS)
      .populate({
        path: "approvals",
        select: "level status approver role",
        populate: { path: "approver", select: "firstName lastName" },
      })
      .sort(parseSort(sort))
      .skip(pg.skip)
      .limit(pg.limit)
      .lean(),
    WellnessApplication.aggregate([
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
        totalDays: app.totalDays,
        inclusiveDates: app.inclusiveDates,
        reason: app.reason,
        overallStatus: app.overallStatus,
        isLateFiling: Boolean(app.lateFiling?.isLateFiling),
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

/** The employee's wellness credit batches, newest first (with this employee's row). */
function describeCredits(credits, employeeId) {
  const out = [];
  for (const c of credits) {
    const row = poolRowsFrom([c], employeeId)[0];
    if (!row) continue;
    out.push({
      _id: c._id,
      dateApproved: c.dateApproved,
      days: c.days,
      status: c.status,
      row: publicCreditRow(row),
      usable:
        c.status === CREDIT.CREDITED &&
        row.status !== ROW.ROLLEDBACK &&
        row.status !== ROW.EXPIRED &&
        row.remaining > 0,
    });
  }
  return out;
}

/** One application, ready for the edit form. */
async function getApplicationForEdit(applicationId) {
  assertObjectId(applicationId, "applicationId");

  const query = WellnessApplication.findById(applicationId);
  if (HAS_EDIT_HISTORY) query.select("+adminEditHistory");
  const app = await query.lean();
  if (!app) throw createServiceError("Wellness application not found.", 404);

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
        idOf(app.certificationOfLeaveCredits?.certifiedBy),
        ...history.map((h) => idOf(h.editedBy)),
        ...(app.revocationHistory || []).map((h) => idOf(h.processedBy)),
      ].filter(Boolean),
    ),
  ].filter(isObjectIdString);

  const keys = (app.inclusiveDates || []).map(dayKey).filter(Boolean).sort();
  let overlapFrom = null;
  let overlapTo = null;
  if (keys.length) {
    overlapFrom = parseDate(keys[0]);
    overlapFrom.setDate(overlapFrom.getDate() - 1);
    overlapTo = parseDate(keys[keys.length - 1]);
    overlapTo.setDate(overlapTo.getDate() + 2);
  }

  const hasApplicant = isObjectIdString(applicantId);
  const [people, credits, overlaps, totals] = await Promise.all([
    Employee.find({ _id: { $in: peopleIds } })
      .select(`${PERSON_FIELDS} balances.wellnessDays`)
      .lean(),
    hasApplicant ? loadEmployeeCredits(applicantId) : Promise.resolve([]),
    keys.length && hasApplicant
      ? WellnessApplication.find({
          _id: { $ne: app._id },
          employee: toObjectId(applicantId),
          overallStatus: { $in: DATE_BLOCKING_STATUSES },
          inclusiveDates: { $elemMatch: { $gte: overlapFrom, $lt: overlapTo } },
        })
          .select("overallStatus inclusiveDates totalDays")
          .lean()
      : Promise.resolve([]),
    hasApplicant ? applicationTotals(applicantId) : Promise.resolve(null),
  ]);

  const byId = new Map(people.map((p) => [String(p._id), p]));
  const mine = new Set(keys);
  const applicant = byId.get(applicantId);
  const ledger = ledgerFromRows(poolRowsFrom(credits, applicantId));

  return {
    ...app,
    employee: applicantId,
    employeeInfo: applicant
      ? {
          ...brief(applicant),
          wellnessBalance: round2(applicant.balances?.wellnessDays || 0),
        }
      : null,
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
    certifiedByInfo: app.certificationOfLeaveCredits?.certifiedBy
      ? brief(byId.get(idOf(app.certificationOfLeaveCredits.certifiedBy)))
      : null,
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
    credits: describeCredits(credits, applicantId),
    pool: totals
      ? { ledger, ...describePool(ledger, totals), applications: totals }
      : null,
    daysRule: {
      creditBucket: DAY_BUCKET_BY_STATUS[app.overallStatus] ?? null,
      deductsBalance: STATUSES_THAT_DEDUCT_BALANCE.has(app.overallStatus),
      byStatus: DAY_BUCKET_BY_STATUS,
      deductingStatuses: [...STATUSES_THAT_DEDUCT_BALANCE],
    },
    overlaps: overlaps
      .map((o) => ({
        _id: o._id,
        overallStatus: o.overallStatus,
        totalDays: o.totalDays,
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

/** An employee's wellness credit batches (where an application's days sit). */
async function listEmployeeCredits(employeeId) {
  assertObjectId(employeeId, "employeeId");
  const credits = await loadEmployeeCredits(employeeId);
  const rows = poolRowsFrom(credits, employeeId);
  return {
    credits: describeCredits(credits, employeeId),
    ledger: ledgerFromRows(rows),
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
 * Saves an admin edit atomically: application fields, approval steps, credit
 * batch days, the employee's wellness balance and the edit log.
 * No notifications are sent.
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
            const data = expandDotted(
              Object.fromEntries(
                Object.entries(step.data).filter(
                  ([, v]) => v !== null && v !== undefined,
                ),
              ),
            );
            const doc = new ApprovalStep({
              ...data,
              ...(STEP_HAS.wellnessApplication
                ? { wellnessApplication: app._id }
                : {}),
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
      if (next.revocationHistoryEntry) {
        app.revocationHistory = app.revocationHistory || [];
        app.revocationHistory.push(next.revocationHistoryEntry);
      }
      await app.save({ session });

      /* credit batch days */
      for (const m of next.creditMoves) {
        const elem = m.rowId
          ? { _id: toObjectId(m.rowId) }
          : { employee: employeeId };
        // the row must still hold what the plan takes from it
        ["remaining", "reserved", "used"].forEach((k) => {
          if (m.delta[k] < 0) elem[`${k}Days`] = { $gte: -m.delta[k] - 0.001 };
        });
        const $inc = {};
        if (m.delta.remaining)
          $inc["employees.$.remainingDays"] = m.delta.remaining;
        if (m.delta.reserved)
          $inc["employees.$.reservedDays"] = m.delta.reserved;
        if (m.delta.used) $inc["employees.$.usedDays"] = m.delta.used;
        const update = {};
        if (Object.keys($inc).length) update.$inc = $inc;
        if (m.before.status !== m.after.status)
          update.$set = { "employees.$.status": m.after.status };
        if (!Object.keys(update).length) continue;
        const res = await WellnessCredit.updateOne(
          { _id: toObjectId(m.creditId), employees: { $elemMatch: elem } },
          update,
          { session },
        );
        if (!res.matchedCount) {
          throw createServiceError(
            `The credit batch approved ${fmtDate(m.dateApproved)} changed while saving. Reload and try again.`,
            409,
          );
        }
      }

      /* wellness balance */
      if (next.balanceDelta) {
        await Employee.updateOne(
          { _id: employeeId },
          { $inc: { "balances.wellnessDays": next.balanceDelta } },
          { session },
        );
      }

      /* edit log */
      if (HAS_EDIT_HISTORY) {
        await WellnessApplication.updateOne(
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

/** Stored wellness balance vs. the credit batches, plus whether the batches match the applications. */
async function getEmployeeBalanceCheck(employeeId) {
  assertObjectId(employeeId, "employeeId");
  const select = [
    ...new Set([
      ...PERSON_FIELDS.split(" "),
      "balances.wellnessDays",
      ...getSearchableEmployeeFields(),
    ]),
  ].join(" ");
  const employee = await Employee.findById(employeeId).select(select).lean();
  if (!employee) throw createServiceError("Employee not found.", 404);

  const [credits, applications] = await Promise.all([
    loadEmployeeCredits(employeeId),
    applicationTotals(employeeId),
  ]);
  const ledger = ledgerFromRows(poolRowsFrom(credits, employeeId));
  const storedBalance = round2(employee.balances?.wellnessDays || 0);
  const computedBalance = expectedBalanceFromLedger(ledger);

  return {
    employee: { ...brief(employee), wellnessBalance: storedBalance },
    storedBalance,
    computedBalance,
    difference: round2(storedBalance - computedBalance),
    inSync: storedBalance === computedBalance,
    ledger,
    applications,
    pool: describePool(ledger, applications),
  };
}

/** Sets balances.wellnessDays to the remaining days on the credit batches. */
async function recalculateEmployeeBalance(employeeId) {
  assertObjectId(employeeId, "employeeId");
  let previousBalance = 0;
  let newBalance = 0;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const employee = await Employee.findById(employeeId)
        .select("balances.wellnessDays")
        .session(session)
        .lean();
      if (!employee) throw createServiceError("Employee not found.", 404);
      const credits = await loadEmployeeCredits(employeeId, session);
      const ledger = ledgerFromRows(poolRowsFrom(credits, employeeId));
      previousBalance = round2(employee.balances?.wellnessDays || 0);
      newBalance = expectedBalanceFromLedger(ledger);
      if (previousBalance !== newBalance) {
        await Employee.updateOne(
          { _id: employeeId },
          { $set: { "balances.wellnessDays": newBalance } },
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
  planCreditMoves,
  poolRowsFrom,
  buildEmployeeSearchFilter,
  dayKey,
  buildDay,
  APP_STATUS,
  DAY_BUCKET_BY_STATUS,
  STATUSES_THAT_DEDUCT_BALANCE,
};
