// adminCtoCredit.js
// API for the admin-only CTO credit memo tools.
import API from "./api";

const unwrap = (res) => res?.data;

const withCreds = (params = {}) => ({ params, withCredentials: true });

// Same as your safeError, but also keeps the backend's `details` list
// (every validation error from preview/save) and the status code
// (409 = someone else edited the memo, 404 = not found / no admin access).
const safeError = (err, fallback = "Request failed") => {
  const data = err?.response?.data;
  const msg = data?.message || data?.error || err?.message || fallback;
  const e = new Error(msg);
  e.status = err?.response?.status;
  e.details = Array.isArray(data?.details) ? data.details : [];
  throw e;
};

/* =========================
   CTO CREDIT MEMO ADMIN
   Backend: routers/adminCtoCreditRoutes.js
   Mounted as app.use("/api/admin/cto-credits", ...)
   → relative to your API base URL this is "/admin/cto-credits"
   Permissions: cto.credits_admin_view / cto.credits_admin_edit
========================= */

const CTO_CREDIT_ADMIN_BASE = "/admin/cto-credits";

// ⚠️ Must be the same field name your uploadCtoMemo.middleware.js expects
// (the one your "Credit CTO" form already uses, e.g. upload.single("memo")).
export const CTO_MEMO_FILE_FIELD = "memo";

// Objects/arrays are sent as JSON strings in form-data; the backend parses them back.
const JSON_FIELDS = ["inclusiveDates", "duration", "employees", "options"];

/** Builds form-data from an edit payload + the new memo file. */
const toMemoFormData = (
  payload = {},
  memoFile,
  fieldName = CTO_MEMO_FILE_FIELD,
) => {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (
      JSON_FIELDS.includes(key) ||
      (typeof value === "object" && !(value instanceof Date))
    ) {
      form.append(key, JSON.stringify(value));
    } else if (value instanceof Date) {
      form.append(key, value.toISOString());
    } else {
      form.append(key, String(value));
    }
  });
  form.append(fieldName, memoFile);
  return form;
};

/* ---------- Employees ---------- */

/**
 * Search employees (to add to a memo) by name, email, position, division or employee ID.
 * params: { q, limit = 10, employeeType, refDate }   // refDate: month to check CSC room for, "YYYY-MM-DD"
 * returns: { refDate, month, results: [{ _id, fullName, firstName, lastName, position, email,
 *            employeeType, ctoBalance,
 *            room: { month, creditedThisMonth, maxMonthly, roomMonthly,
 *                    balance, maxBalance, roomBalance, creditableNow } }] }
 */
export const searchCtoCreditAdminEmployees = async (params = {}) => {
  try {
    const res = await API.get(
      `${CTO_CREDIT_ADMIN_BASE}/employees/search`,
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to search employees");
  }
};

/**
 * Stored CTO balance vs. what the employee's credit memos add up to.
 * returns: { employee, storedBalance, computedBalance, difference, inSync,
 *            ledger: { memos, totalHours, remainingHours, reservedHours, usedHours },
 *            applications: { PENDING: { count, hours }, APPROVED: {...}, ... } }
 */
export const fetchCtoCreditAdminEmployeeBalance = async (employeeId) => {
  try {
    const res = await API.get(
      `${CTO_CREDIT_ADMIN_BASE}/employees/${employeeId}/balance`,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee's CTO balance");
  }
};

/**
 * Sets the employee's stored CTO balance to what their memos add up to.
 * returns: { message, previousBalance, newBalance, changed, check }
 */
export const recalculateCtoCreditAdminEmployeeBalance = async (employeeId) => {
  try {
    const res = await API.post(
      `${CTO_CREDIT_ADMIN_BASE}/employees/${employeeId}/recalculate-balance`,
      {},
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to recalculate CTO balance");
  }
};

/* ---------- Credit memos ---------- */

/**
 * List / search / filter CTO credit memos.
 * params: { page, limit, search,                 // memo no., purpose, employee name/email/position, or memo ID
 *           status: "CREDITED" | "ROLLEDBACK",
 *           employeeId,
 *           from, to,                            // date approved, "YYYY-MM-DD"
 *           overtimeFrom, overtimeTo,            // overtime start date, "YYYY-MM-DD"
 *           sort: "-createdAt" | "createdAt" | "-dateApproved" | "memoNo" | "-inclusiveDates.startDate" | ... }
 * returns: { items: [{ ...memo, memoHours, summary: { employeeCount, activeEmployeeCount,
 *            creditedHours, usedHours, reservedHours, remainingHours, forfeitedHours } }],
 *            total, page, limit, totalPages, statusCounts: { ALL, CREDITED, ROLLEDBACK } }
 */
export const fetchCtoCreditAdminCredits = async (params = {}) => {
  try {
    const res = await API.get(CTO_CREDIT_ADMIN_BASE, withCreds(params));
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch CTO credit memos");
  }
};

/**
 * One memo, ready for editing.
 * returns: { credit } — includes employees[] (each with employeeInfo, room, applications),
 *            memoHours, month, limits, summary, applications (CTO applications using this memo),
 *            creditedBy, rolledBackBy, adminEditHistory
 */
export const fetchCtoCreditAdminCreditById = async (creditId) => {
  try {
    const res = await API.get(
      `${CTO_CREDIT_ADMIN_BASE}/${creditId}`,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch CTO credit memo");
  }
};

/**
 * Dry run — nothing is saved. Same payload as updateCtoCreditAdmin.
 * The file itself is only sent on save; pass `memoFile` here and the preview
 * will show that the memo file is being replaced.
 * returns: { plan: { valid, hasChanges, errors, warnings, options, limits, memoHours, month,
 *                    header: { changes }, rows, balances } }
 */
export const previewCtoCreditAdminUpdate = async (
  creditId,
  payload = {},
  { memoFile } = {},
) => {
  try {
    const body = memoFile
      ? { ...payload, newMemoFileName: memoFile.name || "new memo file" }
      : payload;
    const res = await API.post(
      `${CTO_CREDIT_ADMIN_BASE}/${creditId}/preview`,
      body,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to preview CTO credit memo changes");
  }
};

/**
 * Save an edit. Send only what you want to change.
 * payload: {
 *   memoNo?, purpose?, dateApproved?, dateCredited?,
 *   status?: "CREDITED" | "ROLLEDBACK",
 *   inclusiveDates?: { startDate?, endDate? },
 *   duration?: { hours?, minutes? },                          // max 40 hours
 *   employees?: [{ _id?, employee, creditedHours?, usedHours?, reservedHours?,
 *                  forfeitedHours?, status?, dateCredited? }],  // full list; no _id = new row, left out = removed
 *   options?: { adjustBalances: true, overrideLimit: false, force: false },
 *   reason?,               // saved in the edit log
 *   expectedUpdatedAt?     // updatedAt from fetchCtoCreditAdminCreditById
 * }
 * extras: { memoFile }    // optional File (PDF/JPG/PNG) to replace the memo
 * returns: { message, changed, credit, plan }
 */
export const updateCtoCreditAdmin = async (
  creditId,
  payload = {},
  { memoFile, fieldName = CTO_MEMO_FILE_FIELD } = {},
) => {
  try {
    const url = `${CTO_CREDIT_ADMIN_BASE}/${creditId}`;
    const res = memoFile
      ? await API.put(url, toMemoFormData(payload, memoFile, fieldName), {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        })
      : await API.put(url, payload, withCreds());
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to update CTO credit memo");
  }
};
