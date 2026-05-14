import API from "./api";

const unwrap = (res) => res?.data;

const withParams = (params = {}) => ({ params });

const withCreds = (params = {}) => ({ params, withCredentials: true });

const safeError = (err, fallback = "Request failed") => {
  const msg =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback;
  const e = new Error(msg);
  e.status = err?.response?.status;
  throw e;
};

/* =========================
   WELLNESS APPLICATIONS
========================= */

export const addWellnessApplicationRequest = async (payload) => {
  try {
    const res = await API.post("/wellness/applications", payload, {
      withCredentials: true,
    });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to submit Wellness Leave application");
  }
};

export const fetchAllWellnessApplications = async (params = {}) => {
  try {
    const res = await API.get("/wellness/applications", withCreds(params));
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch Wellness Leave applications");
  }
};

/**
 * Note: Since the backend doesn't have a separate "me" route,
 * this now requires the employeeId to hit the specific employee endpoint.
 */
export const fetchMyWellnessApplications = async (employeeId, params = {}) => {
  try {
    const res = await API.get(
      `/wellness/applications/my-applications`,
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch your Wellness Leave applications");
  }
};

export const fetchEmployeeWellnessApplications = async (
  employeeId,
  params = {},
) => {
  try {
    const res = await API.get(
      `/wellness/applications/employee/${employeeId}`,
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee's Wellness Leave applications");
  }
};

export const cancelWellnessApplicationRequest = async (id) => {
  try {
    const res = await API.patch(
      `/wellness/applications/${id}/cancel`,
      {},
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to cancel Wellness Leave application");
  }
};
