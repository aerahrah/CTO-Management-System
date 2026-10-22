// adminWellnessApplication.js
// API for the admin-only Wellness application tools.
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
   WELLNESS APPLICATION ADMIN
   Backend: routers/adminWellnessApplicationRoutes.js
   Mounted as app.use("/api/admin/wellness-applications", ...)
   → relative to your API base URL this is "/admin/wellness-applications"
   Permissions: wellness.applications_admin_view / wellness.applications_admin_edit
========================= */

const APPLICATIONS_BASE = "/admin/wellness-applications";

/* ---------- Employees ---------- */

/**
 * Search employees (applicants, approvers, notified employees)
 * by name, email, position, division or employee ID.
 * params: { q, limit = 10, employeeType }
 * returns: { results: [{ _id, fullName, firstName, middleName, lastName, prefixTitle,
 *            position, division, email, employeeType, wellnessBalance }] }
 */
export const searchWellnessApplicationAdminEmployees = async (params = {}) => {
  try {
    const res = await API.get(
      `${APPLICATIONS_BASE}/employees/search`,
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to search employees");
  }
};

/**
 * Stored wellness balance vs. the credit batches, and the batches vs. the applications.
 * returns: { employee, storedBalance, computedBalance, difference, inSync,
 *            ledger: { batches, creditedDays, usedDays, reservedDays, remainingDays },
 *            applications: { PENDING: { count, days }, APPROVED: {...}, ... },
 *            pool: { expectedReserved, expectedUsed, reservedDays, usedDays,
 *                    reservedDiff, usedDiff, inSync } }
 * pool.inSync = false means the batches' reserved/used days don't match the
 * PENDING / APPROVED + REVOCATION_REQUESTED applications.
 */
export const fetchWellnessApplicationAdminEmployeeBalance = async (
  employeeId,
) => {
  try {
    const res = await API.get(
      `${APPLICATIONS_BASE}/employees/${employeeId}/balance`,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee's Wellness balance");
  }
};

/**
 * Sets the employee's stored wellness balance to the remaining days on their credit batches.
 * returns: { message, previousBalance, newBalance, changed, check }
 */
export const recalculateWellnessApplicationAdminEmployeeBalance = async (
  employeeId,
) => {
  try {
    const res = await API.post(
      `${APPLICATIONS_BASE}/employees/${employeeId}/recalculate-balance`,
      {},
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to recalculate Wellness balance");
  }
};

/**
 * The employee's wellness credit batches (where application days sit), newest first.
 * returns: { credits: [{ _id, dateApproved, days, status,
 *            row: { creditedDays, usedDays, reservedDays, remainingDays, status }, usable }],
 *            ledger: { batches, creditedDays, usedDays, reservedDays, remainingDays } }
 */
export const fetchWellnessApplicationAdminEmployeeCredits = async (
  employeeId,
) => {
  try {
    const res = await API.get(
      `${APPLICATIONS_BASE}/employees/${employeeId}/credits`,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee's Wellness credit batches");
  }
};

/* ---------- Applications ---------- */

/**
 * List / search / filter wellness applications.
 * params: { page, limit, search,                       // employee name/email/position or application ID
 *           status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "REVOCATION_REQUESTED" | "REVOKED",
 *           employeeId, employeeType: "Organic" | "JO",
 *           from, to,                                   // leave dates, "YYYY-MM-DD"
 *           filedFrom, filedTo,                         // date filed, "YYYY-MM-DD"
 *           sort: "-createdAt" | "createdAt" | "-updatedAt" | "-totalDays" | "totalDays" }
 * returns: { items: [{ _id, employee, applicantSnapshot, employeeType, totalDays, inclusiveDates,
 *            reason, overallStatus, isLateFiling,
 *            approvalProgress: { total, approved, waitingOn: { level, name } | null },
 *            createdAt, updatedAt }],
 *            total, page, limit, totalPages,
 *            statusCounts: { ALL, PENDING, APPROVED, REJECTED, CANCELLED, REVOCATION_REQUESTED, REVOKED } }
 */
export const fetchWellnessAdminApplications = async (params = {}) => {
  try {
    const res = await API.get(APPLICATIONS_BASE, withCreds(params));
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch Wellness applications");
  }
};

/**
 * One application, ready for editing.
 * returns: { application } — the application plus:
 *   employeeInfo (with wellnessBalance), approvals[].approverInfo, notifiedInfo,
 *   revokedByInfo, certifiedByInfo, revocationHistory[].processedByInfo,
 *   adminEditHistory (newest first), credits (the employee's batches),
 *   pool (batches vs. applications check), daysRule, overlaps
 *   (other applications on the same dates), approvalRoles
 */
export const fetchWellnessAdminApplicationById = async (applicationId) => {
  try {
    const res = await API.get(
      `${APPLICATIONS_BASE}/${applicationId}`,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch Wellness application");
  }
};

/**
 * Dry run — nothing is saved. Same payload as updateWellnessAdminApplication.
 * returns: { plan: { valid, hasChanges, errors, warnings, options,
 *                    status: { from, to }, days: { from, to },
 *                    fields: [{ field, label, from, to }],
 *                    credits: { reservedDelta, usedDelta, applied,
 *                               moves: [{ creditId, dateApproved, batchStatus, before, after, delta }] },
 *                    steps: [{ stepId, level, approver, role, status, action, changes }],
 *                    balance: { current, delta, after, applied } | null } }
 */
export const previewWellnessAdminApplicationUpdate = async (
  applicationId,
  payload,
) => {
  try {
    const res = await API.post(
      `${APPLICATIONS_BASE}/${applicationId}/preview`,
      payload,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to preview Wellness application changes");
  }
};

/**
 * Save an edit. Send only what you want to change.
 * payload: {
 *   reason?, employeeType?: "Organic" | "JO", commutation?: "Requested" | "Not Requested",
 *   totalDays?,                                                         // half days allowed (steps of 0.5)
 *   inclusiveDates?: [ISO timestamp],                                    // e.g. new Date(2026, 10, 3).toISOString(); "YYYY-MM-DD" also works
 *                                                                        // dates changed without totalDays → one day per date
 *   overallStatus?,
 *   approvals?: [{ _id?, approver, role, status, remarks, reviewedAt }], // full list in order; no _id = new step, left out = removed
 *   notifiedEmployees?: [employeeId],
 *   lateFiling?: { isLateFiling, justification },
 *   actionDetails?: { approvedDaysWithPay, approvedDaysWithoutPay, approvedOthersSpecify, disapprovedDueTo },
 *   certificationOfLeaveCredits?: { asOfDate, vacationLeave: {...}, sickLeave: {...} },
 *   applicantSnapshot?: { firstName, middleName, lastName, division, position,
 *                         wellnessBalance, salaryGrade, salaryAmount, ... },
 *   revocation?: { requestReason, revokeReason },
 *   options?: { adjustCredits: true, adjustBalance: true, force: false },
 *   editReason?,            // saved in the edit log
 *   expectedUpdatedAt?      // updatedAt from fetchWellnessAdminApplicationById
 * }
 * Credit batch days and the wellness balance move automatically with the status / days.
 * returns: { message, changed, application, plan }
 */
export const updateWellnessAdminApplication = async (
  applicationId,
  payload,
) => {
  try {
    const res = await API.put(
      `${APPLICATIONS_BASE}/${applicationId}`,
      payload,
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to update Wellness application");
  }
};
