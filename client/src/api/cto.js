// src/api/cto.js
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
   CREDITS
========================= */

export const addCreditRequest = async (formData) => {
  try {
    const res = await API.post("/cto/credits", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      withCredentials: true,
    });
    console.log(formData);
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to add credit request");
  }
};

export const fetchAllCreditRequests = async (params = {}) => {
  try {
    const res = await API.get("/cto/credits/all", withCreds(params));
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch all credit requests");
  }
};

export const fetchMyCreditRequests = async (params = {}) => {
  try {
    const res = await API.get("/cto/credits/my-credits", withCreds(params));
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch my credit requests");
  }
};

export const cancelCreditRequest = async (creditId) => {
  try {
    const res = await API.patch(
      `/cto/credits/${creditId}/cancel`,
      {},
      withCreds(),
    );
    return unwrap(res)?.credit ?? unwrap(res);
  } catch (err) {
    safeError(err, "Failed to cancel credit request");
  }
};

export const rollbackCreditCto = async (creditId) => {
  try {
    const res = await API.patch(
      `/cto/credits/${creditId}/rollback`,
      {},
      withCreds(),
    );
    return unwrap(res)?.credit ?? unwrap(res);
  } catch (err) {
    safeError(err, "Failed to rollback credit request");
  }
};

export const fetchEmployeeCredits = async (employeeId, params = {}) => {
  try {
    const res = await API.get(
      `/cto/credits/${employeeId}/history`,
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee credit history");
  }
};

/* =========================
   CTO APPLICATIONS
========================= */

// ✅ UPDATED: Now supports FormData and multipart headers for late filing uploads
export const addApplicationRequest = async (formData) => {
  try {
    const res = await API.post("/cto/applications/apply", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      withCredentials: true,
    });
    console.log(res);
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to submit CTO application");
  }
};

export const fetchMyCtoApplications = async (params = {}) => {
  try {
    const res = await API.get(
      "/cto/applications/my-application",
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch my CTO applications");
  }
};

// ✅ UPDATED: Fetch remaining creditable hours (CSC limits) for the logged-in user
export const fetchMyRemainingCtoHours = async (params = {}) => {
  try {
    const res = await API.get(
      "/cto/credits/my-remaining-hours",
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch remaining creditable hours");
  }
};

export const fetchAllCtoApplications = async (params = {}) => {
  try {
    const res = await API.get("/cto/applications/all", withCreds(params));
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch all CTO applications");
  }
};

export const fetchEmployeeApplications = async (employeeId, params = {}) => {
  try {
    const res = await API.get(
      `/cto/applications/employee/${employeeId}`,
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee applications");
  }
};

// ✅ UPDATED: Fetch remaining creditable hours (CSC limits) for a specific employee
export const fetchEmployeeRemainingCtoHours = async (
  employeeId,
  params = {},
) => {
  try {
    const res = await API.get(
      `/cto/credits/employee/${employeeId}/remaining-hours`,
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee's remaining creditable hours");
  }
};

export const cancelCtoApplicationRequest = async (applicationId) => {
  try {
    const res = await API.patch(
      `/cto/applications/${applicationId}/cancel`,
      {},
      { withCredentials: true },
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to cancel CTO application");
  }
};

export const followUpCtoApplicationRequest = async (applicationId) => {
  try {
    const res = await API.post(
      `/cto/applications/${applicationId}/follow-up`,
      {},
      { withCredentials: true },
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to send follow-up request");
  }
};

/* =========================
   REVOCATIONS
========================= */

export const fetchRevocationRequests = async (params = {}) => {
  try {
    const res = await API.get(
      "/cto/applications/revocations",
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch revocation requests");
  }
};

export const fetchCtoApplicationById = async (applicationId) => {
  try {
    const res = await API.get(
      `/cto/revocation/applications/${applicationId}`,
      withCreds(),
    );
    return unwrap(res)?.application ?? unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch CTO application details");
  }
};

export const requestRevocation = async (applicationId, formData) => {
  try {
    const res = await API.post(
      `/cto/revocation/applications/${applicationId}/revoke-request`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      },
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to request revocation");
  }
};

export const cancelRevocationCtoRequest = async (applicationId) => {
  try {
    const res = await API.patch(
      `/cto/revocation/applications/${applicationId}/cancel-request`,
      {},
      withCreds(),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to cancel revocation request");
  }
};

export const processRevocationRequest = async (applicationId, payload) => {
  try {
    const res = await API.patch(
      `/cto/revocation/applications/${applicationId}/revoke-process`,
      payload,
      { withCredentials: true },
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to process revocation request");
  }
};

/* =========================
   ORGANIC APPLICATIONS (WELLNESS, ETC.)
========================= */

export const addOrganicApplicationRequest = async (payload) => {
  try {
    const res = await API.post("/cto/organic-applications/apply", payload, {
      withCredentials: true,
    });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to submit Organic/Wellness application");
  }
};

export const fetchMyOrganicApplications = async (params = {}) => {
  try {
    const res = await API.get(
      "/cto/organic-applications/my-application",
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch my Organic/Wellness applications");
  }
};

export const fetchAllOrganicApplications = async (params = {}) => {
  try {
    const res = await API.get(
      "/cto/organic-applications/all",
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch all Organic/Wellness applications");
  }
};

export const fetchEmployeeOrganicApplications = async (
  employeeId,
  params = {},
) => {
  try {
    const res = await API.get(
      `/cto/organic-applications/employee/${employeeId}`,
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee Organic/Wellness applications");
  }
};

export const cancelOrganicApplicationRequest = async (applicationId) => {
  try {
    const res = await API.patch(
      `/cto/organic-applications/${applicationId}/cancel`,
      {},
      { withCredentials: true },
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to cancel Organic/Wellness application");
  }
};

/* =========================
   APPROVALS (CTO)
========================= */

export const approveApplicationRequest = async (applicationId) => {
  try {
    const res = await API.post(
      `/cto/applications/approvers/my-approvals/${applicationId}/approve`,
      {},
      { withCredentials: true },
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to approve application");
  }
};

export const rejectApplicationRequest = async (applicationId, remarks) => {
  try {
    const res = await API.put(
      `/cto/applications/approvers/my-approvals/${applicationId}/reject`,
      { remarks },
      { withCredentials: true },
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to reject application");
  }
};

export const fetchMyCtoApplicationsApprovals = async (params = {}) => {
  try {
    const res = await API.get(
      "/cto/applications/approvers/my-approvals",
      withCreds(params),
    );
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch my approvals");
  }
};

export const getCtoApplicationById = async (applicationId) => {
  try {
    const res = await API.get(
      `/cto/applications/approvers/my-approvals/${applicationId}`,
      { withCredentials: true },
    );
    return unwrap(res)?.data ?? unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch application details");
  }
};

export const fetchPendingCtoCount = async () => {
  try {
    const res = await API.get("/cto/applications/pending-count", {
      withCredentials: true,
    });
    return unwrap(res)?.pending ?? 0;
  } catch (err) {
    safeError(err, "Failed to fetch pending applications count");
  }
};

/* =========================
   APPROVERS / SETTINGS
========================= */

export const fetchApproverSettings = async (designationId) => {
  try {
    const res = await API.get(`/cto/settings/${designationId}`, {
      withCredentials: true,
    });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch approver settings");
  }
};

export const upsertApproverSetting = async (payload) => {
  try {
    const res = await API.post("/cto/settings", payload, {
      withCredentials: true,
    });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to save approver settings");
  }
};

export const fetchApprovers = async () => {
  try {
    const res = await API.get("/cto/applications/approvers", {
      withCredentials: true,
    });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch approvers");
  }
};

/* =========================
   EMPLOYEE / MEMOS / OFFICES
========================= */

export const fetchEmployeeDetails = async (employeeId) => {
  try {
    const res = await API.get(`/cto/employee/${employeeId}/details`, {
      withCredentials: true,
    });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch employee details");
  }
};

export const fetchMyCtoMemos = async () => {
  try {
    const res = await API.get("/employee/memos/me", { withCredentials: true });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch my CTO memos");
  }
};

export const fetchProvincialOffices = async () => {
  try {
    const res = await API.get("/settings/provincial-office", {
      withCredentials: true,
    });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch provincial offices");
  }
};

/* =========================
   DASHBOARD
========================= */

export const fetchDashboard = async () => {
  try {
    const res = await API.get("/cto/dashboard", { withCredentials: true });
    return unwrap(res)?.data ?? unwrap(res);
  } catch (err) {
    safeError(err, "Failed to fetch dashboard");
  }
};
