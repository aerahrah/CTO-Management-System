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
   WELLNESS APPLICATIONS (Employee / Admin)
========================= */

export const addWellnessApplicationRequest = async (payload) => {
  try {
    const res = await API.post("/wellness/applications/apply", payload, {
      withCredentials: true,
    });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to submit Wellness Leave application");
  }
};

export const fetchAllWellnessApplications = async (params = {}) => {
  try {
    const res = await API.get("/wellness/applications/all", withCreds(params));
    console.log(res.data);
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch Wellness Leave applications");
  }
};

export const fetchMyWellnessApplications = async (params = {}) => {
  try {
    const res = await API.get(
      "/wellness/applications/my-application",
      withCreds(params),
    );
    console.log(res);
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

/* =========================
   WELLNESS APPROVERS FLOW
========================= */

export const fetchPendingWellnessCount = async () => {
  try {
    const res = await API.get(
      "/wellness/applications/pending-count",
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch pending Wellness Leave count");
  }
};

export const fetchMyWellnessApplicationsApprovals = async (params = {}) => {
  try {
    const res = await API.get(
      "/wellness/applications/approvers/my-approvals",
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch your Wellness Leave approvals");
  }
};

export const getWellnessApplicationById = async (id) => {
  try {
    const res = await API.get(
      `/wellness/applications/approvers/my-approvals/${id}`,
      withCreds(),
    );
    console.log(res.data);
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch Wellness Leave application details");
  }
};

export const approveWellnessApplicationRequest = async (applicationId) => {
  try {
    const res = await API.post(
      `/wellness/applications/approver/${applicationId}/approve`,
      {},
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to approve Wellness Leave application");
  }
};

export const rejectWellnessApplicationRequest = async (
  applicationId,
  remarks,
) => {
  try {
    const res = await API.put(
      `/wellness/applications/approver/${applicationId}/reject`,
      { remarks },
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to reject Wellness Leave application");
  }
};
