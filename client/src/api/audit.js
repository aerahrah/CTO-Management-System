import API from "./api";

export const getAuditLogs = async (params = {}) => {
  try {
    const res = await API.get("/audit-logs", {
      params,
    });
    return res.data;
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    throw err;
  }
};
