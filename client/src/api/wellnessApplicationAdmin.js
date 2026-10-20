// wellnessApplicationAdmin.js
// General API for admin-only wellness features. Add future admin wellness calls here.
import API from "./api";

const unwrap = (res) => res?.data;

const withCreds = (params = {}) => ({ params, withCredentials: true });

// Same as your safeError, but also keeps the backend's `details` list
// (every validation error from preview/save) and the status code
// (409 = someone else edited the batch, 403 = missing admin permission).
const safeError = (err, fallback = "Request failed") => {
  const data = err?.response?.data;
  const msg = data?.message || data?.error || err?.message || fallback;
  const e = new Error(msg);
  e.status = err?.response?.status;
  e.details = Array.isArray(data?.details) ? data.details : [];
  throw e;
};

/* =========================
   WELLNESS CREDIT ADMIN
   Backend: routes/adminWellnessCreditRoutes.js
   Mounted as app.use("/api/admin/wellness-credits", ...)
   → relative to your API base URL this is "/admin/wellness-credits"
   Permissions: wellness.admin_view / wellness.admin_edit
========================= */

const CREDITS_BASE = "/admin/wellness-credits";

/* ---------- Employees ---------- */

/**
 * Search employees by name, email or position.
 * params: { q, limit = 10, employeeType, refDate: "YYYY-MM-DD" }
 * returns: { results: [{ _id, fullName, position, employeeType, wellnessBalance,
 *            period: { limit, credited, available, label, isJobOrder } }], refDate }
 */
export const searchWellnessAdminEmployees = async (params = {}) => {
  try {
    const res = await API.get(
      `${CREDITS_BASE}/employees/search`,
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to search employees");
  }
};

/**
 * Stored balance vs. what the employee's credits add up to.
 * returns: { employee, storedBalance, computedBalance, difference, inSync, ledger, period }
 */
export const fetchWellnessAdminEmployeeBalance = async (employeeId) => {
  try {
    const res = await API.get(
      `${CREDITS_BASE}/employees/${employeeId}/balance`,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee's Wellness balance");
  }
};

/**
 * Sets the employee's stored balance to what their credits add up to.
 * returns: { message, previousBalance, newBalance, changed, check }
 */
export const recalculateWellnessAdminEmployeeBalance = async (employeeId) => {
  try {
    const res = await API.post(
      `${CREDITS_BASE}/employees/${employeeId}/recalculate-balance`,
      {},
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to recalculate Wellness balance");
  }
};

/* ---------- Credit batches ---------- */

/**
 * List / search / filter credit batches.
 * params: { page, limit, search, status: "CREDITED" | "ROLLEDBACK" | "EXPIRED",
 *           employeeId, from: "YYYY-MM-DD", to: "YYYY-MM-DD",
 *           sort: "-createdAt" | "-dateApproved" | "dateApproved" | ... }
 * returns: { items, total, page, limit, totalPages, statusCounts }
 */
export const fetchWellnessAdminCredits = async (params = {}) => {
  try {
    const res = await API.get(CREDITS_BASE, withCreds(params));
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch Wellness credit batches");
  }
};

/**
 * One batch, ready for editing.
 * returns: { credit } — rows have `employeeInfo` and `period`, plus `editHistory` and `summary`
 */
export const fetchWellnessAdminCreditById = async (creditId) => {
  try {
    const res = await API.get(`${CREDITS_BASE}/${creditId}`, withCreds());
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch Wellness credit batch");
  }
};

/**
 * Dry run — nothing is saved. Same payload as updateWellnessAdminCredit.
 * returns: { plan: { valid, hasChanges, errors, warnings, header, rows, balances, options } }
 */
export const previewWellnessAdminCreditUpdate = async (creditId, payload) => {
  try {
    const res = await API.post(
      `${CREDITS_BASE}/${creditId}/preview`,
      payload,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to preview Wellness credit changes");
  }
};

/**
 * Save an edit.
 * payload: {
 *   dateApproved?, days?, status?,
 *   employees?: [{ _id?, employee, creditedDays?, usedDays?, reservedDays?, status?, dateCredited? }],
 *   options?: { adjustBalances: true, overrideLimit: false, force: false },
 *   reason?, expectedUpdatedAt?   // updatedAt from fetchWellnessAdminCreditById
 * }
 * `employees` is the full list: rows without _id are added, rows left out are removed.
 * returns: { message, changed, credit, plan }
 */
export const updateWellnessAdminCredit = async (creditId, payload) => {
  try {
    const res = await API.put(
      `${CREDITS_BASE}/${creditId}`,
      payload,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to update Wellness credit batch");
  }
};
