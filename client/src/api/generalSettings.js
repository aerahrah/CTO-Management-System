// src/api/generalSettingsApi.js
import API from "./api";

// ✅ GET current general settings
// GET /settings/general
export const fetchGeneralSettings = async () => {
  const { data } = await API.get("/settings/general/session");
  return data; // { ok: true, data: { sessionTimeoutEnabled, sessionTimeoutMinutes, ... } }
};

// ✅ UPDATE general settings (partial update allowed)
// PATCH /settings/general
// payload example: { sessionTimeoutEnabled: true, sessionTimeoutMinutes: 60 }
export const updateGeneralSettings = async (payload = {}) => {
  const { data } = await API.put("/settings/general/session", payload);
  return data; // { ok: true, data: updatedDoc }
};
