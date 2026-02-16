// src/api/generalSettingsApi.js
import API from "./api";

/* =========================
   SESSION SETTINGS
   ========================= */
export const fetchSessionsGeneralSettings = async () => {
  const { data } = await API.get("/settings/general/session");
  return data;
};

export const updateSessionsGeneralSettings = async (payload = {}) => {
  const { data } = await API.put("/settings/general/session", payload);
  return data; // { ok: true, data: updatedSessionSettings }
};

/* =========================
   WORKING DAYS SETTINGS
   ========================= */
export const fetchWorkingDaysGeneralSettings = async () => {
  const { data } = await API.get("/settings/general/working-days");
  return data;
};

export const updateWorkingDaysGeneralSettings = async (payload = {}) => {
  const { data } = await API.put("/settings/general/working-days", payload);
  return data; // { ok: true, data: updatedWorkingDaysSettings }
};
