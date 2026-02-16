import API from "./api";

export const getAuditLogs = async (params = {}) => {
  try {
    const res = await API.get("/audit-logs", {
      params,
    });
    return res.data;
  } catch (err) {
    throw err;
  }
};
