// adminConsole.js
// API for the owner-only admin console.
import API from "./api";

const unwrap = (res) => res?.data;

const withCreds = (params = {}) => ({ params, withCredentials: true });

// Keeps the status code: 404 = this account isn't allowed in the console.
const safeError = (err, fallback = "Request failed") => {
  const data = err?.response?.data;
  const msg = data?.message || data?.error || err?.message || fallback;
  const e = new Error(msg);
  e.status = err?.response?.status;
  e.details = Array.isArray(data?.details) ? data.details : [];
  throw e;
};

/* =========================
   ADMIN CONSOLE
   Backend: routers/adminConsoleRoutes.js
   Mounted as app.use("/api/admin/console", ...)
   → relative to your API base URL this is "/admin/console"
========================= */

const CONSOLE_BASE = "/admin/console";

/**
 * Asks the server whether the logged-in account may open the console.
 * returns: { ok: true } for accounts listed in CTO_SYNC_REFS;
 * throws an error with status 404 for everyone else.
 */
export const checkAdminConsoleAccess = async () => {
  try {
    const res = await API.get(`${CONSOLE_BASE}/access`, withCreds());
    return unwrap(res);
  } catch (err) {
    safeError(err, "Not found");
  }
};
