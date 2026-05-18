// src/api/generalSettingsApi.js

import API from "./api";

/* =========================================
   SESSION SETTINGS
========================================= */

// Get Session Settings (Admin Permission Required)
export const fetchSessionsGeneralSettings = async () => {
  const { data } = await API.get("/settings/general/session");
  return data;
};

// Update Session Settings (Admin Permission Required)
export const updateSessionsGeneralSettings = async (payload = {}) => {
  const { data } = await API.put("/settings/general/session", payload);

  return data;
};

/* =========================================
   WORKING DAYS SETTINGS
========================================= */

// Public/Auth-only fetch
// No special permission required
export const fetchPublicWorkingDaysGeneralSettings = async () => {
  const { data } = await API.get("/settings/general/working-days/public");

  return data;
};

// Admin Fetch
export const fetchWorkingDaysGeneralSettings = async () => {
  const { data } = await API.get("/settings/general/working-days");

  return data;
};

// Admin Update
export const updateWorkingDaysGeneralSettings = async (payload = {}) => {
  const { data } = await API.put("/settings/general/working-days", payload);

  return data;
};
