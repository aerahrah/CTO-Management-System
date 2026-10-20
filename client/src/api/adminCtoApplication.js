// adminCtoApplication.js
// API for the admin-only CTO application tools.
import API from "./api";

const unwrap = (res) => res?.data;

const withCreds = (params = {}) => ({ params, withCredentials: true });

// Same as your safeError, but also keeps the backend's `details` list
// (every validation error from preview/save) and the status code
// (409 = someone else edited the application, 404 = not found / no admin permission).
const safeError = (err, fallback = "Request failed") => {
  const data = err?.response?.data;
  const msg = data?.message || data?.error || err?.message || fallback;
  const e = new Error(msg);
  e.status = err?.response?.status;
  e.details = Array.isArray(data?.details) ? data.details : [];
  throw e;
};

/* =========================
   CTO APPLICATION ADMIN
   Backend: routers/adminCtoApplicationRoutes.js
   Mounted as app.use("/api/admin/cto-applications", ...)
   → relative to your API base URL this is "/admin/cto-applications"
   Permissions: cto.admin_view / cto.admin_edit
========================= */

const CTO_ADMIN_BASE = "/admin/cto-applications";

/* ---------- Employees ---------- */

/**
 * Search employees (applicants, approvers, notified employees)
 * by name, email, position, division or employee ID.
 * params: { q, limit = 10, employeeType }
 * returns: { results: [{ _id, fullName, firstName, lastName, position, division,
 *            email, employeeType, ctoBalance }] }
 */
export const searchCtoAdminEmployees = async (params = {}) => {
  try {
    const res = await API.get(
      `${CTO_ADMIN_BASE}/employees/search`,
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
export const fetchCtoAdminEmployeeBalance = async (employeeId) => {
  try {
    const res = await API.get(
      `${CTO_ADMIN_BASE}/employees/${employeeId}/balance`,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee's CTO balance");
  }
};

/**
 * Sets the employee's stored CTO balance to what their credits add up to.
 * returns: { message, previousBalance, newBalance, changed, check }
 */
export const recalculateCtoAdminEmployeeBalance = async (employeeId) => {
  try {
    const res = await API.post(
      `${CTO_ADMIN_BASE}/employees/${employeeId}/recalculate-balance`,
      {},
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to recalculate CTO balance");
  }
};

/**
 * The employee's CTO credit memos — used to choose where an application's hours come from.
 * params: { applicationId }  (optional: also returns how many hours that application takes from each memo)
 * returns: { credits: [{ _id, memoNo, status, dateApproved, inclusiveDates, purpose, uploadedMemo,
 *            row: { total, remaining, reserved, used, status }, appliedByThisApplication, usable }] }
 */
export const fetchCtoAdminEmployeeCredits = async (employeeId, params = {}) => {
  try {
    const res = await API.get(
      `${CTO_ADMIN_BASE}/employees/${employeeId}/credits`,
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee's CTO memos");
  }
};

/* ---------- Applications ---------- */

/**
 * List / search / filter CTO applications.
 * params: { page, limit, search,                       // employee name/email/position, application ID or memo no.
 *           status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "REVOCATION_REQUESTED" | "REVOKED",
 *           employeeId, employeeType: "Organic" | "JO",
 *           from, to,                                   // leave dates, "YYYY-MM-DD"
 *           filedFrom, filedTo,                         // date filed, "YYYY-MM-DD"
 *           sort: "-createdAt" | "createdAt" | "-updatedAt" | "-requestedHours" | ... }
 * returns: { items, total, page, limit, totalPages, statusCounts }
 */
export const fetchCtoAdminApplications = async (params = {}) => {
  try {
    const res = await API.get(CTO_ADMIN_BASE, withCreds(params));
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch CTO applications");
  }
};

/**
 * One application, ready for editing.
 * returns: { application } — includes employeeInfo, memo[].credit, approvals[].approverInfo,
 *            notifiedInfo, overlaps, adminEditHistory, hoursRule, approvalRoles
 */
export const fetchCtoAdminApplicationById = async (applicationId) => {
  try {
    const res = await API.get(
      `${CTO_ADMIN_BASE}/${applicationId}`,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch CTO application");
  }
};

/**
 * Dry run — nothing is saved. Same payload as updateCtoAdminApplication.
 * returns: { plan: { valid, hasChanges, errors, warnings, status, hours,
 *                    fields, memo, steps, balance, options } }
 */
export const previewCtoAdminApplicationUpdate = async (
  applicationId,
  payload,
) => {
  try {
    const res = await API.post(
      `${CTO_ADMIN_BASE}/${applicationId}/preview`,
      payload,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to preview CTO application changes");
  }
};

/**
 * Save an edit. Send only what you want to change.
 * payload: {
 *   reason?, employeeType?, commutation?, requestedHours?,
 *   inclusiveDates?: [ISO timestamp],                                    // e.g. new Date(2026, 10, 3).toISOString(); "YYYY-MM-DD" also works
 *   overallStatus?,
 *   memo?: [{ memoId, appliedHours }],                                  // full list; must add up to requestedHours
 *   approvals?: [{ _id?, approver, role, status, remarks, reviewedAt }], // full list in order; no _id = new step, left out = removed
 *   notifiedEmployees?: [employeeId],
 *   lateFiling?: { isLateFiling, justification },
 *   actionDetails?: { approvedDaysWithPay, approvedDaysWithoutPay, approvedOthersSpecify, disapprovedDueTo },
 *   certificationOfLeaveCredits?: { asOfDate, vacationLeave: {...}, sickLeave: {...} },
 *   applicantSnapshot?: { firstName, lastName, division, position, salaryGrade, salaryAmount, ... },
 *   revocation?: { requestReason, revokeReason },
 *   options?: { adjustCredits: true, adjustBalance: true, force: false },
 *   editReason?,            // saved in the edit log
 *   expectedUpdatedAt?      // updatedAt from fetchCtoAdminApplicationById
 * }
 * returns: { message, changed, application, plan }
 */
export const updateCtoAdminApplication = async (applicationId, payload) => {
  try {
    const res = await API.put(
      `${CTO_ADMIN_BASE}/${applicationId}`,
      payload,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to update CTO application");
  }
};
