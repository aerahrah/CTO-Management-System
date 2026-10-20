// services/adminWellnessCredit.service.js
//
// Admin tools for wellness credits:
//   • search employees (name, email, position…) with balance + period limit usage
//   • list and filter credit batches
//   • load one batch for editing
//   • preview an edit (dry run: validation, limit checks, balance impact)
//   • save an edit in one transaction — batch fields, every employee row,
//     adding / removing / reassigning employees, status changes
//   • compare an employee's stored balance with their credits, and recalculate it
//
// BALANCE RULE
// Employee.balances.wellnessDays is treated as the sum of `remainingDays` on the
// employee's non-rolled-back credit rows. That is how the existing service moves it:
// addCredit (+credited), rollbackCredit (-credited, only when nothing is used),
// expirePreviousYearCredits (-remaining). If your application service changes the
// balance at a different moment, edit balanceContributionOf() and
// expectedBalanceFromLedger() — every balance calculation here goes through them.

const mongoose = require("mongoose");
const WellnessCredit = require("../models/wellnessCreditModel");
const Employee = require("../models/employeeModel");

/* =========================================================================
   CONSTANTS
========================================================================= */

const CREDIT_STATUS = Object.freeze({
  CREDITED: "CREDITED",
  ROLLEDBACK: "ROLLEDBACK",
  EXPIRED: "EXPIRED",
});

const ROW_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  EXHAUSTED: "EXHAUSTED",
  ROLLEDBACK: "ROLLEDBACK",
  EXPIRED: "EXPIRED",
});

const JOB_ORDER_TYPE = "Job Order";
const CREDIT_LIMITS = Object.freeze({ JOB_ORDER: 2, DEFAULT: 5 }); // same as addCredit

// Employee fields the search can match. Only names that exist on your Employee
// schema as String paths are used, so extra entries here are harmless.
const EMPLOYEE_SEARCH_CANDIDATES = Object.freeze([
  "firstName",
  "middleName",
  "lastName",
  "email",
  "position",
  "employeeNo",
  "employeeNumber",
  "employeeId",
  "idNumber",
]);

const ROW_DIFF_FIELDS = Object.freeze([
  "employee",
  "creditedDays",
  "usedDays",
  "reservedDays",
  "remainingDays",
  "status",
  "dateCredited",
]);

const DAY_FIELD_LABELS = Object.freeze({
  creditedDays: "Credited days",
  usedDays: "Used days",
  reservedDays: "Reserved days",
});

const SORTABLE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "dateApproved",
  "days",
]);

const HAS_EDIT_HISTORY = Boolean(WellnessCredit.schema.path("editHistory"));

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
  if (!isObjectIdString(value)) {
    throw createServiceError(`Invalid ${label} format.`, 400);
  }
}

function toObjectId(value) {
  return new mongoose.Types.ObjectId(String(value));
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

/** Returns a finite number rounded to 2 decimals, or null. */
function parseNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return null;
  const n = Number(value);
  return Number.isFinite(n) ? round2(n) : null;
}

/** Accepts Date, ISO string, or "YYYY-MM-DD" (read as local midnight, like addCredit). */
function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
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

/* =========================================================================
   BALANCE RULE (see header comment)
========================================================================= */

/** How many days of a credit row count toward Employee.balances.wellnessDays. */
function balanceContributionOf(row) {
  return round2(row?.remainingDays || 0);
}

/** The balance an employee should have, given computeEmployeeLedger() totals. */
function expectedBalanceFromLedger(ledger) {
  return ledger.remainingDays;
}

/* =========================================================================
   PERIOD / LIMIT HELPERS (mirror addCredit)
========================================================================= */

function getPeriodBounds(refDate) {
  const ref = parseDate(refDate) || new Date();
  const year = ref.getFullYear();
  const isFirstHalf = ref.getMonth() < 6;
  return {
    year,
    isFirstHalf,
    yearStart: new Date(year, 0, 1),
    yearEnd: new Date(year, 11, 31, 23, 59, 59, 999),
    halfStart: new Date(year, isFirstHalf ? 0 : 6, 1),
    halfEnd: new Date(
      year,
      isFirstHalf ? 5 : 11,
      isFirstHalf ? 30 : 31,
      23,
      59,
      59,
      999,
    ),
  };
}

/**
 * Limit usage for one employee in the period of `bounds`.
 * `totals` comes from getPeriodTotals(); `credited` is what those totals contain
 * (when the caller excluded a batch, it is "credited in other batches").
 */
function describePeriod(employee, bounds, totals) {
  const isJobOrder = employee?.employeeType === JOB_ORDER_TYPE;
  const limit = isJobOrder ? CREDIT_LIMITS.JOB_ORDER : CREDIT_LIMITS.DEFAULT;
  const credited = round2(
    isJobOrder ? totals?.halfTotal || 0 : totals?.yearTotal || 0,
  );
  return {
    isJobOrder,
    limit,
    credited,
    available: round2(Math.max(limit - credited, 0)),
    label: isJobOrder
      ? `${bounds.isFirstHalf ? "Jan–Jun" : "Jul–Dec"} ${bounds.year}`
      : String(bounds.year),
  };
}

/**
 * Credited days per employee for the year (and half-year) containing refDate.
 * Counts the same rows addCredit counts: batch not ROLLEDBACK, row not ROLLEDBACK.
 */
async function getPeriodTotals(
  employeeIds,
  refDate,
  { excludeCreditId, session } = {},
) {
  const ids = [...new Set((employeeIds || []).map(String))]
    .filter(isObjectIdString)
    .map(toObjectId);
  if (!ids.length) return new Map();

  const b = getPeriodBounds(refDate);
  const match = {
    dateApproved: { $gte: b.yearStart, $lte: b.yearEnd },
    status: { $ne: CREDIT_STATUS.ROLLEDBACK },
    "employees.employee": { $in: ids },
  };
  if (excludeCreditId) match._id = { $ne: toObjectId(excludeCreditId) };

  const pipeline = WellnessCredit.aggregate([
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
        yearTotal: { $sum: { $ifNull: ["$employees.creditedDays", 0] } },
        halfTotal: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$dateApproved", b.halfStart] },
                  { $lte: ["$dateApproved", b.halfEnd] },
                ],
              },
              { $ifNull: ["$employees.creditedDays", 0] },
              0,
            ],
          },
        },
      },
    },
  ]);
  if (session) pipeline.session(session);

  const rows = await pipeline;
  return new Map(
    rows.map((r) => [
      String(r._id),
      { yearTotal: round2(r.yearTotal), halfTotal: round2(r.halfTotal) },
    ]),
  );
}

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

/**
 * "juan dela" → every word must match at least one searchable field.
 * A 24-char hex string also matches the employee _id.
 */
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

/* =========================================================================
   LEDGER (what the credits say an employee has)
========================================================================= */

async function computeEmployeeLedger(employeeId, session) {
  const id = toObjectId(employeeId);
  const pipeline = WellnessCredit.aggregate([
    {
      $match: {
        "employees.employee": id,
        status: { $ne: CREDIT_STATUS.ROLLEDBACK },
      },
    },
    { $unwind: "$employees" },
    {
      $match: {
        "employees.employee": id,
        "employees.status": { $ne: ROW_STATUS.ROLLEDBACK },
      },
    },
    {
      $group: {
        _id: null,
        batches: { $sum: 1 },
        credited: { $sum: { $ifNull: ["$employees.creditedDays", 0] } },
        used: { $sum: { $ifNull: ["$employees.usedDays", 0] } },
        reserved: { $sum: { $ifNull: ["$employees.reservedDays", 0] } },
        remaining: { $sum: { $ifNull: ["$employees.remainingDays", 0] } },
      },
    },
  ]);
  if (session) pipeline.session(session);

  const [row] = await pipeline;
  return {
    batches: row?.batches || 0,
    creditedDays: round2(row?.credited || 0),
    usedDays: round2(row?.used || 0),
    reservedDays: round2(row?.reserved || 0),
    remainingDays: round2(row?.remaining || 0),
  };
}

function summarizeRows(rows = []) {
  const live = rows.filter((r) => r.status !== ROW_STATUS.ROLLEDBACK);
  const sum = (field) =>
    round2(live.reduce((acc, r) => acc + (Number(r[field]) || 0), 0));
  return {
    employeeCount: rows.length,
    activeEmployeeCount: live.length,
    creditedDays: sum("creditedDays"),
    usedDays: sum("usedDays"),
    reservedDays: sum("reservedDays"),
    remainingDays: sum("remainingDays"),
  };
}

/* =========================================================================
   EDIT PLANNER (pure — no database access)
========================================================================= */

function snapshotRow(row) {
  return {
    _id: row._id ? String(row._id) : undefined,
    employee: String(row.employee?._id ?? row.employee),
    creditedDays: round2(row.creditedDays || 0),
    usedDays: round2(row.usedDays || 0),
    reservedDays: round2(row.reservedDays || 0),
    remainingDays: round2(row.remainingDays || 0),
    status: row.status || ROW_STATUS.ACTIVE,
    dateCredited: row.dateCredited ? new Date(row.dateCredited) : null,
  };
}

/**
 * Final status + remaining days of a row. remainingDays is always derived, never typed:
 *   • batch ROLLEDBACK or row ROLLEDBACK → ROLLEDBACK, remaining 0
 *   • batch EXPIRED → remaining 0; EXPIRED if days were forfeited, else EXHAUSTED
 *     (same result expirePreviousYearCredits produces)
 *   • row EXPIRED inside a CREDITED batch → EXPIRED, remaining 0
 *   • otherwise remaining = credited − used − reserved; ACTIVE if > 0, else EXHAUSTED
 */
function resolveRowState({
  headerStatus,
  requestedStatus,
  creditedDays,
  usedDays,
  reservedDays,
}) {
  const unclaimed = round2(creditedDays - usedDays - reservedDays);

  if (
    headerStatus === CREDIT_STATUS.ROLLEDBACK ||
    requestedStatus === ROW_STATUS.ROLLEDBACK
  ) {
    return { status: ROW_STATUS.ROLLEDBACK, remainingDays: 0 };
  }
  if (headerStatus === CREDIT_STATUS.EXPIRED) {
    if (requestedStatus === ROW_STATUS.EXPIRED) {
      return { status: ROW_STATUS.EXPIRED, remainingDays: 0 };
    }
    return {
      status: unclaimed > 0 ? ROW_STATUS.EXPIRED : ROW_STATUS.EXHAUSTED,
      remainingDays: 0,
    };
  }
  if (requestedStatus === ROW_STATUS.EXPIRED) {
    return { status: ROW_STATUS.EXPIRED, remainingDays: 0 };
  }
  return {
    status: unclaimed > 0 ? ROW_STATUS.ACTIVE : ROW_STATUS.EXHAUSTED,
    remainingDays: Math.max(unclaimed, 0),
  };
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
 *   dateApproved?, days?, status?,
 *   employees?: [{ _id?, employee, creditedDays?, usedDays?, reservedDays?, status?, dateCredited? }],
 *   options?: { adjustBalances = true, overrideLimit = false, force = false }
 * }
 * When `employees` is sent it is the complete list: rows left out are removed,
 * rows without `_id` are added. Omitted row fields keep their current values.
 */
function buildEditPlan({
  credit,
  payload = {},
  employeesById,
  periodTotals,
  userId,
  now = new Date(),
}) {
  const errors = [];
  const warnings = [];
  const options = normalizeOptions(payload.options);
  const nameOf = (id) =>
    fullName(employeesById.get(String(id))) ||
    `Employee ${String(id).slice(-6)}`;

  /* ---------- batch (header) fields ---------- */
  const headerBefore = {
    dateApproved: credit.dateApproved ? new Date(credit.dateApproved) : null,
    days: round2(credit.days || 0),
    status: credit.status || CREDIT_STATUS.CREDITED,
  };
  const headerAfter = { ...headerBefore };

  if (payload.dateApproved !== undefined) {
    const d = parseDate(payload.dateApproved);
    if (!d) errors.push("Date approved is not a valid date.");
    else headerAfter.dateApproved = d;
  }
  if (payload.days !== undefined) {
    const n = parseNumber(payload.days);
    if (n === null || n <= 0)
      errors.push("Batch days must be a number greater than 0.");
    else headerAfter.days = n;
  }
  if (payload.status !== undefined) {
    const s = sanitizeString(payload.status, 20).toUpperCase();
    if (!Object.values(CREDIT_STATUS).includes(s)) {
      errors.push(
        `Batch status must be one of: ${Object.values(CREDIT_STATUS).join(", ")}.`,
      );
    } else {
      headerAfter.status = s;
    }
  }

  const headerChanges = [];
  if (!sameTime(headerBefore.dateApproved, headerAfter.dateApproved)) {
    headerChanges.push({
      field: "dateApproved",
      from: headerBefore.dateApproved,
      to: headerAfter.dateApproved,
    });
  }
  if (headerBefore.days !== headerAfter.days) {
    headerChanges.push({
      field: "days",
      from: headerBefore.days,
      to: headerAfter.days,
    });
  }
  if (headerBefore.status !== headerAfter.status) {
    headerChanges.push({
      field: "status",
      from: headerBefore.status,
      to: headerAfter.status,
    });
  }
  const dateApprovedChanged = headerChanges.some(
    (c) => c.field === "dateApproved",
  );

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
    errors.push("A credit batch must have at least one employee.");

  const bounds = getPeriodBounds(headerAfter.dateApproved);
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
      errors.push(`${label}: this row does not belong to this credit batch.`);
      return;
    }
    if (rowId) {
      if (seenRowIds.has(rowId)) {
        errors.push(`${label}: the same row is listed twice.`);
        return;
      }
      seenRowIds.add(rowId);
    }

    const employeeId = String(
      input.employee?._id ?? input.employee ?? old?.employee ?? "",
    );
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
      errors.push(`${name} is listed more than once in this batch.`);
      return;
    }
    seenEmployees.add(employeeId);

    const employeeChanged = Boolean(old) && old.employee !== employeeId;
    if (employeeChanged && (old.usedDays > 0 || old.reservedDays > 0)) {
      errors.push(
        `${label}: cannot move this credit from ${nameOf(old.employee)} to ${name} because ` +
          `${nameOf(old.employee)} already used or reserved days from it.`,
      );
      return;
    }

    let invalidNumber = false;
    const readDays = (field, fallback) => {
      if (input[field] === undefined) return fallback;
      const n = parseNumber(input[field]);
      if (n === null || n < 0) {
        errors.push(
          `${name}: ${DAY_FIELD_LABELS[field]} must be a number of 0 or more.`,
        );
        invalidNumber = true;
        return 0;
      }
      return n;
    };
    const creditedDays = readDays(
      "creditedDays",
      old ? old.creditedDays : headerAfter.days,
    );
    const usedDays = readDays("usedDays", old ? old.usedDays : 0);
    const reservedDays = readDays("reservedDays", old ? old.reservedDays : 0);
    if (invalidNumber) return;

    if (creditedDays <= 0) {
      errors.push(`${name}: credited days must be greater than 0.`);
      return;
    }
    if (round2(usedDays + reservedDays) > creditedDays) {
      errors.push(
        `${name}: used (${usedDays}) + reserved (${reservedDays}) cannot be more than credited (${creditedDays}).`,
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

    let dateCredited = old?.dateCredited || headerAfter.dateApproved || now;
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
      headerStatus: headerAfter.status,
      requestedStatus,
      creditedDays,
      usedDays,
      reservedDays,
    });

    if (state.status === ROW_STATUS.ROLLEDBACK) {
      const alreadyRolledBack =
        Boolean(old) &&
        !employeeChanged &&
        old.status === ROW_STATUS.ROLLEDBACK;
      if (reservedDays > 0) {
        errors.push(
          `${name}: ${reservedDays} day(s) are reserved by pending applications. ` +
            "Resolve those applications (or set reserved days to 0) before rolling back.",
        );
      }
      if (usedDays > 0 && !alreadyRolledBack && !options.force) {
        errors.push(
          `${name}: ${usedDays} day(s) were already used. Turn on "Force" to roll back anyway.`,
        );
      }
    }

    // Limit check — only when this row starts counting or counts for more.
    const counts =
      headerAfter.status !== CREDIT_STATUS.ROLLEDBACK &&
      state.status !== ROW_STATUS.ROLLEDBACK;
    const countedBefore =
      Boolean(old) &&
      !employeeChanged &&
      headerBefore.status !== CREDIT_STATUS.ROLLEDBACK &&
      old.status !== ROW_STATUS.ROLLEDBACK;
    const needsLimitCheck =
      counts &&
      (!countedBefore ||
        creditedDays > old.creditedDays ||
        dateApprovedChanged);

    if (needsLimitCheck) {
      const period = describePeriod(emp, bounds, periodTotals.get(employeeId));
      const total = round2(period.credited + creditedDays);
      if (total > period.limit) {
        const msg =
          `${name}: would have ${total} day(s) credited for ${period.label} ` +
          `(limit ${period.limit}; ${period.credited} from other batches).`;
        if (options.overrideLimit) warnings.push(`${msg} Limit overridden.`);
        else errors.push(`${msg} Turn on "Override limit" to allow it.`);
      }
    }

    const after = {
      _id: old?._id,
      employee: employeeId,
      creditedDays,
      usedDays,
      reservedDays,
      remainingDays: round2(state.remainingDays),
      status: state.status,
      dateCredited,
    };

    const changes = diffRow(old, after).map((c) =>
      c.field === "employee"
        ? { ...c, from: nameOf(c.from), to: nameOf(c.to) }
        : c,
    );

    rowPlans.push({
      rowId: old?._id || null,
      employee: {
        _id: employeeId,
        name,
        employeeType: emp.employeeType || null,
      },
      action: !old ? "added" : changes.length ? "updated" : "unchanged",
      before: old || null,
      after,
      changes,
    });
    nextRows.push(after);
  });

  // Rows left out of the payload are removed.
  if (rowsProvided && Array.isArray(payload.employees)) {
    for (const old of oldRows) {
      if (seenRowIds.has(old._id)) continue;
      const name = nameOf(old.employee);
      if (old.usedDays > 0 || old.reservedDays > 0) {
        errors.push(
          `${name}: cannot be removed because days were already used or reserved from this credit. ` +
            "Keep the row and change its status or numbers instead.",
        );
      }
      rowPlans.push({
        rowId: old._id,
        employee: {
          _id: old.employee,
          name,
          employeeType: employeesById.get(old.employee)?.employeeType || null,
        },
        action: "removed",
        before: old,
        after: null,
        changes: [],
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
    oldRows.forEach((r) => bump(r.employee, -balanceContributionOf(r)));
    nextRows.forEach((r) => bump(r.employee, balanceContributionOf(r)));

    for (const [id, delta] of deltas) {
      if (!delta) continue;
      const current = round2(
        employeesById.get(id)?.balances?.wellnessDays || 0,
      );
      const next = round2(current + delta);
      balanceChanges.push({
        employee: { _id: id, name: nameOf(id) },
        current,
        delta,
        after: options.adjustBalances ? next : current,
      });
      if (options.adjustBalances && next < 0) {
        const msg = `${nameOf(id)}: balance would go below zero (${current} → ${next}).`;
        if (options.force) warnings.push(`${msg} Forced.`);
        else errors.push(`${msg} Turn on "Force" to allow it.`);
      }
    }
    if (!options.adjustBalances && balanceChanges.length) {
      warnings.push(
        "Balances will NOT be adjusted. Stored balances will no longer match the credits until you recalculate them.",
      );
    }
  }

  /* ---------- extra warnings ---------- */
  if (
    headerAfter.status === CREDIT_STATUS.CREDITED &&
    nextRows.length &&
    nextRows.every((r) => r.status === ROW_STATUS.ROLLEDBACK)
  ) {
    warnings.push(
      "Every employee in this batch is rolled back. Consider setting the batch status to ROLLEDBACK.",
    );
  }
  if (nextRows.some((r) => r.creditedDays !== headerAfter.days)) {
    warnings.push(
      "Some employees have credited days that differ from the batch days. This is allowed.",
    );
  }

  /* ---------- rollback metadata ---------- */
  const meta = {};
  if (
    headerAfter.status === CREDIT_STATUS.ROLLEDBACK &&
    headerBefore.status !== CREDIT_STATUS.ROLLEDBACK
  ) {
    meta.dateRolledBack = now;
    meta.rolledBackBy = userId || null;
  } else if (
    headerBefore.status === CREDIT_STATUS.ROLLEDBACK &&
    headerAfter.status !== CREDIT_STATUS.ROLLEDBACK
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
    header: {
      before: headerBefore,
      after: headerAfter,
      changes: headerChanges,
    },
    rows: rowPlans,
    balances: balanceChanges,
    next: { header: headerAfter, rows: nextRows, meta },
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
  const creditQuery = WellnessCredit.findById(creditId);
  if (session) creditQuery.session(session);
  const credit = await creditQuery;
  if (!credit) throw createServiceError("Credit batch not found.", 404);

  const inputIds = Array.isArray(payload.employees)
    ? payload.employees.map((r) =>
        String(r?.employee?._id ?? r?.employee ?? ""),
      )
    : [];
  const ids = [
    ...new Set([
      ...credit.employees.map((r) => String(r.employee)),
      ...inputIds,
    ]),
  ].filter(isObjectIdString);

  const employeeQuery = Employee.find({ _id: { $in: ids } })
    .select("firstName lastName employeeType balances.wellnessDays")
    .lean();
  if (session) employeeQuery.session(session);

  const refDate = parseDate(payload.dateApproved) || credit.dateApproved;
  const [employees, periodTotals] = await Promise.all([
    employeeQuery,
    getPeriodTotals(ids, refDate, { excludeCreditId: credit._id, session }),
  ]);

  return {
    credit,
    employeesById: new Map(employees.map((e) => [String(e._id), e])),
    periodTotals,
  };
}

/* =========================================================================
   PUBLIC SERVICE METHODS
========================================================================= */

/**
 * Employee search for the admin page.
 * Returns balance and limit usage for the period that contains refDate (default today).
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
      "balances.wellnessDays",
      ...getSearchableEmployeeFields(),
    ]),
  ].join(" ");

  const employees = await Employee.find(filter)
    .select(select)
    .sort({ lastName: 1, firstName: 1 })
    .limit(lim)
    .lean();

  const ref = parseDate(refDate) || new Date();
  const bounds = getPeriodBounds(ref);
  const totals = await getPeriodTotals(
    employees.map((e) => e._id),
    ref,
  );

  return {
    refDate: ref,
    results: employees.map((e) => ({
      ...e,
      fullName: fullName(e),
      wellnessBalance: round2(e.balances?.wellnessDays || 0),
      period: describePeriod(e, bounds, totals.get(String(e._id))),
    })),
  };
}

/** Paginated batch list with search (employee name/email/position or batch id), status and date filters. */
async function listCredits({
  page,
  limit,
  search,
  status,
  employeeId,
  from,
  to,
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

  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (from && !fromDate) throw createServiceError("Invalid 'from' date.", 400);
  if (to && !toDate) throw createServiceError("Invalid 'to' date.", 400);
  if (fromDate || toDate) {
    filter.dateApproved = {};
    if (fromDate) filter.dateApproved.$gte = fromDate;
    if (toDate) filter.dateApproved.$lte = endOfDay(toDate);
  }

  const q = sanitizeString(search, 100);
  if (q) {
    const matches = await Employee.find(buildEmployeeSearchFilter(q))
      .select("_id")
      .limit(1000)
      .lean();
    const or = [{ "employees.employee": { $in: matches.map((m) => m._id) } }];
    if (isObjectIdString(q)) or.push({ _id: toObjectId(q) });
    filter.$or = or;
  }

  const [total, items, statusAgg] = await Promise.all([
    WellnessCredit.countDocuments(filter),
    WellnessCredit.find(filter)
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
    WellnessCredit.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts = { ALL: 0, CREDITED: 0, ROLLEDBACK: 0, EXPIRED: 0 };
  statusAgg.forEach((row) => {
    if (statusCounts[row._id] !== undefined) statusCounts[row._id] = row.count;
    statusCounts.ALL += row.count;
  });

  return {
    items: items.map((item) => ({
      ...item,
      summary: summarizeRows(item.employees),
    })),
    total,
    page: pg.page,
    limit: pg.limit,
    totalPages: Math.max(Math.ceil(total / pg.limit), 1),
    statusCounts,
  };
}

/**
 * One batch, ready for the edit form.
 * Rows keep `employee` as the id and get `employeeInfo` (null if the employee was deleted)
 * plus `period` (credited in OTHER batches for the same period + limit).
 */
async function getCreditForEdit(creditId) {
  assertObjectId(creditId, "creditId");

  const query = WellnessCredit.findById(creditId);
  if (HAS_EDIT_HISTORY) query.select("+editHistory");
  const credit = await query.lean();
  if (!credit) throw createServiceError("Credit batch not found.", 404);

  const rowEmployeeIds = (credit.employees || []).map((r) =>
    String(r.employee),
  );
  const history = HAS_EDIT_HISTORY ? credit.editHistory || [] : [];
  const peopleIds = [
    ...new Set(
      [
        ...rowEmployeeIds,
        credit.creditedBy,
        credit.rolledBackBy,
        ...history.map((h) => h.editedBy),
      ]
        .filter(Boolean)
        .map(String),
    ),
  ].filter(isObjectIdString);

  const [people, periodTotals] = await Promise.all([
    Employee.find({ _id: { $in: peopleIds } })
      .select(
        "firstName lastName position email employeeType balances.wellnessDays",
      )
      .lean(),
    getPeriodTotals(rowEmployeeIds, credit.dateApproved, {
      excludeCreditId: credit._id,
    }),
  ]);

  const byId = new Map(people.map((p) => [String(p._id), p]));
  const bounds = getPeriodBounds(credit.dateApproved);
  const brief = (id) => {
    if (!id) return null;
    const p = byId.get(String(id));
    return p
      ? {
          _id: p._id,
          firstName: p.firstName,
          lastName: p.lastName,
          position: p.position,
        }
      : { _id: id, firstName: "Unknown", lastName: "user" };
  };

  const employees = (credit.employees || []).map((row) => {
    const info = byId.get(String(row.employee)) || null;
    return {
      ...row,
      employee: String(row.employee),
      employeeInfo: info
        ? {
            _id: info._id,
            firstName: info.firstName,
            lastName: info.lastName,
            position: info.position,
            email: info.email,
            employeeType: info.employeeType,
            wellnessBalance: round2(info.balances?.wellnessDays || 0),
          }
        : null,
      period: info
        ? describePeriod(info, bounds, periodTotals.get(String(row.employee)))
        : null,
    };
  });

  return {
    ...credit,
    employees,
    creditedBy: brief(credit.creditedBy),
    rolledBackBy: brief(credit.rolledBackBy),
    editHistory: history
      .slice()
      .sort((a, b) => new Date(b.editedAt) - new Date(a.editedAt))
      .map((h) => ({ ...h, editedBy: brief(h.editedBy) })),
    summary: summarizeRows(employees),
  };
}

/** Dry run of updateCredit: returns the full plan, including errors, without saving. */
async function previewCreditUpdate(creditId, payload = {}, userId) {
  assertObjectId(creditId, "creditId");
  const { credit, employeesById, periodTotals } = await loadEditContext(
    creditId,
    payload,
    null,
  );
  const plan = buildEditPlan({
    credit,
    payload,
    employeesById,
    periodTotals,
    userId,
  });

  const expected = parseDate(payload.expectedUpdatedAt);
  if (
    expected &&
    credit.updatedAt &&
    expected.getTime() !== credit.updatedAt.getTime()
  ) {
    plan.warnings.unshift(
      "Someone changed this batch after you opened it. Saving will be refused — reload it first.",
    );
  }
  return toPublicPlan(plan);
}

/**
 * Saves an admin edit atomically: batch fields, rows, balances and the edit log.
 * Throws 400 with `details` (all validation errors) or 409 if the batch changed meanwhile.
 */
async function updateCredit(creditId, payload = {}, userId) {
  assertObjectId(creditId, "creditId");
  assertObjectId(userId, "userId");
  const reason = sanitizeString(payload.reason, 500);

  let plan = null;
  let before = null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { credit, employeesById, periodTotals } = await loadEditContext(
        creditId,
        payload,
        session,
      );

      const expected = parseDate(payload.expectedUpdatedAt);
      if (
        expected &&
        credit.updatedAt &&
        expected.getTime() !== credit.updatedAt.getTime()
      ) {
        throw createServiceError(
          "This credit batch was changed by someone else after you opened it. Reload it and apply your edits again.",
          409,
        );
      }

      before = credit.toObject();
      plan = buildEditPlan({
        credit,
        payload,
        employeesById,
        periodTotals,
        userId,
        now: new Date(),
      });

      if (!plan.valid) {
        const extra =
          plan.errors.length > 1 ? ` (+${plan.errors.length - 1} more)` : "";
        throw createServiceError(`${plan.errors[0]}${extra}`, 400, plan.errors);
      }
      if (!plan.hasChanges) return;

      const { header, rows, meta } = plan.next;
      credit.dateApproved = header.dateApproved;
      credit.days = header.days;
      credit.status = header.status;
      credit.employees = rows.map(({ _id, ...rest }) =>
        _id ? { _id, ...rest } : rest,
      );

      if ("dateRolledBack" in meta) {
        credit.dateRolledBack = meta.dateRolledBack || undefined;
        credit.rolledBackBy = meta.rolledBackBy || undefined;
      }

      await credit.save({ session });

      if (plan.options.adjustBalances) {
        const ops = plan.balances
          .filter((b) => b.delta !== 0)
          .map((b) => ({
            updateOne: {
              filter: { _id: toObjectId(b.employee._id) },
              update: { $inc: { "balances.wellnessDays": b.delta } },
            },
          }));
        if (ops.length) await Employee.bulkWrite(ops, { session });
      }

      if (HAS_EDIT_HISTORY) {
        await WellnessCredit.updateOne(
          { _id: credit._id },
          { $push: { editHistory: buildHistoryEntry(plan, userId, reason) } },
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

/** Stored balance vs. what the employee's credits add up to. */
async function getEmployeeBalanceCheck(employeeId) {
  assertObjectId(employeeId, "employeeId");

  const fields = [
    ...new Set([
      "firstName",
      "lastName",
      "position",
      "email",
      "employeeType",
      "balances.wellnessDays",
      ...getSearchableEmployeeFields(),
    ]),
  ].join(" ");
  const employee = await Employee.findById(employeeId).select(fields).lean();
  if (!employee) throw createServiceError("Employee not found.", 404);

  const today = new Date();
  const [ledger, totals] = await Promise.all([
    computeEmployeeLedger(employeeId),
    getPeriodTotals([employeeId], today),
  ]);

  const storedBalance = round2(employee.balances?.wellnessDays || 0);
  const computedBalance = expectedBalanceFromLedger(ledger);

  return {
    employee: { ...employee, fullName: fullName(employee) },
    storedBalance,
    computedBalance,
    difference: round2(storedBalance - computedBalance),
    inSync: storedBalance === computedBalance,
    ledger,
    period: describePeriod(
      employee,
      getPeriodBounds(today),
      totals.get(String(employeeId)),
    ),
  };
}

/** Sets balances.wellnessDays to what the credits add up to. */
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

      const ledger = await computeEmployeeLedger(employeeId, session);
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
  listCredits,
  getCreditForEdit,
  previewCreditUpdate,
  updateCredit,
  getEmployeeBalanceCheck,
  recalculateEmployeeBalance,

  // exported for tests / reuse
  buildEditPlan,
  resolveRowState,
  buildEmployeeSearchFilter,
  getPeriodBounds,
  describePeriod,
  CREDIT_STATUS,
  ROW_STATUS,
};
