import API from "./api";

const unwrap = (res) => res?.data;

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

export const fetchAllApprovalRoutes = async () => {
  try {
    const res = await API.get("/approval-routes", { withCredentials: true });
    return unwrap(res)?.data || [];
  } catch (err) {
    safeError(err, "Failed to fetch approval routes");
  }
};

export const fetchApprovalRouteById = async (id) => {
  try {
    const res = await API.get(`/approval-routes/${id}`, { withCredentials: true });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to fetch approval route");
  }
};

export const createApprovalRoute = async (payload) => {
  try {
    const res = await API.post("/approval-routes", payload, { withCredentials: true });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to create approval route");
  }
};

export const updateApprovalRoute = async (id, payload) => {
  try {
    const res = await API.patch(`/approval-routes/${id}`, payload, { withCredentials: true });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to update approval route");
  }
};

export const deleteApprovalRoute = async (id) => {
  try {
    const res = await API.delete(`/approval-routes/${id}`, { withCredentials: true });
    return unwrap(res);
  } catch (err) {
    safeError(err, "Failed to delete approval route");
  }
};

export const upsertMyApprovalRoute = async (payload) => {
  try {
    const res = await API.put("/approval-routes/my", payload, { withCredentials: true });
    return unwrap(res)?.data;
  } catch (err) {
    safeError(err, "Failed to save personal workflow");
  }
};
